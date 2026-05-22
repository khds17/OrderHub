# OrderHub v1 — Planning

Official document to guide you and the agent. Learning project: back-end decoupled from front-end, raw SQL directly on Postgres.

---

## MANDATORY AGENT INSTRUCTIONS

### PROHIBITED in v1 (do not generate, configure, or add to package.json)

| Item |
|------|
| MongoDB / Mongoose |
| Redis (cache, rate limit, session) |
| WebSockets |
| Background jobs (Bull, queues, cron) |
| Microservices (multiple deploys, inter-service messaging) |
| GraphQL |
| Heavy DI containers (tsyringe, inversify, etc.) |
| Prisma, Drizzle, TypeORM, Knex as query layer |
| NestJS |
| React Native / Expo |
| Integration, E2E, or performance tests |
| Real payment gateway |
| Granular permissions table (RBAC by role only) |
| Next.js Route Handlers duplicating API business rules |
| Server-side persistent cart |

**Allowed wiring — manual, at module root or app.ts:**

```ts
const productRepo = new ProductRepository(pool);
const productService = new ProductService(productRepo);
const productController = new ProductController(productService);
```

---

### REQUIRED in v1

| Item |
|------|
| TypeScript strict |
| Independent REST API (Fastify preferred, Express accepted) |
| PostgreSQL + access via `pg` (Pool) |
| SQL only in repositories (or `db/queries/*.sql`) |
| Migrations in versioned `.sql` files |
| Layers: controller → service → repository |
| Validation with Zod (`packages/contracts`) |
| Errors: `AppError` + global handler |
| JWT (access) + refresh token in Postgres table |
| RBAC: `ADMIN \| CLIENT \| SUPPORT` |
| Explicit SQL transaction in checkout (BEGIN/COMMIT/ROLLBACK) |
| CORS on the API (`ALLOWED_ORIGINS`) |
| Next.js only as HTTP client (`NEXT_PUBLIC_API_URL`) |
| Jest: unit tests on services and pure functions only |

> Reference skill: `nodejs-backend-patterns` — excluding Redis/Mongo/rate-limit from the skill.
> If the user does not explicitly request a prohibited item, do not add it.

---

## OBJECTIVES

Demonstrate:
- Front/back decoupling (REST + Zod contract)
- Testable layered architecture
- Relational SQL (FKs, indexes, transactions, locks)
- Simple RBAC
- Type-safe TypeScript
- Unit tests on business rules

Not in scope: massive scale, polyglot DB, mobile, queues, distributed cache.

---

## STACK v1

| Layer | Technology |
|-------|-----------|
| API | Node.js + Fastify + TypeScript |
| Database | PostgreSQL |
| Access | `pg` (Pool + PoolClient in transactions) |
| Migrations | `.sql` files + simple runner or `node-pg-migrate` |
| Validation | Zod (`packages/contracts`) |
| Auth | `jsonwebtoken` + `bcrypt` |
| Logging | Pino (Fastify logger) |
| Web | Next.js (App Router) + TypeScript + TailwindCSS |
| Tests | Jest (unit only) |
| Infra | Docker Compose: Postgres only |

---

## REPOSITORY STRUCTURE

```
orderhub/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── app.ts
│   │   │   ├── config/
│   │   │   ├── db/
│   │   │   │   ├── pool.ts
│   │   │   │   └── transaction.ts      # withTransaction(fn)
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── validate.ts
│   │   │   │   └── error-handler.ts
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   │   ├── auth.routes.ts
│   │   │   │   │   ├── auth.controller.ts
│   │   │   │   │   ├── auth.service.ts
│   │   │   │   │   ├── auth.repository.ts
│   │   │   │   │   └── auth.service.spec.ts
│   │   │   │   ├── users/
│   │   │   │   ├── products/
│   │   │   │   └── orders/
│   │   │   ├── types/
│   │   │   └── utils/errors.ts
│   │   ├── migrations/
│   │   │   ├── 001_extensions_and_enums.sql
│   │   │   ├── 002_tables.sql
│   │   │   └── 003_indexes.sql
│   │   ├── seeds/
│   │   │   └── seed.sql
│   │   ├── scripts/
│   │   │   └── migrate.ts
│   │   └── package.json
│   └── web/
│       ├── src/
│       │   ├── app/
│       │   ├── features/
│       │   ├── components/
│       │   ├── lib/api-client.ts
│       │   └── hooks/
│       └── package.json
├── packages/
│   └── contracts/                        # Zod schemas + inferred types
├── docker-compose.yml
├── .env.example
└── README.md
```

> Rule: `apps/web` imports only from `packages/contracts`, never from `apps/api`.

---

## ROLES (RBAC)

| Role | v1 Permissions |
|------|---------------|
| CLIENT | Products (read); create/list own orders; GET/PATCH /users/me |
| ADMIN | Products CRUD; list all orders; list users |
| SUPPORT | Read-only: orders and users (cannot modify products) |

Implementation: `users.role` column + `authorize('ADMIN')` middleware.

---

## MODULES v1

| Module | Scope |
|--------|-------|
| Auth | register, login, refresh, logout |
| Users | me, admin list |
| Products | public list/detail; admin CRUD |
| Orders | transactional checkout; list (me / admin) |

Out of scope: notifications, support tickets, chat, server-side cart, mobile.

> **Cart:** local state in Next.js (Context/Zustand); checkout sends `{ items: [{ productId, quantity }] }`.

---

## PART 1 — POSTGRESQL (SQL)

### 1.1 ERD (textual)

```
users ─────────────┬──────────── refresh_tokens
                   │
                   └──────────── orders ──── order_items ──── products
                                                   │
categories (optional) ─── products                │
                                                   │
users ─── addresses (optional v1)
```

### 1.2 Tables

**users**

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | `gen_random_uuid()` |
| email | VARCHAR UNIQUE | |
| password_hash | VARCHAR | bcrypt |
| name | VARCHAR | |
| role | user_role ENUM | ADMIN, CLIENT, SUPPORT |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | |

**refresh_tokens**

| Column | Type |
|--------|------|
| id | UUID PK |
| user_id | UUID FK → users |
| token_hash | VARCHAR |
| expires_at | TIMESTAMPTZ |
| revoked_at | TIMESTAMPTZ NULL |
| created_at | TIMESTAMPTZ |

**categories** (optional)

| id, name, slug UNIQUE |

**products**

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| category_id | UUID FK NULL | |
| name | VARCHAR | |
| slug | VARCHAR UNIQUE | |
| description | TEXT NULL | |
| price | NUMERIC(12,2) | never FLOAT |
| stock | INTEGER CHECK (>= 0) | |
| active | BOOLEAN DEFAULT true | |
| created_at, updated_at | TIMESTAMPTZ | |

**orders**

| Column | Type |
|--------|------|
| id | UUID PK |
| user_id | UUID FK → users |
| status | order_status ENUM |
| total | NUMERIC(12,2) |
| payment_status | payment_status ENUM |
| created_at, updated_at | TIMESTAMPTZ |

**order_items**

| Column | Type |
|--------|------|
| id | UUID PK |
| order_id | UUID FK → orders ON DELETE CASCADE |
| product_id | UUID FK → products ON DELETE RESTRICT |
| quantity | INTEGER CHECK (> 0) |
| unit_price | NUMERIC(12,2) |

**addresses** (optional v1)

| id, user_id FK, street, city, state, zip, is_default |

---

### 1.3 ENUMs

```sql
CREATE TYPE user_role AS ENUM ('ADMIN', 'CLIENT', 'SUPPORT');
CREATE TYPE order_status AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'SHIPPED');
CREATE TYPE payment_status AS ENUM ('PENDING', 'PAID', 'FAILED');
```

### 1.4 Modeling Decisions

- **Price snapshot** in `order_items.unit_price` — correct history if product price changes later.
- **NUMERIC for money**; in Node.js treat as string or integer cents — documented in README.
- **Soft delete**: prefer `products.active = false` instead of physical DELETE.
- **No permissions table** — role on the user is sufficient.
- **Duplicate productIds in the same order**: the service layer must merge or reject duplicates before inserting `order_items`; behavior must be consistent and tested.

### 1.5 Indexes

```sql
CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE UNIQUE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
```

### 1.6 Transaction Strategy (checkout)

Flow in a single `PoolClient`:

```
BEGIN
SELECT id, stock, price FROM products WHERE id = ANY($1) FOR UPDATE
Validate stock, check for duplicates, calculate total (service layer)
INSERT INTO orders ...
INSERT INTO order_items ... (with unit_price snapshot)
UPDATE products SET stock = stock - $qty WHERE id = $1
COMMIT — on error: ROLLBACK
```

> `FOR UPDATE` prevents two simultaneous checkouts from incorrectly draining the same stock.

### 1.7 Migrations

```
migrations/
  001_extensions_and_enums.sql
  002_tables.sql
  003_indexes.sql
```

Control table:

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename VARCHAR(255) PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`npm run db:migrate` applies pending files in order.

### 1.8 Seed

- 1 ADMIN user
- 2 CLIENT users
- 10 products, 2 categories
- Known dev password (documented only in local README, never committed)

### 1.9 Part 1 Deliverables

- [ ] `001–003` SQL files complete
- [ ] `seed.sql`
- [ ] `scripts/migrate.ts`
- [ ] README note: `numeric` types in `pg` and price conversion

---

## PART 2 — API (Fastify + SQL)

### 2.1 pool.ts and transaction

```ts
// db/pool.ts — Pool singleton
// db/transaction.ts
export async function withTransaction<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
```

### 2.2 Repository (only place with SQL)

Controllers and services must not contain SQL strings.

```ts
// orders.repository.ts — example
SELECT id, stock, price::text AS price
FROM products
WHERE id = ANY($1::uuid[])
FOR UPDATE;
```

### 2.3 REST Routes v1

```
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout

GET    /users/me
PATCH  /users/me
GET    /users                    [ADMIN]
GET    /users/:id                [ADMIN, SUPPORT]

GET    /products
GET    /products/:id
POST   /products                 [ADMIN]
PATCH  /products/:id             [ADMIN]
PATCH  /products/:id/deactivate  [ADMIN]   # active = false

POST   /orders                   [CLIENT]   # body: CreateOrderSchema
GET    /orders/me                [CLIENT]
GET    /orders/:id               [CLIENT owner | ADMIN | SUPPORT]
GET    /orders                   [ADMIN, SUPPORT]

GET    /health
```

### 2.4 Response Format

**Success:**
```json
{ "status": "success", "data": {} }
```

**Error:**
```json
{
  "status": "error",
  "code": "INSUFFICIENT_STOCK",
  "message": "Insufficient stock for product X",
  "errors": [{ "field": "items[0].quantity", "message": "..." }]
}
```

> Including a `code` field (e.g. `INSUFFICIENT_STOCK`, `PRODUCT_NOT_FOUND`, `DUPLICATE_PRODUCT_ID`) makes test assertions more stable than matching on `message` strings.

### 2.5 Middleware v1

- `authenticate` — Bearer JWT
- `authorize(...roles)`
- `validate(zodSchema)`
- `errorHandler` global
- CORS

Not included: rate limit, Redis, compression beyond basic.

### 2.6 packages/contracts

```ts
export const CreateOrderSchema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
  })).min(1),
});

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
```

> The API validates in middleware; the web uses the same schemas in forms.

### 2.7 Input Edge Cases for Checkout

The service layer (not just Zod) must explicitly handle and test these scenarios:

| Scenario | Expected Behavior | HTTP Code |
|----------|------------------|-----------|
| Empty items array | Rejected by Zod `min(1)` | 400 |
| `quantity: 0` | Rejected by Zod `positive()` | 400 |
| Product ID not found in DB | `AppError` with code `PRODUCT_NOT_FOUND` | 404 |
| Insufficient stock for one item | `AppError` with code `INSUFFICIENT_STOCK` | 409 |
| Insufficient stock for multiple items | All violations reported at once | 409 |
| Duplicate `productId` in same request | Service merges quantities OR rejects with `DUPLICATE_PRODUCT_ID` — pick one, document it, test it | 400 or merged |
| Valid request, stock exactly equal to requested quantity | Should succeed; stock reaches 0 | 201 |
| Two simultaneous checkouts draining same stock | `FOR UPDATE` lock ensures only one succeeds | 409 on loser |

### 2.8 Unit Tests (Jest) — Service Layer

Tests are written and **left commented** so you can study and uncomment them progressively.

```ts
// orders/orders.service.spec.ts

// import { OrderService } from './orders.service';
// import { OrderRepository } from './orders.repository';
// import { AppError } from '../../utils/errors';

// --- Mock setup ---
// const mockRepo = {
//   findProductsByIds: jest.fn(),
//   createOrder: jest.fn(),
//   createOrderItems: jest.fn(),
//   decrementStock: jest.fn(),
// } as unknown as OrderRepository;

// const service = new OrderService(mockRepo);

// beforeEach(() => jest.clearAllMocks());

// ─────────────────────────────────────────────
// describe('OrderService.createOrder', () => {

//   it('should throw PRODUCT_NOT_FOUND when a productId does not exist', async () => {
//     mockRepo.findProductsByIds.mockResolvedValue([]);  // DB returns nothing
//     await expect(
//       service.createOrder('user-id', [{ productId: 'uuid-1', quantity: 1 }])
//     ).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
//   });

//   it('should throw INSUFFICIENT_STOCK when requested quantity exceeds stock', async () => {
//     mockRepo.findProductsByIds.mockResolvedValue([
//       { id: 'uuid-1', stock: 2, price: '10.00' },
//     ]);
//     await expect(
//       service.createOrder('user-id', [{ productId: 'uuid-1', quantity: 5 }])
//     ).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });
//   });

//   it('should report all stock violations at once, not just the first', async () => {
//     mockRepo.findProductsByIds.mockResolvedValue([
//       { id: 'uuid-1', stock: 1, price: '10.00' },
//       { id: 'uuid-2', stock: 1, price: '20.00' },
//     ]);
//     const result = service.createOrder('user-id', [
//       { productId: 'uuid-1', quantity: 5 },
//       { productId: 'uuid-2', quantity: 5 },
//     ]);
//     await expect(result).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });
//     // Bonus: check that both productIds appear in the error details
//   });

//   it('should succeed when requested quantity equals available stock exactly', async () => {
//     mockRepo.findProductsByIds.mockResolvedValue([
//       { id: 'uuid-1', stock: 3, price: '10.00' },
//     ]);
//     mockRepo.createOrder.mockResolvedValue({ id: 'order-id' });
//     mockRepo.createOrderItems.mockResolvedValue(undefined);
//     mockRepo.decrementStock.mockResolvedValue(undefined);

//     const order = await service.createOrder('user-id', [
//       { productId: 'uuid-1', quantity: 3 },
//     ]);
//     expect(order).toHaveProperty('id', 'order-id');
//   });

//   it('should throw DUPLICATE_PRODUCT_ID when the same productId appears more than once', async () => {
//     // Remove this test if you choose to MERGE duplicates instead of rejecting them.
//     await expect(
//       service.createOrder('user-id', [
//         { productId: 'uuid-1', quantity: 1 },
//         { productId: 'uuid-1', quantity: 2 },
//       ])
//     ).rejects.toMatchObject({ code: 'DUPLICATE_PRODUCT_ID' });
//   });

//   it('should call repo methods in the correct order', async () => {
//     const findSpy = jest.spyOn(mockRepo, 'findProductsByIds');
//     const createSpy = jest.spyOn(mockRepo, 'createOrder');
//     // ... set up mocks that succeed, then:
//     // await service.createOrder(...);
//     // expect(findSpy).toHaveBeenCalledBefore(createSpy); // jest-extended
//   });

// });

// ─────────────────────────────────────────────
// describe('calculateOrderTotal (pure function)', () => {

//   it('should correctly calculate total from items and prices', () => {
//     // import { calculateOrderTotal } from './orders.utils';
//     // const items = [{ productId: 'uuid-1', quantity: 2 }];
//     // const prices = { 'uuid-1': '15.00' };
//     // expect(calculateOrderTotal(items, prices)).toBe('30.00');
//   });

//   it('should return zero for an empty items array', () => {
//     // expect(calculateOrderTotal([], {})).toBe('0.00');
//   });

// });

// ─────────────────────────────────────────────
// describe('AuthService', () => {

//   it('should throw INVALID_CREDENTIALS when password does not match', async () => {
//     // mockUserRepo.findByEmail.mockResolvedValue({
//     //   id: 'u1', password_hash: await bcrypt.hash('secret', 10)
//     // });
//     // await expect(authService.login('user@test.com', 'wrong'))
//     //   .rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
//   });

//   it('should throw INVALID_CREDENTIALS when user is not found', async () => {
//     // mockUserRepo.findByEmail.mockResolvedValue(null);
//     // await expect(authService.login('no@one.com', 'any'))
//     //   .rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
//   });

// });

// ─────────────────────────────────────────────
// describe('withTransaction rollback', () => {

//   it('should call ROLLBACK when the callback throws', async () => {
//     // const mockClient = {
//     //   query: jest.fn(),
//     //   release: jest.fn(),
//     // };
//     // const mockPool = { connect: jest.fn().mockResolvedValue(mockClient) } as any;

//     // await expect(
//     //   withTransaction(mockPool, async () => { throw new Error('fail'); })
//     // ).rejects.toThrow('fail');

//     // expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
//     // expect(mockClient.release).toHaveBeenCalled();
//   });

// });
```

### 2.9 Anti-patterns

- SQL in controller or service
- Prisma/Drizzle "just for migrations"
- Stock logic only on the front-end
- `float` for price
- God class `OrderService` with 500 lines — extract `calculateOrderTotal`, validations
- Asserting on `message` strings in tests — use `code` instead

### 2.10 Part 2 Deliverables

- [ ] 4 modules with routes/controller/service/repository
- [ ] `withTransaction` used in checkout
- [ ] ≥ 5 unit tests in services/domain (uncommented and passing)
- [ ] `GET /health`

---

## PART 3 — WEB (Decoupled Next.js)

### 3.1 Principles

- All communication via `lib/api-client.ts` → `NEXT_PUBLIC_API_URL`
- No Route Handlers for order/product business rules
- Cart stays local until `POST /orders`

### 3.2 Pages

| Route | Access |
|-------|--------|
| `/login`, `/register` | public |
| `/products`, `/products/[slug]` | public |
| `/cart`, `/checkout` | CLIENT |
| `/orders`, `/orders/[id]` | CLIENT |
| `/admin/products` | ADMIN |
| `/admin/orders` | ADMIN |
| `/dashboard` | authenticated (redirect by role) |

### 3.3 Structure

```
features/auth/
features/products/
features/cart/
features/orders/
features/admin/
components/ui/
lib/api-client.ts
hooks/useAuth.ts, useCart.ts
```

### 3.4 Auth on the Front-end (v1 simple)

- Access token in memory or `localStorage` (document the tradeoff)
- Refresh via `POST /auth/refresh`
- Next.js middleware: protect `/orders`, `/admin/*` routes

### 3.5 Web Tests (Jest)

`calculateCartTotal`, mappers, hooks with mocked API. No Playwright/Cypress in v1.

### 3.6 Part 3 Deliverables

- [ ] Full flow: login → products → cart → checkout → order list
- [ ] Admin products UI
- [ ] RBAC in the UI (hide admin sections from CLIENT)
- [ ] ≥ 2 unit tests (utils/hooks)

---

## ENVIRONMENT VARIABLES

**apps/api**
```
DATABASE_URL=postgresql://orderhub:orderhub@localhost:5432/orderhub
JWT_SECRET=
JWT_REFRESH_SECRET=
PORT=3001
ALLOWED_ORIGINS=http://localhost:3000
NODE_ENV=development
```

**apps/web**
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## IMPLEMENTATION ORDER

- [ ] 1. Monorepo + docker-compose (postgres) + packages/contracts
- [ ] 2. `migrations/*.sql` + migrate script + seed
- [ ] 3. `db/pool.ts` + `withTransaction` + errors + `app.ts` + `/health`
- [ ] 4. Auth module (SQL in `auth.repository`)
- [ ] 5. Products module
- [ ] 6. Orders module + transaction + unit tests
- [ ] 7. Users module
- [ ] 8. Web: api-client + auth
- [ ] 9. Web: products + cart + checkout + orders
- [ ] 10. Web: admin + final README

> One step per session/PR. Do not generate the entire project at once.

---

## DEFINITION OF DONE — v1

- [ ] API on :3001, web on :3000, no cross-imports api↔web
- [ ] Migrations apply cleanly on an empty database
- [ ] Register → login → products → checkout → view order
- [ ] Admin creates product and lists all orders
- [ ] Checkout fails with insufficient stock (409)
- [ ] Checkout fails with duplicate productId in request (400) — or merges, if documented
- [ ] Checkout fails when a productId does not exist (404)
- [ ] SQL only in repositories; transaction in checkout
- [ ] ≥ 5 unit tests (services/domain) passing
- [ ] No dependency from the PROHIBITED list
- [ ] README with commands and ASCII diagram

---

## SESSION PROMPT (paste at the start of each session)

```
Project OrderHub v1 — read the full planning document.
HARD RULES:
- Postgres + pg (Pool). SQL ONLY in repositories.
- PROHIBITED: Prisma, ORM, Mongo, Redis, WebSockets, jobs, microservices, GraphQL, NestJS, mobile, DI container.
- Wiring: new Service(new Repository(pool)).
- API: Fastify + Zod (packages/contracts) + JWT + RBAC.
- Web: Next.js separate, REST only, no business Route Handlers.
- Tests: Jest unit tests in services and pure functions only.
- Implement ONLY the current step.
Follow nodejs-backend-patterns (layers, errors, auth), ignoring Redis/Mongo/rate-limit from the skill.
```

---

## SUMMARY

| Topic | v1 Decision |
|-------|------------|
| Database | PostgreSQL |
| Access | Raw SQL via `pg` |
| API | Fastify, modular monolith |
| Front-end | Next.js, HTTP client only |
| Auth | JWT + refresh token in table |
| RBAC | Enum role |
| Modules | auth, users, products, orders |
| Tests | Jest unit (services) |
| Infra | Docker: Postgres only |
