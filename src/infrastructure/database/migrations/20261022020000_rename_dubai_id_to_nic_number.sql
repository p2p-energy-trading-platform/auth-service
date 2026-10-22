-- +goose Up
ALTER TABLE kyc_submissions
RENAME COLUMN dubai_id TO nic_number;

-- +goose Down
ALTER TABLE kyc_submissions
RENAME COLUMN nic_number TO dubai_id;
