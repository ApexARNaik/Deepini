import { supabase } from './supabase';
import { db } from './db';

let isSyncing = false;

export async function syncToLocalDB() {
  if (isSyncing || typeof window === 'undefined') return;
  isSyncing = true;
  
  try {
    console.log("Starting background sync to Dexie...");
    
    // Fetch all tables
    const [
      rooms, photos, hotspots, 
      components, tags, compTags, compLocs, 
      projects, projComps, compTotals
    ] = await Promise.all([
      supabase.from('rooms').select('*'),
      supabase.from('spatial_photos').select('*'),
      supabase.from('spatial_hotspots').select('*'),
      supabase.from('components').select('*'),
      supabase.from('tags').select('*'),
      supabase.from('component_tags').select('*'),
      supabase.from('component_locations').select('*'),
      supabase.from('projects').select('*'),
      supabase.from('project_components').select('*'),
      supabase.from('component_totals').select('*')
    ]);

    // Use transaction for bulk put
    await db.transaction('rw', 
      db.rooms, db.spatial_photos, db.spatial_hotspots, 
      db.components, db.tags, db.component_tags, db.component_locations,
      db.projects, db.project_components, db.component_totals,
      async () => {
        if (rooms.data) await db.rooms.bulkPut(rooms.data);
        if (photos.data) await db.spatial_photos.bulkPut(photos.data);
        if (hotspots.data) await db.spatial_hotspots.bulkPut(hotspots.data);
        if (components.data) await db.components.bulkPut(components.data);
        if (tags.data) await db.tags.bulkPut(tags.data);
        if (compTags.data) await db.component_tags.bulkPut(compTags.data);
        if (compLocs.data) await db.component_locations.bulkPut(compLocs.data);
        if (projects.data) await db.projects.bulkPut(projects.data);
        if (projComps.data) await db.project_components.bulkPut(projComps.data);
        if (compTotals.data) await db.component_totals.bulkPut(compTotals.data);
      }
    );
    
    console.log("Background sync to Dexie complete.");
  } catch (err) {
    console.error("Failed to sync to local DB", err);
  } finally {
    isSyncing = false;
  }
}
