import * as Docker from 'dockerode';
import Dockerode, {
    Container,
    ContainerInfo,
    ContainerInspectInfo,
    Image,
    ImageInfo,
    ImageInspectInfo,
} from 'dockerode';
import { AppConfig, ContainerConfig, SaveFile } from './interfaces';
import * as Stream from 'node:stream';
import { Logger, NotFoundException } from '@nestjs/common';
import { ONE_MINUTE, ONE_WEEK } from './constants';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { getConfig } from './config';

export class ContainerManager {
    containers: ContainerConfig[] = [];
    config: AppConfig;
    pullActive: boolean = false;
    docker: Docker;
    initialized: boolean = false;

    constructor(private configService: ConfigService) {
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
        let commit: string;
        if (inspect.Name.includes(`${this.config.containerPrefix}`)) {
            branch = inspect.Config.Env.find((env) => env.startsWith('CI_BRANCH=')).split('=')[1];
            commit = inspect.Config.Env.find((env) => env.startsWith('CI_COMMIT=')).split('=')[1];
        }
        const active: boolean = inspect.State.Running;
        return {
            tag,
            branch,
            image,
            commit,
            active,
            containers: [container],
        };
    }

    /**
     * Deploys a new container for a branch.
     * @param options The options for the deployment, including the branch to deploy.
     */
    async newDeployment(options: { branch: string; tag?: string; images?: string[]; commit?: string }): Promise<void> {
        if (this.containers.find((container) => container.branch.includes(options.branch))) {
            Logger.log(
                `Container host for branch ${options.branch} already exists, removing...`,
                'ContainerManager/deployMaster',
            );
            const container: ContainerInfo = (await this.docker.listContainers({ all: true })).find((container) =>
                container.Names.includes(`/${this.config.containerPrefix}-${options.branch}`),
            );

            if (container?.Id) {
                await this.kill(this.docker.getContainer(container.Id));
            }
            const containerIndex: number = this.containers.indexOf(
                this.containers.find((container) => container.tag === options.tag),
            );
            this.containers.slice(containerIndex, 1);
        } else {
            await this.createContainerHost({ branch: options.branch });
        }
    }

    /**
     * Creates a container host for a branch, which will be used to run Docker in Docker.
     * @param options The options for the container host, including the branch to create it for.
     */
    private async createContainerHost(options: { branch: string }): Promise<void> {
        Logger.log(`Creating container host for branch ${options.branch}`, 'ContainerManager/createContainerHost');

        try {
            const configDirHost: string = join(process.cwd(), this.config.configDirHost);
            const masterContainer: Container = await this.create(
                this.config.masterImage,
                `${this.config.containerPrefix}-${options.branch}`,
                undefined,
                [`${configDirHost}:${this.config.configDirContainer}`],
                [`CI_COMMIT=${options.branch}`, `CI_BRANCH=${options.branch}`],
                { Privileged: true },
            );

            void this.start(masterContainer);
            this.containers.push({
                tag: options.branch,
                branch: options.branch,
                commit: options.branch,
                active: true,
                containers: [masterContainer],
            });
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
                    AutoRemove: true,
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
     * Deploys the primary image, which is used to run Docker in Docker.
     */
    private async ensureMasterImage(): Promise<void> {
        Logger.log('Ensuring master image is built...', 'ContainerManager/ensureMasterImage');
        const masterImage: ImageInfo = (await this.docker.listImages({ all: true })).find((image: any) =>
            image.RepoTags.includes(`${this.config.masterImage}:${this.config.masterTag}`),
        );

        try {
            if (!masterImage) {
                Logger.log('Master image not found, building a fresh one...', 'ContainerManager/ensureMasterImage');
                await this.buildImage(
                    this.config.masterImage,
                    ['Dockerfile-dind', 'compose.yaml', 'entry_point.sh'],
                    '.',
                    'latest',
                );
            } else {
                Logger.log('Master image found, checking timestamp...', 'ContainerManager/ensureMasterImage');
                const info: ImageInspectInfo = await this.docker.getImage(masterImage.Id).inspect();

                if (
                    info.Config.Labels?.timestamp &&
                    new Date().getTime() - parseInt(info.Config.Labels.timestamp) > ONE_WEEK
                ) {
                    Logger.log('Master image is outdated, rebuilding...', 'ContainerManager/ensureMasterImage');
                    await this.buildImage(
                        this.config.masterImage,
                        ['Dockerfile-dind', 'compose.yaml', 'entry_point.sh'],
                        '.',
                        'latest',
                    );
                } else {
                    Logger.log('Master image is up to date, no need to rebuild', 'ContainerManager/ensureMasterImage');
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

        const container: ContainerConfig = this.containers.find((container) => container.branch === containerName);
        if (container && container.active) {
            Logger.debug(`Container found among active containers...`, 'ContainerManager/accessContainer');
            container.lastAccessed = new Date().getTime();
            return await this.getContainer(`${this.config.containerPrefix}-${container.branch}`);
        }

        Logger.debug(
            `Container not found for ${containerName}, searching inactive ones...`,
            'ContainerManager/accessContainer',
        );
        if (container && !container.active) {
            Logger.debug(`Container found in inactive containers, starting...`, 'ContainerManager/accessContainer');
            return await this.getContainer(`${this.config.containerPrefix}-${container.branch}`);
        }

        Logger.warn(
            `Container not found in inactive containers, can't serve request`,
            'ContainerManager/accessContainer',
        );
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
                    !containerConfig.active &&
                    containerConfig.lastAccessed &&
                    now.getTime() - containerConfig.lastAccessed > ONE_MINUTE
                ) {
                    Logger.log(
                        `Shutting down container for branch ${containerConfig.branch}`,
                        'ContainerManager/shutdownNonBusyContainers',
                    );
                    const runningContainer: Container = await this.getContainer(
                        `${this.config.containerPrefix}-${containerConfig.branch}`,
                    );
                    await runningContainer.pause({ t: 10 });
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
            Logger.debug(`Paused container ${containerName} found, unpausing...`, 'ContainerManager/getContainer');
            const inactiveContainer: Container = this.docker.getContainer(container.Id);
            await inactiveContainer.unpause();
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
}
