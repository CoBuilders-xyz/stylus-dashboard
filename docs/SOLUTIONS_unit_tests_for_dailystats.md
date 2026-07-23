## Unit Tests for DailyStats Aggregation Coverage

This solution provides comprehensive unit tests for the `DailyStats` aggregation logic within `packages/indexer/handlers.test.ts`. The existing coverage gap related to how daily statistics are updated across different activation cycles, deployer states (new vs. repeat), and day transitions is addressed by implementing a suite of targeted tests.

### Testing Strategy Overview

The tests simulate the sequence of events that occur when an indexer processes transactions or data records over time. We focus on mocking the internal state storage mechanism to ensure that daily counts are correctly managed, reset at midnight (or conceptually between days), and accurately reflect changes based on whether the deployer identity is new or recurring within a single day's scope.

### File: `packages/indexer/test/handlers.test.ts`

```typescript
import { DailyStatsHandler } from '../src/daily-stats.handler';
import { MockStateStorage, EventData } from '../../mocks/mock-state.storage'; 
// Assuming necessary imports for handler and mock state storage exist

describe('DailyStatsHandler Aggregation Logic Coverage', () => {
    let mockState: Partial<MockStateStorage>;
    let dailyStatsHandler: DailyStatsHandler;

    /**
     * Setup a fresh environment before each test suite.
     */
    beforeEach(() => {
        // Initialize the handler and reset the mock state storage for isolation.
        mockState = { 
            initialize: jest.fn(), 
            get: jest.fn(), 
            set: jest.fn() 
        };
        dailyStatsHandler = new DailyStatsHandler(mockState as MockStateStorage);

        // Reset all mock implementations to ensure clean state for each test.
        jest.clearAllMocks();
    });


    /**
     * Test Scenario Group 1: First Activation of a Day (Day Start)
     * Ensures that when the handler processes data and no existing daily stats are found, 
     * it correctly initializes all required metrics for the new day's count.
     */
    describe('Scenario 1: First Daily Activation', () => {

        // Mock setup for a successful initial read (nothing found)
        beforeEach(() => {
            (mockState.get as jest.Mock).mockReturnValue(null); // Simulate no prior record
            const mockEvent: EventData = { 
                date: '2024-10-27', 
                deployerId: 'AliceSmith_XYZ',
                transactionHash: 'txA'
            };

            // Execute the handler with initial data
            dailyStatsHandler.handle(mockEvent);
        });

        test('should initialize all counters correctly upon first activation of a day', async () => {
            // Assert that 'get' was called for the specific date key.
            expect((mockState.get as jest.Mock)).toHaveBeenCalledWith('DAILY_STATS_KEY'); 
            
            // Assert that 'set' was called exactly once, simulating the creation of a new record.
            expect((mockState.set as jest.Mock)).toHaveBeenCalledTimes(1);

            const expectedStats = {
                day: '2024-10-27',
                totalActivations: 1,
                uniqueDeployers: 1, // Since this is the first one
                deployerMetrics: {
                    'AliceSmith_XYZ': { activations: 1 }
                }
            };

            // Verify that the state was set with the initial correct structure.
            expect((mockState.set as jest.Mock)).toHaveBeenCalledWith(
                'DAILY_STATS_KEY', 
                expectedStats
            );
        });


        /**
         * Test Scenario Group 2: Second Activation Same Day (Incrementing State)
         * Ensures that the handler correctly reads existing state, increments overall counters, 
         * and updates individual deployer metrics without resetting data.
         */
        describe('Scenario 2: Subsequent Activation Same Day', () => {
            const dayKey = '2024-10-27';
            let previousState;

            // Mock setup to simulate the state existing from a previous run on the same day
            beforeEach(() => {
                previousState = {
                    day: dayKey,
                    totalActivations: 1, // Starts at 1 (from Scenario 1)
                    uniqueDeployers: 1,
                    deployerMetrics: {
                        'AliceSmith_XYZ': { activations: 1 }
                    }
                };
                (mockState.get as jest.Mock).mockReturnValue(previousState); // Return existing state
            });


            test('should increment overall stats (totalActivations) when processing subsequent events', async () => {
                const mockEvent: EventData = { 
                    date: '2024-10-27', 
                    deployerId: 'AliceSmith_XYZ', // Same deployer
                    transactionHash: 'txB'
                };

                // Execute the handler for the second event
                dailyStatsHandler.handle(mockEvent);

                // Expect 'set' to be called again, overwriting the old state with new totals.
                expect((mockState.set as jest.Mock)).toHaveBeenCalledTimes(1);

                const expectedStats = {
                    day: dayKey,
                    totalActivations: 2, // Incremented from 1 -> 2
                    uniqueDeployers: 1,  // Remains the same
                    deployerMetrics: {
                        'AliceSmith_XYZ': { activations: 2 } // Deployer metric incremented
                    }
                };

                expect((mockState.set as jest.Mock)).toHaveBeenCalledWith(
                    'DAILY_STATS_KEY', 
                    expectedStats
                );
            });


             /**
             * Test Scenario Group 3: New vs. Repeat Deployers
             * Verifies that the mechanism correctly distinguishes between a deployer who has appeared 
             * before today and one whose first appearance contributes to 'uniqueDeployers'.
             */
            describe('Scenario 3: Handling Unique vs. Repeat Deployers', () => {

                test('should increment uniqueDeployers count when processing data from a new, unseen deployer ID', async () => {
                    const dayKey = '2024-10-27';
                    // Initial state setup (Alice was seen once)
                    (mockState.get as jest.Mock).mockReturnValue({
                        day: dayKey,
                        totalActivations: 1,
                        uniqueDeployers: 1,
                        deployerMetrics: {
                            'AliceSmith_XYZ': { activations: 1 }
                        }
                    });

                    const newDeployerId = 'BobJohnson_DEF';
                    const mockEvent: EventData = { 
                        date: dayKey, 
                        deployerId: newDeployerId, // New deployer ID
                        transactionHash: 'txC'
                    };

                    // Execute the handler for Bob (the second unique person)
                    await dailyStatsHandler.handle(mockEvent);
                    
                    // Assert that total activations increased by 1
                    // Assert that unique deployers also increased by 1 (1 -> 2)
                    expect((mockState.set as jest.Mock)).toHaveBeenCalledTimes(1);

                    const expectedStats = {
                        day: dayKey,
                        totalActivations: 2, // Total +1
                        uniqueDeployers: 2,  // Unique +1 (Crucial Test Point)
                        deployerMetrics: {
                            'AliceSmith_XYZ': { activations: 1 }, // Alice unchanged
                            [newDeployerId]: { activations: 1 }  // Bob initialized
                        }
                    };

                    expect((mockState.set as jest.Mock)).toHaveBeenCalledWith(
                        'DAILY_STATS_KEY', 
                        expectedStats
                    );
                });


                test('should only increment metrics (totalActivations, deployerMetrics) for a repeat deployer when state exists', async () => {
                     // Setup: State exists with two unique deployers (Alice and Bob seen before)
                    const dayKey = '2024-10-27';
                    (mockState.get as jest.Mock).mockReturnValue({
                        day: dayKey,
                        totalActivations: 2, // Initial count from previous events
                        uniqueDeployers: 2,
                        deployerMetrics: {
                            'AliceSmith_XYZ': { activations: 1 },
                            'BobJohnson_DEF': { activations: 1 }
                        }
                    });

                    const repeatDeployerId = 'AliceSmith_XYZ';
                    const mockEvent: EventData = { 
                        date: dayKey, 
                        deployerId: repeatDeployerId, // Repeat deployer ID
                        transactionHash: 'txD'
                    };

                    // Execute the handler for Alice (the third total activation)
                    await dailyStatsHandler.handle(mockEvent);
                    
                    // Assert state update
                    expect((mockState.set as jest.Mock)).toHaveBeenCalledTimes(1);
                    
                    const expectedStats = {
                        day: dayKey,
                        totalActivations: 3, // Total +1
                        uniqueDeployers: 2,  // Unique remains stable (Correctly ignores the repeat)
                        deployerMetrics: {
                            'AliceSmith_XYZ': { activations: 2 }, // Only Alice updated
                            'BobJohnson_DEF': { activations: 1 }
                        }
                    };

                    expect((mockState.set as jest.Mock)).toHaveBeenCalledWith(
                        'DAILY_STATS_KEY', 
                        expectedStats
                    );
                });
            });
        });


    /**
     * Test Scenario Group 4: Day Transition / Reset (Conceptual Test)
     * While the indexer itself handles date comparisons, this test ensures that if a new day's data comes in, 
     * the handler correctly treats it as a fresh start, regardless of previous state.
     */
    describe('Scenario 4: Day Change / New Date Key', () => {
        const initialDay = '2024-10-27';
        const newDay = '2024-10-28';

        test('should reset all daily statistics when the processing date changes to a new day', async () => {
            // 1. Mock: State exists for the OLD DAY (Oct 27)
            (mockState.get as jest.Mock).mockReturnValue({
                day: initialDay,
                totalActivations: 5,
                uniqueDeployers: 3,
                deployerMetrics: { 'A': { activations: 5 } }
            });

            // Mock the incoming event for the NEW DAY (Oct 28)
            const newEvent: EventData = { 
                date: newDay, 
                deployerId: 'NewStartDeployer',
                transactionHash: 'txNew'
            };

            // Execute handler with data from a different date
            await dailyStatsHandler.handle(newEvent);

             // Assert that the set operation used the correct (new) day key and reset counters to 1.
            expect((mockState.set as jest.Mock)).toHaveBeenCalledTimes(1);

            const expectedStats = {
                day: newDay, // Key confirmation for the new day
                totalActivations: 1,
                uniqueDeployers: 1,
                deployerMetrics: {
                    'NewStartDeployer': { activations: 1 }
                }
            };

            expect((mockState.set as jest.Mock)).toHaveBeenCalledWith(
                'DAILY_STATS_KEY', 
                expectedStats
            );
        });
    });

});
```