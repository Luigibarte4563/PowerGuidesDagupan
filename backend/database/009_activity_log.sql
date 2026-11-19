-- One append-only log for staff actions across maintenance, outages, floods and
-- hazards. The per-table created_by/updated_by columns only hold the latest actor;
-- this keeps every action and the account that performed it.
-- No FK on actor_id: an audit row must survive a deleted account.

CREATE TABLE activity_log (
    id INT AUTO_INCREMENT PRIMARY KEY,

    target_type ENUM('maintenance','outage','flood','hazard','assignment') NOT NULL,
    target_id INT NOT NULL,
    target_label VARCHAR(255) NULL,

    actor_id INT NOT NULL,
    action ENUM('created','updated','status_changed','verified','assigned','unassigned') NOT NULL,
    detail TEXT NULL,
    previous_status VARCHAR(50) NULL,
    status VARCHAR(50) NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_activity_actor (actor_id, created_at),
    INDEX idx_activity_target (target_type, target_id)
);
