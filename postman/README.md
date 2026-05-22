# Postman — OrderHub API

Import these files into Postman (or Bruno, which also accepts Postman v2.1 collections):

| File | Purpose |
|------|---------|
| `OrderHub.postman_collection.json` | All API requests |
| `OrderHub.local.postman_environment.json` | `baseUrl`, seed credentials, token variables |

## Quick start

1. Start the stack (`npm run db:up`, migrate, seed, `npm run dev -w @orderhub/api`).
2. In Postman: **Import** → select both JSON files.
3. Select the **OrderHub — Local** environment.
4. Run **Auth → Login (Client)** (or Admin) — the test script saves `accessToken` and `refreshToken`.
5. Run **Products → List products** to populate `productId`, then **Orders → Create order**.

Dev seed password for all users: `password123` (see root `README.md`).
