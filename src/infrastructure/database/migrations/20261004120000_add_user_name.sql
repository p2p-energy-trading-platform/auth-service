-- +goose Up
ALTER TABLE users
ADD COLUMN name VARCHAR(100);

-- +goose Down
ALTER TABLE users
DROP COLUMN name;
