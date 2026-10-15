# Waste work that communities can show and use

Taka Sats helps waste-collection groups record their work with supporting evidence and administer
Lightning payments to collectors. The aim is a useful work history: what was received, where and when,
who recorded it, what checks were made, and what was paid. That history should help groups resolve
disputes, demonstrate delivery and build a portfolio for customers, cooperatives and funders.

**Kibera, Kenya, operated by Afribit Africa, is the first implementation. It is not the boundary of
the product.** Other communities can run independent copies under AGPL-3.0-only. Participation in a
future shared impact network is optional. See [open source and independence](OPEN_SOURCE.md).

## The problem and the people

| Person or group                       | Problem                                                                                | Useful outcome to test                                                                           |
| ------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Collector, including young adults     | Unclear weights, disputed deliveries, delayed payment and little portable work history | A comprehensible collection receipt, payment status and a way to challenge mistakes              |
| Cooperative or collection business    | Paper/photo/chat records are difficult to reconcile or present to customers            | A dated portfolio with quantities, evidence coverage, reviewer decisions and downstream receipts |
| Supervisor                            | Repeated data entry, unreliable internet and responsibility without clear procedures   | Few-click offline capture, clear pending states, safe review and support                         |
| Recycler or customer                  | Uncertain quantities, contamination and missing handover evidence                      | Accepted net weights, stock movement and documented differences                                  |
| Sponsor or public-interest researcher | Attractive totals without provenance or visible limits                                 | Source, reporting period, evidence level and exclusions alongside each figure                    |

These are product hypotheses, not claims that the software has increased incomes or reduced pollution.
Test them with collectors and operators, including people who do not want a Bitcoin-only workflow.

## What exists and what still needs building

The implemented spine is an approved recipient, assigned session, physical scale reading and photo,
offline queue, server checks, append-only ledger and worker-managed payment. NFC is an optional
identity shortcut. A collector does not need a Taka Sats login. A chosen Receive wallet may itself be
custodial; the app does not promise that every collector holds their own keys.

A private session proof pack (CSV, ledger/checkpoints, verification and manifest) already exists for
operators. A complete public portfolio, collector-facing receipt/dispute experience, physical lot tracking,
stock accounting and multi-community reporting are still development work. Today each accepted
collection creates a payout workflow. There is **no supported records-only or non-Lightning payment
mode**. Fake payments are demonstration data, not an honest substitute for a records-only deployment.

The [fork-to-production guide](FORK_TO_PRODUCTION.md) describes the current installation. The
[records and claims guide](RECORDS_AND_CLAIMS.md) defines what a portfolio should mean.

## Why this product can be useful

- Keep collection evidence, review decisions and payment status together rather than in separate chats.
- Make retrospective changes visible with a hash-chained record and signed checkpoints.
- Capture work without a reliable connection, then resolve sync and payment exceptions explicitly.
- Let a community own its deployment, records, staff policy and funding arrangements.
- Build reusable integrations through documented APIs rather than requiring one central operator.

Software cannot create buyer demand, fund collection, move waste, calibrate a scale, vet an honest
person or guarantee an income. A photo and ledger hash do not establish that material is new, correctly
classified, recycled or independently certified. See [field integrity](FIELD_INTEGRITY.md).

## Youth earnings and a healthier environment

Design for **safe, fairly paid work**, not a leaderboard that rewards kilograms at any cost. Start
with adult participants; establish age/safeguarding procedures locally without publishing birth dates
or identity documents. Provide sorting and safety training, appropriate protective equipment, a
hazardous-waste exclusion policy, an incident route and a confidential grievance channel.
The ILO documents safety and decent-work deficits in waste work; payments alone are not sufficient.
[ILO waste-work analysis](https://ilostat.ilo.org/blog/beyond-the-bin-decent-work-deficits-in-the-waste-management-and-recycling-industry/).

Measure net earnings after participants' costs and withdrawal fees, time to payment, repeat participation,
disputes resolved and safety incidents. Report distributions and interview evidence, not only totals.
Do not infer a new job from one payout, or ecological benefit from a recorded weight alone.
UN-Habitat distinguishes waste generated, collected and managed in controlled facilities; a local
collection app does not replace that whole measurement system.
[Waste Wise Cities Tool](https://unhabitat.org/wwc-tool).

## When another tool is the better choice

If a group only needs offline survey forms and exports, evaluate KoboToolbox first. If it needs
full inventory/transport operations or accredited plastic-credit reporting immediately, evaluate an
established traceability provider. Taka Sats makes sense when a group needs inspectable evidence and
payment controls, accepts the current limitations and can operate the system responsibly.
See the [dated benchmark](LANDSCAPE.md).
