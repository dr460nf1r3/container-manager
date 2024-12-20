import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ContainerManager } from './container-manager';
import { Container, ContainerInspectInfo } from 'dockerode';
import { ConfigService } from '@nestjs/config';
import { AppHealth } from './constants';
import { RunContainerDto } from './validation';
import { ContainerConfig, StatusReport } from './interfaces';
import { HttpService } from '@nestjs/axios';

@Injectable()
export class AppService {
  manager: ContainerManager;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.manager = new ContainerManager(this.configService, this.httpService);
  }

  /**
   * Creates a new container host for the specified branch and commit.
   * @param options The branch and commit to deploy.
   */
  async newDeployment(options: RunContainerDto): Promise<ContainerConfig> {
    Logger.log(
      `Running container with branch: ${options.branch}${options.checkout ? ` and checkout option: ${options.checkout}` : ''}`,
      'AppService/newDeployment',
    );
    return await this.manager.newDeployment(options);
  }

  /**
   * Redirects the request to the proxy. Specifically, it finds the container hosting the requested service,
   * and returns the IP address of the container.
   * @param host The host of the request.
   * @returns The IP address of the container hosting the requested service.
   */
  async proxyRequest(host: string): Promise<string> {
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

  /**
   * Check the health of the application.
   * @returns The health of the application.
   */
  async checkHealth(): Promise<AppHealth> {
    return await this.manager.checkHealth();
  }

  /**
   * Get the status of the application, including the health of the application and the status of the container hosts.
   * @returns The status of the application.
   */
  async getStatus(): Promise<StatusReport> {
    return await this.manager.getStatus();
  }

  /**
   * Remove a container host and its associated resources.
   * @param branch The branch of the container host to remove.
   */
  async deleteContainer(branch: string): Promise<void> {
    return await this.manager.deleteContainer(branch);
  }
}
