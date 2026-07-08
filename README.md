# JPosta

JPosta is a modern business email hosting platform for connecting domains, creating professional addresses, managing mailboxes, and accessing email through a premium web experience.

This repository contains the enterprise monorepo foundation only. It intentionally does not include application pages, authentication, database schema, API endpoints, or mailserver integration yet.

## Stack

- Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui foundations
- NestJS API foundation
- Turborepo and pnpm workspaces
- Shared UI, config, and types packages
- ESLint, Prettier, Husky, lint-staged

## Structure

```text
apps/
  web/
  api/
  admin/
packages/
  ui/
  config/
  types/
docker/
docs/
```

## Getting Started

```bash
pnpm install
pnpm typecheck
pnpm build
```

Run the development workspace:

```bash
pnpm dev
```

## Design Foundation

The shared UI package provides dark-first glassmorphic primitives:

- `GlassCard`
- `GlassButton`
- `GlassInput`
- `GlassBadge`
- `GlassShell`
- `GradientBackground`

The Tailwind preset and global CSS variables establish crystal glass panels, frosted backgrounds, soft reflections, premium gradients, subtle shadows, and clean SaaS dashboard typography.
