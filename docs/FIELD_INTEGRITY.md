# Field integrity and supervisor accountability

A ledger can preserve a false statement faithfully. Fraud prevention must combine physical custody,
accountable people and software checks. No app can guarantee that the same waste is never weighed twice.

## Current controls and their limits

| Attempt                              | Implemented control                                                         | Remaining limit                                                                                       |
| ------------------------------------ | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Retry the same offline submission    | Client UUID/content hash and transactional ingest/payout creation           | A new UUID is a new submission, not proof of new material                                             |
| Reuse identical photo bytes          | SHA-256 duplicate detector and payout risk review                           | Crop, recompress or retake the image and the byte hash changes                                        |
| Inflate the entered scale reading    | Configured OCR comparison and reviewed exceptions                           | It reads a display, not material identity, tare, calibration or a unique physical load                |
| Invent a collector or redirect money | Collector authorization, verified Receive destination and role restrictions | Authorized insiders can collude; a wallet endpoint check is not a complete real-person identity check |
| Record outside the shift/site        | Assignment/window validation; GPS risk checks when bounds exist             | Device time/GPS can be manipulated; no configured boundary means no boundary check                    |
| Repeat weights or extreme quantities | Pattern/outlier flags consumed by risk-based payout checks                  | Equal weights can be legitimate; varied weights can evade patterns; flags need investigation          |
| Hide excess recorded material        | Reconciliation queries/reports versus recycler-sale records                 | Manual cadence; no complete opening/closing inventory or linked lot custody today                     |
| Approve one's own exception          | Distinct-recorder/reviewer rules and snapshot-bound review                  | Distinct accounts are not evidence of independent people; most normal work can auto-pay               |

The relevant code is `lib/collection-events`, `lib/fraud`, `lib/verification`, `lib/payouts/risk.ts`
and `lib/payouts/review.ts`. Risk checks rerun before automatic payment; the old description that flags
never influence payment is stale. An exception reviewer can approve legitimate flagged work with a
reason, so a flag is not a hard physical uniqueness guarantee.

## Same garbage measured twice: the operating procedure

1. Define a one-way receiving area: **not weighed → weighed and accepted → secured stock**. Never
   return paid material to the unweighed queue. Mark or seal the physical sack/lot at first acceptance.
2. Have the collector see gross/tare/net and material classification. Start each shift with a zero
   and known-weight check; record scale identifier and failures in the operator's current log.
3. Keep an independent stock custodian or witnessed handover. Count/mark received sacks and record
   dispatch weights, recycler receipts and closing stock. Investigate unexplained differences daily.
4. For transfers, record the original lot reference rather than a fresh payable collection. Until
   lot tracking exists, maintain a controlled external register; do not claim automated enforcement.
5. Sample reweighs and review repeat claims across collectors, supervisors, devices and locations.
   Allow innocent errors to be corrected and challenged without arbitrary forfeiture.

Proposed software work: once-only receipt/lot IDs, atomic payout-eligibility reservation for each
accepted lot, append-only split/merge/transfer/void events, tare/scale fields, stock reconciliation,
near-duplicate image assistance and rate/velocity review. A copied QR label or fresh photograph can
still cheat software; sealed custody and independent checks remain necessary.

Offline devices cannot know all remote claims before syncing. They may save a **provisional** receipt;
only the server can resolve duplicate lot eligibility before payment. Test two devices claiming the
same lot concurrently, delayed/offline arrivals, relabelled transfers and repeated claims in a fork.
Never solve a race with a browser-only flag or a non-transactional “check then pay”.

## Vet supervisors as people, not only accounts

Recommended operational policy, not an implemented hiring/approval workflow:

1. Nomination by the accountable community organization; verify identity privately with proportionate
   local checks and references. Record who checked and when, not unnecessary ID scans in this app.
2. Disclose family/business conflicts with collectors, reviewers, recyclers and wallet operators.
   Train on material grades, scale/tare, evidence, consent, safe handling, queues and disputes.
3. Observe a probation session and reweigh sample loads. Authorize limited shifts and payout exposure;
   proposed probation budgets must be implemented before claiming the app enforces them.
4. Issue an individual staff code and native passkey. No shared accounts. A passkey proves control
   of an enrolled credential, not honesty, competence or the identity of every person using a phone.
5. Separate recording, exception review, physical custody and reconciliation where staffing permits.
   Rotate duties, sample approvals and require independent recovery authorization.
6. Review access regularly, investigate complaints fairly, revoke lost/unused accounts promptly and
   preserve unsynced work. Recovery verifies the person; it is not a public password-reset shortcut.

## Protect workers and constrain incentives

Use published rates and accessible receipts; establish a confidential appeal channel outside the
supervisor's control. Do not incentivize unsafe handling, added water/ballast, importing waste just
to claim rewards, burning, hazardous collection or repeated dumping and recollection. Investigate
variance rather than assuming every discrepancy is theft. Material seasonality and stock timing matter.

Before expansion, rehearse collusion, altered photos, GPS spoofing, duplicate lots, lost phones,
reviewer conflicts, insufficient float and provider timeouts on isolated data and a fake rail.
Publish test outcomes and known residual risk, without publishing participant evidence or exploit details.
