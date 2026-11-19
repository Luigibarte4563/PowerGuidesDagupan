-- Merge outage_report_images into outage_reports.
-- Outages now use a single `image_proof` column, like floods and hazards.
-- Only the first photo of each report survives; orphan files in uploads/outage/
-- are harmless and can be cleaned up separately.

ALTER TABLE outage_reports
    ADD COLUMN image_proof TEXT NULL AFTER description;

UPDATE outage_reports
SET image_proof = (
    SELECT img.image_url
    FROM outage_report_images img
    WHERE img.outage_report_id = outage_reports.id
    ORDER BY img.id
    LIMIT 1
);

DROP TABLE outage_report_images;
