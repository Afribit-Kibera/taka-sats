# Independent communities and shared impact

**Design proposal, 15 October 2026. The cross-community reporting network is not implemented.**
The current public summary reads one installation's database. Kibera is the first implementation;
its numbers must not be labelled global network totals. No second community or independent audit is
implied by a directory entry. This document is a build contract, not a live API specification.

## Local autonomy, optional publication

Each community runs its own app, database, private photo store, ledger and funded payment provider.
It can fork, change operators and continue operating when the main website is unavailable. A central
site can index **opted-in** communities and consolidate approved aggregate snapshots. It cannot know
every fork in the world, and it must not require custody of participants' identities or money.

The public project website and the Kibera operator app are separate responsibilities even if they
share a hostname today. An “open app” link must identify which community's app it opens. Eventually
the directory should let people choose an operator and inspect its public source and reporting status.

## Proposed publication contract

Use a versioned snapshot from an operator's reviewed HTTPS endpoint, with a separate public identity
and signing key. Reuse checkpoint references for provenance; do not reuse the reserve wallet's keys.
The endpoint name and JSON schema will be specified/tested before implementation, not guessed here.

| Field group | Required semantics                                                                           |
| ----------- | -------------------------------------------------------------------------------------------- |
| Publisher   | Stable community UUID, canonical origin, public operator name, schema/source version, key ID |
| Time        | Reporting period, timezone, generated time, valid-until, monotonic snapshot revision         |
| Counts      | Event definitions; local participant count only when publication threshold is met            |
| Quantities  | Material taxonomy/unit, recorded/reviewed/accepted weights kept distinct                     |
| Payments    | Settled sats as exact, bounded interval or withheld; no individual transfers                 |
| Evidence    | Coverage/exclusions, reconciliation status, unresolved corrections, checkpoint head/sequence |
| Integrity   | Canonical payload hash and signature, superseded snapshot reference, key-rotation proof      |
| Sharing     | Consent/opt-in status, aggregate data licence and public contact for corrections/withdrawal  |

Do not send aliases, phone numbers, wallet addresses, evidence images, per-person amounts, exact GPS,
staff identifiers or a hash of those identifiers as a substitute for privacy. Hashes of guessable values
can still identify people. Low counts and precise timing can disclose activity even in “aggregate” data.

## Directory admission and trust

1. Operator explicitly opts in and demonstrates control of the community domain and publication key.
2. Maintainers review endpoint, schema, methodology, privacy settings and overlap with existing listings.
   Approval is **publication eligibility**, not certification of field honesty or endorsement.
3. Display separate labels for operator-reported, independently reviewed and audited scope/period.
   A valid signature proves the publisher/key, not truthful physical activity.
4. Publish listing criteria, appeals, conflicts of interest, key rotation, suspension and departure rules.
   Another operator should be able to host the aggregator from the public protocol and source.
5. A fork/restore/migration retaining the same community identity is not a new community or fresh impact.
   A genuine split needs a documented boundary and non-overlapping historical periods.

## Aggregation rules: prevent impressive but false totals

- Choose one eligible snapshot per community/metric/period. Repeated fetches and cumulative revisions
  **replace**, not add to, earlier versions. Never add a monthly subtotal to its lifetime total.
- For comparable recorded kg, use fixed-precision integer milli-kg and a versioned material taxonomy.
  Keep uncertainty/rounding visible; do not relabel recorded as verified/recycled.
- Do not add local participant counts and call the result unique people worldwide. At most publish
  “sum of community participant counts; people may appear in more than one community”, or omit it.
- Sum exact sats only among publishers consenting to exact disclosure. For bucketed amounts retain
  lower/upper bounds; withheld is **unknown**, not zero. Show coverage beside any partial total.
  Never add different fiat currencies without an explicit rate/time method.
- Distinguish physical collection from later stock transfers. Linked transfers may be visible at
  both communities but contribute new collection impact once. This needs lot/claim lineage first.
- Stale/unavailable sources retain their last timestamped snapshot in a separate historical view.
  Exclude them from current totals with an explicit coverage explanation; never quietly zero them.
- Corrections append a new revision and recompute affected totals. Publish provenance and correction
  reason without retaining withdrawn sensitive content in public caches indefinitely.

## Fetch and trust boundaries

A public “enter any URL” server-side fetcher would create SSRF and resource-exhaustion risk.
Start with a reviewed allowlist of origins/endpoints. Permit HTTPS, reject credentials/nonstandard
schemes, private/link-local/loopback/reserved IPs and redirects, recheck resolved addresses, bind the
connection to the validated address and apply egress controls. Add strict time, body, recursion and
numeric bounds, Zod schema validation, signature/revision checks, per-source rate limits and a cache.
Handle DNS rebinding, zip bombs, huge numbers, duplicate IDs and rollback/replay explicitly.

Publish snapshots server-side on a bounded schedule; visitors should read cached results, not fan out
to every community. The registry never receives provider keys or private operational API keys. A
reporting outage must not stop a local collection or payment worker.

## Build and release gates

1. Agree definitions, privacy minimum cells/delay, correction semantics and custody/transfer boundaries.
2. Ship a local portfolio/snapshot exporter and correction/lot controls; test no PII leakage centrally.
3. Test two independent installations, including restore/migration and different disclosure policies.
4. Add reviewed registry, bounded fetcher/cache and signature/identity lifecycle tests.
5. Attack replay, duplicate snapshots, malicious operators, redirects/rebinding, stale data, conflicts,
   transferred waste and opt-out. Check summaries against both local records and independent receipts.
6. Publish network totals only after provenance, coverage and exclusions are visible in the UI.

Until these gates pass, publish an explicitly scoped local summary and the network plan. That is more
useful than a global counter whose numbers cannot be compared or trusted.
