import { ConfigService } from '@nestjs/config';
import { AppConfig } from './interfaces';

export function getConfig(configService: ConfigService): AppConfig {
    return {
        configDirContainer: configService.get('CONFIG_DIR_CONTAINER') ?? '/config',
        configDirHost: configService.get('CONFIG_DIR_HOST') ?? './config',
        containerPrefix: configService.get('CONFIG_CONTAINER_PREFIX') ?? 'container-host',
        hostname: configService.get('CONFIG_HOSTNAME') ?? 'localhost.local',
        masterImage: configService.get('CONFIG_MASTER_IMAGE') ?? 'docker-poc',
        masterTag: configService.get('CONFIG_MASTER_TAG') ?? 'latest',
    };
}
