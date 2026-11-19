-- Flood reports use 'cancelled' as the user-deleted state, the same way outage
-- reports use 'rejected'. Existing rows whose delete was truncated into an empty
-- status by MySQL are converted to the real value.

ALTER TABLE flood_reports
    MODIFY status ENUM('reported', 'verified', 'cleared', 'cancelled') DEFAULT 'reported';

UPDATE flood_reports SET status = 'cancelled' WHERE status = '' OR status IS NULL;
