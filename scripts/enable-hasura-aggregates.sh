#!/usr/bin/env bash
set -euo pipefail

# Grants aggregate access (StylusContract_aggregate, etc) to Hasura's public
# role, so the dashboard can read counts without downloading whole tables.
#
# Envio writes these permissions only when the indexer storage initializes,
# which happens on a reset or an empty database. An already-synced deployment
# resumes instead and keeps the old permissions, so it needs this script once.
# ENVIO_HASURA_PUBLIC_AGGREGATE covers every reset after that.
#
# Usage:
#   ./scripts/enable-hasura-aggregates.sh
#   HASURA_ENDPOINT=https://... HASURA_ADMIN_SECRET=... ./scripts/enable-hasura-aggregates.sh
#
# Environment variables:
#   HASURA_ENDPOINT      - base URL (default: http://localhost:8080)
#   HASURA_ADMIN_SECRET  - admin secret (default: testing, the envio dev one)
#   ENTITIES             - space-separated table names to grant

HASURA_ENDPOINT="${HASURA_ENDPOINT:-http://localhost:8080}"
HASURA_ADMIN_SECRET="${HASURA_ADMIN_SECRET:-testing}"
ENTITIES="${ENTITIES:-StylusContract DeployerRegistry}"
METADATA_URL="${HASURA_ENDPOINT%/}/v1/metadata"
GRAPHQL_URL="${HASURA_ENDPOINT%/}/v1/graphql"

# The secret goes in through stdin rather than an -H argument, which would put
# it in the process list for anyone running ps on the host.
metadata() {
  printf 'header = "x-hasura-admin-secret: %s"\n' "${HASURA_ADMIN_SECRET}" \
    | curl -sS --config - -X POST "${METADATA_URL}" \
        -H 'Content-Type: application/json' -d "$1"
}

for entity in ${ENTITIES}; do
  echo "Granting aggregates on ${entity}..."

  # Hasura has no update verb for a select permission, so it has to be dropped
  # and recreated. Both go in one bulk request: it applies as a transaction, so
  # a failed create rolls the drop back instead of leaving the role unreadable.
  result=$(metadata "{
      \"type\": \"bulk\",
      \"args\": [
        {
          \"type\": \"pg_drop_select_permission\",
          \"args\": {
            \"source\": \"default\",
            \"table\": {\"name\": \"${entity}\", \"schema\": \"public\"},
            \"role\": \"public\"
          }
        },
        {
          \"type\": \"pg_create_select_permission\",
          \"args\": {
            \"source\": \"default\",
            \"table\": {\"name\": \"${entity}\", \"schema\": \"public\"},
            \"role\": \"public\",
            \"permission\": {
              \"columns\": \"*\",
              \"filter\": {},
              \"allow_aggregations\": true
            }
          }
        }
      ]
    }")

  if ! grep -q '"message":"success"' <<<"${result}"; then
    echo "  failed: ${result}" >&2
    exit 1
  fi
done

echo "Verifying as the public role..."
for entity in ${ENTITIES}; do
  result=$(curl -sS -X POST "${GRAPHQL_URL}" \
    -H 'Content-Type: application/json' \
    -d "{\"query\": \"{ ${entity}_aggregate { aggregate { count } } }\"}")
  if grep -q '"errors"' <<<"${result}"; then
    echo "  ${entity}: ${result}" >&2
    exit 1
  fi
  echo "  ${entity}: ${result}"
done
