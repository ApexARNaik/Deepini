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
- **Bounded Tag Selector**: Clean searchable tag input with a bounded scrollable dropdown and keyboard navigation (`ArrowUp`/`ArrowDown`/`Enter`) preventing screen overflow.
- **Custom Fields & File Attachments**: Attach custom text, numbers, links, images, and document files (PDFs, PPT, Word, Excel, ZIP) directly to items with cloud storage and a full-screen image preview lightbox.
- **Inventory Page Toggle**: Fast switcher between `Components (X)` and `Personal (Y)` with tailored table columns and context-aware action buttons.
- **Physical Tracking Parity**: Personal items are tracked across the exact same spatial hierarchy as components, featuring full "Locate" button spotlighting.

### 3. Projects Check-Out & Check-In Ledger
- Pull components into active projects while tracking their source locations.
- Check items back in to their original or newly chosen locations.
- Deferred component deletion (`pending_delete`) prevents data loss when items are checked out.

### 4. Offline-Ready PWA
- Service Worker precaching app shell assets.
- Complete IndexedDB mirror (Dexie.js) of rooms, photos, hotspots, and inventory items.
- Offline read-only browsing of rooms, images, and inventory lists.

### 5. Shared Password Gate
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

*(Note: The application also includes client-side fallbacks, ensuring continuous operation even before remote database migrations are executed.)*

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

## License
MIT License. Created for personal workshop and inventory tracking.
