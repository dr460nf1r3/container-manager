import { ConfigService } from '@nestjs/config';
import { AppConfig, SuspendMode } from './interfaces';
import { TEN_MINUTES } from './constants';

export function getConfig(configService: ConfigService): AppConfig {
  return {
    configDirContainer: configService.get<string>('CONFIG_DIR_CONTAINER') ?? '/config',
    configDirHost: configService.get<string>('CONFIG_DIR_HOST') ?? './config',
    containerPrefix: configService.get<string>('CONFIG_CONTAINER_PREFIX') ?? 'container-host',
    customBuildScript: configService.getOrThrow<string>('CONFIG_CUSTOM_BUILD_SCRIPT'),
    customBuildScriptLocal: configService.get<boolean>('CONFIG_CUSTOM_BUILD_SCRIPT_LOCAL') ?? false,
    dataDirHost: configService.get<string>('CONFIG_DATA_DIR_HOST') ?? './data',
    dockerNetworkName: configService.get<string>('CONFIG_DOCKER_NETWORK_NAME') ?? 'container-manager',
    hostname: configService.get<string>('CONFIG_HOSTNAME') ?? 'localhost.local',
    idleTimeout: configService.get<number>('CONFIG_IDLE_TIMEOUT') ?? TEN_MINUTES,
    isProd: process.env.NODE_ENV === 'production',
    logViewer: configService.get<boolean>('CONFIG_LOGVIEWER') ?? true,
    logViewerContainerName: configService.get<string>('CONFIG_LOGVIEWER_CONTAINER_NAME') ?? 'container-logviewer',
    logViewerImage: configService.get<string>('CONFIG_LOGVIEWER_IMAGE') ?? 'amir20/dozzle',
    logViewerPort: configService.get<number>('CONFIG_LOGVIEWER_PORT') ?? 8080,
    logViewerTag: configService.get<string>('CONFIG_LOGVIEWER_TAG') ?? 'latest',
    masterImage: configService.get<string>('CONFIG_MASTER_IMAGE') ?? 'dr460nf1r3/container-manager-dind',
    masterImageAddPkg: configService.get<string>('CONFIG_MASTER_IMAGE_ADD_PKG') ?? '',
    masterTag: configService.get<string>('CONFIG_MASTER_TAG') ?? 'main',
    repoUrl: configService.getOrThrow<string>('CONFIG_REPO_URL'),
    suspendMode: configService.get<SuspendMode>('CONFIG_SUSPEND_MODE') ?? 'stop',
  };
}
