import { Body, Controller, Get, InternalServerErrorException, Post, Query, Req, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AppHealth } from './constants';
import { RunContainerDto } from './validation';
import { FastifyReply, FastifyRequest } from 'fastify';
import { SkipThrottle } from '@nestjs/throttler';
import { StatusReport } from './interfaces';

@Controller()
export class AppController {
    constructor(private readonly appService: AppService) {
    }

    @SkipThrottle()
    @Get()
    async redirectToProxy(@Req() req: FastifyRequest, @Res() res: FastifyReply): Promise<void> {
        const host: string = req.headers.host;
        const targetIp: string = await this.appService.proxyRequest(host);

        // noinspection HttpUrlsUsage - internal only, so it's fine in this case
        res.status(302).redirect(`http://${targetIp}`);
    }

    @Get('run')
    async runContainerGet(@Query() query: RunContainerDto): Promise<void> {
        return await this.appService.newDeployment(query);
    }

    @Post('run')
    async runContainerPost(@Body() runContainerDto: RunContainerDto): Promise<void> {
        return await this.appService.newDeployment(runContainerDto);
    }

    @Get('health')
    async healthCheck(): Promise<{ status: string }> {
        const currentHealth: AppHealth = await this.appService.checkHealth();

        if (currentHealth === AppHealth.OK) {
            return { status: 'OK' };
        } else {
            throw new InternalServerErrorException({ status: 'ERROR' });
        }
    }

    @Cron(CronExpression.EVERY_MINUTE)
    async shutdownNonBusyContainers(): Promise<void> {
        await this.appService.shutdownNonBusyContainers();
    }

    @Get('status')
    async getStatus(): Promise<StatusReport> {
        return this.appService.getStatus();
    }
}
