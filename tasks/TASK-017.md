# TASK-017 — In-App Help & Documentation

```
TASK_ID: TASK-017
TITLE: In-app help panel and documentation
PARENT_REQUEST: Loyd wants contextual help for providers and super users, updated as features ship.

GOAL (one sentence):
Build an in-app help panel that shows contextual documentation based on the current page, with content we can update easily as features change.

SCOPE:
In scope:
- Help icon (?) in header of both PWA and admin
- Slide-out panel or modal showing help content
- Contextual: different help for each page (dashboard, catalog, assessment flow, etc.)
- Help content stored as markdown files in repo
- Basic help sections:
  - Getting Started (for new users)
  - How to Run an Assessment (provider)
  - How to Manage Catalog (super user)
  - How to Invite Providers (super user)
  - Understanding Recommendations (provider)
  - Safety Flags Explained (provider)
- Search help content
- "Was this helpful?" thumbs up/down (feedback loop)

Out of scope:
- Do NOT build a separate docs website for v1
- Do NOT build video tutorials
- Do NOT build interactive walkthroughs/onboarding tours

FILES LIKELY INVOLVED:
- apps/web/src/components/HelpPanel.ts (PWA help)
- apps/admin/src/components/HelpPanel.ts (admin help)
- docs/help/ — markdown help content
- apps/api/src/routes/help.ts — serve help content

RELEVANT MEMORY ENTRIES:
- PRD: User experience, provider training

ACCEPTANCE CRITERIA:
- [ ] Help icon visible in both PWA and admin headers
- [ ] Clicking opens help panel with relevant content
- [ ] Content is contextual (different per page)
- [ ] Help content is markdown, easy to update
- [ ] Search works within help
- [ ] "Was this helpful?" feedback captured

NOTES / HINTS:
- Use a simple markdown parser in the browser
- Store help files in the repo so they version with code
- Update help content when shipping new features
- Keep help concise — bullet points, not essays
- Post-pilot task: build from real user questions, not guesses
```
