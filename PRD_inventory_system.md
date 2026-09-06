# Product Requirements Document
## Deepini — Personal Hardware Component Inventory, Belongings & Spatial Tracking System

**Project name:** Deepini  
**Author intent:** Single-user personal tool. No multi-tenant, no auth. Anyone forking this repo stands up their own independent instance.  
**Audience for this doc:** Developers, AI coding agents (Google Antigravity), and maintainers building and evolving the project.

---

## 1. Purpose & Problem Statement

The owner builds hardware/electronics projects and maintains a workshop involving many small, often-reused, sometimes-expensive components (resistors, sensors, MCUs, connectors, wiring, etc.) as well as personal items and workshop belongings (hand tools, test equipment, soldering gear, stationery, storage bins, cables).

Two core problems exist today:

1. **"Where is it?"** — Items and components are physically scattered across drawers, shelves, boxes, and bins in one or more rooms, and there's no fast visual way to find or remember where something lives.
2. **"How many do I actually have, and where did they go?"** — Components get pulled into projects and are often *not* consumed (returned to storage later), while personal items are moved between physical containers. The owner needs to know both total owned quantity and where each unit currently physically sits (in storage, or currently checked out to a project).

This system solves both with two linked views of the same data:
- A **spatial view**: photographic, hierarchical, click-to-drill-down map of the physical room(s) and storage furniture with custom polygon/freehand hotspot annotations.
- A **logical view**: a flat, searchable, filterable inventory list aggregated across all locations, with an instant toggle between **Components** and **Personal Items**.

---

## 2. Goals / Non-Goals

### Goals (v1 & current)
- **Hierarchical Spatial Storage Layout**: Recreate physical storage layouts as an interactive, photo-based, clickable hierarchy of arbitrary depth (Room → Perspective/Wall → Cupboard → Shelf → Drawer → Bin).
- **Draggable View / Perspective Ordering**: Freely reorder root room perspective photos (views) via drag-and-drop or arrow buttons, with changes saved permanently to the database.
- **Direct Item Assignment from Hotspots**: Click any leaf storage location to open a drawer, search inventory, and directly add/adjust components or personal items without entering map-edit mode.
- **Dual Inventory Support (Components & Personal Items)**:
  - **Components**: full technical specs (datasheet URLs, vendor links, price in INR, low-stock alert thresholds, custom spec fields).
  - **Personal Items**: streamlined, minimal data model (Item Name, Description, Photo, Tags, and Physical Storage Locations).
- **Interactive Inventory Toggle**: Instant segmented switcher on `/inventory` between "Components" and "Personal" views with live counts and tailored table columns.
- **Aggregated Inventory**: Maintain a flat inventory list aggregating quantities of every item across all physical locations and active project checkouts.
- **Full-Text & Live Search**: Search across items (name, tags, notes/descriptions).
- **Flexible Tagging**: Multi-tag system with usage-count autocomplete ranking.
- **Ad-Hoc Custom Fields**: Per-component custom fields (text, number, link, custom image), added ad hoc without fixed global schemas.
- **Project Check-Out / Check-In Ledger**: Track partial quantities checked out to projects, recording source locations and return locations atomically.
- **Low-Stock Alert Dashboard**: Visual in-app dashboard highlighting components falling at or below their low-stock thresholds.
- **Offline Read/Browse (PWA)**: Service Worker + IndexedDB (Dexie.js) + Cache Storage API caching for offline browsing of rooms, photos, hotspots, and inventory lists.
- **Multi-Room Support**: Independent trees for multiple physical rooms.
- **Zero-Cost Operation**: Built for free-tier hosting on Vercel and Supabase Postgres/Storage.

### Non-Goals — explicitly deferred
- No multi-user accounts / authentication / multi-tenancy (app is protected by a lightweight shared password gate).
- No AI-based visual component recognition or image-similarity search (candidate for future iterations).
- No barcode/QR scanning.
- No push notifications or external email alerts.
- No offline editing / write-conflict resolution (offline mode is strictly read-only).
- No native mobile app (responsive web app / PWA only).

---

## 3. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Frontend framework | **Next.js (App Router, Turbopack, TypeScript)** | Robust agent-buildability, PWA support, fast builds, free Vercel deployment. |
| Hosting | **Vercel (Hobby tier)** | Zero-config Next.js deploys, generous free limits for single-user workloads. |
| Database | **Supabase Postgres (free tier)** | Relational model for spatial trees, inventory, tags, atomic RPCs, and checkout ledgers. |
| File/image storage | **Supabase Storage** | Public buckets for room, hotspot, and component photos. |
| Offline caching | **Service Worker (`@serwist/next`) + IndexedDB (`Dexie.js`) + Cache Storage API** | Enables complete offline browsing of rooms, images, and inventory lists. |
| Hotspot drawing | **HTML5 Canvas overlay with Freehand Lasso & Polygon modes** | Traces irregular physical boundaries (shelves, organizers, containers). |
| Image compression | **`browser-image-compression`** | Client-side resize and compression before upload to conserve storage quota. |

**Configuration:** Environment variables stored in `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_PASSWORD`).

---

## 4. Core Data Model

### 4.1 Spatial Hierarchy — Recursive, Unbounded Depth

```
rooms
  id (uuid, pk)
  name (text)                           -- "Workshop", "Lab", "Bedroom"
  order_index (int)
  created_at

spatial_photos
  id (uuid, pk)
  room_id (uuid, fk -> rooms.id)
  parent_hotspot_id (uuid, fk -> spatial_hotspots.id, nullable)
      -- NULL = root perspective / side photo of the room
      -- NOT NULL = drill-down photo taken inside a parent hotspot
  image_url (text, not null)            -- Supabase Storage public URL
  label (text)                          -- "North Wall", "Top Shelf", "Drawer Bin"
  order_index (int, not null, default 0) -- Defines order in room view strip
  created_at, updated_at

spatial_hotspots
  id (uuid, pk)
  photo_id (uuid, fk -> spatial_photos.id)
  label (text, not null)                -- "Soldering Station", "Blue Bin", etc.
  shape_points (jsonb, not null)        -- [{x, y}, ...] normalized 0.0–1.0
  is_leaf (boolean, not null, default false)
  child_photo_id (uuid, fk -> spatial_photos.id, nullable)
  created_at
```

#### View Reordering RPC
Root perspective photos are ordered by `order_index ASC, created_at ASC`. Reordering is performed via the atomic PostgreSQL function:
```sql
CREATE OR REPLACE FUNCTION reorder_spatial_photos(
  p_photo_ids UUID[]
) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE spatial_photos AS sp
  SET order_index = ord.idx - 1,
      updated_at = now()
  FROM unnest(p_photo_ids) WITH ORDINALITY AS ord(id, idx)
  WHERE sp.id = ord.id;
END;
$$;
```

---

### 4.2 Components & Personal Items Inventory

```
components
  id (uuid, pk)
  name (text, not null)
  photo_url (text, nullable)
  price (numeric, nullable)             -- In INR (₹), used for components
  purchase_source (text, nullable)      -- Vendor or shop link
  datasheet_link (text, nullable)       -- Spec sheet PDF or URL
  low_stock_threshold (int, nullable)   -- Low-stock alert threshold
  notes (text, nullable)                -- Item description or notes
  item_type (text, default 'component') -- 'component' | 'personal'
  pending_delete (boolean, default false)
  custom_fields (jsonb, default '{}')   -- Freeform specs & metadata
  created_at, updated_at

tags
  id (uuid, pk)
  name (text, unique, not null)
  usage_count (int, default 0)

component_tags
  component_id (uuid, fk -> components.id)
  tag_id (uuid, fk -> tags.id)
  primary key (component_id, tag_id)

component_locations
  id (uuid, pk)
  component_id (uuid, fk -> components.id)
  hotspot_id (uuid, fk -> spatial_hotspots.id) -- References leaf hotspot
  quantity (int, not null, check quantity >= 0)
  created_at, updated_at
  unique (component_id, hotspot_id)
```

#### Dual Item Classification
1. **Component (`item_type = 'component'`)**:
   - Technical electronics item requiring tracking of purchase sources, datasheets, pricing, low-stock alerts, and custom specs.
2. **Personal Item (`item_type = 'personal'`)**:
   - Streamlined everyday item, tool, or workshop belonging.
   - Minimal schema: Item Name, Description (stored in `notes`), Photo, Storage Locations, and Tags.
   - Bypasses pricing, low-stock alerts, vendor links, and custom specs.
   - Preserves full physical spatial tracking (assigned to room hotspots with exact quantities).
   - Compatible fallback: automatically tagged with `"Personal"` and stored with `custom_fields.item_type = 'personal'`.

#### Quantity Calculation View
```sql
CREATE OR REPLACE VIEW component_totals AS
SELECT
  c.id AS component_id,
  coalesce(sum(cl.quantity), 0) AS in_storage_qty,
  coalesce((SELECT sum(pc.quantity) FROM project_components pc
            WHERE pc.component_id = c.id AND pc.returned_at IS NULL), 0) AS checked_out_qty,
  coalesce(sum(cl.quantity), 0) + coalesce((SELECT sum(pc.quantity) FROM project_components pc
            WHERE pc.component_id = c.id AND pc.returned_at IS NULL), 0) AS total_owned_qty
FROM components c
LEFT JOIN component_locations cl ON cl.component_id = c.id
GROUP BY c.id;
```

---

### 4.3 Projects & Checkout Ledger

```
projects
  id (uuid, pk)
  name (text, not null)
  status (text, default 'planning')     -- planning | active | completed | archived
  description (text, nullable)
  created_at, updated_at

project_components
  id (uuid, pk)
  project_id (uuid, fk -> projects.id)
  component_id (uuid, fk -> components.id)
  source_location_id (uuid, fk -> spatial_hotspots.id)
  quantity (int, not null, check quantity > 0)
  checked_out_at (timestamptz, default now())
  returned_at (timestamptz, nullable)
  returned_location_id (uuid, fk -> spatial_hotspots.id, nullable)
```

---

## 5. Feature Specifications

### 5.1 Spatial Hierarchy Navigation ("Room View")

- **Room Selector**: Top-level switcher to switch rooms and create new rooms.
- **Draggable View Ordering**:
  - The side-photo strip allows drag-and-drop reordering of perspectives.
  - Hover/focus controls offer one-click arrow buttons (`ChevronUp`/`ChevronDown` or `ChevronLeft`/`ChevronRight`).
  - Order persists atomically to Supabase via `reorder_spatial_photos` and syncs to Dexie.
- **Hotspot Drawing**:
  - **Freehand Tool**: continuous click-and-drag tracing.
  - **Polygon Tool**: click-each-vertex lasso with automatic closing.
  - On save, choose:
    - *"This is a storage location"* (`is_leaf = true`). Opens side drawer immediately for assigning items.
    - *"This opens into more storage"* (`is_leaf = false`). Prompts drill-down photo upload.
- **Direct Item Assignment from Leaf Hotspot Drawer**:
  - Clicking any leaf hotspot opens the contents drawer.
  - **`+ Add` Button**: Opens live inventory search panel.
  - **1-Click Addition**: Click `+ Add` on any component or personal item to assign it to this location.
  - **Inline Stepper**: Increment/decrement quantity (`-` / `+`) or enter numbers directly.
  - **Item Deletion**: `X` button removes the item from the location.
  - **Badges**: Personal items display a distinct `Personal` tag badge.
  - **Direct New Item Link**: Quick link to `/inventory/new` for unregistered items.
- **Hotspot Selection & Deletion**:
  - **Canvas Delete Tool**: In "Edit Map" mode, selecting the "Delete Hotspot" tool highlights all hotspots in red and allows clicking directly on any hotspot region on the map to delete it.
  - **Hotspots Management Drawer**: When in "Edit Map" mode, a side panel lists all hotspots on the active view with their type (Storage Location vs Opens into Storage) and dedicated Delete buttons.
  - **In-Drawer Hotspot Deletion**: Leaf hotspot drawers feature a trash icon in the header for quick deletion.
  - **Recursive Safety**: Deletion unassigns all stored items and recursively purges child drill-down photos via `delete_hotspot_recursive`.

### 5.2 Inventory Page & View Toggle

- **Segmented View Switcher**:
  - Pill buttons: **`Components (X)`** vs **`Personal (Y)`**.
  - Dynamic route parameter sync (`/inventory?view=personal`).
  - Contextual header subtitle and dynamic action button (`+ Add Component` vs `+ Add Personal Item`).
- **Contextual Inventory Table**:
  - **Components View**: Img, Component Name, Tags, Quantity, Price (INR), Status (Low Stock Indicator), View Action.
  - **Personal Items View**: Img, Item Name, Description, Tags, Quantity, View Action.
  - Contextual empty states (*"No personal items found."* vs *"No components found."*).

### 5.3 Component & Personal Item Form

- **Category Selector**:
  - Interactive pill toggle at the top of the form allows switching between "Component" and "Personal Item" on the fly.
- **Minimal Form for Personal Items**:
  - Displays: Item Photo, Item Name, Description textarea, Storage Locations, and Tags.
  - Completely hides technical fields: Price, Low-Stock Alert, Datasheet URL, Purchase URL, and Custom Specs Builder.
- **Full Form for Components**:
  - Displays all technical specs, pricing, datasheets, custom specs builder, tags, and locations.
- **Physical Location Picker**:
  - Works identically for both item types: select physical leaf hotspot and specify initial quantity.

### 5.4 Item Detail & Edit Pages

- **Personal Item Presentation**:
  - Distinct gold `"Personal Item"` badge next to title.
  - Clean display: Total Owned, In Storage, and Description notes.
  - Hides empty price, datasheet, and custom specs sections.
  - Storage location card features a **"Locate"** button that jumps directly to the Room Map with the hotspot highlighted.
- **Component Presentation**:
  - Full technical resource links, price in INR (`₹`), low stock alert status, custom specs list, and location cards with "Locate" button.

### 5.5 Projects Check-Out / Check-In

- Dedicated ledger tracking components pulled into projects.
- Atomic deduction from `component_locations` upon checkout; atomic return to chosen location upon check-in.
- Supports deferred component deletion (`pending_delete`) when items are currently checked out.

### 5.6 Offline PWA Support

- Service Worker precaching app shell.
- Full IndexedDB mirror (Dexie.js) of rooms, photos, hotspots, components, and inventory.
- Image caching in Cache Storage API.
- Offline mode provides read-only browsing of spatial maps and inventory, showing an offline banner while disabling write operations.

---

## 6. Route Map

```
/                          → Dashboard: quick search, room links, low-stock overview, active projects
/rooms/[roomId]            → Spatial Room View (photo hierarchy, hotspot canvas, contents drawer)
/inventory                 → Unified inventory with Components / Personal toggle & search
/inventory/new             → Add Item Form (Component / Personal Item selector)
/inventory/[componentId]   → Item Detail Page (stats, description/specs, storage locations with "Locate")
/inventory/[componentId]/edit → Edit Item Form
/low-stock                 → Low-Stock alert dashboard
/projects                  → Projects list & status
/projects/[projectId]      → Project checkout/check-in workspace
```

---

## 7. Operational Rules & Assumptions

1. **Currency**: Indian Rupee (`₹`). Stored as `numeric`, formatted as `₹1,250.00`.
2. **Component Deletion**: If a component has active checkouts, mark `pending_delete = true` and clear storage locations; execute hard delete once all checkouts are returned.
3. **Personal Items Storage**: Personal items share the identical spatial tree and storage mechanics as components.
4. **View Ordering**: Persisted at database level via `order_index` and updated through `reorder_spatial_photos`.
5. **Shared Password Gate**: Protected by client-side session password gate (`NEXT_PUBLIC_APP_PASSWORD`).
