# Usage guide

Open the [public dashboard](https://stylus-dashboard.up.railway.app). Reading the dashboard does not require a wallet connection, account, token or transaction. Data comes from Arbitrum One; consult the [methodology](methodology.md) for coverage and definitions.

Screenshots below were captured directly from the **existing public dashboard on 8 September 2026**. This release documents the current application. Live values can differ from the frozen report.

## Overview

![Overview](images/overview.png)

The contract and deployer cards cover all indexed history. Activations and Reactivations cover 30 UTC dates ending today. Changing the chart's **7d / 30d / All** control changes that chart, not the KPI period. Today's date is incomplete. The recent-contract table contains ten entries, not the entire dataset. The daily table’s Total Contracts column is currently a per-day counter despite its label; use the top Stylus Contracts card for the current total.

Daily Activations shows first observations of program addresses in activation events. Reactivations include repeated activations and keepalives. They do not represent all calls to a program.

## Contracts

![Contracts](images/contracts.png)

Use the status buttons, full deployer address and From/To activation dates to narrow the table. Multiple statuses are combined with OR; status, deployer and dates are combined with AND. Both date endpoints refer to UTC dates and the To date includes the whole day. Deployer matching is exact and normalized to lowercase, not a partial-address search.

Click sortable column headings to change ordering. Pagination returns 20 rows per page and the count reflects the same filters. Filtering returns to the first page. Filters and sorting are encoded in the URL, so a copied URL preserves the view.

Example: [programs activated during August 2026](https://stylus-dashboard.up.railway.app/contracts?from=2026-08-01&to=2026-08-31). To investigate one wallet, click its contract count on Builders or paste its full address into the deployer filter. Address links open Arbiscan for independent inspection.

Status priority is Expired, Expiring within seven days, Cached, then Active. These statuses use estimated expiry. A cached program close to expiry appears as Expiring; the Cached filter therefore does not return every row whose raw `isCached` field is true.

## Builders

![Builders](images/builders.png)

Unique Deployers counts activating wallets. Repeat Builders counts wallets associated with more than one first observed program activation. New This Week covers seven UTC dates ending today. The card labeled Retention (>1 week) is the fraction observed activating new programs in multiple fixed seven-day windows; it is not weekly cohort retention.

The leaderboard shows the top ten wallets. Click a Contracts value to inspect the associated records. Several wallets may belong to one organization, and one shared wallet may serve several developers. Use the leaderboard to inspect concentration, not to infer the number of independent teams.

## Health

![Health](images/health.png)

Read Health as **estimated activation state**. The pie partitions records into Active, Expiring Soon and Expired. The histogram groups estimated remaining time; both use the same hour-rounded reference time. An expired estimate is not proof that the program is unused or cannot execute now.

Reactivation Rate divides repeated activations plus keepalives by new activations in the recent window. It may exceed 100%. A dash means that its denominator is zero. The change annotation is percentage points compared with the prior window. Observed cache status is available in Contracts; average lifetime and a cache-event chart are not implemented in this release.

## Stylus vs Solidity (EVM comparison)

[Open Comparison](https://stylus-dashboard.up.railway.app/comparison) to compare observed Stylus activations with EVM creations. The application labels this page Stylus vs Solidity, but the underlying comparison includes all EVM source languages. This guide uses EVM when describing its measurements.

WASM Share uses the two indexed contract populations as its denominator. Total Contracts and Deployers cover indexed history; Deploys/day averages the latest 30 UTC dates. The 7d share annotation is a window-specific share, not percentage-point growth. The daily count chart uses a logarithmic axis because EVM counts are much larger. The share chart normalizes each day's two counts. Both charts share the selected period: changing either period control updates both charts.

Deployer Overlap asks how many registry addresses classified as EVM have also been observed on the Stylus side. It requires public aggregate permissions. At the report's capture time, this permission was missing in production; the [operations guide](../DEPLOY-RAILWAY.md#existing-public-aggregate-permissions) contains the repair and [release record](release.md) tracks verification. No successful Comparison screenshot is claimed for that production state.

## Navigation, sharing and refresh

Use the sidebar on a desktop-width screen to switch between sections. The current sidebar is hidden below its desktop breakpoint; on a narrow screen, use the direct page links in this guide. The theme control in the sidebar switches light/dark appearance. This documentation release does not change navigation.

Most main queries refresh every five seconds; full-history/growth queries use 60 seconds. A chart can show loading separately from the main cards. A data error or dash is not a zero-adoption finding. Use Retry where available or reload the page, then check the [release record](release.md) or file a [bug](https://github.com/CoBuilders-xyz/stylus-dashboard/issues/new?template=bug.yml) with route, time, filters and error text.

For a shareable, fixed result use the [dated ecosystem report](reports/2026-09-08/README.md), which preserves its input data and formulas. The dashboard itself does not currently offer a CSV export button; report capture provides a reproducible JSON dataset.
