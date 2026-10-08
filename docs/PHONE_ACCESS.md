# Staff phone access

Staff use a provisioned code and private setup phrase once, then create a passkey on Android Chrome.
The phone's native PIN/biometric prompt verifies the user. Discoverable passkeys let subsequent sign-in
work without a staff-code field. Collectors still have no login; NFC identity cards cannot authenticate staff.

Use the exact configured `auth.passkey_origin`, normally `https://taka.afribit.africa`. A passkey created
there cannot sign in at the diagnostic VM domain. Keep this origin stable through deployment and recovery.
The server validates signatures, origin, RP ID, challenge, user presence and user verification through
[SimpleWebAuthn](https://simplewebauthn.dev/docs/packages/server). Only public keys/counters are stored.
PINs, fingerprints, biometric templates and passkey private keys stay with the phone/password manager.
Passkeys may be synced by Android's password manager; this app does not promise hardware-only storage.

Operator-issued phrases are six randomly selected short words, expire after `auth.bootstrap_password_days`
and grant enrollment only. Successful enrollment disables the password and invalidates previous sessions.
Cancellation leaves the phrase usable until expiration. Enrollment requires a recent sign-in; adding
another passkey requires recent phone verification. A valid signed-in session lasts the configured
30-day maximum and supports offline collection; phone verification happens on sign-in, not per collection.

## Lost phone or failed enrollment

Verify the staff member's identity through your own trusted process before recovery. There is no anonymous
password reset endpoint. A privileged server operator runs:

```sh
pnpm staff:reset-phone --staff SAMPLE01 --out /private/new-setup-phrase.txt
```

For Docker, use the `tools` service with a private mounted directory and an absolute output path there:

```sh
docker compose --env-file .env run --rm --no-deps -v /private/handoff:/handoff tools \
  scripts/reset-staff-phone.ts --staff SAMPLE01 --out /handoff/new-setup-phrase.txt
```

Output must be a new file, outside the repository or git-ignored, created mode 0600. The command prints
no passwords. It changes only the named existing active staff: fresh phrase/hash/expiry, all old passkeys
revoked, outstanding registration/login proofs deleted, authentication epoch increased. Existing online
sessions are refused on their next successful database check. Access cannot be revoked on a disconnected
phone until it reconnects; protect the phone with its screen lock. Recovery preserves queued collection
evidence. Do not clear browser data with unsynced work. Hand out each phrase privately, then enroll the
replacement phone. Never share one phrase between staff.

Back up before migration 0015. Its down migration restores the retained password hashes and drops
passkey/epoch records; it therefore restores password access. A production rollback must also invalidate
Auth.js sessions and reset affected bootstrap credentials deliberately. Prefer fixing forward.

The word dictionary is [EFF's Short Wordlist #1](https://www.eff.org/dice), reformatted as JSON;
attribution and CC BY 3.0 US license are in `NOTICE`. Selection uses Node's cryptographic `randomInt`.
