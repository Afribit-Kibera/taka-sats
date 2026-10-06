# Operating hot wallet and external treasury

Taka Sats pays registered recycling recipients from a small operating Lightning wallet.
Treasury governance, reserve keys and funding happen outside this app.

```text
External programme treasury -> operating Lightning wallet -> registered recipient wallet
       external funding           worker-only payment          individual or collective
```

## What operators see

`/hot-wallet` shows provider float and timestamp, low/insufficient-balance warnings, pending payout
count and priced queue liability. Unpriced work makes estimates lower bounds; balance is not a
reservation. A failed balance read is unknown, never fabricated zero. Admin and hub lead can read it.
`/treasury` redirects here.

Fund the wallet through the programme's own external process. Keep operating float small using
provider-side controls; this app cannot cap external deposits. Spending keys stay on the backend,
never on cards or in browsers. Consult [provider notes](providers/README.md) for deposit requirements.

## Payment policy

The worker alone sends payments. Destination comes from the recipient's verified wallet record.
Amount comes from recorded kg, the historical material rate and a fresh exchange snapshot.
One collective collection produces one group-wallet payment, never member splitting.

Risk-based payment requires stored evidence and completed checks. Default required OCR, anomaly
flags and the fiat review threshold select exceptions for a distinct hub lead/admin. See
[the backend contract](BACKEND.md) and [configuration](CONFIGURATION.md).
A review does not send money directly. Insufficient float keeps work `pending_float` until the normal
sweep observes funds. Missing photo/rate/wallet waits; rejected/reweigh work requires new evidence.
Unknown sends remain `sending` until an authorized admin checks, never blindly resend.

## Retired funding workflow

[ADR-0021](adr/0021-field-first-risk-based-payments.md) retires the previous in-app proposals,
signoffs, transfer records and arrival-confirmation workflow. Funding POST routes return authenticated
410 `feature_removed`; the confirmation job is unscheduled. Historical tables, GET records and ledger
entries are preserved. Legacy treasury settings no longer enforce external funding or wallet caps.

## Limits

- A compromised backend can spend operating float; small float limits exposure, not compromise.
- AI display reading can be wrong and does not prove collection truth. Calibrate real-photo accuracy,
  perform spot reweighing and compare recycler mass balance.
- Provider outages, custody restrictions, backup/restore and credential rotation remain operator duties.
