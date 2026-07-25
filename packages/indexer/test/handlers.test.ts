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

describe('ProgramActivated handler', () => {
  const CODEHASH = '0x' + 'ab'.repeat(32);
  const UNKNOWN_CODEHASH = '0x' + 'ee'.repeat(32);
  const MODULE_HASH = '0x' + 'cd'.repeat(32);
  const PROGRAM = '0x525c2aBA45F66102bC4F45cA629C93F0f0dcC9e8';
  const DEPLOYER = '0xF39FD6e51aad88F6F4ce6aB8827279cffFb92266';
  const TIMESTAMP = 1705318200; // 2024-01-15 12:30:00 UTC

  const activateProgram = (testIndexer: ReturnType<typeof createTestIndexer>) =>
    testIndexer.process({
      chains: {
        412346: {
          simulate: [
            {
              contract: 'ArbWasm',
              event: 'ProgramActivated',
              params: {
                codehash: CODEHASH,
                moduleHash: MODULE_HASH,
                program: PROGRAM,
                dataFee: 1000n,
                version: 2n,
              },
              block: { timestamp: TIMESTAMP },
              transaction: { from: DEPLOYER },
            },
          ],
        },
      },
    });

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
