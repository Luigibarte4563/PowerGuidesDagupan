-- Labels only: assignments still grant access to every job in a barangay.
ALTER TABLE lineman_assignments
    ADD COLUMN job_type VARCHAR(24) NOT NULL DEFAULT 'all' AFTER barangay_id;
