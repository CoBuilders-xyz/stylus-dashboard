# Contributing to Stylus Dashboard

Thank you for contributing! This is a collaborative project built by the Stylus Fellowship cohort. This guide will help you get started.

## Architecture Overview

This is a monorepo with three main workspaces:

| Package            | Role                                                                |
| ------------------ | ------------------------------------------------------------------- |
| `apps/web`         | Next.js 15 App Router dashboard (UI)                                |
| `packages/indexer` | Envio HyperIndex v3 — indexes ArbWasm events into PostgreSQL/Hasura |
| `scripts/`         | Seed script for local testing (deploys EVM + Stylus contracts)      |

**Data flow:**

```
ArbWasm/ArbWasmCache (on-chain) → Envio Indexer → PostgreSQL → Hasura GraphQL → Next.js
```

The frontend **MUST NEVER** call the RPC directly. All data comes from our GraphQL API.

### Rendering Strategy

We use a **hybrid SSR/CSR pattern**:

- **Server Components** for the layout shell, navigation, and static pages (default)
- **Client Components** (`'use client'`) only for interactive parts that need real-time updates or browser APIs

For data-heavy pages, the ideal pattern is:

```tsx
// page.tsx — Server Component, does the initial fetch
export default async function Page() {
  const initialData = await fetchFromGraphQL();
  return <ClientDashboard initialData={initialData} />;
}

// client-dashboard.tsx — Client Component, handles live updates
('use client');
export function ClientDashboard({ initialData }) {
  const { data } = useQuery({
    queryKey: ['stats'],
    queryFn: () => graphqlClient.request(QUERY),
    initialData,
    refetchInterval: 30_000,
  });
  // ...
}
```

This gives us SSR for the first paint (SEO, LCP) plus client-side polling for real-time data.

### Data Model

All data feeds into a **unified schema** via Hasura. Whether data comes from the Stylus indexer or a future EVM tracker, it lives in the same PostgreSQL database and is queryable through the same GraphQL endpoint. This lets us cross-reference Stylus and EVM data without stitching APIs client-side.

Key entities today:

- `StylusContract` — activated Stylus programs (address, deployer, codehash, expiry)
- `DailyStats` — aggregated daily metrics (activations, deployers, cache events)
- `LifetimeExtension` — keepalive events
- `CacheEvent` — ArbWasmCache updates

## Development Workflow

### 1. Pick an Issue

All work is tracked in `ISSUES.md` (and will be mirrored to GitHub Issues). Issues are ordered chronologically — pick the next available one in your area that isn't blocked.

**Labels by area:**

- `indexer` — Envio handlers, schema, data logic
- `frontend` — Next.js pages, components, charts
- `infra` — CI/CD, Docker, deployment
- `docs` — Documentation and ADRs

### 2. Create a Branch

```bash
git checkout main
git pull origin main
git checkout -b feat/your-feature-name
```

**Branch naming conventions:**

- `feat/description` — New feature
- `fix/description` — Bug fix
- `refactor/description` — Code refactoring
- `docs/description` — Documentation
- `chore/description` — Tooling, CI, dependencies

### 3. Make Your Changes

```bash
# Start local dev environment (indexer manages its own Postgres + Hasura)
cd packages/indexer && pnpm dev

# In another terminal, start the frontend
cd apps/web && pnpm dev

# To seed the testnode with activity (requires nitro-testnode running)
pnpm seed
```

### 4. Verify Your Work

Before pushing, ensure:

```bash
pnpm lint        # Code passes linting
pnpm typecheck   # Types are correct
pnpm test        # Tests pass
pnpm build       # Project builds
```

CI runs all four automatically on every PR.

### 5. Submit a Pull Request

Push your branch and open a PR against `main`:

```bash
git push -u origin feat/your-feature-name
```

In your PR description, include:

- **What** — Brief description of the change
- **Why** — Link to the issue it addresses
- **How to test** — Steps to verify the change works

## Code Guidelines

### TypeScript

- Use strict mode (already configured)
- Prefer explicit types over `any`
- Use interfaces for object shapes

### Components

- One component per file
- Use Server Components by default (no `'use client'` unless the component needs interactivity, hooks, or browser APIs)
- Keep components small and focused
- Charts and interactive tables are Client Components — that's expected

### Styling

- Use Tailwind CSS utility classes
- Use the pre-built components in `src/components/ui/`
- Follow the existing color scheme (CSS variables in `globals.css`)

### File Organization

| What                   | Where                             |
| ---------------------- | --------------------------------- |
| Pages/routes           | `apps/web/src/app/`               |
| Reusable UI primitives | `apps/web/src/components/ui/`     |
| Chart components       | `apps/web/src/components/charts/` |
| GraphQL queries        | `apps/web/src/lib/graphql/`       |
| Indexer event handlers | `packages/indexer/src/handlers/`  |
| Indexer helpers/utils  | `packages/indexer/src/helpers/`   |
| Indexer entity schema  | `packages/indexer/schema.graphql` |
| Seed/test scripts      | `scripts/`                        |

### Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add daily activations chart to overview page
fix: correct expiry calculation for reactivated contracts
docs: add HyperSync setup instructions
chore: update eslint config
test: add integration tests for ProgramActivated handler
```

## Working with the Indexer

### Adding a New Entity

1. Define the entity in `packages/indexer/schema.graphql`
2. Run `pnpm codegen` to regenerate types
3. Add the event handler in `packages/indexer/src/handlers/`
4. Write a test in `packages/indexer/test/`

### Adding New Events to Index

1. Add the event signature to `config.yaml` (and the local/mainnet variants)
2. Add or update the ABI in `packages/indexer/abis/`
3. Run `pnpm codegen`
4. Implement the handler

### Envio Codegen (automatic)

The indexer requires `envio codegen` to generate type definitions from `config.yaml` and `schema.graphql`. This runs automatically:
- On `pnpm install` (via postinstall hook)
- On `pnpm typecheck` (runs codegen first, then tsc)
- On `envio dev` (live-reloads types on schema changes)

If your IDE shows type errors in handler files after a fresh clone, run `pnpm install` in the indexer package — it will regenerate `.envio/types.d.ts`.

### Querying Data in the Frontend

1. Write the GraphQL query in `apps/web/src/lib/graphql/queries.ts`
2. Use TanStack Query to fetch in your component (or server-side `fetch` for SSR)
3. Pass data to the appropriate chart/table component

## Running the Testnode

For integration testing, you need a Nitro devnode:

```bash
docker run -d --name nitro-devnode \
  -p 8547:8547 -p 8548:8548 \
  offchainlabs/nitro-node:latest \
  --node.dangerous.no-l1-listener \
  --init.dev-init \
  --init.dev-init-address "0x3f1Eae7D46d88F08fc2F8ed27FCb2AB183EB2d0E" \
  --node.sequencer \
  --node.dangerous.no-sequencer-coordinator \
  --node.staker.enable=false \
  --http.addr 0.0.0.0 \
  --http.api eth,net,web3,arb,debug
```

The devnode includes ArbWasm (0x71) and ArbWasmCache (0x72) precompiles. To seed it with activity, run `pnpm seed` (requires `cargo-stylus` for Stylus deployments, or runs EVM-only mode without it).

## Getting Help

- Open an issue with the `question` label
- Tag maintainers in PR comments for reviews
- Check existing issues before creating new ones
