import { supabase } from './supabase'
import imageCompression from 'browser-image-compression'
import { db } from './db'

export type Room = {
  id: string
  name: string
  order_index: number
}

export type SpatialPhoto = {
  id: string
  room_id: string
  parent_hotspot_id: string | null
  image_url: string
  label: string | null
}

export interface SpatialHotspot {
  id: string;
  photo_id: string;
  label: string;
  shape_points: { x: number; y: number }[];
  is_leaf: boolean;
  child_photo_id: string | null;
}

export interface Component {
  id: string;
  name: string;
  photo_url?: string;
  price?: number;
  purchase_source?: string;
  datasheet_link?: string;
  low_stock_threshold?: number;
  notes?: string;
  pending_delete: boolean;
  custom_fields: Record<string, { type: 'text' | 'number' | 'link' | 'image'; value: any }>;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  name: string;
  usage_count: number;
}

export interface ComponentTotals {
  component_id: string;
  in_storage_qty: number;
  checked_out_qty: number;
  total_owned_qty: number;
}

export interface ComponentWithTotals extends Component {
  totals: ComponentTotals;
  tags: Tag[];
}

export interface ComponentLocation {
  id: string;
  component_id: string;
  hotspot_id: string;
  quantity: number;
  hotspot?: SpatialHotspot;
  photo?: SpatialPhoto;
  room?: Room;
}

export async function getRooms(): Promise<Room[]> {
  if (typeof window !== 'undefined' && !navigator.onLine) {
    return await db.rooms.orderBy('order_index').toArray();
  }
  const { data, error } = await supabase.from("rooms").select("*").order("order_index");
  if (error) throw error;
  return data as Room[];
}

export async function createRoom(name: string): Promise<Room> {
  const { data, error } = await supabase.from("rooms").insert([{ name }]).select().single();
  if (error) throw error;
  return data as Room;
}

export async function getPhotosForRoom(roomId: string): Promise<SpatialPhoto[]> {
  if (typeof window !== 'undefined' && !navigator.onLine) {
    return (await db.spatial_photos.where('room_id').equals(roomId).toArray());
  }
  const { data, error } = await supabase.from("spatial_photos").select("*").eq("room_id", roomId).order("order_index");
  if (error) throw error;
  return data as SpatialPhoto[];
}

export async function getHotspotsForPhoto(photoId: string): Promise<SpatialHotspot[]> {
  if (typeof window !== 'undefined' && !navigator.onLine) {
    return await db.spatial_hotspots.where('photo_id').equals(photoId).toArray();
  }
  const { data, error } = await supabase.from("spatial_hotspots").select("*").eq("photo_id", photoId);
  if (error) throw error;
  return data as SpatialHotspot[];
}

// Phase 4 Functions
export async function getInventory(search: string = ""): Promise<ComponentWithTotals[]> {
  if (typeof window !== 'undefined' && !navigator.onLine) {
    const allComps = await db.components.toArray();
    const allTotals = await db.component_totals.toArray();
    const allTags = await db.tags.toArray();
    const allCompTags = await db.component_tags.toArray();

    const totalsMap = new Map(allTotals.map(t => [t.component_id, t]));
    const tagMap = new Map(allTags.map(t => [t.id, t]));

    let results = allComps.filter(c => !c.pending_delete);
    
    if (search) {
      const s = search.toLowerCase();
      results = results.filter(c => c.name.toLowerCase().includes(s) || (c.notes && c.notes.toLowerCase().includes(s)));
    }

    return results.map(c => {
      const cTags = allCompTags.filter(ct => ct.component_id === c.id).map(ct => tagMap.get(ct.tag_id)).filter(Boolean) as Tag[];
      return {
        ...c,
        tags: cTags,
        totals: totalsMap.get(c.id) || { component_id: c.id, in_storage_qty: 0, checked_out_qty: 0, total_owned_qty: 0 }
      }
    }).sort((a, b) => a.name.localeCompare(b.name));
  }

  let query = supabase.from("components").select(`
    *,
    component_tags(tags(*))
  `).eq("pending_delete", false).order("name");

  if (search) {
    query = query.or(`name.ilike.%${search}%,notes.ilike.%${search}%`);
  }

  const { data: compData, error: compErr } = await query;
  if (compErr) throw compErr;

  const { data: totalsData, error: totErr } = await supabase.from("component_totals").select("*");
  if (totErr) throw totErr;

  const totalsMap = new Map(totalsData.map(t => [t.component_id, t]));

  return compData.map(c => ({
    ...c,
    tags: c.component_tags.map((ct: any) => ct.tags).filter(Boolean),
    totals: totalsMap.get(c.id) || { component_id: c.id, in_storage_qty: 0, checked_out_qty: 0, total_owned_qty: 0 }
  }));
}

export async function getLowStock(): Promise<ComponentWithTotals[]> {
  const all = await getInventory();
  return all.filter(c => (c.low_stock_threshold !== null && c.low_stock_threshold !== undefined) && c.totals.total_owned_qty <= c.low_stock_threshold);
}

export async function getTags(): Promise<Tag[]> {
  const { data, error } = await supabase.from("tags").select("*").order("usage_count", { ascending: false });
  if (error) throw error;
  return data as Tag[];
}

export async function upsertTag(name: string): Promise<Tag> {
  // check if exists
  const { data: existing } = await supabase.from("tags").select("*").eq("name", name).single();
  if (existing) return existing;
  const { data, error } = await supabase.from("tags").insert([{ name }]).select().single();
  if (error) throw error;
  return data as Tag;
}

export async function getComponentDetails(id: string): Promise<{ component: ComponentWithTotals, locations: ComponentLocation[] }> {
  if (typeof window !== 'undefined' && !navigator.onLine) {
    const comp = await db.components.get(id);
    if (!comp) throw new Error("Component not found");
    const totals = await db.component_totals.get(id) || { component_id: id, in_storage_qty: 0, checked_out_qty: 0, total_owned_qty: 0 };
    
    const cTags = await db.component_tags.where('component_id').equals(id).toArray();
    const tags = await Promise.all(cTags.map(ct => db.tags.get(ct.tag_id)));
    
    const component: ComponentWithTotals = {
      ...comp,
      tags: tags.filter(Boolean) as Tag[],
      totals
    };

    const locs = await db.component_locations.where('component_id').equals(id).toArray();
    const locations = await Promise.all(locs.map(async l => {
      const hotspot = await db.spatial_hotspots.get(l.hotspot_id);
      const photo = hotspot ? await db.spatial_photos.get(hotspot.photo_id) : undefined;
      const room = photo ? await db.rooms.get(photo.room_id) : undefined;
      return { ...l, hotspot, photo, room };
    }));

    return { component, locations };
  }

  // get component
  const { data: comp, error: compErr } = await supabase.from("components").select(`*, component_tags(tags(*))`).eq("id", id).single();
  if (compErr) throw new Error(compErr.message || "Failed to fetch component");
  
  const { data: totalsData } = await supabase.from("component_totals").select("*").eq("component_id", id).single();
  
  const component: ComponentWithTotals = {
    ...comp,
    tags: comp.component_tags.map((ct: any) => ct.tags).filter(Boolean),
    totals: totalsData || { component_id: id, in_storage_qty: 0, checked_out_qty: 0, total_owned_qty: 0 }
  };

  // get locations
  const { data: locs, error: locErr } = await supabase.from("component_locations").select(`
    *,
    spatial_hotspots(
      *,
      spatial_photos!spatial_hotspots_photo_id_fkey(
        *,
        rooms(*)
      )
    )
  `).eq("component_id", id);
  if (locErr) throw new Error(locErr.message || "Failed to fetch component locations");

  const locations = locs.map((l: any) => ({
    id: l.id,
    component_id: l.component_id,
    hotspot_id: l.hotspot_id,
    quantity: l.quantity,
    hotspot: l.spatial_hotspots,
    photo: l.spatial_hotspots?.spatial_photos,
    room: l.spatial_hotspots?.spatial_photos?.rooms
  }));

  return { component, locations };
}

export async function upsertComponent(
  componentData: Partial<Component>,
  tagIds: string[]
): Promise<Component> {
  let compId = componentData.id;
  if (!compId) {
    const { data, error } = await supabase.from("components").insert([componentData]).select().single();
    if (error) {
      console.error("Insert Error in upsertComponent:", error);
      throw new Error(error.message || "Failed to insert component");
    }
    compId = data.id;
  } else {
    const { data, error } = await supabase.from("components").update(componentData).eq("id", compId).select().single();
    if (error) {
      console.error("Update Error in upsertComponent:", error);
      throw new Error(error.message || "Failed to update component");
    }
  }

  // update tags
  await supabase.from("component_tags").delete().eq("component_id", compId);
  if (tagIds.length > 0) {
    const tagInserts = tagIds.map(tId => ({ component_id: compId, tag_id: tId }));
    const { error: tagErr } = await supabase.from("component_tags").insert(tagInserts);
    if (tagErr) {
      console.error("Tag Insert Error in upsertComponent:", tagErr);
      throw new Error(tagErr.message || "Failed to insert tags");
    }
  }

  const { data, error: selErr } = await supabase.from("components").select("*").eq("id", compId).single();
  if (selErr) throw new Error(selErr.message || "Failed to fetch inserted component");
  return data;
}

export async function getHotspotBreadcrumbPath(hotspotId: string): Promise<{ id: string, label: string }[]> {
  const path: { id: string, label: string }[] = [];
  return path;
}

export async function getFullHotspotPath(hotspotId: string) {
  // Recursive fetch to root
  const chain: { type: 'photo' | 'hotspot', id: string, label: string }[] = [];
  let currentHotspotId: string | null = hotspotId;

  while (currentHotspotId) {
    const { data: hs }: any = await supabase.from("spatial_hotspots").select("*").eq("id", currentHotspotId).single();
    if (!hs) break;
    chain.unshift({ type: 'hotspot', id: hs.id, label: hs.label });
    
    const { data: photo }: any = await supabase.from("spatial_photos").select("*").eq("id", hs.photo_id).single();
    if (!photo) break;
    chain.unshift({ type: 'photo', id: photo.id, label: photo.label || 'Perspective' });
    
    currentHotspotId = photo.parent_hotspot_id;
  }
  return chain;
}


export async function uploadImage(file: File, pathPrefix: string): Promise<string> {
  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    fileType: 'image/webp' as const
  };
  const compressedFile = await imageCompression(file, options);
  
  const fileName = `${pathPrefix}_${Date.now()}_${crypto.randomUUID()}.webp`;
  
  const { error: uploadError } = await supabase.storage.from('images').upload(fileName, compressedFile);
  if (uploadError) throw uploadError;
  
  const { data } = supabase.storage.from('images').getPublicUrl(fileName);
  return data.publicUrl;
}

export async function uploadPhotoAndCreate(file: File, roomId: string, parentHotspotId: string | null = null, label: string = 'Perspective') {
  const publicUrl = await uploadImage(file, 'media');
  
  // Create DB record
  const { data: photoData, error: dbError } = await supabase.from('spatial_photos').insert([
    {
      room_id: roomId,
      image_url: publicUrl,
      parent_hotspot_id: parentHotspotId,
      label
    }
  ]).select().single();
  
  if (dbError) throw dbError;

  // If this was for a drill-down hotspot, update the hotspot's child_photo_id
  if (parentHotspotId) {
    const { error: updateError } = await supabase.from('spatial_hotspots')
      .update({ child_photo_id: photoData.id })
      .eq('id', parentHotspotId)
    if (updateError) throw updateError
  }

  return photoData as SpatialPhoto
}

export async function createHotspot(
  photoId: string, 
  label: string, 
  shapePoints: { x: number; y: number }[], 
  isLeaf: boolean
) {
  const { data, error } = await supabase.from('spatial_hotspots').insert([{
    photo_id: photoId,
    label,
    shape_points: shapePoints,
    is_leaf: isLeaf
  }]).select().single()

  if (error) throw error
  return data as SpatialHotspot
}

export interface Project {
  id: string;
  name: string;
  status: 'planning' | 'active' | 'completed';
  description: string | null;
  created_at: string;
}

export interface ProjectComponent {
  id: string;
  project_id: string;
  component_id: string;
  source_location_id: string;
  quantity: number;
  checked_out_at: string;
  returned_at: string | null;
  returned_location_id: string | null;
  component?: Component;
  source_hotspot?: SpatialHotspot;
}

export async function getProjects(): Promise<(Project & { active_count: number })[]> {
  if (typeof window !== 'undefined' && !navigator.onLine) {
    const allProj = await db.projects.orderBy('created_at').reverse().toArray();
    const allProjComps = await db.project_components.toArray();
    return allProj.map(p => {
      const active = allProjComps.filter(pc => pc.project_id === p.id && !pc.returned_at).reduce((acc, pc) => acc + pc.quantity, 0);
      return { ...p, active_count: active };
    });
  }

  const { data, error } = await supabase.from('projects').select('*, project_components(quantity, returned_at)').order('created_at', { ascending: false });
  if (error) throw error;
  
  return data.map(p => {
    const active = p.project_components.filter((pc: any) => !pc.returned_at).reduce((acc: number, pc: any) => acc + pc.quantity, 0);
    return { ...p, active_count: active };
  });
}

export async function createProject(name: string, description: string = ''): Promise<Project> {
  const { data, error } = await supabase.from('projects').insert([{ name, description, status: 'planning' }]).select().single();
  if (error) throw error;
  return data;
}

export async function updateProjectStatus(id: string, status: 'planning' | 'active' | 'completed'): Promise<Project> {
  const { data, error } = await supabase.from('projects').update({ status }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function getProjectDetails(id: string): Promise<{ project: Project, items: ProjectComponent[] }> {
  if (typeof window !== 'undefined' && !navigator.onLine) {
    const project = await db.projects.get(id);
    if (!project) throw new Error("Project not found");
    const rawItems = await db.project_components.where('project_id').equals(id).toArray();
    const items = await Promise.all(rawItems.map(async pc => {
      const component = await db.components.get(pc.component_id);
      const source_hotspot = await db.spatial_hotspots.get(pc.source_location_id);
      return { ...pc, component, source_hotspot };
    }));
    items.sort((a, b) => new Date(b.checked_out_at).getTime() - new Date(a.checked_out_at).getTime());
    return { project, items };
  }

  const { data: project, error } = await supabase.from('projects').select('*').eq('id', id).single();
  if (error) throw error;
  
  const { data: items, error: itemsErr } = await supabase.from('project_components').select('*, component:components(*), source_hotspot:spatial_hotspots!project_components_source_location_id_fkey(*)').eq('project_id', id).order('checked_out_at', { ascending: false });
  if (itemsErr) throw itemsErr;
  
  return { project, items };
}

export async function checkoutComponent(projectId: string, componentId: string, sourceLocationId: string, quantity: number): Promise<void> {
  const { error } = await supabase.rpc('checkout_component', {
    p_project_id: projectId,
    p_component_id: componentId,
    p_source_location_id: sourceLocationId,
    p_quantity: quantity
  });
  if (error) throw error;
}

export async function checkinComponent(projectComponentId: string, returnLocationId: string): Promise<void> {
  const { error } = await supabase.rpc('checkin_component', {
    p_project_component_id: projectComponentId,
    p_return_location_id: returnLocationId
  });
  if (error) throw error;
}

export async function deleteComponent(id: string): Promise<void> {
  const { count, error: countErr } = await supabase.from('project_components').select('*', { count: 'exact', head: true }).eq('component_id', id).is('returned_at', null);
  if (countErr) throw countErr;
  
  if (count === 0) {
    // Hard delete
    const { error } = await supabase.from('components').delete().eq('id', id);
    if (error) throw error;
  } else {
    // Soft delete
    const { error: locErr } = await supabase.from('component_locations').delete().eq('component_id', id);
    if (locErr) throw locErr;
    
    const { error: compErr } = await supabase.from('components').update({ pending_delete: true }).eq('id', id);
    if (compErr) throw compErr;
  }
}

export async function searchLeafHotspots(query: string = ""): Promise<{ id: string, pathLabel: string }[]> {
  let roomsData, photosData, hotspotsData;
  if (typeof window !== 'undefined' && !navigator.onLine) {
    roomsData = await db.rooms.toArray();
    photosData = await db.spatial_photos.toArray();
    hotspotsData = await db.spatial_hotspots.toArray();
  } else {
    const [rooms, photos, hotspots] = await Promise.all([
      supabase.from('rooms').select('*'),
      supabase.from('spatial_photos').select('*'),
      supabase.from('spatial_hotspots').select('*')
    ]);
    if (rooms.error || photos.error || hotspots.error) throw new Error("Failed to fetch spatial data for search");
    roomsData = rooms.data;
    photosData = photos.data;
    hotspotsData = hotspots.data;
  }
  
  const roomMap = new Map(roomsData.map(r => [r.id, r]));
  const photoMap = new Map(photosData.map(p => [p.id, p]));
  const hotspotMap = new Map(hotspotsData.map(h => [h.id, h]));
  
  const leaves = hotspotsData.filter(h => h.is_leaf);
  const results = [];
  
  for (const leaf of leaves) {
    let path = [leaf.label];
    let currentPhotoId = leaf.photo_id;
    
    while (currentPhotoId) {
      const p = photoMap.get(currentPhotoId);
      if (!p) break;
      path.unshift(p.label || 'Perspective');
      
      if (p.parent_hotspot_id) {
        const hs = hotspotMap.get(p.parent_hotspot_id);
        if (hs) {
          path.unshift(hs.label);
          currentPhotoId = hs.photo_id;
        } else {
          break;
        }
      } else {
        const r = roomMap.get(p.room_id);
        if (r) path.unshift(r.name);
        break;
      }
    }
    
    const pathStr = path.join(" > ");
    if (!query || pathStr.toLowerCase().includes(query.toLowerCase())) {
      results.push({ id: leaf.id, pathLabel: pathStr });
    }
  }
  
  return results.slice(0, 50); // limit
}
