import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'node:crypto';
import type { User } from '@orderhub/contracts';
import { AppError, UnauthorizedError } from '../../utils/errors.js';
import type { AuthRepository, UserRow } from './auth.repository.js';

const BCRYPT_ROUNDS = 10;
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type AuthDeps = {
  jwtSecret: string;
  /** Reserved for a future signed-refresh-token scheme; currently unused. */
  jwtRefreshSecret: string;
};

export type AuthTokens = { accessToken: string; refreshToken: string };

export type AuthResult = { user: User; tokens: AuthTokens };

export class AuthService {
  constructor(
    private readonly repo: AuthRepository,
    private readonly deps: AuthDeps,
  ) {}

  async register(input: {
    email: string;
    password: string;
    name: string;
  }): Promise<AuthResult> {
    const existing = await this.repo.findUserByEmail(input.email);
    if (existing) {
      throw new AppError(409, 'EMAIL_TAKEN', 'Email is already registered');
    }
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const userRow = await this.repo.createUser({
      email: input.email,
      passwordHash,
      name: input.name,
    });
    const tokens = await this.issueTokens(userRow);
    return { user: toPublic(userRow), tokens };
  }

  async login(input: { email: string; password: string }): Promise<AuthResult> {
    const user = await this.repo.findUserByEmail(input.email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }
    const ok = await bcrypt.compare(input.password, user.password_hash);
    if (!ok) {
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }
    const tokens = await this.issueTokens(user);
    return { user: toPublic(user), tokens };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const tokenHash = hashRefreshToken(refreshToken);
    const row = await this.repo.findValidRefreshToken(tokenHash);
    if (!row) {
      throw new UnauthorizedError('Refresh token is invalid', 'INVALID_REFRESH_TOKEN');
    }
    const user = await this.repo.findUserById(row.user_id);
    if (!user) {
      throw new UnauthorizedError('Refresh token is invalid', 'INVALID_REFRESH_TOKEN');
    }
    // v1: no rotation — return the same opaque refresh token.
    const accessToken = this.signAccessToken(user);
    return { accessToken, refreshToken };
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashRefreshToken(refreshToken);
    await this.repo.revokeRefreshToken(tokenHash);
  }

  /**
   * Change the password for an authenticated user. Verifies the current
   * password before applying the new hash, then revokes every refresh token
   * for the user so any session that authenticated against the old password
   * is forced to log in again.
   *
   * Throws:
   *   - 401 INVALID_CURRENT_PASSWORD if the current password doesn't match.
   *   - 404 USER_NOT_FOUND if the user vanished mid-call (unusual).
   *
   * The "new password must differ from current" rule is enforced upstream
   * by the Zod ChangePasswordSchema.
   */
  async changePassword(input: {
    userId: string;
    currentPassword: string;
    newPassword: string;
  }): Promise<void> {
    const user = await this.repo.findUserById(input.userId);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }
    const ok = await bcrypt.compare(input.currentPassword, user.password_hash);
    if (!ok) {
      throw new UnauthorizedError(
        'Current password is incorrect',
        'INVALID_CURRENT_PASSWORD',
      );
    }
    const newHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);
    await this.repo.updatePasswordHash(input.userId, newHash);
    // Defensive: kill all sessions so a previously-leaked refresh token
    // can't continue to mint access tokens after the credential rotated.
    await this.repo.revokeAllRefreshTokensForUser(input.userId);
  }

  private async issueTokens(user: UserRow): Promise<AuthTokens> {
    const accessToken = this.signAccessToken(user);
    const refreshToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    await this.repo.createRefreshToken({
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt,
    });
    return { accessToken, refreshToken };
  }

  private signAccessToken(user: UserRow): string {
    const payload = { sub: user.id, role: user.role, email: user.email };
    return jwt.sign(payload, this.deps.jwtSecret, { expiresIn: ACCESS_TOKEN_TTL });
  }
}

function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function toPublic(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    surname: row.surname,
    address: row.address,
    role: row.role,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
