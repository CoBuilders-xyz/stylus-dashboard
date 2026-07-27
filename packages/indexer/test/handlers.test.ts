import { describe, it, expect } from 'vitest';
import { createTestIndexer } from 'envio';
import { getDayId, getDayStartTimestamp, EXPIRY_SECONDS } from '../src/helpers/stats';
import '../src/handlers/ArbWasm.js';

describe('stats helpers', () => {
  it('getDayId returns YYYY-MM-DD format', () => {
    // 2024-01-15 12:30:00 UTC
    const timestamp = 1705318200;
    expect(getDayId(timestamp)).toBe('2024-01-15');
  });

  it('getDayStartTimestamp returns midnight UTC', () => {
    // 2024-01-15 12:30:00 UTC
    const timestamp = 1705318200;
    const dayStart = getDayStartTimestamp(timestamp);
    // 2024-01-15 00:00:00 UTC = 1705276800
    expect(dayStart).toBe(1705276800);
  });

  it('EXPIRY_SECONDS is 365 days', () => {
    expect(EXPIRY_SECONDS).toBe(365 * 24 * 60 * 60);
  });
});

const CODEHASH = '0x' + 'ab'.repeat(32);
const UNKNOWN_CODEHASH = '0x' + 'ee'.repeat(32);
const MODULE_HASH = '0x' + 'cd'.repeat(32);
const PROGRAM = '0x525c2aBA45F66102bC4F45cA629C93F0f0dcC9e8';
const SECOND_PROGRAM = '0x1CBd3b2770909D4e10f157cABC84C7264073C9Ec';
const DEPLOYER = '0xF39FD6e51aad88F6F4ce6aB8827279cffFb92266';
const SECOND_DEPLOYER = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';
const CACHE_MANAGER = '0x217788c286797D56Cd59aF5e493f3699C39cbbe8';
const TIMESTAMP = 1705318200; // 2024-01-15 12:30:00 UTC
const NEXT_DAY = TIMESTAMP + 24 * 60 * 60; // 2024-01-16 12:30:00 UTC

const activate = (
  testIndexer: ReturnType<typeof createTestIndexer>,
  opts: {
    program: `0x${string}`;
    deployer: `0x${string}`;
    blockNumber: number;
    timestamp: number;
    codehash?: string;
  },
) =>
  testIndexer.process({
    chains: {
      412346: {
        simulate: [
          {
            contract: 'ArbWasm',
            event: 'ProgramActivated',
            params: {
              codehash: opts.codehash ?? CODEHASH,
              moduleHash: MODULE_HASH,
              program: opts.program,
              dataFee: 1000n,
              version: 2n,
            },
            block: { number: opts.blockNumber, timestamp: opts.timestamp },
            transaction: {
              from: opts.deployer,
              hash: `0x${opts.blockNumber.toString(16).padStart(64, '0')}`,
            },
          },
        ],
      },
    },
  });

const activateProgram = (testIndexer: ReturnType<typeof createTestIndexer>) =>
  activate(testIndexer, {
    program: PROGRAM,
    deployer: DEPLOYER,
    blockNumber: 100,
    timestamp: TIMESTAMP,
  });

describe('ProgramActivated handler', () => {
  it('writes CodehashIndex alongside StylusContract', async () => {
    // Given a fresh indexer with no processed events
    const testIndexer = createTestIndexer();

    // When a ProgramActivated event is processed
    await activateProgram(testIndexer);

    // Then the codehash resolves to the activated contract
    const index = await testIndexer.CodehashIndex.getOrThrow(CODEHASH);
    expect(index.contractId).toBe(PROGRAM.toLowerCase());

    const contract = await testIndexer.StylusContract.getOrThrow(index.contractId);
    expect(contract.codehash).toBe(CODEHASH);
    expect(contract.deployer).toBe(DEPLOYER.toLowerCase());
    expect(contract.activatedBlock).toBe(100);
  });

  it('does not resolve a codehash that was never activated', async () => {
    // Given an indexer that has activated one program
    const testIndexer = createTestIndexer();
    await activateProgram(testIndexer);

    // When looking up a codehash no activation ever emitted
    const missing = await testIndexer.CodehashIndex.get(UNKNOWN_CODEHASH);

    // Then no index entry exists and a strict lookup fails
    expect(missing).toBeUndefined();
    await expect(async () => testIndexer.CodehashIndex.getOrThrow(UNKNOWN_CODEHASH)).rejects.toThrow(
      'not found',
    );
  });
});

describe('ProgramLifetimeExtended handler', () => {
  it('updates lastKeepalive and recalculates expiresAt', async () => {
    // Given an indexer that has activated one program
    const testIndexer = createTestIndexer();
    await activateProgram(testIndexer);
    const KEEPALIVE_TIMESTAMP = TIMESTAMP + 30 * 24 * 60 * 60; // 30 days later

    // When a keepalive arrives for that program's codehash
    await testIndexer.process({
      chains: {
        412346: {
          simulate: [
            {
              contract: 'ArbWasm',
              event: 'ProgramLifetimeExtended',
              params: { codehash: CODEHASH, dataFee: 500n },
              block: { number: 200, timestamp: KEEPALIVE_TIMESTAMP },
            },
          ],
        },
      },
    });

    // Then the contract's lifetime is extended from the keepalive timestamp
    const contract = await testIndexer.StylusContract.getOrThrow(PROGRAM.toLowerCase());
    expect(contract.lastKeepalive).toBe(KEEPALIVE_TIMESTAMP);
    expect(contract.expiresAt).toBe(KEEPALIVE_TIMESTAMP + EXPIRY_SECONDS);

    // And the extension is persisted and counted as a reactivation
    const extensions = await testIndexer.LifetimeExtension.getAll();
    expect(extensions).toHaveLength(1);
    expect(extensions[0].codehash).toBe(CODEHASH);

    const stats = await testIndexer.DailyStats.getOrThrow(getDayId(KEEPALIVE_TIMESTAMP));
    expect(stats.stylusReactivations).toBe(1);
  });

  it('ignores a keepalive for an unknown codehash', async () => {
    // Given an indexer that has activated one program
    const testIndexer = createTestIndexer();
    await activateProgram(testIndexer);

    // When a keepalive arrives for a codehash no activation ever emitted
    await testIndexer.process({
      chains: {
        412346: {
          simulate: [
            {
              contract: 'ArbWasm',
              event: 'ProgramLifetimeExtended',
              params: { codehash: UNKNOWN_CODEHASH, dataFee: 500n },
              block: { number: 200, timestamp: TIMESTAMP + 1000 },
            },
          ],
        },
      },
    });

    // Then the extension is still recorded but the existing contract is untouched
    const extensions = await testIndexer.LifetimeExtension.getAll();
    expect(extensions).toHaveLength(1);
    expect(extensions[0].codehash).toBe(UNKNOWN_CODEHASH);

    const contract = await testIndexer.StylusContract.getOrThrow(PROGRAM.toLowerCase());
    expect(contract.lastKeepalive).toBeUndefined();
    expect(contract.expiresAt).toBe(TIMESTAMP + EXPIRY_SECONDS);
  });
});

describe('UpdateProgramCache handler', () => {
  const CACHED_AT = TIMESTAMP + 3600; // 1 hour after activation
  const EVICTED_AT = TIMESTAMP + 7200; // 2 hours after activation

  const cacheUpdate = (
    testIndexer: ReturnType<typeof createTestIndexer>,
    codehash: string,
    cached: boolean,
    blockNumber: number,
    timestamp: number,
  ) =>
    testIndexer.process({
      chains: {
        412346: {
          simulate: [
            {
              contract: 'ArbWasmCache',
              event: 'UpdateProgramCache',
              params: { manager: CACHE_MANAGER, codehash, cached },
              block: { number: blockNumber, timestamp },
              transaction: { hash: '0x' + blockNumber.toString(16).padStart(64, '0') },
            },
          ],
        },
      },
    });

  it('sets isCached when the program is cached', async () => {
    // Given an indexer that has activated one program
    const testIndexer = createTestIndexer();
    await activateProgram(testIndexer);

    // When the program is cached
    await cacheUpdate(testIndexer, CODEHASH, true, 200, CACHED_AT);

    // Then the cache event is recorded and the contract reflects it
    const cacheEvents = await testIndexer.CacheEvent.getAll();
    expect(cacheEvents).toHaveLength(1);
    expect(cacheEvents[0].codehash).toBe(CODEHASH);
    expect(cacheEvents[0].cached).toBe(true);

    const contract = await testIndexer.StylusContract.getOrThrow(PROGRAM.toLowerCase());
    expect(contract.isCached).toBe(true);
  });

  it('clears isCached when the program is evicted', async () => {
    // Given an indexer that has activated and cached one program
    const testIndexer = createTestIndexer();
    await activateProgram(testIndexer);
    await cacheUpdate(testIndexer, CODEHASH, true, 200, CACHED_AT);

    // When the program is evicted
    await cacheUpdate(testIndexer, CODEHASH, false, 300, EVICTED_AT);

    // Then both cache events are recorded and the contract reflects the eviction
    const cacheEvents = await testIndexer.CacheEvent.getAll();
    expect(cacheEvents).toHaveLength(2);

    const contract = await testIndexer.StylusContract.getOrThrow(PROGRAM.toLowerCase());
    expect(contract.isCached).toBe(false);
  });

  it('ignores a cache update for an unknown codehash', async () => {
    // Given an indexer that has activated one program
    const testIndexer = createTestIndexer();
    await activateProgram(testIndexer);

    // When a cache update arrives for a codehash no activation ever emitted
    await cacheUpdate(testIndexer, UNKNOWN_CODEHASH, true, 200, CACHED_AT);

    // Then the cache event is still recorded but the existing contract is untouched
    const cacheEvents = await testIndexer.CacheEvent.getAll();
    expect(cacheEvents).toHaveLength(1);
    expect(cacheEvents[0].codehash).toBe(UNKNOWN_CODEHASH);

    const contract = await testIndexer.StylusContract.getOrThrow(PROGRAM.toLowerCase());
    expect(contract.isCached).toBe(false);
  });
});

describe('DailyStats deployer aggregation', () => {
  it('does not count the same deployer twice in one day', async () => {
    // Given an indexer that has activated one program
    const testIndexer = createTestIndexer();
    await activateProgram(testIndexer);

    // When the same deployer activates a second program the same day
    await activate(testIndexer, {
      program: SECOND_PROGRAM,
      deployer: DEPLOYER,
      blockNumber: 200,
      timestamp: TIMESTAMP + 3600,
    });

    // Then activations count but the deployer is only counted once
    const stats = await testIndexer.DailyStats.getOrThrow(getDayId(TIMESTAMP));
    expect(stats.stylusActivations).toBe(2);
    expect(stats.uniqueDeployers).toBe(1);
    expect(stats.cumulativeDeployers).toBe(1);

    const registry = await testIndexer.DeployerRegistry.getAll();
    expect(registry).toHaveLength(1);
    expect(registry[0].id).toBe(DEPLOYER.toLowerCase());
  });

  it('counts a different deployer on the same day', async () => {
    // Given an indexer that has activated one program
    const testIndexer = createTestIndexer();
    await activateProgram(testIndexer);

    // When a second deployer activates a program the same day
    await activate(testIndexer, {
      program: SECOND_PROGRAM,
      deployer: SECOND_DEPLOYER,
      blockNumber: 200,
      timestamp: TIMESTAMP + 3600,
    });

    // Then both deployers are counted
    const stats = await testIndexer.DailyStats.getOrThrow(getDayId(TIMESTAMP));
    expect(stats.uniqueDeployers).toBe(2);
    expect(stats.cumulativeDeployers).toBe(2);
  });

  it('does not count a repeat deployer on a later day, but keeps the cumulative', async () => {
    // Given an indexer that has activated one program
    const testIndexer = createTestIndexer();
    await activateProgram(testIndexer);

    // When the same deployer activates another program the next day
    await activate(testIndexer, {
      program: SECOND_PROGRAM,
      deployer: DEPLOYER,
      blockNumber: 300,
      timestamp: NEXT_DAY,
    });

    // Then the new day counts no first-time deployers and carries the cumulative
    const nextDayStats = await testIndexer.DailyStats.getOrThrow(getDayId(NEXT_DAY));
    expect(nextDayStats.uniqueDeployers).toBe(0);
    expect(nextDayStats.cumulativeDeployers).toBe(1);
    expect(nextDayStats.stylusActivations).toBe(1);
  });

  it('counts a new deployer on a later day and increments the cumulative', async () => {
    // Given an indexer with one deployer on day 1
    const testIndexer = createTestIndexer();
    await activateProgram(testIndexer);

    // When a different deployer activates a program the next day
    await activate(testIndexer, {
      program: SECOND_PROGRAM,
      deployer: SECOND_DEPLOYER,
      blockNumber: 300,
      timestamp: NEXT_DAY,
    });

    // Then the new day counts the first-timer and the cumulative grows
    const nextDayStats = await testIndexer.DailyStats.getOrThrow(getDayId(NEXT_DAY));
    expect(nextDayStats.uniqueDeployers).toBe(1);
    expect(nextDayStats.cumulativeDeployers).toBe(2);
  });

  it('carries the cumulative into a day created by a keepalive', async () => {
    // Given an indexer with one deployer on day 1
    const testIndexer = createTestIndexer();
    await activateProgram(testIndexer);

    // When a keepalive is the first event of a later day
    const KEEPALIVE_DAY = TIMESTAMP + 2 * 24 * 60 * 60;
    await testIndexer.process({
      chains: {
        412346: {
          simulate: [
            {
              contract: 'ArbWasm',
              event: 'ProgramLifetimeExtended',
              params: { codehash: CODEHASH, dataFee: 500n },
              block: { number: 400, timestamp: KEEPALIVE_DAY },
            },
          ],
        },
      },
    });

    // Then the day's row is created carrying the cumulative, with no first-timers
    const stats = await testIndexer.DailyStats.getOrThrow(getDayId(KEEPALIVE_DAY));
    expect(stats.stylusReactivations).toBe(1);
    expect(stats.uniqueDeployers).toBe(0);
    expect(stats.cumulativeDeployers).toBe(1);
  });
});
