<?php

header("Content-Type: application/json; charset=UTF-8");

require_once __DIR__ . '/../../config/db_connect.php';
require_once __DIR__ . '/../../auth/jwt_auth.php';
require_once __DIR__ . '/../../auth/rbac.php';
require_once __DIR__ . '/../services/create_notification.php';
require_once __DIR__ . '/../services/audit.php';

$conn = getConnection();
$conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

/* Staff-only: company review changes any resident's flood report. */
$user = requireRole(requireAuthUser(), ['electric_company', 'admin', 'lineman']);
$user_id = (int)$user['id'];

$data = json_decode(file_get_contents("php://input"), true);
if (!is_array($data)) {
    $data = $_POST;
}

$flood_id = (int)($data["flood_id"] ?? 0);
$status   = trim($data["status"] ?? "");
$assignedTo = (int)($data["updated_by"] ?? 0);

/* flood_reports.status enum - the same three values the company tabs filter on. */
$validStatuses = ['reported', 'verified', 'cleared'];
if (!in_array($status, $validStatuses, true)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Invalid status"]);
    exit;
}

if ($flood_id <= 0) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "flood_id required"]);
    exit;
}

/* Managers may hand the report to a lineman; the stamp records that lineman
 * instead of the manager who clicked the button. */
$updatedBy = $user_id;
if ($assignedTo > 0) {
    $role = $user['role'] ?? '';
    if (!in_array($role, ['electric_company', 'admin'], true)) {
        http_response_code(403);
        echo json_encode(["success" => false, "message" => "Only managers can assign a lineman"]);
        exit;
    }
    $linemanStmt = $conn->prepare("SELECT id FROM users WHERE id = ? AND role = 'lineman' LIMIT 1");
    $linemanStmt->execute([$assignedTo]);
    if (!$linemanStmt->fetch()) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "updated_by must be a lineman"]);
        exit;
    }
    $updatedBy = $assignedTo;
}

try {
    $stmt = $conn->prepare("SELECT reported_by, status, location_name FROM flood_reports WHERE id = ? LIMIT 1");
    $stmt->execute([$flood_id]);
    $flood = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$flood) {
        http_response_code(404);
        echo json_encode(["success" => false, "message" => "Flood report not found"]);
        exit;
    }

    /* No resolved_at column on flood_reports - only status and the audit stamps. */
    $stmt = $conn->prepare("
        UPDATE flood_reports
        SET status = :status, updated_by = :updated_by, updated_at = NOW()
        WHERE id = :id
    ");
    $stmt->execute([
        ":status"    => $status,
        ":updated_by" => $updatedBy,
        ":id"        => $flood_id,
    ]);

    recordActivity(
        $conn,
        $user_id,
        'flood',
        $flood_id,
        'status_changed',
        $flood['location_name'] ?? "Flood #{$flood_id}",
        null,
        $flood['status'] ?? null,
        $status
    );

    if ($status === 'verified' || $status === 'cleared') {
        createNotification(
            $conn,
            [(int)$flood['reported_by']],
            "Flood report " . ucfirst($status),
            "Your flood report has been marked as " . $status . ".",
            "flood",
            $flood_id,
            "flood"
        );
    }

    echo json_encode([
        "success" => true,
        "message" => "Flood status updated",
        "status" => $status
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Server error"]);
}
