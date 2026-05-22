import type { FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import type { UserRole } from '@orderhub/contracts';
import { env } from '../config/env.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

export type AuthClaims = {
  sub: string;
  role: UserRole;
  email: string;
};

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthClaims;
  }
}

export async function authenticate(req: FastifyRequest): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing Bearer token');
  }
  const token = header.slice('Bearer '.length).trim();
  try {
    const claims = jwt.verify(token, env.JWT_SECRET) as AuthClaims;
    req.user = claims;
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }
}

/**
 * Decodes the JWT if one is present; never throws on a missing or invalid
 * token. Use this on routes that change behavior based on auth (e.g. an
 * admin-only query param on an otherwise public endpoint).
 */
export async function optionalAuthenticate(req: FastifyRequest): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return;
  const token = header.slice('Bearer '.length).trim();
  try {
    const claims = jwt.verify(token, env.JWT_SECRET) as AuthClaims;
    req.user = claims;
  } catch {
    // Silently ignore — the route handler will decide whether the absence of
    // req.user is acceptable.
  }
}

export function authorize(...roles: UserRole[]) {
  return async (req: FastifyRequest): Promise<void> => {
    if (!req.user) {
      throw new UnauthorizedError('Not authenticated');
    }
    if (!roles.includes(req.user.role)) {
      throw new ForbiddenError('Insufficient permissions');
    }
  };
}
