<?php

header("Content-Type: application/json; charset=UTF-8");

require_once __DIR__ . '/../../config/db_connect.php';
require_once __DIR__ . '/../../auth/jwt_auth.php';
require_once __DIR__ . '/../../auth/rbac.php';
require_once __DIR__ . '/../services/lookup.php';
require_once __DIR__ . '/../../auth/lineman_access.php';
require_once __DIR__ . '/../services/audit.php';

$conn = getConnection();
$conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$user = requireRole(requireAuthUser(), ['electric_company', 'admin', 'lineman']);

$data = json_decode(file_get_contents("php://input"), true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Invalid JSON input"]);
    exit;
}

$id     = (int)($data["id"] ?? 0);
$status = trim($data["status"] ?? "");
$assignedTo = (int)($data["updated_by"] ?? 0);

if ($id <= 0 || $status === "") {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "id and status required"]);
    exit;
}

$valid = ['active', 'under_review', 'verified', 'resolved', 'rejected'];
if (!in_array($status, $valid, true)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Invalid status"]);
    exit;
}

/* Managers may hand the report to a lineman; the stamp records that lineman
 * instead of the manager who clicked the button. */
$updatedBy = (int)$user['id'];
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
    /* A lineman may only set the status of a report in an assigned barangay. The check
       runs before the UPDATE, so a denied request changes nothing. */
    require_outage_access($conn, $user, $id);

    $auditStmt = $conn->prepare("SELECT report_key, status FROM outage_reports WHERE id = ? LIMIT 1");
    $auditStmt->execute([$id]);
    $auditRow = $auditStmt->fetch(PDO::FETCH_ASSOC) ?: [];

    $sql = "UPDATE outage_reports SET status = :status, updated_by = :updated_by, updated_at = NOW()";
    $params = [":status" => $status, ":updated_by" => $updatedBy, ":id" => $id];

    if ($status === "resolved") {
        $sql .= ", resolved_at = NOW()";
    }

    $sql .= " WHERE id = :id";
    $conn->prepare($sql)->execute($params);

    recordActivity(
        $conn,
        (int)$user['id'],
        'outage',
        $id,
        'updated',
        $auditRow['report_key'] ?? "Report #{$id}",
        null,
        $auditRow['status'] ?? null,
        $status
    );

    echo json_encode(["success" => true, "message" => "Updated successfully"]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Server error"]);
}
