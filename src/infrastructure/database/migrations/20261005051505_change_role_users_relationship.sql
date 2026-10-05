-- +goose Up
DROP INDEX idx_user_roles_user_id;
DROP TABLE user_roles;

ALTER TABLE users 
    ADD COLUMN role_id UUID NOT NULL DEFAULT '22222222-2222-2222-2222-222222222222' 
    REFERENCES roles(id) ON DELETE RESTRICT;

-- +goose Down
ALTER TABLE users DROP COLUMN IF EXISTS role_id;

CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

CREATE INDEX idx_user_roles_user_id ON user_roles (user_id);
