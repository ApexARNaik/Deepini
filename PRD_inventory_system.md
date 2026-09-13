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
  coalesce((SELECT sum(l.quantity) FROM loans l
            WHERE l.component_id = c.id AND l.returned_at IS NULL), 0) AS lent_qty,
  coalesce(sum(cl.quantity), 0) + 
  coalesce((SELECT sum(pc.quantity) FROM project_components pc
            WHERE pc.component_id = c.id AND pc.returned_at IS NULL), 0) +
  coalesce((SELECT sum(l.quantity) FROM loans l
            WHERE l.component_id = c.id AND l.returned_at IS NULL), 0) AS total_owned_qty
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
  status (text, default 'planning')     -- 'planning' | 'active' | 'archived' ('completed' status removed)
  location_id (uuid, fk -> spatial_hotspots.id, nullable) -- Required when status = 'archived', references leaf hotspot
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

### 4.4 Loans & Lending System

```
loans
  id (uuid, pk)
  component_id (uuid, fk -> components.id, ON DELETE SET NULL, nullable)
  project_id (uuid, fk -> projects.id, ON DELETE SET NULL, nullable)
  borrower_name (text, not null)
  borrower_contact (text, nullable)
  quantity (int, not null, default 1, check quantity > 0)
  due_date (date, nullable)
  notes (text, nullable)
  lent_at (timestamptz, default now())
  returned_at (timestamptz, nullable)
  source_location_id (uuid, fk -> spatial_hotspots.id, ON DELETE SET NULL, nullable)
  returned_location_id (uuid, fk -> spatial_hotspots.id, ON DELETE SET NULL, nullable)
  -- Snapshot columns to preserve historical records across deletions:
  component_name (text, nullable)
  project_name (text, nullable)
  source_location_label (text, nullable)
  returned_location_label (text, nullable)
```

#### Historical Record Preservation
- Foreign keys specify `ON DELETE SET NULL`.
- When an item or project is lent, immutable text snapshots of `component_name`, `project_name`, `source_location_label`, and `returned_location_label` are stored directly in the loan row.
- If a component or project is later deleted, historical loan records are strictly preserved without cascading deletions or broken references.

#### Origin Location & Atomic Operations
- Loans strictly enforce valid leaf storage locations (`is_leaf = true`) at the database RPC level (`lend_component`, `lend_project`).
- Partial component lending executes with row-level locking (`FOR UPDATE`) to prevent concurrent overdrafts.
- Items may be returned to their original leaf location or a newly selected valid leaf location if the original location was reorganized.

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
  - **Prioritized Relevance Search Engine**:
    - Replaces flat alphabetical search with a 6-tier relevance ranking algorithm:
      1. **Tier 1 (Direct Match in Names)**: Exact match, name starts with query, or word in name starts with query (e.g. searching "es" places "ESP32" and "NodeMCU ESP-12E" at the very top).
      2. **Tier 2 (Direct Match in Tags)**: Exact tag match, tag starts with query, or word in tag starts with query (e.g. tag "ESP32").
      3. **Tier 3 (Direct Match in Notes)**: Notes start with query or word in notes starts with query (e.g. notes starting with "ESD protected").
      4. **Tier 4 (In-Between Match in Names)**: Query appears as a substring inside a word in item name (e.g. searching "es" matches "10k Resistor" and "Resistor Pack").
      5. **Tier 5 (In-Between Match in Tags)**: Query appears as a substring inside a tag name (e.g. tag "Sensors").
      6. **Tier 6 (In-Between Match in Notes)**: Query appears as a substring inside item notes (e.g. notes mentioning "photoresistor").
    - Items within the same tier are sorted naturally using numeric collation.
    - Multi-word search terms evaluate across tokens while preserving exact phrase priority.
    - Applied uniformly across offline IndexedDB search, online Supabase inventory queries, and in-room compartment drawers.
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
  - Accepts `locationId` query param (`/inventory/new?locationId=...`) and pre-assigns the selected storage location automatic- **Bounded Tag Selector**:
  - Searchable tag input with bounded scrollable dropdown (`max-h-56 overflow-y-auto themed-scrollbar`) and keyboard navigation (`ArrowUp`/`ArrowDown`/`Enter`) preventing screen overflow.
- **Custom Fields Builder**:
  - Supports `text`, `number`, `link`, `image`, and `file` across both components and personal items.
  - **Custom Field Type Dropdown**: Replaced native select with an icon-enhanced custom popover menu (`Type`, `Hash`, `ExternalLink`, `ImageIcon`, `Paperclip`) styled in `#191715` with checkmarks and click-outside dismissal.
  - **Direct File Attachments (`file` option)**: Directly uploads non-image documents (PDF, PowerPoint `.ppt`/`.pptx`, Word `.doc`/`.docx`, Excel `.xls`/`.xlsx`, `.zip`, `.txt`) to Supabase storage with live upload indicators, formatted file sizes, original filenames, and "Replace" options.
  - **Image Attachments (`image` option)**: Direct upload of graphics and photos with thumbnail previews and full-screen lightbox.
- **Searchable Physical Location Picker & Sequence Tooltips**:
  - Replaces native OS `<select>` elements with a searchable, custom-styled dropdown with formatted breadcrumb hierarchies (`Room → View → Box → Compartment`), real-time path filtering, assigned location indicators, and full keyboard navigation (`ArrowUp`/`ArrowDown`/`Enter`/`Escape`).
  - **Full-Width Popover Alignment**: Dropdown menu width dynamically matches the exact width of the parent trigger container (`absolute left-0 right-0 top-full mt-1.5 w-full`), eliminating awkward width cutoffs and gaps with adjacent quantity inputs.
  - **Storage Sequence Hover Tooltip**: Hovering over any location option in the dropdown list, assigned location cards, or the trigger selector where long breadcrumb paths are truncated displays a floating glassmorphic tooltip (`#151311/95` background, `#443e38` border, directional pointer arrow, and pulsing destination crumb) revealing the full hierarchical storage sequence. Tooltip positions dynamically with fixed viewport coordinates and auto-dismisses on scroll.

### 5.4 Item Detail & Edit Pages

- **Personal Item Presentation**:
  - Distinct gold `"Personal Item"` badge next to title.
  - Clean display: Total Owned, In Storage, In Projects, Lent Out, and Description notes.
  - Hides empty price, datasheet, and custom specs sections.
  - Storage location card features a **"Locate"** button that navigates directly into the room, drills into the containing perspective photo, opens the compartment side drawer with the components list, and activates the bouncing red marker.
- **Component Presentation**:
  - Full technical resource links, price in INR (`₹`), low stock alert status, custom specs list, and location cards with deep "Locate" button.
  - **Comprehensive Stock Status Breakdown**: Overview grid displaying Total Owned, In Storage, In Projects, Lent Out, Price, and Low Stock Alert threshold.
  - **Custom Specs Display**: Renders text, numbers, clickable links, image thumbnails, and attached documents (`file` type) with a document icon (`FileText`), filename, and direct `Open ↗` link.
- **In-Use & Active Usage Transparency**:
  - Dedicated **"In Projects"** section showing every project (active build or archived build) currently using units of the component.
  - Displays the project name (with direct workspace link), project status badge (`Active Build` vs `Archived Build`), quantity checked out, and **Origin Storage Location** (where the unit was pulled from, with a 1-click `Locate` button to the room map).
  - **1-Click Return to Origin from Component Page**: Active project usage entries feature a direct "Return [qty] to Origin" button (`RotateCcw` icon). Clicking it prompts confirmation and restores the checked-out units atomically to their recorded origin compartment without navigating away to the project workspace. For archived projects, components remain locked in build.
  - For archived projects, additionally displays where the physical build assembly is stored (`Build Stored At`) with a 1-click `Locate` button.
  - Dedicated **"Active Loans"** section displaying borrower details, origin location, and dynamic due date countdowns.
- **Image Preview Lightbox**:
  - Clicking item photo or custom field image opens a full-screen zoomable preview modal.

### 5.5 Projects Check-Out, Lifecycle Phases & Physical Archiving

- Dedicated ledger tracking components pulled into projects and active builds.
- Atomic deduction from `component_locations` upon checkout; atomic return to chosen location upon check-in.
- Supports deferred component deletion (`pending_delete`) when items are currently checked out.
- **Project Lifecycle Phases & State Machine**:
  - **Planning Phase**:
    - Strictly zero components in use.
    - Projects start in Planning phase.
    - Checking out any component automatically transitions the project status to **Active** upon confirmation.
    - A project cannot transition back to Planning if any active component checkouts exist.
  - **Active Phase**:
    - Represents an active development build where components are in use on the workbench.
    - Components cannot be dismantled or checked in unless done through the project workspace.
    - Supports new checkouts and partial/full check-ins.
  - **Archived Phase**:
    - Represents a finished or stored physical build assembly preserved in place.
    - **Strict Atomic Storage Requirement**: The archive transition and `location_id` assignment are atomic. A project cannot transition to `archived` without selecting a valid physical storage location.
    - **Leaf Hotspot Validation**: The storage location must reference a **leaf hotspot** (a physical shelf, bin, box, or compartment), not an intermediate view/room. Enforced at the database level via RPC `archive_project(p_project_id, p_location_id)` and client API validation.
    - **Preserved in Assembly**: All checked-out components remain permanently attached to the archived build and cannot be reused or checked back in while archived. Check-in buttons are disabled/locked in the UI with a "Preserved in Build" status.
    - **Reactivation**: If a user ever wishes to dismantle the build and return components to inventory, they must transition the project status back to **Active** first.
    - **Spatial Navigation**: Archived projects render a prominent Physical Storage Location banner with breadcrumbs and a deep "Locate on Map" button that navigates directly to the room view, centers the viewport, and spotlights the compartment.
  - **Removal of Completed Phase**: The redundant `completed` phase has been removed to maintain unambiguous physical inventory semantics.
- **Project Editing**:
  - Full modal editing of Project Name, Description, Phase, and Physical Storage Location available from both the project cards on `/projects` and the detail workspace on `/projects/[projectId]`.
- **1-Click Return to Origin in Active Projects**:
  - In the "Active Checkouts" ledger on `/projects/[projectId]`, each active checkout card provides a direct **"Return to Origin"** button (`RotateCcw` icon + origin location label) alongside the **"Other Location..."** check-in button.
  - Clicking "Return to Origin" immediately restores the item back to the exact leaf compartment it was originally pulled from, without requiring the user to manually search and select the location from the dropdown.
- **Location Selector in Check-In**: Hierarchical breadcrumb location search with `.themed-scrollbar` when returning to an alternative location.

### 5.6 Offline PWA Support

- Service Worker precaching app shell.
- Full IndexedDB mirror (Dexie.js) of rooms, photos, hotspots, components, and inventory.
- Image caching in Cache Storage API.
- Offline mode provides read-only browsing of spatial maps and inventory, showing an offline banner while disabling write operations.

### 5.7 UI Aesthetics, Unified Dropdown & Custom Form Controls Design System

- **Universal Themed Scrollbars**:
  - Cross-browser custom scrollbar styling (`::-webkit-scrollbar`, `scrollbar-width`, `scrollbar-color`) applied globally across all scrollable containers and dropdowns, eliminating default OS/browser white tracks and silver scrollbars.
  - Slim 6px rounded scrollbar thumb (`#38332d`, hover `#bc7353`) with dark background (`#141211`), plus `.themed-scrollbar` utility for popovers and dropdowns.
- **Zero Native `<select>` Standard**:
  - All select elements throughout the application (Storage Location Picker, Custom Field Type Selector, Project Status Dropdown) are custom-engineered interactive dropdowns adhering strictly to Deepini's dark luxury theme (`#141211` background, `#191715`/`#1a1816` panels, `#3a352e` borders, `#bc7353` copper accent, and gold badges).
- **Consistent Popover Anatomy**:
  - All dropdowns and popovers feature standardized border radiuses (`rounded-md`), deep shadows (`shadow-2xl shadow-black/90 ring-1 ring-black/50`), header status bars, formatted options with icons, active checkmarks, and click-outside dismissal.
- **Universal Themed Number Inputs (`ThemedNumberInput`)**:
  - Replaces default browser/OS spin buttons (which render as jarring white boxes with gray triangles on Windows/Chromium) with a custom, accessible stepper component styled with Deepini's dark luxury tokens (`#191715` background, `#3a352e` borders, and `#bc7353` copper hover accents).
  - Stacked vertical micro-buttons with Lucide `ChevronUp` and `ChevronDown` icons.
  - Global CSS rule (`-webkit-appearance: none`, `-moz-appearance: textfield`) eliminates default browser spin buttons everywhere.
  - Includes continuous stepping on mouse hold (300ms initial delay, 60ms rapid interval), boundary clamping (`min`/`max`), step decimal precision support (e.g. `0.01` for prices), and size presets (`sm`, `md`, `lg`) applied uniformly across location quantity adjusters, pricing, low-stock alerts, custom number fields, check-out quantities, and compartment drawers.
- **Universal Custom Themed Tooltips (`GlobalTooltip` & `Tooltip`)**:
  - Eliminates all default browser/operating system tooltips (such as Windows native high-contrast black boxes with white borders) in favor of a bespoke, dark-luxury styled tooltip system adhering strictly to Deepini's design language.
  - **Visual Design**: Dark charcoal-black backdrop (`#151311`/95 with `backdrop-blur-md`), warm hairline borders (`#443e38`), crisp typography (`font-sans text-xs text-[#f2ede6] font-medium`), micro pointer arrow anchored to target, and subtle shadow (`shadow-2xl shadow-black/90`).
  - **Context-Aware Style Variants**:
    - `default`: Refined dark luxury styling with warm off-white typography and subtle bronze border.
    - `danger`: High-visibility crimson border (`#7f1d1d`), crimson glow (`rgba(239,68,68,0.15)`), and light red text (`#fca5a5`) for destructive actions (e.g. Delete Hotspot, Delete Room, Delete View, Delete Component, Move into descendant blocker).
    - `warning`: Amber accents for caution indicators.
    - `accent`: Deepini copper accent (`#bc7353`) for prominent action hints.
  - **Dynamic Viewport Clamping & Directional Auto-Flipping**: Smart layout engine measuring trigger element position and window boundaries. Automatically flips from top to bottom if close to top viewport edge, and adjusts horizontally to prevent truncation off the viewport edges.
  - **Pointer Micro-Arrow**: Centered arrow triangle aligned with the trigger element while adjusting dynamically when the tooltip is clamped near screen edges.
  - **Zero Browser Title Guarantee (Defense-in-Depth Sanitization)**:
    - Runtime `MutationObserver` actively monitors DOM mutations across the entire document, stripping native `title="..."` attributes and converting them to `data-tooltip="..."` so native OS tooltips can never display.
    - Global `pointerover` event capture intercepts any mouseover on an element with a `title` attribute, migrating it immediately before the browser tooltip timer can fire.
    - Full project scan and systematic conversion of all native HTML `title="..."` to declarative `data-tooltip="..."` and `data-tooltip-variant="..."` attributes.
  - **Interaction Polish**: 120ms debounce delay for comfortable hover scanning without flashing; auto-dismissal on scroll, wheel, escape key, or click.

### 5.8 Lending System, Dynamic Due Notifications & Origin Tracking

- **Component & Project Lending**:
  - Dedicated workflow to lend components (with partial quantities) or entire projects (in Active or Archived phase) to colleagues or friends.
  - Form collects Borrower Name (required), Contact (phone/email), Due Date, Notes, and Origin Location.
- **Mandatory Leaf Origin Location Enforcement**:
  - All loans strictly require selecting a physical leaf storage location where the item/build is retrieved from (`is_leaf = true`).
  - Enforced at both database RPC level (`lend_component`, `lend_project`) and client UI validation.
- **Atomic Partial Component Lending with Row-Level Locking**:
  - `lend_component` RPC locks the source row with `FOR UPDATE`, validates available quantity, decrements stock atomically, and records the loan with text snapshots.
- **Return to Original or New Leaf Location**:
  - Returning a lent item or project defaults to its original leaf location with an `(Original Location)` badge.
  - If the original compartment was deleted or reorganized, users can return the item to any other valid leaf hotspot.
- **Dynamic In-App Notifications (Zero Persistent DB Rows)**:
  - Notifications are generated in-memory on the fly by comparing `due_date` with the current local calendar day.
  - **Due Tomorrow ($\Delta = 1$)**: High-visibility amber alert notifying the user 1 day before the return date.
  - **Due Today ($\Delta = 0$)**: Orange alert for loans due today.
  - **Overdue ($\Delta < 0$)**: Red urgent alert showing elapsed days overdue.
  - Integrated into the desktop and mobile header `Bell` icon with an interactive `NotificationCenter` popover and quick "Return" action.
- **Dedicated Loans Workspace (`/loans`)**:
  - First-class navigation link in sidebar.
  - Tabbed filtering for Active Loans vs Full Loan History.
  - Filter pills for All, Components, Projects, and Due Soon/Overdue.
  - Global Quick Lend modal and 1-click Return modals.
- **Integration with Safe Deletion**:
  - `delete_component_safe` and client fallbacks check both active project checkouts and active loans before deleting. If active loans exist, deletion is deferred with `pending_delete = true`.

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
/loans                     → Loans workspace (active loans, historical ledger, filters, quick lend)
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
6. **Database Permissions & RLS**: As a single-user personal system without Supabase Auth, all tables operate with Row Level Security (RLS) disabled (`DISABLE ROW LEVEL SECURITY`) and grants to `anon`, `authenticated`, and `service_role`.
