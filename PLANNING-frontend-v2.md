# OrderHub — Front-end v2 Plan

Companion to [PLANNING-v1.md](./PLANNING-v1.md). Takes the front-end from
"skeleton that works" to "polished and idiomatic." One phase per session,
same cadence as v1.

---

## Current state — honest read

**What works:**

- End-to-end flow: register → login → products → cart → checkout → order
- Admin: create + deactivate products, list all orders
- Zustand for cart + auth, localStorage for tokens
- 7 unit tests on `calculateCartTotal` and `tokenStorage`

**What's rough:**

- Every page hand-codes `useState<T | null>(null)` + `useEffect` + `error` +
  `"Loading…"` — no data-fetching abstraction
- Forms are vanilla `useState` with a single `error` string per form
- No reusable `Button`, `Input`, `Card`, `Alert` primitives — Tailwind
  classes are copy-pasted
- `AuthGuard` flickers `"Checking access…"` on every protected page
- No automatic token refresh; a stale access token just 401s the page
- `Cache-Control: no-store` is set server-side but the web doesn't take
  advantage of it
- Admin products page doesn't show inactive products; no Activate button; no
  pagination UI on orders

---

## Phased plan

One phase per session. Run `npm run typecheck -w @orderhub/web` +
`npm test -w @orderhub/web` + a manual click-through after each phase.

### Phase 1 — Wire the unused back-end features

Smallest, most concrete starting point. Back-end is already shipped; just
expose it.

- [ ] Admin products page: switch to `api.products.list({ includeInactive: true })`,
      show an "Active" badge, render an **Activate** button for inactive rows
      that calls `api.products.activate(id)`
- [ ] Orders pages (`/orders` and `/admin/orders`): add Prev/Next controls
      driven by `pagination.offset`
- [ ] Add a small `formatMoney` helper
      (`Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })`)
      and use it everywhere prices render — drop the raw `${p.price}` template
      literal

**Learning goal:** consume an API surface end-to-end, including pagination
shapes.

---

### Phase 2 — Data-fetching abstraction (TanStack Query)

Replace every `useState`/`useEffect`/`.catch()` block with a hook. Pick one
library and commit.

- [ ] Install **TanStack Query** (recommended over SWR for typed mutations +
      invalidation)
- [ ] Wrap the app in `<QueryClientProvider>` in `layout.tsx`
- [ ] Replace `products/page.tsx` loader with
      `useQuery({ queryKey: ['products', ...], queryFn: api.products.list })`
- [ ] Same for `products/[slug]`, `orders`, `orders/[id]`, `admin/products`,
      `admin/orders`
- [ ] Convert mutating actions (place order, create product, deactivate,
      activate) to `useMutation` with `invalidateQueries` for refetch

**Learning goal:** the standard React data-fetching pattern. After this,
"load product list" is one line, not 20.

---

### Phase 3 — Form abstraction (react-hook-form + Zod)

- [ ] Install `react-hook-form` + `@hookform/resolvers`
- [ ] Refactor `/login`, `/register`, admin "New product" form to
      `useForm({ resolver: zodResolver(LoginSchema) })`
- [ ] Surface server-returned `fieldErrors` per-field instead of one global
      error string. The back-end already returns
      `errors: [{ field, message }]` — wire those to the matching form fields
- [ ] Add a reusable `<FormField>` component that takes a label + RHF
      `register` props

**Learning goal:** stop reimplementing form validation; show the server's
structured errors on the actual fields.

---

### Phase 4 — UI primitives + design polish

- [ ] Extract `<Button variant="primary|secondary|destructive">`, `<Input>`,
      `<Card>`, `<Alert>` to `components/ui/`
- [ ] Pick a typography scale and apply consistently (`text-sm` / `text-base`
      / `text-lg` / `text-2xl` only)
- [ ] Decide on a single accent color and use it for all interactive elements
- [ ] Replace every `<Link>` that looks like a button with a styled link
      variant
- [ ] Add `focus-visible` rings to all interactive elements (a11y win)

**Learning goal:** stop copy-pasting Tailwind class strings. The right
abstraction is a small component, not a CSS class utility.

---

### Phase 5 — Robust auth: token refresh + error boundaries

- [ ] In `api-client`, intercept 401 responses: call `/auth/refresh` with the
      stored refresh token, retry the original request once, fail if refresh
      fails
- [ ] Add an `<ErrorBoundary>` at the root layout that catches React render
      errors and shows a useful fallback (with a "Reload" button)
- [ ] AuthGuard: render children immediately if a cached `user` exists, only
      show `"Checking…"` on first init — fixes the flicker

**Learning goal:** the patterns that make an SPA feel reliable instead of
fragile.

---

### Phase 6 — Tests + accessibility

- [ ] Add `@testing-library/react` + `jest-environment-jsdom` to `apps/web`
- [ ] Write component tests for `LoginForm`, `Cart`, `AuthGuard`
      (mock the api-client with `jest.mock` or MSW)
- [ ] Run an accessibility pass: keyboard navigation, semantic landmarks
      (`<main>`, `<nav>`, `<header>`), focus order, ARIA labels on icon-only
      buttons
- [ ] Mobile audit: nav collapses, cart fits viewport, form inputs sized for
      thumbs

**Learning goal:** test the parts that change behaviour (components, hooks),
not the parts that are display-only.

---

## Out of scope (by design)

These tempt scope creep — skip in v2:

- **Server-side rendering of product pages** — the API is decoupled, the
  current "client-side fetch" is fine for a learning project. SSR with App
  Router has its own complexity worth tackling separately.
- **A real design system** (shadcn/ui, Radix) — useful, but Phase 4's small
  primitives are sufficient until you feel friction.
- **Internationalization / RTL**
- **Real image hosting; product images**
- **Performance optimization** (you'd profile first, then optimize specific
  findings)

---

## How to run it

- One phase per session.
- Open each session with: "let's do Phase N from the front-end plan."
- After each phase:
  - `npm run typecheck -w @orderhub/web`
  - `npm test -w @orderhub/web`
  - Manual click-through of the affected flow
- Phase 1 is intentionally tiny to build momentum — start there.

---

## Session prompt (paste at start of each phase)

```
Front-end v2 — read PLANNING-frontend-v2.md, work ONLY on Phase N.
Stack: Next.js 15 App Router + TypeScript + Tailwind + Zustand
       (+ TanStack Query from Phase 2, + react-hook-form from Phase 3).
Same hard rules as v1: no business logic in Next.js Route Handlers,
imports from @orderhub/contracts only (never from apps/api).
Verify: npm run typecheck -w @orderhub/web + npm test -w @orderhub/web
        + click-through the affected flow.
```
