import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import bcrypt from 'bcrypt';
import { AuthService } from './auth.service.js';
import type { AuthRepository, UserRow } from './auth.repository.js';

const DEPS = {
  jwtSecret: 'unit-test-secret-unit-test-secret',
  jwtRefreshSecret: 'unit-test-refresh-unit-test-refresh',
};

const makeUser = (overrides: Partial<UserRow> = {}): UserRow => ({
  id: '11111111-1111-1111-1111-111111111111',
  email: 'alice@test.dev',
  password_hash: 'placeholder',
  name: 'Alice',
  surname: null,
  address: null,
  role: 'CLIENT',
  created_at: new Date('2024-01-01T00:00:00Z'),
  updated_at: new Date('2024-01-01T00:00:00Z'),
  ...overrides,
});

const makeRepo = () =>
  ({
    findUserByEmail: jest.fn(),
    findUserById: jest.fn(),
    createUser: jest.fn(),
    createRefreshToken: jest.fn(),
    findValidRefreshToken: jest.fn(),
    revokeRefreshToken: jest.fn(),
    revokeAllRefreshTokensForUser: jest.fn(),
    updatePasswordHash: jest.fn(),
  }) as unknown as jest.Mocked<AuthRepository>;

describe('AuthService.register', () => {
  let repo: jest.Mocked<AuthRepository>;
  let svc: AuthService;
  beforeEach(() => {
    repo = makeRepo();
    svc = new AuthService(repo, DEPS);
  });

  it('throws EMAIL_TAKEN when email is already registered', async () => {
    repo.findUserByEmail.mockResolvedValue(makeUser());
    await expect(
      svc.register({ email: 'alice@test.dev', password: 'password123', name: 'Alice' }),
    ).rejects.toMatchObject({ code: 'EMAIL_TAKEN', statusCode: 409 });
    expect(repo.createUser).not.toHaveBeenCalled();
  });

  it('hashes the password (not plaintext) before persisting', async () => {
    repo.findUserByEmail.mockResolvedValue(null);
    let capturedHash = '';
    repo.createUser.mockImplementation(async (input) => {
      capturedHash = input.passwordHash;
      return makeUser({ password_hash: input.passwordHash });
    });
    repo.createRefreshToken.mockResolvedValue(undefined);

    await svc.register({
      email: 'alice@test.dev',
      password: 'password123',
      name: 'Alice',
    });

    expect(capturedHash).not.toBe('password123');
    expect(await bcrypt.compare('password123', capturedHash)).toBe(true);
  });

  it('issues an access token and refresh token on successful registration', async () => {
    repo.findUserByEmail.mockResolvedValue(null);
    repo.createUser.mockResolvedValue(makeUser());
    repo.createRefreshToken.mockResolvedValue(undefined);

    const { user, tokens } = await svc.register({
      email: 'alice@test.dev',
      password: 'password123',
      name: 'Alice',
    });

    expect(user.email).toBe('alice@test.dev');
    expect(tokens.accessToken).toEqual(expect.any(String));
    expect(tokens.refreshToken).toEqual(expect.any(String));
    expect(repo.createRefreshToken).toHaveBeenCalledTimes(1);
  });
});

describe('AuthService.login', () => {
  let repo: jest.Mocked<AuthRepository>;
  let svc: AuthService;
  beforeEach(() => {
    repo = makeRepo();
    svc = new AuthService(repo, DEPS);
  });

  it('throws INVALID_CREDENTIALS when user does not exist', async () => {
    repo.findUserByEmail.mockResolvedValue(null);
    await expect(
      svc.login({ email: 'no@one.dev', password: 'whatever' }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS', statusCode: 401 });
  });

  it('throws INVALID_CREDENTIALS when password does not match', async () => {
    const hash = await bcrypt.hash('correct', 10);
    repo.findUserByEmail.mockResolvedValue(makeUser({ password_hash: hash }));
    await expect(
      svc.login({ email: 'alice@test.dev', password: 'wrong' }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('issues tokens when credentials are valid', async () => {
    const hash = await bcrypt.hash('correct', 10);
    repo.findUserByEmail.mockResolvedValue(makeUser({ password_hash: hash }));
    repo.createRefreshToken.mockResolvedValue(undefined);

    const result = await svc.login({ email: 'alice@test.dev', password: 'correct' });

    expect(result.tokens.accessToken).toEqual(expect.any(String));
    expect(result.tokens.refreshToken).toEqual(expect.any(String));
  });
});

describe('AuthService.refresh', () => {
  let repo: jest.Mocked<AuthRepository>;
  let svc: AuthService;
  beforeEach(() => {
    repo = makeRepo();
    svc = new AuthService(repo, DEPS);
  });

  it('throws INVALID_REFRESH_TOKEN when token is unknown / revoked / expired', async () => {
    repo.findValidRefreshToken.mockResolvedValue(null);
    await expect(svc.refresh('does-not-exist')).rejects.toMatchObject({
      code: 'INVALID_REFRESH_TOKEN',
      statusCode: 401,
    });
  });

  it('throws INVALID_REFRESH_TOKEN when the underlying user was deleted', async () => {
    repo.findValidRefreshToken.mockResolvedValue({
      id: 'rt-1',
      user_id: 'u-1',
      token_hash: 'h',
      expires_at: new Date(Date.now() + 60_000),
      revoked_at: null,
      created_at: new Date(),
    });
    repo.findUserById.mockResolvedValue(null);
    await expect(svc.refresh('some-token')).rejects.toMatchObject({
      code: 'INVALID_REFRESH_TOKEN',
    });
  });
});

describe('AuthService.logout', () => {
  let repo: jest.Mocked<AuthRepository>;
  let svc: AuthService;
  beforeEach(() => {
    repo = makeRepo();
    svc = new AuthService(repo, DEPS);
  });

  it('revokes the refresh token by its sha256 hash, not the raw value', async () => {
    repo.revokeRefreshToken.mockResolvedValue(undefined);
    await svc.logout('the-raw-token');
    expect(repo.revokeRefreshToken).toHaveBeenCalledTimes(1);
    const arg = repo.revokeRefreshToken.mock.calls[0]?.[0];
    expect(arg).not.toBe('the-raw-token');
    expect(arg).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('AuthService.changePassword', () => {
  let repo: jest.Mocked<AuthRepository>;
  let svc: AuthService;
  let existingHash: string;

  beforeEach(async () => {
    repo = makeRepo();
    svc = new AuthService(repo, DEPS);
    existingHash = await bcrypt.hash('correct-old-password', 4);
    repo.findUserById.mockResolvedValue(
      makeUser({ password_hash: existingHash }),
    );
    repo.updatePasswordHash.mockResolvedValue(undefined);
    repo.revokeAllRefreshTokensForUser.mockResolvedValue(undefined);
  });

  it('hashes and stores the new password when the current one verifies', async () => {
    await svc.changePassword({
      userId: 'user-1',
      currentPassword: 'correct-old-password',
      newPassword: 'brand-new-password',
    });

    expect(repo.updatePasswordHash).toHaveBeenCalledTimes(1);
    const [userIdArg, newHash] = repo.updatePasswordHash.mock.calls[0]!;
    expect(userIdArg).toBe('user-1');
    expect(newHash).not.toBe('brand-new-password');
    expect(await bcrypt.compare('brand-new-password', newHash)).toBe(true);
  });

  it('revokes every refresh token after a successful change', async () => {
    await svc.changePassword({
      userId: 'user-1',
      currentPassword: 'correct-old-password',
      newPassword: 'brand-new-password',
    });

    expect(repo.revokeAllRefreshTokensForUser).toHaveBeenCalledWith('user-1');
  });

  it('rejects with INVALID_CURRENT_PASSWORD (401) when the current password is wrong', async () => {
    await expect(
      svc.changePassword({
        userId: 'user-1',
        currentPassword: 'wrong-password',
        newPassword: 'brand-new-password',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_CURRENT_PASSWORD',
      statusCode: 401,
    });
    expect(repo.updatePasswordHash).not.toHaveBeenCalled();
    expect(repo.revokeAllRefreshTokensForUser).not.toHaveBeenCalled();
  });

  it('rejects with USER_NOT_FOUND (404) if the user has vanished', async () => {
    repo.findUserById.mockResolvedValue(null);
    await expect(
      svc.changePassword({
        userId: 'ghost',
        currentPassword: 'anything',
        newPassword: 'brand-new-password',
      }),
    ).rejects.toMatchObject({ code: 'USER_NOT_FOUND', statusCode: 404 });
  });
});
