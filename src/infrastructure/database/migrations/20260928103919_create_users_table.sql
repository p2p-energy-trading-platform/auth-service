-- +goose Up
CREATE TYPE user_status AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'DISABLED');
CREATE TYPE kyc_status AS ENUM ('NOT_REQUIRED', 'PENDING', 'VERIFIED', 'REJECTED');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    status user_status NOT NULL DEFAULT 'PENDING',
    kyc_status kyc_status NOT NULL DEFAULT 'NOT_REQUIRED',
    email_verified_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER set_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE UNIQUE INDEX idx_users_email_lower ON users (LOWER(email));

-- +goose Down
DROP INDEX IF EXISTS idx_users_email_lower;
DROP TABLE IF EXISTS users;
DROP TYPE IF EXISTS kyc_status;
DROP TYPE IF EXISTS user_status;
