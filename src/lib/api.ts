import { supabase } from './supabase'
import imageCompression from 'browser-image-compression'

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
  const { data, error } = await supabase.from("spatial_photos").select("*").eq("room_id", roomId).order("order_index");
  if (error) throw error;
  return data as SpatialPhoto[];
}

export async function getHotspotsForPhoto(photoId: string): Promise<SpatialHotspot[]> {
  const { data, error } = await supabase.from("spatial_hotspots").select("*").eq("photo_id", photoId);
  if (error) throw error;
  return data as SpatialHotspot[];
}

// Phase 4 Functions
export async function getInventory(search: string = ""): Promise<ComponentWithTotals[]> {
  // We'll fetch all components, their tags, and their totals
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
  // get component
  const { data: comp, error: compErr } = await supabase.from("components").select(`*, component_tags(tags(*))`).eq("id", id).single();
  if (compErr) throw compErr;
  
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
      spatial_photos(
        *,
        rooms(*)
      )
    )
  `).eq("component_id", id);
  if (locErr) throw locErr;

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
    if (error) throw error;
    compId = data.id;
  } else {
    const { data, error } = await supabase.from("components").update(componentData).eq("id", compId).select().single();
    if (error) throw error;
  }

  // update tags
  await supabase.from("component_tags").delete().eq("component_id", compId);
  if (tagIds.length > 0) {
    const tagInserts = tagIds.map(tId => ({ component_id: compId, tag_id: tId }));
    await supabase.from("component_tags").insert(tagInserts);
  }

  const { data } = await supabase.from("components").select("*").eq("id", compId).single();
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

import imageCompression from 'browser-image-compression';

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

  return data as SpatialPhoto
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
