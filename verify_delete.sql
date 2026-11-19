-- Verify if flood reports were deleted for luigibarts37@gmail.com
SELECT fr.id, fr.location_name, u.email
FROM flood_reports fr
JOIN users u ON fr.reported_by = u.id
WHERE u.email = 'luigibarts37@gmail.com';