<?php

header("Content-Type: application/json");

require_once __DIR__ . '/../../config/db_connect.php';
require_once __DIR__ . '/../../config/env.php';
require_once __DIR__ . '/../services/lookup.php';
require_once __DIR__ . '/../services/audit.php';
require_once __DIR__ . '/../../auth/jwt_auth.php';

$conn = getConnection();
$conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

/* =========================================
   JWT AUTH
========================================= */
$user = getUserFromJWT();
if (!$user) {
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Unauthorized"]);
    exit;
}
$user_id = $user['id'];

/* =========================================
   INPUT PARSING
========================================= */
$data = json_decode(file_get_contents("php://input"), true);
if (!is_array($data)) {
    $data = $_POST;
}

$location_name = trim($data["location_name"] ?? "");
$description   = trim($data["description"] ?? "");

if ($location_name === "" || $description === "") {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "location_name and description are required"]);
    exit;
}

/* =========================================
   ANTI-SPAM CHECK
========================================= */
try {
    $check = $conn->prepare("
        SELECT id FROM outage_reports
        WHERE user_id = ?
          AND status IN ('active','under_review','verified')
        LIMIT 1
    ");
    $check->execute([$user_id]);
    if ($check->fetch()) {
        http_response_code(403);
        echo json_encode(["success" => false, "message" => "You already have an active report"]);
        exit;
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Anti-spam check failed"]);
    exit;
}

/* =========================================
   BARANGAY -> COORDINATES
   The barangay is the coordinate authority; `location_name` is only the label
   shown to other users. An explicit pin dropped on the form's map refines the
   point but never replaces the barangay.
   ========================================= */
$barangay_name = trim($data["barangay_name"] ?? "");

if ($barangay_name === "") {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "barangay_name is required",
        "field" => "barangayName"
    ]);
    exit;
}

$barangay = resolveBarangayCoords($conn, $barangay_name);

if (!$barangay) {
    // Tell apart "that barangay does not exist" from "it exists but nobody has
    // entered its coordinates yet" - the second is a server-side data gap and
    // must not read as the user's mistake.
    $existsStmt = $conn->prepare("SELECT id FROM barangays WHERE barangay_name = ? LIMIT 1");
    $existsStmt->execute([$barangay_name]);
    $exists = (bool)$existsStmt->fetchColumn();

    http_response_code($exists ? 503 : 400);
    echo json_encode([
        "success" => false,
        "message" => $exists
            ? "We do not have map coordinates for $barangay_name yet, so this report cannot be placed on the map. Please choose a nearby barangay."
            : "Unknown barangay: $barangay_name",
        "field" => "barangayName",
        "barangays_without_coordinates" => barangaysMissingCoordinates($conn)
    ]);
    exit;
}

$barangay_id = $barangay["id"];

// The barangay centroid is the default point; an explicit pin refines it.
$latitude  = $barangay["latitude"];
$longitude = $barangay["longitude"];

if (
    isset($data["latitude"], $data["longitude"])
    && is_numeric($data["latitude"]) && is_numeric($data["longitude"])
) {
    $pinLat = (float)$data["latitude"];
    $pinLng = (float)$data["longitude"];

    // A pin is user input, so reject nonsense before it is stored (is_finite
    // also catches "1e999" overflowing to INF).
    if (!is_finite($pinLat) || !is_finite($pinLng)
        || $pinLat < -90 || $pinLat > 90
        || $pinLng < -180 || $pinLng > 180) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Invalid coordinates"]);
        exit;
    }

    $latitude  = $pinLat;
    $longitude = $pinLng;
}

/* =========================================
   LOOKUP FIELDS (strings -> ENUM values)
========================================= */
$category   = getCategory($data["category"] ?? null);
$severity   = getSeverity($conn, $data["severity"] ?? null);
$hazardType = getHazardType($data["hazard_type"] ?? null);

if (!$category || !$severity || !$hazardType) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Invalid lookup value"]);
    exit;
}

$started_at      = $data["started_at"] ?? null;
$image_url       = $data["image_url"] ?? null;

/* =========================================
   INSERT REPORT
========================================= */
try {
    $stmt = $conn->prepare("
        INSERT INTO outage_reports (
            user_id,
            barangay_id,
            category,
            severity,
            hazard_type,
            status,
            report_key,
            location_name,
            latitude,
            longitude,
            description,
            image_proof,
            started_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");

    $status = getStatus($conn, 'active');
    $reportKey = uniqid("OR-");

    $stmt->execute([
        $user_id,
        $barangay_id,
        $category,
        $severity,
        $hazardType,
        $status,
        $reportKey,
        $location_name,
        $latitude,
        $longitude,
        $description,
        $image_url,
        $started_at
    ]);

    $outage_report_id = (int)$conn->lastInsertId();

    recordActivity(
        $conn,
        (int)$user_id,
        'outage',
        $outage_report_id,
        'created',
        trim($reportKey . ' · ' . $barangay['name']),
        $description !== '' ? $description : null,
        null,
        $status
    );

    /* Notify the electric company that a resident filed a new outage report.
       Server-side only: the notification endpoint is manager-gated, so we insert
       directly here rather than asking the resident (who would get 403). A failure
       to notify must never roll back the report itself. */
    try {
        $recipients = $conn->prepare("
            SELECT id FROM users
            WHERE role IN ('electric_company', 'admin')
        ");
        $recipients->execute();
        $recipientIds = $recipients->fetchAll(PDO::FETCH_COLUMN);

        if ($recipientIds) {
            $notify = $conn->prepare("
                INSERT INTO notifications (user_id, notification_type, title, message)
                VALUES (:user_id, 'outage', :title, :message)
            ");
            $title = "New outage report";
            $message = "A new outage report was submitted in " .
                htmlspecialchars($barangay["name"], ENT_QUOTES) .
                ". Review it on the company dashboard.";
            foreach ($recipientIds as $recipientId) {
                $notify->execute([
                    ":user_id" => (int)$recipientId,
                    ":title" => $title,
                    ":message" => $message,
                ]);
            }
        }
    } catch (Throwable $e) {
        error_log("Outage report notification failed: " . $e->getMessage());
    }

    echo json_encode([
        "success" => true,
        "message" => "Report created",
        "report_id" => $outage_report_id,
        "barangay" => $barangay["name"]
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Database insert failed"]);
}
