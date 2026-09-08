# Fellowship outcomes — dashboard contribution

## Scope

This document records the **Stylus Ecosystem Dashboard** contribution to the fellowship's Public Release and Documentation & Ecosystem Report phases. It does not certify the second tooling initiative, other repositories or cohort-wide outcomes. It separates delivered software capabilities from ecosystem findings and unmeasured impact.

## Delivered capabilities

| Outcome                                                                      | Evidence                                                                                                                                                      |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public access to observed Stylus activation indicators on Arbitrum One       | [Dashboard](https://stylus-dashboard.up.railway.app), [dated deployment check](reports/2026-09-08/public-check.json) and its documented Comparison limitation |
| Reusable open-source indexer and frontend                                    | [Repository](https://github.com/CoBuilders-xyz/stylus-dashboard), [MIT license](../LICENSE), [architecture](architecture.md)                                  |
| Activation, keepalive and cache-state ingestion plus EVM creation comparison | [Handlers](../packages/indexer/src/handlers), [schema](../packages/indexer/schema.graphql), [methodology](methodology.md)                                     |
| Contract exploration and activating-wallet indicators                        | Contracts filters/pagination, Builders leaderboard and recurrence indicators; [usage guide](usage.md)                                                         |
| Automated validation                                                         | [CI](../.github/workflows/ci.yml), [Nitro integration](../.github/workflows/integration.yml), unit and component tests                                        |
| Reproducible ecosystem baseline                                              | [Public-data snapshot and report](reports/2026-09-08/README.md), [capture and analysis scripts](../scripts/report)                                            |
| Handoff documentation                                                        | [Documentation index](README.md), [operations](../DEPLOY-RAILWAY.md), [release evidence](release.md)                                                          |

The implementation history runs from the July 2026 scaffold through September 2026 dashboard improvements. The chain dataset begins in September 2024, before that implementation work; historical chain growth is not attributed to the fellowship.

## Engineering lessons

**Definitions are part of the product.** Activation addresses, unique codehashes, deployment addresses and executed calls answer different questions. The release documentation makes this distinction explicit and explains the existing comparison/retention labels and Health placeholders. It does not change the application.

**Aggregate APIs need deployment evidence.** Counts moved into database aggregates to bound dashboard queries. The release audit found that production's public role lacked one required aggregate even though route HTTP checks and prior CI were green. The existing integration assertion covers only the Stylus contract aggregate. The release adds a separate read-only smoke checker that runs real dashboard queries without credentials; extending integration coverage is a future application task.

**Historical indexing requires resource controls.** Windowed trace queries, limited preload batches, per-page extraction, bounded retries/timeouts and cached effects address memory and upstream availability constraints. These controls still require operational monitoring; a running process is not sufficient proof of freshness.

**Persisted state is a release concern.** The current Docker command includes an unconditional reset. The release documents its implications, backups and a proposed resume/restart verification procedure; changing that command is separate operational work.

**Reproducibility improves conclusions.** A frozen snapshot with query hashes and consistency checks makes the report inspectable. Completed UTC windows avoid interpreting today's partial data as a full day's activity.

## Ecosystem findings and recommended follow-up

The [report](reports/2026-09-08/README.md) observes 1,041 activation-seen program addresses and 95 wallets, concentrated among a small set of wallets, with fewer first activations in the latest completed 30-day period. These findings support improving address discovery, separating usage from activation, validating lifecycle estimates and continuing periodic reports with consistent definitions.

Suggested follow-up order:

1. Publish the reviewed documentation/report package and separately address Comparison permissions and startup behavior.
2. Validate address/codehash coverage and correct codehash-to-many-address state propagation.
3. Design interaction tracking with a separate daily-activity schema and external reference checks.
4. Review query indexes and historical aggregate semantics as the dataset grows.
5. Gather feedback from actual dashboard users and report usage or maintenance outcomes only when evidence exists.

## Impact not measured in this package

This package does not contain visitor analytics, named user testimonials, verified counts of independent teams, evidence of external integrators, financial impact or proof that the dashboard caused Stylus adoption. It claims delivery of a public observability tool, documentation and a reproducible baseline. Any broader fellowship retrospective should add separately sourced participant experience, timeline and stakeholder feedback rather than infer them from on-chain totals.
