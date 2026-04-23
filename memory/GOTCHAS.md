# GOTCHAS.md

Non-obvious quirks about this project. Reading this file before starting a task prevents wasted time on things that look wrong but are intentional (or look fine but secretly aren't).

Format per entry:

```
## G-<number> — <short name>
Date discovered: <YYYY-MM-DD>
Where: <file paths, service, config area>
The gotcha: <what's weird>
Why it's like this: <if known>
What to do: <how to handle it>
What NOT to do: <common wrong fix>
```

Rules:
- New gotchas append to the bottom
- Lessons that hit 3+ times get promoted here during weekly review
- Every agent reads this file before every task
- Gotchas don't get deleted unless the underlying issue is actually fixed in the codebase

---

## Entries

(none yet — will populate as the team works)

## G-001 — iPad Safari getUserMedia may require a recent user gesture context
Date discovered: 2026-04-22
Where: apps/web/src/components/CameraCapture.ts, camera.ts
The gotcha: iPad Safari allows `navigator.mediaDevices.getUserMedia()` only when called from a user gesture handler or a frame created by one. If the camera component mounts programmatically (e.g., after a route change or state update) without a recent click/tap, the call may be rejected even if permission was previously granted.
Why it's like this: iOS Safari's media permissions model ties getUserMedia to user gesture context for privacy.
What to do: Add an explicit "Start Camera" button that the provider taps before calling `getUserMedia`, or ensure the component is rendered synchronously inside a click handler.
What NOT to do: Do not call `getUserMedia()` immediately on component mount and assume it will work on iPad.
