-- Migration 012: remove the optional middle_name attribute from users.
-- Existing middle-name values are intentionally discarded; user names are
-- composed from first_name and last_name only.

ALTER TABLE users DROP COLUMN middle_name;
