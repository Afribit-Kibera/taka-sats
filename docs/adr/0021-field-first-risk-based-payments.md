# ADR-0021: field-first collection, risk-based payment and external treasury

Status: Accepted by the programme owner, 2026-10-06.

Supersedes the in-app funding vote in ADR-0020, not the small-operating-float principle.

## Decision

- Field staff identify a recipient, select material, enter physical kg, photograph the display/load,
  review and save offline. They do not manage governance or wait for wallet calls.
- Reuse collector identities and signed payloads. Add `recipientType` (`individual|collective`) without
  renaming historical fields. A collective has one wallet and one payout, no member splitting.
- The worker requires stored evidence, authorized recipients, verified destinations, fresh pricing and
  completed anomaly checks. Risk-based mode auto-pays eligible work; exceptions and value strictly above
  a configurable fiat-minor threshold require a different hub lead/admin to review with a reason.
- Approved/rejected/reweigh decisions are ledger corrections bound to evidence, destination and risk.
  Changes invalidate approval; rejects/reweighs cannot be retried into payment. Unknown sends remain
  protected from duplicate payment. Nobody gains `payout:execute`.
- OpenRouter/Mistral reads only the visible display. It cannot replace recorded kg or claim complete V1
  verification. Required OCR fails to review on ambiguity/outage/unsupported output. Privacy-constrained
  provider routing and bounded requests are mandatory.
- Treasury funding/governance happen externally. Show operating float and pending liability only.
  Retire funding POST routes and their schedule; preserve all historical records.
- NFC contains public identity pointers only. Blank writes are read back before linking; printable
  QR/code lookup works without NFC. Registration/linking require connectivity.
- Physical mass-balance flags feed future review for affected sessions/supervisors, never reverse payments.

## Consequences and limits

Migration 0013 is additive and reversible. Existing `pending_approval` states remain compatible but mean
exception review in risk mode. Operators must explicitly select `legacy` to keep old sats/first-wallet
holds; threshold 0 in that policy is not a risk-mode setting. Default OCR-required policy holds manual
evidence when no provider is configured. Calibrate models with actual scales; a photo can be staged.
Offline registration, material classification and scheduled reconciliation remain separate work.
Server API permissions, not hidden navigation, enforce RBAC.
