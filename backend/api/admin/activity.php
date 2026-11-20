<?php

require_once __DIR__ . '/../../config/cors.php';

header("Content-Type: application/json; charset=UTF-8");

require_once __DIR__ . '/../../config/db_connect.php';
require_once __DIR__ . '/../../auth/jwt_auth.php';
require_once __DIR__ . '/../../auth/rbac.php';

$conn = getConnection();
$conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

requireRole(requireAuthUser(), ['admin']);

/** Every filter is bound the same way before the single count/page pair runs. */
function activityRows(PDO $conn, string $sql, array $params): array
{
    $stmt = $conn->prepare($sql);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value, is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
    }
    $stmt->execute();
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function activityText(?string $value): string
{
    return ucfirst(str_replace('_', ' ', (string)$value));
}

function activityModule(string $target): string
{
    $modules = [
        'maintenance' => 'maintenance schedule',
        'outage'      => 'outage report',
        'flood'       => 'flood report',
        'hazard'      => 'electrical hazard',
        'assignment'  => 'assignment',
    ];
    return $modules[$target] ?? $target;
}

function activityAction(array $row): string
{
    $target = (string)($row['target_type'] ?? '');
    $action = (string)($row['action'] ?? '');
    $status = activityText($row['status'] ?? null);

    if ($action === 'status_changed') {
        return 'Changed ' . activityModule($target) . ' status' . ($status !== '' ? " to {$status}" : '');
    }

    if ($action === 'created') {
        $actions = [
            'maintenance' => 'Created maintenance schedule',
            'outage'      => 'Reported outage',
            'flood'       => 'Reported flood',
            'hazard'      => 'Reported electrical hazard',
            'assignment'  => 'Assigned lineman to barangay',
        ];
        return $actions[$target] ?? 'Created ' . activityModule($target);
    }

    $actions = [
        'updated'    => 'Updated ' . activityModule($target),
        'verified'   => 'Verified outage report',
        'assigned'   => 'Assigned lineman to barangay',
        'unassigned' => 'Deactivated lineman assignment',
    ];
    return $actions[$action] ?? activityText($action);
}

function activityDetail(array $row): string
{
    $detail = trim((string)($row['detail'] ?? ''));
    $previous = activityText($row['previous_status'] ?? null);
    $status = activityText($row['status'] ?? null);

    if (($row['action'] ?? '') === 'status_changed' && $previous !== '') {
        return $previous . ' → ' . $status . ($detail !== '' ? " · {$detail}" : '');
    }
    return $detail;
}

function activityTarget(array $row): string
{
    $label = trim((string)($row['target_label'] ?? ''));
    if ($label !== '') {
        return $label;
    }

    $id = (int)($row['target_id'] ?? 0);
    $prefixes = [
        'maintenance' => 'Schedule',
        'outage'      => 'Report',
        'flood'       => 'Flood',
        'hazard'      => 'Hazard',
        'assignment'  => 'Assignment',
    ];
    $prefix = $prefixes[$row['target_type'] ?? ''] ?? 'Record';
    return "{$prefix} #{$id}";
}

try {
    $role = trim((string)($_GET['role'] ?? ''));
    if (!in_array($role, ['electric_company', 'lineman'], true)) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "role must be electric_company or lineman"]);
        exit;
    }

    $page = max(1, (int)($_GET['page'] ?? 1));
    $pageSize = max(1, min((int)($_GET['page_size'] ?? 25), 100));

    $targetType = trim((string)($_GET['target_type'] ?? ''));
    $validTargets = ['maintenance', 'outage', 'flood', 'hazard', 'assignment'];
    if ($targetType !== '' && !in_array($targetType, $validTargets, true)) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Invalid target_type"]);
        exit;
    }

    $action = trim((string)($_GET['action'] ?? ''));
    $validActions = ['created', 'updated', 'status_changed', 'verified', 'assigned', 'unassigned'];
    if ($action !== '' && !in_array($action, $validActions, true)) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Invalid action"]);
        exit;
    }

    $userIdRaw = trim((string)($_GET['user_id'] ?? ''));
    if ($userIdRaw !== '') {
        $userId = filter_var($userIdRaw, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if ($userId === false) {
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "user_id must be a positive integer"]);
            exit;
        }
    }

    $where = ['actor.role = :role'];
    $params = [':role' => $role];

    if (isset($userId)) {
        $where[] = 'a.actor_id = :actor_id';
        $params[':actor_id'] = $userId;
    }
    if ($targetType !== '') {
        $where[] = 'a.target_type = :target_type';
        $params[':target_type'] = $targetType;
    }
    if ($action !== '') {
        $where[] = 'a.action = :action';
        $params[':action'] = $action;
    }
    $whereSql = implode(' AND ', $where);

    $counts = activityRows($conn, "
        SELECT COUNT(*) AS total
        FROM activity_log a
        JOIN users actor ON actor.id = a.actor_id
        WHERE {$whereSql}
    ", $params);

    $total = (int)($counts[0]['total'] ?? 0);
    $totalPages = max(1, (int)ceil($total / $pageSize));
    $page = min($page, $totalPages);
    $pageParams = $params + [':offset' => ($page - 1) * $pageSize, ':page_size' => $pageSize];

    $rows = activityRows($conn, "
        SELECT
            a.id, a.target_type, a.target_id, a.target_label, a.actor_id,
            a.action, a.detail, a.previous_status, a.status, a.created_at,
            CONCAT_WS(' ', actor.first_name, actor.last_name) AS actor_name
        FROM activity_log a
        JOIN users actor ON actor.id = a.actor_id
        WHERE {$whereSql}
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT :offset, :page_size
    ", $pageParams);

    $activities = [];
    foreach ($rows as $row) {
        $activities[] = [
            "id"           => "al-{$row['id']}",
            "type"         => $row['target_type'],
            "targetType"   => $row['target_type'],
            "actionType"   => $row['action'],
            "action"       => activityAction($row),
            "actor_id"     => (int)$row['actor_id'],
            "actor_name"   => trim((string)$row['actor_name']),
            "target"       => activityTarget($row),
            "detail"       => activityDetail($row),
            "status"       => $row['status'] ?? '',
            "performed_at" => $row['created_at'],
        ];
    }

    echo json_encode([
        "success" => true,
        "role"    => $role,
        "summary" => [
            "total_activities" => $total,
            "page"             => $page,
            "page_size"        => $pageSize,
            "total_pages"      => $totalPages,
        ],
        "count"      => count($activities),
        "activities" => $activities,
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Activity could not be loaded"]);
}
