# Deploying Taka Sats to Vercel

## Field-first release checks (2026-10-06)

The stateful VM must run migrations 0013 and 0014 via the tools service, with a verified pre-migration database
backup. Build authenticated assets with `TAKASATS_ASSET_PREFIX=/_vm`, preserving the canonical frontend
proxy. Configure `OPENROUTER_API_KEY` only on the backend and explicitly set verification provider/model,
required OCR and risk-based review threshold. Old sats-threshold 0 does not hold risk-mode work; choose
`approval_mode=legacy` deliberately if retaining the former universal review policy.

Use isolated DB/storage and a fake rail for automated write-based smoke tests. On the live rail,
`pilot:smoke` requires owner-supervised `--pay-real` before creating any work because sync can auto-pay.
Production release verification can check health, sign-in, RBAC and read endpoints without creating
collections or approving money. Invalid OCR holds for review; enabling a provider is not proof of real
scale accuracy. Roll back to the saved image/release/environment if health, login, proxy assets or worker
startup fail. The additive migration can remain while the old image runs; do not revert after new records
without reviewing data loss from removing derived evidence/review fields.

Migration 0014 adds hash-only staff API keys. Verify creation from an administrator session,
scope denial, expiry and revocation using an isolated test database first. For a production probe,
create only a short-lived read-only key, keep its token out of logs, and revoke it after checking.
Do not use a key to create collections or approve payouts as part of a routine deployment check.

The Vercel path runs the same Next.js project as Docker Compose. Neon supplies PostgreSQL and Cloudflare R2 supplies object storage when those features land.

## Frontend on Vercel, backend on the VM

The canonical site can remain on Vercel while everything stateful runs on the self-hosted stack.
Set `TAKASATS_API_ORIGIN=https://taka.novyrix.com` in the Vercel Production environment. At build
time, `next.config.ts` then installs rewrites:

- Vercel itself serves only the public pages (home, about), the crawler and icon files, and its own
  static assets.
- Every other path is forwarded to the VM: the API and Auth.js, and also every signed-in page
  (login, the supervisor app, the admin console, `/c/<code>`, the service worker). Those pages read
  the database and verify the session on the server, which only the VM can do. A new signed-in route
  needs no configuration change.
- A browser asset that the Vercel build does not have (a script chunk of a page the VM rendered)
  falls through to the VM.

The VM image must be **built** with `TAKASATS_ASSET_PREFIX=/_vm` (an environment variable when you
run `docker compose build`). Vercel answers `/_next/static` itself and never forwards a file it does
not have, so the VM's page scripts live under `/_vm/_next/static` instead. The prefix is harmless
when the VM is also used directly, and it is not needed on a deployment that has no Vercel in front.

The browser therefore sees one origin (`taka.afribit.africa`), so cookies, photo uploads and sync
calls remain same-origin. Leave this variable unset on the VM; setting it there would create a
proxy loop.

The backend's public base URL should be the canonical browser origin when this becomes the permanent
production topology. Verify `/api/v1/health`, the CSRF endpoint, credential sign-in, session cookies,
photo upload and sync through the canonical domain after every routing change.

## Link and deploy

```powershell
vercel link --project taka-sats --scope novyrix-teams
vercel deploy --prod --scope novyrix-teams
```

The canonical production URL is `https://taka.afribit.africa`; `taka-sats.vercel.app` is a deployment alias.

## Git deployments

Install the Vercel GitHub App for the `novyrix/taka-sats` repository, then connect it:

```powershell
vercel git connect https://github.com/novyrix/taka-sats --scope novyrix-teams
```

`main` is the production branch. Pull requests receive preview deployments after the Git integration is connected.

## Environment variables

Configure values in the Vercel project rather than committing them:

| Name | Purpose | Availability |
|---|---|---|
| `CRON_SECRET` | Authenticates Vercel Cron requests | configured in production |
| `TAKASATS_API_ORIGIN` | Optional stateful API/Auth.js origin for a Vercel frontend-only deployment | `https://taka.novyrix.com` in production |
| `DATABASE_URL` | Neon pooled PostgreSQL connection | required only when Vercel runs API routes; not read in the split VM topology |
| `AUTH_SECRET` | Auth.js JWT signing secret (`openssl rand -base64 32`) | required only when Vercel runs Auth.js; kept on the VM in the split topology |
| `BLINK_API_KEY` / `LNBITS_ADMIN_KEY` | Lightning provider secret matching `lightning.float_provider` | required once M5 executes payouts |
| `LEDGER_SIGNING_KEY` | Base64 Ed25519 seed that signs ledger checkpoints (`openssl rand -base64 32`) | secret - required for the checkpoint job (M4-7), see `docs/LEDGER.md` |
| `S3_ENDPOINT` | Cloudflare R2 S3 endpoint | required when object uploads land |
| `S3_BUCKET` | R2 bucket name | required when object uploads land |
| `S3_REGION` | R2 region (`auto`) | required when object uploads land |
| `S3_ACCESS_KEY_ID` | R2 access key | secret |
| `S3_SECRET_ACCESS_KEY` | R2 secret key | secret |

Apply secrets through the Vercel dashboard or `vercel env add`; never put their values in `vercel.json` or source control.

## Cron bridge

`vercel.json` calls `GET /api/v1/internal/jobs/enqueue` daily, which is compatible with the current Vercel plan. Vercel supplies `Authorization: Bearer <CRON_SECRET>`. The M0 route authenticates the request and returns an accepted status; M4 will connect it to pg-boss and set the production cadence appropriate to the selected plan.

## Verify

```powershell
vercel inspect taka-sats --scope novyrix-teams
vercel curl https://taka-sats.vercel.app --scope novyrix-teams
```

Confirm that the response is HTTP 200 and contains the Taka Sats implementation page. An unauthenticated request to the internal enqueue route must return HTTP 401.
