import {
  All,
  Body,
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  Logger,
  MethodNotAllowedException,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { AppService } from './app.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AppHealth } from './constants';
import { DeleteDeploymentDto, RunContainerDto } from './validation';
import { FastifyReply, FastifyRequest } from 'fastify';
import { ContainerConfig, StatusReport } from './interfaces';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiHeaders,
  ApiInternalServerErrorResponse,
  ApiMethodNotAllowedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiResponse,
} from '@nestjs/swagger';
import { checkWhetherWeShouldAdmin } from './middleware';
import { sanitizeContainerName } from './functions';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async shutdownNonBusyContainers(): Promise<void> {
    await this.appService.shutdownNonBusyContainers();
  }

  @ApiBadRequestResponse({ description: 'The given parameters were not what we expect.' })
  @ApiCreatedResponse({ description: 'The deployment has been created successfully.' })
  @ApiResponse({ status: 500, description: 'An error occurred while creating the deployment.' })
  @ApiHeaders([
    {
      name: 'X-Admin-Request',
      required: true,
      description:
        'Set to true to indicate that this is an admin request. Otherwise will redirect to the catch-all route.',
      example: { 'X-Admin-Request': 'true' },
    },
  ])
  @ApiHeaders([
    {
      name: 'X-Admin-Token',
      required: false,
      description: 'The token to authenticate the admin request. Not required if authentication is turned off.',
      example: { 'X-Admin-Token': 'example-token' },
    },
  ])
  @Get('container')
  async runContainerGet(
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
    @Query() query: RunContainerDto,
  ): Promise<void> {
    if (!checkWhetherWeShouldAdmin(req)) {
      await this.redirectToProxy(req, res);
      return;
    }
    const deployment: ContainerConfig = await this.appService.newDeployment(query);
    res.status(201).send(deployment);
  }

  @ApiBadRequestResponse({ description: 'The given parameters were not what we expect.' })
  @ApiCreatedResponse({ description: 'The deployment has been created successfully.' })
  @ApiInternalServerErrorResponse({ description: 'An error occurred while creating the deployment.' })
  @ApiHeaders([
    {
      name: 'X-Admin-Request',
      required: true,
      description:
        'Set to true to indicate that this is an admin request. Otherwise will redirect to the catch-all route.',
      example: { 'X-Admin-Request': 'true' },
    },
  ])
  @ApiHeaders([
    {
      name: 'X-Admin-Token',
      required: false,
      description: 'The token to authenticate the admin request. Not required if authentication is turned off.',
      example: { 'X-Admin-Token': 'example-token' },
    },
  ])
  @Post('container')
  async runContainerPost(
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
    @Body() runContainerDto: RunContainerDto,
  ): Promise<void> {
    if (!checkWhetherWeShouldAdmin(req)) {
      await this.redirectToProxy(req, res);
      return;
    }
    const deployment: ContainerConfig = await this.appService.newDeployment(runContainerDto);
    res.status(201).send(deployment);
  }

  @ApiOkResponse({ description: 'The health of the application is okay.' })
  @ApiResponse({ status: 503, description: 'The app is unhealthy.' })
  @ApiHeaders([
    {
      name: 'X-Admin-Request',
      required: true,
      description:
        'Set to true to indicate that this is an admin request. Otherwise will redirect to the catch-all route.',
      example: { 'X-Admin-Request': 'true' },
    },
  ])
  @Get('health')
  async healthCheck(): Promise<{ status: string }> {
    const currentHealth: AppHealth = await this.appService.checkHealth();
    if (currentHealth === AppHealth.OK) {
      return { status: 'OK' };
    } else {
      throw new InternalServerErrorException({ status: 'ERROR' });
    }
  }

  @ApiOkResponse({ description: 'The status of the application.' })
  @ApiInternalServerErrorResponse({ description: 'An error occurred while retrieving the status of the application.' })
  @ApiHeaders([
    {
      name: 'X-Admin-Request',
      required: true,
      description:
        'Set to true to indicate that this is an admin request. Otherwise will redirect to the catch-all route.',
      example: { 'X-Admin-Request': 'true' },
    },
  ])
  @ApiHeaders([
    {
      name: 'X-Admin-Token',
      required: false,
      description: 'The token to authenticate the admin request. Not required if authentication is turned off.',
      example: { 'X-Admin-Token': 'example-token' },
    },
  ])
  @Get('status')
  async getStatus(@Req() req: FastifyRequest, @Res() res: FastifyReply): Promise<void> {
    if (!checkWhetherWeShouldAdmin(req)) {
      await this.redirectToProxy(req, res);
      return;
    }

    const status: StatusReport = await this.appService.getStatus();
    res.status(200).send(status);
  }

  @ApiCreatedResponse({ description: 'The deployment has been deleted successfully.' })
  @ApiNotFoundResponse({ description: 'No deployment found with that name.' })
  @ApiHeaders([
    {
      name: 'X-Admin-Request',
      required: true,
      description:
        'Set to true to indicate that this is an admin request. Otherwise will redirect to the catch-all route.',
      example: { 'X-Admin-Request': 'true' },
    },
  ])
  @ApiHeaders([
    {
      name: 'X-Admin-Token',
      required: false,
      description: 'The token to authenticate the admin request. Not required if authentication is turned off.',
      example: { 'X-Admin-Token': 'example-token' },
    },
  ])
  @Delete('container')
  async deleteContainer(
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
    @Query() query: DeleteDeploymentDto,
  ): Promise<void> {
    if (!checkWhetherWeShouldAdmin(req)) {
      await this.redirectToProxy(req, res);
      return;
    }

    await this.appService.deleteContainer(query.branch);
    res.status(201).send();
  }

  @ApiResponse({ description: 'Proxy the request to the deployed container host.', status: 'default' })
  @ApiNotFoundResponse({ description: 'No container found with that name.' })
  @ApiMethodNotAllowedResponse({
    description: 'The method is not allowed for this route, if an X-Admin-Request header is sent.',
  })
  @All('*')
  async redirectToProxy(@Req() req: FastifyRequest, @Res() res: FastifyReply): Promise<void> {
    if (req.raw.headers['x-admin-request']) {
      throw new MethodNotAllowedException('Admin requests are not allowed on this route.');
    }

    const host: string = req.headers.host;
    const targetIp: string = await this.appService.proxyRequest(host);
    Logger.debug(`Redirecting request to ${targetIp}`);

    // noinspection HttpUrlsUsage - internal only, so it's fine in this case
    res.from(`http://${targetIp}`);
  }
}
