import { Body, Controller, Get, InternalServerErrorException, Post, Query, Req, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AppHealth } from './constants';
import { DeleteDeploymentDto, RunContainerDto } from './validation';
import { FastifyReply, FastifyRequest } from 'fastify';
import { SkipThrottle } from '@nestjs/throttler';
import { StatusReport } from './interfaces';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiResponse,
} from '@nestjs/swagger';
import { checkWhetherWeShouldAdmin } from './middleware';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async shutdownNonBusyContainers(): Promise<void> {
    await this.appService.shutdownNonBusyContainers();
  }

  @ApiResponse({ status: 302, description: 'Redirect to the deployed container host.' })
  @ApiNotFoundResponse({ description: 'No container found with that name.' })
  @SkipThrottle()
  @Get()
  async redirectToProxy(@Req() req: FastifyRequest, @Res() res: FastifyReply): Promise<void> {
    const host: string = req.headers.host;
    const targetIp: string = await this.appService.proxyRequest(host);

    // noinspection HttpUrlsUsage - internal only, so it's fine in this case
    res.status(302).redirect(`http://${targetIp}`);
  }

  @ApiBadRequestResponse({ description: 'The given parameters were not what we expect.' })
  @ApiCreatedResponse({ description: 'The deployment has been created successfully.' })
  @ApiResponse({ status: 500, description: 'An error occurred while creating the deployment.' })
  @Get('run')
  async runContainerGet(
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
    @Query() query: RunContainerDto,
  ): Promise<void> {
    if (!checkWhetherWeShouldAdmin(req)) {
      await this.redirectToProxy(req, res);
    }
    return await this.appService.newDeployment(query);
  }

  @ApiBadRequestResponse({ description: 'The given parameters were not what we expect.' })
  @ApiCreatedResponse({ description: 'The deployment has been created successfully.' })
  @ApiResponse({ status: 500, description: 'An error occurred while creating the deployment.' })
  @Post('run')
  async runContainerPost(
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
    @Body() runContainerDto: RunContainerDto,
  ): Promise<void> {
    if (!checkWhetherWeShouldAdmin(req)) {
      await this.redirectToProxy(req, res);
    }
    return await this.appService.newDeployment(runContainerDto);
  }

  @ApiOkResponse({ description: 'The health of the application is okay.' })
  @ApiInternalServerErrorResponse({ description: 'The app is unhealthy.' })
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
  @Get('status')
  async getStatus(@Req() req: FastifyRequest, @Res() res: FastifyReply): Promise<StatusReport> {
    if (!checkWhetherWeShouldAdmin(req)) {
      await this.redirectToProxy(req, res);
    }

    return this.appService.getStatus();
  }

  @ApiCreatedResponse({ description: 'The deployment has been deleted successfully.' })
  @ApiNotFoundResponse({ description: 'No deployment found with that name.' })
  @Get('delete')
  async deleteContainer(
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
    @Query() query: DeleteDeploymentDto,
  ): Promise<void> {
    if (!checkWhetherWeShouldAdmin(req)) {
      await this.redirectToProxy(req, res);
    }

    return await this.appService.deleteContainer(query.branch);
  }
}
