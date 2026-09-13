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
- **Direct Compartment Locate & Visual Pinpointing**: Clicking "Locate" from any inventory item page or table row jumps directly to the containing perspective photo, automatically opens the compartment side drawer with the components list, smoothly auto-scrolls the viewport to center the target, and spotlights the physical compartment with an animated bouncing red marker (`MapPin` badge, pulsing beacon dot, and pulsing red boundary).
- **Direct Item Assignment from Hotspots**: Click any leaf storage location to open a drawer, search inventory, and directly add/adjust components or personal items without entering map-edit mode.
- **Pre-Selected Location Assignment**: Creating new components/items from a compartment drawer automatically passes the location ID to `/inventory/new?locationId=...` for instant pre-selection.
- **Arrow-Shaped Hotspot Annotation**: Draw directional arrow hotspots with adjustable tail, tip, and width handles to point towards out-of-frame storage, shelves, or sub-regions.
- **Hotspot Reshaping, Moving & Intermediate Views**: Redraw existing boundaries without data loss, relocate hotspots between perspectives, and insert intermediate photos into existing hierarchy branches.
- **Multi-Level Undo/Redo Engine**: In-memory action history stack allowing instant undo of hotspot operations (create, delete, reshape, move, photo replace, intermediate insertion).
- **Dual Inventory Support (Components & Personal Items)**:
  - **Components**: full technical specs (datasheet URLs, vendor links, price in INR, low-stock alert thresholds, custom spec fields).
  - **Personal Items**: streamlined, minimal data model (Item Name, Description, Photo, Tags, and Physical Storage Locations).
- **Interactive Inventory Toggle & Location Tooltips**: Instant segmented switcher on `/inventory` between "Components" and "Personal" views with live counts, tailored table columns, direct location pills with "Locate" buttons, and custom glassmorphic storage path sequence tooltips (`Room → View → Box → Compartment`).
- **Aggregated Inventory**: Maintain a flat inventory list aggregating quantities of every item across all physical locations and active project checkouts.
- **Full-Text & Live Search**: Search across items (name, tags, notes/descriptions).
- **Flexible Tagging & Bounded Dropdown**: Multi-tag system with usage-count autocomplete ranking and bounded scrollable dropdown with keyboard navigation.
- **Ad-Hoc Custom Fields & File Attachments**: Per-item custom fields (text, number, link, image, and document uploads such as PDF, PPT, Word, Excel, ZIP), added ad hoc without fixed global schemas with direct Supabase storage uploads and full-screen image preview lightbox.
- **Project Check-Out / Check-In Ledger**: Track partial quantities checked out to projects, recording source locations and return locations atomically.
- **Low-Stock Alert Dashboard**: Visual in-app dashboard highlighting components falling at or below their low-stock thresholds.
- **Offline Read/Browse (PWA)**: Service Worker + IndexedDB (Dexie.js) + Cache Storage API caching for offline browsing of rooms, photos, hotspots, and inventory lists.
- **Multi-Room Support**: Independent trees for multiple physical rooms with clean list action alignments.
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

- **Room Selector & Room List**: Top-level switcher and room management list with clean vertically centered action controls, room rename, view counts, and delete confirmations.
- **Draggable View Ordering**:
  - The side-photo strip allows drag-and-drop reordering of perspectives.
  - Hover/focus controls offer one-click arrow buttons (`ChevronUp`/`ChevronDown` or `ChevronLeft`/`ChevronRight`).
  - Order persists atomically to Supabase via `reorder_spatial_photos` and syncs to Dexie.
- **Hotspot Drawing Tools**:
  - **Freehand Tool**: Continuous click-and-drag tracing.
  - **Polygon Tool**: Click-each-vertex lasso with automatic closing.
  - **Arrow Tool**: Interactive directional arrow annotation with tail, tip, and width adjust handles for pointing to out-of-frame storage or directional sub-zones.
  - **Reshape Tool (`Crop`)**: Redraw boundaries of existing hotspots while preserving child views and stored items.
  - **Move Tool (`ArrowRightLeft`)**: Transfer a hotspot and its child tree to any other photo/perspective in the room.
  - **Insert Intermediate View**: Splice an intermediate drill-down photo between a parent hotspot and its child view with automatic hierarchy rewiring.
  - **Multi-Level Undo/Redo Engine**: In-memory action history stack (up to 50 operations) to undo/redo hotspot creation, deletion, reshaping, moving, photo replacements, and view insertions.
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
  - **Direct New Item Link**: Pre-selected link to `/inventory/new?locationId=[hotspotId]` for registering and assigning new items directly.
  - **Visual Synchronization**: Opening a compartment drawer activates the bouncing red marker over that compartment on the canvas until dismissed.
- **Hotspot Selection, Deletion & Management**:
  - **Extendable Hotspots Menu & Pinpointing**: To preserve 100% canvas width during edits without cluttering the screen with persistent sidebars, an extendable `Hotspots (X) ▾` dropdown button is positioned directly before the "Delete View" button in the top action bar. Clicking it opens a floating popover listing all hotspots on the active perspective with their type (*Storage Location* vs *Opens into Storage*) and quick `[Delete]` buttons. Clicking any hotspot row immediately highlights and pinpoints that specific hotspot on the canvas with a floating animated location badge (`MapPin` + Hotspot Name).
  - **Canvas Delete Tool**: In "Edit Map" mode, selecting the "Delete Hotspot" tool highlights all hotspots with dashed red outlines and allows clicking directly on any hotspot polygon on the map to delete it with confirmation.
  - **In-Drawer Hotspot Deletion**: In standard view mode, opening any storage location hotspot drawer reveals a trash icon in the header next to the close button for instant deletion.
  - **Recursive Safety**: Deletion unassigns all stored items and recursively purges child drill-down photos via `delete_hotspot_recursive(p_hotspot_id UUID)`.
- **Hotspot Visual Effects & Highlighting**:
  - **Normal / Default**: Soft sky-blue outline (`#7dd3fc`, `0.3` strokeWidth, subtle drop shadow `rgba(125,211,252,0.4)`).
  - **Hovered**: Brightened blue outline (`#38bdf8`, `0.5` strokeWidth) with soft blue tint fill (`rgba(56, 189, 248, 0.35)` and `drop-shadow(0 0 6px rgba(56,189,248,0.75))`).
  - **Arrow Hotspots**: Golden yellow / amber (`#eab308`/`#facc15`, fill `0.45` / `0.70`).
  - **Hover Reveal Tooltip**: Scrolling or hovering the mouse across any hotspot reveals a floating glassmorphism pill showing the hotspot's name and type (*Storage Location* with brand-accent dot vs *Opens into Storage* with amber dot). In Delete mode, the tooltip reveals `Delete "[label]"`. The badge dynamically tracks the cursor with smart edge-clamping ($8\% \le x \le 92\%$) and vertical boundary inversion at the top edge.
  - **Highlighted / Located Compartment**:
    - Pulsing red boundary (`stroke="#ef4444"`, `0.5` strokeWidth, `animate-pulse`, fill `rgba(239, 68, 68, 0.2)`).
    - Centered pulsing target beacon dot (`animate-ping`) with crisp white-bordered red center pin.
    - Floating animated location badge (`MapPin` icon, white text, downward pointer arrow, `animate-bounce duration-1000`).
    - Auto-scroll centering: canvas automatically scrolls to center the highlighted compartment in the viewport.
  - **Delete Mode**: Dashed red stroke (`2,2`) with `rgba(239, 68, 68, 0.22)` fill wash (`0.55` on hover).

### 5.2 Inventory Page & View Toggle

- **Segmented View Switcher**:
  - Pill buttons: **`Components (X)`** vs **`Personal (Y)`**.
  - Dynamic route parameter sync (`/inventory?view=personal`).
  - Contextual header subtitle and dynamic action button (`+ Add Component` vs `+ Add Personal Item`).
- **Contextual Inventory Table**:
  - **Components View**: Img, Component Name, Location, Tags, Quantity, Price (INR), Status (Low Stock Indicator), Actions (Delete & View).
  - **Personal Items View**: Img, Item Name, Location, Description, Tags, Quantity, Actions (Delete & View).
  - **Interactive Location Column**:
    - Displays direct storage location pills with instant "Locate" button.
    - Custom floating glassmorphic tooltip on hover displaying the complete hierarchical storage sequence (`Room → View → Box → Compartment`) with pointer arrow and highlighted target pill.
    - Multi-location popup for items stored in multiple physical bins with individual Locate buttons.
  - **Direct Deletion & Location Safety**: Each item row features a direct delete button. Deletion requires explicit user confirmation. If an item is currently assigned to one or more physical storage locations, direct deletion is blocked and a prompt directs the user to open the edit page (`/inventory/[id]/edit`) to individually remove all location assignments first.
  - Contextual empty states (*"No personal items found."* vs *"No components found."*).

### 5.3 Component & Personal Item Form

- **Category Selector**:
  - Interactive pill toggle at the top of the form allows switching between "Component" and "Personal Item" on the fly.
- **Minimal Form for Personal Items**:
  - Displays: Item Photo, Item Name, Description textarea, Storage Locations, and Tags.
  - Completely hides technical fields: Price, Low-Stock Alert, Datasheet URL, Purchase URL, and Custom Specs Builder.
- **Full Form for Components**:
  - Displays all technical specs, pricing, datasheets, custom specs builder, tags, and locations.
- **Pre-Selected Location Support**:
  - Accepts `locationId` query param (`/inventory/new?locationId=...`) and pre-assigns the selected storage location automatically with full breadcrumb resolution.
- **Bounded Tag Selector**:
  - Searchable tag input with bounded scrollable dropdown (`max-h-56 overflow-y-auto`) and keyboard navigation (`ArrowUp`/`ArrowDown`/`Enter`) preventing screen overflow.
- **Custom Fields Builder**:
  - Supports `text`, `number`, `link`, `image`, and `file` across both components and personal items.
  - **Direct File Attachments (`file` option)**: Directly uploads non-image documents (PDF, PowerPoint `.ppt`/`.pptx`, Word `.doc`/`.docx`, Excel `.xls`/`.xlsx`, `.zip`, `.txt`) to Supabase storage with live upload indicators, formatted file sizes, original filenames, and "Replace" options.
  - **Image Attachments (`image` option)**: Direct upload of graphics and photos with thumbnail previews and full-screen lightbox.
- **Physical Location Picker**:
  - Works identically for both item types: select physical leaf hotspot and specify initial quantity.

### 5.4 Item Detail & Edit Pages

- **Personal Item Presentation**:
  - Distinct gold `"Personal Item"` badge next to title.
  - Clean display: Total Owned, In Storage, and Description notes.
  - Hides empty price, datasheet, and custom specs sections.
  - Storage location card features a **"Locate"** button that navigates directly into the room, drills into the containing perspective photo, opens the compartment side drawer with the components list, and activates the bouncing red marker.
- **Component Presentation**:
  - Full technical resource links, price in INR (`₹`), low stock alert status, custom specs list, and location cards with deep "Locate" button.
  - **Custom Specs Display**: Renders text, numbers, clickable links, image thumbnails, and attached documents (`file` type) with a document icon (`FileText`), filename, and direct `Open ↗` link.
- **Image Preview Lightbox**:
  - Clicking item photo or custom field image opens a full-screen zoomable preview modal.

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
                             Query params: ?locateHotspot=[hotspotId] (deep links to compartment & bounces marker)
/inventory                 → Unified inventory with Components / Personal toggle & search
                             Query params: ?view=components | ?view=personal
/inventory/new             → Add Item Form (Component / Personal Item selector)
                             Query params: ?locationId=[hotspotId] (pre-selects storage location)
/inventory/[componentId]   → Item Detail Page (stats, description/specs, storage locations with deep "Locate")
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
