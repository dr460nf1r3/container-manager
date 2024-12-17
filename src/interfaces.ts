import { Container } from 'dockerode';

export interface ContainerConfig {
    tag: string;
    branch: string;
    shellPort?: number;
    commit: string;
    active: boolean;
    containers: Container[];
    image?: string;
    lastAccessed?: number;
}

export interface SaveFile {
    containers: ContainerConfig[];
}

export interface AppConfig {
    masterImage: string;
    masterTag: string;
    configDirHost: string;
    configDirContainer: string;
    hostname: string;
    containerPrefix: string;
}
