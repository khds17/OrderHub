# OrderHub API

## Money / `numeric` types

Columns of type `NUMERIC(12, 2)` (e.g. `products.price`, `orders.total`,
`order_items.unit_price`) arrive from the `pg` driver as **strings**, not JS
numbers — that's the default and it's the right default, because JS `number`
is IEEE-754 float and loses precision around money.

The Zod schemas in `@orderhub/contracts` reflect this: see `MoneyString` /
`price: z.string().regex(...)`. Never `parseFloat` a price for arithmetic;
convert to integer cents or use a decimal library.

## Local database commands

From the repo root:

```bash
npm run db:up                        # start Postgres (docker compose)
npm run db:migrate -w @orderhub/api  # apply pending migrations
npm run db:seed    -w @orderhub/api  # load dev seed data
```

The migrate runner tracks applied files in a `schema_migrations` table and
runs each new file in its own `BEGIN`/`COMMIT` transaction. A failing migration
is rolled back and the runner exits non-zero.

## Dev credentials (seed)

All seeded users use the password `password123`. This is local-only; the
seed file (`seeds/seed.sql`) is not safe for any shared environment.
