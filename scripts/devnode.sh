#!/usr/bin/env bash
set -euo pipefail

# Starts a Nitro devnode and deploys the Cache Manager contract.
# Used by both local development and CI.
#
# Usage:
#   ./scripts/devnode.sh          # start and wait (foreground, Ctrl-C to stop)
#   ./scripts/devnode.sh --detach # start in background, print when ready
#
# Environment variables:
#   NITRO_NODE_VERSION  - Docker image tag (default: v3.11.2-3599aca)
#   DEVNODE_PORT        - RPC port on host (default: 8547)

NITRO_NODE_VERSION="${NITRO_NODE_VERSION:-v3.11.2-3599aca}"
TARGET_IMAGE="offchainlabs/nitro-node:${NITRO_NODE_VERSION}"
CONTAINER_NAME="nitro-devnode"
DEVNODE_PORT="${DEVNODE_PORT:-8547}"
RPC="http://127.0.0.1:${DEVNODE_PORT}"
PRIVATE_KEY="0xb6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659"

DETACH=false
if [[ "${1:-}" == "--detach" ]]; then
  DETACH=true
fi

cleanup() {
  if [[ "$DETACH" == false ]]; then
    echo "Stopping devnode..."
    docker stop -t 5 "${CONTAINER_NAME}" >/dev/null 2>&1 || true
    docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
  fi
}

if [[ "$DETACH" == false ]]; then
  trap cleanup INT TERM EXIT
fi

# Remove any stale container
docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true

echo "Starting Nitro devnode (${TARGET_IMAGE})..."
docker run --rm --name "${CONTAINER_NAME}" -d \
  -p "${DEVNODE_PORT}:8547" \
  "${TARGET_IMAGE}" \
  --dev \
  --http.addr 0.0.0.0 \
  --http.api=net,web3,eth,debug >/dev/null

# Wait for the node to be ready
echo -n "Waiting for node"
RETRIES=0
MAX_RETRIES=60
until curl -sf -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  "$RPC" >/dev/null 2>&1; do
  echo -n "."
  sleep 0.5
  RETRIES=$((RETRIES + 1))
  if [[ $RETRIES -ge $MAX_RETRIES ]]; then
    echo " TIMEOUT"
    echo "ERROR: Devnode did not become ready within 30s"
    docker logs "${CONTAINER_NAME}" 2>&1 | tail -20
    exit 1
  fi
done
echo " ready!"

# Become chain owner (needed to register cache manager)
echo "Configuring chain owner..."
cast send 0x00000000000000000000000000000000000000FF "becomeChainOwner()" \
  --private-key "$PRIVATE_KEY" \
  --rpc-url "$RPC" >/dev/null 2>&1

# Set L1 data fee to 0 (makes gas estimates closer to Ethereum)
cast send --rpc-url "$RPC" --private-key "$PRIVATE_KEY" \
  0x0000000000000000000000000000000000000070 \
  'setL1PricePerUnit(uint256)' 0x0 >/dev/null 2>&1

# Deploy Cache Manager contract
echo "Deploying Cache Manager..."
DEPLOY_OUTPUT=$(cast send --private-key "$PRIVATE_KEY" --rpc-url "$RPC" \
  --create 0x60a06040523060805234801561001457600080fd5b50608051611d1c61003060003960006105260152611d1c6000f3fe 2>&1)
CACHE_MANAGER=$(echo "$DEPLOY_OUTPUT" | awk '/contractAddress/ {print $2}')

if [[ -z "$CACHE_MANAGER" ]]; then
  echo "ERROR: Failed to deploy Cache Manager"
  echo "$DEPLOY_OUTPUT"
  exit 1
fi

# Register Cache Manager as WASM cache manager
cast send --private-key "$PRIVATE_KEY" --rpc-url "$RPC" \
  0x0000000000000000000000000000000000000070 \
  "addWasmCacheManager(address)" "$CACHE_MANAGER" >/dev/null 2>&1

echo ""
echo "=== Nitro Devnode Ready ==="
echo "  RPC:            $RPC"
echo "  Chain ID:       412346"
echo "  Stylus version: $(cast call 0x0000000000000000000000000000000000000071 'stylusVersion()(uint16)' --rpc-url $RPC)"
echo "  Cache Manager:  $CACHE_MANAGER"
echo "  Funded account: 0x3f1Eae7D46d88F08fc2F8ed27FCb2AB183EB2d0E"
echo "  Private key:    $PRIVATE_KEY"
echo ""

if [[ "$DETACH" == true ]]; then
  echo "Devnode running in background (container: ${CONTAINER_NAME})"
  echo "Stop with: docker stop ${CONTAINER_NAME}"
else
  echo "Press Ctrl-C to stop..."
  # docker run uses detached mode, so there are no shell jobs for a bare
  # `wait` to follow. Wait on the container itself to keep this script alive.
  docker wait "${CONTAINER_NAME}" >/dev/null
fi
