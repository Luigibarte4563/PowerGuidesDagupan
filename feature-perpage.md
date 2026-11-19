# PowerGuide Dagupan — Features per page

This document lists what each rendered page actually does in the current app. It follows the route
map in `src/routes/index.jsx` and the nav files under `src/routes/`. For the product-level summary,
see [`FEATURES.md`](FEATURES.md); for setup, see [`SETUP.md`](SETUP.md).

Role names are the JWT values: `user`, `lineman`, `electric_company`, `admin`. Nav visibility is not
access control — the API re-checks roles, and lineman data is scoped server-side.

---

## Public pages

| Route | Page | Audience | Current behavior |
| --- | --- | --- | --- |
| `/` | Landing | Everyone | Renders Header, Hero, Blackout, About, Features, FAQs, Contact and Footer. |
| `/login` | Login | Signed-out visitors | Email/password and Google sign-in. Signed-in visitors get an “already signed in” chooser. |
| `/register` | Register | Signed-out visitors | Email registration. New accounts are `user`. |
| `/auth/google-callback` | OAuth handoff | Everyone | Stores the JWT from the API redirect, then forwards to the role's home app. |
| `*` | Not found | Everyone | Catch-all page. |

### Landing sections

| Section | Current content |
| --- | --- |
| Header | Anchors for Features, FAQs and Contact; Sign In and Create an Account actions. |
| Hero | “Know Before your Lights goes Out” with `hero_picture.png`. |
| Blackout | “A Blackout Shouldn't Leave You Powerless” with `lighting_candle.png`. |
| About | “Power Outages Don't Have to Leave You Unprepared”. |
| Features | Two tabs: **Outage Reporting** (`outage.png`) and **Risks & Hazards Alert** (`hazard.png`). Images use `object-fit: contain`. |
| FAQs | Six answers matching the app: reports and maps, Power Stations → Near my location for charging, automatic notifications with no switch, and location required before the resident dashboard. No standalone charging-station finder is described. |
| Contact | Placeholder form: sets a local submitted state, resets after 3 s, and does **not** call an API. |
| Footer | Branding and anchor links. `HowItWorks`, `Safety` and `CtaBanner` files exist but are not rendered. |

---

## Shared shell behavior

| Area | Current behavior |
| --- | --- |
| Resident location gate | A `user` without a saved location is blocked by `DashboardLayout` and shown `LocationSetupModal`. Staff roles are not gated this way. |
| Topbar | Page title, notifications bell and account menu. The bell is hidden for `admin`. The avatar's **My location** link is shown only to residents, not to `lineman`, `electric_company` or `admin`. |
| Sidebar | Grouped nav from the route folder. Hidden items (lineman Power Stations, lineman My Assigned Barangays for non-linemen) do not block direct URLs. |
| Session/role guards | 401 sends signed-out users to `/login`; 403 shows Access Denied or a re-login banner after a role change. |

---

## Resident app (`/dashboard`)

Any authenticated role can open these routes. A `user` must first save a location.

| Route | Nav label | Current behavior |
| --- | --- | --- |
| `/dashboard` | Overview | Cards for available power stations, upcoming maintenance, open hazards and nearby risks within 2 km; merged latest outage/flood/hazard feed; maintenance list. There is no area map on this page despite a stale code comment. |
| `/dashboard/assignments` | My Assigned Barangays | Lineman-oriented view of active assignments; nav item is shown only to `linemen`, but the route itself is not role-gated. Non-linemen see an explanatory card. |
| `/dashboard/outages` | Outage Reports | Leaflet map and feed with 10 s refetch, Active / Resolved / All and All Reports / My Reports tabs, search/filters, and report form. The visible feed is currently sliced to 3 rows with no pager. |
| `/dashboard/outages/:id` | — | Outage detail: report facts, evidence photo, status progress, field updates and owner cancel/update controls. |
| `/dashboard/floods` | Flood Reports | All reports / Nearby tabs, radius control, map/feed, level filters, report form and owner delete. Nearby uses the saved location. |
| `/dashboard/hazards` | Electrical Hazards | Whole-city hazard list and map, type/severity/status filters, search, report form and owner status changes. It is intentionally not radius-scoped. |
| `/dashboard/risk-areas` | Risk Areas | Combined active floods and unresolved hazards, All / Nearby tabs, radius control, map and risk cards with distance. |
| `/dashboard/heatmap` | Heatmap | Read-only outage heat layer and stored clusters, lookback selection, points/cluster stats and top areas. |
| `/dashboard/maintenance` | Maintenance | Read-only Upcoming / Ongoing / Completed / All schedules, search, status filter and coverage-circle map with a 500 m radius cap. |
| `/dashboard/power-stations` | Power Stations | All / Available / Near my location / My post, station-type and availability filters, map, and one station post per user with optional charging type. Nav item hidden for `lineman`; direct URL not blocked. |
| `/dashboard/notifications` | — | All / Unread, search and type filter, day-grouped timeline, load-more paging, mark read / mark all, and detail links. |
| `/dashboard/location` | — | Save the primary location used by nearby searches; shows coordinates, matched barangay and last saved time. |
| `/dashboard/profile` | — | Read-only profile from `me.php`, inbox/location stats and logout. |

Coordinates come from the selected barangay's stored centroid. The optional map pin refines the
point; the free-text address/location label is never geocoded.

---

## Staff app (`/company`)

Available to `lineman`, `electric_company` and `admin`. Sidebar groups are **Monitor**, **Respond**,
**Plan**, **Assets** and **Account**. **Respond** contains only Outage Reports, Flood Review and
Hazard Review; **Assignments** lives under **Plan**. Linemen do not see Power Stations in the
sidebar, but the URL is not blocked.

| Route | Nav label | Current behavior |
| --- | --- | --- |
| `/company` | Dashboard | Operations overview: outage status counts, manager-only crew coverage, hazards/floods/assets, recent outage feed and quick links. Lineman counts are scoped to active assigned barangays, including completed maintenance. |
| `/company/heatmap` | Heatmap | 24h / 7d / 14d / 30d lookback, wider heat pins, All / High risk / Low risk hotspot feeds, map and a visibly labelled hottest-area list with pagination. |
| `/company/outages` | Outage Reports | All / Active / Verified / Resolved tabs, severity filter, map/feed and pagination. **All** hides `resolved`; map pins have no letters. Terminal rows remain available under Resolved. |
| `/company/outages/:id` | — | Report detail with photo, resident info, verification history, staff notes, status change, verify and add-update actions. |
| `/company/floods` | Flood Review | All / Reported / Verified / Cleared tabs, severity filter, map/feed, status dialog and pagination. **All** hides `cleared`; map pins have no letters. |
| `/company/hazards` | Hazard Review | All / Reported / Verified / Resolved tabs, severity filter, map/feed, status changes, lineman assignment dialog and pagination. **All** hides `resolved`; map pins have no letters. |
| `/company/assignments` | Assignments | Manager CRUD plus lineman self-view. One row per lineman with assigned barangays, job labels, **Jobs Done** and a Lineman Activity modal that lists the barangays. `job_type` is label-only; an active assignment covers every job in the barangay. |
| `/company/maintenance` | Maintenance | Upcoming / Ongoing / Completed tabs, create/edit/delete (manager-only), map, coverage circles and pagination. Covered linemen can post status-only updates. |
| `/company/power-stations` | Power Stations | All / Near my location / My stations, type/availability filters, map and own-post CRUD. Hidden in the lineman sidebar; lineman reads are scoped to assigned barangays by the API. |
| `/company/notifications` | — | All / Unread / Read inbox with day-grouped timeline and manager-only composer for explicit user IDs. |
| `/company/profile` | — | Staff profile, role capabilities and inbox/location summary. |

Lineman scoping is enforced in `backend/auth/lineman_access.php`, not by hiding controls. An active
assignment grants access to that whole barangay. `jobs_done` counts distinct outage reports the
lineman updated or verified that are now `resolved` or `verified`; other modules are excluded.
City-wide outage updates are denied for linemen. Flood/hazard staff status endpoints currently do
not apply the barangay guard.

---

## Admin app (`/admin`)

Admin-only. There is no company-side audit page and no admin notification bell.

| Route | Nav label | Current behavior |
| --- | --- | --- |
| `/admin` | Dashboard | Platform Overview from `admin/stats.php`: user totals/counts by role, report totals, 30-day trend and top barangays. |
| `/admin/activity` | Activity History | One shared audit timeline with **Electric Company** and **Lineman** tabs, Who / Module / Action filters and pagination. Modules: Maintenance, Outage, Flood, Hazard, Assignment. Actions: Created, Updated, Status changed, Verified, Assigned, Unassigned. |
| `/admin/users` | Users & Roles | Account directory with search/role filters and pagination, create user, and change role. Admins cannot change their own role; changes take effect at the target's next sign-in. |

Create, update, status, verification and assignment writes to maintenance, outages, floods, hazards
and assignments append audit rows through `backend/api/services/audit.php`. Deletes, image uploads,
station CRUD and notifications are not audited. The actor comes from the JWT. Migration
`010_backfill_activity_log.sql` restores only creation events and active assignments; older update
details are unrecoverable.
