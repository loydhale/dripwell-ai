# DripWell.ai

AI-powered, in-room wellness assessment tool for IV therapy clinics.

## Development

Requires [pnpm](https://pnpm.io) and Node.js 22+.

```bash
# Install dependencies
pnpm install

# Run web app (PWA)
pnpm dev

# Run admin panel
pnpm dev:admin

# Build everything
pnpm build

# Type-check everything
pnpm typecheck

# Format code
pnpm format
```

## Monorepo Structure

```
apps/
  web/       — PWA (tablet-optimized assessment + landing page)
  admin/     — Desktop admin panel for super users
packages/
  shared/    — Shared types, utilities, Prisma schema
```

## Tech Stack

- Node.js + TypeScript
- pnpm workspaces
- Vite (web + admin)
- vite-plugin-pwa (PWA support)
- Prisma (database ORM — schema ready, migrations in TASK-003)
- Fastify (backend API — scaffold in TASK-004)
