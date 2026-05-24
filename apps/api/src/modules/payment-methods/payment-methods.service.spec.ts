import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { CardInput } from '@orderhub/contracts';
import { PaymentMethodsService } from './payment-methods.service.js';
import type {
  PaymentMethodRow,
  PaymentMethodsRepository,
} from './payment-methods.repository.js';

const VALID_CARD: CardInput = {
  number: '4111111111111111',
  holderName: 'Test Customer',
  expiry: '12/99',
  cvv: '123',
};

const makeRow = (overrides: Partial<PaymentMethodRow> = {}): PaymentMethodRow => ({
  id: '00000000-0000-0000-0000-000000000001',
  user_id: 'user-1',
  holder_name: 'Test Customer',
  last4: '1111',
  expiry: '12/99',
  created_at: new Date('2024-01-01T00:00:00Z'),
  updated_at: new Date('2024-01-01T00:00:00Z'),
  ...overrides,
});

const makeRepo = () =>
  ({
    findByUserId: jest.fn(),
    upsert: jest.fn(),
    deleteByUserId: jest.fn(),
  }) as unknown as jest.Mocked<PaymentMethodsRepository>;

describe('PaymentMethodsService.getMine', () => {
  let repo: jest.Mocked<PaymentMethodsRepository>;
  let svc: PaymentMethodsService;
  beforeEach(() => {
    repo = makeRepo();
    svc = new PaymentMethodsService(repo);
  });

  it('returns null when the user has no saved card (not a 404)', async () => {
    repo.findByUserId.mockResolvedValue(null);
    const result = await svc.getMine('user-1');
    expect(result).toBeNull();
  });

  it('maps the row to the public PaymentMethod shape', async () => {
    repo.findByUserId.mockResolvedValue(makeRow());
    const result = await svc.getMine('user-1');
    expect(result).toEqual({
      id: '00000000-0000-0000-0000-000000000001',
      holderName: 'Test Customer',
      last4: '1111',
      expiry: '12/99',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    });
  });
});

describe('PaymentMethodsService.saveMine', () => {
  let repo: jest.Mocked<PaymentMethodsRepository>;
  let svc: PaymentMethodsService;
  beforeEach(() => {
    repo = makeRepo();
    svc = new PaymentMethodsService(repo);
    repo.upsert.mockResolvedValue(makeRow());
  });

  it('derives last4 from the card number and never sends PAN to the repo', async () => {
    await svc.saveMine('user-1', VALID_CARD);

    expect(repo.upsert).toHaveBeenCalledTimes(1);
    const arg = repo.upsert.mock.calls[0]![0];
    expect(arg).toEqual({
      userId: 'user-1',
      holderName: 'Test Customer',
      last4: '1111',
      expiry: '12/99',
    });
    // Belt-and-braces — make sure no PAN field snuck in.
    expect(JSON.stringify(arg)).not.toContain('4111111111111111');
    expect(JSON.stringify(arg)).not.toContain('cvv');
  });

  it('takes the last 4 digits from longer card numbers (Amex-ish 15-digit)', async () => {
    await svc.saveMine('user-1', { ...VALID_CARD, number: '378282246310005' });
    const arg = repo.upsert.mock.calls[0]![0];
    expect(arg.last4).toBe('0005');
  });

  it('returns the saved PaymentMethod in public shape', async () => {
    repo.upsert.mockResolvedValue(
      makeRow({ holder_name: 'Bob', last4: '4242', expiry: '01/30' }),
    );
    const result = await svc.saveMine('user-1', {
      ...VALID_CARD,
      holderName: 'Bob',
      number: '4242424242424242',
      expiry: '01/30',
    });
    expect(result.holderName).toBe('Bob');
    expect(result.last4).toBe('4242');
    expect(result.expiry).toBe('01/30');
  });
});

describe('PaymentMethodsService.deleteMine', () => {
  let repo: jest.Mocked<PaymentMethodsRepository>;
  let svc: PaymentMethodsService;
  beforeEach(() => {
    repo = makeRepo();
    svc = new PaymentMethodsService(repo);
  });

  it('resolves quietly when a row existed', async () => {
    repo.deleteByUserId.mockResolvedValue(true);
    await expect(svc.deleteMine('user-1')).resolves.toBeUndefined();
  });

  it('throws PAYMENT_METHOD_NOT_FOUND (404) when nothing was deleted', async () => {
    repo.deleteByUserId.mockResolvedValue(false);
    await expect(svc.deleteMine('user-1')).rejects.toMatchObject({
      code: 'PAYMENT_METHOD_NOT_FOUND',
      statusCode: 404,
    });
  });
});
