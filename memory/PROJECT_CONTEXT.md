# PROJECT_CONTEXT.md

Facts about the project this team is working on. The CTO fills this out on first run by inspecting the codebase and asking Owner any missing fundamentals. After that, it only changes when the project fundamentally changes.

## Project name
(auto-detect on first run or ask Owner)

## Purpose
(one to three sentences on what this project does)

## Stack
- Language(s):
- Framework(s):
- Runtime:
- Package manager:
- Test framework:
- Deployment target:

## Repo conventions
- Folder structure:
- Naming conventions:
- Commit message style:
- Branching model:

## External services
- Databases:
- APIs:
- Auth providers:
- Hosting:

## Known constraints
- Performance targets:
- Compliance / regulatory:
- Budget limits:

## Non-goals
(things this project will NOT do, so we don't drift into them)

---

## How to populate this file

On first run, CTO should:
1. List files at repo root
2. Read package.json / pubspec.yaml / requirements.txt / Cargo.toml / go.mod (whichever exists)
3. Read README if present
4. Read top-level folders to infer structure
5. Fill in everything that's obvious from the code
6. For anything not inferable, ask Owner ONE batched question covering all gaps

After first run, update this file only when the stack genuinely changes (framework migration, new service added, etc.)
