-- SPDX-License-Identifier: AGPL-3.0-only
-- Roll back only before recording new decisions: export evidence/reviews first.
ALTER TABLE payouts DROP CONSTRAINT payouts_review_decision_check;
ALTER TABLE payouts DROP COLUMN review_risk_hash, DROP COLUMN review_reason, DROP COLUMN reviewed_at, DROP COLUMN reviewed_by, DROP COLUMN review_decision;
ALTER TABLE collection_events DROP CONSTRAINT collection_events_evidence_status_check;
ALTER TABLE collection_events DROP CONSTRAINT collection_events_ocr_weight_check;
ALTER TABLE collection_events DROP COLUMN evidence_status, DROP COLUMN ocr_weight_kg;
ALTER TABLE collectors DROP CONSTRAINT collectors_recipient_type_check;
ALTER TABLE collectors DROP COLUMN recipient_type;
