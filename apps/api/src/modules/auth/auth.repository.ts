import type { Pool } from 'pg';
import type { UserRole } from '@orderhub/contracts';

export type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: UserRole;
  created_at: Date;
  updated_at: Date;
};

export type RefreshTokenRow = {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
};

export class AuthRepository {
  constructor(private readonly pool: Pool) {}

  async findUserByEmail(email: string): Promise<UserRow | null> {
    const { rows } = await this.pool.query<UserRow>(
      `SELECT id, email, password_hash, name, role, created_at, updated_at
       FROM users
       WHERE email = $1`,
      [email],
    );
    return rows[0] ?? null;
  }

  async findUserById(id: string): Promise<UserRow | null> {
    const { rows } = await this.pool.query<UserRow>(
      `SELECT id, email, password_hash, name, role, created_at, updated_at
       FROM users
       WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async createUser(input: {
    email: string;
    passwordHash: string;
    name: string;
    role?: UserRole;
  }): Promise<UserRow> {
    const { rows } = await this.pool.query<UserRow>(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, COALESCE($4, 'CLIENT'))
       RETURNING id, email, password_hash, name, role, created_at, updated_at`,
      [input.email, input.passwordHash, input.name, input.role ?? null],
    );
    const row = rows[0];
    if (!row) throw new Error('createUser: no row returned');
    return row;
  }

  async createRefreshToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [input.userId, input.tokenHash, input.expiresAt],
    );
  }

  async findValidRefreshToken(tokenHash: string): Promise<RefreshTokenRow | null> {
    const { rows } = await this.pool.query<RefreshTokenRow>(
      `SELECT id, user_id, token_hash, expires_at, revoked_at, created_at
       FROM refresh_tokens
       WHERE token_hash = $1
         AND revoked_at IS NULL
         AND expires_at > now()`,
      [tokenHash],
    );
    return rows[0] ?? null;
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    await this.pool.query(
      `UPDATE refresh_tokens
       SET revoked_at = now()
       WHERE token_hash = $1 AND revoked_at IS NULL`,
      [tokenHash],
    );
  }
}
