# Metric methodology

## Scope and evidence

The production dataset covers **Arbitrum One (chain 42161)**, starting at block **249,710,000**. Its first indexed activity day is 3 September 2024. It does not cover every Arbitrum chain or Orbit deployment. Local chain 412346 is for development only.

Implementation sources: [schema](https://github.com/CoBuilders-xyz/stylus-dashboard/blob/release/packages/indexer/schema.graphql), [Stylus handlers](https://github.com/CoBuilders-xyz/stylus-dashboard/blob/release/packages/indexer/src/handlers/ArbWasm.ts), [creation handlers](https://github.com/CoBuilders-xyz/stylus-dashboard/blob/release/packages/indexer/src/handlers/EvmDeployments.ts), [queries](https://github.com/CoBuilders-xyz/stylus-dashboard/blob/release/apps/web/src/lib/graphql/queries.ts) and [frontend calculations](https://github.com/CoBuilders-xyz/stylus-dashboard/blob/release/apps/web/src/lib/utils.ts).

## What gets counted

**Stylus contracts:** unique program addresses observed in `ArbWasm.ProgramActivated` events. The first event for an address creates a `StylusContract`; later activations of that address update its state and count as reactivations. `activatedAt`, `activatedBlock` and `deployer` retain the first observed activation's values.

**Coverage limitation:** activation is associated with a codehash. A contract reusing already-activated code may not emit its own activation event. The count therefore covers activation-observed addresses, not every deployed WASM address. Filtering Stylus bytecode out of EVM counts does not add those addresses to the Stylus dataset. The current handlers retain this coverage gap ([original issue #63](https://github.com/CoBuilders-xyz/stylus-dashboard/issues/63)).

**EVM contracts:** unique addresses from successful creation traces within the indexing window. Mainnet tracing includes internal creations. Known Stylus addresses, bytecode starting with `0xeff000`, and candidates matching the configured Stylus deployer exclusion are filtered out. If an address already counted as EVM later emits a Stylus activation, the EVM row and relevant daily totals are reconciled. Counts deduplicate addresses, so repeated creation at the same address is not a separate contract. The label EVM includes all source languages; the indexer does not identify Solidity.

**Deployer / builder:** an address, not a verified person, team or project. On the Stylus side it is the sender of the first observed activation transaction, which may differ from the actual deployment sender. On the EVM side it is the creation transaction sender, falling back to the trace sender if the transaction sender is unavailable. Shared wallets and multiple wallets per actor also limit interpretation of cross-VM overlap.

## Metric dictionary

| Metric                   | Definition and period                                                                                                                                                                                                                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stylus Contracts         | Current `StylusContract_aggregate` count; all observed history, including estimated expired programs.                                                                                                                                                                                                     |
| Unique Deployers         | `GlobalStats.cumulativeDeployers`; addresses with at least one first observed Stylus activation. Despite its generic name, this is Stylus-only.                                                                                                                                                           |
| Activations (Overview)   | Sum of `DailyStats.stylusActivations` for 30 UTC calendar dates ending today; today's date is partial.                                                                                                                                                                                                    |
| Reactivations (Overview) | Sum of repeated activation events and `ProgramLifetimeExtended` events in that window.                                                                                                                                                                                                                    |
| Avg Contracts/Deployer   | Current observed Stylus contracts / unique Stylus deployer addresses.                                                                                                                                                                                                                                     |
| Repeat Builders          | Addresses with more than one first observed Stylus contract activation.                                                                                                                                                                                                                                   |
| New This Week            | Addresses first seen activating Stylus during seven UTC calendar dates ending today.                                                                                                                                                                                                                      |
| Retention (>1 week)      | Addresses with first activations in at least two distinct fixed seven-day windows / unique Stylus deployers. Windows are `floor(timestamp / 604800)` from Unix epoch, not calendar weeks or a rolling cohort. Two events across a boundary need not be seven days apart. Keepalives alone do not qualify. |
| WASM Share               | Observed Stylus address count / (observed Stylus address count + EVM address count). A relative indicator for these two datasets, not transaction, gas, user or revenue share.                                                                                                                            |
| WASM Share, 7d           | New observed Stylus activations / (new observed Stylus activations + EVM creations), summed over seven UTC dates ending today.                                                                                                                                                                            |
| Deploys / day (30d avg)  | Each side's summed new observations / 30, including quiet days and today's partial day. The Stylus timestamp is activation time; EVM uses creation time.                                                                                                                                                  |
| Deployer Overlap         | Registry addresses classified `both` / (`evm` + `both`). Requires public `DeployerRegistry_aggregate` permission. An overlap does not establish migration or causal adoption.                                                                                                                             |
| Reactivation Rate        | Recent-window reactivations and keepalives / new activations. Can exceed 100%; undefined denominator displays a dash. Change is percentage points versus the preceding window.                                                                                                                            |

The Health calculation compares daily row timestamps to `now - 7 days` and `now - 14 days`. Since rows represent UTC midnight, the oldest partial date is excluded and today is included. This is not an exact trailing 168-hour event count. The report uses **completed UTC days** for period comparisons and states those boundaries separately.

## Expiry and cache

`expiresAt` is estimated as the latest observed activation or keepalive timestamp plus **365 days**. The indexer does not query live protocol parameters or execution readiness. It uses one `CodehashIndex` mapping per hash; later mappings replace earlier ones, so keepalive/cache updates do not fan out to all addresses sharing code. Unknown hashes retain their event records but cannot update a contract row.

Health uses the following partition, evaluated with the clock rounded down to the hour:

- Expired: estimated expiry before the reference hour.
- Expiring Soon: expiry from that hour up to, but excluding, seven days later.
- Active: all remaining rows, including unknown expiry (`null`).

The expiry histogram has expired, under 7 days, 7–30, 30–90, 90–180 and 180+ day buckets. Unknown expiry is included in the last bucket for compatibility and must not be interpreted as verified remaining lifetime.

Contracts uses the current clock and prioritizes expired, then expiring within **seven days inclusive**, then cached, then active. Its Cached filter means cached and outside the expiry-warning window; its Active filter means uncached and outside that window. Consequently those labels differ slightly at the time boundaries and from Health's cache-independent Active slice.

`isCached` records the latest mapped cache event. It does not measure cache bytes, capacity utilization, hit rate or execution volume. Health shows placeholder cards for Avg Lifetime, Cached Contracts and Cache Events; those displays are not implemented measurements. Observed cache status remains available on contract rows and in the report snapshot.

## Time series, freshness and historical totals

Daily rows use UTC. Overview/Comparison charts support 7d, 30d and All, fill absent dates with zero within the selected series and include the current partial day. Missing rows can also result from incomplete indexing, so inspect indexer readiness before interpreting a quiet period. Main cards generally poll every five seconds; full history/growth queries poll every 60 seconds. Polling frequency is not a guarantee of chain freshness or finality.

The `_meta` query exposes source and processed block progress. Near the head, EVM creations are collected in 300-block windows and can lag Stylus events. A report capture is a sequence of live queries; it is not a database transaction pinned to one block. Store start/end metadata and consistency checks alongside the data.

`DailyStats.totalStylusContracts` is a **legacy per-day counter**, despite its name. Do not treat an individual row as a cumulative total. Overview currently displays this field as Total Contracts in the daily table, and the schema describes it as cumulative. Use `StylusContract_aggregate` for the current total or the cumulative sum of `stylusActivations` for a reconstructed series. See [issue #48](https://github.com/CoBuilders-xyz/stylus-dashboard/issues/48). Historical `DailyStats.cumulativeDeployers` can reflect processing order between handlers; the report reconstructs growth from first-activation timestamps instead.

## Conclusions these data do not support

Activations do not establish production use or fellowship impact. The dashboard has no measurements of executed calls, active users, transaction volume, fees, gas savings or TVL. It also does not identify source languages or independent teams. [Interaction tracking](https://github.com/CoBuilders-xyz/stylus-dashboard/issues/29) remains future work.
