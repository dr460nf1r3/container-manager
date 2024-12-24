import * as Docker from 'dockerode';
import Dockerode, {
  Container,
  ContainerInfo,
  ContainerInspectInfo,
  Image,
  ImageInfo,
  ImageInspectInfo,
} from 'dockerode';
import * as Stream from 'node:stream';
import { Logger, NotFoundException } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { RunContainerDto } from './validation';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';
import { AppConfig, ContainerConfig, SaveFile, StatusReport } from './interfaces';
import { getConfig } from './config';
import { AppHealth, ContainerHostStatus, ONE_WEEK } from './constants';
import { deleteIfExists, dontTouchContainer, pathExists } from './functions';

export class ContainerManager {
  containers: ContainerConfig[] = [];
  config: AppConfig;
  pullActive: boolean = false;
  docker: Docker;
  initialized: boolean = false;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    // Don't initialize the container manager if we're generating Swagger JSON
    if (process.env.SWAGGER_JSON === 'true') return;

    const socket: string = this.configService.getOrThrow<string>('DOCKER_SOCKET');
    this.docker = new Docker({ socketPath: socket });
    Logger.debug(`Connected to Docker socket at ${socket}`, 'ContainerManager');

    void this.init();
    this.initProcessHandling();
  }

  /**
   * Deploys a new container for a branch.
   * @param options The options for the deployment, including the branch to deploy.
   * @param remove Whether to remove the container before redeploying, if it already exists.
   */
  async newDeployment(options: RunContainerDto, remove = true): Promise<ContainerConfig> {
    const containerInConfig: ContainerConfig = this.containers.find((container) =>
      container.branch?.includes(options.branch),
    );
    const containerIsRunning: ContainerInfo = (await this.docker.listContainers({ all: true })).find(
      (container) =>
        container.Names.includes(`/${this.config.containerPrefix}-${options.branch}`) && container.State === 'running',
    );
    let response: ContainerConfig;

    if (containerIsRunning && containerInConfig) {
      Logger.log(
        `Container host for branch ${options.branch} already exists in config...`,
        'ContainerManager/newDeployment',
      );
      const container: ContainerInfo = (await this.docker.listContainers({ all: true })).find((container) =>
        container.Names.includes(`/${this.config.containerPrefix}-${options.branch}`),
      );

      if (remove) await this.kill(this.docker.getContainer(container.Id));

      const containerIndex: number = this.containers.indexOf(
        this.containers.find((container) => container.branch === options.branch),
      );
      this.containers.splice(containerIndex, 1);

      response = await this.createContainerHost(options);
    } else if (!containerInConfig && !containerIsRunning) {
      Logger.log(
        `Container host for branch ${options.branch} doesn't exist in config, creating a new one...`,
        'ContainerManager/newDeployment',
      );
      response = await this.createContainerHost(options);
    } else if (!containerInConfig && containerIsRunning) {
      Logger.log(
        `Container host for branch ${options.branch} does not exist in config but is already running, recreating...`,
        'ContainerManager/newDeployment',
      );
      await this.kill(this.docker.getContainer(containerIsRunning.Id));
      response = await this.createContainerHost(options);
    }

    await this.saveState();
    return response;
  }

  /**
   * Accesses a container via a subdomain. To be called from the proxy.
   * @param host The host to access the container for.
   * @returns The container to access.
   */
  async accessContainer(host: string): Promise<Container> {
    const containerName: string = host.split('.')[0];
    const container: ContainerConfig = this.containers.find((container) => container.branch === containerName);

    Logger.debug(`Accessing container via subdomain ${containerName}`, 'ContainerManager/accessContainer');
    if (!container) throw new NotFoundException();

    try {
      if (container && container.status === ContainerHostStatus.ACTIVE) {
        Logger.debug(`Container found among active containers...`, 'ContainerManager/accessContainer');

        container.lastAccessed = new Date().getTime();
        return await this.getContainer(`${this.config.containerPrefix}-${container.branch}`, true);
      } else if (container && container.status === ContainerHostStatus.INACTIVE) {
        Logger.debug(`Container found in inactive containers, starting...`, 'ContainerManager/accessContainer');

        container.lastAccessed = new Date().getTime();
        return await this.getContainer(`${this.config.containerPrefix}-${container.branch}`, true);
      } else if (dontTouchContainer(container.status)) {
        Logger.debug(
          `Container found in suspending or starting state, waiting for another state...`,
          'ContainerManager/accessContainer',
        );

        while (dontTouchContainer(container.status)) {
          await new Promise<void>((resolve) => setTimeout(resolve, 500));
        }
        return await this.accessContainer(host);
      }
    } catch (err: unknown) {
      Logger.error(err, 'ContainerManager/accessContainer');
      throw err;
    }
  }

  /**
   * Shuts down containerHost that are not busy.
   */
  async shutdownNonBusyContainers(): Promise<void> {
    const now = new Date();
    for (const containerConfig of this.containers) {
      // Skip containerHost that are currently starting up or explicitly excluded from shutting down
      if (dontTouchContainer(containerConfig.status) || containerConfig.keepActive) {
        Logger.debug(
          `Skipping container for branch ${containerConfig.branch} because of non-matching state`,
          'ContainerManager/shutdownNonBusyContainers',
        );
        continue;
      }

      try {
        if (
          (containerConfig.status === ContainerHostStatus.ACTIVE &&
            containerConfig.lastAccessed &&
            now.getTime() - containerConfig.lastAccessed > this.config.idleTimeout) ||
          (containerConfig.status === ContainerHostStatus.ACTIVE && !containerConfig.lastAccessed)
        ) {
          Logger.log(
            `Shutting down container for branch ${containerConfig.branch}`,
            'ContainerManager/shutdownNonBusyContainers',
          );
          const runningContainer: Container = await this.getContainer(
            `${this.config.containerPrefix}-${containerConfig.branch}`,
            false,
          );
          containerConfig.status = ContainerHostStatus.SUSPENDING;

          if (this.config.suspendMode === 'stop') {
            await runningContainer.stop({ t: 30 });
          } else if (this.config.suspendMode === 'pause') {
            await runningContainer.pause({ t: 10 });
          }

          containerConfig.status = ContainerHostStatus.INACTIVE;
        }
      } catch (err: unknown) {
        Logger.error(err, 'ContainerManager/shutdownNonBusyContainers');
      }
    }
  }

  /**
   * Checks the health of the container manager.
   * @returns The health status of the container manager (OK or NOT OK).
   */
  async checkHealth(): Promise<AppHealth> {
    let dockerOk: AppHealth = AppHealth.ERROR;
    try {
      await this.docker.ping();
      dockerOk = AppHealth.OK;
    } catch (err: unknown) {
      Logger.error(err, 'ContainerManager/checkHealth');
      throw err;
    }

    return dockerOk;
  }

  /**
   * Gets the status of the container manager, including the health of the application and the status of the container hosts.
   * @returns The status of the container manager.
   */
  async getStatus(): Promise<StatusReport> {
    const status = {
      appHealth: (await this.checkHealth()) === AppHealth.OK ? 'healthy' : 'unhealthy',
      containerHosts: [],
      masterImage: this.config.masterImage,
      masterTag: this.config.masterTag,
    };

    for (const container of this.containers) {
      status.containerHosts.push({
        name: container.branch,
        branch: container.branch,
        checkout: container.checkout,
        active: container.status === ContainerHostStatus.ACTIVE,
        lastAccessed: container.lastAccessed ? new Date(container.lastAccessed).toISOString() : undefined,
      });
    }

    return status;
  }

  /**
   * Deletes a container by name and frees up its resources.
   * @param name The name of the container to delete.
   */
  async deleteContainer(name: string): Promise<void> {
    Logger.log(`Deleting container for branch ${name}`, 'ContainerManager/deleteContainer');
    const container: Container = this.docker.getContainer(`${this.config.containerPrefix}-${name}`);

    if (!container) {
      throw new NotFoundException('No deployment found with that name.');
    }
    await this.kill(container);

    const containerIndex: number = this.containers.indexOf(
      this.containers.find((container) => container.branch === name),
    );
    this.containers.splice(containerIndex, 1);
    await this.saveState();

    deleteIfExists(join(this.config.configDirHost, name));
    deleteIfExists(join(this.config.dataDirHost, name));

    Logger.log(`Container for branch ${name} deleted`, 'ContainerManager/deleteContainer');
  }

  /**
   * Initializes the container manager.
   */
  private async init(): Promise<void> {
    this.config = getConfig(this.configService);

    const activeContainers: ContainerInfo[] = await this.docker.listContainers({ all: true });
    if (activeContainers) {
      const containerConfigs: PromiseSettledResult<ContainerConfig>[] = await Promise.allSettled(
        activeContainers.map(async (container) => {
          const prefix: string = container.Names[0].split('-').slice(0, -1).join('-');
          if (prefix?.includes(this.config.containerPrefix)) {
            return await this.runningContainerToConfig(this.docker.getContainer(container.Id));
          }
        }),
      );
      for (const containerConfig of containerConfigs) {
        if (containerConfig.status === 'fulfilled' && containerConfig.value !== undefined) {
          this.containers.push(containerConfig.value);
        }
      }
    }

    if (!pathExists(this.config.configDirHost)) {
      await fs.mkdir(this.config.configDirHost, { recursive: true });
      Logger.debug(`Created config directory at ${this.config.configDirHost}`, 'ContainerManager/init');
    }
    if (!pathExists(this.config.dataDirHost)) {
      await fs.mkdir(this.config.dataDirHost, { recursive: true });
      Logger.debug(`Created data directory at ${this.config.dataDirHost}`, 'ContainerManager/init');
    }

    await this.ensureMasterImage();
    if (this.config.logViewer) void this.deployLogViewer();
    await this.loadState();

    Logger.debug(this.containers, 'ContainerManager/init');
    void this.saveState();

    this.initialized = true;
  }

  /**
   * Converts a running container to a ContainerConfig object.
   * @param container The container to convert.
   * @returns The ContainerConfig object.
   */
  private async runningContainerToConfig(container: Dockerode.Container): Promise<ContainerConfig> {
    const inspect: ContainerInspectInfo = await container.inspect();
    const [image] = inspect.Config.Image.split(':');

    const branch: string = inspect.Config.Env.find((env) => env.startsWith('CI_BRANCH=')).split('=')[1];
    const checkout: string = inspect.Config.Env.find((env) => env.startsWith('CI_CHECKOUT=')).split('=')[1];
    const keepActive: string = inspect.Config.Env.find((env) => env.startsWith('CI_KEEP_ACTIVE=')).split('=')[1];
    const active: boolean = inspect.State.Running;

    return {
      status: active ? ContainerHostStatus.ACTIVE : ContainerHostStatus.INACTIVE,
      branch,
      checkout,
      containerHost: container,
      image,
      keepActive: keepActive === 'true',
    };
  }

  /**
   * Creates a container host for a branch, which will be used to run Docker in Docker.
   * @param options The options for the container host, including the branch to create it for.
   */
  private async createContainerHost(options: RunContainerDto): Promise<ContainerConfig> {
    Logger.log(`Creating container host for branch ${options.branch}`, 'ContainerManager/createContainerHost');
    let containerConfig: ContainerConfig;

    try {
      let configDirHost: string;
      let dataDirHost: string;
      if (this.config.isProd) {
        configDirHost = join(this.config.configDirHost, options.branch);
        dataDirHost = join(this.config.dataDirHost, options.branch);
      } else {
        configDirHost = join(process.cwd(), this.config.configDirHost, options.branch);
        dataDirHost = join(process.cwd(), this.config.dataDirHost, options.branch);
      }

      if (!pathExists(configDirHost)) {
        Logger.debug(`Creating config directory for branch ${options.branch}`, 'ContainerManager/createContainerHost');
        await fs.mkdir(configDirHost, { recursive: true });
      }
      if (!pathExists(dataDirHost)) {
        Logger.debug(`Creating data directory for branch ${options.branch}`, 'ContainerManager/createContainerHost');
        await fs.mkdir(dataDirHost, { recursive: true });
      }

      if (this.config.customBuildScriptLocal) {
        Logger.debug(
          `Copying build script to config directory for branch ${options.branch}`,
          'ContainerManager/createContainerHost',
        );
        const scriptContent: string = await fs.readFile(this.config.customBuildScript, 'utf-8');
        await fs.writeFile(join(configDirHost, 'build.sh'), scriptContent);
      }

      const containerHost: Container = await this.create(
        `${this.config.masterImage}:${this.config.masterTag}`,
        `${this.config.containerPrefix}-${options.branch}`,
        undefined,
        [`${configDirHost}:${this.config.configDirContainer}`, `${dataDirHost}:/var/lib/docker`],
        [
          `CI_ADD_PACKAGES=${this.config.masterImageAddPkg}`,
          `CI_BRANCH=${options.branch}`,
          `CI_BUILD_SCRIPT=${this.config.customBuildScriptLocal ? `${this.config.configDirContainer}/build.sh` : this.config.customBuildScript}`,
          `CI_CHECKOUT=${options.checkout ? options.checkout : options.branch}`,
          `CI_KEEP_ACTIVE=${options.keepActive === true}`,
          `CI_REPO_URL=${this.config.repoUrl}`,
        ],
        {
          Privileged: true,
          NetworkMode: this.config.isProd ? this.config.dockerNetworkName : undefined,
        },
      );

      Logger.log(`Starting container host for branch ${options.branch}`, 'ContainerManager/createContainerHost');
      await this.start(containerHost);
      containerConfig = {
        branch: options.branch,
        checkout: options.checkout ? options.checkout : options.branch,
        containerHost: containerHost,
        keepActive: options.keepActive === true,
        lastAccessed: new Date().getTime(),
        status: ContainerHostStatus.BUILDING,
      };
      this.containers.push(containerConfig);

      // Wait for the container to start up, it'll die if anything doesn't add up
      Logger.debug(`Waiting for container to start up...`, 'ContainerManager/createContainerHost');
      await this.waitForContainerUp(containerHost);
      this.containers.find((containerConfig) => containerConfig.branch === options.branch).status =
        ContainerHostStatus.ACTIVE;

      Logger.log(
        `Container host for branch ${options.branch} created successfully`,
        'ContainerManager/createContainerHost',
      );
      return containerConfig;
    } catch (err: unknown) {
      Logger.error(err, 'ContainerManager/createContainerHost');
      throw err;
    }
  }

  /**
   * Saves the state of the container manager to a file.
   */
  private async saveState(): Promise<void> {
    try {
      const toSave: SaveFile = {
        containers: this.containers,
      };
      await fs.writeFile(this.getConfigPath(), JSON.stringify(toSave));
      Logger.debug('Saved state', 'ContainerManager/saveState');
    } catch (err: unknown) {
      Logger.error(err, 'ContainerManager/saveState');
      throw err;
    }
  }

  /**
   * Loads the state of the container manager from a file, while optionally syncing the state with the file if a container is missing.
   */
  private async loadState(): Promise<void> {
    if (!pathExists(this.getConfigPath())) {
      Logger.warn('No state file found, starting fresh...', 'ContainerManager/loadState');
      return;
    }
    const deploymentPromises: Promise<ContainerConfig>[] = [];

    try {
      const state: string = await fs.readFile(this.getConfigPath(), 'utf-8');
      const parsed: SaveFile = JSON.parse(state.toString());

      for (const config of parsed.containers) {
        const runningContainer: ContainerConfig = this.containers.find(
          (container) => config.branch === container.branch,
        );
        if (!runningContainer) {
          Logger.log(
            `Did not find container ${config.branch} in running containers, sync state with state.json...`,
            'ContainerManager/loadState',
          );
          const containerConfig: RunContainerDto = {
            branch: config.branch,
            checkout: config.checkout,
            keepActive: config.keepActive,
            authToken: undefined,
            authUser: undefined,
          };
          deploymentPromises.push(this.createContainerHost(containerConfig));
        } else {
          Logger.log(`Found container ${config.branch} in running containers...`, 'ContainerManager/loadState');
        }
      }
    } catch (err: unknown) {
      Logger.error(`Got an error while restoring state: ${err}`, 'ContainerManager/loadState');
    }
  }

  /**
   * Pulls an image from the Docker registry if it's not already present.
   * Additionally, it waits for the image to be pulled before continuing,
   * preventing multiple pulls of the same image.
   * @param imageName The name of the image to pull.
   * @param locked Whether the image is currently locked / or a pull is already active.
   * @private
   */
  private async pullImage(imageName: string, locked = false): Promise<void> {
    while (!locked) {
      setTimeout(() => console.log('Waiting for unlock...'), 1000);
    }

    try {
      await new Promise<void>((resolve, reject) => {
        this.docker.pull(imageName, (err: any, stream: NodeJS.ReadableStream) => {
          if (err) {
            return reject(err);
          }
          this.docker.modem.followProgress(stream, (err: any) => {
            if (err) {
              return reject(err);
            }
            resolve();
          });
        });
      });
    } catch (err: unknown) {
      Logger.error(`Failed to download builder image: ${err}`, 'ContainerManager/pullImage');
      throw err;
    } finally {
      if (!locked) this.pullActive = false;
    }
  }

  /**
   * Gets an image by name.
   * @param imageName The name of the image to get.
   * @returns The image name.
   */
  private async getImage(imageName: string): Promise<string> {
    if (this.pullActive) {
      Logger.log('Waiting for container pull to finish...');
    }
    this.pullActive = true;

    try {
      try {
        const image: Image = this.docker.getImage(imageName);
        await image.inspect();
      } catch {
        await this.pullImage(imageName, true);
      }
    } finally {
      this.pullActive = false;
    }

    return imageName;
  }

  /**
   * Kills a container and removes it.
   * @param container The container to kill.
   */
  private async kill(container: Dockerode.Container): Promise<void> {
    try {
      await this.docker.getContainer(container.id).remove({ force: true });
    } catch (err: unknown) {
      Logger.error(err, 'ContainerManager/kill');
    }
  }

  /**
   * Creates a new container.
   * @param imageName The name of the image to create the container from.
   * @param name The name of the container.
   * @param args The arguments to pass to the container.
   * @param binds The binds to apply to the container.
   * @param env The environment variables to set in the container.
   * @param HostConfig The host configuration for the container.
   */
  private async create(
    imageName: string,
    name: string,
    args: string[],
    binds: string[] = [],
    env: string[] = [],
    HostConfig?: Dockerode.HostConfig,
  ): Promise<Container> {
    const image: string = await this.getImage(imageName);
    return await this.docker.createContainer({
      Image: image,
      Cmd: args,
      HostConfig: Object.assign(
        {
          AutoRemove: false,
          Binds: binds,
          LogConfig: {
            Type: 'local',
            Config: {
              'max-size': '10m',
              'max-file': '5',
            },
          },
        },
        HostConfig ? HostConfig : {},
      ),
      name: name,
      Env: env,
      AttachStderr: true,
      AttachStdout: true,
      OpenStdin: false,
      Tty: true,
      StdinOnce: false,
      AttachStdin: false,
    });
  }

  /**
   * Starts a container, optionally attaching to its output.
   * @param container The container to start.
   * @param logFunc The function to log the container output to.
   * @param attach Whether to attach to the container output.
   */
  private async start(
    container: Dockerode.Container,
    logFunc: (arg: string) => void = Logger.log,
    attach = false,
  ): Promise<Container> {
    const stream = new Stream.Writable();
    stream._write = (chunk, encoding, next) => {
      logFunc(chunk.toString());
      next();
    };

    if (attach) {
      const attached: NodeJS.ReadWriteStream = await container.attach({
        stream: true,
        stdout: true,
        stderr: true,
      });
      attached.setEncoding('utf8');
      attached.pipe(stream, {
        end: true,
      });
    }

    await container.start();
    return container;
  }

  /**
   * Pulls the primary container image, which is used to run Docker in Docker.
   */
  private async ensureMasterImage(): Promise<void> {
    Logger.log('Ensuring master image is available...', 'ContainerManager/ensureMasterImage');
    const masterImage: ImageInfo = (await this.docker.listImages({ all: true })).find((image: any) =>
      image.RepoTags.includes(`${this.config.masterImage}:${this.config.masterTag}`),
    );

    try {
      if (!masterImage) {
        Logger.log('Master image not found, pulling a fresh one...', 'ContainerManager/ensureMasterImage');
        await this.getImage(`${this.config.masterImage}:${this.config.masterTag}`);
        Logger.log('Master image pulled', 'ContainerManager/ensureMasterImage');
      } else {
        Logger.log('Master image found, checking timestamp...', 'ContainerManager/ensureMasterImage');
        const info: ImageInspectInfo = await this.docker.getImage(masterImage.Id).inspect();

        if (
          info.Config.Labels['org.opencontainers.image.created'] &&
          new Date().getTime() - new Date(info.Config.Labels['org.opencontainers.image.created']).getTime() > ONE_WEEK
        ) {
          Logger.log('Master image is outdated, updating...', 'ContainerManager/ensureMasterImage');
          await this.getImage(`${this.config.masterImage}:${this.config.masterTag}`);
        } else {
          Logger.log('Master image is up to date, no need to do anything', 'ContainerManager/ensureMasterImage');
        }
      }
    } catch (err: unknown) {
      Logger.error(err, 'ContainerManager/ensureMasterImage');
      throw err;
    }
  }

  /**
   * Builds a docker image.
   * @param imageName The name of the image to build.
   * @param src The path to the Dockerfile-dind and other required files.
   * @param dockerfile The name of the Dockerfile-dind to use.
   * @param context The context to build the image in.
   * @returns An empty promise that resolves when the image is built.
   */
  private async buildImage(imageName: string, src: string[], context: string, dockerfile?: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const logStream: NodeJS.ReadableStream = await this.docker.buildImage(
        { context: context, src: src },
        {
          t: imageName,
          dockerfile: dockerfile ?? 'Dockerfile-dind',
          labels: {
            timestamp: new Date().getTime().toString(),
          },
        },
      );
      logStream
        .on('data', (chunk) => {
          Logger.log(chunk.toString().trim(), 'ContainerManager/ensureMasterImage');
        })
        .on('end', () => {
          Logger.log('Master image built', 'ContainerManager/ensureMasterImage');
          resolve();
        })
        .on('error', (err) => {
          Logger.error(err, 'ContainerManager/ensureMasterImage');
          reject(err);
        });
    });
  }

  /**
   * Gets a container by name.
   * @param containerName The name of the container to get.
   * @param start Whether to start the container if it's not running.
   * @returns The container object
   */
  private async getContainer(containerName: string, start = false): Promise<Container> {
    const allContainers: ContainerInfo[] = await this.docker.listContainers({ all: true });
    const container: ContainerInfo = allContainers.find((container) => container.Names.includes(`/${containerName}`));
    const containerConfig: ContainerConfig = this.containers.find(
      (container) => `${this.config.containerPrefix}-${container.branch}` === containerName,
    );

    if (container && container.State === 'running') {
      Logger.debug(`Running container ${containerName} found, returning...`, 'ContainerManager/getContainer');
      return this.docker.getContainer(container.Id);
    } else if (container && start) {
      Logger.debug(`Suspended container ${containerName} found, resuming...`, 'ContainerManager/getContainer');
      const inactiveContainer: Container = this.docker.getContainer(container.Id);
      containerConfig.status = ContainerHostStatus.STARTING;

      if (this.config.suspendMode === 'stop') {
        await inactiveContainer.start();
      } else if (this.config.suspendMode === 'pause') {
        await inactiveContainer.unpause();
      }

      await this.waitForContainerUp(inactiveContainer);
      containerConfig.status = ContainerHostStatus.ACTIVE;

      return inactiveContainer;
    } else if (container) {
      Logger.debug(`Suspended container ${containerName} found, returning...`, 'ContainerManager/getContainer');
      return this.docker.getContainer(container.Id);
    }

    Logger.debug(`No container found for ${containerName}, returning undefined...`, 'ContainerManager/getContainer');
    return undefined;
  }

  /**
   * Initializes process handling for the container manager.
   */
  private initProcessHandling(): void {
    process.on('SIGINT', async () => {
      Logger.log('Shutting down...', 'ContainerManager');
      await this.saveState();
      await this.shutdown();
      process.exit(0);
    });
    process.on('SIGTERM', async () => {
      Logger.log('Shutting down...', 'ContainerManager');
      await this.saveState();
      await this.shutdown();
      process.exit(0);
    });
  }

  /**
   * Suspends all containers on shutdown
   */
  private async shutdown(): Promise<void> {
    const shutdownPromises: Promise<void>[] = [];

    shutdownPromises.push(
      ...this.containers.map(async (container) => {
        if (container.status === ContainerHostStatus.ACTIVE) {
          Logger.log(`Suspending container for branch ${container.branch}`, 'ContainerManager/shutdown');

          container.status = ContainerHostStatus.SUSPENDING;
          await container.containerHost.stop({ t: 30 });
          container.status = ContainerHostStatus.INACTIVE;
        }
      }),
    );

    if (this.config.logViewer) shutdownPromises.push(this.destroyLogViewer());

    await Promise.allSettled(shutdownPromises);
    Logger.log('All containers suspended', 'ContainerManager/shutdown');
  }

  /**
   * Waits for a container to be up (HTTP 200 on port 80).
   * Throws an error if it fails after five attempts.
   * Especially useful for stopped containerHost that takes a while to start up.
   * @param container The container to wait for.
   * @param attempt The attempt number.
   * @returns An empty promise that resolves when the container is up.
   */
  private async waitForContainerUp(container: Container, attempt = 1): Promise<void> {
    const stats: ContainerInspectInfo = await container.inspect();
    let targetIp: string;
    let retry = false;

    if (this.config.isProd) {
      targetIp = stats.NetworkSettings.Networks[this.config.dockerNetworkName].IPAddress;
      let connectionRefused = false;
      let outcome: AxiosResponse<string>;

      try {
        // noinspection HttpUrlsUsage - internal only, so it's fine in this case
        outcome = await lastValueFrom(this.httpService.get(`http://${targetIp}`));

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (err: unknown) {
        connectionRefused = true;
      }
      if (connectionRefused || outcome?.status !== 200) {
        retry = true;
      }
    } else {
      retry = stats.State.Health.Status === 'starting';
    }

    if (retry && attempt > 50) {
      throw new Error(`Failed to connect to container after ${(1000 * 50) / 1000} seconds, it likely died`);
    }

    if (retry) {
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));
      await this.waitForContainerUp(container, attempt + 1);
    } else {
      const containerName: string = (await container.inspect()).Name.slice(1);
      Logger.log(`Container ${containerName} is up`, 'ContainerManager/waitForContainerUp');
    }
  }

  /**
   * Gets the path to the config file.
   * @returns The path to the config file.
   * @private
   */
  private getConfigPath(): string {
    let configPath: string;
    if (this.config.isProd) {
      configPath = join(this.config.configDirHost, 'state.json');
    } else {
      configPath = join(process.cwd(), this.config.configDirHost, 'state.json');
    }

    return configPath;
  }

  /**
   * Deploys the Dozzle log viewer container.
   * This is a separate container from another developer that allows users to view logs from other containers.
   * For more information, see https://dozzle.dev.
   * @private
   */
  private async deployLogViewer(): Promise<void> {
    Logger.log('Deploying log viewer...', 'ContainerManager/deployLogViewer');

    try {
      const image = `${this.config.logViewerImage}:${this.config.logViewerTag}`;
      await this.getImage(image);

      const logViewer: ContainerInfo = (await this.docker.listContainers({ all: true })).find((container) =>
        container.Names.includes(`/${this.config.logViewerContainerName}`),
      );
      if (logViewer) {
        Logger.log('Log viewer already exists, destroying...', 'ContainerManager/deployLogViewer');
        await this.kill(this.docker.getContainer(logViewer.Id));
      }

      // This limits Dozzle to only show logs from containers which are managed by this application / or the application itself.
      const viewFilter = `name=(${this.config.containerPrefix}-*|${this.config.logViewerContainerName}|container-manager)`;

      const container: Container = await this.create(
        image,
        this.config.logViewerContainerName,
        undefined,
        ['/var/run/docker.sock:/var/run/docker.sock:ro'],
        [`DOZZLE_FILTER=${viewFilter}`, 'DOZZLE_NO_ANALYTICS=1'],
        {
          LogConfig: {
            Type: 'local',
            Config: {
              'max-size': '10m',
              'max-file': '5',
            },
          },
          PortBindings: {
            '8080/tcp': [{ HostPort: this.config.logViewerPort.toString() }],
          },
        },
      );
      await this.start(container);
    } catch (err: unknown) {
      Logger.error(err, 'ContainerManager/deployLogViewer');
    }
  }

  /**
   * Destroys the log viewer container.
   * @private
   */
  private async destroyLogViewer(): Promise<void> {
    Logger.log('Destroying log viewer...', 'ContainerManager/destroyLogViewer');

    try {
      const allContainers: ContainerInfo[] = await this.docker.listContainers({ all: true });
      const logViewer: ContainerInfo = allContainers.find((container) =>
        container.Names.includes(`/${this.config.logViewerContainerName}`),
      );
      await this.kill(this.docker.getContainer(logViewer.Id));
    } catch (err: unknown) {
      Logger.error(err, 'ContainerManager/destroyLogViewer');
    }
  }
}
