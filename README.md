# Taka Sats

**Waste work recorded. People rewarded.**

Open source software for community waste-work records, scale evidence and Lightning payment
controls. The aim is a work history collection groups can use to show delivery, resolve disputes
and build a portfolio. **Kibera, Kenya, operated by Afribit Africa, is the first implementation.**
Other communities can run independent installations; no central account or permission is required.

[![Licence: AGPL-3.0](https://img.shields.io/badge/licence-AGPL--3.0-blue.svg)](LICENSE)

[Docs](https://taka.afribit.africa/docs) ·
[Fork to production](docs/FORK_TO_PRODUCTION.md) ·
[Purpose](docs/PURPOSE.md) · [Open-source independence](docs/OPEN_SOURCE.md) ·
[Source](https://github.com/Afribit-Kibera/taka-sats)

## What it does

A supervisor chooses an approved collector, records the material and physical scale weight, and
attaches a photo. The phone saves the collection offline and syncs when the app is open and online.
Server checks and an append-only ledger retain the record. Eligible work can pay through a worker;
exceptions require a distinct reviewer. The payout destination is the recipient's verified Receive
wallet, never a spending credential or a value typed at payment time. NFC is optional.

The goal is useful evidence and fair earning opportunities, not simply a Bitcoin transaction count.
Software does not create buyer demand, fund collection or guarantee safe work/income. A chosen wallet
may be custodial; the app does not promise collectors always hold their own keys.

## Current capabilities and limits

| Implemented in code                                                                              | Limits / unfinished work                                                                                      |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Cardless collection, scale photo, offline queue/sync, staff passkeys and assigned shifts         | Enrollment remains online; closed-app background draining and real-device calibration are incomplete          |
| Collector authorization, verified Receive destinations, worker-only payment and exception review | Lightning-only; no supported records-only mode or mobile-money rail                                           |
| Exact photo hashes, OCR display comparison, pattern/risk checks                                  | New photo/new UUID can submit the same physical waste; no complete physical lot/custody workflow              |
| Ledger/checkpoints, operator session CSV/proof pack and reconciliation queries                   | Private proof pack is not a safe public portfolio; stock/transfer lineage and reporting corrections need work |
| Local public totals and independent Compose hosting                                              | No live cross-community aggregator, complete public dataset or full portfolio/receipt UX                      |

“Implemented” describes code, not field certification. See [verification](docs/VERIFICATION.md),
[field integrity](docs/FIELD_INTEGRITY.md), [records and claims](docs/RECORDS_AND_CLAIMS.md)
and the dated [benchmark](docs/LANDSCAPE.md). Recorded kg is not automatically recycled kg.

## Run it independently

Use your own domain, database, private storage, accountable staff, provider credentials and funding.
One community per deployment; no shared-database tenant isolation is claimed.

```bash
git clone https://github.com/Afribit-Kibera/taka-sats.git
cd taka-sats
# Follow docs/FORK_TO_PRODUCTION.md for configuration, demonstration and production acceptance.
```

The [full guide](docs/FORK_TO_PRODUCTION.md) covers secrets/origin, Compose/config precedence,
migrations, staff/passkeys, external funding, supervised tests, backups/restores and upgrades.
Defaults use Blink; a fake rail requires explicit demonstration configuration and is never real income.
A member reserve is created/signed externally; this app stores no reserve keys. Kibera plans a
2-of-3 BlueWallet Vault, unconfirmed until its operator records completion.

AGPL-3.0-only permits independent and commercial use under its terms. If you modify the network
application, provide remote users the Corresponding Source as required by the licence. Code rights,
private participant data, public aggregate sharing and branding/endorsement are separate matters.
See [independence](docs/OPEN_SOURCE.md). Optional paid hosting/support need not restrict self-hosting.

## Independent communities, shared evidence

The current site's numbers come from one installation and may include pilot activity. A future
**opt-in** reporting network can consolidate comparable snapshots with provenance, privacy, periods,
corrections and transfer deduplication. It is not implemented. Local participant counts cannot simply
be called unique people worldwide, and a transfer is not a second new collection.
Read the [network proposal](docs/FEDERATION.md).

## Contribute and operate

- [Development](docs/DEVELOPMENT.md) and [CI](docs/CI.md)
- [API integration](docs/API_INTEGRATION.md), [backend contract](docs/BACKEND.md), [configuration](docs/CONFIGURATION.md)
- [Self-hosting and backups](docs/SELF_HOSTING.md), [phone access](docs/PHONE_ACCESS.md), [community funding](docs/COMMUNITY_SETUP.md)
- [Ledger verification](docs/LEDGER.md), [threat model](docs/THREAT_MODEL.md), [design](docs/DESIGN.md)
- [Contributing](CONTRIBUTING.md), [Code of Conduct](CODE_OF_CONDUCT.md), [security disclosure](SECURITY.md)

[AGPL-3.0-only](LICENSE). Source files use SPDX headers. Contributions use Conventional Commits and
[Developer Certificate of Origin](https://developercertificate.org/) sign-off; no CLA.
