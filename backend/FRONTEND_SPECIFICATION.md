# Frontend Specification — current state

This document describes the React app as it exists in `src/`, not a blueprint of unimplemented
screens. Older sections describing battery tracking, safety timers, a standalone `/map` page,
user-created roles and other non-existent pages were removed. For page-by-page behavior see
[`../feature-perpage.md`](../feature-perpage.md); for product scope see
[`../FEATURES.md`](../FEATURES.md).

---

## 1. Stack and entry point

- React 18 + Vite, React Router 6, Tailwind CSS
- `@tanstack/react-query` for server state, Leaflet/React Leaflet/leaflet.heat for maps,
  Recharts for admin charts, lucide-react for icons
- Alias `@` → `src`
- Dev port pinned to **5174** (`strictPort`) for Google OAuth

Provider order in `src/main.jsx`:

1. `QueryClientProvider` (30 s stale time; refetch on window focus disabled)
2. `BrowserRouter`
3. `ThemeProvider`
4. `ToastProvider`
5. `AuthProvider`
6. `ReferenceProvider`
7. `SessionExpiryGuard`
8. `App` → `AppRoutes`

`ThemeContext` permanently applies `data-theme="dark"`; `toggleTheme` is a no-op. `LandingLayout`
forces light theme on `/`, and `PublicLayout` forces dark on `/auth/google-callback`. There is no
rendered theme toggle despite a stale Topbar comment.

---

## 2. Routes and guards

Source: `src/routes/index.jsx`.

| Path | Layout / guard | Notes |
| ---- | -------------- | ----- |
| `/` | `LandingLayout` | Public landing page |
| `/auth/google-callback` | `PublicLayout` | OAuth token handoff |
| `/login`, `/register` | `PublicOnlyRoute` → `AuthLayout` | Signed-in users get an “already signed in” chooser |
| `/dashboard` | `ProtectedRoute` → `DashboardLayout` | Any authenticated role |
| `/dashboard/assignments`, `/dashboard/outages`, `/dashboard/outages/:id`, `/dashboard/floods`, `/dashboard/hazards`, `/dashboard/risk-areas`, `/dashboard/heatmap`, `/dashboard/maintenance`, `/dashboard/power-stations`, `/dashboard/notifications`, `/dashboard/location`, `/dashboard/profile` | Above | Resident app routes |
| `/company` | `ProtectedRoute` → `RequireRole` → `CompanyLayout` | Default allowed roles: `lineman`, `electric_company`, `admin` |
| `/company/outages`, `/company/outages/:id`, `/company/floods`, `/company/maintenance`, `/company/heatmap`, `/company/power-stations`, `/company/notifications`, `/company/hazards`, `/company/assignments`, `/company/profile` | Above | Staff app routes; no audit/activity route |
| `/admin`, `/admin/activity`, `/admin/users` | `ProtectedRoute` → `RequireRole allowed={ADMIN_ROLES}` → `AdminLayout` | `admin` only |
| `*` | `NotFound` | Catch-all |

`ProtectedRoute` shows a spinner while auth loads, then redirects signed-out users to `/login` with
`state.from`. `RequireRole` shows `AccessDenied` for the wrong role instead of redirecting.
`SessionExpiryGuard` sends 401 responses to `/login`; `RoleChangeGuard` shows a 403 banner offering
re-login.

Default homes: `admin` → `/admin`, `electric_company` → `/company`, `lineman` and `user` →
`/dashboard`. Admins may still open `/company` and `/dashboard`.

---

## 3. Layouts, nav and shell behavior

### Resident shell — `DashboardLayout`

- Groups: Monitor, Report, Explore, Account.
- Nav: Overview; My Assigned Barangays (`lineman` only); Outage Reports; Flood Reports; Electrical
  Hazards; Risk Areas; Heatmap; Maintenance; Power Stations (`user`, `electric_company`, `admin`
  only); Notifications and Profile (not in sidebar).
- A `user` without a saved location is blocked by `LocationSetupModal`. Staff roles are not gated.
- Hidden nav items are not route guards.

### Staff shell — `CompanyLayout`

- Groups: Monitor (Dashboard, Heatmap), Respond (Outage Reports, Flood Review, Hazard Review),
  Plan (Assignments, Maintenance), Assets (Power Stations), Account (Notifications, Profile).
- Linemen do not see Power Stations in the sidebar; the direct URL still works.

### Admin shell — `AdminLayout`

- Groups: Platform (Dashboard, Activity History), People (Users & Roles).
- Profile and notification links reuse the staff pages.
- Topbar has **no notification bell** for `admin`.
- Topbar avatar's **My location** link is shown only to residents, not staff/admin roles.

### Topbar

Page title from the active nav item, notification bell (hidden for admin), and account menu.
`useNotifications()` still runs for admins; only the UI is hidden.

---

## 4. Landing page

`src/pages/Landing/index.jsx` renders exactly:

1. `Header` — logo, anchors for Features / FAQs / Contact, Sign In, Create an Account.
2. `Hero` — “Know Before your Lights goes Out”, `hero_picture.png`.
3. `Blackout` — “A Blackout Shouldn't Leave You Powerless”, `lighting_candle.png`.
4. `About` — “Power Outages Don't Have to Leave You Unprepared”.
5. `Features` — tabs **Outage Reporting** / **Risks & Hazards Alert** using `outage.png` and
   `hazard.png`; image box uses `object-fit: contain`.
6. `FAQs` — six answers matching current behavior, including location required before the resident
   dashboard, Power Stations → Near my location for charging, and automatic notifications with no
   switch.
7. `Contact` — local placeholder form; resets after 3 s and does not call an API.
8. `Footer` — branding and anchor links.

`HowItWorks.jsx`, `Safety.jsx` and `CtaBanner.jsx` still exist on disk but are not imported.
`PublicLayout` still links to `#how-it-works` and `#safety`, but it only wraps the OAuth callback.
Several footer anchors have no matching section.

---

## 5. Page modules

### Resident (`src/pages/Dashboard`)

| Module | Notes |
| ------ | ----- |
| `Overview` | Summary cards and merged latest reports. No map is rendered despite stale “Area map” comments. |
| `MyAssignments` | Lineman-oriented assignment view; other roles see an explanatory card. |
| `Outages`, `OutageDetail` | Map/feed, 10 s refetch, report filters and detail. Visible feed sliced to 3 rows with no pager. |
| `Floods`, `Hazards` | Floods has All/Nearby and radius; Hazards is deliberately city-wide, not radius-scoped. |
| `RiskAreas` | Combined active floods + unresolved hazards with radius. |
| `Heatmap` | Read-only heat layer and clusters. |
| `Maintenance` | Read-only schedules with 500 m-capped coverage circles. |
| `PowerStations` | All/Available/Near my location/My post, one station per user. |
| `Notifications` | Day-grouped timeline, load-more paging. |
| `Location`, `Profile` | Save primary location; read-only account info and logout. |

`FloodsCheck.jsx` is an unrouted duplicate and is not part of the app.

### Staff (`src/pages/Company`)

| Module | Notes |
| ------ | ----- |
| `Overview` | Operations dashboard; lineman counts scoped to active assignments, including completed maintenance. |
| `Outages`, `OutageDetail` | All/Active/Verified/Resolved, filters, map, verification, field updates, status changes. **All** hides `resolved`; pins have no letters. |
| `Floods` | Flood Review; **All** hides `cleared`; pins have no letters. |
| `Hazards` | Hazard Review; **All** hides `resolved`; pins have no letters; lineman assignment dialog. |
| `Assignments` | Under Plan. Manager CRUD and lineman self-view; one row per lineman, job labels, `Jobs Done`, Lineman Activity modal with barangays. `job_type` is label-only. |
| `Maintenance` | Manager authoring, status-only lineman updates, map and pagination. |
| `Heatmap` | 24h/7d/14d/30d lookback, visibly labelled risk feed, wider heat pins. |
| `PowerStations`, `Notifications`, `Profile` | Station directory (lineman reads scoped by API), staff inbox/composer, role capabilities. |

There is no `/company/activity` or company-side audit page.

### Admin (`src/pages/Admin`)

| Module | Notes |
| ------ | ----- |
| `Overview` | Platform Overview from `admin/stats.php`: user totals, report totals, 30-day trend, top barangays. |
| `Activity` | Electric Company / Lineman tabs; Who / Module / Action filters; pagination. Same audit log as the API. |
| `Users` | Directory, create user, change role; cannot change own role. |

---

## 6. API client layer

`src/api/client.js` is the only HTTP wrapper. It sets `/backend` as the default base URL, sends
credentials, parses the JSON envelope, and throws typed API errors. `uploadWithProgress()` handles
multipart uploads.

| Module | Backend area |
| ------ | ------------ |
| `auth.js` | register, login, logout, Google URL, token handoff, `me.php` |
| `reference.js` | `reference/get.php` |
| `outages.js` | resident outage reports and image upload |
| `companyOutages.js` | staff scoped/raw lists, detail, status changes, verify, add update |
| `maintenance.js` | list/upcoming/complete/map/create/update/status/delete |
| `powerStations.js` | station CRUD and nearby queries |
| `notifications.js` | inbox, read state, create |
| `location.js` | saved location get/save |
| `floods.js`, `hazards.js` | reports, nearby, status, uploads, deletes |
| `risk.js`, `heatmap.js` | nearby risk, heat points, cluster get/store |
| `linemanAssignments.js` | assignment CRUD, linemen, my assignments, activity |
| `admin.js` | users, create user, update role, stats, activity |

`floods_backup.js` is not exported from `src/api/index.js` and is unused.

Hooks in `src/hooks/` cover admin queries (`useAdmin.js`), assignments
(`useLinemanAssignments.js`), saved location (`useSavedLocation.js`), notifications
(`useNotifications.js`), company outage summaries (`useCompanyOutages.js`), barangay coordinate
helpers, geolocation, debouncing and reference data.

---

## 7. Data and permission contracts the UI relies on

- Roles are the strings `user`, `lineman`, `electric_company`, `admin` (`src/utils/roles.js`),
  mirrored from the JWT. UI allow-lists mirror PHP `requireRole(...)` arrays; the API remains the
  source of truth.
- `reference/get.php` returns raw barangay rows with numeric `id` and `barangay_name`.
  `ReferenceContext` normalises them to `{ id: <NAME>, name: <NAME>, rowId: <numeric id>, raw, ... }`;
  forms use `rowId` for `barangay_id`.
- Coordinates come from the barangay centroid; the free-text location label is never geocoded.
- `job_type` is a label only; an active assignment grants all work in that barangay. `jobs_done`
  counts distinct resolved/verified outage reports updated or verified by that lineman.
- Audit filters are `target_type` ∈ maintenance/outage/flood/hazard/assignment and `action` ∈
  created/updated/status_changed/verified/assigned/unassigned.
- `admin/activity.php` requires `role=electric_company|lineman` and pages newest-first.
- Resident outage `get_active` / `get_resolve` endpoints return counts, not lists.
- Notification creation takes explicit user ids; there is no audience/broadcast targeting.

---

## 8. UI system and assets

- `src/components/ui/` provides Button, Badge, Card/StatCard, Input, Select, Tabs, Table, Alert,
  Modal and States.
- Shared feature components include `DataView`, `Pagination`, `Map`, `MapWorkspace`, `RecordCard`,
  `MyAssignmentList`, `NotificationTimeline` and form/status dialogs.
- Tables become cards on small screens; modals trap focus, close on Escape, restore focus and lock
  body scroll. Severity/status are always colour plus text.
- Imported assets: `Union.svg` (logo), `logo.svg` (topbar), `hero_picture.png`,
  `lighting_candle.png`, `outage.png`, `hazard.png`. Several other images and SVG files exist but
  are not imported.

---

## 9. Current deviations and limits

These are real behaviors, not future work:

- No theme toggle; `ThemeContext` is effectively read-only.
- Resident Outages slice to 3 rows with no visible pager; Notifications use load-more instead.
- Overview has no map despite stale comments; PublicLayout has dead landing anchors.
- Contact form is a local placeholder with dummy contact details.
- Hazards are city-wide; only floods/risk/stations use the saved-location radius.
- Nav hiding and route guards are separate concerns; hidden items do not necessarily block URLs.
- Admin bell and staff avatar location link are hidden in the topbar; underlying notification queries
  still run.
- Company review pins carry no letters, and `All` tabs hide terminal rows while dedicated status
  tabs still show them.
- Dead files remain in the tree (`FloodsCheck.jsx`, `floods_backup.js`, unused landing sections and
  assets). They are not routes or exports.
