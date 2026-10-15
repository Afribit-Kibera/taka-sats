# e2e/

Playwright end-to-end specs:

| Suite              | File                         | What it proves                                                                                                                                                     |
| ------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Signed-out sync    | `signed-out-sync.spec.ts`    | a 401 on sync keeps the queue; it drains after signing in again                                                                                                    |
| Offline weigh flow | `offline-weigh.spec.ts`      | a collection is saved on the phone with no network                                                                                                                 |
| Private receipt    | `collection-receipt.spec.ts` | offline capture → Activity receipt → selected-record text download; explicit sync/estimate states, privacy, keyboard, phone reflow, axe and download failure/retry |
| The full story     | `field-story.spec.ts`        | session, enrolment, authorization, offline weigh, sync, approval, payout (demo rail), verification picture, ledger                                                 |
| Operating wallet   | `hot-wallet.spec.ts`         | read-only wallet status and authenticated 410 on retired funding mutations                                                                                         |
| Accessibility      | `a11y.spec.ts`               | axe finds no serious or critical violation on the public, console and supervisor pages                                                                             |

## Running

```sh
pnpm exec playwright install chromium   # once
DATABASE_URL=postgresql://…  AUTH_SECRET=…  pnpm e2e
```

`playwright.config.ts` builds the app (`build:turbo`) and starts it on port 3100
(`E2E_PORT` to override). `e2e/global-setup.ts` truncates and re-seeds a known
field supervisor + an active assigned session + a collector + a rate + an
exchange snapshot - so `DATABASE_URL` must point at a **throwaway** database.

The full story also requires explicit `E2E_S3_ENDPOINT`, `E2E_S3_BUCKET`, `E2E_S3_REGION`,
`E2E_S3_ACCESS_KEY_ID`, `E2E_S3_SECRET_ACCESS_KEY` for disposable object storage. Otherwise that story
is explicitly skipped; missing mandatory photos cannot produce a payment. Do not inherit production
storage credentials. Payments always use the fake rail here; scale OCR is manual and requires review.

The self-hosted CI runner (`scripts/ci/run.sh --e2e`) is authoritative; GitHub Actions is unavailable.
Use `E2E_WITH_SERVICE_WORKER=1` for the production webpack/Serwist build and offline route coverage.
