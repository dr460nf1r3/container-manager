import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ContainerManager } from './container-manager';
import { Container, ContainerInspectInfo } from 'dockerode';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
    manager: ContainerManager;

    constructor(private configService: ConfigService) {
        this.manager = new ContainerManager(this.configService);
    }

    /**
     * Creates a new container host for the specified branch and commit.
     * @param options The branch and commit to deploy.
     */
    async newDeployment(options: { commit: string; branch: string }): Promise<void> {
        Logger.log(
            `Running container with branch: ${options.branch} and commit: ${options.commit}`,
            'AppService/newDeployment',
        );
        await this.manager.newDeployment(options);
    }

    /**
     * Redirects the request to the proxy. Specifically, it finds the container hosting the requested service,
     * and returns the IP address of the container.
     * @param host The host of the request.
     * @returns The IP address of the container hosting the requested service.
     */
    async proxyRequest(host: string): Promise<string> {
        Logger.log('Redirecting to proxy...', 'AppController');
        const container: Container = await this.manager.accessContainer(host);

        if (!container) {
            throw new NotFoundException();
        }
        const stats: ContainerInspectInfo = await container.inspect();
        return stats.NetworkSettings.IPAddress;
    }

    /**
     * Shutdown containers that are not busy.
     */
    async shutdownNonBusyContainers(): Promise<void> {
        await this.manager.shutdownNonBusyContainers();
    }
}
