import { Container } from 'dockerode';

export interface ContainerConfig {
  active: boolean;
  branch: string;
  checkout: string;
  containers: Container[];
  image?: string;
  lastAccessed?: number;
  shellPort?: number;
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
  hostname: string;
  idleTimeout: number;
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
