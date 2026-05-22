import type { Pool } from 'pg';
import type { UserRole } from '@orderhub/contracts';

export type UserPublicRow = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  created_at: Date;
  updated_at: Date;
};

const COLS = `id, email, name, role, created_at, updated_at`;

export class UsersRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<UserPublicRow | null> {
    const { rows } = await this.pool.query<UserPublicRow>(
      `SELECT ${COLS} FROM users WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async listAll(): Promise<UserPublicRow[]> {
    const { rows } = await this.pool.query<UserPublicRow>(
      `SELECT ${COLS} FROM users ORDER BY created_at DESC`,
    );
    return rows;
  }

  async update(
    id: string,
    fields: { name?: string; email?: string },
  ): Promise<UserPublicRow | null> {
    const sets: string[] = [];
    const values: unknown[] = [id];
    let i = 2;
    if (fields.name !== undefined) {
      sets.push(`name = $${i++}`);
      values.push(fields.name);
    }
    if (fields.email !== undefined) {
      sets.push(`email = $${i++}`);
      values.push(fields.email);
    }
    if (sets.length === 0) {
      return this.findById(id);
    }
    sets.push(`updated_at = now()`);
    const { rows } = await this.pool.query<UserPublicRow>(
      `UPDATE users
       SET ${sets.join(', ')}
       WHERE id = $1
       RETURNING ${COLS}`,
      values,
    );
    return rows[0] ?? null;
  }
}
