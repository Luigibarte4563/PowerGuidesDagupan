# PowerGuide Dagupan

A crowdsourced power-outage, flood and electrical-hazard platform for **Dagupan City**. Residents
file and track reports, look up maintenance and power stations, and see nearby risks. Staff verify
reports, manage schedules and assign linemen. Admins add user/role management, platform analytics
and a shared activity history.

This repository is a **monolith**: the React frontend and the procedural PHP JSON API live together.

- **`/dashboard`** — resident app (also used by staff for their own account).
- **`/company`** — staff app for `lineman`, `electric_company` and `admin`.
- **`/admin`** — admin-only app: platform stats, user/role management and Activity History.

After sign-in, `user` and `lineman` land on `/dashboard`, `electric_company` on `/company`, and
`admin` on `/admin`. Admins can still open the other two apps.

---

## 1. Requirements

- Node.js 18+ (tested on 20) and npm 9+
- XAMPP / Apache with PHP 8 (`pdo_mysql`, `curl`, `json`, `fileinfo`, `openssl`)
- Composer 2.x (the API uses `vlucas/phpdotenv` and `firebase/php-jwt`)
- MySQL / MariaDB with a `powerguide` database

Google sign-in and Geoapify keys are optional; email/password login works without them.

## 2. Setup

Full walkthrough: **[`SETUP.md`](SETUP.md)**. Short version:

```bash
cd C:\xampp\htdocs\PowerGuidesDagupan
cd backend && composer install && cp .env.example .env
# import backend/database/powerguide.sql into MySQL, then fill in backend/.env
cd ..
npm install
cp .env.example .env
npm run dev
```

Open <http://localhost:5174> (the Vite port is pinned because OAuth redirects here).

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build |
| `npm run lint` | ESLint over JS/JSX |
| `npm run check:outage-feed`, `npm run check:no-black` | Repo-specific regression checks |

### Frontend environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `/backend` | Relative, proxied, same-origin API path |
| `API_PROXY_TARGET` | `http://localhost` | Where Vite forwards `/backend` (read by `vite.config.js`) |

`vite.config.js` rewrites `/backend/api/...` to `/PowerGuidesDagupan/backend/api/...` on Apache.
Stay on the relative URL: it avoids CORS entirely and keeps the HttpOnly `jwt_token` cookie working
on localhost, 127.0.0.1 and LAN IPs alike. If you switch to an absolute API URL, set
`ALLOWED_ORIGINS` in `backend/.env`; `FRONTEND_URL` is only the OAuth redirect target.

### Backend environment

`backend/.env` holds `DB_*`, `JWT_SECRET_KEY`, `GEOAPIFY_GEOCODING_API_KEY`, the `GOOGLE_*`
OAuth values, `FRONTEND_URL=http://localhost:5174` and optional `ALLOWED_ORIGINS`. It is
gitignored; a missing one is a hard failure.

## 3. Folder layout

```text
PowerGuidesDagupan/
├── backend/
│   ├── api/                 # 71 HTTP endpoints + services/
│   │   ├── admin/           # users, update_role, create_user, stats, activity
│   │   ├── auth/            # register, login, logout, me, google, google_callback
│   │   ├── outage_report/   # resident reports
│   │   ├── outage/          # staff verification / field updates
│   │   ├── outage_report_electric_com/  # single / barangay / city status changes
│   │   ├── lineman_assignment/          # assignments, my, linemen, activity
│   │   ├── maintenance/, maintenance_map/
│   │   ├── power_station/, notification/, user_location/
│   │   ├── flood_report/, electrical_hazard/, risk/, heatmap/, cluster/
│   │   └── services/        # shared PHP includes, NOT endpoints
│   ├── auth/                # JWT issue/verify, RBAC, lineman_access, Google OAuth
│   ├── config/              # env.php, cors.php, db_connect.php
│   ├── database/            # powerguide.sql + numbered migrations
│   └── README.md, endpoints.md, FRONTEND_SPECIFICATION.md
├── src/
│   ├── api/                 # all backend calls (client.js fetch wrapper)
│   ├── assets/              # logo + landing artwork
│   ├── components/          # shared UI, maps, modals, tables
│   ├── context/             # Auth, Reference, Toast
│   ├── hooks/               # notifications, saved location, assignments, admin queries
│   ├── layouts/             # Public, Landing, Dashboard, Company, Admin + Sidebar/Topbar
│   ├── pages/               # Landing, Auth, Dashboard, Company, Admin, NotFound
│   ├── routes/              # route map + nav item lists + guards
│   └── utils/               # roles, formatters, validators, constants
├── public/
├── .env.example
├── SETUP.md, FEATURES.md, feature-perpage.md
└── vite.config.js, tailwind.config.js, package.json
```

## 4. Routes

### Resident (`/dashboard`, any signed-in user)

| Route | Page |
| --- | --- |
| `/dashboard` | Overview: summary cards, nearby risks, latest reports, maintenance |
| `/dashboard/assignments` | My Assigned Barangays (lineman only) |
| `/dashboard/outages`, `/dashboard/outages/:id` | Outage feed and report detail |
| `/dashboard/floods` | Flood reports + nearby view |
| `/dashboard/hazards` | Electrical hazards + nearby view |
| `/dashboard/risk-areas` | Combined nearby floods and hazards |
| `/dashboard/heatmap` | Outage heatmap / clusters (read-only) |
| `/dashboard/maintenance` | Maintenance schedules (read-only) |
| `/dashboard/power-stations` | All / Available / Near me / My posts |
| `/dashboard/notifications`, `/dashboard/location`, `/dashboard/profile` | Account pages |

Residents (`user`) without a saved location are shown the location setup modal by `DashboardLayout`
before the dashboard is usable. The Power Stations nav item is hidden for `linemen` in both the
resident and company sidebars (direct URLs are not blocked by the route guard), and the topbar
avatar's **My location** link is shown only to residents.

### Staff (`/company`, `RequireRole`)

| Route | Page |
| --- | --- |
| `/company` | Operations overview and recent activity |
| `/company/heatmap` | Live outage heatmap + hottest-areas feed |
| `/company/outages`, `/company/outages/:id` | Outage Reports / report detail |
| `/company/floods` | Flood Review |
| `/company/hazards` | Hazard Review |
| `/company/assignments` | Assignments (under **Plan**, managers only for writes) |
| `/company/maintenance` | Maintenance schedules |
| `/company/power-stations` | Station directory |
| `/company/notifications`, `/company/profile` | Account pages |

On Outage Reports, Flood Review and Hazard Review, the `all` tab hides terminal rows
(`resolved` / `cleared`) and map pins carry no letters.

### Admin (`/admin`, admin only)

| Route | Page |
| --- | --- |
| `/admin` | Platform overview: user totals, 30-day trend, top barangays |
| `/admin/activity` | Activity History (Electric Company / Lineman tabs) |
| `/admin/users` | Users & Roles: directory, create user, change role |

The admin top bar deliberately has **no notification bell**. Admin sidebar links for profile and
notifications reuse the staff pages.

## 5. Roles and access

| Role | Access |
| --- | --- |
| `user` | `/dashboard` only |
| `lineman` | Both apps; outage data limited to actively assigned barangays |
| `electric_company` | Both apps; all company writes, assignments, maintenance, broadcasts |
| `admin` | Everything, plus `/admin` |

Hiding nav items is convenience only — every API call re-checks the role from the JWT.

**Lineman scoping** is enforced in SQL by `backend/auth/lineman_access.php`. An active row in
`lineman_assignments` grants access to that **whole barangay** — outages, hazards and maintenance.
`job_type` (`all`, `outage`, `flood`, `hazard`, `maintenance`) is a **label only**; it does not narrow
access. `jobs_done` counts distinct outage reports the lineman updated or verified that are now
`resolved` or `verified` (floods, hazards and maintenance are not counted).

## 6. API map

All endpoints are under `/api/`, return `{ success, message, ...data }`, and use the HttpOnly
`jwt_token` cookie. See **[`backend/endpoints.md`](backend/endpoints.md)** for each endpoint's
guard and payload.

| Area | Endpoints (relative to `/api/`) |
| --- | --- |
| Auth | `auth/{register,login,logout,me,google,google_callback}.php` |
| Admin | `admin/{users,update_role,create_user,stats,activity}.php` |
| Reference | `reference/get.php` |
| Outages (resident) | `outage_report/{create,get,get_active,get_resolve,get_my_report,get_detail,update,delete,upload_image}.php` |
| Outages (staff) | `outage/{get,verify,add_update}.php` |
| Outages (company) | `outage_report_electric_com/{get,update_single,update_barangay,update_dagupan}.php` |
| Assignments | `lineman_assignment/{get,create,update,delete,my,linemen,activity}.php` |
| Maintenance | `maintenance/{get,get_upcoming,get_complete,create,update,delete}.php`, `maintenance_map/get.php` |
| Stations | `power_station/{create,get,get_available,get_my_posts,get_near_location,update,delete}.php` |
| Notifications | `notification/{get,mark_as_read,mark_all_as_read,create}.php` |
| Location | `user_location/{get,location}.php` |
| Floods | `flood_report/{create,get,get_nearby,update,delete,upload_image}.php` |
| Hazards | `electrical_hazard/{create,get,update,update_status,upload_image}.php` |
| Risk / heatmap / clusters | `risk/get_nearby.php`, `heatmap/get.php`, `cluster/{get,store}.php` |

### Contract notes worth knowing

- `reference/get.php` requires a session. Its raw barangay rows are `{ id: <numeric id>, barangay_name, city, province, latitude, longitude }`. `ReferenceContext` normalises them for the UI to `{ id: <NAME>, name: <NAME>, rowId: <numeric id>, raw, ... }`; forms use `rowId` wherever an integer `barangay_id` is expected.
- `outage_report/get_active.php` and `get_resolve.php` return **counts only** (`total_active_reports`, `total_resolved`). `get_active` counts rows with `status != 'rejected'`, plus any supplied status/category/severity filters and lineman scope; there is no `is_active` column in the canonical schema.
- `outage_report/upload_image.php` takes multipart `image` + `outage_report_id` (5 MB cap). `power_station/delete.php` takes `station_id`, not `id`.
- `power_station/get_near_location.php` takes only `radius`; the centre is the caller's saved location. Station list/nearby reads are lineman-scoped too.
- `lineman_assignment/*` accepts `job_type`. `get.php` also returns `jobs_done`. `my.php` takes no identity parameter — the caller comes from the JWT.
- `admin/activity.php` requires `?role=electric_company|lineman` and accepts `user_id`, `target_type`, `action`, `page`, `page_size`.
- `GET /api/auth/me.php` re-reads the live role; other endpoints trust the role claim in the JWT until it expires or the user signs in again.

### Audit trail

Create, update, status, verification and assignment writes to maintenance, outages, floods, hazards
and assignments append to `activity_log` via `api/services/audit.php`. Deletes, image uploads,
station CRUD and notifications are not audited. The actor is always the JWT user, never a client
field. Older updates are not recoverable; migration `010_backfill_activity_log.sql` restores only
facts still stored in the source rows (creation events and active assignments).

### Coordinate model

Reports, hazards, floods, stations and saved locations use the **barangay's stored centroid** from
the `barangays` table. Forms require a barangay; the map pin can refine the point. The free-text
location/address field is a label and is not geocoded. A barangay without coordinates is rejected.

## 7. Database and migrations

`backend/database/powerguide.sql` is the canonical schema: **13 tables** — `barangays`, `users`,
`outage_reports`, `outage_report_verifications`, `outage_clusters`, `maintenance_schedules`,
`maintenance_locations`, `power_stations`, `flood_reports`, `electrical_hazards`, `notifications`,
`lineman_assignments` and `activity_log`. Importing it is destructive (`DROP DATABASE`).

For an existing database, apply the numbered migrations in order:

| Script | Effect |
| --- | --- |
| `005_reduce_tables.sql` | ENUM-based category / hazard_type / severity; unified severity; drops lookup tables and `outage_cluster_reports` |
| `006_add_hazard_review_work_type.sql` | Removes `work_type`; active assignments become barangay-wide |
| `007_add_flood_cancelled_status.sql` | Adds `cancelled` flood status |
| `008_merge_outage_images.sql` | One `image_proof` column on outage reports |
| `009_activity_log.sql` | Creates the append-only `activity_log` |
| `010_backfill_activity_log.sql` | Backfills creation events and active assignments |
| `011_assignment_job_type.sql` | Adds label-only `job_type` to assignments |
| `012_drop_middle_name.sql` | Drops `users.middle_name`; existing values are discarded |

A fresh import of `powerguide.sql` already contains all of these changes; migrations are for older
databases. Run `009` → `010` → `011` → `012` before deploying the current audit / assignment UI.

## 8. Design, accessibility and known limits

Tailwind tokens in `tailwind.config.js`: amber primary, navy chrome, success/warning/danger/info
statuses, `rounded-card`/`rounded-control`, Inter, `lucide-react` icons. Severity and status are
always text plus colour. Layouts are mobile-first with a drawer sidebar; modals trap focus and
close on Escape.

Not implemented in this app: battery tracking, safety timers, a standalone map page, user-created
roles, and audience/broadcast targeting (`notification/create.php` takes explicit user ids).
Residents are not notified when an outage status changes; notifications are generated for flood and
hazard status changes, maintenance schedules, assignments and new outage reports to staff.
