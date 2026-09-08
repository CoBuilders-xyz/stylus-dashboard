# Stylus Ecosystem Dashboard

A public, open-source dashboard for **observed Stylus activation and deployment indicators on Arbitrum One**.

**[Open the dashboard](https://stylus-dashboard.up.railway.app)** · **[Usage guide](docs/usage.md)** · **[Ecosystem report](docs/reports/2026-09-08/README.md)** · **[Documentation package](docs/README.md)**

![Stylus adoption overview](docs/images/overview.png)

## What it shows

| Section                  | Available metrics                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Overview                 | Observed Stylus contract addresses, unique activating wallets, recent activations/reactivations and daily activity |
| Contracts                | Paginated address table with status, deployer and activation-date filters; sorting and explorer links              |
| Builders                 | First-time and repeat activating wallets, returning-wallet ratio, growth and top deployers                         |
| Health                   | Estimated activation expiry, expiry histogram and reactivation/keepalive rate                                      |
| Stylus vs Solidity (EVM) | Relative observed contract counts, creation/activation series, deployment share and wallet overlap                 |

**Interpretation matters:** Stylus discovery follows activation events and can miss addresses reusing activated code. Builders are wallet addresses. Active status estimates expiry, not contract usage. EVM includes every source language. Read the [methodology](docs/methodology.md) before drawing adoption conclusions.

The [8 September 2026 report](docs/reports/2026-09-08/README.md) includes a frozen public-data snapshot, reproducible queries, findings and limitations. The [release record](docs/release.md) distinguishes prepared deliverables from production/publication steps still pending.

## Architecture

```text
Arbitrum One events + HyperSync creation traces
                    ↓
             Envio HyperIndex
                    ↓
                PostgreSQL
                    ↓
             Hasura GraphQL
                    ↓
          Next.js server + browser
```

The frontend reads GraphQL only. The indexer observes `ArbWasm` (`0x71`) activation/keepalive events, `ArbWasmCache` (`0x72`) cache events and EVM creation traces. Mainnet indexing starts at block 249,710,000. See [architecture](docs/architecture.md) for entities, windows, persistence and design decisions.

Stack: pnpm workspaces, TypeScript, Envio HyperIndex v3, PostgreSQL, Hasura, Next.js 15, React 19, TanStack Query, Tailwind CSS and Recharts. CI uses GitHub Actions, Vitest and a Nitro devnode integration job. Production runs on Railway.

## Development setup

Requirements: **Node.js 22** (see `.nvmrc`), **pnpm 9.15.0**, Docker, and Foundry's `cast` for the local devnode. `cargo-stylus` plus the Rust WASM target is needed to seed actual Stylus programs; see [Contributing](CONTRIBUTING.md).

```bash
git clone https://github.com/CoBuilders-xyz/stylus-dashboard.git
cd stylus-dashboard
pnpm install --frozen-lockfile
cp apps/web/.env.example apps/web/.env.local
cp packages/indexer/.env.example packages/indexer/.env
```

For frontend-only work, set `NEXT_PUBLIC_GRAPHQL_ENDPOINT` in `apps/web/.env.local` to `https://stylus-dashboard-hql.up.railway.app/v1/graphql`, then run `pnpm --filter @stylus-dashboard/web dev`. That reads public mainnet data. It needs neither Docker nor an RPC token. See the release record for the existing production Comparison permission issue.

For the complete local stack, use separate terminals from the repo root:

```bash
# Terminal 1: local Nitro chain, localhost:8547
./scripts/devnode.sh

# Terminal 2: Envio, local PostgreSQL :5433 and Hasura :8080
pnpm --filter @stylus-dashboard/indexer dev

# Terminal 3: frontend, localhost:3000
pnpm --filter @stylus-dashboard/web dev

# After the devnode and indexer are ready
pnpm seed
```

Keep the frontend GraphQL endpoint set to `http://localhost:8080/v1/graphql` when using local data. `config.yaml` defaults to local chain 412346. Do not run the separate `docker-compose.yml` alongside Envio's managed local Hasura on the same port.

For a **separate mainnet dataset**, add an `ENVIO_API_TOKEN` to the indexer environment and select the config without overwriting the local default:

```bash
pnpm --filter @stylus-dashboard/indexer dev --config config.arbitrum-one.yaml
```

Switching an existing dataset between chains requires deliberate storage handling. Do not reset a production database as part of setup. See the [Railway deployment and recovery guide](DEPLOY-RAILWAY.md).

## Validation

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build

# Read-only HTTP and public GraphQL smoke check; exits nonzero on failure
node scripts/check-public.mjs
```

CI runs the four pnpm checks. The separate integration job seeds a Stylus program on Nitro and verifies indexed entities and public aggregate access. [Report reproduction](docs/reports/2026-09-08/README.md#reproduce-the-results) uses Python 3; chart generation additionally uses Matplotlib.

## Contributing and license

See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow and [GitHub Issues](https://github.com/CoBuilders-xyz/stylus-dashboard/issues) for bugs and proposed work. Code and the documentation package are available under the [MIT license](LICENSE). This repository supplies the dashboard portion of the Stylus fellowship deliverables; it does not claim delivery of the second tooling project.
