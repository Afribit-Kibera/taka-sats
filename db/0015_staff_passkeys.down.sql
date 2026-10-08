-- SPDX-License-Identifier: AGPL-3.0-only
-- Rollback restores the retained password hashes. Invalidate Auth.js sessions at deployment
-- rollback if enrolled/recovered phones must remain revoked; schema rollback drops epochs.
DROP TABLE staff_auth_challenges;
DROP TABLE staff_passkeys;
ALTER TABLE supervisors DROP COLUMN auth_epoch;
ALTER TABLE supervisors DROP COLUMN bootstrap_password_expires_at;
ALTER TABLE supervisors DROP COLUMN password_login_disabled;
