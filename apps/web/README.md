# DripWell v2 web application

This is the deployed Next.js App Router application. Its eve agent lives in `agent/`, and durable application workflows live in `workflows/`.

From the repository root, use `pnpm --filter @dripwell/web build`. This generates the Prisma client, builds the shared domain package, and compiles Next.js and Workflow. It requires no database migration or production service credentials. The separately deployed eve service uses `pnpm build:eve`, which generates and builds its shared dependencies before compiling eve.

For a fresh checkout, first run `pnpm db:generate` and `pnpm --filter @dripwell/shared build` from the repository root. Run `pnpm --filter @dripwell/web dev` after the documented environment setup, or with the explicitly isolated synthetic verification environment. Production service provisioning and database migrations remain separate deployment steps.

The earlier Vite implementation is preserved under [`legacy/web/`](../../legacy/web/README.md). Keeping it outside this directory prevents its `src/pages/` tree from being discovered as a Next.js Pages Router application.
