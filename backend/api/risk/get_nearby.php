<?php

header("Content-Type: application/json; charset=UTF-8");

require_once __DIR__ . '/../../config/db_connect.php';
require_once __DIR__ . '/../../auth/jwt_auth.php';
require_once __DIR__ . '/../../auth/rbac.php';
require_once __DIR__ . '/../../auth/lineman_access.php';

$conn = getConnection();
$conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$user = requireAuthUser();

$lat = isset($_GET['lat']) ? (float)$_GET['lat'] : null;
$lng = isset($_GET['lng']) ? (float)$_GET['lng'] : null;
$radius = isset($_GET['radius']) ? (int)$_GET['radius'] : 3000;

if ($lat === null || $lng === null) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "lat and lng are required"]);
    exit;
}

try {
    /* Nearby active floods */
    $floodSql = "
        SELECT
            fr.id,
            'flood' AS category,
            fr.location_name,
            fr.latitude,
            fr.longitude,
            fr.severity AS risk_level,
            fr.description,
            fr.reported_at,
            b.barangay_name,
            (
                6371000 * ACOS(
                    LEAST(1,
                    COS(RADIANS(:lat)) * COS(RADIANS(fr.latitude)) *
                    COS(RADIANS(fr.longitude) - RADIANS(:lng)) +
                    SIN(RADIANS(:lat)) * SIN(RADIANS(fr.latitude))
                    )
                )
            ) AS distance
        FROM flood_reports fr
        LEFT JOIN barangays b ON b.id = fr.barangay_id
        WHERE fr.status NOT IN ('cleared', 'cancelled')
    ";
    $floodParams = [':lat' => $lat, ':lng' => $lng, ':radius' => $radius];
    $floodSql .= lineman_scope_sql($conn, $user, 'fr.barangay_id', $floodParams);
    $floodSql .= " HAVING distance <= :radius ORDER BY distance ASC";

    $fh = $conn->prepare($floodSql);
    $fh->execute($floodParams);
    $floods = $fh->fetchAll(PDO::FETCH_ASSOC);

    /* Nearby unresolved electrical hazards */
    $hazardSql = "
        SELECT
            eh.id,
            'hazard' AS category,
            eh.location_name,
            eh.latitude,
            eh.longitude,
            eh.severity AS risk_level,
            eh.description,
            eh.reported_at,
            b.barangay_name,
            (
                6371000 * ACOS(
                    LEAST(1,
                    COS(RADIANS(:lat)) * COS(RADIANS(eh.latitude)) *
                    COS(RADIANS(eh.longitude) - RADIANS(:lng)) +
                    SIN(RADIANS(:lat)) * SIN(RADIANS(eh.latitude))
                    )
                )
            ) AS distance
        FROM electrical_hazards eh
        LEFT JOIN barangays b ON b.id = eh.barangay_id
        WHERE eh.status != 'resolved'
    ";
    $hazardParams = [':lat' => $lat, ':lng' => $lng, ':radius' => $radius];
    $hazardSql .= lineman_scope_sql($conn, $user, 'eh.barangay_id', $hazardParams);
    $hazardSql .= " HAVING distance <= :radius ORDER BY distance ASC";

    $hh = $conn->prepare($hazardSql);
    $hh->execute($hazardParams);
    $hazards = $hh->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        "success" => true,
        "radius" => $radius,
        "counts" => [
            "floods" => count($floods),
            "hazards" => count($hazards)
        ],
        "data" => [
            "floods" => $floods,
            "hazards" => $hazards
        ]
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Server error"]);
}
