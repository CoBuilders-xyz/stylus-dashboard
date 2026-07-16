# Stylus Ecosystem Dashboard

A public dashboard providing visibility into **Stylus adoption** across Arbitrum's MultiVM stack (EVM + WASM).

> **Is Stylus growing? How many contracts are there? Who is building?**
> This dashboard answers these questions with real-time on-chain data.

## What It Shows

| Section | Description |
|---------|-------------|
| **Adoption Overview** | KPIs: total contracts, active contracts, deployers, activations, WASM share |
| **Contract Activity** | Filterable table of all Stylus contracts with deployment and activity data |
| **Builder Metrics** | Unique deployers over time, top deployers, retention |
| **Stylus Health** | Activation status, time-to-expiry, reactivation rate, cache occupancy |
| **Stylus vs Solidity** | Side-by-side comparison of deployments, activity, and growth |

## Architecture

```
[Arbitrum One / Testnode]
        │
        ▼
[Envio HyperIndex] ──► [PostgreSQL] ──► [Hasura GraphQL]
                                              │
                                              ▼
                                    [Next.js 15 Frontend]
                                              │
                                              ▼
                                        [Browser]
```

**On-chain data sources:**
- `ArbWasm` (0x71) — `ProgramActivated`, `ProgramLifetimeExtended` events
- `ArbWasmCache` (0x72) — `UpdateProgramCache` events
- Contract bytecode prefix `0xEFF000` for Stylus identification

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | pnpm workspaces |
| Indexer | Envio HyperIndex v3 |
| Database | PostgreSQL |
| API | Hasura GraphQL (auto-generated) |
| Frontend | Next.js 15 (App Router) |
| UI | Tailwind CSS + shadcn/ui |
| Charts | Recharts |
| Testing | Vitest + React Testing Library |
| CI/CD | GitHub Actions |
| Deploy | Railway |

## Getting Started

### Prerequisites

- Node.js 20+ (see `.nvmrc`)
- pnpm 9+
- Docker & Docker Compose
- [Arbitrum Nitro Testnode](https://github.com/OffchainLabs/nitro-testnode) (for local Stylus testing)

### Setup

```bash
# Clone the repository
git clone git@github.com:CoBuilders-xyz/stylus-dashboard.git
cd stylus-dashboard

# Install dependencies
pnpm install

# Copy environment files
cp apps/web/.env.example apps/web/.env.local
cp packages/indexer/.env.example packages/indexer/.env
```

### Local Development

```bash
# 1. Start the Arbitrum testnode (in a separate terminal)
# Assumes nitro-testnode is cloned at ../nitro-testnode
cd ../nitro-testnode && ./test-node.bash --init --stylus

# 2. Start the indexer (auto-manages PostgreSQL on :5433 + Hasura on :8080)
cd packages/indexer
pnpm dev
# GraphQL available at http://localhost:8080

# 3. Start the frontend (in another terminal)
cd apps/web
pnpm dev
# Open http://localhost:3000
```

#### Indexing Arbitrum One (mainnet)

```bash
# 1. Get a free API token at https://envio.dev/app/api-tokens
# 2. Add it to packages/indexer/.env
echo "ENVIO_API_TOKEN=your-token" > packages/indexer/.env

# 3. Switch config to Arbitrum One
cd packages/indexer
cp config.arbitrum-one.yaml config.yaml

# 4. Run with reset flag (fresh DB)
pnpm dev -- -r
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter @stylus-dashboard/web test
pnpm --filter @stylus-dashboard/indexer test
```

### Linting & Type Checking

```bash
pnpm lint
pnpm typecheck
```

## Project Structure

```
stylus-dashboard/
├── apps/
│   └── web/                    # Next.js 15 frontend
│       └── src/
│           ├── app/            # Pages (route-per-section)
│           ├── components/     # UI components + charts
│           ├── lib/            # GraphQL client, utils
│           └── types/          # TypeScript interfaces
├── packages/
│   └── indexer/                # Envio HyperIndex v3
│       ├── config.yaml         # Contracts & events config (testnode)
│       ├── config.arbitrum-one.yaml  # Mainnet config (HyperSync)
│       ├── schema.graphql      # Entity definitions
│       ├── src/handlers/       # Event handlers (auto-registered)
│       ├── src/helpers/        # Utility functions
│       └── abis/               # Contract ABIs
├── .github/                    # CI workflows + templates
├── docker-compose.yml          # Local dev infrastructure
└── scripts/                    # Seed & utility scripts
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to contribute, branching strategy, and PR workflow.

## License

[MIT](LICENSE)
