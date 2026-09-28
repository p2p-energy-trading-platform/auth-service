-- +goose Up
CREATE TABLE credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER set_credentials_updated_at
BEFORE UPDATE ON credentials
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- +goose Down
DROP TABLE IF EXISTS credentials;
