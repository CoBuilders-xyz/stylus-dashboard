# Release evidence and publication checklist

## Scope

Candidate: **1.0.0**, branch **`release`**, prepared 8 September 2026. This is a documentation, report and publication package for the existing dashboard. It does not modify frontend/backend code, Dockerfiles, environment examples, database schema, CI or production configuration.

The public repository already has an MIT license. The pre-existing tag `stable-1.0` refers to an older commit and is not moved or reused. The fellowship's second tooling initiative is outside this package's scope.

## Deliverable mapping

| Phase commitment                                   | Evidence                                                                                                                                                                                                                                                                                      | State                                                   |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Finalization of the dashboard                      | Existing five routes, source and tests; [limitations](methodology.md)                                                                                                                                                                                                                         | Existing application documented; findings below remain  |
| Public dashboard deployment                        | [Public URL](https://stylus-dashboard.up.railway.app), [dated public check](reports/2026-09-08/public-check.json)                                                                                                                                                                             | Deployment verified with Comparison limitation          |
| Public open-source release, dashboard portion      | [Public repository](https://github.com/CoBuilders-xyz/stylus-dashboard), [MIT license](https://github.com/CoBuilders-xyz/stylus-dashboard/blob/release/LICENSE), [changelog](https://github.com/CoBuilders-xyz/stylus-dashboard/blob/release/CHANGELOG.md), [release notes](release-notes.md) | Source public; final release publication pending review |
| Documentation and usage guidelines                 | [Usage guide](usage.md), [README](https://github.com/CoBuilders-xyz/stylus-dashboard/blob/release/README.md), [Contributing](https://github.com/CoBuilders-xyz/stylus-dashboard/blob/release/CONTRIBUTING.md)                                                                                 | Included                                                |
| Comprehensive architectural documentation          | [Architecture](architecture.md), [methodology](methodology.md), [operations](deployment.md)                                                                                                                                                                                                   | Included                                                |
| Stylus adoption insights / public ecosystem report | [Dated report](reports/2026-09-08/README.md), snapshot, queries, metrics and figures                                                                                                                                                                                                          | Included                                                |
| Fellowship outcomes and recommendations            | [Outcomes](fellowship-outcomes.md), report recommendations                                                                                                                                                                                                                                    | Dashboard-specific outcomes included                    |
| Final documentation package                        | [Documentation index](README.md) and versioned source                                                                                                                                                                                                                                         | Included                                                |

## Existing deployment evidence

The [read-only deployment record](reports/2026-09-08/deployment.json) shows production Web and indexer on `4ad27299f088397f2573a98e9d53a6b88076ba6e`. All five routes returned HTTP 200. Seven of eight public dashboard queries passed; **Comparison failed** because `DeployerRegistry_aggregate` is unavailable to the public role. See [public-check.json](reports/2026-09-08/public-check.json).

The production source commit's [CI](https://github.com/CoBuilders-xyz/stylus-dashboard/actions/runs/33906028389) and [integration](https://github.com/CoBuilders-xyz/stylus-dashboard/actions/runs/33906028409) passed. Those checks do not prove production permissions or complete mainnet coverage. Documentation/report checks are recorded in [validation](validation.md).

## Documentation website

The Markdown documentation is served at [cobuilders-xyz.github.io/stylus-dashboard](https://cobuilders-xyz.github.io/stylus-dashboard/) using Docsify and GitHub Pages. The publishing source is `release` / `/docs`; no dashboard runtime or custom CI workflow is involved. See [site maintenance](publishing.md) for editing and the switch to `main` after merge.

## Publication steps

1. Review and merge the documentation package from `release` into `main`.
2. Select the reviewed commit for `v1.0.0`, finalize the prepared release notes and publish the GitHub Release with the documentation archive and report assets. Do not move `stable-1.0`.
3. Set the repository homepage to `https://stylus-dashboard.up.railway.app` and description to `Public Stylus activation and ecosystem dashboard for Arbitrum One`. The README already links the URL in this branch.
4. Use the report's dated evidence when reporting fellowship deliverables, retaining its limitations and dashboard-only scope. Any wider announcement or participant testimony is a separate communication task.

## Separate operational findings

These are observations from release verification, not changes included in this branch:

- **Comparison public permission:** the existing Hasura lacks `DeployerRegistry_aggregate`. Set the indexer's `ENVIO_HASURA_PUBLIC_AGGREGATE` to `["StylusContract","DeployerRegistry"]` and apply the [one-time existing-metadata repair](deployment.md#existing-public-aggregate-permissions) with the production admin secret. Re-run `node scripts/check-public.mjs` to verify. Merely merging documentation does not repair it.
- **Indexer reset on startup:** `packages/indexer/Dockerfile` currently runs `pnpm envio start -r`. A separate operational change should review adopting non-reset startup and verifying persisted progress through a controlled restart. No production restart/reset was performed here.
- **Metric/UI gaps:** the current labels, unimplemented Health placeholders, hidden sidebar at narrow widths and legacy daily-total semantics are described in the usage guide and methodology. They remain application work, outside this release task.

The documentation and report can be reviewed/published with these findings recorded. They must not be represented as fixes already deployed.
