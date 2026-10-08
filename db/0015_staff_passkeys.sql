-- SPDX-License-Identifier: AGPL-3.0-only
ALTER TABLE supervisors ADD COLUMN password_login_disabled boolean NOT NULL DEFAULT false;
ALTER TABLE supervisors ADD COLUMN bootstrap_password_expires_at timestamptz;
ALTER TABLE supervisors ADD COLUMN auth_epoch integer NOT NULL DEFAULT 0 CHECK (auth_epoch >= 0);
--> statement-breakpoint
CREATE TABLE staff_passkeys (
  credential_id text PRIMARY KEY,
  supervisor_id uuid NOT NULL REFERENCES supervisors(id) ON DELETE CASCADE,
  public_key text NOT NULL,
  counter bigint NOT NULL CHECK (counter >= 0),
  transports jsonb NOT NULL DEFAULT '[]',
  device_type text NOT NULL CHECK (device_type IN ('singleDevice', 'multiDevice')),
  backed_up boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
CREATE INDEX staff_passkeys_supervisor_idx ON staff_passkeys(supervisor_id);
--> statement-breakpoint
CREATE TABLE staff_auth_challenges (
  nonce_hash text PRIMARY KEY CHECK (nonce_hash ~ '^[0-9a-f]{64}$'),
  kind text NOT NULL CHECK (kind IN ('register', 'login', 'ticket')),
  challenge text NOT NULL,
  supervisor_id uuid REFERENCES supervisors(id) ON DELETE CASCADE,
  auth_epoch integer,
  expires_at timestamptz NOT NULL,
  CHECK ((kind = 'login' AND supervisor_id IS NULL AND auth_epoch IS NULL) OR
    (kind IN ('register', 'ticket') AND supervisor_id IS NOT NULL AND auth_epoch IS NOT NULL))
);
CREATE INDEX staff_auth_challenges_expiry_idx ON staff_auth_challenges(expires_at);
