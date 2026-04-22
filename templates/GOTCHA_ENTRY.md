# Gotcha entry template

Use this format when appending to `memory/GOTCHAS.md`:

```
## G-<next-number> — <short-name>
Date discovered: <YYYY-MM-DD>
Where: <file paths, service, config area>
The gotcha: <what's weird>
Why it's like this: <if known>
What to do: <how to handle it>
What NOT to do: <common wrong fix>
```

Rules:
- Every agent reads GOTCHAS.md before every task
- Only delete when the underlying issue is actually fixed in the codebase
- Lessons that hit 3+ times get promoted here during weekly review
