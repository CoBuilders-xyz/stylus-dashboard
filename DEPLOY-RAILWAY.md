# Railway deployment and operations

This runbook describes the dashboard in this repository. Production uses four services: PostgreSQL, Hasura, Envio and Web. The optional local devnode is documented in [Contributing](CONTRIBUTING.md); this branch does not contain a Railway devnode Dockerfile or `config.railway-devnode.yaml`.

## Public endpoints

- Dashboard: <https://stylus-dashboard.up.railway.app>
- GraphQL: <https://stylus-dashboard-hql.up.railway.app/v1/graphql>
- Hasura health: <https://stylus-dashboard-hql.up.railway.app/healthz>

The production Web and indexer were observed on commit `4ad27299f088397f2573a98e9d53a6b88076ba6e` on 8 September 2026. This is evidence for that deployment, not a claim that the release branch has been deployed. See [release status](docs/release.md).

## Service configuration

Use the repository root as Docker build context. Select `apps/web/Dockerfile` for Web and `packages/indexer/Dockerfile` for Envio. Keep one indexer instance per dataset and retain PostgreSQL storage across restarts. Use Railway's PostgreSQL template with its persistent volume; the observed production template is PostgreSQL 18. Hasura uses `hasura/graphql-engine:v2.43.0`.

Web's Dockerfile runs the standalone Next.js server. The current indexer Dockerfile runs **`pnpm envio start -r`**, which requests a reset. This documentation release leaves that command unchanged. A separate operational follow-up should review removing `-r` from both the Dockerfile and any Railway Start Command override, then verify resume behavior. The non-reset CLI command is `pnpm envio start`.

### PostgreSQL

Use generated credentials and reference the service's private connection settings from Hasura and Envio. Keep the data volume attached. The repo's standalone Compose credentials are for local development only. Take a recoverable database backup before a planned schema/configuration migration or full reindex.

### Hasura variables

| Variable                                 | Value / meaning                                                                                      |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `HASURA_GRAPHQL_DATABASE_URL`            | Private PostgreSQL connection URL                                                                    |
| `HASURA_GRAPHQL_ADMIN_SECRET`            | Generated secret shared with Envio, never with the browser                                           |
| `HASURA_GRAPHQL_UNAUTHORIZED_ROLE`       | `public`                                                                                             |
| `HASURA_GRAPHQL_STRINGIFY_NUMERIC_TYPES` | `true`                                                                                               |
| `HASURA_GRAPHQL_ENABLE_CONSOLE`          | `false` for routine public operation; administration remains available through authenticated tooling |
| `PORT`                                   | `8080`                                                                                               |

Expose HTTPS for browser queries. The `public` role needs SELECT access for the dashboard entities and aggregate access for `StylusContract` and `DeployerRegistry`; visitors do not need write permissions. If restricting CORS, allow the actual Web origin and any intentionally supported local development origins.

### Indexer variables

| Variable                                                  | Value / meaning                                       |
| --------------------------------------------------------- | ----------------------------------------------------- |
| `ENVIO_CONFIG`                                            | `config.arbitrum-one.yaml`                            |
| `ENVIO_API_TOKEN`                                         | HyperSync API token; keep in Railway variables        |
| `ENVIO_PG_HOST`, `ENVIO_PG_PORT`                          | Private PostgreSQL host and `5432`                    |
| `ENVIO_PG_USER`, `ENVIO_PG_PASSWORD`, `ENVIO_PG_DATABASE` | Matching PostgreSQL credentials/database              |
| `ENVIO_PG_SCHEMA`                                         | `public` unless intentionally isolating a new dataset |
| `HASURA_GRAPHQL_ENDPOINT`                                 | Private Hasura URL ending in **`/v1/metadata`**       |
| `HASURA_GRAPHQL_ADMIN_SECRET`                             | Same secret as Hasura                                 |
| `ENVIO_HASURA_PUBLIC_AGGREGATE`                           | `["StylusContract","DeployerRegistry"]`               |
| `TUI_OFF`                                                 | `true`                                                |
| `LOG_STRATEGY`                                            | `console-pretty`                                      |

`ENVIO_CONFIG` is the supported CLI environment variable (`pnpm envio start --help`); `CONFIG_FILE` is not used here. The aggregate setting must be a JSON array. It applies on initialization/reset, so existing metadata may require the one-time repair below. Configure `ENVIO_PG_SSL_MODE` if required by the chosen database connection; its value depends on the database's SSL configuration.

### Web variables

| Variable                       | Value / meaning                                          |
| ------------------------------ | -------------------------------------------------------- |
| `NEXT_PUBLIC_GRAPHQL_ENDPOINT` | `https://stylus-dashboard-hql.up.railway.app/v1/graphql` |
| `PORT`                         | `3000`                                                   |

`NEXT_PUBLIC_GRAPHQL_ENDPOINT` is a Docker build argument and is embedded in the browser bundle. Set it **before building**, and rebuild Web after changing it. The server currently uses the same endpoint. No HyperSync token, PostgreSQL credential or Hasura admin secret belongs in Web.

## Initial deployment

1. Create PostgreSQL with persistent storage.
2. Create Hasura, connect it to PostgreSQL, set its admin secret/public role and generate the public domain.
3. Configure Envio using the existing Dockerfile, mainnet config and the aggregate variable above. Allow storage initialization and historical sync to finish.
4. Configure Web's GraphQL build argument and deploy the existing Web Dockerfile.
5. Run the read-only check below. Inspect `_meta` and verify the chain, start block, readiness and progressing processed blocks. HTTP 200 alone is insufficient.

## Existing public aggregate permissions

At the 8 September capture, production exposed `StylusContract_aggregate` but **not** `DeployerRegistry_aggregate`, causing Comparison to fail. Production's indexer aggregate variable contained only `["StylusContract"]`.

For an already-synced database, an operator must:

1. Set the indexer variable to `["StylusContract","DeployerRegistry"]` for future initializations.
2. Repair existing SELECT metadata using the supplied script. Load `HASURA_ADMIN_SECRET` securely into the current shell environment, then run:

```bash
HASURA_ENDPOINT=https://stylus-dashboard-hql.up.railway.app \
  ./scripts/enable-hasura-aggregates.sh
```

The script defaults to the development secret `testing`; production requires the real secret via the environment. It targets the default source, `public` schema and `public` role, recreating SELECT permissions with all columns, an empty row filter and aggregates allowed. Inspect custom permissions before using it on a differently configured Hasura. It does not reset or reindex chain data.

3. Run `node scripts/check-public.mjs` and verify Comparison in a browser. A successful variable save alone is not evidence that permissions changed.

## Verification and monitoring

```bash
# Five HTTP routes and eight real dashboard GraphQL operations, without auth
node scripts/check-public.mjs

# Optional alternate deployment
DASHBOARD_URL=https://your-web.example \
GRAPHQL_ENDPOINT=https://your-hasura.example/v1/graphql \
  node scripts/check-public.mjs
```

Useful read-only query:

```graphql
query IndexerProgress {
  _meta {
    chainId
    startBlock
    progressBlock
    sourceBlock
    isReady
    readyAt
  }
}
```

Monitor Web/Hasura availability, indexer restart count and errors, PostgreSQL storage, upstream rate limits, and the gap between source and processed blocks. Check progress across two observations; a running process can still be stalled. The app's Health page describes program activation expiry, not infrastructure health. Production monitoring/alerts and backup ownership are operator responsibilities; this repo does not claim an uptime SLA.

If a separate operational change adopts non-reset startup, verify it with a controlled restart and confirm persisted progress and contract totals remain. This documentation release did not change the Docker command or restart production.

## Recovery

- **Comparison aggregate field missing:** perform the metadata repair above. No reset is needed.
- **Incorrect Web GraphQL URL:** correct the build variable and rebuild Web.
- **Rate-limited/stalled HyperSync:** inspect upstream allowance and logs; restore access, restart without `-r`, and verify progress. Do not repeatedly erase the dataset.
- **Incompatible schema/chain/start block:** stop and plan the migration. Prefer a separate database plus Hasura for a replacement dataset, synchronize and validate it, then switch Web's endpoint. An isolated `ENVIO_PG_SCHEMA` also requires matching Hasura metadata and public query review; the permission script assumes `public`.
- **Intentional full reindex:** only after a backup and a maintenance plan, run `pnpm envio start --config config.arbitrum-one.yaml -r` once in the indexer service's configured environment. This clears and rebuilds indexer storage. Restore ordinary startup immediately afterward.
- **Rollback:** redeploy the previously verified Web/indexer commit only if it remains compatible with the current schema and configuration. Otherwise restore the matching database backup or validated replacement dataset as well. Do not assume a code rollback reverses data migrations.

## Release deployment boundary

Preparing or pushing the `release` branch does not merge it into `main` or switch production. Publish the documentation release against the reviewed commit. Record application deployment status and unresolved operational findings accurately in its notes; preparing documentation does not repair those findings. The [release record](docs/release.md) lists the concrete pending steps.
