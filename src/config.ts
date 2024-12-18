import { ConfigService } from '@nestjs/config';
import { AppConfig, SuspendMode } from './interfaces';
import { ONE_MINUTE } from './constants';

export function getConfig(configService: ConfigService): AppConfig {
    return {
        configDirContainer: configService.get<string>('CONFIG_DIR_CONTAINER') ?? '/config',
        configDirHost: configService.get<string>('CONFIG_DIR_HOST') ?? './config',
        containerPrefix: configService.get<string>('CONFIG_CONTAINER_PREFIX') ?? 'container-host',
        customBuildScript: configService.getOrThrow<string>('CONFIG_CUSTOM_BUILD_SCRIPT'),
        customBuildScriptLocal: configService.get<boolean>('CONFIG_CUSTOM_BUILD_SCRIPT_LOCAL') ?? false,
        hostname: configService.get<string>('CONFIG_HOSTNAME') ?? 'localhost.local',
        idleTimeout: configService.get<number>('CONFIG_IDLE_TIMEOUT') ?? ONE_MINUTE,
        masterImage: configService.get<string>('CONFIG_MASTER_IMAGE') ?? 'dr460nf1r3/container-manager-dind',
        masterImageAddPkg: configService.get<string>('CONFIG_MASTER_IMAGE_ADD_PKG') ?? '',
        masterTag: configService.get<string>('CONFIG_MASTER_TAG') ?? 'main',
        repoUrl: configService.getOrThrow<string>('CONFIG_REPO_URL'),
        suspendMode: configService.get<SuspendMode>('CONFIG_SUSPEND_MODE') ?? 'stop',
    };
}
