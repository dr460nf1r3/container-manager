import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { Request, Response } from 'express';
import { Cron, CronExpression } from '@nestjs/schedule';

@Controller()
export class AppController {
    constructor(private readonly appService: AppService) {
    }

    @Get()
    async redirectToProxy(@Req() req: Request, @Res() res: Response): Promise<void> {
        const host: string = req.headers.host;
        const targetIp: string = await this.appService.proxyRequest(host);

        // noinspection HttpUrlsUsage
        return res.redirect(`http://${targetIp}`);
    }

    @Get('run')
    async runContainer(@Query('branch') branch: string, @Query('commit') commit: string): Promise<void> {
        return await this.appService.newDeployment({ branch, commit });
    }

    @Get('health')
    async healthCheck(): Promise<string> {
        return 'OK';
    }

    @Cron(CronExpression.EVERY_10_SECONDS)
    async shutdownNonBusyContainers(): Promise<void> {
        await this.appService.shutdownNonBusyContainers();
    }
}
