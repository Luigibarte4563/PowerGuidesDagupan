# PowerGuide Dagupan — API endpoint reference

All paths below are relative to the API root:

```text
http://localhost/PowerGuidesDagupan/backend/api/
```

The Vite dev server proxies `/backend/api/...` to that path. There is no router and no per-file HTTP
verb enforcement: the method column is the **implied** method from each file's input handling.
CORS advertises `GET, POST, PUT, DELETE, OPTIONS` and answers `OPTIONS` with 200.

Responses are JSON. Most include `success`, often `message` and/or `data`; list endpoints vary
between `data`, `notifications`, `activities`, etc. Browser clients authenticate with the HttpOnly
`jwt_token` cookie; the server does not read `Authorization:` headers.

Access legend:

| Legend | Meaning |
| ------ | ------- |
| Any | Any authenticated user |
| Staff | `lineman`, `electric_company`, `admin` |
| Manager | `electric_company`, `admin` |
| Admin | `admin` only |
| Owner | Any authenticated user, but only their own row may be changed |

Lineman scoping comes from `backend/auth/lineman_access.php`: only **active**
`lineman_assignments` rows grant access, and each row covers its whole barangay. `job_type` is a
label only. `electric_company` and `admin` are never scoped.

---

## 1. Auth

| Endpoint | Method | Access | Inputs / behavior |
| --- | --- | --- | --- |
| `auth/register.php` | POST | Public | `first_name`, `middle_name?`, `last_name`, `email`, `password` (min 6). Always creates `user`; any body role is ignored. |
| `auth/login.php` | POST | Public | `email`, `password`. Rejects Google-only accounts. |
| `auth/logout.php` | GET/POST | Public | Expires the `jwt_token` cookie. |
| `auth/me.php` | GET | Any | Re-reads the live user row from the database; returns current role/profile. |
| `auth/google.php` | GET | Public | Redirects the browser to Google's authorization URL. |
| `auth/google_callback.php` | GET | Public | `code` or `error`; verifies the id_token via JWKS, finds/creates a `user`, issues JWT, redirects to `/auth/google-callback?token=...`. |

JWT details: HS256, 24-hour expiry, claims `iat`, `exp`, `id`, `email`, `role`; cookie name
`jwt_token`, HttpOnly, path `/`. Self-registration and first-time Google signup never choose a role.

---

## 2. Admin

| Endpoint | Method | Access | Inputs / behavior |
| --- | --- | --- | --- |
| `admin/users.php` | GET | Admin | Optional `role`, `q` (name/email substring). Directory with name, email, role, provider, dates; no secrets. |
| `admin/create_user.php` | POST | Admin | `first_name`, `middle_name?`, `last_name`, `email`, `password`, `role` (default `user`). Duplicate email → 409. |
| `admin/update_role.php` | POST | Admin | `user_id`, `role`; rejects unknown roles and changing your own role. |
| `admin/stats.php` | GET | Admin | Platform aggregates: user totals/roles, report totals, 30-day trend, top barangays. |
| `admin/activity.php` | GET | Admin | Audit feed. Required `role=electric_company\|lineman`; optional `user_id`, `target_type`, `action`, `page`, `page_size` (max 100). |

`admin/activity.php` accepts only these filter values:

- `target_type`: `maintenance`, `outage`, `flood`, `hazard`, `assignment`
- `action`: `created`, `updated`, `status_changed`, `verified`, `assigned`, `unassigned`

Invalid filter values return 400. Response includes `summary.total_activities`, `page`,
`page_size`, `total_pages`, and an `activities[]` array of newest-first rows with `actor_name`,
human-readable `action`, `target`, `detail`, `status` and `performed_at`.

---

## 3. Reference

| Endpoint | Method | Access | Inputs / behavior |
| --- | --- | --- | --- |
| `reference/get.php` | GET | Any | Roles, barangays, outage categories, severities, hazard types, outage statuses, station types, notification types. |

The raw `barangays` rows are `{ id: <numeric id>, barangay_name, city, province, latitude,
longitude }`. The frontend's `ReferenceContext` normalises them to `{ id: <NAME>, name: <NAME>,
rowId: <numeric id>, raw, ... }`; use `rowId` wherever an integer `barangay_id` is required.

---

## 4. Outages — resident

| Endpoint | Method | Access | Inputs / behavior |
| --- | --- | --- | --- |
| `outage_report/create.php` | POST | Any | `location_name`, `description`, `barangay_name`, `latitude`, `longitude`, `category`, `severity`, `hazard_type`, `started_at`, `image_url?`. Enforces one active report per user. |
| `outage_report/get.php` | GET | Any, lineman scoped | `status?`, `category?`. |
| `outage_report/get_active.php` | GET | Any, lineman scoped | `status?`, `category?`, `severity?`. Returns counts only (`total_active_reports`). |
| `outage_report/get_resolve.php` | GET | Any, lineman scoped | Returns counts only (`total_resolved`). |
| `outage_report/get_my_report.php` | GET | Any | Caller's reports, excluding `rejected`. |
| `outage_report/get_detail.php` | GET | Any | `id`. Residents are owner-scoped; linemen are barangay-scoped; company/admin unrestricted. |
| `outage_report/update.php` | POST/PUT | Owner | `id` plus editable report fields. |
| `outage_report/delete.php` | POST/DELETE | Owner | Soft-cancels own `active`/`under_review` report to `rejected`. |
| `outage_report/upload_image.php` | POST multipart | Owner or Staff | `outage_report_id`, `image`. Valid jpg/jpeg/png/gif/webp, max 5 MB. |

`get_active.php` counts rows with `status != 'rejected'` plus any supplied filters and lineman
scope, not just `status = 'active'`. The canonical schema has no `is_active` column.

---

## 5. Outages — staff

| Endpoint | Method | Access | Inputs / behavior |
| --- | --- | --- | --- |
| `outage/get.php` | GET | Staff, lineman scoped | `status?`, `category?`, `severity?`, `barangay?`. |
| `outage/verify.php` | POST | Staff, per-report scope | `outage_report_id`, `verification_status=confirmed\|not_confirmed\|false_report`, `notes?`, optional `status`. Writes audit. |
| `outage/add_update.php` | POST | Staff, per-report scope | `outage_report_id`, `update_message`, optional `status`. Writes audit. |

---

## 6. Outages — company bulk/status

| Endpoint | Method | Access | Inputs / behavior |
| --- | --- | --- | --- |
| `outage_report_electric_com/get.php` | GET | Staff, lineman scoped | `status?`, `severity?`, `active?`. |
| `outage_report_electric_com/update_single.php` | POST/PUT | Staff, per-report scope | `id`, `status` ∈ `active\|under_review\|verified\|resolved\|rejected`. Writes audit. |
| `outage_report_electric_com/update_barangay.php` | POST/PUT | Staff; lineman must be assigned to the barangay | `barangay` (name), `status` (not validated through `getStatus()`). Writes audit. |
| `outage_report_electric_com/update_dagupan.php` | POST/PUT | Manager only | `status` (not validated through `getStatus()`). City-wide rewrite with no `WHERE`. Linemen are denied outright. Writes audit. |

---

## 7. Lineman assignments

| Endpoint | Method | Access | Inputs / behavior |
| --- | --- | --- | --- |
| `lineman_assignment/get.php` | GET | Manager | `lineman_id?`, `barangay_id?`, `status?`. Returns assignments with `jobs_done`. |
| `lineman_assignment/create.php` | POST | Manager | `lineman_id`, `barangay_id`, `job_type?`; `assigned_by` comes from JWT; reactivates a duplicate pair. Writes audit. |
| `lineman_assignment/update.php` | POST/PUT | Manager | `id`, optional `lineman_id`, `barangay_id`, `status`, `job_type`. Writes audit. |
| `lineman_assignment/delete.php` | POST/DELETE | Manager | `id`. Soft-deactivates; writes audit. |
| `lineman_assignment/my.php` | GET | `lineman` only | No identity parameter; caller comes from JWT. |
| `lineman_assignment/linemen.php` | GET | Manager | Lineman picker. |
| `lineman_assignment/activity.php` | GET/POST | Any; managers any lineman, linemen self only | `lineman_id` (optional for linemen), `limit` (1–200), `work_type=all\|done\|pending`. Returns work history and `summary.total_done`. |

Valid assignment statuses: `active`, `inactive`. Valid `job_type` labels: `all`, `outage`,
`flood`, `hazard`, `maintenance`. None of the job labels narrow access.

---

## 8. Maintenance

| Endpoint | Method | Access | Inputs / behavior |
| --- | --- | --- | --- |
| `maintenance/get.php` | GET | Any, lineman scoped | Company-created schedules with locations; no params. |
| `maintenance/get_upcoming.php` | GET | Any, lineman scoped | Count of `upcoming`/`ongoing` schedules. |
| `maintenance/get_complete.php` | GET | Manager | Completed schedules management list. |
| `maintenance/create.php` | POST | Manager | `maintenance_date`, `start_time`, `end_time`, `description`, `radius`, `barangays[]`; creates locations and notices; writes audit. |
| `maintenance/update.php` | POST/PUT | Staff | Full edit for managers; linemen in a covered barangay may send status-only updates. Writes audit. |
| `maintenance/delete.php` | POST/DELETE | Manager, owner | `maintenance_id`; removes dependent notifications and locations. |

`maintenance_map/get.php` (GET, any, lineman scoped) returns map points with optional `status?` and
`date?` filters.

---

## 9. Power stations

| Endpoint | Method | Access | Inputs / behavior |
| --- | --- | --- | --- |
| `power_station/create.php` | POST | Any | `station_name`, `location_name`, `station_type?`, `access_type?`, `availability_status?`, `opening_time?`, `closing_time?`, `is_24_hours?`, `charging_type?`, `description?`, `barangay_name`, `latitude`, `longitude`. One station per creator. |
| `power_station/get.php` | GET | Any, lineman scoped | `page?`, `limit?` (max 50). |
| `power_station/get_available.php` | GET | Any, lineman scoped | Returns count only (`total_available`). |
| `power_station/get_my_posts.php` | GET | Any | Caller's stations. |
| `power_station/get_near_location.php` | GET | Any, lineman scoped | `radius` only; centre is the caller's saved location. |
| `power_station/update.php` | POST/PUT | Owner | `id` plus editable station fields. |
| `power_station/delete.php` | POST/DELETE | Owner | `station_id` (not `id`). |

---

## 10. Notifications

| Endpoint | Method | Access | Inputs / behavior |
| --- | --- | --- | --- |
| `notification/get.php` | GET | Any | `limit?` (default 50, max 200), `offset?`, `unread?`, `type?`, `maintenance_id?`. Returns `unread_count`. |
| `notification/create.php` | POST | Manager | `notifications[]` or `user_id`, `title`, `message`, `type`. Explicit user ids only. |
| `notification/mark_as_read.php` | POST | Owner | `notification_id`. |
| `notification/mark_all_as_read.php` | POST | Any | Marks all caller's unread rows read. |

---

## 11. Saved location

| Endpoint | Method | Access | Inputs / behavior |
| --- | --- | --- | --- |
| `user_location/get.php` | GET | Any | Caller's barangay, address and point. |
| `user_location/location.php` | POST/PUT | Any | `address` or `location_name`, `barangay_name`; saves the barangay centroid. |

---

## 12. Floods

| Endpoint | Method | Access | Inputs / behavior |
| --- | --- | --- | --- |
| `flood_report/create.php` | POST | Any | `location_name`, `description`, `severity` or `flood_level`, `flood_depth_cm?`, `image_url?`, `barangay_name`, `latitude`, `longitude`. Writes audit. |
| `flood_report/get.php` | GET | Any, lineman scoped | `status?`, `severity?`, `barangay?`. |
| `flood_report/get_nearby.php` | GET | Any, lineman scoped | `lat`, `lng`, `radius` (default 3000 m). |
| `flood_report/update.php` | POST/PUT | Owner | `id` plus editable flood fields. Writes audit. |
| `flood_report/update_status.php` | POST | Staff | `flood_id`, `status=reported\|verified\|cleared`. Writes audit. Does **not** apply lineman barangay scoping. |
| `flood_report/delete.php` | POST/DELETE | Owner | Soft-cancels own report to `cancelled`. |
| `flood_report/upload_image.php` | POST multipart | Owner or Staff | `flood_report_id`, `image`; same validation/cap as outage uploads. |

---

## 13. Electrical hazards

| Endpoint | Method | Access | Inputs / behavior |
| --- | --- | --- | --- |
| `electrical_hazard/create.php` | POST | Any | `location_name`, `description`, `hazard_type`, `severity`, `image_url?`/`image_proof?`, `barangay_name`, `latitude`, `longitude`. Writes audit. |
| `electrical_hazard/get.php` | GET | Any, lineman scoped | `status?`, `severity?`, `barangay?`. |
| `electrical_hazard/update.php` | POST/PUT | Owner | `id` plus editable hazard fields. Writes audit. |
| `electrical_hazard/update_status.php` | POST | Any; owner for residents, any hazard for staff | `hazard_id`, `status=reported\|verified\|resolved`. Actor comes from JWT. Writes audit. Does **not** apply lineman barangay scoping. |
| `electrical_hazard/upload_image.php` | POST multipart | Owner or Staff | `hazard_id`, `image`; same validation/cap as outage uploads. |

---

## 14. Risk, heatmap and clusters

| Endpoint | Method | Access | Inputs / behavior |
| --- | --- | --- | --- |
| `risk/get_nearby.php` | GET | Any, lineman scoped | `lat`, `lng`, `radius` (default 3000 m). Combined active floods and unresolved hazards. |
| `heatmap/get.php` | GET | Any, lineman scoped | `mode=by_barangay\|clusters`, `radius` (default 1000 m), `days` (default 7). Active outages only. |
| `cluster/get.php` | GET | Any, lineman scoped | `status?`, `barangay?`, `from_date?`. Stored outage clusters. |
| `cluster/store.php` | POST | Staff | `barangay_id`, `latitude`, `longitude`, `radius_meters`, `report_count`, `confidence_score`, `severity_score`, `forecast_level`, `cluster_date`. `report_ids` is accepted but ignored. |

Heatmap confidence is confirmed verifications divided by total reports; severity weights are
low=25, moderate=50, high=75, critical=100.

---

## 15. Shared services (not endpoints)

| File | Purpose |
| ---- | ------- |
| `services/audit.php` | `recordActivity()` appends to `activity_log` after a successful write. Actor id comes from the JWT; no FK on `actor_id`. |
| `services/lookup.php` | ENUM validators, `resolveBarangay()`, `resolveBarangayCoords()`, `barangaysMissingCoordinates()`, `findBarangayId()`. Only `resolveBarangay()` inserts unknown names. |
| `services/create_notification.php` | `createNotification()` dedupes recipients, validates type and writes source links. |
| `services/maintenance_notice.php` | Builds maintenance notification title/message for in-area vs out-of-area users. |

---

## 16. Current quirks to know

- Method names are advisory; the API has no router and does not reject the wrong verb.
- `notification/create.php` calls `getNotificationType()` without including
  `services/lookup.php`, so manual notification creation currently has an undefined helper.
- Flood and hazard staff status endpoints lack the lineman barangay guard that outage actions use.
- `flood_report/delete.php` allows `under_review` as a source status even though the canonical
  flood status ENUM is `reported|verified|cleared|cancelled`; `flood_report/update.php` accepts
  `severe` instead of the canonical `critical`.
- `outage_report_electric_com/update_barangay.php` and `update_dagupan.php` do not validate
  `status` with `getStatus()`; only `update_single.php` does.
- `maintenance/get.php` and `maintenance_map/get.php` filter creators to `electric_company`, so
  admin-created schedules are hidden.
- `cluster/store.php` accepts `report_ids` but ignores it; no cluster/report link table remains.
- `electrical_hazard/update_status.php` allows residents to set any allowed status and does not
  apply lineman barangay scoping.
- `power_station/get_near_location.php` takes only `radius`; it never accepts a latitude/longitude.
- `get_active.php` and `get_resolve.php` return counts, not report lists.
