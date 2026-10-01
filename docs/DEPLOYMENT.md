# Deploying DripWell v2

The application lives in `apps/web`, with the shared domain and PostgreSQL migrations in `packages/shared`. Legacy Vite and Fastify applications remain reference code and are not the v2 deployment. Root `personas/`, `memory/`, `tasks/`, and `workflows/` are development context; application agents and workflows are in `apps/web/agent` and `apps/web/workflows`.

Use Node.js 24 and the repository's pinned pnpm version. Build and verification can run without production service secrets. Starting the connected application and applying production migrations require a linked Vercel project and verified environment bindings.

## Connect the project and services

1. Sign in to the intended Vercel account, select its team, and link this repository to the DripWell project. Set the project root to `apps/web` and enable files outside the root for the workspace dependency. `pnpm --filter @dripwell/web build` generates the Prisma client and builds `@dripwell/shared` before Next.js. The separate eve service uses `pnpm build:eve` with the same dependency preparation; neither build applies database migrations.
2. Provision PostgreSQL, private Vercel Blob storage, Stripe subscription billing, and Resend through the linked project's integrations. Enable Vercel AI Gateway and Workflow for the project. The code uses real providers and returns explicit service errors when a required provider is not connected.
3. Add the empty keys listed in [.env.example](../.env.example) through Vercel environment settings, separately for preview and production. Pull environment bindings into `apps/web/.env.local`; do not commit that file. `APP_URL` must be the trusted public HTTPS origin, without a path or query.
4. Set `STRIPE_PRICE_ID` to the actual recurring DripWell platform subscription price. This is separate from the clinic products and memberships entered during setup. Configure Stripe's billing portal.
5. Register Stripe webhooks at `https://<your-domain>/api/billing/webhook` with `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, and `charge.refunded`. Save the endpoint's signing secret as `STRIPE_WEBHOOK_SECRET`. Preserve the raw webhook request body.
6. Verify a sending domain in Resend and set `EMAIL_FROM` to an authorized address. Recipient codes contain no visit content. Do not use a testing sender to release sharing to clinic clients.
7. Set `AUTH_ENCRYPTION_KEY` to an independently generated 32-byte encryption key encoded as base64url. Keep the same key for the encrypted two-factor secrets throughout a deployment's lifecycle. Set an independent `CRON_SECRET`. Platform administrators are created through the restricted bootstrap command, not public clinic registration; enable their two-factor authentication before accessing the platform dashboard.
8. Run `pnpm check:services`, then run `pnpm db:deploy` against the intended database. Migrate the database before promoting the application release. Generate the Prisma client with the repository build/install workflow.
9. Deploy a preview, complete the verification below with synthetic visits, and then promote the validated release.

## Create the platform administrator

After linking the intended project, pulling its environment bindings, generating the Prisma client, and applying the reviewed migrations, a trusted database operator creates the platform account explicitly:

```bash
pnpm --filter @dripwell/web admin:bootstrap --email selected@example.com --first-name Selected --last-name Operator
```

Replace the example identity with the chosen administrator. The command loads `apps/web/.env.local` and requires the intended `DATABASE_URL` and a valid `AUTH_ENCRYPTION_KEY`. Enter and confirm a unique password of at least 16 characters at the masked terminal prompts. The password is never accepted as a command-line argument or printed. For automation, inject the dedicated `DRIPWELL_PLATFORM_ADMIN_PASSWORD` environment variable through a secret manager for that invocation only; do not commit it or add it to the deployed application's persistent environment.

The command creates an active `SYSTEM_ADMIN` with no clinic membership and records its creation in the audit log. It rejects an email belonging to a clinic user, never promotes or moves an existing clinic identity, and leaves an existing active platform account unchanged. It does not run migrations or create a clinic or trial. Public registration always creates a clinic owner and cannot grant platform authority.

Sign in with the selected account and enable two-factor authentication at `/account`. Platform APIs continue to deny access until MFA is enabled and verified in the current session. Keep the recovery codes securely; the bootstrap command does not reset passwords, disable MFA, or reactivate inactive accounts.

## Subscription, trial, and referral policy

Registration starts the local 14-day trial with 10 initial consultations. The `TRIAL` entitlement is distinct from Stripe's `stripeStatus`; provider trialing does not extend the local trial or create paid access. Paid access requires a settled invoice for the configured nonzero recurring DripWell price and a verified active subscription, customer, and clinic. An invoice settled through account credit or a discount can activate or renew access even when no external payment is due. Free prices, trialing subscriptions, and unrelated invoice items cannot grant paid access. Trial exhaustion blocks new starts while allowing existing visits to finish.

Referral links track registration and conversion immediately. The credit policy is initially unset, with an explanatory notice in owner and platform views. A platform administrator must publish the credit amount, currency, attribution window, refund reversal terms, expiry if desired, and a new policy version before monetary rewards are promised. Referrals pin the policy present at attribution. Disabling a policy does not erase that history or award retroactive credits.

Credits have an append-only earned/applied/reversed ledger. Stripe customer-balance transactions apply rewards to future DripWell subscription invoices. Referral reward qualification requires a positive payment independently from subscription entitlement; balance-funded or discounted zero-payment invoices do not create a signup reward. Repeated payment events do not award additional credits. A refund of the qualifying invoice reverses the credit when its pinned policy requires reversal; refunding an unrelated renewal does not reverse the signup reward. Administrative inspection shows unapplied rewards separately from credits already transferred to Stripe. Kind-aware balances preserve currency separation and do not subtract an already-applied reward's reversal from a later unrelated earning.

## Approved documents and sharing

Staff must approve the exact wellness revision, based on the current reviewed summary and actual-care revision, before downloading or sharing. New recording intake invalidates prior approvals and shares before its private upload; document issuance and recipient reads also deny unresolved recordings or active transcription/summary processing. Upload and workflow retries cannot restore old approvals. Documents retain the approved clinic branding, text, prices, and terms in an immutable database snapshot. They exclude internal observations, transcript segments, evidence quotes, and internal safety flags. PostgreSQL snapshots are rendered into PDFs on demand without public artifact storage.

A staff-issued share specifies the intended recipient's email. The URL alone reveals no visit document. The recipient requests a six-digit emailed code, verifies it, and receives a short-lived HttpOnly session bound to that share. Tokens and code proofs are stored as hashes. Sending and verification have durable rate limits. Expiration, revocation, document retention, or edits that invalidate approval deny further access. Files already downloaded cannot be remotely revoked.

The web document displays original Unicode text. PDFs embed the licensed Geist font, paginate long content, and represent characters outside the font as their Unicode code point rather than silently removing them. The font files must be included in the deployed function's traced files.

## Release verification

Run `pnpm db:validate`, `pnpm typecheck`, `pnpm test`, and `pnpm build`. Database integration tests require an explicit `TEST_DATABASE_URL` for an isolated disposable PostgreSQL database; they do not truncate unrelated fixtures or call paid providers. Provider transport fixtures verify business handling and Stripe SDK signature validation, not live provider delivery.

In the deployed preview, verify owner registration and two-factor authentication, setup through typed and recorded input, menu uploads, synthetic rule tests, and activation. Run a consented synthetic consultation through question confirmation, recommendation adjustment and provider approval, actual care, approved wellness output, manual decisions, archive and restore, and reminders. Verify staff cannot open owner improvement or platform APIs. Verify a second clinic cannot read the first clinic's records.

Use Stripe test mode to verify checkout, positive invoice activation, duplicate deliveries, subscription cancellation, credited referral conversion, and refund reversal. Use the actual verified Resend sender to confirm recipient code delivery, a forwarded link's denial, document download, revocation, expiry, and invalidated approvals. Check the platform dashboard's trial usage, conversion status, credit ledger, failures, and measured versus estimated model costs.

`/api/health` reports only readiness and database reachability, never credentials. The PWA caches its public shell; protected API results, documents, audio, and transcripts remain outside browser offline storage.

## Real client data

`ALLOW_REAL_CLIENT_DATA` remains false until the clinic's required service agreements and the deployed data paths have been reviewed, including inference, transcription, Workflow persistence, eve sessions, private storage, retention, backups, and support access. Set it through trusted deployment configuration only after that review. The sharing reminder accompanies access controls and does not constitute a compliance certification.
