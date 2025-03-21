export const ONE_WEEK = 1000 * 60 * 60 * 24 * 7;
export const ONE_MINUTE = 1000 * 60;
export const TEN_MINUTES = ONE_MINUTE * 10;

export enum AppHealth {
  OK = 'OK',
  ERROR = 'ERROR',
}

export enum ContainerHostStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  BUILDING = 'BUILDING',
  STARTING = 'STARTING',
  SUSPENDING = 'SUSPENDING',
}
