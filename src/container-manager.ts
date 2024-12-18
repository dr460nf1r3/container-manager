import * as Docker from 'dockerode';
import Dockerode, {
    Container,
    ContainerInfo,
    ContainerInspectInfo,
    Image,
    ImageInfo,
    ImageInspectInfo,
} from 'dockerode';
import { AppConfig, ContainerConfig, SaveFile, StatusReport } from './interfaces';
import * as Stream from 'node:stream';
import { Logger, NotFoundException } from '@nestjs/common';
import { AppHealth, ONE_MINUTE, ONE_WEEK } from './constants';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { getConfig } from './config';
import { RunContainerDto } from './validation';
import { pathExists } from './functions';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';

export class ContainerManager {
    containers: ContainerConfig[] = [];
    config: AppConfig;
    pullActive: boolean = false;
    docker: Docker;
    initialized: boolean = false;

    constructor(private configService: ConfigService, private httpService: HttpService) {
        const socket: string = this.configService.getOrThrow<string>('DOCKER_SOCKET');
        this.docker = new Docker({ socketPath: socket });

        void this.init();
        this.initProcessHandling();
    }

    /**
     * Initializes the container manager.
     */
    private async init(): Promise<void> {
        const activeContainers: ContainerInfo[] = await this.docker.listContainers({
            all: true,
        });
        await this.loadState();

        if (activeContainers) {
            const containerConfigs: PromiseSettledResult<ContainerConfig>[] = await Promise.allSettled(
                activeContainers.map(async (container) => {
                    if (container.State === 'running') {
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

        this.config = getConfig(this.configService);

        await this.ensureMasterImage();
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
        const [image, tag] = inspect.Config.Image.split(':');

        let branch: string;
        let checkout: string;
        if (inspect.Name.includes(`${this.config.containerPrefix}`)) {
            branch = inspect.Config.Env.find((env) => env.startsWith('CI_BRANCH=')).split('=')[1];
            checkout = inspect.Config.Env.find((env) => env.startsWith('CI_CHECKOUT=')).split('=')[1];
        }
        const active: boolean = inspect.State.Running;
        return {
            active,
            branch,
            checkout,
            containers: [container],
            image,
        };
    }

    /**
     * Deploys a new container for a branch.
     * @param options The options for the deployment, including the branch to deploy.
     */
    async newDeployment(options: RunContainerDto): Promise<void> {
        const containerInConfig: ContainerConfig = this.containers.find((container) => container.branch.includes(options.branch));
        const containerIsRunning: ContainerInfo = (await this.docker.listContainers({ all: true })).find((container) => container.Names.includes(`/${this.config.containerPrefix}-${options.branch}`));

        if (containerIsRunning && containerInConfig) {
            Logger.log(`Container host for branch ${options.branch} already exists in config...`, 'ContainerManager/newDeployment');
            const container: ContainerInfo = (await this.docker.listContainers({ all: true })).find((container) =>
                container.Names.includes(`/${this.config.containerPrefix}-${options.branch}`),
            );
            await this.kill(this.docker.getContainer(container.Id));

            const containerIndex: number = this.containers.indexOf(this.containers.find((container) => container.branch === options.branch));
            this.containers.splice(containerIndex, 1);

            await this.createContainerHost(options);
        } else if (!containerInConfig && !containerIsRunning) {
            Logger.log(`Container host for branch ${options.branch} doesn't exist in config, creating a new one...`, 'ContainerManager/newDeployment');
            await this.createContainerHost(options);
        } else if (!containerInConfig && containerIsRunning) {
            Logger.log(`Container host for branch ${options.branch} does not exist in config but is already running, recreating...`, 'ContainerManager/newDeployment');
            await this.kill(this.docker.getContainer(containerIsRunning.Id));
            await this.createContainerHost(options);
        }

        await this.saveState();
    }

    /**
     * Creates a container host for a branch, which will be used to run Docker in Docker.
     * @param options The options for the container host, including the branch to create it for.
     */
    private async createContainerHost(options: { branch: string, checkout: string }): Promise<void> {
        Logger.log(`Creating container host for branch ${options.branch}`, 'ContainerManager/createContainerHost');

        try {
            const configDirHost: string = join(process.cwd(), this.config.configDirHost, options.branch);

            if (!pathExists(configDirHost)) {
                Logger.debug(`Creating config directory for branch ${options.branch}`, 'ContainerManager/createContainerHost');
                await fs.mkdir(configDirHost, { recursive: true });
            }

            if (this.config.customBuildScriptLocal) {
                Logger.debug(`Copying build script to config directory for branch ${options.branch}`, 'ContainerManager/createContainerHost');
                const scriptContent: string = await fs.readFile(this.config.customBuildScript, 'utf-8');
                await fs.writeFile(join(configDirHost, 'build.sh'), scriptContent);
            }

            const masterContainer: Container = await this.create(
                `${this.config.masterImage}:${this.config.masterTag}`,
                `${this.config.containerPrefix}-${options.branch}`,
                undefined,
                [
                    `${configDirHost}:${this.config.configDirContainer}`,
                ],
                [
                    `CI_BRANCH=${options.branch}`,
                    `CI_BUILD_SCRIPT=${this.config.customBuildScriptLocal ? '/config/build.sh' : this.config.customBuildScript}`,
                    `CI_CHECKOUT=${options.checkout ? options.checkout : options.branch}`,
                    `CI_REPO_URL=${this.config.repoUrl}`,
                    `CI_ADD_PACKAGES=${this.config.masterImageAddPkg}`,
                ],
                { Privileged: true },
            );

            Logger.log(`Starting container host for branch ${options.branch}`, 'ContainerManager/createContainerHost');
            await this.start(masterContainer);

            // Wait for the container to start up, it'll die if anything doesn't add up
            Logger.debug(`Waiting for container to start up...`, 'ContainerManager/createContainerHost');
            await new Promise<void>((resolve) => setTimeout(resolve, 2000));

            this.containers.push({
                branch: options.branch,
                checkout: options.checkout ? options.checkout : options.branch,
                active: true,
                containers: [masterContainer],
            });
            Logger.log(`Container host for branch ${options.branch} created successfully`, 'ContainerManager/createContainerHost');
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
            await fs.writeFile('state.json', JSON.stringify(toSave));
        } catch (err: unknown) {
            Logger.error(err, 'ContainerManager/saveState');
            throw err;
        }
    }

    /**
     * Loads the state of the container manager from a file.
     */
    private async loadState(): Promise<void> {
        try {
            const state: string = await fs.readFile('state.json', 'utf-8');
            const parsed: SaveFile = JSON.parse(state.toString());
            this.containers = parsed.containers;
        } catch (err: unknown) {
            Logger.warn('No state file found, starting fresh...', 'ContainerManager/loadState');
        }
    }

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
            throw err;
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
     * @param tag The tag to apply to the image.
     * @returns An empty promise that resolves when the image is built.
     */
    private async buildImage(
        imageName: string,
        src: string[],
        context: string,
        tag?: string,
        dockerfile?: string,
    ): Promise<void> {
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
     * Accesses a container via a subdomain. To be called from the proxy.
     * @param host The host to access the container for.
     * @returns The container to access.
     */
    async accessContainer(host: string): Promise<Container> {
        const containerName: string = host.split('.')[0];
        Logger.debug(`Accessing container via subdomain ${containerName}`, 'ContainerManager/accessContainer');

        try {
            const container: ContainerConfig = this.containers.find((container) => container.branch === containerName);
            if (container && container.active) {
                Logger.debug(`Container found among active containers...`, 'ContainerManager/accessContainer');
                container.lastAccessed = new Date().getTime();
                return await this.getContainer(`${this.config.containerPrefix}-${container.branch}`);
            }

            Logger.debug(`Container not found for ${containerName}, searching inactive ones...`, 'ContainerManager/accessContainer');
            if (container && !container.active) {
                Logger.debug(`Container found in inactive containers, starting...`, 'ContainerManager/accessContainer');
                return await this.getContainer(`${this.config.containerPrefix}-${container.branch}`);
            }
        } catch (err: unknown) {
            Logger.error(err, 'ContainerManager/accessContainer');
            throw err;
        }

        Logger.warn(`Container not found in inactive containers, can't serve request`, 'ContainerManager/accessContainer');
        throw new NotFoundException();
    }

    /**
     * Shuts down containers that are not busy.
     */
    async shutdownNonBusyContainers(): Promise<void> {
        const now = new Date();
        for (const containerConfig of this.containers) {
            try {
                if (
                    (containerConfig.active &&
                        containerConfig.lastAccessed &&
                        now.getTime() - containerConfig.lastAccessed > ONE_MINUTE) || !containerConfig.lastAccessed

                ) {
                    Logger.log(
                        `Shutting down container for branch ${containerConfig.branch}`,
                        'ContainerManager/shutdownNonBusyContainers',
                    );
                    const runningContainer: Container = await this.getContainer(
                        `${this.config.containerPrefix}-${containerConfig.branch}`,
                    );

                    if (this.config.suspendMode === 'stop') {
                        await runningContainer.stop({ t: 30 });
                    } else if (this.config.suspendMode === 'pause') {
                        await runningContainer.pause({ t: 10 });
                    }
                    containerConfig.active = false;
                }
            } catch (err: unknown) {
                Logger.error(err, 'ContainerManager/shutdownNonBusyContainers');
            }
        }
    }

    /**
     * Gets a container by name.
     * @param containerName The name of the container to get.
     * @param active Whether to get an active container.
     * @returns The container object
     */
    private async getContainer(containerName: string): Promise<Container> {
        const allContainers: ContainerInfo[] = await this.docker.listContainers({
            all: true,
        });
        const container: ContainerInfo = allContainers.find((container) =>
            container.Names.includes(`/${containerName}`),
        );

        if (container && container.State === 'running') {
            Logger.debug(`Running container ${containerName} found, returning...`, 'ContainerManager/getContainer');
            return this.docker.getContainer(container.Id);
        } else if (container) {
            Logger.debug(`Suspended container ${containerName} found, resuming...`, 'ContainerManager/getContainer');
            const inactiveContainer: Container = this.docker.getContainer(container.Id);

            if (this.config.suspendMode === 'stop') {
                await inactiveContainer.start();
            } else if (this.config.suspendMode === 'pause') {
                await inactiveContainer.unpause();
            }

            await this.waitForContainerUp(inactiveContainer);
            return inactiveContainer;
        }

        Logger.debug(
            `No container found for ${containerName}, returning undefined...`,
            'ContainerManager/getContainer',
        );
        return undefined;
    }

    /**
     * Initializes process handling for the container manager.
     */
    private initProcessHandling(): void {
        process.on('SIGINT', async () => {
            Logger.log('Shutting down...', 'ContainerManager');
            await this.saveState();
            process.exit(0);
        });
        process.on('SIGTERM', async () => {
            Logger.log('Shutting down...', 'ContainerManager');
            await this.saveState();
            process.exit(0);
        });
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
                active: container.active,
                lastAccessed: container.lastAccessed ? new Date(container.lastAccessed).toISOString() : undefined,
            });
        }

        return status;
    }

    /**
     * Waits for a container to be up (HTTP 200 on port 80).
     * Throws an error if it fails after five attempts.
     * Especially useful for stopped containers that take a while to start up.
     * @param container The container to wait for.
     * @param attempt The attempt number.
     * @returns An empty promise that resolves when the container is up.
     */
    async waitForContainerUp(container: Container, attempt = 1): Promise<void> {
        const stats: ContainerInspectInfo = await container.inspect();
        const targetIp: string = stats.NetworkSettings.IPAddress;

        // noinspection HttpUrlsUsage - internal only, so it's fine in this case
        const outcome: AxiosResponse<string> = await lastValueFrom(this.httpService.get(`http://${targetIp}`));
        if (outcome.status ! == 200) {
            if (attempt > 50) {
                throw new Error(`Failed to connect to container after ${100 * 50 / 1000} seconds, it likely died: ${outcome.statusText}`);
            }
            await new Promise<void>((resolve) => setTimeout(resolve, 100));
            await this.waitForContainerUp(container, attempt++);
        } else {
            Logger.log(`Container ${container.id} is up`, 'ContainerManager/waitForContainerUp');
        }
    }
}
