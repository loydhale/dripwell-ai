# TASK-035 independent native preview access audit

AUDIT: TASK-035
VERDICT: PASS, read-only diagnosis and later correction plan
ATTEMPT: 1
PRD_AUDIT: pass, F-01/F-03 verification boundaries are preserved.

The independent Auditor reviewed [the exact Coder handoff](NATIVE_PREVIEW_ACCESS.md), SHA256 `1eee72f0067c33f9f38bbb29fb4ceba53a137e451e8c002afaff247cbdf8816d`. All23 entries of its private frozen Coder manifest, SHA256 `048143d4bea2d7ccdc69ca9d53ae35096195f6dbddfa341e836627713594b7f8`, match recorded bytes,0600 modes and hashes. Installed and pinned-release READMEs match. The source is pinned to agent-browser0.38.1 commit `aff6125c023b810ea3f2e5deec5379e9a4270bdc`.

## Independently verified cause

The retained sanitized command structure and actual TASK-033 helper agree: outer CLI arguments were `batch --bail --json`; the trusted header was only a nested `open` row option. Pinned `main.rs` parses outer flags and passes the same Flags to each batch row. `commands.rs` adds navigation headers only from those Flags. `flags.rs` sets that property only when parsing an actual CLI `--headers` option. The header was omitted from navigation, despite the earlier evidence field describing intended origin-scoped authentication.

Pinned native navigation code registers correctly parsed headers by URL origin and enables request interception before navigation, including an existing daemon. Native interception looks up the request origin, so it does not forward the preview's header to a `vercel.com` redirect. A standalone `open ... --headers ...` is the supported correction. No actual corrected navigation occurred in this diagnosis.

The Coder's normal selected-team/project metadata proves Hobby, SSO protection and enabled team OIDC. Current official Trusted Sources documentation states all-plan availability and default same-project development-to-preview access, while saved custom rules replace defaults. Actual custom rules were not exposed or verified. The login redirect does not prove a plan or rule denial, and it justifies no upgrade, static bypass or protection change.

## Supported next plan

The independent Auditor also checked installed CLI62.1 `project token --help` locally, without minting a token. It explicitly documents `vercel project token [name] [options]`, “Get a development OIDC token for a project,” named-project/JSON examples and scope/non-interactive globals. The retained original TASK-033 helper used that normal named-project interface and validated the selected development claims. A guessed `get-token` command is unnecessary. The unrelated CLI npm-update warning does not alter recognized help.

The separately authored [TASK-036 brief](../tasks/TASK-036.md) receives a **plan PASS only**, after TASK-033's scoped cleanup closure. It requires the proven token-only CLI interface, token/header values in memory, an owned ephemeral browser, one corrected standalone protected navigation, a stop at the first genuine access denial, and explicit CTO dispatch before execution. It authorizes one foreground synthetic native capture under10seconds, one application upload/job, real completed transcription and composer editing without Send or Luna. Its fresh controls include the prior three jobs/expired recording and unrelated-rate baseline omitted by TASK-033. Terminal-only exact Blob/recording compensation and cleanup preserve prior history. Nothing has executed under that plan at this review.

Any native access failure must be recorded at its first actual boundary, with no repeated denied navigation or protection weakening. Any reproduced app defect goes to Coder. Successful access alone will not pass native capture/composer or the full pilot. The retained original application cookie selector remains private and available; TASK-033's owned copy was removed.

FINDINGS: no blocking defect in the frozen diagnosis or bounded TASK-036 plan.
PATTERN_VIOLATIONS: none.
GOTCHA_HITS: G-008; current installed command/parser documentation takes precedence over generic examples.
LEARNING: L-031, nested batch flags can omit navigation authentication; G-012, agent-browser0.38.1 batch rows inherit outer flags. No app edit, token mint, protected navigation, model request, rule write or purchase occurred during this independent review.
