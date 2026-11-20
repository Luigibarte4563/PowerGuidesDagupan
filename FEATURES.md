# PowerGuide Dagupan — Features

PowerGuide Dagupan is a crowdsourced platform for Dagupan City. Residents report and track
outages, floods and electrical hazards; staff review reports, plan maintenance and assign linemen;
admins add user/role management, platform analytics and a shared audit trail.

This is the **product feature catalogue** — what the app does and who can do it. For setup see
[`SETUP.md`](SETUP.md); for architecture and the API contract see [`README.md`](README.md),
[`backend/README.md`](backend/README.md) and [`backend/endpoints.md`](backend/endpoints.md).

---

## Apps at a glance

| App | Route | Who uses it | Purpose |
| --- | ----- | ----------- | ------- |
| **Resident app** | `/dashboard` | Any signed-in user | Report and track problems, view schedules and stations, inspect nearby risks |
| **Staff app** | `/company` | `lineman`, `electric_company`, `admin` | Review reports, manage maintenance and assignments |
| **Admin app** | `/admin` | `admin` only | Platform stats, users/roles, Activity History |

After sign-in, `user` and `lineman` land on `/dashboard`, `electric_company` on `/company`, and
`admin` on `/admin`. Admins can also open the other two apps.

| Role | Access |
| ---- | ------ |
| `user` | Resident app only |
| `lineman` | Both apps; outage data limited to actively assigned barangays |
| `electric_company` | Both apps; all company writes, assignments, maintenance and broadcasts |
| `admin` | Everything, plus `/admin` |

Hiding a nav item is convenience only. Every API call re-checks the role from the JWT.

---

## Public site

Routes: `/` (landing), `/login`, `/register`, `/auth/google-callback`, plus the catch-all
not-found page.

The landing page renders, in order: **Header**, **Hero**, **Blackout**, **About**, **Features**,
**FAQs**, **Contact** and **Footer**. Older `HowItWorks`, `Safety` and `CtaBanner` section files are
still on disk but are not rendered.

- Header anchors: Features, FAQs, Contact; Sign In and Create an Account.
- Features has two tabs: **Outage Reporting** and **Risks & Hazards Alert**, using `outage.png` and
  `hazard.png` in a contained image box.
- FAQ answers describe the app as it is: location must be set before the resident dashboard,
  Power Stations → **Near my location** is how charging stations are found, and notifications are
  automatic with no separate switch. There is no standalone charging-station finder.
- The Contact form is a local placeholder; it does not call an API.

Accounts use email/password or Google sign-in. A signed-in visitor on `/login` or `/register` gets
an “already signed in” chooser rather than a silent redirect. Google errors are shown as plain
English messages.

---

## Resident app (`/dashboard`)

A `user` account must save a location before the resident dashboard is usable; `DashboardLayout`
shows the location setup modal otherwise. The topbar location shortcut is shown to residents, not
to staff roles.

| Area | What it does |
| ---- | ------------ |
| Overview | Summary cards for available stations, upcoming maintenance, open hazards and nearby risks (2 km), plus a merged latest outage/flood/hazard feed. The old “Area map” comment is stale; no map is rendered here. |
| My Assigned Barangays | Lineman-only view of active assignments. Other roles see an explanatory card on the same route. |
| Outage Reports | Map, 10-second refetch, Active / Resolved / All and All Reports / My Reports tabs, report form with photo, detail page, and owner-only update/delete. Only one active report per user. The visible list is currently capped to the first 3 filtered rows; there is no resident pager. |
| Flood Reports | All reports / Nearby tabs, adjustable radius, map/feed, flood level filters, report and delete. |
| Electrical Hazards | City-wide hazard list and map with type/severity/status filters. Reporters can move their own hazard through reported → verified → resolved. Hazards are deliberately not radius-scoped. |
| Risk Areas | Combined active flood + unresolved hazard feed, All / Nearby, radius control and map. |
| Heatmap | Read-only outage heat layer and stored clusters, lookback control, points/clusters and top-area stats. |
| Maintenance | Read-only Upcoming / Ongoing / Completed / All schedules with a coverage-circle map (radius capped at 500 m). |
| Power Stations | All / Available / Near my location / My post, filters, map, and one station post per user. Charging type is optional and defaults to Type-2 AC. The nav item is hidden for linemen; the URL still works. |
| Notifications | All / Unread, search and type filter, day-grouped timeline, load-more paging, mark read / mark all, and detail links to the related record. |
| Location | Save the primary address used by nearby searches. The map pin can refine the point. |
| Profile | Read-only account details from `me.php`, location status, and logout. |

Every report, flood, hazard, station and saved location is placed by the **barangay's stored
centroid**. The barangay is required; the map pin may refine it. The free-text address/location
label is never geocoded. A barangay without coordinates is rejected.

---

## Staff app (`/company`)

Sidebar groups are **Monitor** (Dashboard, Heatmap), **Respond** (Outage Reports, Flood Review,
Hazard Review), **Plan** (Assignments, Maintenance), **Assets** (Power Stations) and **Account**
(Notifications, Profile). Company linemen do not see Power Stations in the sidebar; the direct URL
is not blocked.

| Area | What it does |
| ---- | ------------ |
| Dashboard | Operations overview: outage counts by status, field crew coverage for managers, hazards/floods/assets and a recent outage feed. Lineman counts are scoped to their active barangays, including the completed maintenance count. |
| Outage Reports / detail | All / Active / Verified / Resolved tabs, severity filter, map/feed, verification, field updates and status changes. Managers can assign a lineman from the report card; the **Assign lineman & update status** dialog records the lineman and advances the report. The **All** tab hides terminal (`resolved`) rows; the Resolved tab still shows them. Map pins carry no letters. Bulk status changes are single-report, barangay-wide or city-wide (manager only for city-wide). |
| Flood Review | All / Reported / Verified / Cleared tabs, severity filter, map/feed and status changes. Managers can assign a lineman from the report card; the **Assign lineman & update status** dialog records the lineman and advances the report. **All** hides `cleared` rows; Cleared shows them. Pins carry no letters. |
| Hazard Review | All / Reported / Verified / Resolved tabs, severity filter, map/feed and status changes. **All** hides `resolved` rows; Resolved shows them. Pins carry no letters. The **Assign lineman & update status** dialog is available here. |
| Assignments | Under **Plan**. Managers create, edit, deactivate and reactivate lineman/barangay assignments. Rows are grouped one per lineman with barangays, job labels, **Jobs Done**, and a Lineman Activity dialog showing the covered barangays. `job_type` is a **label only**; an active assignment grants every job in that barangay. Linemen see their own assignments here and in `/dashboard/assignments`. |
| Maintenance | Browse, create, edit and delete schedules (authoring is manager-only) with a map and coverage circles. Linemen covering the barangay may post status-only updates. |
| Heatmap | Live outage heat layer with 24h / 7d / 14d / 30d lookback, All / High risk / Low risk feeds, a visibly labelled hottest-area list and wider heat pins. |
| Power Stations | Station directory with map/feed and create/edit/delete for the caller's own post. Lineman reads are scoped to assigned barangays by the API. |
| Notifications | Staff inbox and manager-only composer that sends to explicit user IDs. |
| Profile | Account details and current role capabilities. |

A lineman's server-side scope comes from active `lineman_assignments` rows. `job_type`
(`all`, `outage`, `flood`, `hazard`, `maintenance`) does **not** narrow access. `jobs_done` counts
distinct outage reports that lineman updated or verified and that are now `resolved` or `verified`;
floods, hazards and maintenance are not counted. Deactivating an assignment removes access on the
next request. City-wide outage updates are denied outright for linemen. Flood/hazard staff status
endpoints currently do not apply the barangay guard.

---

## Admin app (`/admin`)

Admin-only routes: `/admin`, `/admin/activity`, `/admin/users`. The admin top bar has **no
notification bell**. Profile and notification links reuse the staff pages.

| Area | What it does |
| ---- | ------------ |
| Platform Overview | One admin-only stats feed: user totals/counts by role, outage/flood/hazard/maintenance/station/notification totals, a 30-day report trend and top barangays. |
| Activity History | One shared audit view with **Electric Company** and **Lineman** tabs, newest-first pagination, and Who / Module / Action filters. Modules are Maintenance, Outage, Flood, Hazard and Assignment; actions are Created, Updated, Status changed, Verified, Assigned and Unassigned. There is no company-side audit page. |
| Users & Roles | Directory with search/role filters, create user, and change role. The current admin cannot change their own role. Role changes reach the target's API permissions at their next sign-in because the role lives in the JWT. |

Create, update, status, verification and assignment writes to maintenance, outages, floods, hazards
and assignments append to `activity_log` through `api/services/audit.php`. Deletes, image uploads,
station CRUD and notifications are not audited. The actor is always the JWT user, never a
client-supplied field. Older updates are unrecoverable; backfill restores only creation events and
active assignments still present in the source tables.

---

## Not built / removed

- No battery tracking, safety timers, standalone `/map` page or user-created roles.
- No audience/broadcast targeting: notification creation takes explicit user IDs.
- No separate notification toggle; alerts are generated automatically.
- No notification bell in the admin top bar.
- No letters on review map pins, and no terminal rows in each review page's **All** tab.
- The theme toggle, Overview “Area map” and older landing `HowItWorks` / `Safety` sections are
  stale comments or unused files, not live features.
