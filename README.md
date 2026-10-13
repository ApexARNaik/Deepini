# Deepini — Personal Hardware Component Inventory & Spatial Tracking System

Deepini is a personal inventory and spatial tracking web application built for makers, hardware engineers, and workshop owners. It provides two tightly coupled perspectives on your gear:

1. **A Spatial Photographic Hierarchy**: An interactive, multi-level photo map of your physical rooms, walls, cupboards, shelves, drawers, and bins. Draw polygon or freehand hotspots directly over photos to navigate deeper or assign physical storage.
2. **A Unified Logical Inventory**: A searchable, filterable list of all items across your workshop with an instant toggle between **Components** and **Personal Items**.

---

## Key Features

### 1. Photographic Spatial Map ("Room View")
- **Hierarchical Drill-Down**: Create unbounded nested levels (`Room → View/Wall → Furniture → Shelf → Drawer → Container`).
- **Deep "Locate" Navigation & Bouncing Pin**: Clicking "Locate" from any component page or inventory table row navigates directly to the target room and perspective, automatically opens the compartment drawer with stored items, centers the viewport, and spotlights the physical location with an animated bouncing red marker (`MapPin` badge, pulsing target beacon dot, and pulsing red boundary).
- **Multi-Tool Hotspot Annotation**: Annotate storage containers using continuous freehand tracing, click-each-vertex polygonal lasso, or directional arrow annotations with adjustable tail, tip, and width handles.
- **Reshape, Move & Intermediate Views**: Redraw boundaries of existing hotspots, move hotspots between perspective views, and insert intermediate drill-down photos into existing hierarchies without losing data.
- **Multi-Level Undo/Redo Engine**: In-memory action history stack (up to 50 operations) supporting instant rollback of hotspot creation, deletion, reshaping, moving, photo replacements, and view insertions.
- **Draggable View Reordering**: Drag and drop perspectives or use one-click arrow buttons to reorder views with permanent database persistence.
- **Direct Hotspot Contents Drawer**: Click any storage location to view stored items, adjust quantities with an inline stepper, or directly search and add components/belongings with a single click.
- **Hotspot Deletion & Extendable Menu**: Delete individual hotspots via the canvas Delete tool, in-drawer header button, or via an extendable `Hotspots (X)` popover placed before "Delete View", keeping 100% canvas width available during edits.

### 2. Dual Item Model & Modern Inventory Experience
- **Components**: Designed for technical electronics items with purchase sources, datasheet URLs, price in INR (`₹`), low-stock thresholds, and custom specs.
- **Personal Items**: Streamlined model for tools, equipment, stationery, and belongings. Requires only Name, Description, Photo, Storage Locations, and Tags.
- **Interactive Location Column**: Inventory table features direct location pills with one-click "Locate" buttons and custom floating glassmorphic tooltips displaying the complete hierarchical storage sequence (`Room → View → Box → Compartment`).
- **Pre-Selected Location Assignment**: Creating an item directly from a compartment drawer automatically passes and pre-assigns the location on `/inventory/new`.
- **Searchable Location & Tag Pickers**: Replaced native browser selects with a custom searchable location dropdown featuring real-time path filtering, breadcrumbs, assigned status, full-width container alignment, and floating storage sequence hover tooltips displaying complete hierarchical paths (`Room → View → Box → Compartment`), alongside bounded tag selectors with keyboard navigation (`ArrowUp`/`ArrowDown`/`Enter`/`Escape`).
- **Custom Fields & File Attachments**: Attach custom text, numbers, links, images, and document files (PDFs, PPT, Word, Excel, ZIP) directly to items with cloud storage, custom icon-enhanced field type dropdowns, and a full-screen image preview lightbox.
- **Prioritized Relevance Search**: Six-tier relevance ranking prioritizes direct matches in item names first, then direct matches in tags, direct matches in notes, followed by in-between substring matches in names, tags, and notes (e.g. searching "es" places "ESP32" before "Resistors", and "Resistors" before items with notes mentioning "photoresistors").
- **Inventory Page Toggle**: Fast switcher between `Components (X)` and `Personal (Y)` with tailored table columns and context-aware action buttons.
- **Component In-Use Transparency & Direct Return**: Component detail pages feature an "In Projects" workspace detailing every active build and archived build using the component, quantities in use, the original compartment it was taken from with a 1-click "Locate Origin" map button, a direct 1-click **"Return to Origin"** button to restore checked-out units back to inventory immediately, and the archived build location with a "Locate Build" map button.
- **Physical Tracking Parity**: Personal items are tracked across the exact same spatial hierarchy as components, featuring full "Locate" button spotlighting.

### 3. Projects Check-Out, Lifecycle Phases & Physical Archiving
- **Full Project Editing**: Edit project names, descriptions, and phases from both project cards and the project detail workspace.
- **Strict Lifecycle State Machine**:
  - **Planning Phase**: Strictly zero components in use. Projects start here; checking out any component automatically transitions the project to **Active**. Cannot return to Planning while active checkouts remain.
  - **Active Phase**: Active development build. Components are checked out from inventory locations and in active use.
  - **Archived Phase**: Represents a finished physical build assembly preserved in place.
    - **Atomic Leaf Hotspot Assignment**: Archiving and physical location assignment are atomic; projects cannot be archived without referencing a valid leaf hotspot. Enforced via database RPC `archive_project` and API validation.
    - **Preserved in Build**: Components remain locked in the assembly and cannot be dismantled or checked in while archived. Reactivating to Active is required to dismantle.
    - **Spatial Navigation**: Dedicated location banner on the project page with a "Locate on Map" button linking directly into the room view with target spotlighting.
  - *(The redundant `completed` phase has been removed).*
- **1-Click Return to Origin & Custom Check-In**: Active checkouts feature a direct 1-click **"Return to Origin"** button that immediately returns components to their recorded origin location, alongside an **"Other Location..."** button with hierarchical breadcrumb location search.
- Deferred component deletion (`pending_delete`) prevents data loss when items are checked out.

### 4. Lending System, Dynamic Due Notifications & Origin Tracking
- **Lend Components & Projects**: Lend items or assembled projects with borrower name, contact details, notes, and expected return due dates.
- **Strict Leaf Origin Tracking**: Mandatory assignment and recording of physical leaf storage locations (`is_leaf = true`) where items are pulled from, enforced at the database RPC and UI levels.
- **Atomic Partial Quantity Lending**: Database RPC `lend_component` executes with row-level locking (`FOR UPDATE`) and stock validation to prevent overdrafts.
- **Return to Original or Reorganized Location**: Returning defaulted to original location with badge, with ability to return to any valid leaf hotspot.
- **Dynamic In-App Notifications**: Derives Due Tomorrow (1-day advance warning), Due Today, and Overdue alerts completely in-memory on the fly with zero persistent database notification records. Features interactive `NotificationCenter` popover directly in the app shell.
- **Historical Record Preservation**: Foreign keys configured with `ON DELETE SET NULL` alongside immutable text snapshot columns (`component_name`, `project_name`, `source_location_label`, `returned_location_label`), ensuring full historical loan logs are never lost when components or projects are deleted.
- **First-Class Loans Workspace (`/loans`)**: Full search, filtering (Active vs History, Components vs Projects, Due Soon/Overdue), and 1-click Return modals.

### 5. UI Aesthetics, Form Controls & Themed Scrollbars
- **Universal Themed Scrollbars**: Universal cross-browser scrollbar styling replacing default Windows white tracks with sleek dark bronze/copper indicators.
- **Zero Native `<select>` Policy**: Every dropdown is an accessible, theme-unified component matching `#141211` background, `#191715` panels, and `#bc7353` copper accents.
- **Custom Themed Up/Down Steppers (`ThemedNumberInput`)**: Universal replacement of browser/OS number input spin buttons with sleek dark-themed stacked arrow buttons (`ChevronUp`/`ChevronDown`), eliminating white OS boxes on Windows and providing smooth click-and-hold continuous stepping across all quantity, price, alert, and custom number inputs.
- **Universal Custom Themed Tooltips (`GlobalTooltip`)**: Replaces default OS/browser tooltips (such as Windows native white-bordered boxes) with a bespoke, dark-luxury styled tooltip system (`#151311`/95 backdrop with blur, `#443e38` warm border, off-white typography, anchored micro pointer arrow, and dynamic boundary clamping with auto-flipping). Includes semantic style variants (e.g. `danger` with red border and crimson glow for delete operations), 120ms debounce timing, and runtime defense-in-depth sanitization preventing native `title` tooltips from ever rendering.

### 6. Offline-Ready PWA
- Service Worker precaching app shell assets.
- Complete IndexedDB mirror (Dexie.js) of rooms, photos, hotspots, and inventory items.
- Offline read-only browsing of rooms, images, and inventory lists.

### 7. Shared Password Gate
- Client-side session password gate protecting the entire application without requiring user accounts or multi-tenant complexity.

---

## Tech Stack

- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/) with Turbopack & TypeScript
- **Styling**: Tailwind CSS & Lucide Icons
- **Database & Storage**: [Supabase](https://supabase.com/) (PostgreSQL & Object Storage)
- **Offline / PWA**: `@serwist/next`, Dexie.js (IndexedDB), and Cache Storage API
- **Image Compression**: `browser-image-compression`

---

## Getting Started

### 1. Prerequisites
- Node.js 18.17+ or 20+
- npm, pnpm, or yarn
- A free [Supabase](https://supabase.com) project

### 2. Environment Variables
Create a `.env.local` file in the root directory:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_APP_PASSWORD=Pass123
```

### 3. Database Setup (Supabase)
Run the migration scripts in the Supabase SQL Editor:
1. `supabase/migrations/001_safe_schema_and_rpcs.sql`: Master consolidated schema, views, and atomic RPCs.
2. `supabase/migrations/002_reorder_spatial_photos.sql`: Atomic view reordering RPC function.
3. `supabase/migrations/003_add_item_type_to_components.sql`: Adds `item_type` column to `components`.
4. `supabase/migrations/004_add_delete_hotspot_rpc.sql`: Recursive hotspot deletion RPC.
5. `supabase/migrations/010_add_project_location_and_archive_rpc.sql`: Adds `location_id` column to projects and atomic `archive_project` RPC with leaf hotspot validation.
6. `supabase/migrations/011_add_loans_and_lending_system.sql`: Adds `loans` table, atomic lending RPCs (`lend_component`, `return_lent_component`, `lend_project`, `return_lent_project`), safe component deletion integration, and updated `component_totals` view.

*(Note: The application also includes client-side fallbacks, ensuring continuous operation even before remote database migrations are executed. Deepini is designed as a single-user system using a lightweight password gate, so tables operate with Row Level Security (RLS) disabled. Migration 011 explicitly includes `DISABLE ROW LEVEL SECURITY` and grants to `anon`.)*

### 4. Installation & Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Enter your password (default: `Pass123`) to enter the app.

### 5. Production Build

```bash
npm run build
npm run start
```

---

## Automated Database Backups

Deepini includes a scheduled GitHub Actions workflow (`.github/workflows/monthly-backup.yml`) that automatically backs up your entire Supabase PostgreSQL database on the **1st of every month** at 00:00 UTC (and can also be triggered manually anytime).

### Setup Instructions:
1. **Find your Supabase Connection String**:
   - Go to your [Supabase Dashboard](https://supabase.com/dashboard) → **Project Settings** → **Database**.
   - Under **Connection string**, select **URI** (looks like `postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`).
2. **Add the Secret to GitHub**:
   - In your GitHub repository, go to **Settings** → **Secrets and variables** → **Actions**.
   - Click **New repository secret**.
   - Name: `SUPABASE_DB_URL`
   - Value: Paste your Supabase URI (make sure your actual database password is included in place of `[YOUR-PASSWORD]`).
3. **Run or View Backups**:
   - Backups execute automatically on the 1st of every month.
   - To run a backup on-demand: Go to **Actions** → **Monthly Database Backup** → **Run workflow**.
   - Each backup generates:
     - A permanent **GitHub Release** tagged `backup-YYYY-MM-DD` containing the compressed `.sql.gz` dump.
     - A downloadable workflow **Artifact** (retained for 90 days).

### How to Restore from a Backup:
```bash
# Decompress and restore to your Supabase database:
gunzip -c deepini-backup-YYYY-MM-DD.sql.gz | psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"
```

---

## License
MIT License. Created for personal workshop and inventory tracking.
