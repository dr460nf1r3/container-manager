import * as fs from 'node:fs';
import { Logger, LogLevel } from '@nestjs/common';
import { ContainerHostStatus } from './constants';

/**
 * Check if a path exists.
 * This is a wrapper around fs.existsSync, since it does not have a direct equivalent in the fs/promises API.
 * @param path The path to check.
 * @returns True if the path exists, false otherwise.
 */
export function pathExists(path: fs.PathLike): boolean {
  return fs.existsSync(path);
}

/**
 * Convert a log level provided via env var to an array of log levels.
 * @param level The log level array to pass to overrideLogger
 */
export function loglevelToNestJsArray(level: string): LogLevel[] {
  const allLevels: LogLevel[] = ['verbose', 'debug', 'log', 'warn', 'error', 'fatal'];
  let index: number = allLevels.indexOf(level as LogLevel);

  if (index === -1) {
    Logger.warn(`Invalid log level: ${level}. Defaulting to 'log'.`);
    index = 1;
  }
  return allLevels.slice(index);
}

/**
 * Initialize the log level.
 * @param level The log level to set.
 */
export function initLoglevel(level: string): void {
  const logLevel: LogLevel[] = loglevelToNestJsArray(level);

  Logger.log(`Setting log level to ${logLevel[0]}`, 'initLoglevel');
  Logger.overrideLogger(logLevel);
}

/**
 * Delete a file or directory if it exists.
 * @param path The path to delete.
 */
export function deleteIfExists(path: fs.PathLike): void {
  if (pathExists(path)) {
    fs.rmSync(path, { recursive: true });
  }
}

/**
 * Shorthand function for less visual clutter.
 * @param status The status to check.
 * @returns True if the container should not be touched, false otherwise.
 */
export function dontTouchContainer(status: ContainerHostStatus): boolean {
  return status === (ContainerHostStatus.BUILDING || ContainerHostStatus.SUSPENDING || ContainerHostStatus.STARTING);
}

/**
 * Sanitize a hostname to be used in a container name.
 * @param hostname The hostname to sanitize.
 * @returns The sanitized hostname.
 */
export function sanitizeContainerName(hostname: string): string {
  return hostname.replace(/[^a-zA-Z0-9-]/g, '-');
}
