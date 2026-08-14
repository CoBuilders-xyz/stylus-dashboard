#!/usr/bin/env bash
set -euo pipefail

RPC="${TESTNODE_RPC:-http://127.0.0.1:8547}"
PRIVATE_KEY="0xb6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659"

# --- 1. Start Nitro devnode in background ---
echo "Starting Nitro devnode..."
nitro \
  --dev \
  --http.addr 0.0.0.0 \
  --http.api=net,web3,eth,debug \
  --validation.wasm.allowed-wasm-module-roots=/opt/nitro/machines,/opt/nitro/target-machines \
  &
NITRO_PID=$!

# --- 2. Wait for RPC to be ready ---
echo -n "Waiting for RPC"
RETRIES=0
until curl -sf -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  "$RPC" >/dev/null 2>&1; do
  echo -n "."
  sleep 0.5
  RETRIES=$((RETRIES + 1))
  if [[ $RETRIES -ge 120 ]]; then
    echo " TIMEOUT"
    echo "ERROR: Nitro devnode did not start within 60s"
    exit 1
  fi
done
echo " ready!"

# --- 3. Chain setup (same as scripts/devnode.sh) ---
echo "Configuring chain owner..."
cast send 0x00000000000000000000000000000000000000FF "becomeChainOwner()" \
  --private-key "$PRIVATE_KEY" \
  --rpc-url "$RPC" >/dev/null 2>&1

echo "Setting L1 price to 0..."
cast send --rpc-url "$RPC" --private-key "$PRIVATE_KEY" \
  0x0000000000000000000000000000000000000070 \
  'setL1PricePerUnit(uint256)' 0x0 >/dev/null 2>&1

echo "Deploying Cache Manager..."
DEPLOY_OUTPUT=$(cast send --private-key "$PRIVATE_KEY" --rpc-url "$RPC" \
  --create 0x60a06040523060805234801561001457600080fd5b50608051611d1c61003060003960006105260152611d1c6000f3fe 2>&1)
CACHE_MANAGER=$(echo "$DEPLOY_OUTPUT" | awk '/contractAddress/ {print $2}')

if [[ -z "$CACHE_MANAGER" ]]; then
  echo "ERROR: Failed to deploy Cache Manager"
  echo "$DEPLOY_OUTPUT"
  exit 1
fi

echo "Registering Cache Manager ($CACHE_MANAGER)..."
cast send --private-key "$PRIVATE_KEY" --rpc-url "$RPC" \
  0x0000000000000000000000000000000000000070 \
  "addWasmCacheManager(address)" "$CACHE_MANAGER" >/dev/null 2>&1

echo ""
echo "=== Devnode Ready ==="
echo "  RPC:            $RPC (exposed on port 8547)"
echo "  Chain ID:       412346"
echo "  Cache Manager:  $CACHE_MANAGER"
echo "  Deploy interval: ${DEPLOY_INTERVAL_MS:-5000}ms"
echo ""

# --- 4. Run seed script (loops forever) ---
echo "Starting seed loop..."
cd /app/scripts
exec npx tsx seed.ts
