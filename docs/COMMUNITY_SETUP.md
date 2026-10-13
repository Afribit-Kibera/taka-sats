# Launch a managed community

Afribit Africa manages the current Kibera deployment with Blink BTC payouts. Another community
uses its own deployment, database, object bucket, staff and Blink credentials. There is no tenant
isolation inside a shared installation. The public guide is `/start-community`; operators use
`/community-setup` or authenticated `GET /api/v1/community/readiness` (`treasury:read`).

```text
Member multisig → externally approved refill → Blink BTC operating wallet → recipient wallet
  external keys/signing                        worker-only payments       verified Receive
```

## Member reserve

Kibera's reserve has **not yet been created**. The recorded plan is a **2-of-3 BlueWallet Vault**.
Use BlueWallet's [creation guide](https://bluewallet.io/how-to-create-a-multisig-vault-in-bluewallet/)
and [Vault documentation](https://bluewallet.io/docs/multisig-wallet/). Each member keeps their own
key/device; exchange public cosigner information, not seeds. Keep the Vault's coordination/recovery
backup as well as individual key backups. One person holding all keys defeats member separation.
Leave `setup_confirmed=false` until the members complete and verify the ceremony.

Members choose independent signers and an M-of-N policy requiring at least two signatures,
for example 2 of 3. Create the multisig externally, verify addresses/policy together and rehearse
signing and recovery. Keep signer devices and recovery material with the members.
Taka Sats creates no wallet and stores no seeds, keys, descriptors or signing material.
It records a friendly label/policy and an operator attestation; it does not verify custody on-chain.

## Connect and fund Blink

Each community needs a separate Blink account/key. Identify its **BTC** wallet, not the USD wallet.
Configure privately `BLINK_API_KEY` (Read + Write), `TAKASATS__LIGHTNING__FLOAT_PROVIDER=blink` and
`TAKASATS__LIGHTNING__BLINK__FLOAT_WALLET_ID`; keep `TAKASATS_ALLOW_FAKE_PROVIDER` unset/false.
Read allows balance queries; Write allows payments and may also modify user data. A balance read
does not prove Write permission; complete the existing supervised provider check before operations.
[Blink scopes](https://dev.blink.sv/api/auth). Keys stay on the backend, never in a browser or logs.

Obtain a deposit destination from that Blink account. Members independently check the destination
and sign the agreed transfer externally. An on-chain multisig sends to a BTC on-chain address;
use a Lightning invoice only if the funding wallet supports Lightning. Taka Sats initiates no refill.
Wait for confirmation and credit to **available balance**; pending incoming funds cannot pay collectors.
Check the exact BTC wallet and balance in Blink and `/hot-wallet`.
[BTC deposit process](https://dev.blink.sv/api/btc-onchain-receive),
[Lightning funding](https://dev.blink.sv/api/btc-ln-receive).

Budget for planned work, fees and priced/unpriced obligations. Keep float small using the provider's
controls; the retired treasury cap does not limit external deposits. Confirm current provider fees
and limits directly. The launch funding check covers only the priced queue, requires positive balance
and spare coverage, and stays unknown for unpriced obligations. It does not reserve funds or cover
new work/fees/concurrent spending. `pending_float` resumes through the normal sweep after funding;
an uncertain `sending` payment is never blindly retried.

## Staff and field readiness

Issue production codes/setup phrases privately, enroll phone passkeys and revoke unused test access.
Keep an enrolled administrator and independent reviewer. Never revoke the only operator or clear a
phone with queued work. See [phone access](PHONE_ACCESS.md). Publish agreed material rates and verify
a fresh BTC exchange snapshot; set real session location/window and assign supervisors.
Authorize collectors and verify their Receive wallets before weighing. Card issuance grants no payment.
Follow [supervisor setup](SUPERVISOR_SETUP.md): actual Android installation/native permissions/phone
security, scale-photo calibration, airplane-mode capture/reconnect and supervised payment/ledger proof.
NFC is optional.

## Record explicit confirmations

Example non-secret operator override:

```toml
[community]
name = "Example community"
operator = "Example programme"
production_staff_prefix = "LIVE"
field_checks_confirmed = false

[community.reserve]
wallet_label = "Members' external reserve"
required_signatures = 2
total_signers = 3
setup_confirmed = false
```

Confirm only after the actual checks. Configure policy values together; incomplete/invalid confirmed
policy fails boot. Empty 0/0 reserve starts unconfirmed. Compose passes env overrides using
`TAKASATS__COMMUNITY__RESERVE__...`. See [configuration](CONFIGURATION.md).
The read-only checklist reports assigned active sessions, rates/fresh BTC snapshot, enrolled
production-prefix staff and active accounts outside the prefix. It requires at least two production
staff and an enrolled administrator. Prefixes classify codes; they do not prove independent people.
No staff identifier, wallet ID or secret is returned.

Checks are `ready`, `needs_setup` or `unknown`, with a timestamp. `checklistComplete` means the snapshot
and operator attestations pass; it is not a security certification or payment gate. Existing payment
rules remain independent. The authenticated endpoint is `no-store` and makes no funding/access mutation.
Use [release/rollback procedures](DEPLOY_VERCEL.md), private verified backups and isolated fake-rail
tests. Physical checks, external reserve, legacy access cleanup and backup/restore are operator launch
prerequisites; the full Phase 2 roadmap is not claimed by the managed release.
