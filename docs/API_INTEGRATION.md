# Use Taka Sats from your own dashboard

Taka Sats exposes its business operations through `/api/v1`. Your existing dashboard can use those
operations without rendering the bundled operator console. The field app remains the supervisor's
workspace; collectors do not need accounts or a dashboard.

The [backend contract](BACKEND.md) contains the endpoint bodies, response fields, errors, pagination,
offline sync and configuration. This guide explains where an external dashboard fits. It describes
the current implementation, not a promise that every planned integration feature already exists.

## People and access

There are currently **four authenticated roles**, not four kinds of required users:

| Actor | Current access | Why it exists |
|---|---|---|
| Collector | No login. Holds an identity card or public code and receives payment to their own wallet. | Represents the person or collective whose work is recorded. |
| `supervisor` | Register collectors, attach an initial wallet under the ownership/session rules, issue cards, record/sync collections and read their own event payouts. | Daily field operations without control of payouts or programme configuration. |
| `hub_lead` | Supervisor access plus collector authorization, independent payout-exception review and operating-wallet/live reconciliation reads. | Delegated field reviewer, without full administrator powers. Optional staffing role. |
| `admin` | Programme/staff/rate/session configuration, authorization, exception review, uncertain-payment resolution and audit/reconciliation APIs. | Operator permissions, usable from an existing dashboard. An admin dashboard is not required for the API to work. |
| `partner` | Restricted sponsored-session aggregate/report scopes. Several related reporting endpoints remain planned. No collector, wallet or photo access. | Optional funder reporting, not a required field-pilot account. |

The code still contains all four roles. Removing a UI does not remove a backend permission. For a small
programme, supervisors and API-side admins can operate without hub-lead or partner accounts. Changing
the role definitions or who may authorize collectors requires an explicit policy change and RBAC tests.

No human role has `payout:execute`. Approval releases eligible work to the worker; it does not let a
dashboard choose a payment amount or destination. Reviewers cannot approve a collection they recorded.

## Registration and cards

The intended field responsibility is the supervisor's: register the collector, then associate a card
with that identity. The NFC content is only `takasats:<publicCode>` and its matching public reference
URL. The server maps the chip serial to the collector. Do not write personal details, wallet secrets,
balances or a spending credential onto the chip. Printed alias/code/QR are separate from chip storage.

**Separate gates:** a supervisor's new collector is `pending`, but their identity card can be issued
immediately. Tag linking does not change that status. Pending identities remain outside the offline
weighing cache and cannot be weighed or paid until authorized. Revoked identities cannot receive a
new card. Possessing a card never authorizes a payout. Whether supervisor registration should itself
activate collectors is a separate policy decision, not an implicit consequence of issuing a card.

## Authentication

The API supports scoped bearer API keys as well as existing Auth.js session cookies. Browser pages
remain cookie-authenticated; an API key does not log a browser into the field app or console.
OAuth/SSO and a cross-origin browser credential flow are not implemented.

An administrator signs in once to create a key with `POST /api/v1/api-keys`. It belongs to that
administrator, not an arbitrary staff identity. Only administrator sessions can create, list or
revoke keys; a bearer cannot perform key management. Choose explicit scopes and mandatory expiry
within `auth.api_key_max_age_days` (90 days by default).

```json
{
  "name": "Programme reporting dashboard",
  "scopes": ["payout:read", "session:read", "treasury:read", "ledger:read"],
  "expiresAt": "<future ISO-8601 timestamp within the configured maximum>"
}
```

Creation returns `201 { key: <metadata>, token: <secret> }` with `Cache-Control: private, no-store`.
Save the token immediately in your dashboard's server-side secret store. It is returned once.
The database retains only its SHA-256 hash and short identification prefix. List/revoke responses
return metadata, never the token or hash.

Your dashboard backend sends `Authorization: Bearer <token>` to `/api/v1`. Every request intersects
the key scopes with its owner's current role. Expired/revoked keys and inactive owners return 401;
missing grants return 403. Demotion removes permissions on the next request. Invalid bearer headers
never fall back to an accompanying valid cookie. `payout:execute` and `apikey:manage` cannot be
delegated. Different keys belonging to one person do not create independent reviewers.

Use `GET /api/v1/api-keys?limit=&cursor=` for metadata and `POST /api/v1/api-keys/:id/revoke` to
revoke a key, immediately and idempotently. Administrators may revoke other administrators' keys
for incident response. There is no secret recovery; create a replacement and revoke the old key.

### Bootstrap an administrator session

For an existing dashboard backend, use the documented HTTP sign-in flow with a cookie jar:

1. `GET /api/auth/csrf`; retain the cookies and `csrfToken`.
2. `POST /api/auth/callback/credentials` with form-encoded `csrfToken`, `identifier` and `password`;
   retain the resulting cookies and follow the authentication response.
3. `GET /api/auth/session`; verify the expected staff identity and role before making API calls.
4. Use the session for key issuance/rotation. Cookie-based API calls also remain supported.

Use the canonical origin `https://taka.afribit.africa`. Keep passwords and session cookies in your
dashboard's server-side session handling, never in public JavaScript, URLs, source control or logs.
Preserve a distinct staff identity for each reviewer; a shared administrator login loses accountability.

A browser dashboard on another origin cannot simply fetch private APIs and assume cookies/CORS will
work. Make bearer requests from its backend, never embed staff keys in public JavaScript. Cross-origin
browser integration and SSO are follow-up work. Do not
make private endpoints public, weaken cookie protections or embed provider keys to bypass that work.

## Dashboard operations

All paths below are relative to `/api/v1`; use [BACKEND.md](BACKEND.md) for exact contracts.

| Dashboard function | Endpoints |
|---|---|
| Programme identity and health | `GET /meta`, `GET /health` |
| Collector registration and identity | `POST /collectors`, `GET /collectors`, `GET /collectors/:id` |
| Authorize or revoke a collector | `POST /collectors/:id/authorization` |
| Initial or replacement payment destination | `POST /collectors/:id/destinations` (ownership and status restrictions apply) |
| Card association and lookup | `POST /collectors/:id/tags`, `GET /tags/:tagId`; revocation is administrator-only |
| Sessions, rates and staff | `/sessions`, `/rates`, `/supervisors`, `/rotations` (methods and grants differ) |
| Evidence and event history | `GET /events`, `GET /events/:id`, `GET /photos/:sha256` |
| Payment status and exceptions | `GET /payouts`, `GET /payouts/:id`, `POST /payouts/:id/review` |
| Uncertain-payment handling | `POST /payouts/:id/check`, `POST /payouts/:id/resolve` |
| Operating wallet | `GET /hot-wallet` (fund externally; no in-app funding proposals) |
| Reconciliation and anomaly review | `/reconciliation`, `/recycler-sales`, `/anomalies` |
| Audit proof | `GET /ledger`, `GET /ledger/checkpoints`, `GET /ledger/verify` |
| Public impact | `GET /stats/summary` (disclosure-controlled aggregates only) |

The field app separately handles offline bootstrap, photo upload and idempotent event sync. A dashboard
must not fabricate events to issue payments or rewrite stored evidence. Treat `sending` as uncertain,
not failed; never blindly retry a payment whose outcome is unknown.

The bundled console is an existing optional reference client. Its presence is not a requirement to
build or maintain a second administrator dashboard. A machine-readable OpenAPI specification and
integration with your particular external dashboard remains to be completed. The API-key HTTP
lifecycle and scope-denial paths have automated integration coverage.
