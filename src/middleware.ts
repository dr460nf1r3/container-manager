import { FastifyRequest } from 'fastify';
import { UnauthorizedException } from '@nestjs/common';

/**
 * (not a real) middleware but rather a function to check whether the request is from an admin.
 * @param req The request. Must have headers 'x-admin-request' and 'x-admin-token' set.
 * @param needsAuth Whether the request must have correct credentials. Useful for public admin routes.
 */
export function checkWhetherWeShouldAdmin(req: FastifyRequest, needsAuth = true): boolean {
  const authNeeded: boolean = process.env.CONFIG_ADMIN_SECRET !== undefined;
  const adminRequested: boolean = req.headers['x-admin-request'] === 'true';

  if (
    needsAuth &&
    adminRequested &&
    authNeeded &&
    !(req.headers['x-admin-token'] === process.env.CONFIG_ADMIN_SECRET)
  ) {
    throw new UnauthorizedException('Unauthorized access attempt.');
  }

  return adminRequested;
}
