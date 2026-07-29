FROM node:22-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends postgresql-client && \
    rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@9.15.0

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/indexer/package.json packages/indexer/
RUN pnpm install --frozen-lockfile --filter @stylus-dashboard/indexer --ignore-scripts

COPY packages/indexer/ packages/indexer/
WORKDIR /app/packages/indexer

RUN pnpm envio codegen
RUN pnpm install --frozen-lockfile --filter @stylus-dashboard/indexer

CMD ["pnpm", "envio", "start", "-r"]
