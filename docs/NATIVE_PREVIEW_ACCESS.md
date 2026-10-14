# Native preview access diagnosis

TASK-035, Coder handoff for independent Auditor review. Observed on October 2, 2026, at 22:29 to 22:32 UTC (5:29 to 5:32 PM CDT). This phase used read-only metadata and public package source. It performed no browser launch, protected navigation, token issuance, upload, model request, protection change, purchase or application edit.

The TASK-033 browser attempt placed `--headers` inside a stdin batch command. In installed agent-browser 0.38.1 that does not set the navigation header. The correction is a **standalone `open` command with `--headers` as an actual CLI option**. The Vercel login redirect therefore does not establish a Trusted Sources rule or plan denial. Corrected protected access and native capture remain unverified.

## Exact attempted boundary

The independent TASK-033 Auditor supplied sanitized command structure and confirmed that the outer arguments were only:

```text
agent-browser batch --bail --json
```

The input contained the following structure. Placeholders below are explanatory, never executable credentials:

```json
[
  ["cookies", "set", "<application-cookie-in-memory>"],
  ["open", "https://dripwell-ai-preview-loyd-1222s-projects.vercel.app/setup", "--headers", "<trusted-header-JSON-in-memory>"]
]
```

This was an owned fresh session, launched first at `about:blank`, with no profile or restore configuration. The cookie operation selected only the application cookie `dripwell_session`; it imported no Vercel protection cookie. The hosted navigation reused the daemon. Its actual final title was `Login – Vercel`, origin `https://vercel.com`, path `/login`. No HTTP rejection status or Trusted Sources rejection code was observed. There was one protected navigation, no native recording or browser upload. The Auditor subsequently closed the browser and reported no active browser sessions.

The previous sanitized `browser-boundary.json` field `originScopedTrustedHeader: true` records the intended authentication. It is not proof of header transmission. TASK-035 did not inspect raw browser commands, cookies, tokens, profiles or environment files.

## Version-specific parser evidence

The installed package metadata identifies agent-browser **0.38.1**. Its packaged README has SHA-256 `f8ae1265daec0e982a1f08791538d4ede5f98aa4892f2609ab0da3acf074f02c`, identical to the README in release tag `v0.38.1`, commit `aff6125c023b810ea3f2e5deec5379e9a4270bdc`. The public source below is pinned to that commit, rather than an assumed current implementation.

| Path | Exact behavior |
| --- | --- |
| [main.rs, line 1372](https://github.com/vercel-labs/agent-browser/blob/aff6125c023b810ea3f2e5deec5379e9a4270bdc/cli/src/main.rs#L1372) | Parses global flags from the outer process arguments, then cleans those arguments. |
| [main.rs, line 2191](https://github.com/vercel-labs/agent-browser/blob/aff6125c023b810ea3f2e5deec5379e9a4270bdc/cli/src/main.rs#L2191) | `run_batch` calls `parse_command(cmd_args, flags)` using the outer flags. It does not run `parse_flags` on each stdin row. |
| [commands.rs, line 407](https://github.com/vercel-labs/agent-browser/blob/aff6125c023b810ea3f2e5deec5379e9a4270bdc/cli/src/commands.rs#L407) | The `open` navigation includes a `headers` property only from `flags.headers`. Extra `--headers` strings inside a batch row do not populate that property. |
| [flags.rs, line 809](https://github.com/vercel-labs/agent-browser/blob/aff6125c023b810ea3f2e5deec5379e9a4270bdc/cli/src/flags.rs#L809) | An actual outer CLI `--headers` option sets `flags.headers`. |
| [actions.rs, line 5266](https://github.com/vercel-labs/agent-browser/blob/aff6125c023b810ea3f2e5deec5379e9a4270bdc/cli/src/native/actions.rs#L5266) | The native navigation handler registers headers against the navigation URL's origin and enables request interception before navigation. This happens on navigation, including an already-running daemon. |
| [actions.rs, line 11715](https://github.com/vercel-labs/agent-browser/blob/aff6125c023b810ea3f2e5deec5379e9a4270bdc/cli/src/native/actions.rs#L11715) | Request interception selects headers by the request URL's origin. The preview header is not applied to a redirect to `vercel.com`. |

Thus the nested option was ignored by the parser; the batch succeeding does not prove authentication was sent. A prior `about:blank` launch and daemon reuse do not themselves prevent a later correctly parsed, origin-scoped `open`. This finding is source-path evidence corroborated by the Auditor's command structure, not a captured HTTP header or successful retry.

The packaged [protected-vercel-deployments skill](https://github.com/vercel-labs/agent-browser/blob/aff6125c023b810ea3f2e5deec5379e9a4270bdc/skill-data/protected-vercel-deployments/SKILL.md) recommends the standalone `open ... --headers ...` pattern. TASK-035 also read the mandatory Vercel Plugin agent-browser, vercel-cli, vercel-api, env-vars and verification guidance. It did not follow generic examples that would pull credential-bearing environment files.

## Actual account and protection evidence

Normal authenticated Vercel CLI **62.1.0** GET requests retained only whitelisted nonsecret metadata:

| Observation | Actual value |
| --- | --- |
| Project | `dripwell-ai`, `prj_fF0yFggYVFN9pI5dQN33glG2wPyW` |
| Project account and selected team | `team_ATVYA30szlVoy5XxAIiaf2OD`, `loyd-1222s-projects` |
| Current team billing plan, 22:31:44 UTC | `hobby` |
| Project SSO protection, 22:29:01 UTC | `deploymentType: all_except_custom_domains` |
| Project OIDC configuration | `enabled: true`, `issuerMode: team` |
| Trusted Sources custom rules | Not exposed by the selected public project GET response; not verified. |

The previously sanitized TASK-033 claims matched that project and team: issuer `https://oidc.vercel.com/loyd-1222s-projects`, audience `https://vercel.com/loyd-1222s-projects`, environment `development`, with valid timestamps at the attempt. These claims do not establish an accepted inbound browser request.

Current official [Trusted Sources documentation](https://vercel.com/docs/security/deployment-protection/methods-to-bypass-deployment-protection/trusted-sources), fetched during this investigation, explicitly states **available on all plans**. Its documented default self-access includes this project's `development` environment reaching its preview deployments. It also states that saved custom rules replace those defaults. Consequently, a Hobby-plan upgrade is not a documented prerequisite, but public defaults and project metadata do not prove the actual saved self-access rules. No upgrade or rule change is justified by the TASK-033 redirect.

The installed protected-deployments guidance documents dashboard-only Trusted Sources rule management, not a supported public CLI/REST rule-editing route. If a correctly authenticated later attempt still fails, capture the first sanitized rejection boundary and verify the selected project's self-access rules through an eligible account access path before choosing any remedy.

## Minimal correction for a later reviewed task

This is a proposed execution handoff. No step below was performed in TASK-035. A later task requires independent plan review and explicit CTO dispatch.

1. Reconcile TASK-033 cleanup and confirm actual runtime, selected actor, current reviewed source, protected preview and `ALLOW_REAL_CLIENT_DATA=false`. Use an owned ephemeral browser session with no profile or restore. Preserve inherited proxy and CA settings.
2. Stage only the required existing synthetic application session through supported in-memory cookie setting before the first hosted navigation. Cookie staging may use a batch, but put no authentication options inside its rows. Do not import a protection cookie or replay a secret profile.
3. Under the later brief, obtain a short-lived normal development OIDC token with CLI 62.1.0 for `dripwell-ai` and scope `loyd-1222s-projects`. Retain it only in memory; do not pull environment files or print, log or persist the token.
4. Navigate with a **standalone CLI invocation**, in that same owned session:

   ```text
   agent-browser --session <owned-session> open https://dripwell-ai-preview-loyd-1222s-projects.vercel.app/setup --headers '<in-memory JSON: x-vercel-trusted-oidc-idp-token>'
   ```

   Construct the real header JSON and subprocess argument directly in memory. The placeholder above is not a literal header value. Capture only sanitized results, never raw command arguments or credential-bearing output. Avoid `set headers`, which has global semantics, and avoid putting `--headers` in a stdin batch row.
5. Verify the actual application origin and setup composer. If protection still redirects to Vercel, stop before upload. Record the sanitized final origin/path, observed status or rejection code if available, and verified nonsecret claims. Do not infer a particular account denial from a generic login page, repeat the request, or broaden protection.
6. Any actual native recording, transcription or composer edit belongs to the later reviewed brief with its own exact request count, synthetic evidence and cleanup. TASK-033 already has a completed real API voice-transcription job. A native recording should establish the missing browser behavior; it must not repeat a provider request merely to reconfirm the existing API result.

The currently exposed tools do not establish an interactive owner-login handoff into this managed browser. No supported shared session URL was identified. Signing into Vercel on the owner's phone cannot be assumed to authenticate this browser. The corrected documented OIDC path is the next supported candidate; it has not yet passed. If it fails, the specific first rejection and actual rule inspection become the resume point, with no static bypass, public exception or protection mutation in this plan.

## Evidence and limits

Nonsecret evidence is retained outside Git in `/workspace/dripwell-task035-private`, directory mode 0700 and files mode 0600: sanitized Auditor command/claims/boundary, filtered project and team GET observations, installed package documentation/metadata, pinned public source and current official Trusted Sources documentation. The frozen manifest records their SHA-256 hashes and this document's hash. Full project/team responses were parsed in memory and not persisted.

No browser or provider resource was created by TASK-035. Public fetches and CLI GET subprocesses completed. The independent Auditor owns TASK-033 cleanup; this task did not touch those resources. Application source, dependencies, access control, provider selection and real-client gate are unchanged. No passing source suite or model inference was repeated. This handoff claims neither protected-access PASS nor native/UI/pilot completion.
