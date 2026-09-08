# Fellowship outcomes — dashboard contribution

## Scope

The **Stylus Ecosystem Dashboard** contributes a public observability tool, documentation and a reproducible ecosystem report to the fellowship's release phase. This assessment covers that repository; the second tooling initiative requires its own evidence.

## Delivered capabilities

| Outcome                                                                      | Evidence                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public access to observed Stylus activation indicators on Arbitrum One       | [Dashboard](https://stylus-dashboard.up.railway.app), [dated deployment check](reports/2026-09-08/public-check.json) and its documented Comparison limitation                                                                                       |
| Reusable open-source indexer and frontend                                    | [Repository](https://github.com/CoBuilders-xyz/stylus-dashboard), [MIT license](https://github.com/CoBuilders-xyz/stylus-dashboard/blob/release/LICENSE), [architecture](architecture.md)                                                           |
| Activation, keepalive and cache-state ingestion plus EVM creation comparison | [Handlers](https://github.com/CoBuilders-xyz/stylus-dashboard/tree/release/packages/indexer/src/handlers), [schema](https://github.com/CoBuilders-xyz/stylus-dashboard/blob/release/packages/indexer/schema.graphql), [methodology](methodology.md) |
| Contract exploration and activating-wallet indicators                        | Contracts filters/pagination, Builders leaderboard and recurrence indicators; [usage guide](usage.md)                                                                                                                                               |
| Automated validation                                                         | [CI](https://github.com/CoBuilders-xyz/stylus-dashboard/blob/release/.github/workflows/ci.yml), [Nitro integration](https://github.com/CoBuilders-xyz/stylus-dashboard/blob/release/.github/workflows/integration.yml), unit and component tests    |
| Reproducible ecosystem baseline                                              | [Public-data snapshot and report](reports/2026-09-08/README.md), [capture and analysis scripts](https://github.com/CoBuilders-xyz/stylus-dashboard/tree/release/scripts/report)                                                                     |
| Handoff documentation                                                        | [Documentation index](README.md), [operations](deployment.md), [release evidence](release.md)                                                                                                                                                       |

Implementation ran from July through September 2026. The indexed chain history begins in September 2024 and therefore predates the fellowship work.

## Engineering lessons

**Metric definitions need to accompany the UI.** Activation addresses, codehashes, deployments and executed calls answer different questions. The methodology documents those distinctions, along with retention windows and estimated expiry.

**Test public queries, not just routes.** Production lacked a required aggregate permission even though HTTP checks and prior CI passed. The release adds a read-only checker for real dashboard queries. Integration coverage should also assert `DeployerRegistry_aggregate` access.

**Backfills need bounded resource use.** Trace windows, limited preload batches, per-page extraction and cached effects control memory and upstream requests. Operators still need to monitor block progress and rate limits.

**Verify restart behavior.** The current Docker command resets storage. The operations guide records the finding and a procedure for validating persistent startup.

**Freeze report inputs.** Snapshot and query hashes make the analysis reproducible. Completed UTC periods make recent activity comparable.

## Ecosystem findings and recommended follow-up

The [report](reports/2026-09-08/README.md) observes 1,041 activation-seen program addresses and 95 wallets, concentrated among a small set of wallets, with fewer first activations in the latest completed 30-day period.

Priorities:

1. Complete release publication; address Comparison permissions and persistent startup.
2. Validate address/codehash coverage and correct codehash-to-many-address state propagation.
3. Design interaction tracking with a separate daily-activity schema and external reference checks.
4. Review query indexes and historical aggregate semantics as the dataset grows.
5. Collect dashboard user feedback and usage evidence for the next retrospective.

## Impact not measured in this package

Visitor analytics, user feedback and external integrations were not measured. The on-chain report cannot show whether the dashboard caused adoption. A broader retrospective needs participant and stakeholder evidence alongside the software deliverables.
