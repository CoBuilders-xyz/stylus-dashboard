# Pending Issues — Stylus Dashboard

This file documents all issues needed to bring the dashboard to a production-ready version.
Each section is an issue that can be loaded into GitHub Issues.

Priorities: `P0` = blocker, `P1` = required for v1, `P2` = nice-to-have, `P3` = future.

---

## Infrastructure & Indexer

### [P0] EVM Deployment Tracker Service

**Problem**: We currently only index Stylus events (ProgramActivated, etc.) with Envio. For the EVM vs WASM comparison we need to track ALL contract deployments.

**Proposed solution**: Create a backend service (`packages/evm-tracker`) that:
- Subscribes to new blocks via WebSocket or polling
- For each block, detects transactions with `to: null` (contract creation)
- Classifies the deployed contract by its bytecode prefix (`0xEFF000` = WASM, otherwise = EVM)
- Persists to PostgreSQL: address, deployer, block, timestamp, type (evm|wasm)
- Exposes data via the same GraphQL (Hasura) or a dedicated REST endpoint

**Considerations**:
- The frontend MUST NEVER call the RPC directly
- For historical mainnet data, use Envio HyperSync API (batch queries)
- For real-time data, poll the node every ~2s

**Labels**: `backend`, `indexer`, `P0`

---

### [P0] Indexer: Fix real-time event sync

**Problem**: The Envio indexer sometimes fails to detect new `ProgramActivated` events from recent blocks on the testnode.

**Tasks**:
- Investigate whether there's indexing lag in Envio v3 with local nodes
- Verify that `envio dev` is in polling mode and not one-shot
- Add a health check endpoint that reports the last processed block
- Document troubleshooting in README

**Labels**: `backend`, `bug`, `P0`

---

### [P1] Indexer: Add `EvmDeployment` entity

**Problem**: For the comparison view we need an entity representing EVM deployments in the same DB.

**Proposed schema** (add to `schema.graphql`):
```graphql
type EvmDeployment @entity {
  id: ID!
  deployer: String!
  blockNumber: Int!
  timestamp: Int!
  chainId: Int!
}
```

This will be populated by the EVM Deployment Tracker (previous issue).

**Labels**: `backend`, `schema`, `P1`

---

### [P1] Indexer: Track interactions with Stylus contracts

**Problem**: We currently only track activations. For "Active Contracts" and "Daily Tx" we need to count calls/transactions to indexed Stylus contracts.

**Options**:
1. Use the EVM tracker to identify txs where `to` is a known Stylus contract
2. Create an Envio handler that listens to a generic event (if one exists)
3. Use HyperSync with filters by `to` address of indexed contracts

**Proposed entity**:
```graphql
type DailyContractActivity @entity {
  id: ID!                    # contractAddress-YYYY-MM-DD
  contract: StylusContract!
  date: Int!
  transactionCount: Int!
  uniqueCallers: Int!
}
```

**Labels**: `backend`, `indexer`, `P1`

---

### [P1] Indexer: `DailyStats` — improve unique deployers tracking

**Problem**: The `uniqueDeployers` field in `DailyStats` currently increments on every activation but doesn't check whether the deployer was already seen in previous days. It should count new deployers per day vs cumulative.

**Tasks**:
- Add `newDeployers` (deployers seen for the first time that day)
- `uniqueDeployers` should be the cumulative total count
- Maintain a Set of seen deployers in an auxiliary entity

**Labels**: `backend`, `data-quality`, `P1`

---

### [P2] Indexer: Multi-chain support (Arbitrum One + Sepolia + Orbit)

**Problem**: We currently only index one chain (testnode or Arbitrum One). For the full dashboard we need to support multiple chains where Stylus is enabled.

**Tasks**:
- Add configs for Arbitrum Sepolia (`config.sepolia.yaml`)
- Document how to add an Orbit chain with Stylus enabled
- The frontend should be able to filter by chain

**Labels**: `backend`, `feature`, `P2`

---

## Frontend — Visualization

### [P1] Charts: Time-series deployments per day

**Problem**: The overview shows data in a table but has no trend charts.

**Tasks**:
- Use `DailyStats` data to chart activations/day with Recharts
- Create an `<ActivationsChart />` component with LineChart
- Include a toggle for 7d / 30d / all time
- Base chart components already exist in `src/components/charts/`

**Labels**: `frontend`, `charts`, `P1`

---

### [P1] Charts: Builder growth over time

**Problem**: We need a chart showing cumulative growth of builders (unique deployers).

**Tasks**:
- Query: fetch all contracts ordered by `activatedAt`
- Calculate cumulative deployers per day
- AreaChart with the running total

**Labels**: `frontend`, `charts`, `P1`

---

### [P1] Comparison Page: EVM vs WASM visualization

**Problem**: The `/comparison` page is empty. Once the EVM tracker is ready, connect it.

**Tasks**:
- Comparative bars (share %)
- Side-by-side metrics table
- Overlaid time-series (Stylus vs Solidity deployments/day)
- Stacked area chart for proportion

**Requirement**: Depends on the EVM Deployment Tracker service

**Labels**: `frontend`, `charts`, `blocked`, `P1`

---

### [P1] Contracts Page: table with filters and pagination

**Problem**: The `/contracts` page needs an interactive table with the list of Stylus contracts.

**Tasks**:
- Table with columns: Address, Deployer, Version, Deploy Date, Status (cached/expired/active)
- Filters: by deployer, by status, by date
- Server-side pagination (use `limit` / `offset` from GraphQL query)
- Link to explorer (Arbiscan) for each address

**Labels**: `frontend`, `table`, `P1`

---

### [P2] Health Page: Activation status and time-to-expiry

**Problem**: Stylus contracts expire if not reactivated. We need to visualize their health status.

**Tasks**:
- Pie chart: Active / Expired / Near-expiry
- Time-to-expiry histogram (0-1d, 1-3d, 3-7d, 7-30d, 30d+)
- Reactivation rate = reactivations / activations
- Average lifetime
- The `expiresAt` and `lastKeepalive` data is already in the schema

**Labels**: `frontend`, `charts`, `P2`

---

### [P2] Dashboard: Responsive design and dark/light mode

**Problem**: The dashboard is dark-only and not fully optimized for mobile.

**Tasks**:
- Implement dark/light mode toggle (use `next-themes`)
- Review breakpoints for mobile/tablet
- KPI cards should be scrollable on mobile

**Labels**: `frontend`, `ui`, `P2`

---

### [P2] Dashboard: Loading states and skeleton screens

**Problem**: When data is loading, KPIs only show "...".

**Tasks**:
- Implement skeleton loaders for each card
- Shimmer animation for tables
- Error boundary with retry button

**Labels**: `frontend`, `ux`, `P2`

---

## Advanced Metrics

### [P1] Metric: WASM Share % (deployment proportion)

**Description**: Percentage of WASM contracts over total deployments.

**Formula**: `wasm_deployments / (evm_deployments + wasm_deployments) * 100`

**Requirement**: Depends on the EVM tracker. Once available, add as a primary KPI.

**Labels**: `metric`, `P1`

---

### [P1] Metric: Daily Active Contracts (DAC)

**Description**: Stylus contracts that received at least one transaction in the last 24h.

**Implementation**: The EVM tracker or a dedicated service must count incoming txs to known Stylus contracts.

**Labels**: `metric`, `backend`, `P1`

---

### [P2] Metric: Contract Survival Curve

**Description**: % of contracts that remain active (not expired) after 7, 30, 90 days.

**Implementation**:
- For each contract, calculate `activatedAt + EXPIRY_SECONDS` vs `now`
- If it has a `lastKeepalive`, use that as the base
- Plot as a step-function or smooth curve

**Labels**: `metric`, `charts`, `P2`

---

### [P2] Metric: Median Time to First Interaction

**Description**: How long a new contract takes to receive its first call after deployment.

**Implementation**: Requires interaction tracking (previous issue).

**Labels**: `metric`, `backend`, `P2`

---

### [P2] Metric: Average Contracts per Deployer

**Description**: Average number of contracts deployed per unique builder.

**Formula**: `total_contracts / unique_deployers`

**Implementation**: Can be computed directly in the frontend with current indexer data.

**Labels**: `metric`, `frontend`, `P2`

---

### [P2] Metric: Builder Retention

**Description**: Builders who deployed more than once (in different days/weeks).

**Implementation**:
- Group deploys by deployer and by week
- A deployer has "retention" if they appear in >1 distinct week
- Show % of retained builders

**Labels**: `metric`, `backend`, `P2`

---

### [P2] Metric: Growth Rate (WoW / MoM)

**Description**: Weekly and monthly growth rate of deployments, builders, and activations.

**Formula**: `(current_period - previous_period) / previous_period * 100`

**Implementation**: Can be computed in the frontend by comparing `DailyStats` entries.

**Labels**: `metric`, `frontend`, `P2`

---

### [P3] Metric: Cache Occupancy & Eviction Rate

**Description**: % of WASM cache used and eviction frequency.

**Implementation**: Requires researching whether ArbWasmCache exposes eviction events or if there's an RPC method to read the cache state.

**Labels**: `metric`, `research`, `P3`

---

### [P3] Metric: Gas Efficiency Comparison (Stylus vs EVM)

**Description**: Compare gas used by equivalent operations in Stylus vs Solidity.

**Implementation**:
- Deploy equivalent contracts (e.g., ERC20 in Solidity vs Stylus)
- Execute the same operations
- Compare gas per operation
- Could be a static benchmark or real-time data

**Labels**: `metric`, `research`, `P3`

---

### [P3] Metric: Bytecode Size Distribution

**Description**: Distribution of bytecode sizes for Stylus vs EVM contracts.

**Implementation**: For each indexed contract, fetch `eth_getCode` and record the size.

**Labels**: `metric`, `backend`, `P3`

---

## DevOps & CI/CD

### [P1] CI: Fix indexer typecheck without codegen

**Problem**: `pnpm typecheck` in the indexer fails because it requires `envio codegen` first. CI doesn't have Envio installed.

**Options**:
1. Install Envio in CI and run codegen before typecheck
2. Commit the generated types (`.envio/types.d.ts`)
3. Separate the indexer CI so it only runs in a job with Docker

**Labels**: `devops`, `ci`, `P1`

---

### [P1] Deploy: Railway configuration

**Problem**: There's no Procfile or railway.toml configured.

**Tasks**:
- Create `railway.toml` with services: web, indexer, postgres
- Configure env vars in Railway (ENVIO_API_TOKEN, DB connection)
- Document the deployment in README

**Labels**: `devops`, `deploy`, `P1`

---

### [P2] Docker: Full development compose

**Problem**: The current `docker-compose.yml` is for standalone PostgreSQL. We need a compose that brings up everything: testnode + indexer + web.

**Tasks**:
- Service: nitro-testnode (with Stylus enabled)
- Service: envio indexer
- Service: next.js web
- A single `docker compose up` for the full stack

**Labels**: `devops`, `docker`, `P2`

---

### [P2] CI: E2E tests with testnode

**Problem**: There are no integration tests that verify the indexer processes events correctly.

**Tasks**:
- Spin up testnode in CI (Docker)
- Run seed script briefly
- Verify that the indexer recorded the activations
- Query GraphQL and validate response

**Labels**: `devops`, `testing`, `P2`

---

## Documentation

### [P1] README: Complete local development instructions

**Problem**: The README exists but doesn't cover the full flow.

**Tasks**:
- Prerequisites (Node 20, pnpm 9, Docker, Rust + cargo-stylus)
- How to start the testnode with Stylus
- How to run the indexer (`envio dev`)
- How to run the seed script
- How to view the frontend
- Common troubleshooting

**Labels**: `docs`, `P1`

---

### [P1] CONTRIBUTING.md

**Problem**: There's no contribution guide.

**Tasks**:
- Workflow: fork → branch → PR → review
- Code conventions (prettier, eslint)
- Branch naming (`feat/`, `fix/`, `docs/`)
- How to write commit messages
- PR template (already exists)
- How to self-assign an issue

**Labels**: `docs`, `P1`

---

### [P2] ADR: Architecture Decision Records

**Description**: Document key technical decisions so students understand the "why".

**Suggested ADRs**:
- ADR-001: Envio HyperIndex over Ponder / custom NestJS
- ADR-002: Next.js App Router over Pages Router
- ADR-003: Monorepo with pnpm workspaces
- ADR-004: Hasura auto-generated GraphQL
- ADR-005: Frontend only queries our own services (never RPC directly)

**Labels**: `docs`, `architecture`, `P2`

---

## UX Improvements / Extra Features

### [P2] Feature: Contract detail page

**Description**: Click on a contract → see its full history: activation, reactivations, cache events, callers.

**Route**: `/contracts/[address]`

**Labels**: `frontend`, `feature`, `P2`

---

### [P2] Feature: Search by address/deployer

**Description**: Global search in the sidebar to look up by contract address or deployer.

**Labels**: `frontend`, `feature`, `P2`

---

### [P3] Feature: Real-time WebSocket updates

**Description**: Instead of polling every 5s, use Hasura WebSocket subscriptions for push updates.

**Labels**: `frontend`, `performance`, `P3`

---

### [P3] Feature: Export data (CSV/JSON)

**Description**: Button to export data from any table or chart as CSV or JSON.

**Labels**: `frontend`, `feature`, `P3`

---

### [P3] Feature: Expiring contract notifications

**Description**: Alert banner or notification when an indexed contract is <24h from expiring.

**Labels**: `frontend`, `feature`, `P3`

---

## Priority Summary

| Priority | Issues | Description |
|----------|--------|-------------|
| P0 | 2 | EVM tracker + indexer sync fix |
| P1 | 11 | Core features for production v1 |
| P2 | 12 | Nice-to-have, significantly improve the product |
| P3 | 6 | Future, research-heavy |

**Total: 31 issues**

---

## Suggested GitHub Labels

```
backend          - Work on indexer/tracker/services
frontend         - Work on the UI (Next.js)
charts           - Data visualization with Recharts
metric           - New metric or KPI
devops           - CI/CD, Docker, deployment
docs             - Documentation
bug              - Something isn't working as expected
feature          - New feature
P0               - Blocker
P1               - Required for v1
P2               - Nice to have
P3               - Future
good first issue - Ideal for new contributors
blocked          - Depends on another issue
research         - Requires prior investigation
```
