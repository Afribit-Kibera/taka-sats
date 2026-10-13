# Install and run the supervisor app

Open **https://taka.afribit.africa/install** in Chrome on an Android phone. NFC is optional. Avoid in-app
browsers. Tap **Install app** if offered, or Chrome's menu → **Install app / Add to Home screen**.
Open the home-screen icon and sign in once with your private staff code/setup phrase. The installed app starts
at `/weigh` (Collections). Required phone enrollment appears automatically. Installation acceptance
and actually running the installed app are separate statuses.

Enable an Android screen lock (PIN, fingerprint or face unlock), then tap **Set up phone security** and
approve Chrome's native passkey prompt. Operator-issued setup phrases expire after seven days and grant
phone setup only. Successful enrollment disables the phrase and replaces the password session. On later
visits choose **Sign in with phone security**; the phone selects your account without typing a staff code.
Use this same installation domain each time. Passkeys may sync through the phone's password manager.
The app never receives your phone PIN or biometrics. An existing session remains signed in for up to
30 days, including offline work; phone verification is requested at sign-in, rather than every collection.
For a lost phone or unavailable passkey, the administrator revokes its access and issues a new phrase
using the operator-only procedure in [phone access](PHONE_ACCESS.md). Reconnect before signing in.

Camera and location request native permission on the first signed-in field load. Allow the prompts;
enable Android Location too. These checks save no evidence and close the camera immediately. They never
block the collection list. Use the settings icon to retry. NFC asks only when you tap its action.
No microphone, notification or Bluetooth permission is required.
If denied, allow access in Android's Chrome app permissions and Chrome's site settings, then retry.
Without NFC, choose the collector by name, group or public code. Printed QR lookup is another option.
If you plan to use cards, check the phone and one real blank card before distributing them.

Open **Collections** online; session, rates and approved collectors download automatically. A supervisor needs
an active assigned session and published material rates. Downloaded data supports offline weighing;
registration, wallet verification and card linking require internet. Keep the app open when reconnecting
to upload photos and sync events. Do not clear browser data with queued work. Private API responses are
never an offline cache; pending evidence lives in IndexedDB.

1. Tap **Add collector**, enter their name and Lightning address (or tap the QR icon to scan their
   **Receive** QR), then **Save collector**. Group options are below the wallet. To add a wallet later,
   tap the wallet icon in the waiting list. Pay/spending codes are rejected. Collectors need no login.
2. Optionally tap the **NFC icon** beside a collector or **Write or print a card** after registration.
   The collector is already selected. Tap **Write card**,
   hold a blank NTAG213/216 steady, then present that same card for read-back. Existing cards are not
   overwritten. The chip contains public identity references only.
3. Tap **Check a card** and confirm the linked recipient. If the write succeeded but linking failed,
   reconnect and use **Link a written card** for the same selected recipient. Never give out an
   unverified association as a finished card.
4. A supervisor's new collector remains **pending**. An admin/hub lead authorizes them and checks their
   receive-only wallet before weighing. Operators can use their own API dashboard or the optional
   `/collectors` reference console. Card issuance never authorizes payment.
5. Tap a collector in **Collections**. Material, weight, scale photo, location and estimated payment are
   on one form. Check the details and **Confirm collection**. NFC is unnecessary. Offline shows **Saved
   and queued**. Reconnect and inspect **Activity** (`/session`) for results.
   The green **Record** action at the bottom opens manual selection from any field screen. NFC starts
   only when an NFC icon is pressed; pressing **Record** cancels scanning. Cardless work can complete
   through the same checks and payment worker. Unsupported/oversized photos are refused before saving.
6. The worker checks evidence, recipient, wallet, rate, session and anomalies. Eligible work may pay real
   sats automatically. Exceptions wait for a different reviewer in `/review`; uncertain sends must be
   checked before any retry. The hot wallet is funded externally.

Before handing out a batch, exercise one actual phone/card/scale sample: permission prompts, write/readback,
identity lookup, camera/photo, location, airplane-mode capture and reconnection. Desktop simulation verifies
software behavior; it cannot certify an Android NFC antenna, a chip or field-photo accuracy.
