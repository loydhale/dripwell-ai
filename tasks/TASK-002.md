# TASK-002 — Build landing page (marketing site)

```
TASK_ID: TASK-002
TITLE: Build landing page (marketing site)
PARENT_REQUEST: Loyd provided production-ready landing.html. Integrate it into the PWA as the marketing site.

GOAL (one sentence):
Convert Loyd's landing.html into the apps/web PWA entry point, preserving all design, content, and animations while making it production-ready and responsive.

SCOPE:
In scope:
- Convert landing.html into apps/web/src/pages/LandingPage.tsx (or .ts if no React yet)
- Preserve all CSS, animations, sections, and content from the original
- Ensure responsive behavior (desktop, tablet, mobile)
- Wire it as the root route (/) in the PWA
- Add proper meta tags, OG tags, and SEO basics
- Ensure PWA manifest still works with the landing page as start_url
- Add smooth scroll navigation linking to sections
- Preserve the brand system: teal primary (#0F7A6A), amber accent (#F59E0B), Fraunces + Inter fonts

Out of scope (do NOT do these even if tempting):
- Do NOT add a backend or API calls (static landing page only)
- Do NOT add a contact form or email capture (defer until backend ready)
- Do NOT add analytics or tracking scripts
- Do NOT change the design or copy (preserve Loyd's work exactly)
- Do NOT add React/Vue/Svelte if the scaffold doesn't have it — work with what's there

FILES LIKELY INVOLVED:
- apps/web/src/pages/LandingPage.tsx (or .ts) — the landing page component/module
- apps/web/src/main.ts — update to render landing page
- apps/web/index.html — update title, meta tags
- apps/web/src/styles/landing.css — extracted styles (or keep inline if that's the scaffold pattern)
- apps/web/vite.config.ts — verify build config handles the page
- apps/web/landing.html — source file (read-only reference, do not modify)

RELEVANT MEMORY ENTRIES:
- PATTERNS: P-002 — vite-plugin-pwa with external manifest
- PRD F-13: Landing page sections — Hero, Spectrum, How It Works, Consistency, Outcomes, Science, Pricing, Final CTA
- PRD: Design tokens — teal primary, amber accent, Fraunces + Inter typography
- PRD: Performance target — < 3s LCP on 4G

ACCEPTANCE CRITERIA (Auditor will check these):
- [ ] Landing page renders correctly at / (root route)
- [ ] All 8 sections present: Hero, Spectrum, How It Works, Consistency, Outcomes, Science, Pricing, Final CTA
- [ ] Brand colors, fonts, and design tokens match original landing.html
- [ ] Animations work: blob drift, scroll reveals, metric bar fills, hover states, pulsing dot
- [ ] Responsive: looks correct on desktop (1200px+), tablet (720-999px), mobile (<720px)
- [ ] PWA manifest still valid and registerable
- [ ] No 404s on fonts, images, or assets
- [ ] Performance: Lighthouse LCP < 3s on simulated 4G
- [ ] prefers-reduced-motion respected (animations disabled)
- [ ] Accessibility: keyboard-navigable, visible focus rings, alt text on images

NOTES / HINTS:
- The original landing.html is at apps/web/landing.html — use it as your source of truth
- The scaffold uses Vite — you can import CSS directly in main.ts
- If the scaffold has no React, build this as a vanilla TypeScript module that manipulates DOM
- For PWA: the landing page should be the start_url in manifest.json
- Consider code-splitting the landing CSS if it's large, but don't over-optimize yet
- The blob animations use CSS keyframes — make sure they still work after conversion
- Scroll reveal logic may need IntersectionObserver if not already using a library
- The original uses Google Fonts (Fraunces, Inter) — ensure these load correctly
- Landing page is marketing-only; no auth, no patient data, no HIPAA concerns here
```
