# Configuration

Taka Sats is config-first (D-21): every operational value lives in configuration, not
in source. A programme in another city runs this codebase by editing one file, never by
forking. A literal magic number in domain code is a review-blocking defect.

## Layers

`lib/config/` merges three layers, lowest precedence first, then validates the result:

1. **`config/settings.default.toml`** - committed. Every key is present with a documented
   default. This is the reference and the fallback.
2. **`config/settings.toml`** - git-ignored. The operator's overrides; only the keys they
   change. Copy from the default file to start.
3. **Environment variables** - `TAKASATS__SECTION__KEY=value`. Nested keys join with a
   double underscore, lower-cased: `TAKASATS__PAYOUTS__SECOND_SIGNOFF_THRESHOLD_SATS=75000`.
   Values are parsed as JSON when possible (`900` → number, `true` → boolean,
   `'["kraken","yadio"]'` → array), otherwise kept as a string. Env wins over both files -
   use it on platforms where a file is awkward (Vercel).

The merged object is checked against the Zod schema in `lib/config/schema.ts`. **A missing
or out-of-range value fails the boot**, loudly, with every violation listed. The app never
starts on a half-valid config. The validated object is deep-frozen and exported typed by
`getSettings()`.

## Secrets are never in TOML

`DATABASE_URL`, `BLINK_API_KEY`, `OPENROUTER_API_KEY`, `LNBITS_ADMIN_KEY`, `LNBITS_USERMANAGER_KEY`,
`NOSTR_PRIVATE_KEY`, `AUTH_SECRET`, `LEDGER_SIGNING_KEY` (base64 Ed25519 seed - see
[`LEDGER.md`](LEDGER.md)),
and object-storage credentials are environment variables only. `settings.toml` may name
*which* provider (`float_provider = "lnbits"`), never a key. See `.env.example`.
`lib/lightning/index.ts` reads exactly the one secret its configured provider needs
(`BLINK_API_KEY` or `LNBITS_ADMIN_KEY`) and throws a clear error if it is unset.

## The settings surface

Full annotated list: [`config/settings.default.toml`](../config/settings.default.toml).
Every key there carries a comment. Summary of the sections:

| Section | Purpose |
|---|---|
| `[programme]` | Name, timezone, fiat currency (ISO 4217), UI locales, default locale, `public_base_url` (where this deployment is served - builds credential URLs) |
| `[custody]` | `byo` vs `provisioned` address source; the provisioning enable flag + G1 acknowledgement |
| `[collectors]` | The authorization gate (`authorization_required`), and the `public_code` format (`code_prefix`, `default_site_code`) - ADR-0017 |
| `[auth]` | `login_max_failures` / `login_window_minutes` (failed sign-ins per identifier before a lockout of one window; 0 disables), supervisor session lifetime (JWT-based, survives offline) |
| `[lightning]` | `float_provider` (`blink` \| `lnbits` \| `fedimint` \| `fake` - a demo rail that pays nothing; refused in production unless `TAKASATS_ALLOW_FAKE_PROVIDER=true`), each provider's non-secret settings, and `provider_hints` (a label per Lightning-address domain - display only), `spend_link_hosts` (hosts whose URLs are spend credentials - rejected before any network call), `lnurl_timeout_ms` (per-request LNURL timeout, 1000-60000), `provider_timeout_ms` (per-request timeout to the wallet provider, 1000-120000; a timeout on a payment is an unknown outcome, never a failure) |
| `[money]` | BTC rate staleness TTL; the ordered list of exchange-rate sources (≥2); the agreement tolerance (an outlier source is set aside; ≥2 must agree within it) |
| `[rates]` | `seed` rows for `material_rates` on the first migration only - history lives in the DB afterwards |
| `[payouts]` | `approval_mode = "risk_based"` uses evidence and `review_threshold_fiat_minor` (default 100000 = KES 1000, strictly above; 0 holds all positive-value work). `legacy` retains the sats sign-off threshold and first-destination approval policy. Both modes require a stored photo. Low-float alert threshold, `sweep_cron`, `sending_stale_minutes`, `resolution_requires_distinct_actor`, `max_attempts` remain operational. |
| `[verification]` | `provider` (`none` or `openrouter`), vision `model` (default `mistralai/mistral-small-3.2-24b-instruct`), `timeout_ms` (30000, range 1000-120000), `max_tokens` (256, range 128-4096), `min_confidence` (0.9), `ocr_required_for_autopay` (true), `weight_tolerance_kg` (0.1), `max_autopay_weight_kg` (100). `none` never claims AI verification; with required OCR it routes manual evidence to review. |
| `[treasury]` | Legacy funding-vote settings retained for compatibility/history only. Funding mutations and the confirmation job are retired; these values no longer enforce external deposits or a wallet balance cap. Keep float small through the wallet provider's own controls. |
| `[reconciliation]` | Paid-kg vs sold-kg variance tolerance |
| `[anomaly]` | Detector thresholds (identical-weight repeats, payout concentration, off-hours grace; `weight_outlier_min_events` prior events a material needs before its weights are judged, and `weight_outlier_mad_k`, how many scaled MADs from the median make an outlier) |
| `[scheduling]` | Coverage-gap alert lead time |
| `[transparency]` | Attestation amount disclosure, weight bucket, public map jitter, Nostr relays |
| `[ledger]` | Checkpoint job on/off, its cron, the minimum new entries per checkpoint, OpenTimestamps toggle |

### Cross-field rules enforced at boot

- `programme.default_locale` must be one of `programme.locales`.
- `custody.provisioning_enabled = true` requires `custody.provisioning_ack` to equal the
  exact `PROVISIONING_ACKNOWLEDGEMENT` string in `lib/config/schema.ts`. This is the
  machine-checkable half of gate **G1** - it forces a deliberate acknowledgement that the
  recorded legal review exists; it is not legal cover.
- `custody.default_address_source = "provisioned"` requires `provisioning_enabled = true`.
- `rates.seed` may not contain a duplicate `material`.
- `money.exchange_sources` needs at least two entries (D-18 - no single oracle).

## What is *not* in the settings file

### Scale-photo privacy and rollout

OpenRouter receives only the stored photograph, not entered kilograms, aliases, payment addresses or GPS
fields. Photographs can themselves contain people or identifying details: brief staff to frame only the
display and load. Requests require structured output, no provider data collection and zero-data-retention
routing. Unsupported routing, missing keys, timeouts or ambiguous readings require review, never a guessed
weight. Configure OpenRouter spend limits externally as well as the response-token and timeout limits.
Synthetic fixtures confirm connectivity, not accuracy on a programme's actual scale. Test representative
clear, blurred and mismatched photographs before relying on automatic payment.

Operational data that changes while the system runs - rate *versions* over time, sessions,
supervisor rotations, API keys, collectors - lives in the database and is edited through
the admin UI / API, because it needs history, audit, and per-row authorisation. The
settings file only seeds the initial rate table on the first migration.

## Adding a new tunable

Phone authentication uses `auth.passkey_origin` (exact HTTPS origin, no trailing slash; HTTP localhost
is allowed for development), `passkey_challenge_seconds` (300; 60-600), `passkey_ticket_seconds`
(60; 15-120), `passkey_recent_login_seconds` (300; 60-900), `passkey_options_per_minute`
(120; 10-1000, per process), and `bootstrap_password_days` (7; 1-30). Compose exposes each with the
usual `TAKASATS__AUTH__...` override. Never derive the trusted passkey origin from forwarded headers.
Changing it can strand enrolled phones. See [phone access](PHONE_ACCESS.md).

Dashboard keys must expire within `auth.api_key_max_age_days` (default 90; allowed 1-365 days).
Compose passes `TAKASATS__AUTH__API_KEY_MAX_AGE_DAYS` to the backend. This limits new issuance, not
extension of existing keys. Session lifetime is separate. See [API integration](API_INTEGRATION.md).

In the same change: add the key to `config/settings.default.toml` (with a comment), add it
to the Zod schema in `lib/config/schema.ts`, and add a row to the table above. An
operational literal in domain code fails review.
