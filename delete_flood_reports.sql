-- Find the user ID for luigibarts37@gmail.com
SELECT id, email FROM users WHERE email = 'luigibarts37@gmail.com';

-- Show flood reports for this user (before deletion)
SELECT fr.id, fr.location_name, fr.barangay_id, fr.severity, fr.status, fr.reported_at
FROM flood_reports fr
JOIN users u ON fr.reported_by = u.id
WHERE u.email = 'luigibarts37@gmail.com';

-- Delete flood reports for this user
DELETE fr FROM flood_reports fr
JOIN users u ON fr.reported_by = u.id
WHERE u.email = 'luigibarts37@gmail.com';

-- Verify deletion
SELECT fr.id, fr.location_name, u.email
FROM flood_reports fr
JOIN users u ON fr.reported_by = u.id
WHERE u.email = 'luigibarts37@gmail.com';