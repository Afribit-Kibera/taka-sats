# Install and run the supervisor app

Open **https://taka.afribit.africa/install** in Chrome on an NFC-capable Android phone. Avoid in-app
browsers. Tap **Install app** if offered, or Chrome's menu → **Install app / Add to Home screen**.
Open the home-screen icon and sign in once with your private staff code/setup phrase. The installed app starts
at `/setup`. Installation acceptance and actually running the installed app are separate statuses.

Enable an Android screen lock (PIN, fingerprint or face unlock), then tap **Set up phone security** and
approve Chrome's native passkey prompt. Operator-issued setup phrases expire after seven days and grant
phone setup only. Successful enrollment disables the phrase and replaces the password session. On later
visits choose **Sign in with phone security**; the phone selects your account without typing a staff code.
Use this same installation domain each time. Passkeys may sync through the phone's password manager.
The app never receives your phone PIN or biometrics. An existing session remains signed in for up to
30 days, including offline work; phone verification is requested at sign-in, rather than every collection.
For a lost phone or unavailable passkey, the administrator revokes its access and issues a new phrase
using the operator-only procedure in [phone access](PHONE_ACCESS.md). Reconnect before signing in.

Tap **Allow Camera**, **Allow Location** and **Allow NFC**. Enable Android Location/NFC too. Camera is
used for QR scans and evidence; location is recorded with collections; NFC reads/writes identities.
The permission checks save no evidence. No microphone, notification or Bluetooth permission is required.
If denied, allow access in Android's Chrome app permissions and Chrome's site settings, then retry.
Without NFC use printed QR/code lookup. The hardware must still be checked with one real blank card.

Tap **Check session and download field data**, then **Open field work** while online. A supervisor needs
an active assigned session and published material rates. Downloaded data supports offline weighing;
registration, wallet verification and card linking require internet. Keep the app open when reconnecting
to upload photos and sync events. Do not clear browser data with queued work. Private API responses are
never an offline cache; pending evidence lives in IndexedDB.

1. Register the person or collective in **Enrol**. Scan their wallet's **Receive** QR; a Pay/spending QR
   is rejected. Keep their public code. Collectors do not need a login.
2. Choose **Write or print a card**. The registered collector is already selected. Tap **Write card**,
   hold a blank NTAG213/216 steady, then present that same card for read-back. Existing cards are not
   overwritten. The chip contains public identity references only.
3. Tap **Check a card** and confirm the linked recipient. If the write succeeded but linking failed,
   reconnect and use **Link a written card** for the same selected recipient. Never give out an
   unverified association as a finished card.
4. A supervisor's new collector remains **pending**. An admin/hub lead authorizes them and checks their
   receive-only wallet before weighing. Operators can use their own API dashboard or the optional
   `/collectors` reference console. Card issuance never authorizes payment.
5. Identify the active recipient, select material, enter physical kg, photograph the scale/display/load,
   review, and confirm. Offline shows **Saved and queued**. Reconnect and inspect `/session` for results.
6. The worker checks evidence, recipient, wallet, rate, session and anomalies. Eligible work may pay real
   sats automatically. Exceptions wait for a different reviewer in `/review`; uncertain sends must be
   checked before any retry. The hot wallet is funded externally.

Before handing out a batch, exercise one actual phone/card/scale sample: permission prompts, write/readback,
identity lookup, camera/photo, location, airplane-mode capture and reconnection. Desktop simulation verifies
software behavior; it cannot certify an Android NFC antenna, a chip or field-photo accuracy.
