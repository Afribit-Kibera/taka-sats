# Fork Taka Sats and run your own community

Independent-operator guide, checked against the code on **15 October 2026**. No Afribit account,
Kibera credential or directory approval is required. You need a capable server operator. This guide
supports a supervised pilot; it is not production certification. Read [purpose](PURPOSE.md),
[open-source rights](OPEN_SOURCE.md) and [field integrity](FIELD_INTEGRITY.md).

## 1. Fork, clone and pin a public version

Fork [Afribit-Kibera/taka-sats](https://github.com/Afribit-Kibera/taka-sats), or clone upstream:

```bash
git clone https://github.com/Afribit-Kibera/taka-sats.git
cd taka-sats
git log -1 --format='%H %s'
```

Deploy the exact commit you tested. A fork can add an upstream remote for fixes; review releases and
migrations before upgrading. Preserve AGPL/notices and provide your modified version's Corresponding
Source. Never commit secrets or participant data. If deployed source is ahead of the public branch,
maintainers must publish it before advertising that installation as the version others can reproduce.

## 2. Arrange independent infrastructure and people

Use Linux, Git, Docker Engine and **Compose 2.24.4+** ([merge/override syntax](https://docs.docker.com/reference/compose-file/merge/)), your own domain,
DNS/HTTPS, independent database/private photo store, and encrypted off-host backups. Check load needs;
a small pilot VM is not a proven production capacity estimate. Local development/test tooling uses
Node24 and pnpm11.25.0; containers build the application.

Name the operator, independent reviewer, supervisor and stock custodian. Arrange phones, calibrated
scale, a recycler/buyer, safety, consent and grievance procedures. Use **separate deployments/data/
storage/staff/provider credentials per community**. There is no shared-database tenant isolation.

Blink and LNbits payment adapters exist; Fedimint pay/balance is incomplete. Records-only and
non-Lightning payment modes are not implemented. If you only need evidence forms, evaluate KoboToolbox.
Future [shared reporting](FEDERATION.md) is optional and not implemented yet.

## 3. Configure secrets, identity and cautious policy

Commands assume Bash on Linux, from the repository root:

```bash
umask 077
cp .env.example .env
chmod 600 .env
openssl rand -base64 32
```

Generate different random secrets for auth, Cron, database/storage passwords and ledger signing.
`LEDGER_SIGNING_KEY` is a base64 32-byte Ed25519 seed, not a Bitcoin key. Match database/storage
client credentials to service credentials; URL-encode database passwords consistently if needed.
Back up secrets privately. Never copy Kibera's `.env`, accounts or data.

Edit these **non-secret example settings** in `.env`; replace the domain/operator:

```dotenv
TAKASATS_DOMAIN=waste.example.org
TAKASATS__PROGRAMME__PUBLIC_BASE_URL=https://waste.example.org
TAKASATS__AUTH__PASSKEY_ORIGIN=https://waste.example.org
TAKASATS__COMMUNITY__NAME=Example Community
TAKASATS__COMMUNITY__OPERATOR=Example Cooperative
TAKASATS__COMMUNITY__PRODUCTION_STAFF_PREFIX=EX
TAKASATS__COMMUNITY__FIELD_CHECKS_CONFIRMED=false
TAKASATS__COMMUNITY__RESERVE__WALLET_LABEL=Members external reserve
TAKASATS__COMMUNITY__RESERVE__REQUIRED_SIGNATURES=2
TAKASATS__COMMUNITY__RESERVE__TOTAL_SIGNERS=3
TAKASATS__COMMUNITY__RESERVE__SETUP_CONFIRMED=false
TAKASATS__PAYOUTS__APPROVAL_MODE=risk_based
TAKASATS__PAYOUTS__REVIEW_THRESHOLD_FIAT_MINOR=0
TAKASATS__VERIFICATION__PROVIDER=none
TAKASATS__VERIFICATION__OCR_REQUIRED_FOR_AUTOPAY=true
TAKASATS__LIGHTNING__FLOAT_PROVIDER=fake
TAKASATS_ALLOW_FAKE_PROVIDER=true
```

The final two values are **demonstration only**. Fake paid rows are simulated, not earnings/impact.
Keep live provider keys and float out of the demonstration. Leave `TAKASATS_API_ORIGIN` and
`TAKASATS_ASSET_PREFIX` unset for single-domain hosting. The first operator's Vercel/VM split is optional.

Create ignored `config/settings.toml` for settings not already overridden by Compose:

```toml
[programme]
name = "Example waste collection programme"
timezone = "Africa/Nairobi"
fiat_currency = "KES"
locales = ["en"]
default_locale = "en"
public_base_url = "https://waste.example.org"

[auth]
passkey_origin = "https://waste.example.org"

[collectors]
authorization_required = true
default_site_code = "EX"

[rates]
# Example only: replace with agreed currency-minor-units per kg BEFORE seeding.
seed = [{ material = "PET", rate_fiat_minor_per_kg = 2000 }]
```

Prices/currency are not universal. Environment values win over TOML; Compose passes explicit defaults
for several keys. The HTTPS overlay mounts config into app/worker. Mount it explicitly for tools below.
English is maintained; Swahili/Sheng still need native review. See [configuration](CONFIGURATION.md).

## 4. Build, initialize, then start the app

```bash
dc() {
  docker compose -f docker/docker-compose.yml -f docker/docker-compose.https.yml \
    --env-file .env "$@"
}
dc build app worker tools
dc up -d --wait postgres minio relay
dc run --rm --no-deps -v "$PWD/config:/app/config:ro" tools scripts/migrate.ts
dc run --rm --no-deps -v "$PWD/config:/app/config:ro" tools scripts/seed.ts
dc up -d --no-build --wait app worker caddy
dc ps
curl --fail https://waste.example.org/api/v1/health
curl --fail https://waste.example.org/api/v1/meta
```

Keep the same overlays in every command. Caddy needs DNS and ports80/443. Health reports database
reachability; meta must identify the demonstration rail (`lightning.demo=true`). Worker logs, queues,
fresh exchange rates and storage need separate checks. Do not begin collection after migration/TLS/
photo/worker failure. [Self-hosting](SELF_HOSTING.md) also covers Garage and backups.

## 5. Create individual staff and enroll phone security

At least three independent people can separate recording, review and recovery/uncertain-payment
resolution. Extra accounts held by the same person do not provide independence. Example codes:

```bash
create_staff() {
  export SUPERVISOR_PASSWORD="$(openssl rand -base64 24)"
  dc run --rm --no-deps -e SUPERVISOR_PASSWORD -v "$PWD/config:/app/config:ro" tools \
    scripts/create-supervisor.ts --name "$1" --phone "$2" --role "$3"
  unset SUPERVISOR_PASSWORD
}
create_staff "Example Operator" EXADM01 admin
create_staff "Example Reviewer" EXREV01 admin
create_staff "Example Supervisor" EXSUP01 supervisor

install -d -m 700 /srv/takasats-private
dc run --rm --no-deps -v "$PWD/config:/app/config:ro" -v /srv/takasats-private:/handoff tools \
  scripts/reset-staff-phone.ts --staff EXADM01,EXREV01,EXSUP01 --out /handoff/initial-phrases.txt
```

The random initial passwords are not printed or passed as password command-line flags. The reset
command creates a private new phrase file and requires phone enrollment. On existing accounts it
revokes old passkeys/sessions: do not run it casually. Give each phrase privately to its owner; they
sign in on **your configured HTTPS origin** and enroll a passkey unlocked by native phone security.
The server never receives the PIN/biometric template. See [phone access](PHONE_ACCESS.md).

Publish agreed rates; create and activate a session with actual location/window/assigned supervisors.
`seed-pilot` and `pilot-smoke` can create accounts/collectors/collections: they are for disposable
fixtures, not read-only production checks. Do not run their default demo staff against real data.

## 6. Rehearse on the disposable installation

Install the Android PWA, allow camera/location, register/approve a synthetic collector, attach a
test Receive destination, capture a scale photo offline, reconnect, review, inspect the simulated
payout and verify the ledger. Try duplicate resend/photo, wrong wallet, closed shift, denied permission,
network failure and storage failure. NFC is optional. Record actual phone/browser/scale behavior.

Run `pnpm ci:local --e2e --docker` on isolated test infrastructure with Chromium. The CI runner
provisions throwaway Postgres; never pass production DB/bucket credentials. Physical duplicate loads
still need [custody and stock procedures](FIELD_INTEGRITY.md); a passing test is not proof of new waste.

## 7. Set up a clean live deployment and fund it

Use a new production database/storage/secrets, without synthetic work or demonstration phone queues.
Repeat the reviewed setup and choose your own real provider. For Blink, edit private `.env`:

```dotenv
TAKASATS__LIGHTNING__FLOAT_PROVIDER=blink
TAKASATS_ALLOW_FAKE_PROVIDER=false
BLINK_API_KEY=<your private Read and Write key>
TAKASATS__LIGHTNING__BLINK__FLOAT_WALLET_ID=<your BTC wallet ID>
```

Recreate app/worker after env changes. Threshold0 in risk-based mode holds positive-value work for
review; do not assume changing the legacy sats threshold changes that policy. Evaluate real scale
evidence before automatic payouts. Never clear a browser with unsynced work.

Members create their reserve externally and rehearse recovery. BlueWallet 2-of-3 is Kibera's plan,
not a mandatory vendor. Verify the correct Blink BTC on-chain deposit address, sign the refill
externally and wait for confirmed **available balance**. The app needs no reserve seeds/signatures.
[Funding procedure](COMMUNITY_SETUP.md), [Blink scopes](https://dev.blink.sv/api/auth).

```bash
# Read-only provider check, from the private backend environment:
dc run --rm --no-deps -v "$PWD/config:/app/config:ro" tools scripts/provider-check.ts
```

A balance read does not establish payment permission. With explicit fund-owner authorization,
perform a bounded supervised transfer to a wallet the operator controls and inspect settlement.
`--pay-sats`/`--to` spend real funds: read [provider instructions](providers/README.md) first. Unknown
send outcomes need reconciliation, never a blind retry. This guide itself authorizes no payment.
Budget upcoming work/fees/obligations; positive float is not unlimited funding.

## 8. Meet production acceptance and produce useful records

Before real participants: enroll staff, remove unused/test access, prove backup/restore, complete
actual Android/scale/offline checks, establish safety/consent/grievance procedures and name a recycler-
data owner. Complete a witnessed handover/reconciliation cycle. Until lot inventory exists, maintain
opening/closing stock and transfers in a controlled external register.

`/community-setup` is a snapshot, not certification. Only attest external/field flags after actual
checks. Preserve distinction between recorded, accepted and processed mass in reports.

`scripts/proof-pack.ts --session <id>` can export a **private session pack** to a mounted private
directory: CSV, hashes/checkpoints and manifest. It includes public collector codes, exact times and
individual payout values. Do not publish it unchanged. A complete public portfolio, collector receipt
and safe network export remain work in [records and claims](RECORDS_AND_CLAIMS.md).

## 9. Operate, recover, upgrade or leave

Back up Postgres, photos, settings and signing/secret recovery material encrypted off-host. Restore
into a new database/bucket, verify ledger/checkpoints and sample photos, and record recovery time.
Set retention, monitoring and incident ownership. [Backup commands](SELF_HOSTING.md),
[ledger verifier](LEDGER.md).

For upgrades: test the exact source/migration, take verified backups, retain old images/config,
migrate in the documented order, switch app/worker and watch auth/assets/queues/rates/storage/payment
exceptions. Review rollback compatibility. Do not restore an old DB casually after live payments;
reconcile external provider history first. Preserve unsynced phones and credential origins.

Your community can continue without the main website or directory. Keep independent source/data/
backup access and support contact. Joining the [proposed reporting network](FEDERATION.md) is optional.
