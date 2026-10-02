-- +goose Up
ALTER TABLE users
  ADD COLUMN onboarding_state TEXT NOT NULL DEFAULT 'registered'
  CHECK (onboarding_state IN ('registered', 'pending_verification', 'verified', 'rejected'));

-- +goose Down
ALTER TABLE users DROP COLUMN onboarding_state;
