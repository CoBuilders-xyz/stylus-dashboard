# Stylus Ecosystem Dashboard 1.0.0

Public release documentation for the existing Stylus Ecosystem Dashboard, covering activation and deployment indicators on Arbitrum One.

- [Open the dashboard](https://stylus-dashboard.up.railway.app)
- [Documentation site](https://cobuilders-xyz.github.io/stylus-dashboard/)
- [Ecosystem report — 8 September 2026](https://github.com/CoBuilders-xyz/stylus-dashboard/blob/release/docs/reports/2026-09-08/README.md)
- [Methodology and limitations](https://github.com/CoBuilders-xyz/stylus-dashboard/blob/release/docs/methodology.md)
- [Release evidence](https://github.com/CoBuilders-xyz/stylus-dashboard/blob/release/docs/release.md)

The package includes a Docsify documentation site on GitHub Pages with search and navigation; usage, architecture and operations documentation; a public-data snapshot with reproducible analysis and figures; and dashboard-specific fellowship outcomes and recommendations. Application code, indexer behavior, deployment settings and CI remain unchanged.

The report observes 1,041 activation-seen program addresses and 95 wallets. Five wallets account for 61.4% of those addresses; the latest 30 completed UTC days contain 15 first activations versus 27 in the preceding period. These observations do not establish a complete inventory of Stylus addresses or measure contract usage.

At the dated deployment check, production Comparison lacked public `DeployerRegistry_aggregate` permission. The documentation includes the existing repair procedure, and records the current reset-on-start Docker command for separate operational review. Neither finding was changed by this documentation release.

Code and documentation are MIT licensed. This release covers the dashboard only, not the fellowship's second tooling project.

**Draft:** prepared for review and final publication against the selected commit. See the release evidence for the existing deployment and its limitations.
