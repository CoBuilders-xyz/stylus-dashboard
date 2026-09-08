# Changelog

## 1.0.0 — documentation and public release candidate

This release packages the existing Stylus Ecosystem Dashboard with documentation and a reproducible Arbitrum One ecosystem report. It does not change application code, indexer behavior, deployment configuration or CI.

### Added

- Docsify documentation site on GitHub Pages, with sidebar navigation, search and diagrams, using the existing Markdown files directly.

- Documentation index, usage guide with public-dashboard screenshots, architectural documentation and a metric dictionary.
- Dated ecosystem report, raw public-data snapshot, computed metrics, PNG/SVG figures and reproduction scripts.
- Dashboard-specific fellowship outcomes and recommendations.
- Railway operations documentation, deliverable evidence mapping and publication notes.
- Read-only public HTTP/GraphQL verification script.

### Documentation updates

- README links to the public dashboard, documentation and report.
- Setup and contribution instructions link to the final documentation package.
- Methodology explains the existing UI labels, data coverage, legacy per-day counter and unimplemented Health placeholders.

### Known findings

At the dated check, production Comparison lacked public `DeployerRegistry_aggregate` access. The indexer Dockerfile still contains `-r` on startup. Both are documented for separate follow-up, with no operational changes made by this release. See [release status](docs/release.md) and [methodology](docs/methodology.md).
