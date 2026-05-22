import type { UpdateUserInput, User } from '@orderhub/contracts';
import { ConflictError, NotFoundError } from '../../utils/errors.js';
import type {
  UserPublicRow,
  UsersRepository,
} from './users.repository.js';

const PG_UNIQUE_VIOLATION = '23505';

export class UsersService {
  constructor(private readonly repo: UsersRepository) {}

  async getById(id: string): Promise<User> {
    const row = await this.repo.findById(id);
    if (!row) {
      throw new NotFoundError('USER_NOT_FOUND', 'User not found');
    }
    return toPublic(row);
  }

  async listAll(): Promise<User[]> {
    const rows = await this.repo.listAll();
    return rows.map(toPublic);
  }

  async updateMe(id: string, input: UpdateUserInput): Promise<User> {
    try {
      const row = await this.repo.update(id, input);
      if (!row) {
        throw new NotFoundError('USER_NOT_FOUND', 'User not found');
      }
      return toPublic(row);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictError(
          'EMAIL_TAKEN',
          'A user with this email already exists',
        );
      }
      throw err;
    }
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === PG_UNIQUE_VIOLATION
  );
}

function toPublic(row: UserPublicRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
