import { Container } from 'dockerode';

export interface ContainerConfig {
  branch: string;
  shellPort?: number;
  checkout: string;
  active: boolean;
  containers: Container[];
  image?: string;
  lastAccessed?: number;
}

export interface SaveFile {
  containers: ContainerConfig[];
}

export type SuspendMode = 'stop' | 'pause';

export interface AppConfig {
  repoUrl: string;
  configDirContainer: string;
  configDirHost: string;
  containerPrefix: string;
  customBuildScript: string;
  customBuildScriptLocal: boolean;
  hostname: string;
  idleTimeout: number;
  masterImage: string;
  masterImageAddPkg: string;
  masterTag: string;
  suspendMode: SuspendMode;
}

export interface ContainerStatus {
  name: string;
  branch: string;
  checkout?: string;
  active: boolean;
  lastAccessed?: string;
}

export interface StatusReport {
  appHealth: string;
  containerHosts: ContainerStatus[];
  masterImage: string;
  masterTag: string;
}
