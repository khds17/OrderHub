# OrderHub v1

A small learning project: an independent REST API on Fastify + raw SQL against
Postgres, with a separate Next.js storefront talking to it over HTTP. No ORM,
no Redis, no queues, no microservices. See [PLANNING-v1.md](./PLANNING-v1.md)
for the full scope.

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│   Browser                                                                  │
│      │                                                                     │
│      │  HTTP + JSON                                                        │
│      ▼                                                                     │
│   ┌─────────────────────┐       ┌──────────────────────────────────────┐   │
│   │  apps/web           │       │  apps/api                            │   │
│   │  Next.js 15         │       │  Fastify + Zod + JWT                 │   │
│   │  App Router         │       │                                      │   │
│   │  Tailwind           │  ───► │  routes → controller → service →     │   │
│   │  Zustand (cart)     │       │  repository (only place w/ SQL)      │   │
│   │                     │       │                                      │   │
│   │  lib/api-client.ts  │       │  middleware: validate, authenticate, │   │
│   │  + tokens in LS     │       │  authorize, error-handler            │   │
│   └─────────────────────┘       └──────────────────────────────────────┘   │
│                                              │                             │
│                                              │  pg.Pool (raw SQL)          │
│                                              ▼                             │
│                                 ┌──────────────────────────────────┐       │
│                                 │  Postgres 16  (docker compose)   │       │
│                                 │  schema_migrations + ENUMs +     │       │
│                                 │  users, refresh_tokens,          │       │
│                                 │  categories, products,           │       │
│                                 │  orders, order_items             │       │
│                                 └──────────────────────────────────┘       │
│                                                                            │
│   packages/contracts  (Zod schemas + inferred types)                       │
│       ▲                          ▲                                         │
│       │  imports                 │  imports                                │
│       │                          │                                         │
│   apps/web                  apps/api                                       │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

## Repository layout

```
orderhub/
├── apps/
│   ├── api/                 Fastify API
│   │   ├── src/
│   │   │   ├── config/      env loader (Zod-validated)
│   │   │   ├── db/          pool + withTransaction
│   │   │   ├── middleware/  auth, validate, error-handler
│   │   │   ├── modules/     auth, users, products, orders
│   │   │   └── utils/       AppError + subclasses
│   │   ├── migrations/      versioned *.sql
│   │   ├── seeds/           dev seed
│   │   └── scripts/         migrate.ts, seed.ts
│   └── web/                 Next.js storefront
│       └── src/
│           ├── app/         App Router pages
│           ├── components/  Nav, AuthGuard
│           ├── features/    auth, cart
│           └── lib/         api-client, token-storage
├── packages/
│   └── contracts/           Zod schemas + inferred TS types
└── docker-compose.yml       Postgres 16 only
```

## Quick start

Prerequisites: Node 22+, npm 10+, Docker.

```bash
# 1. install
npm install

# 2. env files
cp .env.example .env                 # postgres creds for docker-compose
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# 3. start Postgres
npm run db:up

# 4. migrate + seed
npm run db:migrate
npm run db:seed

# 5. run both apps (separate terminals)
npm run dev -w @orderhub/api      # http://localhost:3001
npm run dev -w @orderhub/web      # http://localhost:3000
```

Dev seed credentials (local only):

| Email                    | Password      | Role   |
| ------------------------ | ------------- | ------ |
| `admin@orderhub.dev`     | `password123` | ADMIN  |
| `alice@orderhub.dev`     | `password123` | CLIENT |
| `bob@orderhub.dev`       | `password123` | CLIENT |

## Useful scripts

From the repo root:

| Command                              | What it does                                       |
| ------------------------------------ | -------------------------------------------------- |
| `npm run db:up` / `npm run db:down`  | Start / stop the Postgres container                |
| `npm run db:migrate`                 | Apply pending SQL migrations                       |
| `npm run db:seed`                    | Truncate and reseed dev data                       |
| `npm run typecheck`                  | `tsc --noEmit` on `apps/api`                       |
| `npm test -w @orderhub/api`          | Jest unit tests on API services + pure functions   |
| `npm test -w @orderhub/web`          | Jest unit tests on cart total + token storage      |
| `npm run dev -w @orderhub/api`       | Start API on :3001 with hot reload                 |
| `npm run dev -w @orderhub/web`       | Start Next.js on :3000                             |

Postman: import `postman/OrderHub.postman_collection.json` and
`postman/OrderHub.local.postman_environment.json` (see [postman/README.md](./postman/README.md)).

## Notable choices

- **No ORM.** All SQL lives in `*.repository.ts` files. Services orchestrate;
  controllers only marshal HTTP.
- **`pg` `NUMERIC` columns return strings**, not JS numbers — `MoneyString`
  in `@orderhub/contracts` and `moneyToCents` / `centsToMoney` helpers preserve
  cent-precision in arithmetic without float drift.
- **Checkout is one transaction.** `SELECT ... FOR UPDATE` locks the products
  row-by-row before stock validation, price snapshot, order insert, item
  insert, and stock decrement. On any failure the entire flow rolls back.
- **Refresh tokens are opaque random bytes hashed with sha256** in the
  `refresh_tokens` table, not signed JWTs — so we can revoke without keeping
  a denylist.
- **Tokens live in `localStorage`** on the web side. Documented tradeoff:
  XSS exposure. A production deployment would use HttpOnly cookies + CSRF.
- **Manual DI**: each `app.ts` instantiates repos → services → controllers in
  one block. No container.

## Response envelopes

Success:

```json
{ "status": "success", "data": { "order": { ... } } }
```

Error:

```json
{
  "status": "error",
  "code": "INSUFFICIENT_STOCK",
  "message": "Insufficient stock for one or more products",
  "errors": [
    { "field": "items.<productId>", "message": "requested 5, available 1" }
  ]
}
```

The `code` field is the stable identifier — match on it in tests, not on
`message`.

## Definition of Done — v1

- [x] API on :3001, web on :3000, no cross-imports api↔web
- [x] Migrations apply cleanly on an empty database
- [x] Register → login → products → checkout → view order
- [x] Admin creates product and lists all orders
- [x] Checkout fails with insufficient stock (409 `INSUFFICIENT_STOCK`)
- [x] Checkout fails with duplicate productId in request (400
      `DUPLICATE_PRODUCT_ID`)
- [x] Checkout fails when a productId does not exist (404 `PRODUCT_NOT_FOUND`)
- [x] SQL only in repositories; transaction in checkout
- [x] ≥ 5 unit tests in services / pure functions (currently **36** on the API,
      **7** on the web)
- [x] No dependency from the planning doc's PROHIBITED list
- [x] README with commands and ASCII diagram
