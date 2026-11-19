-- Show all flood reports with user emails
SELECT fr.id, fr.location_name, fr.severity, fr.status, u.email
FROM flood_reports fr
JOIN users u ON fr.reported_by = u.id
ORDER BY fr.id;