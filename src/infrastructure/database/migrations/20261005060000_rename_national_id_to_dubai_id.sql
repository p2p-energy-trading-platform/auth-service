-- +goose Up
ALTER TABLE kyc_submissions
RENAME COLUMN national_id TO dubai_id;

-- +goose StatementBegin
CREATE OR REPLACE FUNCTION validate_kyc_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.kyc_status = NEW.kyc_status THEN
        RETURN NEW;
    END IF;

    IF NOT (
        (OLD.kyc_status = 'NOT_REQUIRED' AND NEW.kyc_status = 'PENDING')
        OR (OLD.kyc_status = 'PENDING' AND NEW.kyc_status IN ('VERIFIED', 'REJECTED'))
        OR (OLD.kyc_status = 'REJECTED' AND NEW.kyc_status = 'PENDING')
    ) THEN
        RAISE EXCEPTION 'Invalid onboarding state transition: % -> %',
            OLD.kyc_status, NEW.kyc_status
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd

CREATE TRIGGER validate_users_kyc_status_transition
BEFORE UPDATE OF kyc_status ON users
FOR EACH ROW EXECUTE FUNCTION validate_kyc_status_transition();

-- +goose Down
DROP TRIGGER IF EXISTS validate_users_kyc_status_transition ON users;
DROP FUNCTION IF EXISTS validate_kyc_status_transition();
ALTER TABLE kyc_submissions
RENAME COLUMN dubai_id TO national_id;
