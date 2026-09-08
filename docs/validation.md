# Release package validation

Validated on 8 September 2026. This branch contains documentation, evidence assets and standalone report/release verification scripts. Frontend, indexer, Dockerfiles, environment examples, schema and CI files are unchanged from base commit `4ad27299f088397f2573a98e9d53a6b88076ba6e`.

| Check                 | Result                                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Application/CI scope  | `git diff --exit-code` against the base for `apps`, `packages`, `.github` and the existing permission script: no changes                               |
| Documentation         | Relative file/directory links resolve; Markdown and the new JavaScript checker pass targeted Prettier validation                                       |
| Python scripts        | Parsed successfully; report analysis runs with the standard library                                                                                    |
| Report reproduction   | A fresh offline analysis of the committed snapshot produces byte-identical `metrics.json`                                                              |
| Snapshot integrity    | SHA-256 matches the report and metrics; every captured query hash matches its committed GraphQL document                                               |
| Data consistency      | All seven snapshot checks passed; entity IDs are unique; independently summed completed-period activation totals match 15 and 27                       |
| Figures               | PNG/SVG generated with the pinned Matplotlib version; PNG visually inspected for labels, clipping and chart interpretation                             |
| Usage screenshots     | Four screenshots captured from the existing public site and visually inspected; no modified application is shown                                       |
| Deployment provenance | [Sanitized read-only Railway status](reports/2026-09-08/deployment.json) records source commits, service status and public domains                     |
| Public HTTP / GraphQL | [Five routes passed; seven of eight queries passed](reports/2026-09-08/public-check.json). Comparison lacks public `DeployerRegistry_aggregate` access |
| Browser Comparison    | Existing public page displayed `Failed to load data`, confirming the query-level finding                                                               |

The public check intentionally exits nonzero for the recorded Comparison failure. No production variables, metadata, source branch, deployments or database state were changed. The existing application commit's successful CI/integration runs are linked in the [release record](release.md); this documentation validation is not a new claim of application or mainnet indexing correctness.

## Documentation site verification

Docsify was checked locally using the same static files published to GitHub Pages: home and nested report navigation, search results for “expiry”, rendered Mermaid architecture diagram, direct snapshot/SVG downloads, image loading and mobile menu. No JavaScript page errors were observed. Application/CI files remain unchanged. The hosted documentation introduces only Docsify viewer files and Markdown navigation/content updates; the existing dashboard deployment is separate.
