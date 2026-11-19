<?php

header("Content-Type: application/json; charset=UTF-8");

error_reporting(E_ALL);
ini_set('display_errors', 0);

require_once __DIR__ . '/../../config/db_connect.php';
require_once __DIR__ . '/../../auth/jwt_auth.php';
require_once __DIR__ . '/../../auth/lineman_access.php';

$conn = getConnection();

/* =========================================
   JWT AUTH (OPTIONAL - kept for security consistency)
========================================= */
$user = getUserFromJWT();

if (!$user || !isset($user['id'])) {
    http_response_code(401);
    echo json_encode([
        "success" => false,
        "message" => "Unauthorized (invalid JWT)"
    ]);
    exit;
}

try {

    $sql = "
        SELECT COUNT(*) AS total_available
        FROM power_stations ps
        WHERE ps.availability_status = 'available'
    ";
    $params = [];
    $sql .= lineman_scope_sql($conn, $user, 'ps.barangay_id', $params);

    $stmt = $conn->prepare($sql);
    $stmt->execute($params);

    $result = $stmt->fetch(PDO::FETCH_ASSOC);

    echo json_encode([
        "success" => true,
        "total_available" => (int)($result['total_available'] ?? 0)
    ]);

} catch (PDOException $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "message" => "Database error"
    ]);
}