# PRD Template

CTO fills this out on first run using Owner's initial brief + one batched round of clarifying questions. Once Owner approves, lock as v1.0 and record in `memory/PRD_CHANGELOG.md`.

Copy this file to `PRD.md` at the project root when scaffolding a new CTO instance.

---

# PRD: <Project Name>

**Version:** 0.1 (DRAFT, PENDING OWNER APPROVAL)
**Owner:** Owner
**Managed by:** CTO agent (this instance)
**Last updated:** <YYYY-MM-DD>

---

## 1. One-liner
<What this project does, in one sentence.>

## 2. Why it exists
<The underlying problem or opportunity. Why is this worth building?>

## 3. Target users
<Who is this for? Be specific. If there are multiple user types, list each with their role.>

## 4. Core user outcomes
What users can do when this is done:
- <outcome 1>
- <outcome 2>
- <outcome 3>

## 5. In-scope features
Only features explicitly listed here are in scope. Everything else is a PRD change request.

### Feature F-1: <name>
- Description:
- Acceptance criteria:
- Priority: P0 | P1 | P2

### Feature F-2: <name>
- Description:
- Acceptance criteria:
- Priority: P0 | P1 | P2

<add more as needed>

## 6. Explicitly out of scope
Things the team should NOT build even if tempting. If the Owner wants these later, they will open a PRD change request.
- <bullet>
- <bullet>

## 7. Stack and architecture decisions
- Language(s):
- Framework(s):
- Database:
- Auth:
- Hosting / deployment:
- Key third-party services:
- Repo structure (if decided):

## 8. Constraints
- Performance targets:
- Compliance / regulatory:
- Budget:
- Timeline (if any):

## 9. Open questions
Questions where the answer is not yet locked. Each must resolve before the feature that depends on it can ship.
- Q1:
- Q2:

## 10. PRD change protocol
- Minor updates (clarifications, completion marks, typos): CTO edits inline, Auditor co-signs
- Major changes (new features, scope changes, stack changes): CTO drafts in `<!-- PENDING_OWNER_APPROVAL: <id> -->` block, workaround in the meantime, Owner approves before commit

## 11. Glossary
Terms specific to this project:
- <term>: <definition>

---

## Pending approvals

Any `<!-- PENDING_OWNER_APPROVAL: <id> -->` blocks below this line represent drafts awaiting Owner's review. Do not treat them as in-scope yet.

<!-- pending blocks go here -->
