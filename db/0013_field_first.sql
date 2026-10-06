-- SPDX-License-Identifier: AGPL-3.0-only
-- Additive only: identity, frozen signed payloads and historical ledger entries remain unchanged.
ALTER TABLE collectors ADD COLUMN recipient_type text NOT NULL DEFAULT 'individual';
ALTER TABLE collectors ADD CONSTRAINT collectors_recipient_type_check CHECK (recipient_type IN ('individual', 'collective'));
--> statement-breakpoint
ALTER TABLE collection_events ADD COLUMN ocr_weight_kg numeric(6,3);
ALTER TABLE collection_events ADD COLUMN evidence_status text NOT NULL DEFAULT 'manual';
ALTER TABLE collection_events ADD CONSTRAINT collection_events_ocr_weight_check CHECK (ocr_weight_kg IS NULL OR ocr_weight_kg > 0);
ALTER TABLE collection_events ADD CONSTRAINT collection_events_evidence_status_check CHECK (evidence_status IN ('pending', 'manual', 'matched', 'mismatch', 'unreadable', 'invalid'));
--> statement-breakpoint
ALTER TABLE payouts ADD COLUMN review_decision text;
ALTER TABLE payouts ADD COLUMN reviewed_by uuid REFERENCES supervisors(id);
ALTER TABLE payouts ADD COLUMN reviewed_at timestamptz;
ALTER TABLE payouts ADD COLUMN review_reason text;
ALTER TABLE payouts ADD COLUMN review_risk_hash text;
ALTER TABLE payouts ADD CONSTRAINT payouts_review_decision_check CHECK (review_decision IS NULL OR review_decision IN ('approved', 'rejected', 'reweigh'));
