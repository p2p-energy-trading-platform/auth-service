-- +goose Up
CREATE TABLE kyc_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    full_legal_name VARCHAR(255) NOT NULL,
    national_id VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL,
    document_path TEXT NOT NULL,
    status kyc_status NOT NULL DEFAULT 'PENDING',
    rejection_reason TEXT NULL,
    verified_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER set_kyc_submissions_updated_at
BEFORE UPDATE ON kyc_submissions
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE INDEX idx_kyc_user_id ON kyc_submissions (user_id);

-- +goose Down
DROP INDEX IF EXISTS idx_kyc_user_id;
DROP TABLE IF EXISTS kyc_submissions;
