import { Container } from 'dockerode';
import { ContainerHostStatus } from './constants';

export interface ContainerConfig {
  branch: string;
  checkout: string;
  containerHost: Container;
  image?: string;
  keepActive?: boolean;
  lastAccessed?: number;
  shellPort?: number;
  status: ContainerHostStatus;
}

export interface SaveFile {
  containers: ContainerConfig[];
}

export type SuspendMode = 'stop' | 'pause';

export interface AppConfig {
  configDirContainer: string;
  configDirHost: string;
  containerPrefix: string;
  customBuildScript: string;
  customBuildScriptLocal: boolean;
  dataDirHost: string;
  dockerNetworkName: string;
  hostname: string;
  idleTimeout: number;
  isProd: boolean;
  logViewer: boolean;
  logViewerContainerName: string;
  logViewerImage: string;
  logViewerPort: number;
  logViewerTag: string;
  masterImage: string;
  masterImageAddPkg: string;
  masterTag: string;
  repoUrl: string;
  suspendMode: SuspendMode;
}

export interface ContainerStatus {
  active: boolean;
  branch: string;
  checkout?: string;
  lastAccessed?: string;
  name: string;
}

export interface StatusReport {
  appHealth: string;
  containerHosts: ContainerStatus[];
  masterImage: string;
  masterTag: string;
}
