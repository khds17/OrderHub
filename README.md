# OrderHub

A small learning project: an independent REST API on Fastify + raw SQL against
Postgres, with a separate Next.js storefront talking to it over HTTP. No ORM,
no Redis, no queues, no microservices. See [PLANNING-v1.md](./PLANNING-v1.md)
for the original scope and [PLANNING-frontend-v2.md](./PLANNING-frontend-v2.md)
for the storefront expansion.

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│   Browser                                                                  │
│      │                                                                     │
│      │  HTTP + JSON   ·   multipart/form-data (image upload)               │
│      ▼                                                                     │
│   ┌─────────────────────┐       ┌──────────────────────────────────────┐   │
│   │  apps/web           │       │  apps/api                            │   │
│   │  Next.js 15         │       │  Fastify + Zod + JWT                 │   │
│   │  App Router         │       │                                      │   │
│   │  Tailwind           │  ───► │  routes → controller → service →     │   │
│   │  Zustand (cart/auth)│       │  repository (only place w/ SQL)      │   │
│   │  TanStack Query     │       │                                      │   │
│   │  react-hook-form    │       │  middleware: validate, authenticate, │   │
│   │  + Zod resolver     │       │  authorize, error-handler            │   │
│   │  lib/api-client.ts  │       │                                      │   │
│   │  + tokens in LS     │       │  @fastify/static → /uploads/*        │   │
│   └─────────────────────┘       │  @fastify/multipart (image upload)   │   │
│                                 └──────────────────────────────────────┘   │
│                                              │                             │
│                                              │  pg.Pool (raw SQL)          │
│                                              ▼                             │
│                                 ┌──────────────────────────────────┐       │
│                                 │  Postgres 16  (docker compose)   │       │
│                                 │  schema_migrations + ENUMs +     │       │
│                                 │  users, refresh_tokens,          │       │
│                                 │  categories, products,           │       │
│                                 │  orders, order_items,            │       │
│                                 │  payment_methods, product_images │       │
│                                 └──────────────────────────────────┘       │
│                                              │                             │
│                                              ▼                             │
│                                 apps/api/uploads/  (gitignored,            │
│                                 product image bytes on disk)               │
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
│   ├── api/                       Fastify API
│   │   ├── src/
│   │   │   ├── config/            env loader (Zod-validated)
│   │   │   ├── db/                pool + withTransaction
│   │   │   ├── middleware/        auth, validate, error-handler
│   │   │   ├── modules/
│   │   │   │   ├── auth/          register, login, refresh, logout,
│   │   │   │   │                  change-password
│   │   │   │   ├── users/         /users/me, /users/:id
│   │   │   │   ├── products/      list (q + paginated 12/page), CRUD
│   │   │   │   ├── product-images/  upload, delete, batch hydrate
│   │   │   │   ├── orders/        create, cancel, pay (mock card)
│   │   │   │   └── payment-methods/ saved fake card per user
│   │   │   └── utils/             AppError + subclasses
│   │   ├── migrations/            versioned *.sql (001..005)
│   │   ├── seeds/                 dev seed
│   │   ├── scripts/               migrate.ts, seed.ts
│   │   └── uploads/               (gitignored) product image bytes
│   └── web/                       Next.js storefront
│       └── src/
│           ├── app/               App Router pages
│           │   ├── (auth)         login, register (consume ?next=)
│           │   ├── cart           cart with remove-toast
│           │   ├── checkout       card form + mock processor
│           │   ├── products       12/page list + search
│           │   ├── products/[slug] detail with images
│           │   ├── orders         my-orders list + detail (cancel)
│           │   ├── profile        name/surname/address/card/password
│           │   └── admin/products list, create, edit, photo upload
│           ├── components/        Nav, AuthGuard, UI primitives
│           ├── features/
│           │   ├── auth/          Zustand store
│           │   ├── cart/          Zustand store + pendingAdd + total
│           │   └── catalog/       useCatalogParams, PaginationControls
│           ├── hooks/             TanStack Query hooks, useDebouncedValue
│           └── lib/               api-client, token-storage, image-url,
│                                  safe-next, format-money
├── packages/
│   └── contracts/                 Zod schemas + inferred TS types
│       └── src/
│           ├── auth.ts            register/login/refresh + change-password
│           ├── users.ts           User, UpdateUser, ChangePassword
│           ├── products.ts        Product, ProductImage, ListQuery
│           ├── orders.ts          Order, Card, PayOrder, TEST_CARDS
│           └── payment-methods.ts saved card schemas
└── docker-compose.yml             Postgres 16 only
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

Uploaded product images are written to `apps/api/uploads/` at runtime and
served from `http://localhost:3001/uploads/...`. The directory is created on
first upload and gitignored.

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
| `npm run typecheck -w @orderhub/api` | `tsc --noEmit` on the API                          |
| `npm test -w @orderhub/api`          | Jest unit tests on API services + pure functions   |
| `npm test -w @orderhub/web`          | Jest unit tests on cart, helpers, hooks            |
| `npm run dev -w @orderhub/api`       | Start API on :3001 with hot reload                 |
| `npm run dev -w @orderhub/web`       | Start Next.js on :3000                             |

Postman: import `postman/OrderHub.postman_collection.json` and
`postman/OrderHub.local.postman_environment.json` (see [postman/README.md](./postman/README.md)).

## Features

### Catalog
- 12-products-per-page pagination with case-insensitive name + description
  search. LIKE meta-chars (`%`, `_`, `\`) in user input are escaped.
- URL-synced state (`?q=&offset=`) so reload + back/forward restore the view.
- Product detail shows a primary image + gallery thumbnails.

### Cart + checkout
- Guest "Add to cart" → redirect to `/login?next=/cart`; on login, the
  pending item is consumed and the user lands on `/cart` with it added.
- `?next=` is sanitised (`safeNextPath`) to block open-redirect.
- Cart-count badge in the nav (sum of quantities, hydration-safe).
- Remove from cart shows a 4 s "«name» removed from cart." toast.
- Checkout collects a **fake card** and calls `POST /orders/:id/pay`.
  - PAN `4000000000000002` always declines (Stripe-style test card).
  - On decline the order keeps `status=PENDING`, `payment_status=FAILED`;
    the page remembers the order id so retries don't re-create it.
  - On success: order `CONFIRMED`, payment `PAID`, cart cleared, redirect to
    `/orders/:id`.

### Orders
- Customer can cancel `PENDING`/`CONFIRMED` orders — stock is restored for
  every line item inside the same transaction. `SHIPPED` and already
  `CANCELLED` are rejected with 409.
- Admin / support can cancel any cancellable order; clients only their own
  (mismatch hides existence as 404).

### Profile
- `/profile` lets users manage name, surname, address.
- Saved fake card stored as `{ holder, last4, expiry }` — never PAN or CVV.
  Single card per user (`UNIQUE(user_id)`), upserted via `ON CONFLICT`.
- Change password verifies current via `bcrypt.compare`, hashes the new
  password, and **revokes every active refresh token for the user** so any
  session that knew the old credential is killed.

### Admin
- Same 12/page paginated + searchable catalog as the user list, with
  `includeInactive=true`.
- Create, Edit, Activate / Deactivate.
- Photo upload via multipart (`POST /products/:id/images`) with size + MIME
  limits enforced at both the plugin and service layers. Images sit on disk
  under `apps/api/uploads/products/<productId>/<uuid>.<ext>` and are served
  by `@fastify/static` at `/uploads/...`. The DB stores the relative path
  only — swapping to S3 later means changing the storage util, not the
  schema.

## Notable choices

- **No ORM.** All SQL lives in `*.repository.ts` files. Services orchestrate;
  controllers only marshal HTTP.
- **`pg` `NUMERIC` columns return strings**, not JS numbers — `MoneyString`
  in `@orderhub/contracts` and `moneyToCents` / `centsToMoney` helpers
  preserve cent-precision arithmetic without float drift.
- **Postgres enums need explicit casts in `pg` parameters.** The driver sends
  parameters as text and Postgres won't implicitly coerce to enum on
  insert/update. Every INSERT/UPDATE that touches `user_role`,
  `order_status`, or `payment_status` casts the parameter
  (e.g. `$4::user_role`, `'CANCELLED'::order_status`).
- **Checkout creates the order in one transaction.** `SELECT ... FOR UPDATE`
  locks the products row-by-row before stock validation, price snapshot,
  order insert, item insert, and stock decrement. On any failure the entire
  flow rolls back.
- **Cancel and pay also run in transactions** that lock the order row.
  Decline writes commit before the 402 is thrown (the tx returns a
  discriminator and the throw happens *outside*) so the `payment_status =
  FAILED` row reflects the attempt and the customer can retry.
- **List + count in parallel.** Paginated endpoints kick off the page query
  and the `count(*)` query at the same tick; they share a `buildListWhere`
  helper so the totals match the filter applied to the page.
- **Refresh tokens are opaque random bytes hashed with sha256** in the
  `refresh_tokens` table, not signed JWTs — so we can revoke without
  keeping a denylist. Password change → bulk revoke for that user.
- **Tokens live in `localStorage`** on the web side. Documented tradeoff:
  XSS exposure. A production deployment would use HttpOnly cookies + CSRF.
- **Image uploads stay off the DB.** `product_images` stores `(product_id,
  file_path)`; bytes go to disk. Service has an injectable `Disk` interface
  so tests run without touching the real filesystem.
- **Manual DI**: each `app.ts` instantiates repos → services → controllers
  in one block. No container.

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
`message`. Common codes:

| Code                          | HTTP | When                                              |
| ----------------------------- | ---- | ------------------------------------------------- |
| `DUPLICATE_PRODUCT_ID`        | 400  | Same product listed twice in a create-order body  |
| `INSUFFICIENT_STOCK`          | 409  | Requested quantity exceeds available              |
| `PRODUCT_NOT_FOUND`           | 404  | Unknown productId at checkout / GET               |
| `ORDER_NOT_FOUND`             | 404  | Unknown order id, or non-owner CLIENT             |
| `ORDER_NOT_CANCELLABLE`       | 409  | Cancel attempted on `SHIPPED`                     |
| `ORDER_ALREADY_CANCELLED`     | 409  | Cancel attempted twice                            |
| `ORDER_ALREADY_PAID`          | 409  | Pay attempted on a `PAID` order                   |
| `ORDER_NOT_PAYABLE`           | 409  | Pay attempted on a non-`PENDING` order            |
| `PAYMENT_DECLINED`            | 402  | Mock processor declined (magic PAN)               |
| `INVALID_CURRENT_PASSWORD`    | 401  | Wrong current password on change-password         |
| `UNSUPPORTED_IMAGE_TYPE`      | 415  | Image upload with non-image/* MIME                |
| `IMAGE_TOO_LARGE`             | 413  | Image upload over 5 MB                            |

## Tests

`npm test -w @orderhub/api` runs **87** unit tests across services and pure
functions: register/login/refresh/logout/change-password, orders
create/cancel/pay, products list/count, payment-methods,
product-images upload/delete.

`npm test -w @orderhub/web` runs **24** unit tests on the cart store
(including the `pendingAdd` lifecycle), cart total, token storage,
`safeNextPath` open-redirect block, and UI primitives.
