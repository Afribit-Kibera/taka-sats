# Open source and community independence

Taka Sats is licensed **AGPL-3.0-only**. You can use, study, modify, fork, redistribute and run the
software, including commercially, subject to the licence. You do not need permission from Afribit
Africa, a central Taka Sats account, a franchise agreement or inclusion in an impact directory to run
your own installation. The licence text governs; this page is an operational explanation.
[Open Source Definition](https://opensource.org/osd), [AGPL text](https://www.gnu.org/licenses/agpl-3.0.html).

If you modify an AGPL-covered network application, section 13 requires a prominent opportunity for
its remote users to obtain the Corresponding Source of that version without charge. Preserve notices
and meet the licence's other applicable requirements. A link only to an unmodified upstream tree does
not supply your modified version. Publish the build instructions and required configuration templates
with the source; **never** publish deployment secrets or participant records as source code.

## Independence is more than a licence

| Test                               | What a usable open project should provide                                         | Current position                                                                                   |
| ---------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Obtain the running version         | Public source, release identifier and source link for the actual build            | Check the release commit, not just the existence of a GitHub repository                            |
| Install without the founders       | Fork-to-production guide, synthetic examples, migration and recovery instructions | [Installation guide](FORK_TO_PRODUCTION.md); independent operator rehearsal still needed           |
| Own infrastructure and credentials | Independent domain, database, object store, staff and provider credentials        | Supported as separate deployments; no central licence-server check                                 |
| Change providers                   | Clear interface and truthful support matrix                                       | Blink/LNbits implementations; Fedimint payment/balance incomplete; OCR optional but affects review |
| Leave or migrate                   | Export records/photos/checkpoints, restore rehearsal, documented formats          | Ledger dump/backups exist; complete portable portfolio/exit bundle remains incomplete              |
| Operate without network membership | Local collection/payment remains independent of shared reporting                  | Current system is local; future reporting must remain opt-in                                       |
| Influence maintenance              | Public issues, contribution/security rules and versioned decisions                | Contributor documents exist; maintainers must keep releases/support expectations current           |

The software may be free of licence fees while running it costs money. A capable operator still
needs hosting, storage, backups, a scale, phones, staff, funding, provider access and local operational
review. Open source does not remove those dependencies or promise free support.

## Code, data, branding and trust are separate

- **Code:** AGPL rights apply to the covered software. Optional paid hosting, training and integration
  services can coexist with those rights; they must not become a hidden requirement to run a fork.
- **Data:** participant identities, exact locations, photos and wallet details do not become public
  merely because the software is open. Decide controller responsibilities, consent, retention and
  sharing terms before collecting data. An open aggregate dataset needs its own explicit licence.
- **Branding:** the code licence is not a statement of endorsement. Identify your actual operator,
  source version and support contact. Do not present an independent deployment as operated or audited
  by Afribit Africa. Logo/trademark permissions need a clear separate policy.
- **Trust:** a public source tree or valid digital signature does not certify honest supervisors,
  truthful weights, safe work or correct downstream processing.

## The release checklist for maintainers

1. Publish the exact tested source and lockfile. Confirm a fresh clone can reach that commit.
2. Attach a version/changelog, migration/rollback notes, tested dependency versions and support contact.
3. Run a clean installation with another operator using no private founder files or credentials.
4. Rehearse export/restore into a new database and object store; verify the ledger and sample photos.
5. State unfinished capabilities plainly. Do not label a reporting specification as a live network.
6. Keep contribution and vulnerability reporting accessible; publish security fixes and supported versions.

Commercial sustainability should come from useful services, not compulsory central approval, selling
participant data or locking a community out of its own records.
