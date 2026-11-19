<?php

header("Content-Type: application/json; charset=UTF-8");

require_once __DIR__ . '/../../config/db_connect.php';
require_once __DIR__ . '/../../auth/jwt_auth.php';
require_once __DIR__ . '/../../auth/rbac.php';

$conn = getConnection();
$conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$user = requireAuthUser();

$hazardId = (int)($_POST['hazard_id'] ?? 0);
if ($hazardId <= 0) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "hazard_id is required"]);
    exit;
}

/* Check ownership before moving the file, so a rejected upload leaves no orphan on disk. */
$role = $user['role'] ?? '';
$isStaff = in_array($role, ['lineman', 'electric_company', 'admin'], true);

$ownsStmt = $conn->prepare("SELECT id FROM electrical_hazards WHERE id = ? AND reported_by = ? LIMIT 1");
$ownsStmt->execute([$hazardId, $user['id']]);
if (!$ownsStmt->fetch() && !$isStaff) {
    http_response_code(403);
    echo json_encode(["success" => false, "message" => "Forbidden"]);
    exit;
}

if (empty($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "No valid image uploaded"]);
    exit;
}

$allowedExt = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
$allowedMime = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
$maxBytes = 5 * 1024 * 1024; // 5MB

$file = $_FILES['image'];

if ($file['size'] > $maxBytes) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Image too large (max 5MB)"]);
    exit;
}

$ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
if (!in_array($ext, $allowedExt, true)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Invalid file type"]);
    exit;
}

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = (string)$finfo->file($file['tmp_name']);
if (!in_array($mime, $allowedMime, true)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Invalid image content"]);
    exit;
}

$uploadDir = __DIR__ . '/../../uploads/hazard/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0775, true);
}

$filename = 'eh_' . $hazardId . '_' . uniqid() . '.' . $ext;
$destination = $uploadDir . $filename;

if (!move_uploaded_file($file['tmp_name'], $destination)) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Failed to store image"]);
    exit;
}

$imageUrl = 'uploads/hazard/' . $filename;

try {
    $update = $conn->prepare("UPDATE electrical_hazards SET image_proof = ? WHERE id = ?");
    $update->execute([$imageUrl, $hazardId]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Failed to attach image"]);
    exit;
}

echo json_encode([
    "success" => true,
    "message" => "Image uploaded",
    "image_url" => $imageUrl
]);
