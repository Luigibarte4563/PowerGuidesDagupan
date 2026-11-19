<?php

/**
 * Append one staff action to the shared activity log. Callers invoke this only
 * after their own write succeeds, so a denied or failed action leaves no trace.
 * No foreign key on actor_id: an audit row must survive a deleted account.
 */
function recordActivity(
    PDO $conn,
    int $actorId,
    string $targetType,
    int $targetId,
    string $action,
    ?string $targetLabel = null,
    ?string $detail = null,
    ?string $previousStatus = null,
    ?string $status = null
): void {
    $stmt = $conn->prepare("
        INSERT INTO activity_log
            (target_type, target_id, target_label, actor_id, action, detail, previous_status, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        $targetType,
        $targetId,
        $targetLabel,
        $actorId,
        $action,
        $detail,
        $previousStatus,
        $status,
    ]);
}
