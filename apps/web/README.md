# @dripwell/web

DripWell PWA (Progressive Web App) — tablet-optimized assessment interface.

## Purpose

This is the patient-facing and provider-facing web application. It runs as a PWA on tablets in the exam room and includes the public landing page.

## Development

```bash
# From repo root
pnpm dev          # Starts the web app on http://localhost:3000
pnpm dev:admin    # Starts the admin app
pnpm build        # Builds all packages and apps
```

## Structure

- `src/main.ts` — App entry point
- `src/sw.ts` — Service worker scaffold
- `landing.html` — Marketing landing page (managed in TASK-002)
- `manifest.json` — PWA manifest

## Notes

- PWA manifest is valid and registerable
- Service worker registration is set up in `src/main.ts`
- Landing page (`landing.html`) is preserved and will be integrated in TASK-002
