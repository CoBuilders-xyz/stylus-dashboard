# Contributing to Stylus Dashboard

Thank you for contributing! This is a collaborative project built by the Stylus Fellowship cohort. This guide will help you get started.

## Development Workflow

### 1. Pick an Issue

All work is tracked via [GitHub Issues](https://github.com/CoBuilders-xyz/stylus-dashboard/issues). Look for issues labeled `good-first-issue` if you're getting started.

**Labels by section:**
- `section/adoption-overview` — KPIs and main charts
- `section/contract-activity` — Contract table with filters
- `section/builder-metrics` — Builder growth charts
- `section/stylus-health` — Activation/expiration metrics
- `section/stylus-vs-solidity` — Comparison view
- `infra/indexer` — Indexer work
- `infra/frontend` — Frontend setup/layout
- `infra/ci-cd` — CI/CD and deployment

### 2. Create a Branch

```bash
git checkout main
git pull origin main
git checkout -b feat/your-feature-name
```

**Branch naming conventions:**
- `feat/description` — New feature
- `fix/description` — Bug fix
- `refactor/description` — Code refactoring
- `docs/description` — Documentation
- `chore/description` — Tooling, CI, dependencies

### 3. Make Your Changes

```bash
# Start local dev environment
docker compose up -d
cd apps/web && pnpm dev

# Or work on the indexer
cd packages/indexer && pnpm dev
```

### 4. Verify Your Work

Before pushing, ensure:

```bash
# Code passes linting
pnpm lint

# Types are correct
pnpm typecheck

# Tests pass
pnpm test

# Project builds
pnpm build
```

### 5. Submit a Pull Request

Push your branch and open a PR against `main`:

```bash
git push -u origin feat/your-feature-name
```

In your PR description, include:
- **What** — Brief description of the change
- **Why** — Link to the issue it addresses
- **How to test** — Steps to verify the change works

## Code Guidelines

### TypeScript

- Use strict mode (already configured)
- Prefer explicit types over `any`
- Use interfaces for object shapes

### Components

- One component per file
- Use Server Components by default (no `'use client'` unless needed)
- Keep components small and focused

### Styling

- Use Tailwind CSS utility classes
- Use the pre-built components in `src/components/ui/`
- Follow the existing color scheme (CSS variables in `globals.css`)

### File Organization

| What | Where |
|------|-------|
| Pages/routes | `apps/web/src/app/` |
| Reusable UI primitives | `apps/web/src/components/ui/` |
| Chart components | `apps/web/src/components/charts/` |
| GraphQL queries | `apps/web/src/lib/graphql/` |
| Indexer event handlers | `packages/indexer/src/` |
| Indexer entity schema | `packages/indexer/schema.graphql` |

### Commit Messages

Use clear, descriptive commit messages:

```
feat: add daily activations chart to overview page
fix: correct expiry calculation for reactivated contracts
docs: add HyperSync setup instructions
chore: update eslint config
```

## Working with the Indexer

### Adding a New Entity

1. Define the entity in `packages/indexer/schema.graphql`
2. Run `pnpm codegen` to regenerate types
3. Add the event handler in `src/EventHandlers.ts`
4. Write a test in `test/`

### Querying Data in the Frontend

1. Write the GraphQL query in `apps/web/src/lib/graphql/queries.ts`
2. Use TanStack Query to fetch in your component
3. Pass data to the appropriate chart/table component

## Getting Help

- Open an issue with the `question` label
- Tag maintainers in PR comments for reviews
- Check existing issues before creating new ones
