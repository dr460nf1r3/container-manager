import { FastifyRequest } from 'fastify';
import { UnauthorizedException } from '@nestjs/common';

/**
 * Middleware to check whether the request is from an admin.
 * @param req The request. Must have headers 'x-admin' and 'x-admin-secret' set.
 */
export function checkWhetherWeShouldAdmin(req: FastifyRequest): boolean {
  const authNeeded: boolean = process.env.CONFIG_ADMIN_SECRET !== undefined;
  const adminRequested: boolean = req.headers['x-admin'] === 'true';

  if (adminRequested && authNeeded && !(req.headers['x-admin-secret'] === process.env.CONFIG_ADMIN_SECRET)) {
    throw new UnauthorizedException('Unauthorized access attempt.');
  }

  return adminRequested;
}
