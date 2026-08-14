# ---------------------------------------------------------------------------
# Stage 1: Extract nitro binary + machine files from the official image
# ---------------------------------------------------------------------------
FROM offchainlabs/nitro-node:v3.11.2-3599aca AS nitro

# ---------------------------------------------------------------------------
# Stage 2: Install Node.js dependencies for the seed scripts
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS deps

RUN corepack enable pnpm

WORKDIR /app

# Copy workspace root files needed for pnpm install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

# Copy only the scripts package manifest
COPY scripts/package.json scripts/package.json

# Install dependencies (hoisted to root node_modules by pnpm)
RUN pnpm install --filter @stylus-dashboard/scripts... --frozen-lockfile

# Copy script sources
COPY scripts/ scripts/

# ---------------------------------------------------------------------------
# Stage 3: Runtime — Rust (for cargo-stylus) + Node + Foundry + Nitro
# ---------------------------------------------------------------------------
FROM rust:1-bookworm AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates git jq \
    && rm -rf /var/lib/apt/lists/*

# Wasm target for Stylus compilation
RUN rustup target add wasm32-unknown-unknown

# cargo-stylus
RUN cargo install cargo-stylus --locked

# Foundry (cast)
RUN curl -L https://foundry.paradigm.xyz | bash \
    && /root/.foundry/bin/foundryup \
    && cp /root/.foundry/bin/cast /usr/local/bin/cast

# Node.js 22
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable pnpm

# Nitro binary + machine WASM files
COPY --from=nitro /usr/local/bin/nitro /usr/local/bin/nitro
COPY --from=nitro /home/user/nitro-legacy/machines /opt/nitro/machines
COPY --from=nitro /home/user/target/machines /opt/nitro/target-machines

# Seed scripts + dependencies (preserving pnpm structure)
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/scripts ./scripts
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Pre-build Stylus fixture project to avoid runtime init delay
RUN cargo stylus new /app/scripts/fixtures/stylus-contract 2>/dev/null || true

# Entrypoint
COPY docker/devnode/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 8547

ENV TESTNODE_RPC=http://127.0.0.1:8547
ENV DEPLOY_INTERVAL_MS=5000

CMD ["/app/entrypoint.sh"]
