-- Backfill only facts already stored in the source rows: who created each record and
-- when. Historical updates are not recoverable - no actor was stored for them.

INSERT INTO activity_log (target_type, target_id, target_label, actor_id, action, detail, status, created_at)
SELECT 'maintenance', ms.id,
       (SELECT GROUP_CONCAT(b.barangay_name ORDER BY b.barangay_name SEPARATOR ', ')
        FROM maintenance_locations ml JOIN barangays b ON b.id = ml.barangay_id
        WHERE ml.maintenance_id = ms.id),
       ms.created_by, 'created', ms.description, ms.status, ms.created_at
FROM maintenance_schedules ms
JOIN users actor ON actor.id = ms.created_by
WHERE NOT EXISTS (
    SELECT 1 FROM activity_log a
    WHERE a.target_type = 'maintenance' AND a.target_id = ms.id AND a.action = 'created'
);

INSERT INTO activity_log (target_type, target_id, target_label, actor_id, action, detail, status, created_at)
SELECT 'outage', o.id,
       CONCAT_WS(' · ', o.report_key, b.barangay_name),
       o.user_id, 'created', o.description, o.status, o.created_at
FROM outage_reports o
JOIN users actor ON actor.id = o.user_id
LEFT JOIN barangays b ON b.id = o.barangay_id
WHERE NOT EXISTS (
    SELECT 1 FROM activity_log a
    WHERE a.target_type = 'outage' AND a.target_id = o.id AND a.action = 'created'
);

INSERT INTO activity_log (target_type, target_id, target_label, actor_id, action, detail, status, created_at)
SELECT 'flood', f.id,
       CONCAT_WS(' · ', f.location_name, b.barangay_name),
       f.reported_by, 'created', f.description, f.status, f.reported_at
FROM flood_reports f
JOIN users actor ON actor.id = f.reported_by
LEFT JOIN barangays b ON b.id = f.barangay_id
WHERE NOT EXISTS (
    SELECT 1 FROM activity_log a
    WHERE a.target_type = 'flood' AND a.target_id = f.id AND a.action = 'created'
);

INSERT INTO activity_log (target_type, target_id, target_label, actor_id, action, detail, status, created_at)
SELECT 'hazard', h.id,
       CONCAT_WS(' · ', h.location_name, b.barangay_name),
       h.reported_by, 'created', h.description, h.status, h.reported_at
FROM electrical_hazards h
JOIN users actor ON actor.id = h.reported_by
LEFT JOIN barangays b ON b.id = h.barangay_id
WHERE NOT EXISTS (
    SELECT 1 FROM activity_log a
    WHERE a.target_type = 'hazard' AND a.target_id = h.id AND a.action = 'created'
);

INSERT INTO activity_log (target_type, target_id, target_label, actor_id, action, detail, status, created_at)
SELECT 'assignment', la.id,
       CONCAT_WS(' · ', CONCAT_WS(' ', lineman.first_name, lineman.last_name), b.barangay_name),
       la.assigned_by, 'assigned', NULL, la.status, la.updated_at
FROM lineman_assignments la
JOIN users actor ON actor.id = la.assigned_by
JOIN users lineman ON lineman.id = la.lineman_id
LEFT JOIN barangays b ON b.id = la.barangay_id
WHERE la.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM activity_log a
    WHERE a.target_type = 'assignment' AND a.target_id = la.id AND a.action = 'assigned'
);
