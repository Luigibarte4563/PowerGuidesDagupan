<?php

require_once __DIR__ . '/../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");

require_once __DIR__ . '/../../config/db_connect.php';
require_once __DIR__ . '/../../auth/jwt_auth.php';
require_once __DIR__ . '/../../auth/rbac.php';

$conn = getConnection();
$conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

try {
    requireRole(requireAuthUser(), ['electric_company', 'admin']);

    $query = $conn->prepare("
        SELECT
            ms.id,
            ms.created_by,
            CONCAT_WS(' ', u.first_name, u.last_name) AS company_name,
            ms.radius,
            ms.maintenance_date,
            ms.start_time,
            ms.end_time,
            ms.description,
            ms.status,
            ms.created_at,
            b.barangay_name,
            ml.latitude,
            ml.longitude
        FROM maintenance_schedules ms
        LEFT JOIN users u ON u.id = ms.created_by
        LEFT JOIN maintenance_locations ml ON ml.maintenance_id = ms.id
        LEFT JOIN barangays b ON b.id = ml.barangay_id
        WHERE ms.status = 'completed'
        ORDER BY ms.id DESC
    ");
    $query->execute();
    $rows = $query->fetchAll(PDO::FETCH_ASSOC);

    $result = [];
    foreach ($rows as $row) {
        $id = $row['id'];
        if (!isset($result[$id])) {
            $result[$id] = [
                "id" => (int)$row['id'],
                "company_name" => $row['company_name'],
                "radius" => (int)$row['radius'],
                "maintenance_date" => $row['maintenance_date'],
                "start_time" => $row['start_time'],
                "end_time" => $row['end_time'],
                "description" => $row['description'],
                "status" => $row['status'],
                "locations" => [],
                "created_at" => $row['created_at']
            ];
        }
        if (!empty($row['barangay_name'])) {
            $result[$id]['locations'][] = [
                "barangay_name" => $row['barangay_name'],
                "lat" => $row['latitude'] !== null ? (float)$row['latitude'] : null,
                "lng" => $row['longitude'] !== null ? (float)$row['longitude'] : null
            ];
        }
    }

    echo json_encode([
        "success" => true,
        "message" => "Completed maintenance fetched successfully",
        "count" => count($result),
        "data" => array_values($result)
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
