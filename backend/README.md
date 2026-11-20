# PowerGuide Dagupan API

The PHP JSON API for PowerGuide Dagupan. It lives inside the monolith at
`C:\xampp\htdocs\PowerGuidesDagupan\backend` and is served by Apache at
`http://localhost/PowerGuidesDagupan/backend`. The React app calls it through the Vite proxy path
`/backend`; see [`../SETUP.md`](../SETUP.md) for installation and [`endpoints.md`](endpoints.md)
for the endpoint contract.

- **Language:** procedural PHP 8, no framework or build step
- **Database:** MySQL/MariaDB via PDO prepared statements
- **Dependencies:** `vlucas/phpdotenv` ^5.6, `firebase/php-jwt` ^7.2 (Composer)
- **Auth:** JWT in an HttpOnly `jwt_token` cookie; optional Google OAuth
- **Size:** 71 endpoint files plus 4 shared service includes (not endpoints)

---

## 1. Directory structure

```text
backend/
├── api/                         # One PHP file per action
│   ├── admin/                   # users, create_user, update_role, stats, activity
│   ├── auth/                    # register, login, logout, me, google, google_callback
│   ├── reference/               # options for barangays, categories, statuses, etc.
│   ├── outage_report/           # resident reports
│   ├── outage/                  # staff verification and field updates
│   ├── outage_report_electric_com/  # single / barangay / city status changes
│   ├── lineman_assignment/      # assignments, own assignments, linemen, activity
│   ├── maintenance/, maintenance_map/
│   ├── power_station/, notification/, user_location/
│   ├── flood_report/, electrical_hazard/
│   ├── risk/, heatmap/, cluster/
│   └── services/                # audit.php, lookup.php, create_notification.php,
│                                # maintenance_notice.php — NOT HTTP endpoints
├── auth/                        # jwt_auth.php, rbac.php, lineman_access.php,
│                                # issue_jwt.php, google_oauth.php
├── config/                      # env.php, cors.php, db_connect.php
├── database/                    # powerguide.sql + migrations 005–012
├── .env.example
├── composer.json
└── README.md, endpoints.md, FRONTEND_SPECIFICATION.md
```

---

## 2. API conventions

- All endpoints live under `/api/` and return JSON, normally with a `success` key plus `message`
  and/or `data`.
- Most actions accept JSON bodies; several also fall back to form parameters. Uploads use
  `multipart/form-data`.
- The session is an HttpOnly cookie, so browser clients must send credentials. `credentials:
  'include'` is already set in `src/api/client.js`.
- `auth/me.php` re-reads the live role from the database. Other endpoints trust the role claim in
  the JWT until it expires or the user signs in again.
- Roles are the `users.role` ENUM: `user`, `lineman`, `electric_company`, `admin`.
- `reference/get.php` needs a session. Its raw barangay rows are `{ id: <numeric id>, barangay_name,
  city, province, latitude, longitude }`. The frontend's `ReferenceContext` normalises them to
  `{ id: <NAME>, name: <NAME>, rowId: <numeric id>, raw, ... }`; forms use `rowId` where an integer
  `barangay_id` is expected.
- Reports, floods, hazards, stations and saved locations use the barangay's stored centroid. The
  free-text location/address is only a label and is never geocoded.
- `GET auth/me.php`, `admin/*`, and other protected endpoints return 401 without a valid JWT or
  403 when the role is not allowed.

---

## 3. Authentication and roles

| Endpoint group | Typical guard |
| -------------- | ------------- |
| `auth/register.php`, `auth/login.php`, Google endpoints | Public; registration cannot choose a role |
| `auth/me.php`, `reference/get.php`, resident report reads/writes | Any authenticated user |
| `outage/verify.php`, `outage/add_update.php`, `outage/*`, `cluster/store.php` | Staff: `lineman`, `electric_company`, `admin` |
| `maintenance/create|update|delete.php`, `maintenance/get_complete.php`, `notification/create.php` | Managers: `electric_company`, `admin` |
| `lineman_assignment/*` | Managers for CRUD; `my.php` is self-scoped; `linemen.php` is a manager picker |
| `admin/*` | `admin` only |
| `electrical_hazard/update_status.php` | Authenticated caller; actor always from JWT |

`backend/auth/lineman_access.php` is the single source of lineman scoping:

- Only **active** rows in `lineman_assignments` grant access.
- An active row grants access to the whole barangay — outages, floods, hazards and maintenance.
- `job_type` (`all`, `outage`, `flood`, `hazard`, `maintenance`) is a **label only**; it does not
  narrow access.
- Read endpoints exclude unauthorized rows; single-record outage actions answer 403 before writing.
- `outage_report_electric_com/update_dagupan.php` is denied outright for linemen because it has no
  barangay to scope to. Managers keep the city-wide action.
- Flood and hazard `update_status.php` allow staff but currently do **not** apply the barangay
  guard; `electric_company` and `admin` are never scoped.

Assignment read helpers also compute `jobs_done`: distinct outage reports the lineman updated or
verified that are now `resolved` or `verified`. Floods, hazards and maintenance are excluded.

---

## 4. Database and migrations

The canonical schema is `database/powerguide.sql`. It creates `powerguide` with 13 tables:

`barangays`, `users`, `outage_reports`, `outage_report_verifications`, `outage_clusters`,
`maintenance_schedules`, `maintenance_locations`, `power_stations`, `flood_reports`,
`electrical_hazards`, `notifications`, `lineman_assignments`, `activity_log`.

Importing it is destructive (`DROP DATABASE IF EXISTS powerguide`). For an existing database apply
the numbered migrations in order:

| Script | Effect |
| ------ | ------ |
| `005_reduce_tables.sql` | ENUM categories/hazard types/severity, unified severity, drops lookup tables and `outage_cluster_reports` |
| `006_add_hazard_review_work_type.sql` | Removes `work_type`; active assignments become barangay-wide |
| `007_add_flood_cancelled_status.sql` | Adds `cancelled` flood status |
| `008_merge_outage_images.sql` | Consolidates outage images into `image_proof` |
| `009_activity_log.sql` | Creates append-only `activity_log` |
| `010_backfill_activity_log.sql` | Backfills creation events and active assignments |
| `011_assignment_job_type.sql` | Adds label-only `job_type` to assignments |
| `012_drop_middle_name.sql` | Drops `users.middle_name`; existing values are discarded |

A fresh import already contains all of these changes. For an upgraded database, **009 → 010 → 011 →
012 must run before deploying the current audit/assignment UI**; without `activity_log`, audited write
endpoints fail.

---

## 5. Audit trail

`api/services/audit.php` exposes `recordActivity(...)`. It appends one row after a successful write;
failed or denied actions leave no audit row. The actor id is always taken from the JWT user, never
from request data, and `actor_id` has no foreign key so the log survives account deletion.

Audited writes include:

- Maintenance: create, update
- Outages: resident create/update, staff verify/add_update, single/barangay/city status changes
- Floods: create, update, update_status
- Hazards: create, update, update_status
- Assignments: create, update, delete

`activity_log` columns: `id`, `target_type`, `target_id`, `target_label`, `actor_id`, `action`,
`detail`, `previous_status`, `status`, `created_at`.

Valid filter values for `admin/activity.php`:

- `target_type`: `maintenance`, `outage`, `flood`, `hazard`, `assignment`
- `action`: `created`, `updated`, `status_changed`, `verified`, `assigned`, `unassigned`
- `role`: `electric_company` or `lineman` (required)

The endpoint pages newest-first and groups by the actor's **current** role. Older update events are
unrecoverable because the source rows did not store an updater; backfill restores only facts still
present (creation events and active assignments).

---

## 6. Configuration

`backend/.env` is gitignored and required. See `.env.example` and
[`../SETUP.md`](../SETUP.md) for the full walkthrough.

| Variable | Purpose |
| -------- | ------- |
| `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS` | PDO connection |
| `JWT_SECRET_KEY` | HS256 signing secret; changing it invalidates all sessions |
| `GEOAPIFY_GEOCODING_API_KEY` | Optional external key |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Optional OAuth |
| `FRONTEND_URL` | Where Google redirects the browser after exchanging the code; normally `http://localhost:5174` |
| `ALLOWED_ORIGINS` | Optional CORS allow-list used only when bypassing the Vite proxy |

`config/cors.php` sends CORS headers only for exact allow-listed `Origin` values. `*` is never valid
because the client sends credentials. `FRONTEND_URL` has no effect on CORS.

---

## 7. Security notes

- PDO prepared statements throughout; request ids are validated before use.
- JWT is signed and delivered as an HttpOnly cookie; roles are enforced per endpoint.
- Passwords use `password_hash()`; duplicate emails are rejected.
- Photo uploads validate extension/MIME and cap size at 5 MB.
- Google identity is verified against Google's published JWKS with the configured audience.
- Ownership checks scope resident updates/deletes to their own reports, hazards and stations.
- Lineman scoping is enforced in SQL, not by hiding UI.
- Authorship fields such as `assigned_by`, `updated_by` and audit `actor_id` come from the JWT.

---

## 8. Known limits

- No audience/broadcast targeting: `notification/create.php` takes explicit user IDs.
- Residents are not notified on outage status changes; notifications are generated for new outage
  reports to staff, flood/hazard status changes, maintenance notices and assignments.
- Role changes take effect at the target's next sign-in because the role is inside the JWT.
- No company-side audit page: audit history is only in `/admin/activity`.
- `maintenance/get.php` and `maintenance_map/get.php` filter creators to `electric_company`, so
  admin-created schedules are hidden from those lists.
- `outage_report_electric_com/update_barangay.php` and `update_dagupan.php` do not validate `status`;
  `flood_report/update.php` accepts `severe` although the flood ENUM uses `critical`.
- `cluster/store.php` accepts `report_ids` but ignores it; no cluster/report link table remains.
- `FRONTEND_SPECIFICATION.md` in this folder describes the current frontend. Where it disagrees with
  the code, this README, `endpoints.md` and the root `README.md`/`SETUP.md` are the API setup sources.
