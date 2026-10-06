-- SPDX-License-Identifier: AGPL-3.0-only
CREATE TABLE api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES supervisors(id),
  name text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  token_prefix text NOT NULL,
  scopes jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES supervisors(id),
  CONSTRAINT api_keys_expiry_check CHECK (expires_at > created_at),
  CONSTRAINT api_keys_hash_check CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT api_keys_scopes_check CHECK (jsonb_typeof(scopes) = 'array' AND jsonb_array_length(scopes) > 0),
  CONSTRAINT api_keys_revocation_check CHECK ((revoked_at IS NULL) = (revoked_by IS NULL))
);
--> statement-breakpoint
CREATE INDEX api_keys_owner_idx ON api_keys(owner_id);
--> statement-breakpoint
CREATE INDEX api_keys_created_idx ON api_keys(created_at, id);
