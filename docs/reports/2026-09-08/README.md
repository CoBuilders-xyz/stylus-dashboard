# Stylus adoption observations — 8 September 2026

The Stylus Ecosystem Dashboard recorded **1,041 program addresses with observed activation events, attributed to 95 wallets**, on Arbitrum One. Activity in this dataset is concentrated: five wallets account for **61.4%** of observed addresses. The latest 30 completed UTC days contain **15 new observed activations**, compared with **27** in the preceding 30 days.

This is an activation-based baseline. Coverage and attribution limits are summarized below and defined in the [methodology](../../methodology.md).

## Data provenance and cutoff

| Property                              | Value                                                                                                    |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Public source                         | [Dashboard GraphQL](https://stylus-dashboard-hql.up.railway.app/v1/graphql), queried without credentials |
| Capture interval                      | 2026-09-08 18:33:07–18:33:19 UTC                                                                         |
| Chain                                 | Arbitrum One, 42161                                                                                      |
| Configured start                      | Block 249,710,000                                                                                        |
| First daily observation               | 2024-09-03                                                                                               |
| Final observed processed/source block | 503,109,204 / 503,109,204                                                                                |
| Indexer readiness                     | `_meta.isReady = true` before and after capture                                                          |
| Deployed code observed                | `4ad27299f088397f2573a98e9d53a6b88076ba6e`                                                               |
| Period-comparison cutoff              | 2026-09-08 00:00:00 UTC, exclusive                                                                       |
| Expiry estimate reference             | 2026-09-08 18:00:00 UTC                                                                                  |

[Snapshot](snapshot.json) contains 736 daily rows, 1,041 program rows, 95 Stylus registry rows, exact queries and variables, and before/after consistency checks. [Deployment provenance](deployment.json) records the running versions. Capture used sequential live queries rather than a block-pinned transaction; the stored totals reconcile, but readiness does not independently establish chain finality.

## Findings

### 1. Repeat participation: 57 of 95 wallets

The captured registry contains 95 wallets, with 57 associated with more than one observed program address (**60.0%**). Of those 95 wallets, 24 appear in multiple fixed seven-day activation windows (**25.3%**). These are activating wallets, not independent developers. The fixed-window measure is not weekly cohort retention.

The cumulative-wallet chart below is reconstructed from `firstStylusAt`, avoiding legacy daily cumulative-field semantics. Monthly activations vary substantially; the latest partial month must not be compared directly with complete months.

![Activation history, wallet growth and concentration](adoption.png)

[Download the vector figure](adoption.svg). The first two panels exclude 8 September's incomplete UTC day; concentration uses the complete captured address population at capture time.

### 2. First activations fell 44.4% in the latest 30 days

| Indicator                               | 10 Jul–8 Aug 2026 | 9 Aug–7 Sep 2026 |
| --------------------------------------- | ----------------: | ---------------: |
| New observed Stylus activations         |                27 |               15 |
| Wallets sending those first activations |                 6 |                5 |
| First-time Stylus wallets               |                 5 |                3 |
| Reactivation/keepalive events           |                 0 |               20 |
| EVM creations                           |           575,272 |          950,255 |
| Observed Stylus share of the two flows  |         0.004693% |        0.001578% |

New activations fell by **44.4%** between these two completed 30-day windows. The latter period includes three new wallets and 20 maintenance events; these counts do not explain the decline. The last seven completed days, 1–7 September, contain two first activations from one wallet and no first-time wallets.

Dashboard 30d cards include today, so their totals can differ from these completed periods.

### 3. Five wallets account for 61.4% of addresses

The largest activating wallet accounts for **409 of 1,041 addresses (39.3%)**. The five largest account for **639 (61.4%)**, and the ten largest for **779 (74.8%)**. The remaining 85 wallets account for 262 addresses.

A few wallets' deployment practices can therefore move the total substantially. Report wallet breadth and recurrence alongside address volume. [metrics.json](metrics.json) preserves the addresses and counts; no project or team identities were verified.

### 4. Observed Stylus address share is 0.010845%

The snapshot contains **9,597,626 EVM addresses** within the configured coverage. The dashboard formula gives `1,041 / (1,041 + 9,597,626) × 100 = 0.010845%` observed WASM share.

This ratio compares activation-observed Stylus addresses with trace-observed EVM creations. Shared activated code can leave Stylus addresses uncounted, and the two sides use different event timestamps. This ratio does not measure execution or economic activity.

Among the 95 observed Stylus wallets, **46** are classified `both` in the registry. The percentage of all EVM deployers using Stylus could not be calculated: its public aggregate was unavailable, and capture did not download the full EVM registry.

### 5. 712 records have estimated expiry in the past

At the reference hour, **712** captured program records have estimated expiry in the past, **one** is within the next seven days, and **328** are in the remaining Active partition. No captured record has null expiry. Separately, **140** records have an observed cached flag; cache flags overlap expiry states and must not be added to that partition.

The estimates use a fixed 365-day lifetime from the latest mapped activation/keepalive. Codehash mappings update one address rather than all addresses sharing code. Protocol-aware validation is needed before interpreting these records as unusable or abandoned programs.

## Quality checks and limitations

All seven [snapshot checks](snapshot.json) passed: program rows matched the aggregate, daily activation sum and per-wallet totals; wallet rows matched the global count; daily EVM creations matched the global count; every program was on chain 42161; and the indexer was ready before and after capture. These checks establish internal consistency, not complete chain coverage.

The [public deployment check](public-check.json) passed five HTTP routes and seven of eight dashboard queries. Comparison failed because the public role lacked `DeployerRegistry_aggregate`; the report’s other queries succeeded. The [operator repair](../../deployment.md#existing-public-aggregate-permissions) remains pending.

Coverage is limited to Arbitrum One and activation-based discovery. Wallet identity, shared-code state and estimated expiry have the limits described above. The dataset contains no executed-call or user-analytics measurements and cannot establish fellowship impact.

## Recommendations

1. **Publish volume together with breadth and concentration.** Continue reporting first-time wallets and returning wallets alongside addresses, using explicit UTC cutoffs. Validate large contributors before treating a volume change as broad ecosystem growth.
2. **Improve Stylus address discovery.** Add a distinct bytecode-based address inventory, including shared activated code, while keeping first activations as a separate metric. Reconcile it against known on-chain examples before changing the comparison denominator.
3. **Measure usage separately.** Research call/interaction tracking and define daily active programs from executed calls. Do not repurpose expiry status as activity.
4. **Validate lifecycle estimates.** Resolve codehash-to-many-address propagation and protocol lifetime parameters before treating expiry/cache results as operational recommendations.
5. **Keep the public evidence reproducible.** Repair Comparison aggregate access, verify normal restarts, preserve each report's snapshot and queries, and repeat the completed-period analysis at a regular interval.

For delivered capabilities and engineering lessons, see [fellowship outcomes](../../fellowship-outcomes.md).

## Reproduce the results

Metrics need Python 3 and its standard library; figures additionally need the pinned Matplotlib dependency. From the repository root:

```bash
# Recompute from the exact committed snapshot, without network requests
python3 scripts/report/analyze.py docs/reports/2026-09-08/snapshot.json \
  --output /tmp/stylus-report-reproduction

# Optional: reproduce figures in an isolated environment
python3 -m venv /tmp/stylus-report-venv
/tmp/stylus-report-venv/bin/pip install -r scripts/report/requirements.txt
/tmp/stylus-report-venv/bin/python scripts/report/analyze.py \
  docs/reports/2026-09-08/snapshot.json \
  --output /tmp/stylus-report-reproduction --figures

# Capture a NEW live snapshot; use a new filename, not the report's frozen input
python3 scripts/report/capture.py --output /tmp/stylus-report-new-snapshot.json
```

`analyze.py` refuses snapshots with failed recorded checks. Live captures can fail reconciliation while indexing advances; investigate or recapture. Capture paginates by ordered IDs until an empty page and aborts on HTTP/GraphQL errors.

The committed snapshot's SHA-256 is `83815c00d5df503247365991d58395885aeefb02e86010f75e01e2c4aba6d6a9`. [metrics.json](metrics.json) records that hash and all derived values used here. Public evidence artifacts in this folder are distributed with the repository's [MIT license](https://github.com/CoBuilders-xyz/stylus-dashboard/blob/release/LICENSE).
