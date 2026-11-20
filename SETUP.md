# SETUP.md — PowerGuide Dagupan from scratch

This file documents how to get the app running. [`README.md`](README.md) documents how it works.

- [1. Requirements](#1-requirements)
- [2. Repository layout](#2-repository-layout)
- [3. Backend setup](#3-backend-setup)
- [4. Frontend setup](#4-frontend-setup)
- [5. CORS and the API proxy](#5-cors-and-the-api-proxy)
- [6. Google sign-in](#6-google-sign-in)
- [7. Location model](#7-location-model)
- [8. Verify the install](#8-verify-the-install)
- [9. Creating staff/admin accounts](#9-creating-staffadmin-accounts)
- [10. Troubleshooting](#10-troubleshooting)

---

## 1. Requirements

| Tool | Version | Notes |
| ---- | ------- | ----- |
| Node.js | 18+ (tested on 20) | [nodejs.org](https://nodejs.org) |
| npm | 9+ | Ships with Node |
| XAMPP | Any current release | Apache, PHP 8 and MariaDB/MySQL |
| Composer | 2.x | [getcomposer.org](https://getcomposer.org) — needed for `vlucas/phpdotenv` and `firebase/php-jwt` |
| Git | Any | To clone the repository |

PHP needs `pdo_mysql`, `curl`, `json`, `fileinfo` and `openssl` (enabled by default in XAMPP).
Google OAuth and Geoapify keys are optional; email/password login works without them.

---

## 2. Repository layout

This repository is a monolith: the React frontend and procedural PHP JSON API live together.

```text
C:\xampp\htdocs\PowerGuidesDagupan\
├── backend\       # PHP API, served by Apache at /PowerGuidesDagupan/backend
├── src\           # React frontend (Vite + Tailwind)
└── package.json
```

Do not clone a separate API repository. The current canonical schema is
`backend/database/powerguide.sql`; older references to `powerguidedagupan.sql` or
`CrowdsourcedAPI` are stale.

---

## 3. Backend setup

### 3.1 Install PHP dependencies

```bash
cd C:\xampp\htdocs\PowerGuidesDagupan\backend
composer install
```

This is required: `backend/config/env.php` loads `vendor/autoload.php` before handling requests.

### 3.2 Create the database

Start MySQL in XAMPP, then import `backend/database/powerguide.sql` via phpMyAdmin
(<http://localhost/phpmyadmin>) or, from Command Prompt:

```bat
"C:\xampp\mysql\bin\mysql.exe" -u root < C:\xampp\htdocs\PowerGuidesDagupan\backend\database\powerguide.sql
```

The script starts with `DROP DATABASE IF EXISTS powerguide`, so it is safe on a fresh install and
**destructive on an existing database**. It creates the `powerguide` schema with all current tables,
including `activity_log` and `lineman_assignments.job_type`.

### 3.3 Migrating an existing database

Apply the numbered scripts in `backend/database/` in order (Command Prompt):

```bat
cd C:\xampp\htdocs\PowerGuidesDagupan\backend\database
for %f in (005_reduce_tables.sql 006_add_hazard_review_work_type.sql 007_add_flood_cancelled_status.sql 008_merge_outage_images.sql 009_activity_log.sql 010_backfill_activity_log.sql 011_assignment_job_type.sql 012_drop_middle_name.sql) do "C:\xampp\mysql\bin\mysql.exe" -u root powerguide < %f
```

| Script | Effect |
| ------ | ------ |
| `005_reduce_tables.sql` | ENUM categories/hazard types/severity; unified severity; drops lookup tables and `outage_cluster_reports` |
| `006_add_hazard_review_work_type.sql` | Removes `work_type`; active assignments become barangay-wide |
| `007_add_flood_cancelled_status.sql` | Adds `cancelled` to flood status |
| `008_merge_outage_images.sql` | Consolidates outage images into `image_proof` |
| `009_activity_log.sql` | Creates the append-only `activity_log` table |
| `010_backfill_activity_log.sql` | Backfills creation events and active assignments |
| `011_assignment_job_type.sql` | Adds label-only `job_type` to assignments |
| `012_drop_middle_name.sql` | Drops `users.middle_name`; existing values are discarded |

**Deployment requirement:** an existing database must run `009`, then `010`, then `011`, then `012`
before the current audit and assignment UI is used. Without `activity_log`, audited write endpoints
fail.

### 3.4 Create `backend/.env`

```bash
cd C:\xampp\htdocs\PowerGuidesDagupan\backend
copy .env.example .env
```

`.env` is gitignored. Fill in at least:

| Key | Value |
| --- | ----- |
| `DB_HOST` | `localhost` |
| `DB_NAME` | `powerguide` |
| `DB_USER` / `DB_PASS` | Your MySQL credentials (XAMPP default: `root` / empty) |
| `JWT_SECRET_KEY` | A long random string; changing it invalidates all existing sessions |
| `GEOAPIFY_GEOCODING_API_KEY` | Optional; not used for ordinary address geocoding |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional; see [§6](#6-google-sign-in) |
| `GOOGLE_REDIRECT_URI` | `http://localhost/PowerGuidesDagupan/backend/api/auth/google_callback.php` |
| `FRONTEND_URL` | `http://localhost:5174` — the OAuth redirect target, **not** CORS |
| `ALLOWED_ORIGINS` | Leave unset when using the Vite proxy; see [§5](#5-cors-and-the-api-proxy) |

### 3.5 Confirm Apache serves the API

Start Apache, then:

```bash
curl.exe -i http://localhost/PowerGuidesDagupan/backend/api/reference/get.php
```

A `401` with a JSON body is the healthy answer: the endpoint requires a session. A blank page,
PHP warning or 500 means the path, `.env` or database is wrong.

---

## 4. Frontend setup

```bash
cd C:\xampp\htdocs\PowerGuidesDagupan
npm install
copy .env.example .env
npm run dev
```

The committed `.env.example` is already correct for the default setup:

```dotenv
VITE_API_BASE_URL=/backend
# API_PROXY_TARGET=http://localhost
```

Open <http://localhost:5174>. The port is pinned with `strictPort: true`: Vite refuses to start if
5174 is busy, because `FRONTEND_URL` and Google's redirect must match that exact origin.

`vite.config.js` forwards `/backend/api/...` to `http://localhost` and rewrites the path to
`/PowerGuidesDagupan/backend/api/...` on Apache. Change `API_PROXY_TARGET` only if Apache is not on
`localhost:80`.

| Command | Purpose |
| ------- | ------- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint (currently reports pre-existing issues in untouched files) |
| `npm run check:outage-feed`, `npm run check:no-black` | Repo-specific regression checks |

---

## 5. CORS and the API proxy

With the default `VITE_API_BASE_URL=/backend`, the browser only talks to the Vite dev server; Vite
forwards `/backend` to Apache. The request is same-origin, so CORS headers are never consulted and
the HttpOnly `jwt_token` cookie works on localhost, 127.0.0.1 and LAN IPs alike.

CORS matters only if you replace the relative API URL with an absolute one. In that case:

- `backend/config/cors.php` allows `http://localhost:5174`, `http://127.0.0.1:5174`,
  `http://localhost:5173` and `http://127.0.0.1:5173` by default.
- Setting `ALLOWED_ORIGINS` in `backend/.env` **replaces** that list. Use comma-separated exact
  origins with no spaces.
- `Access-Control-Allow-Origin: *` cannot work because the client sends credentials.
- `FRONTEND_URL` is the OAuth redirect target and has no effect on CORS.

---

## 6. Google sign-in

Optional. Email/password sign-in works without it.

1. In Google Cloud, enable the **Google People API** and create an OAuth 2.0 Client ID of type
   *Web application*.
2. Add this exact authorized redirect URI:

   ```text
   http://localhost/PowerGuidesDagupan/backend/api/auth/google_callback.php
   ```

3. Put the client ID/secret and the same redirect URI in `backend/.env`, with
   `FRONTEND_URL=http://localhost:5174`.

A mismatch is silent and confusing: Google issues a valid JWT, but the browser is redirected to an
origin where the app is not listening. If `/auth/google-callback` never loads, check
`FRONTEND_URL` first.

---

## 7. Location model

Every outage, flood, hazard, power station and saved location is positioned from the **barangay's
stored centroid** in the `barangays` table. Forms require a barangay; the map pin can refine the
point. The free-text address/location name is only a label and is never geocoded.

A `user` account must save a location before the resident dashboard is usable: `DashboardLayout`
shows a location setup modal first. Staff roles are not gated this way. A barangay without stored
coordinates is rejected on submit; fill its `latitude`/`longitude` in the `barangays` table if that
happens.

---

## 8. Verify the install

```bash
# API reachable; 401 + JSON is healthy
curl.exe -i http://localhost/PowerGuidesDagupan/backend/api/reference/get.php

# Register a throwaway account
curl.exe -c cookies.txt -X POST http://localhost/PowerGuidesDagupan/backend/api/auth/register.php -H "Content-Type: application/json" -d '{"first_name":"Test","last_name":"User","email":"test@example.com","password":"secret123"}'

# Read the session back
curl.exe -b cookies.txt http://localhost/PowerGuidesDagupan/backend/api/auth/me.php
```

In the browser:

1. <http://localhost:5174> shows the landing page.
2. `/register` creates a `user`; after login it lands on `/dashboard`.
3. The location setup modal appears; save a location to unlock the dashboard.
4. Sidebar/reference data loads from `reference/get.php`. An empty sidebar means the proxy is not
   reaching Apache or the session is missing.
5. Check the role-specific home: `admin` → `/admin`, `electric_company` → `/company`,
   `lineman`/`user` → `/dashboard`.

---

## 9. Creating staff/admin accounts

New registrations always get the `user` role. Roles are the `users.role` ENUM
(`user`, `lineman`, `electric_company`, `admin`); there is no `role_id` lookup table.

Once an admin account exists, use **`/admin/users` → Users & Roles** to create accounts with any
role and to change roles. An admin cannot change their own role there. A role change lives in the
JWT, so it reaches the target's API permissions at their **next sign-in**; `auth/me.php` shows it on
the next page load.

To bootstrap the first admin from SQL after registering normally:

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

Then sign in again. For a lineman, also create an active row in `lineman_assignments` from
**`/company/assignments`** (managers only) or by SQL; without one, all assigned-barangay data is
empty. `job_type` is only a label — an active assignment covers every job in that barangay.

---

## 10. Troubleshooting

| Symptom | Cause | Fix |
| ------- | ----- | --- |
| `Failed to fetch` / `ECONNREFUSED` | Apache is not running, or the proxy target is wrong | Start Apache; set `API_PROXY_TARGET` if it is not on `localhost:80` |
| 404 on `/backend/...` | API path or folder name differs | Confirm Apache serves `/PowerGuidesDagupan/backend`; the Vite proxy rewrites `/backend` to that path |
| Every API call returns 500 | Missing/invalid `backend/.env` or DB | Copy `.env.example` → `.env`, fill `DB_*` and `JWT_SECRET_KEY`, confirm the import |
| CORS error in the console | Absolute API URL with an unlisted origin | Use `VITE_API_BASE_URL=/backend`, or add the exact origin to `ALLOWED_ORIGINS` |
| Login succeeds, next call is 401 | Cookie dropped across origins | Stay on the relative proxied URL; with an absolute URL set CORS correctly |
| Vite refuses to start on 5174 | Port already in use | Free it; Google OAuth depends on the pinned origin |
| Google sign-in lands on a blank page | `FRONTEND_URL` mismatch | Set `FRONTEND_URL=http://localhost:5174` in `backend/.env` |
| Dashboard is empty after login | `user` has no saved location, or API calls failed | Save a location; check `reference/get.php` in the network tab |
| Audited writes fail after upgrading an old DB | `activity_log` missing | Apply `009_activity_log.sql`, `010_backfill_activity_log.sql` and `011_assignment_job_type.sql` |
| `Unknown column 'middle_name'` after upgrading | Old `users` table still has the column | Apply `012_drop_middle_name.sql` |
| Lineman sees no reports | No active assignment | Create one in `/company/assignments`; `job_type` does not grant access by itself |
