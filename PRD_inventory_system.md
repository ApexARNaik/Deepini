# Product Requirements Document
## Deepini — Personal Hardware Component Inventory & Spatial Tracking System

**Project name:** Deepini
**Author intent:** Single-user personal tool. No multi-tenant, no auth. Anyone forking this repo stands up their own independent instance.
**Audience for this doc:** An AI coding agent (Google Antigravity) building the entire project from this spec, plus a Stitch-generated UI template as a visual starting point.

---

## 1. Purpose & Problem Statement

The owner builds hardware/electronics projects involving many small, often-reused, sometimes-expensive components (resistors, sensors, MCUs, connectors, wiring, etc.). Two problems today:

1. **"Where is it?"** — Components are physically scattered across drawers, shelves, and bins in a room, and there's no fast way to find or remember where something lives.
2. **"How many do I actually have, and where did they go?"** — Components get pulled into projects and are often *not* consumed (returned to storage later), so a simple "used it, gone" model is wrong. The owner needs to know both total owned quantity and where each unit currently physically sits (in storage, or currently in a project).

This system solves both with two linked views of the same data:
- A **spatial view**: photographic, hierarchical, click-to-drill-down map of the physical room(s) and storage furniture.
- A **logical view**: a flat, searchable, filterable inventory list aggregated across all locations.

---

## 2. Goals / Non-Goals

### Goals (v1)
- Recreate the physical storage layout as an interactive, photo-based, clickable hierarchy of arbitrary depth.
- Maintain a flat inventory list aggregating quantities of every component across all locations.
- Full-text search across components (name, tags, notes).
- Flexible tagging/categorization (multi-tag, not rigid single-category).
- Per-component custom fields (including custom *image* fields), added ad hoc per item.
- Project-based check-out / check-in workflow with partial quantities, tracked per source/return location.
- Low-stock alert list (visual, in-app; no push/email).
- Offline **read/browse** access (including cached photos and hotspot navigation) on mobile; edits require connectivity.
- Multi-room support, each room with its own set of "side" photos and independent hierarchy.
- Zero-cost to host, run, and maintain indefinitely at this scale.

### Non-Goals (v1) — explicitly deferred
- No user accounts / authentication / multi-user support.
- No AI-based visual component recognition or image-similarity search (flagged as a possible v2 feature — see §10).
- No barcode/QR scanning.
- No push notifications or email alerts.
- No offline *editing* / write-queue / conflict resolution — offline is read-only.
- No native mobile app — a responsive/PWA web app only.

---

## 3. Tech Stack (fixed — do not substitute without reason)

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | **Next.js (App Router, TypeScript)** | Good agent-buildability, works great as a PWA, deploys free on Vercel. |
| Hosting | **Vercel (free/Hobby tier)** | Free, zero-config Next.js deploys, generous enough for single-user traffic. |
| Database | **Supabase Postgres (free tier)** | Relational — much easier to model the recursive spatial tree, tags, and checkout ledger correctly than a NoSQL store. Free tier: 500MB DB, 1GB file storage, 2GB bandwidth/month — sufficient at this scale if images are compressed (see §8.3). |
| File/image storage | **Supabase Storage (same free project)** | Public buckets for room/component/hotspot photos, served via CDN URL. |
| Offline caching | **Service Worker (via `next-pwa` or Workbox) + IndexedDB (via Dexie.js) + Cache Storage API for images** | Enables full offline browsing of both the flat list and the photo hierarchy, per requirement. |
| UI base | **Stitch-generated template (uploaded by owner), Tailwind CSS** | Owner supplies visual starting point; agent adapts components on top of it. |
| Hotspot drawing | **HTML5 Canvas or SVG overlay with freeform polygon lasso tool** | Freeform tracing was explicitly requested over simple rectangles. |
| Search | **Postgres full-text search (`tsvector`) or simple `ilike` for v1 scale** | No need for external search service at this data volume. |

**Repo/clone model:** No env-baked secrets in code. A single `.env.local` holds the Supabase URL + anon key. Cloning to a new domain = new Supabase project + new Vercel deploy + new `.env.local`. Document this in the README.

---

## 4. Core Data Model

> Everything below should be created as **Postgres tables in Supabase**, with Row Level Security **disabled or fully permissive** (single-user, no auth — see §9.2 security note). Use UUID primary keys (`gen_random_uuid()`), `created_at`/`updated_at` timestamps on every table.

### 4.1 Spatial hierarchy — recursive, unbounded depth

The room/storage layout is a tree of **photos** and **hotspots drawn on those photos**. A hotspot either (a) links deeper to another photo, or (b) is a **leaf** — an actual storage location that can hold components.

```
rooms
  id (uuid, pk)
  name (text)                  -- "Room 1", "Bedroom", etc.
  order_index (int)
  created_at

spatial_photos
  id (uuid, pk)
  room_id (uuid, fk -> rooms.id, not null)
  parent_hotspot_id (uuid, fk -> spatial_hotspots.id, nullable)
      -- NULL = this is a root "side" photo of the room (e.g. "Side A/Left wall")
      -- NOT NULL = this photo was uploaded when drilling into a hotspot on a parent photo
  image_url (text, not null)   -- Supabase Storage public URL
  label (text)                 -- "Left wall", "Cupboard interior", "Drawer 2", etc.
  order_index (int)
  created_at

spatial_hotspots
  id (uuid, pk)
  photo_id (uuid, fk -> spatial_photos.id, not null)   -- which photo this hotspot is drawn on
  label (text, not null)       -- "Blue cupboard", "Top drawer", etc.
  shape_points (jsonb, not null)  -- array of {x,y} polygon points, normalized 0-1 against image dimensions
  is_leaf (boolean, not null, default false)
  child_photo_id (uuid, fk -> spatial_photos.id, nullable)
      -- set once the owner uploads a "drill-down" photo for this hotspot; null until then
  created_at
```

**Rules the agent must enforce:**
- A hotspot is either a leaf (`is_leaf = true`, `child_photo_id = null`) **or** a drill-down link (`is_leaf = false`, `child_photo_id` set once a deeper photo is uploaded). A hotspot can start as neither (freshly drawn, unconfigured) — UI should prompt the owner to choose "this is a storage location" vs "this opens into more storage" right after drawing it.
- Deleting a `spatial_photos` row must cascade-delete its hotspots, and recursively any child photos those hotspots pointed to (and their components' location links — see below). Warn with a confirmation dialog before deleting anything with children/components attached.
- `shape_points` are stored normalized (0.0–1.0) so hotspot overlays scale correctly regardless of rendered image size.

### 4.2 Components & inventory

```
components
  id (uuid, pk)
  name (text, not null)
  photo_url (text, nullable)         -- primary reference photo of the component
  price (numeric, nullable)
  purchase_source (text, nullable)   -- e.g. "DigiKey", "local shop"
  datasheet_link (text, nullable)    -- optional URL to manufacturer spec sheet
  low_stock_threshold (int, nullable) -- alert when total owned qty <= this
  notes (text, nullable)
  pending_delete (boolean, not null, default false)
      -- set true when owner deletes a component that's still checked out to a project;
      -- see §9 rule 5 — full delete runs automatically once all active checkouts are returned
  custom_fields (jsonb, not null, default '{}')
      -- ad hoc per-item fields, e.g.:
      -- { "Voltage Rating": {"type": "text", "value": "5V"},
      --   "Underside photo": {"type": "image", "value": "<storage-url>"} }
  created_at
  updated_at

tags
  id (uuid, pk)
  name (text, unique, not null)      -- "Sensor", "Processor", "Wiring", "I2C", "Expensive"...
  usage_count (int, not null, default 0)  -- incremented on each assignment, powers autocomplete ranking

component_tags
  component_id (uuid, fk -> components.id)
  tag_id (uuid, fk -> tags.id)
  primary key (component_id, tag_id)

component_locations
  id (uuid, pk)
  component_id (uuid, fk -> components.id, not null)
  hotspot_id (uuid, fk -> spatial_hotspots.id, not null)  -- must reference a leaf hotspot
  quantity (int, not null, check quantity >= 0)
  created_at, updated_at
  unique (component_id, hotspot_id)   -- one row per component per physical location
```

**Total owned quantity** for a component = *in storage* **+** *currently checked out to a project* — confirmed by owner. Computed as `SUM(component_locations.quantity)` **+** `SUM(project_components.quantity WHERE returned_at IS NULL)` for that component. Compute this via a Postgres view (`component_totals`) rather than a stored column, so it's always correct:

```sql
create view component_totals as
select
  c.id as component_id,
  coalesce(sum(cl.quantity), 0) as in_storage_qty,
  coalesce((select sum(pc.quantity) from project_components pc
            where pc.component_id = c.id and pc.returned_at is null), 0) as checked_out_qty,
  coalesce(sum(cl.quantity), 0) + coalesce((select sum(pc.quantity) from project_components pc
            where pc.component_id = c.id and pc.returned_at is null), 0) as total_owned_qty
from components c
left join component_locations cl on cl.component_id = c.id
group by c.id;
```

### 4.3 Projects & check-out/check-in ledger

```
projects
  id (uuid, pk)
  name (text, not null)
  status (text, not null, default 'planning')  -- planning | active | completed | archived
  description (text, nullable)
  created_at, updated_at

project_components
  id (uuid, pk)
  project_id (uuid, fk -> projects.id, not null)
  component_id (uuid, fk -> components.id, not null)
  source_location_id (uuid, fk -> spatial_hotspots.id, not null)  -- where it was pulled from
  quantity (int, not null, check quantity > 0)
  checked_out_at (timestamptz, not null, default now())
  returned_at (timestamptz, nullable)
  returned_location_id (uuid, fk -> spatial_hotspots.id, nullable) -- where it was physically put back (can differ from source)
```

**Check-out transaction (must be atomic):**
1. Validate `quantity <= component_locations.quantity` at the chosen source location.
2. Decrement `component_locations.quantity` at source by `quantity` (delete the row if it hits 0).
3. Insert a `project_components` row with `returned_at = null`.

**Check-in transaction (must be atomic):**
1. Owner picks a return location (defaults to the original source location, but can be changed — component may be put away somewhere else).
2. Upsert `component_locations` at the return location: increment quantity if a row for that (component, hotspot) pair exists, else insert new.
3. Set `returned_at = now()` and `returned_location_id` on the `project_components` row.
4. After the update, check whether the component has `pending_delete = true` **and** zero remaining active (`returned_at IS NULL`) `project_components` rows. If so, run the full component delete (cascade `component_locations`, `component_tags`, `project_components` history) as its final step — see §9 rule 5.

A project can have many `project_components` rows (multiple components, and the same component pulled from multiple locations/times = multiple rows).

---

## 5. Feature Specifications

### 5.1 Spatial Hierarchy Navigation ("Room View")

- **Room selector**: top-level UI lets the owner switch between rooms, and create a new room (name only — photos added after).
- **Side photos**: within a room, owner uploads 1 or more root photos ("sides" — e.g. 3 walls with storage; the 4th skipped since it's bare). Each is a `spatial_photos` row with `parent_hotspot_id = null`. Shown as tabs or thumbnail strip.
- **Hotspot drawing (edit mode)**: owner enters an edit mode on a photo, traces a **freeform polygon** lasso around a storage feature (cupboard, shelf, bin) using pointer/touch, and labels it. After drawing, owner chooses:
  - **"This is a storage location"** → sets `is_leaf = true`. Components can now be assigned to it directly.
  - **"This opens into more storage"** → prompts photo upload for the next level (e.g. open the cupboard door, photograph the inside); creates a new `spatial_photos` row with `parent_hotspot_id` = this hotspot, sets `child_photo_id` accordingly.
- **View mode**: hovering/tapping a hotspot highlights its traced outline; clicking a non-leaf hotspot navigates into its child photo (with a breadcrumb trail back up: `Room 1 > Left wall > Blue cupboard > Top drawer`); clicking a leaf hotspot opens a side panel/drawer showing:
  - List of components currently stored there with quantities.
  - "Add component to this location" action (search-or-create component, enter quantity).
  - Quick quantity adjust / remove.
- **Recursion is unbounded** — the same draw → leaf-or-drill-down flow applies at every depth. No hardcoded level limit in schema or UI.
- Breadcrumb + a "zoom out to room" shortcut must always be visible so deep nesting doesn't strand the owner.

### 5.2 Flat Inventory List

- Table/grid view of all components, aggregated regardless of location, showing: thumbnail, name, tags, `total_owned_qty` (from the view in §4.2), price, low-stock flag if `total_owned_qty <= low_stock_threshold`.
- **Search bar**: matches against name, tags, and notes (Postgres `ilike`/`tsvector` — see §3). Debounced live search.
- **Filters**: by one or more tags.
- Clicking a row opens the **Component Detail Page**.

### 5.3 Component Detail Page

- All fields from §4.2, editable inline.
- **Locations panel**: every `component_locations` row for this component, each with a **"Locate"** button that jumps to Room View at that exact spot (auto-expanding the breadcrumb path from room → leaf).
- **Custom fields**: owner can add an arbitrary named field with a type — `text`, `number`, `link`, or `image`. Image-type custom fields upload to Supabase Storage like any other photo. No global schema — fields are freeform per component, stored in the `custom_fields` JSONB column.
- **Project history**: list of past/current `project_components` entries referencing this component (project name, quantity, checked-out date, returned date or "still out").

### 5.4 Add/Edit Component Flow

- Name field has **autocomplete**: suggest existing component names as the owner types (ranked by exact-prefix match, then recency/frequency) so near-duplicates aren't accidentally created under slightly different names.
- Tag field is multi-select with **autocomplete ranked by `tags.usage_count`** (most-used tags surface first) and the ability to create a new tag inline.
- Photo upload (client-side resized/compressed before upload — see §8.3).
- Initial location assignment is optional at creation (can be added later from Room View).

### 5.5 Projects & Check-out/Check-in

- Projects list page: name, status badge, count of currently checked-out components.
- Project detail page:
  - **Check out**: search/select a component → pick source location (must show current available qty there) → enter quantity → confirm. Runs the atomic transaction in §4.3.
  - **Currently checked out** list: each row shows component, quantity, source location, checked-out date, and a **Check In** action.
  - **Check in**: pick return location (defaults to source; searchable to pick elsewhere) → confirm. Runs the atomic transaction in §4.3.
  - Status field (`planning`/`active`/`completed`/`archived`) is manually set by the owner.

### 5.6 Low Stock View

- A dedicated section/button (e.g. in main nav) opens a list of every component where `total_owned_qty <= low_stock_threshold` (only components that have a threshold set are considered). Shows name, current qty, threshold, thumbnail. Links to each component's detail page. No notifications — purely an on-demand in-app view, per requirement.

### 5.7 Offline Support (PWA)

- Register a service worker that precaches the app shell (JS/CSS/HTML).
- On every successful online load, sync the following into IndexedDB (via Dexie.js): `rooms`, `spatial_photos`, `spatial_hotspots`, `components`, `component_tags`/`tags`, `component_locations`, and the `component_totals` view output.
- Cache all referenced image URLs (room/hotspot photos, component photos, custom image fields) into the Cache Storage API so they render offline.
- When offline: app detects connectivity loss, switches all reads to the IndexedDB/Cache Storage mirror, and **disables all editing UI** (add/edit component, draw hotspot, check-out/in, quantity changes) with a visible "You're offline — browsing cached data, editing disabled" banner, per requirement that editing only needs to work online.
- When connectivity returns: re-sync IndexedDB from Supabase (simple overwrite — no conflict resolution needed since offline writes never happened).

### 5.8 Multi-Room Support

- Rooms are fully independent trees (§4.1). Creating a new room just adds a `rooms` row; owner then uploads its own side photos and builds its hierarchy from scratch. No limit on room count.

---

## 6. Page/Route Map (for the agent to scaffold)

```
/                          → Dashboard: search bar, room quick-links, low-stock button, active projects
/rooms/[roomId]            → Room View (spatial hierarchy, starts at side-photo selector)
/inventory                 → Flat inventory list (search + filters)
/inventory/[componentId]   → Component detail page
/low-stock                 → Low stock list
/projects                  → Projects list
/projects/[projectId]      → Project detail (check-out/check-in UI)
/settings                  → Manage rooms (create/rename/delete), maybe tag management
```

---

## 7. UI Starting Point

- Owner will generate a base template in **Stitch** and upload it directly into Antigravity.
- Agent should treat the Stitch output as the **visual/component style baseline** (colors, spacing, base components) and build the actual pages/routes/logic above on top of it — not as a fixed final layout. Where the Stitch template doesn't cover a screen (e.g. the hotspot editor canvas), match its established visual language rather than introducing a new style.

---

## 8. Non-Functional Requirements

### 8.1 Performance
- Image lists (inventory grid, room thumbnails) should lazy-load and use responsive `srcset`/Next.js `<Image>` for compressed delivery.

### 8.2 Data integrity
- All multi-step operations (check-out, check-in, hotspot deletion cascades) must be wrapped in Postgres transactions/RPC functions — not sequential client-side calls — to avoid partial-state corruption if a request fails midway.

### 8.3 Free-tier storage budget (important — must be actively managed)
Supabase free tier gives **1GB total file storage**. This app is photo-heavy (room photos, hotspot photos at every depth, component photos, custom image fields). To stay within budget:
- **Compress and resize all images client-side before upload** — cap at ~1600px on the longest edge, convert to WebP/JPEG at ~80% quality. The agent must implement this in the upload flow (e.g. via `browser-image-compression` or canvas-based resize), not skip it.
- Store only one working copy per photo (no separate thumbnail duplication unless generated on-the-fly via Supabase's image transform, if available on free tier — verify at build time).

### 8.4 Shared Password Gate (confirmed requirement)
No user accounts, but the app is protected by a single shared password, checked client-side:
- A top-level client component wraps the whole app. On mount, it checks `sessionStorage` for an `unlocked` flag.
- If not present, render a full-screen password prompt instead of the app.
- On submit, compare the entered value against a fixed password stored in an environment variable (e.g. `NEXT_PUBLIC_APP_PASSWORD`, default value `Pass123`, owner can change it in `.env.local` at any time without a code change).
- On match: set `sessionStorage.unlocked = "true"` and render the app. On mismatch: show an inline error, stay on the prompt.
- The flag is `sessionStorage` (not `localStorage`), so it clears when the browser/tab is closed, matching "usable until it's closed" — the owner re-enters the password on the next fresh session.
- This check is pure client-side JS with no network call, so it works identically online and offline (the cached app shell includes this gate) — it does not interfere with the offline browsing behavior in §5.7.
- **Caveat (documented, not a blocker):** since the comparison happens in the browser, the password is visible to anyone who inspects the page's JS/network bundle. This is a soft deterrent against accidental link sharing, not real security — acceptable per owner's explicit choice, and cheaper/simpler than Vercel's built-in deployment password which was declined.

---

## 9. Open Assumptions the Agent Should Follow (owner has not specified further detail — proceed with these rather than asking)

1. Hotspot polygon editor: **continuous click-and-drag freehand tracing** (press, drag around the shape's outline in one motion, release to auto-close the loop) — matches the owner's "trace by hand" preference, as opposed to a click-each-vertex polygon tool.
2. No hard cap on number of rooms, hotspots, depth, or components.
3. `custom_fields` are per-component only (not a reusable template across components) — matches "add my own fields for any item" as stated.
4. Tag autocomplete ranks by `usage_count`; component-name autocomplete ranks by prefix match then recency.
5. **Component deletion rule (confirmed with owner):**
   - If a component has **no** active (`returned_at IS NULL`) `project_components` rows: "Delete" is a full delete — removes the `components` row and cascades to its `component_locations`, `component_tags`, and historical `project_components` rows (delete confirmation dialog required either way).
   - If a component **does** have active checkouts: deleting shows a warning ("This component is currently checked out to [Project(s)] — deleting will remove it from storage but keep it recorded until returned"). On confirm, the agent must **not** hard-delete the `components` row (doing so would orphan the still-active `project_components.component_id` reference). Instead: delete all of that component's `component_locations` rows (clearing its storage/spatial presence) and set a `pending_delete` flag (boolean column, add to `components` table) on the component. The component then disappears from the flat inventory's "in storage" view but still shows correctly as `checked_out_qty` in its project. Once every active checkout is returned (checked back in) and `pending_delete = true`, run the full delete automatically at that check-in step (cascade as in the no-checkout case above).
6. **Currency: INR (₹).** `price` is stored as plain `numeric` in the schema; the frontend formats and displays it with the `₹` prefix (e.g. `₹1,250.00`) everywhere it's shown.

---

## 10. Future Enhancements (explicitly out of scope for v1)

- AI-assisted visual component search (upload a photo of an unknown part, get matching suggestions from existing inventory) — deferred per owner's answer ("nice-to-have later").
- Barcode/QR generation and scanning for faster location/component lookup.
- Export/import (CSV backup of inventory).
- Optional lightweight link-password protection (see §8.4).
