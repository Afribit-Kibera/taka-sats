# Records, portfolios and responsible claims

Taka Sats is a collection-work record and payment system. Its ledger establishes record integrity
under the documented signing and backup assumptions; it does not establish physical truth by itself.

## Use separate quantities

| Quantity             | Meaning                                              | Evidence needed                                                          |
| -------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------ |
| Recorded kg          | Weight entered on accepted collection records        | Session, material, entered scale reading and available photo             |
| Reviewed kg          | Records that passed the stated review policy         | Reviewer/evidence status and unresolved exceptions                       |
| Paid kg              | Collection weight associated with settled payouts    | Provider result and linked payout record                                 |
| Recycler-accepted kg | Net weight independently received by a recycler      | Dated receipt, material, lot/handover links and accountable counterparty |
| Recycled kg          | Material actually processed into an evidenced output | Downstream processing proof, losses and chain of custody                 |

These quantities overlap. **Do not add them together.** One kilogram can pass through several stages
but is not several kilograms of environmental impact. Paid kg is not automatically recycled kg.
Existing public `/api/v1/stats/summary` totals accepted collection records and settled payments; it
does not filter all weights into independently verified recycling. Rounding/disclosure settings apply.

## A useful portfolio: proposed product acceptance criteria

A group should be able to export a bounded period as both human-readable report and machine-readable
data. The existing operator CLI `scripts/proof-pack.ts` exports a session CSV, ledger/checkpoints,
verification result and manifest. It is a useful **private** starting point, not a complete public
portfolio: it includes stable collector codes, exact timestamps and individual payment values.
A complete privacy-reviewed, multi-session portfolio/receipt experience is not implemented yet.

### Private field collection receipt

In the field app's **Activity**, each locally saved collection has a **Receipt** action. This version
can show and download a text acknowledgement offline, using the record already stored on the phone.
It contains one collection reference, a cached public collector code when available, community/operator,
device capture time in UTC, material, recorded kilograms, estimated sats and the phone's sync state.
Names, wallet details, GPS, photos and other collectors' rows are excluded. Treat the exported reference
and code as private; share with the selected collector or an authorized operator, not a public feed.

This is a capture acknowledgement, not a payment receipt or a recycling certificate. Even a saved
server acknowledgement does not establish review or settlement. Later corrections and current payout
status are not fetched by this receipt. Preserve the reference when asking the operator for a review.
An authoritative server snapshot, settled amount and group portfolio remain separate work.

- Operator, community, reporting period/timezone, source version and report generation time.
- Material-level recorded/reviewed/paid/accepted weights and evidence coverage, with unverified totals
  kept separate. Use net weights and document tare, moisture, contamination and stock movements.
- Collection references, hash/checkpoint references, restricted evidence links and handover receipts.
- Pending/rejected/disputed records, correction history and reconciliation status; no cherry-picking.
- Aggregate earnings, payment delay and fees where measured; public sharing must respect disclosure.
- A plain statement of who reviewed what, whether review was independent, and limitations.
- An export manifest/hash, schema version and instructions to verify the record chain independently.

Private operational reports need role-based access. Public portfolios must omit names/aliases, phones,
wallets, faces, exact coordinates, individual payments and identifying small groups. Obtain appropriate
permissions, suppress small cells, and review repeated releases for inference risk. A participant should
be able to obtain their own receipt and dispute a mistake without exposing everyone else's evidence.

## Corrections and duplicate claims

Do not silently erase an incorrect collection. Preserve the original and append a linked correction,
reversal or exclusion with reason and actor. Design reporting to apply those adjustments once. A
first-class correction/claim-exclusion workflow across portfolios and network totals is still a gap.

Use physical lot and transfer identifiers so receipt at a second hub is a **handover**, not a second
new collection. Splits/merges need parent links and conserved mass. Funding claims need an allocation
record: a sponsor's supported fraction cannot exceed the eligible work and cannot be sold again as
exclusive impact to a second sponsor. These controls are proposed, not enforced by the current schema.

## Words to use carefully

- Say **recorded collection weight** unless higher evidence supports a stronger statement.
- Say **settled payments**, not guaranteed earnings or jobs created.
- Label operator-reported, reviewed and independently audited figures separately.
- Do not claim carbon offsets, plastic neutrality, additionality, EPR compliance or certified credits
  from a photo, payout or ledger hash. Accredited claims require their own methodology and review.
  [Verra's Plastic Program](https://verra.org/programs/plastic-waste-reduction-standard/) explicitly
  includes methodologies, independent auditing and a registry; Taka Sats is not that certification.
- Follow the separation of collection and facility outcomes in
  [UN-Habitat's measurement approach](https://unhabitat.org/wwc-tool).

## Recommended next build

Start with a downloadable group portfolio and collector receipt, then lot custody/stock movements
and corrections, then optional cross-community reporting. Validate that an actual recycler, collection
group and funder can use one report before adding claim products or global rankings.
