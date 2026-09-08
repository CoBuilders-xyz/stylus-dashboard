// Read-only deployment smoke check. No credentials, mutations or resets.
import { readFile } from 'node:fs/promises';

const web = process.env.DASHBOARD_URL ?? 'https://stylus-dashboard.up.railway.app';
const endpoint =
  process.env.GRAPHQL_ENDPOINT ?? 'https://stylus-dashboard-hql.up.railway.app/v1/graphql';
const source = await readFile(
  new URL('../apps/web/src/lib/graphql/queries.ts', import.meta.url),
  'utf8',
);
const documents = Object.fromEntries(
  [...source.matchAll(/export const (\w+) = gql`([\s\S]*?)`;/g)].map((match) => [
    match[1],
    match[2],
  ]),
);
const now = Math.floor(Date.now() / 3_600_000) * 3600;
const day = 86400;
const since = Math.floor(now / day) * day - 29 * day;
const operations = {
  GET_OVERVIEW_STATS: { since },
  GET_CONTRACTS: { where: {}, limit: 1, offset: 0, orderBy: [{ activatedAt: 'desc' }] },
  GET_BUILDER_STATS: { since, limit: 1 },
  GET_HEALTH_METRICS: {
    now,
    d7: now + 7 * day,
    d30: now + 30 * day,
    d90: now + 90 * day,
    d180: now + 180 * day,
    since,
  },
  GET_COMPARISON_STATS: { since },
  GET_ACTIVATION_HISTORY: {},
  GET_BUILDER_GROWTH: {},
  GET_COMPARISON_HISTORY: {},
};
const checks = [];
for (const route of ['/', '/contracts', '/builders', '/health', '/comparison']) {
  try {
    const response = await fetch(new URL(route, web), { signal: AbortSignal.timeout(60_000) });
    const html = await response.text();
    checks.push({
      name: route,
      ok: response.ok && html.includes('Stylus'),
      status: response.status,
    });
  } catch (error) {
    checks.push({ name: route, ok: false, error: error.message });
  }
}
for (const [name, variables] of Object.entries(operations)) {
  try {
    if (!documents[name]) throw new Error(`Missing query ${name}`);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: documents[name], variables }),
      signal: AbortSignal.timeout(60_000),
    });
    const body = await response.json();
    checks.push({
      name,
      ok: response.ok && !!body.data && !body.errors,
      ...(body.errors ? { errors: body.errors.map((error) => error.message) } : {}),
    });
  } catch (error) {
    checks.push({ name, ok: false, error: error.message });
  }
}
console.log(
  JSON.stringify({ capturedAt: new Date().toISOString(), web, endpoint, checks }, null, 2),
);
if (checks.some((check) => !check.ok)) process.exitCode = 1;
