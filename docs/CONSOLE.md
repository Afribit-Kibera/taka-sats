# The operator console

The bundled console is an optional reference client, not a required administrator workspace.
The supervisor field app is the product UI; programme operators can use their existing dashboards
through the API. See [API integration](API_INTEGRATION.md). Existing console routes remain in the
codebase; no role or permission is removed merely by choosing not to use them.

The admin console (`app/(admin)`) is how staff run a programme day without touching `curl`: vetting
collectors, reviewing payout exceptions, monitoring the operating hot wallet and verifying the
ledger. It is deliberately plain: it composes the shared UI primitives in the existing token
styling, and a designer can restyle it later without touching its logic.

## Who sees what

| Role | Screens |
|---|---|
| `admin` | Daily work: overview, recipients, collections, cards, field app. Review: exceptions, payouts, hot wallet, anomalies, reconciliation, ledger. Programme setup: sessions, rates, rotations, staff. |
| `hub_lead` | Overview, recipients, collections, cards, field app, exception review, payouts, hot wallet, aggregate live reconciliation. No staff/rate changes, anomaly verdicts or stuck-payment resolution. |
| `supervisor` | Field PWA only: identify, material, weight, mandatory photo, review and offline save. Registration and card linking are online. No operator console or payout approval. |

The nav filters by scope (`components/admin/AdminNav.tsx`), admin-only pages redirect a hub lead to the
overview (`lib/auth/page-guard.ts`), and **every API call is still checked by the server**. Hiding a
button is a convenience, never the control.

## How a screen is built

- A thin server page under `app/(admin)/<name>/page.tsx` renders one client component from
  `components/console/`. The layout provides who is signed in (`useConsoleUser()`, with `can(scope)`).
- Client components read and write through `/api/v1` using `lib/console/api.ts`. It never throws: a call
  resolves to `{ ok, data }` or `{ ok: false, code, status }`. The UI switches on the stable error `code`
  and shows a translated message (`Console.errors.<code>` in `messages/*.json`). It never shows the
  English `message`.
- `components/console/kit.tsx` has the shared pieces: `DataState` (loading, error, empty, content in one
  place), `ActionButton` (runs an API action, disables itself, asks first when `confirm` is set, shows the
  failure beside the button), `DomainPill` (a status chip that is icon, colour and text), tables, fields.
- `components/console/hooks.ts` has `useApi` (GET and keep the last good data while reloading) and
  `usePaged` (cursor pagination with Load more), `useStaffNames` (id to name for admins).
- A collector's printable credential QR is drawn locally with `qrcode` (`components/console/CredentialQr.tsx`).
- Every user-facing string is a `messages/{en,sw,sheng}.json` key under `Console.*`. `sw` and `sheng`
  carry English placeholders until translated.

## Adding a screen

1. Add the page and a client component. Use `DataState` so loading, error and empty states exist.
2. Add the nav entry with the scope that gates it.
3. Add the strings to all three message files.
4. If the screen needs data the API does not return, change the API first and update `docs/BACKEND.md`
   in the same change.
5. Add it to the accessibility pass (`e2e/a11y.spec.ts`).

## Tests

`e2e/field-story.spec.ts` runs the whole programme story in real browsers (session, enrolment,
authorization, offline weigh, sync, approval, payout, verification picture, ledger). It drives the
payout worker step through the same handler the worker process registers, because the harness does not
start a second process. `e2e/hot-wallet.spec.ts` checks the operational view and retired funding routes.
`e2e/a11y.spec.ts` runs axe over the public pages, every console page and the supervisor pages.
The full payment story requires `E2E_S3_ENDPOINT`, `E2E_S3_BUCKET`, `E2E_S3_REGION`,
`E2E_S3_ACCESS_KEY_ID` and `E2E_S3_SECRET_ACCESS_KEY` for a dedicated disposable store. Without those
it explicitly skips that story rather than pretending a missing mandatory photograph can pay.
Never use production storage or database for e2e: global setup truncates test tables.
