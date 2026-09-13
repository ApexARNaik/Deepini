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
  order_index: number
  created_at?: string
  updated_at?: string
}

export interface SpatialHotspot {
  id: string;
  photo_id: string;
  label: string;
  shape_points: { x: number; y: number }[];
  is_leaf: boolean;
  child_photo_id: string | null;
  created_at?: string;
  updated_at?: string;
}

export type CustomField = { type: 'text' | 'number' | 'link' | 'image'; value: any };

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
  custom_fields: Record<string, any>;
  item_type?: 'component' | 'personal';
  created_at: string;
  updated_at: string;
}

export function isPersonalItem(item: any): boolean {
  if (!item) return false;
  if (item.item_type === 'personal') return true;
  if (item.custom_fields && item.custom_fields.item_type === 'personal') return true;
  if (item.custom_fields && item.custom_fields.item_type?.value === 'personal') return true;
  if (item.tags && Array.isArray(item.tags) && item.tags.some((t: any) => t.name?.toLowerCase() === 'personal')) return true;
  return false;
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

export interface ComponentLocationSummary {
  id: string;
  hotspot_id: string;
  quantity: number;
  label?: string;
  fullLabel?: string;
  room_id?: string;
  room_name?: string;
}

export interface ComponentWithTotals extends Component {
  totals: ComponentTotals;
  tags: Tag[];
  locations?: ComponentLocationSummary[];
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

export async function getRoom(id: string): Promise<Room> {
  if (typeof window !== 'undefined' && !navigator.onLine) {
    const room = await db.rooms.get(id);
    if (!room) throw new Error("Room not found");
    return room;
  }
  const { data, error } = await supabase.from("rooms").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Room;
}

export async function updateRoom(id: string, name: string): Promise<Room> {
  const { data, error } = await supabase
    .from("rooms")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Room;
}

export async function getPhotosForRoom(roomId: string): Promise<SpatialPhoto[]> {
  if (typeof window !== 'undefined' && !navigator.onLine) {
    const photos = await db.spatial_photos.where('room_id').equals(roomId).toArray();
    return photos.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0) || new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime());
  }
  const { data, error } = await supabase
    .from("spatial_photos")
    .select("*")
    .eq("room_id", roomId)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });
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

export async function getHotspotById(hotspotId: string): Promise<SpatialHotspot | null> {
  if (typeof window !== 'undefined' && !navigator.onLine) {
    const hs = await db.spatial_hotspots.get(hotspotId);
    return hs || null;
  }
  const { data, error } = await supabase.from("spatial_hotspots").select("*").eq("id", hotspotId).maybeSingle();
  if (error) throw error;
  return data as SpatialHotspot | null;
}

export function buildComponentLocationsMap(
  compLocs: any[],
  allHotspots: any[],
  allPhotos: any[],
  allRooms: any[]
): Map<string, ComponentLocationSummary[]> {
  const hsMap = new Map<string, any>(allHotspots.map(h => [h.id, h]));
  const phMap = new Map<string, any>(allPhotos.map(p => [p.id, p]));
  const rmMap = new Map<string, any>(allRooms.map(r => [r.id, r]));

  const map = new Map<string, ComponentLocationSummary[]>();

  for (const cl of compLocs) {
    let curHsId = cl.hotspot_id;
    let roomId: string | undefined;
    let roomName: string | undefined;
    const chain: string[] = [];
    let depth = 0;
    const targetHs = hsMap.get(cl.hotspot_id);

    while (curHsId && depth < 25) {
      depth++;
      const hs = hsMap.get(curHsId);
      if (!hs) break;
      if (hs.label) chain.unshift(hs.label);

      if (!hs.photo_id) break;
      const ph = phMap.get(hs.photo_id);
      if (!ph) break;
      if (ph.label) chain.unshift(ph.label);

      if (ph.parent_hotspot_id) {
        curHsId = ph.parent_hotspot_id;
      } else if (ph.room_id) {
        roomId = ph.room_id;
        roomName = rmMap.get(ph.room_id)?.name;
        if (roomName) chain.unshift(roomName);
        break;
      } else {
        break;
      }
    }

    const summary: ComponentLocationSummary = {
      id: cl.id,
      hotspot_id: cl.hotspot_id,
      quantity: cl.quantity,
      label: targetHs?.label || 'Storage Bin',
      fullLabel: chain.length > 0 ? chain.join(' → ') : (targetHs?.label || 'Storage Bin'),
      room_id: roomId,
      room_name: roomName
    };

    const list = map.get(cl.component_id) || [];
    list.push(summary);
    map.set(cl.component_id, list);
  }

  return map;
}

/**
 * Calculates the match rank of an item against a search query.
 * Lower score = higher priority.
 *
 * Tier 1 (10-12): Direct match in name (exact, name startsWith, or word startsWith)
 * Tier 2 (20-22): Direct match in tags (exact, tag startsWith, or word startsWith)
 * Tier 3 (30-31): Direct match in notes (notes startsWith, or word startsWith)
 * Tier 4 (40-42): In-between match in name (query is substring inside a word)
 * Tier 5 (50): In-between match in tags (query is substring inside a tag)
 * Tier 6 (60): In-between match in notes (query is substring inside notes)
 * Tier 999: No match (filtered out)
 */
export function getItemSearchScore(
  item: { name: string; notes?: string | null; tags?: { name: string }[] },
  search: string
): number {
  const q = search.toLowerCase().trim();
  if (!q) return 0;

  const name = (item.name || "").toLowerCase().trim();
  const notes = (item.notes || "").toLowerCase().trim();
  const tagNames = (item.tags || []).map(t => (t.name || "").toLowerCase().trim());

  const splitWords = (text: string) => text.split(/[\s\-_\/,\.;:\(\)\[\]\{\}]+/).filter(Boolean);

  const nameWords = splitWords(name);
  const noteWords = splitWords(notes);
  const tagWords = tagNames.flatMap(t => splitWords(t));

  // 1. Direct match in Name
  if (name === q) return 10;
  if (name.startsWith(q)) return 11;
  if (nameWords.some(w => w.startsWith(q))) return 12;

  // 2. Direct match in Tags
  if (tagNames.some(t => t === q)) return 20;
  if (tagNames.some(t => t.startsWith(q))) return 21;
  if (tagWords.some(w => w.startsWith(q))) return 22;

  // 3. Direct match in Notes
  if (notes.startsWith(q)) return 30;
  if (noteWords.some(w => w.startsWith(q))) return 31;

  // 4. In-between match in Name
  if (name.includes(q)) return 40;

  // 5. In-between match in Tags
  if (tagNames.some(t => t.includes(q))) return 50;

  // 6. In-between match in Notes
  if (notes.includes(q)) return 60;

  // Multi-word fallback: if query has multiple space-separated words, check if all words match
  const queryTokens = q.split(/\s+/).filter(Boolean);
  if (queryTokens.length > 1) {
    const allTokensMatchName = queryTokens.every(token => name.includes(token));
    if (allTokensMatchName) return 42;

    const allTokensMatchAnywhere = queryTokens.every(token =>
      name.includes(token) ||
      notes.includes(token) ||
      tagNames.some(t => t.includes(token))
    );
    if (allTokensMatchAnywhere) return 65;
  }

  return 999;
}

export function filterAndRankInventory<T extends { name: string; notes?: string | null; tags?: { name: string }[] }>(
  items: T[],
  search: string
): T[] {
  if (!search || !search.trim()) {
    return [...items].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  }

  const scored = items
    .map(item => ({
      item,
      score: getItemSearchScore(item, search)
    }))
    .filter(({ score }) => score < 999);

  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return a.item.name.localeCompare(b.item.name, undefined, { numeric: true, sensitivity: 'base' });
  });

  return scored.map(({ item }) => item);
}

// Phase 4 Functions
export async function getInventory(search: string = ""): Promise<ComponentWithTotals[]> {
  if (typeof window !== 'undefined' && !navigator.onLine) {
    const [allComps, allTotals, allTags, allCompTags, allCompLocs, allHotspots, allPhotos, allRooms] = await Promise.all([
      db.components.toArray(),
      db.component_totals.toArray(),
      db.tags.toArray(),
      db.component_tags.toArray(),
      db.component_locations.toArray(),
      db.spatial_hotspots.toArray(),
      db.spatial_photos.toArray(),
      db.rooms.toArray()
    ]);

    const totalsMap = new Map(allTotals.map(t => [t.component_id, t]));
    const tagMap = new Map(allTags.map(t => [t.id, t]));
    const locationsMap = buildComponentLocationsMap(allCompLocs, allHotspots, allPhotos, allRooms);

    let results = allComps.filter(c => !c.pending_delete);
    
    const mapped = results.map(c => {
      const cTags = allCompTags.filter(ct => ct.component_id === c.id).map(ct => tagMap.get(ct.tag_id)).filter(Boolean) as Tag[];
      return {
        ...c,
        tags: cTags,
        totals: totalsMap.get(c.id) || { component_id: c.id, in_storage_qty: 0, checked_out_qty: 0, total_owned_qty: 0 },
        locations: locationsMap.get(c.id) || []
      };
    });

    return filterAndRankInventory(mapped, search);
  }

  const [compDataRes, totalsDataRes, compLocsRes, hsRes, phRes, rmRes] = await Promise.all([
    supabase.from("components").select(`
      *,
      component_tags!component_tags_component_id_fkey(tags!component_tags_tag_id_fkey(*))
    `).eq("pending_delete", false).order("name"),
    supabase.from("component_totals").select("*"),
    supabase.from("component_locations").select("*"),
    supabase.from("spatial_hotspots").select("id, label, photo_id"),
    supabase.from("spatial_photos").select("id, label, parent_hotspot_id, room_id"),
    supabase.from("rooms").select("id, name")
  ]);

  if (compDataRes.error) throw compDataRes.error;
  if (totalsDataRes.error) throw totalsDataRes.error;

  const totalsMap = new Map((totalsDataRes.data || []).map(t => [t.component_id, t]));
  const locationsMap = buildComponentLocationsMap(
    compLocsRes.data || [],
    hsRes.data || [],
    phRes.data || [],
    rmRes.data || []
  );

  let results = (compDataRes.data || []).map(c => ({
    ...c,
    tags: c.component_tags.map((ct: any) => ct.tags).filter(Boolean),
    totals: totalsMap.get(c.id) || { component_id: c.id, in_storage_qty: 0, checked_out_qty: 0, total_owned_qty: 0 },
    locations: locationsMap.get(c.id) || []
  }));

  return filterAndRankInventory(results, search);
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
  const { data: existing } = await supabase.from("tags").select("*").eq("name", name).maybeSingle();
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
  const { data: comp, error: compErr } = await supabase.from("components").select(`*, component_tags!component_tags_component_id_fkey(tags!component_tags_tag_id_fkey(*))`).eq("id", id).single();
  if (compErr) throw new Error(compErr.message || "Failed to fetch component");
  
  const { data: totalsData } = await supabase.from("component_totals").select("*").eq("component_id", id).maybeSingle();
  
  const component: ComponentWithTotals = {
    ...comp,
    tags: comp.component_tags.map((ct: any) => ct.tags).filter(Boolean),
    totals: totalsData || { component_id: id, in_storage_qty: 0, checked_out_qty: 0, total_owned_qty: 0 }
  };

  // get locations
  const { data: locs, error: locErr } = await supabase.from("component_locations").select(`
    *,
    spatial_hotspots!component_locations_hotspot_id_fkey(
      *,
      spatial_photos!spatial_hotspots_photo_id_fkey(
        *,
        rooms!spatial_photos_room_id_fkey(*)
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
  tagIds: string[],
  locations: { hotspot_id: string, quantity: number }[] = []
): Promise<Component> {
  const customFields = { ...(componentData.custom_fields || {}) };
  if (componentData.item_type) {
    (customFields as any).item_type = componentData.item_type;
  }

  const { data, error } = await supabase.rpc('upsert_component_full', {
    p_id: componentData.id || null,
    p_name: componentData.name,
    p_photo_url: componentData.photo_url || null,
    p_price: componentData.price !== undefined && componentData.price !== null ? componentData.price : null,
    p_purchase_source: componentData.purchase_source || null,
    p_datasheet_link: componentData.datasheet_link || null,
    p_low_stock_threshold: componentData.low_stock_threshold !== undefined && componentData.low_stock_threshold !== null ? componentData.low_stock_threshold : null,
    p_notes: componentData.notes || null,
    p_custom_fields: customFields,
    p_tag_ids: tagIds,
    p_locations: locations
  });

  if (error) {
    console.error("RPC Error in upsertComponent:", error);
    throw new Error(error.message || "Failed to upsert component");
  }

  const compId = data;
  const { data: fetchedData, error: selErr } = await supabase.from("components").select("*").eq("id", compId).single();
  if (selErr) throw new Error(selErr.message || "Failed to fetch inserted component");
  return fetchedData;
}

export async function getHotspotBreadcrumbPath(hotspotId: string): Promise<{ id: string, label: string }[]> {
  const path: { id: string, label: string }[] = [];
  return path;
}

export async function getFullHotspotPath(hotspotId: string) {
  // Recursive fetch to root
  const chain: { type: 'room' | 'photo' | 'hotspot', id: string, label: string }[] = [];
  let currentHotspotId: string | null = hotspotId;
  const isOffline = typeof window !== 'undefined' && !navigator.onLine;

  while (currentHotspotId) {
    let hs: any = null;
    if (isOffline) {
      hs = await db.spatial_hotspots.get(currentHotspotId);
    } else {
      const res = await supabase.from("spatial_hotspots").select("*").eq("id", currentHotspotId).maybeSingle();
      hs = res.data;
      if (!hs) {
        hs = await db.spatial_hotspots.get(currentHotspotId);
      }
    }
    if (!hs) break;
    chain.unshift({ type: 'hotspot', id: hs.id, label: hs.label });
    
    let photo: any = null;
    if (isOffline) {
      photo = await db.spatial_photos.get(hs.photo_id);
    } else {
      const res = await supabase.from("spatial_photos").select("*").eq("id", hs.photo_id).maybeSingle();
      photo = res.data;
      if (!photo) {
        photo = await db.spatial_photos.get(hs.photo_id);
      }
    }
    if (!photo) break;
    chain.unshift({ type: 'photo', id: photo.id, label: photo.label || 'View' });
    
    if (photo.parent_hotspot_id) {
      currentHotspotId = photo.parent_hotspot_id;
    } else if (photo.room_id) {
      let room: any = null;
      if (isOffline) {
        room = await db.rooms.get(photo.room_id);
      } else {
        const res = await supabase.from("rooms").select("name").eq("id", photo.room_id).maybeSingle();
        room = res.data;
        if (!room) {
          room = await db.rooms.get(photo.room_id);
        }
      }
      if (room?.name) {
        chain.unshift({ type: 'room', id: photo.room_id, label: room.name });
      }
      break;
    } else {
      break;
    }
  }
  return chain;
}

export function buildLeafHotspotsHierarchy(
  allHotspots: any[],
  allPhotos: any[],
  allRooms: any[]
) {
  const hotspotMap = new Map<string, any>();
  allHotspots.forEach(h => hotspotMap.set(h.id, h));

  const photoMap = new Map<string, any>();
  allPhotos.forEach(p => photoMap.set(p.id, p));

  const roomMap = new Map<string, any>();
  allRooms.forEach(r => roomMap.set(r.id, r));

  const leafHotspots = allHotspots.filter(h => h.is_leaf);

  const results = leafHotspots.map(hs => {
    const chain: { type: 'hotspot' | 'photo'; id: string; label: string }[] = [];
    let currentHotspotId: string | null = hs.id;
    let depth = 0;

    while (currentHotspotId && depth < 30) {
      depth++;
      const curHs = hotspotMap.get(currentHotspotId);
      if (!curHs) break;
      chain.unshift({ type: 'hotspot', id: curHs.id, label: curHs.label || 'Hotspot' });

      if (!curHs.photo_id) break;
      const photo = photoMap.get(curHs.photo_id);
      if (!photo) break;
      chain.unshift({ type: 'photo', id: photo.id, label: photo.label || 'View' });

      if (photo.parent_hotspot_id) {
        currentHotspotId = photo.parent_hotspot_id;
      } else if (photo.room_id) {
        const room = roomMap.get(photo.room_id);
        if (room?.name) {
          chain.unshift({ type: 'photo', id: photo.room_id, label: room.name });
        }
        break;
      } else {
        break;
      }
    }

    const fullLabel = chain.map(c => c.label).filter(Boolean).join(' → ');
    const rootRoom = chain.find(c => roomMap.has(c.id));
    const roomName = rootRoom?.label || (fullLabel.includes('→') ? fullLabel.split('→')[0].trim() : undefined);
    const roomId = rootRoom?.id;
    return {
      ...hs,
      fullLabel: fullLabel || hs.label || 'Unknown Location',
      roomId,
      roomName
    };
  });

  return results.sort((a, b) => {
    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
    if (timeB !== timeA) {
      return timeB - timeA;
    }
    return (a.fullLabel || '').localeCompare(b.fullLabel || '');
  });
}

export async function getAllLeafHotspots() {
  if (typeof window !== 'undefined' && !navigator.onLine) {
    const [allHotspots, allPhotos, allRooms] = await Promise.all([
      db.spatial_hotspots.toArray(),
      db.spatial_photos.toArray(),
      db.rooms.toArray()
    ]);
    return buildLeafHotspotsHierarchy(allHotspots, allPhotos, allRooms);
  }

  const [hotspotsRes, photosRes, roomsRes] = await Promise.all([
    supabase.from('spatial_hotspots').select('*'),
    supabase.from('spatial_photos').select('*'),
    supabase.from('rooms').select('id, name')
  ]);

  if (hotspotsRes.error) throw new Error(hotspotsRes.error.message || "Failed to fetch hotspots");
  if (photosRes.error) throw new Error(photosRes.error.message || "Failed to fetch photos");
  if (roomsRes.error) throw new Error(roomsRes.error.message || "Failed to fetch rooms");

  return buildLeafHotspotsHierarchy(
    hotspotsRes.data || [],
    photosRes.data || [],
    roomsRes.data || []
  );
}

export async function getHotspotComponents(hotspotId: string) {
  const { data, error } = await supabase.from('component_locations').select('*, components!component_locations_component_id_fkey(*)').eq('hotspot_id', hotspotId);
  if (error) throw new Error(error.message || "Failed to fetch components for hotspot");
  return data;
}

export async function updateHotspotComponents(hotspotId: string, updates: { component_id: string, quantity: number }[]) {
  await supabase.from('component_locations').delete().eq('hotspot_id', hotspotId);
  if (updates.length > 0) {
    const inserts = updates.map(u => ({ hotspot_id: hotspotId, component_id: u.component_id, quantity: u.quantity }));
    const { error } = await supabase.from('component_locations').insert(inserts);
    if (error) throw new Error(error.message || "Failed to update hotspot components");
  }
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

export async function uploadFile(file: File, pathPrefix: string = 'file'): Promise<{ url: string; name: string; size: number }> {
  const ext = file.name.split('.').pop() || 'bin';
  const cleanBaseName = file.name.substring(0, file.name.lastIndexOf('.')) || 'file';
  const safeBaseName = cleanBaseName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  const fileName = `${pathPrefix}_${Date.now()}_${safeBaseName}.${ext}`;

  const { error: uploadError } = await supabase.storage.from('images').upload(fileName, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false
  });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('images').getPublicUrl(fileName);
  return {
    url: data.publicUrl,
    name: file.name,
    size: file.size,
  };
}

export async function uploadPhotoAndCreate(
  file: File, 
  roomId: string, 
  parentHotspotId: string | null = null, 
  label: string = 'View',
  orderIndex: number = 0
) {
  const publicUrl = await uploadImage(file, 'media');
  
  // Create DB record
  const { data: photoData, error: dbError } = await supabase.from('spatial_photos').insert([
    {
      room_id: roomId,
      image_url: publicUrl,
      parent_hotspot_id: parentHotspotId,
      label,
      order_index: orderIndex
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

export async function updatePhotoLabel(photoId: string, label: string) {
  const { error } = await supabase.from('spatial_photos').update({ label }).eq('id', photoId);
  if (error) throw error;
}

export async function reorderSpatialPhotos(photoOrders: { id: string; order_index: number }[]): Promise<void> {
  if (photoOrders.length === 0) return;

  // 1. Update local Dexie DB for offline persistence
  if (typeof window !== 'undefined') {
    await Promise.all(
      photoOrders.map(p => db.spatial_photos.update(p.id, { order_index: p.order_index }))
    );
  }

  // 2. Atomic update in Supabase
  if (typeof window === 'undefined' || navigator.onLine) {
    // Sort photo IDs by target order_index so the array sequence matches 0..n-1
    const sortedPhotoIds = photoOrders
      .slice()
      .sort((a, b) => a.order_index - b.order_index)
      .map(p => p.id);

    // Call atomic Supabase RPC
    const { error: rpcError } = await supabase.rpc('reorder_spatial_photos', {
      p_photo_ids: sortedPhotoIds
    });

    if (rpcError) {
      console.warn('reorder_spatial_photos RPC unavailable or failed, applying fallback batch update:', rpcError);
      // Fallback: batch update in Supabase
      const results = await Promise.all(
        photoOrders.map(p =>
          supabase.from('spatial_photos').update({ order_index: p.order_index }).eq('id', p.id)
        )
      );
      const firstError = results.find(r => r.error)?.error;
      if (firstError) throw firstError;
    }
  }
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

export async function updateHotspot(
  hotspotId: string,
  updates: { label?: string; is_leaf?: boolean; shape_points?: { x: number; y: number }[] }
): Promise<SpatialHotspot> {
  const { data, error } = await supabase
    .from('spatial_hotspots')
    .update(updates)
    .eq('id', hotspotId)
    .select()
    .single();

  if (error) throw error;

  if (typeof window !== 'undefined') {
    try {
      await db.spatial_hotspots.update(hotspotId, updates);
    } catch (dbErr) {
      console.warn("Offline db update error on hotspot update:", dbErr);
    }
  }

  return data as SpatialHotspot;
}

export async function replaceSpatialPhoto(
  photoId: string,
  file: File
): Promise<string> {
  const publicUrl = await uploadImage(file, 'media');
  const { error } = await supabase
    .from('spatial_photos')
    .update({ image_url: publicUrl })
    .eq('id', photoId);

  if (error) throw error;

  if (typeof window !== 'undefined') {
    try {
      await db.spatial_photos.update(photoId, { image_url: publicUrl });
    } catch (dbErr) {
      console.warn("Offline db update error on photo replace:", dbErr);
    }
  }

  return publicUrl;
}

export async function batchUpdateHotspotPoints(
  updates: { id: string; shape_points: { x: number; y: number }[] }[]
): Promise<void> {
  if (updates.length === 0) return;

  if (typeof window === 'undefined' || navigator.onLine) {
    const { error: rpcErr } = await supabase.rpc('batch_update_hotspot_points', {
      p_updates: updates
    });

    if (rpcErr) {
      console.warn("RPC batch_update_hotspot_points failed or unmigrated, falling back to batch update:", rpcErr);
      const results = await Promise.all(
        updates.map(u =>
          supabase
            .from('spatial_hotspots')
            .update({ shape_points: u.shape_points })
            .eq('id', u.id)
        )
      );

      const firstErr = results.find(r => r.error)?.error;
      if (firstErr) throw firstErr;
    }
  }

  if (typeof window !== 'undefined') {
    try {
      await Promise.all(
        updates.map(u => db.spatial_hotspots.update(u.id, { shape_points: u.shape_points }))
      );
    } catch (dbErr) {
      console.warn("Offline db batch update error:", dbErr);
    }
  }
}

export async function undoInsertIntermediateSpatialPhoto(params: {
  parentHotspotId: string;
  intermediatePhotoId: string;
  intermediateHotspotId: string;
  childPhotoId: string;
}): Promise<void> {
  if (typeof window === 'undefined' || navigator.onLine) {
    const { error: rpcErr } = await supabase.rpc('undo_insert_intermediate_spatial_photo', {
      p_parent_hotspot_id: params.parentHotspotId,
      p_intermediate_photo_id: params.intermediatePhotoId,
      p_intermediate_hotspot_id: params.intermediateHotspotId,
      p_child_photo_id: params.childPhotoId
    });

    if (rpcErr) {
      console.warn("RPC undo_insert_intermediate_spatial_photo failed or unmigrated, executing fallback:", rpcErr);
      // Fallback
      await supabase.from('spatial_photos').update({ parent_hotspot_id: params.parentHotspotId, updated_at: new Date().toISOString() }).eq('id', params.childPhotoId);
      await supabase.from('spatial_hotspots').update({ child_photo_id: params.childPhotoId, updated_at: new Date().toISOString() }).eq('id', params.parentHotspotId);
      await supabase.from('spatial_hotspots').delete().eq('id', params.intermediateHotspotId);
      await supabase.from('spatial_photos').delete().eq('id', params.intermediatePhotoId);
    }
  }

  if (typeof window !== 'undefined') {
    try {
      await db.spatial_photos.update(params.childPhotoId, { parent_hotspot_id: params.parentHotspotId });
      await db.spatial_hotspots.update(params.parentHotspotId, { child_photo_id: params.childPhotoId });
      await db.spatial_hotspots.delete(params.intermediateHotspotId);
      await db.spatial_photos.delete(params.intermediatePhotoId);
    } catch (dbErr) {
      console.warn("Offline db sync error on undo intermediate photo insert:", dbErr);
    }
  }
}

export async function undoReplaceSpatialPhoto(params: {
  photoId: string;
  previousImageUrl: string;
  previousHotspotsUpdates?: { id: string; shape_points: { x: number; y: number }[] }[];
}): Promise<void> {
  if (typeof window === 'undefined' || navigator.onLine) {
    const { error: rpcErr } = await supabase.rpc('undo_replace_spatial_photo', {
      p_photo_id: params.photoId,
      p_previous_image_url: params.previousImageUrl,
      p_hotspots_updates: params.previousHotspotsUpdates || []
    });

    if (rpcErr) {
      console.warn("RPC undo_replace_spatial_photo failed or unmigrated, executing fallback:", rpcErr);
      const { error: photoErr } = await supabase
        .from('spatial_photos')
        .update({ image_url: params.previousImageUrl, updated_at: new Date().toISOString() })
        .eq('id', params.photoId);
      if (photoErr) throw photoErr;

      if (params.previousHotspotsUpdates && params.previousHotspotsUpdates.length > 0) {
        await batchUpdateHotspotPoints(params.previousHotspotsUpdates);
      }
    }
  }

  if (typeof window !== 'undefined') {
    try {
      await db.spatial_photos.update(params.photoId, { image_url: params.previousImageUrl });
      if (params.previousHotspotsUpdates && params.previousHotspotsUpdates.length > 0) {
        await Promise.all(
          params.previousHotspotsUpdates.map(u => db.spatial_hotspots.update(u.id, { shape_points: u.shape_points }))
        );
      }
    } catch (dbErr) {
      console.warn("Offline db sync error on undo photo replace:", dbErr);
    }
  }
}

export async function restoreDeletedHotspot(
  hotspot: SpatialHotspot,
  componentLocations: { component_id: string; quantity: number }[] = []
): Promise<void> {
  if (typeof window === 'undefined' || navigator.onLine) {
    const { error: rpcErr } = await supabase.rpc('restore_deleted_hotspot', {
      p_hotspot: hotspot,
      p_component_locations: componentLocations
    });

    if (rpcErr) {
      console.warn("RPC restore_deleted_hotspot failed or unmigrated, executing fallback:", rpcErr);
      const { error: hsErr } = await supabase.from('spatial_hotspots').insert([{
        id: hotspot.id,
        photo_id: hotspot.photo_id,
        label: hotspot.label,
        shape_points: hotspot.shape_points,
        is_leaf: hotspot.is_leaf,
        child_photo_id: hotspot.child_photo_id,
        created_at: hotspot.created_at,
        updated_at: new Date().toISOString()
      }]);
      if (hsErr) throw hsErr;

      if (componentLocations.length > 0) {
        const clInserts = componentLocations.map(cl => ({
          hotspot_id: hotspot.id,
          component_id: cl.component_id,
          quantity: cl.quantity
        }));
        await supabase.from('component_locations').insert(clInserts);
      }

      if (hotspot.child_photo_id) {
        await supabase.from('spatial_photos').update({ parent_hotspot_id: hotspot.id }).eq('id', hotspot.child_photo_id);
      }
    }
  }

  if (typeof window !== 'undefined') {
    try {
      await db.spatial_hotspots.put(hotspot);
      if (componentLocations.length > 0) {
        for (const cl of componentLocations) {
          await db.component_locations.put({
            id: crypto.randomUUID(),
            hotspot_id: hotspot.id,
            component_id: cl.component_id,
            quantity: cl.quantity
          });
        }
      }
      if (hotspot.child_photo_id) {
        await db.spatial_photos.update(hotspot.child_photo_id, { parent_hotspot_id: hotspot.id });
      }
    } catch (dbErr) {
      console.warn("Offline db sync error on restore deleted hotspot:", dbErr);
    }
  }
}

export async function serializeSpatialPhotoTree(photoId: string): Promise<{
  photos: SpatialPhoto[];
  hotspots: SpatialHotspot[];
  component_locations: { hotspot_id: string; component_id: string; quantity: number }[];
}> {
  if (typeof window === 'undefined' || navigator.onLine) {
    const { data, error } = await supabase.rpc('serialize_spatial_photo_tree', {
      p_photo_id: photoId
    });
    if (!error && data && data.photos) {
      return data;
    }
  }

  // Fallback: serialize using local/Supabase queries
  const photoList: SpatialPhoto[] = [];
  const hotspotList: SpatialHotspot[] = [];
  const compLocList: { hotspot_id: string; component_id: string; quantity: number }[] = [];

  const traverse = async (currPhotoId: string) => {
    let p: SpatialPhoto | null = null;
    if (typeof window !== 'undefined' && !navigator.onLine) {
      p = (await db.spatial_photos.get(currPhotoId)) || null;
    } else {
      const { data } = await supabase.from('spatial_photos').select('*').eq('id', currPhotoId).single();
      p = data;
    }
    if (!p) return;
    photoList.push(p);

    let hs: SpatialHotspot[] = [];
    if (typeof window !== 'undefined' && !navigator.onLine) {
      hs = await db.spatial_hotspots.where('photo_id').equals(currPhotoId).toArray();
    } else {
      const { data } = await supabase.from('spatial_hotspots').select('*').eq('photo_id', currPhotoId);
      hs = data || [];
    }
    for (const h of hs) {
      hotspotList.push(h);
      let cls: any[] = [];
      if (typeof window !== 'undefined' && !navigator.onLine) {
        cls = await db.component_locations.where('hotspot_id').equals(h.id).toArray();
      } else {
        const { data } = await supabase.from('component_locations').select('*').eq('hotspot_id', h.id);
        cls = data || [];
      }
      for (const cl of cls) {
        compLocList.push({ hotspot_id: h.id, component_id: cl.component_id, quantity: cl.quantity });
      }
      if (h.child_photo_id) {
        await traverse(h.child_photo_id);
      }
    }
  };

  await traverse(photoId);

  return {
    photos: photoList,
    hotspots: hotspotList,
    component_locations: compLocList
  };
}

export async function restoreDeletedSpatialPhotoTree(
  tree: {
    photos: SpatialPhoto[];
    hotspots: SpatialHotspot[];
    component_locations: { hotspot_id: string; component_id: string; quantity: number }[];
  },
  parentHotspotId?: string | null
): Promise<void> {
  if (typeof window === 'undefined' || navigator.onLine) {
    const { error: rpcErr } = await supabase.rpc('restore_deleted_spatial_photo_tree', {
      p_tree: tree,
      p_parent_hotspot_id: parentHotspotId || null
    });

    if (rpcErr) {
      console.warn("RPC restore_deleted_spatial_photo_tree failed, executing fallback:", rpcErr);
      if (tree.photos && tree.photos.length > 0) {
        await supabase.from('spatial_photos').upsert(tree.photos);
      }
      if (tree.hotspots && tree.hotspots.length > 0) {
        await supabase.from('spatial_hotspots').upsert(tree.hotspots);
      }
      if (tree.component_locations && tree.component_locations.length > 0) {
        await supabase.from('component_locations').insert(tree.component_locations);
      }
      if (parentHotspotId && tree.photos && tree.photos.length > 0) {
        await supabase.from('spatial_hotspots').update({ child_photo_id: tree.photos[0].id }).eq('id', parentHotspotId);
      }
    }
  }

  if (typeof window !== 'undefined') {
    try {
      if (tree.photos && tree.photos.length > 0) {
        await db.spatial_photos.bulkPut(tree.photos);
      }
      if (tree.hotspots && tree.hotspots.length > 0) {
        await db.spatial_hotspots.bulkPut(tree.hotspots);
      }
      if (tree.component_locations && tree.component_locations.length > 0) {
        await db.component_locations.bulkPut(
          tree.component_locations.map(cl => ({
            id: crypto.randomUUID(),
            hotspot_id: cl.hotspot_id,
            component_id: cl.component_id,
            quantity: cl.quantity
          }))
        );
      }
      if (parentHotspotId && tree.photos && tree.photos.length > 0) {
        await db.spatial_hotspots.update(parentHotspotId, { child_photo_id: tree.photos[0].id });
      }
    } catch (dbErr) {
      console.warn("Offline db sync error on restoreDeletedSpatialPhotoTree:", dbErr);
    }
  }
}

export async function moveSpatialHotspot(params: {
  hotspotId: string;
  newPhotoId: string;
  newShapePoints: { x: number; y: number }[];
}): Promise<{
  success: boolean;
  hotspot_id: string;
  source_photo_id: string;
  destination_photo_id: string;
  source_room_id?: string;
  destination_room_id?: string;
}> {
  if (typeof window === 'undefined' || navigator.onLine) {
    const { data, error: rpcErr } = await supabase.rpc('move_spatial_hotspot', {
      p_hotspot_id: params.hotspotId,
      p_new_photo_id: params.newPhotoId,
      p_new_shape_points: params.newShapePoints
    });

    if (!rpcErr && data) {
      if (typeof window !== 'undefined') {
        try {
          await db.spatial_hotspots.update(params.hotspotId, {
            photo_id: params.newPhotoId,
            shape_points: params.newShapePoints
          });
          if (data.source_room_id && data.destination_room_id && data.source_room_id !== data.destination_room_id) {
            const allPhotos = await db.spatial_photos.toArray();
            const allHotspots = await db.spatial_hotspots.toArray();
            const descendantPhotoIds = new Set<string>();
            const traverse = (pId: string) => {
              descendantPhotoIds.add(pId);
              const childHs = allHotspots.filter(h => h.photo_id === pId);
              for (const ch of childHs) {
                if (ch.child_photo_id) traverse(ch.child_photo_id);
              }
            };
            const directChildPhoto = allPhotos.find(p => p.parent_hotspot_id === params.hotspotId);
            if (directChildPhoto) traverse(directChildPhoto.id);
            for (const dpId of descendantPhotoIds) {
              await db.spatial_photos.update(dpId, { room_id: data.destination_room_id });
            }
          }
        } catch (dbErr) {
          console.warn("Offline db sync error on moveSpatialHotspot:", dbErr);
        }
      }
      return data;
    }

    if (rpcErr) {
      console.warn("RPC move_spatial_hotspot failed or unmigrated, executing fallback:", rpcErr);
    }
  }

  // Fallback client-side logic
  const [hsRes, destPhotoRes] = await Promise.all([
    supabase.from('spatial_hotspots').select('*').eq('id', params.hotspotId).single(),
    supabase.from('spatial_photos').select('*').eq('id', params.newPhotoId).single()
  ]);
  if (hsRes.error || !hsRes.data) throw new Error("Hotspot not found");
  if (destPhotoRes.error || !destPhotoRes.data) throw new Error("Destination view not found");

  const hotspot = hsRes.data;
  const destPhoto = destPhotoRes.data;

  if (hotspot.photo_id === params.newPhotoId) {
    throw new Error("Cannot move hotspot onto the same source view");
  }

  // Check valid room
  const { data: roomData, error: roomErr } = await supabase.from('rooms').select('id').eq('id', destPhoto.room_id).single();
  if (roomErr || !roomData) {
    throw new Error("Destination view does not belong to a valid room");
  }

  // Cycle prevention and hierarchy check
  const { data: allPhotos } = await supabase.from('spatial_photos').select('id, parent_hotspot_id, room_id');
  const { data: allHotspots } = await supabase.from('spatial_hotspots').select('id, photo_id, child_photo_id');
  const photoMap = new Map((allPhotos || []).map(p => [p.id, p]));

  // Validate parent_hotspot_id relationship consistency
  if (hotspot.child_photo_id) {
    const childPhoto = (allPhotos || []).find(p => p.id === hotspot.child_photo_id);
    if (childPhoto && childPhoto.parent_hotspot_id && childPhoto.parent_hotspot_id !== params.hotspotId) {
      throw new Error(`Inconsistent hierarchy: child photo has parent_hotspot_id ${childPhoto.parent_hotspot_id}, expected ${params.hotspotId}`);
    }
  }

  const descendantPhotoIds = new Set<string>();
  const collectDescendants = (hId: string) => {
    const hs = (allHotspots || []).find(h => h.id === hId);
    const directChildren = (allPhotos || []).filter(p => p.parent_hotspot_id === hId || (hs?.child_photo_id && p.id === hs.child_photo_id));
    for (const directChild of directChildren) {
      if (!descendantPhotoIds.has(directChild.id)) {
        descendantPhotoIds.add(directChild.id);
        const childHsList = (allHotspots || []).filter(h => h.photo_id === directChild.id);
        for (const ch of childHsList) {
          collectDescendants(ch.id);
        }
      }
    }
  };
  collectDescendants(params.hotspotId);

  if (descendantPhotoIds.has(params.newPhotoId)) {
    throw new Error("Destination view is a descendant of this hotspot; cyclic move rejected");
  }

  const sourcePhoto = photoMap.get(hotspot.photo_id);

  // Update hotspot
  const { error: upErr } = await supabase
    .from('spatial_hotspots')
    .update({ photo_id: params.newPhotoId, shape_points: params.newShapePoints, updated_at: new Date().toISOString() })
    .eq('id', params.hotspotId);
  if (upErr) throw upErr;

  // Propagate room_id to descendant photos if different
  if (sourcePhoto && sourcePhoto.room_id !== destPhoto.room_id && descendantPhotoIds.size > 0) {
    await supabase
      .from('spatial_photos')
      .update({ room_id: destPhoto.room_id, updated_at: new Date().toISOString() })
      .in('id', Array.from(descendantPhotoIds));
  }

  // Dexie sync
  if (typeof window !== 'undefined') {
    try {
      await db.spatial_hotspots.update(params.hotspotId, {
        photo_id: params.newPhotoId,
        shape_points: params.newShapePoints
      });
      if (sourcePhoto && sourcePhoto.room_id !== destPhoto.room_id) {
        for (const dpId of descendantPhotoIds) {
          await db.spatial_photos.update(dpId, { room_id: destPhoto.room_id });
        }
      }
    } catch (dbErr) {
      console.warn("Offline db sync error in fallback:", dbErr);
    }
  }

  return {
    success: true,
    hotspot_id: params.hotspotId,
    source_photo_id: hotspot.photo_id,
    destination_photo_id: params.newPhotoId,
    source_room_id: sourcePhoto?.room_id,
    destination_room_id: destPhoto.room_id
  };
}

export async function insertIntermediateSpatialPhoto(params: {
  roomId: string;
  parentHotspotId: string;
  childPhotoId: string;
  file: File;
  photoLabel: string;
  hotspotLabel: string;
  shapePoints?: { x: number; y: number }[];
}): Promise<{ newPhoto: SpatialPhoto; newHotspot: SpatialHotspot }> {
  // 1. Compress and upload image
  const publicUrl = await uploadImage(params.file, 'media');
  const points = params.shapePoints && params.shapePoints.length >= 3
    ? params.shapePoints
    : [
        { x: 0.15, y: 0.15 },
        { x: 0.85, y: 0.15 },
        { x: 0.85, y: 0.85 },
        { x: 0.15, y: 0.85 }
      ];

  let newPhotoData: SpatialPhoto | null = null;
  let newHotspotData: SpatialHotspot | null = null;

  if (typeof window === 'undefined' || navigator.onLine) {
    // 2. Attempt atomic PostgreSQL RPC with row-level locking & strict validation
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('insert_intermediate_spatial_photo', {
      p_room_id: params.roomId,
      p_parent_hotspot_id: params.parentHotspotId,
      p_child_photo_id: params.childPhotoId,
      p_image_url: publicUrl,
      p_photo_label: params.photoLabel,
      p_hotspot_label: params.hotspotLabel,
      p_shape_points: points
    });

    if (rpcErr) {
      console.warn("RPC insert_intermediate_spatial_photo failed or unmigrated, executing validated client transaction fallback:", rpcErr);

      // Strict validation: verify both records and bidirectional link
      const { data: parentHs, error: hsErr } = await supabase
        .from('spatial_hotspots')
        .select('*')
        .eq('id', params.parentHotspotId)
        .single();
      if (hsErr || !parentHs) throw new Error("Parent hotspot not found");

      const { data: childPhoto, error: cpErr } = await supabase
        .from('spatial_photos')
        .select('*')
        .eq('id', params.childPhotoId)
        .single();
      if (cpErr || !childPhoto) throw new Error("Child photo not found");

      if (childPhoto.parent_hotspot_id !== params.parentHotspotId) {
        throw new Error(`Hierarchy validation failed: child photo parent (${childPhoto.parent_hotspot_id}) does not match expected parent hotspot ${params.parentHotspotId}`);
      }
      if (parentHs.child_photo_id !== params.childPhotoId) {
        throw new Error(`Hierarchy validation failed: parent hotspot child (${parentHs.child_photo_id}) does not match expected child photo ${params.childPhotoId}`);
      }

      // Step A: Create intermediate photo (Image2)
      const { data: p2, error: p2Err } = await supabase
        .from('spatial_photos')
        .insert([{
          room_id: params.roomId,
          parent_hotspot_id: params.parentHotspotId,
          image_url: publicUrl,
          label: params.photoLabel,
          order_index: 0
        }])
        .select()
        .single();
      if (p2Err) throw p2Err;

      // Step B: Create intermediate hotspot on Image2 (Hotspot2) pointing to Image3
      const { data: h2, error: h2Err } = await supabase
        .from('spatial_hotspots')
        .insert([{
          photo_id: p2.id,
          label: params.hotspotLabel,
          shape_points: points,
          is_leaf: false,
          child_photo_id: params.childPhotoId
        }])
        .select()
        .single();
      if (h2Err) throw h2Err;

      // Step C: Re-point Image3 to Hotspot2
      const { error: cpUpErr } = await supabase
        .from('spatial_photos')
        .update({ parent_hotspot_id: h2.id, updated_at: new Date().toISOString() })
        .eq('id', params.childPhotoId);
      if (cpUpErr) throw cpUpErr;

      // Step D: Re-point Hotspot1 to Image2
      const { error: hsUpErr } = await supabase
        .from('spatial_hotspots')
        .update({ child_photo_id: p2.id, updated_at: new Date().toISOString() })
        .eq('id', params.parentHotspotId);
      if (hsUpErr) throw hsUpErr;

      newPhotoData = p2 as SpatialPhoto;
      newHotspotData = h2 as SpatialHotspot;
    } else {
      // Fetch created photo and hotspot
      const [pRes, hRes] = await Promise.all([
        supabase.from('spatial_photos').select('*').eq('id', rpcRes.photo_id).single(),
        supabase.from('spatial_hotspots').select('*').eq('id', rpcRes.hotspot_id).single()
      ]);
      if (pRes.error) throw pRes.error;
      if (hRes.error) throw hRes.error;
      newPhotoData = pRes.data as SpatialPhoto;
      newHotspotData = hRes.data as SpatialHotspot;
    }
  }

  // 3. Synchronize to Dexie offline DB
  if (typeof window !== 'undefined') {
    try {
      if (newPhotoData) await db.spatial_photos.put(newPhotoData);
      if (newHotspotData) await db.spatial_hotspots.put(newHotspotData);
      await db.spatial_photos.update(params.childPhotoId, { parent_hotspot_id: newHotspotData?.id });
      await db.spatial_hotspots.update(params.parentHotspotId, { child_photo_id: newPhotoData?.id });
    } catch (dbErr) {
      console.warn("Offline db sync error on intermediate photo insert:", dbErr);
    }
  }

  if (!newPhotoData || !newHotspotData) {
    throw new Error("Failed to create intermediate photo or hotspot");
  }

  return { newPhoto: newPhotoData, newHotspot: newHotspotData };
}

export interface Project {
  id: string;
  name: string;
  status: 'planning' | 'active' | 'archived';
  description: string | null;
  location_id?: string | null;
  location_label?: string | null;
  location_room_id?: string | null;
  created_at: string;
  updated_at?: string;
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

export interface Loan {
  id: string;
  loan_type: 'component' | 'project';
  component_id: string | null;
  project_id: string | null;
  source_location_id: string | null;
  returned_location_id: string | null;
  component_name?: string;
  project_name?: string;
  source_location_label?: string;
  returned_location_label?: string;
  quantity: number;
  borrower_name: string;
  borrower_contact?: string | null;
  notes?: string | null;
  lent_at: string;
  due_date: string;
  returned_at?: string | null;
  created_at?: string;
  updated_at?: string;
  // Resolved relations for UI convenience
  component?: Component;
  project?: Project;
  source_hotspot?: any;
  returned_hotspot?: any;
}

export interface LoanNotification {
  id: string;
  loanId: string;
  type: 'due_tomorrow' | 'due_today' | 'overdue';
  title: string;
  message: string;
  urgency: 'critical' | 'high' | 'medium';
  daysRemaining: number;
  loan: Loan;
}

export function calculateLoanDaysRemaining(dueDateStr: string): number {
  if (!dueDateStr) return 0;
  const parts = dueDateStr.split('T')[0].split('-');
  const dueYear = parseInt(parts[0], 10);
  const dueMonth = parseInt(parts[1], 10) - 1;
  const dueDay = parseInt(parts[2], 10);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDate = new Date(dueYear, dueMonth, dueDay);

  const diffTime = dueDate.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}


export function extractProjectLocation(project: any): { cleanDescription: string; locationId: string | null } {
  if (project.location_id) {
    return {
      cleanDescription: (project.description || '').replace(/<!--archive_location:[a-f0-9\-]+-->\s*/gi, '').trim(),
      locationId: project.location_id
    };
  }
  const desc = project.description || '';
  const match = desc.match(/<!--archive_location:([a-f0-9\-]+)-->/i);
  if (match) {
    return {
      cleanDescription: desc.replace(/<!--archive_location:[a-f0-9\-]+-->\s*/gi, '').trim(),
      locationId: match[1]
    };
  }
  return { cleanDescription: desc, locationId: null };
}

export function formatProjectDescriptionWithLocation(description: string | null | undefined, locationId: string | null | undefined): string {
  const clean = (description || '').replace(/<!--archive_location:[a-f0-9\-]+-->\s*/gi, '').trim();
  if (locationId) {
    return `${clean}${clean ? '\n\n' : ''}<!--archive_location:${locationId}-->`;
  }
  return clean;
}

export async function getProjects(): Promise<(Project & { active_count: number })[]> {
  const leafHotspots = await getAllLeafHotspots().catch(() => []);
  const hotspotMap = new Map<string, any>(leafHotspots.map(h => [h.id, h]));

  if (typeof window !== 'undefined' && !navigator.onLine) {
    const allProj = await db.projects.orderBy('created_at').reverse().toArray();
    const allProjComps = await db.project_components.toArray();
    return allProj.map(p => {
      const active = allProjComps.filter(pc => pc.project_id === p.id && !pc.returned_at).reduce((acc, pc) => acc + pc.quantity, 0);
      const { cleanDescription, locationId } = extractProjectLocation(p);
      const loc = locationId ? hotspotMap.get(locationId) : undefined;
      const status: 'planning' | 'active' | 'archived' = (p.status as any) === 'completed' ? 'archived' : (p.status as any);
      return {
        ...p,
        status,
        description: cleanDescription,
        location_id: locationId,
        location_label: loc?.fullLabel || loc?.label,
        location_room_id: loc?.roomId,
        active_count: active
      };
    });
  }

  const { data, error } = await supabase.from('projects').select('*, project_components!project_components_project_id_fkey(quantity, returned_at)').order('created_at', { ascending: false });
  if (error) throw error;
  
  return data.map(p => {
    const active = p.project_components.filter((pc: any) => !pc.returned_at).reduce((acc: number, pc: any) => acc + pc.quantity, 0);
    const { cleanDescription, locationId } = extractProjectLocation(p);
    const loc = locationId ? hotspotMap.get(locationId) : undefined;
    const status: 'planning' | 'active' | 'archived' = p.status === 'completed' ? 'archived' : (p.status as any);
    return {
      ...p,
      status,
      description: cleanDescription,
      location_id: locationId,
      location_label: loc?.fullLabel || loc?.label,
      location_room_id: loc?.roomId,
      active_count: active
    };
  });
}

export async function createProject(name: string, description: string = ''): Promise<Project> {
  const { data, error } = await supabase.from('projects').insert([{ name, description, status: 'planning' }]).select().single();
  if (error) throw error;
  if (typeof window !== 'undefined') {
    await db.projects.put(data);
  }
  return data;
}

export async function updateProject(
  id: string,
  updates: {
    name?: string;
    description?: string | null;
    status?: 'planning' | 'active' | 'archived';
    location_id?: string | null;
  }
): Promise<Project> {
  const leafHotspots = await getAllLeafHotspots().catch(() => []);
  const hotspotMap = new Map<string, any>(leafHotspots.map(h => [h.id, h]));

  // Strict Rule 1: The archive transition and location_id assignment must be atomic.
  // A project must not become Archived without a valid storage location, and the location must reference a leaf hotspot.
  if (updates.status === 'archived') {
    if (!updates.location_id) {
      throw new Error("A project cannot become Archived without a valid leaf storage location.");
    }
    const loc = hotspotMap.get(updates.location_id);
    if (!loc || !loc.is_leaf) {
      throw new Error("Project archive location must reference a valid leaf storage location.");
    }
  }

  // Strict Rule 2: Planning phase means no components are being used.
  if (updates.status === 'planning') {
    const { items } = await getProjectDetails(id);
    const activeItems = items.filter(i => !i.returned_at);
    if (activeItems.length > 0) {
      throw new Error(`Cannot transition to Planning phase: ${activeItems.length} active component(s) are currently in use. Check in all components first.`);
    }
  }

  // Determine existing project data if needed for fallback description
  let existingDesc: string | null | undefined = updates.description;
  if (existingDesc === undefined) {
    if (typeof window !== 'undefined' && !navigator.onLine) {
      const p = await db.projects.get(id);
      existingDesc = p?.description;
    } else {
      const { data: cur } = await supabase.from('projects').select('description').eq('id', id).single();
      existingDesc = cur?.description;
    }
  }

  // If moving away from archived, clear location_id
  const finalLocationId = updates.status && updates.status !== 'archived' ? null : updates.location_id;

  const payload: any = {
    ...updates,
    location_id: finalLocationId,
    updated_at: new Date().toISOString()
  };
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

  let savedData: any = null;

  // Try updating with location_id column in Supabase
  const { data, error } = await supabase
    .from('projects')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (!error && data) {
    savedData = data;
  } else if (error && (error.code === 'PGRST204' || error.message?.includes('location_id'))) {
    // Column location_id not present yet in remote Supabase schema -> store in description fallback
    const encodedDesc = formatProjectDescriptionWithLocation(existingDesc, finalLocationId);
    const fallbackPayload: any = {
      name: updates.name,
      status: updates.status,
      description: encodedDesc,
      updated_at: new Date().toISOString()
    };
    Object.keys(fallbackPayload).forEach(k => fallbackPayload[k] === undefined && delete fallbackPayload[k]);

    const { data: fbData, error: fbErr } = await supabase
      .from('projects')
      .update(fallbackPayload)
      .eq('id', id)
      .select()
      .single();

    if (fbErr) throw fbErr;
    savedData = { ...fbData, location_id: finalLocationId };
  } else if (error) {
    throw error;
  }

  if (typeof window !== 'undefined') {
    await db.projects.update(id, {
      ...updates,
      location_id: finalLocationId,
      status: updates.status as any
    });
  }

  const { cleanDescription, locationId } = extractProjectLocation(savedData);
  const loc = locationId ? hotspotMap.get(locationId) : undefined;

  return {
    ...savedData,
    status: savedData.status,
    description: cleanDescription,
    location_id: locationId,
    location_label: loc?.fullLabel || loc?.label,
    location_room_id: loc?.roomId
  };
}

export async function archiveProject(projectId: string, locationId: string): Promise<Project> {
  // If remote RPC archive_project is available, attempt it first for strict database-level atomicity
  try {
    const { data, error } = await supabase.rpc('archive_project', {
      p_project_id: projectId,
      p_location_id: locationId
    });
    if (!error && data) {
      if (typeof window !== 'undefined') {
        await db.projects.update(projectId, { status: 'archived', location_id: locationId });
      }
      return (await getProjectDetails(projectId)).project;
    }
  } catch (e) {
    // fallback to updateProject
  }
  return updateProject(projectId, { status: 'archived', location_id: locationId });
}

export async function updateProjectStatus(
  id: string,
  status: 'planning' | 'active' | 'archived',
  locationId?: string | null
): Promise<Project> {
  return updateProject(id, { status, location_id: locationId });
}

export async function getProjectDetails(id: string): Promise<{ project: Project, items: ProjectComponent[] }> {
  const leafHotspots = await getAllLeafHotspots().catch(() => []);
  const hotspotMap = new Map<string, any>(leafHotspots.map(h => [h.id, h]));

  if (typeof window !== 'undefined' && !navigator.onLine) {
    const rawProject = await db.projects.get(id);
    if (!rawProject) throw new Error("Project not found");
    const rawItems = await db.project_components.where('project_id').equals(id).toArray();
    const items = await Promise.all(rawItems.map(async pc => {
      const component = await db.components.get(pc.component_id);
      const source_hotspot = await db.spatial_hotspots.get(pc.source_location_id);
      return { ...pc, component, source_hotspot };
    }));
    items.sort((a, b) => new Date(b.checked_out_at).getTime() - new Date(a.checked_out_at).getTime());
    
    const { cleanDescription, locationId } = extractProjectLocation(rawProject);
    const loc = locationId ? hotspotMap.get(locationId) : undefined;
    const status: 'planning' | 'active' | 'archived' = (rawProject.status as any) === 'completed' ? 'archived' : (rawProject.status as any);

    const project: Project = {
      ...rawProject,
      status,
      description: cleanDescription,
      location_id: locationId,
      location_label: loc?.fullLabel || loc?.label,
      location_room_id: loc?.roomId
    };

    return { project, items };
  }

  const { data: rawProject, error } = await supabase.from('projects').select('*').eq('id', id).single();
  if (error) throw error;
  
  const { data: items, error: itemsErr } = await supabase.from('project_components').select('*, component:components!project_components_component_id_fkey(*), source_hotspot:spatial_hotspots!fk_project_components_source_loc(*)').eq('project_id', id).order('checked_out_at', { ascending: false });
  if (itemsErr) throw itemsErr;

  const { cleanDescription, locationId } = extractProjectLocation(rawProject);
  const loc = locationId ? hotspotMap.get(locationId) : undefined;
  const status: 'planning' | 'active' | 'archived' = rawProject.status === 'completed' ? 'archived' : (rawProject.status as any);

  const project: Project = {
    ...rawProject,
    status,
    description: cleanDescription,
    location_id: locationId,
    location_label: loc?.fullLabel || loc?.label,
    location_room_id: loc?.roomId
  };

  return { project, items };
}

export async function checkoutComponent(projectId: string, componentId: string, sourceLocationId: string, quantity: number): Promise<void> {
  const { data: rawProject } = await supabase.from('projects').select('status').eq('id', projectId).single();
  if (rawProject && rawProject.status === 'archived') {
    throw new Error("Cannot check out components to an Archived project. Switch project to Active first.");
  }

  const { error } = await supabase.rpc('checkout_component', {
    p_project_id: projectId,
    p_component_id: componentId,
    p_source_location_id: sourceLocationId,
    p_quantity: quantity
  });
  if (error) throw error;

  // Option A: Planning phase auto-transitions to Active upon checkout
  if (rawProject && rawProject.status === 'planning') {
    await updateProject(projectId, { status: 'active' }).catch(err => {
      console.warn("Auto-transition to active warning:", err);
    });
  }
}

export async function checkinComponent(projectComponentId: string, returnLocationId: string): Promise<void> {
  const { error } = await supabase.rpc('checkin_component', {
    p_project_component_id: projectComponentId,
    p_return_location_id: returnLocationId
  });
  if (error) throw error;
}

export async function getComponentLocationAssignments(componentId: string): Promise<{ id: string; quantity: number; hotspot_id: string; label?: string }[]> {
  if (typeof window !== 'undefined' && !navigator.onLine) {
    const locs = await db.component_locations.where('component_id').equals(componentId).toArray();
    return locs.map(l => ({ id: l.id, quantity: l.quantity, hotspot_id: l.hotspot_id }));
  }

  const { data, error } = await supabase
    .from('component_locations')
    .select(`
      id,
      quantity,
      hotspot_id,
      spatial_hotspots!component_locations_hotspot_id_fkey(
        label
      )
    `)
    .eq('component_id', componentId);

  if (error) {
    const { data: simpleData } = await supabase
      .from('component_locations')
      .select('id, quantity, hotspot_id')
      .eq('component_id', componentId);
    return (simpleData || []).map(l => ({ ...l, label: undefined }));
  }

  return (data || []).map((l: any) => ({
    id: l.id,
    quantity: l.quantity,
    hotspot_id: l.hotspot_id,
    label: l.spatial_hotspots?.label
  }));
}

export async function deleteComponent(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_component_safe', { p_component_id: id });
  if (error) {
    console.warn("RPC delete_component_safe error, falling back to client safe delete:", error);
    const { data: activeProj } = await supabase.from('project_components').select('id').eq('component_id', id).is('returned_at', null);
    let activeLoans: any[] | null = null;
    try {
      const res = await supabase.from('loans').select('id').eq('component_id', id).is('returned_at', null);
      activeLoans = res.data;
    } catch {}

    if ((activeProj && activeProj.length > 0) || (activeLoans && activeLoans.length > 0)) {
      await supabase.from('component_locations').delete().eq('component_id', id);
      await supabase.from('components').update({ pending_delete: true }).eq('id', id);
      if (typeof window !== 'undefined') {
        await db.components.update(id, { pending_delete: true });
        await db.component_locations.where('component_id').equals(id).delete();
      }
      return;
    }

    await supabase.from('component_tags').delete().eq('component_id', id);
    await supabase.from('component_locations').delete().eq('component_id', id);
    const { error: delErr } = await supabase.from('components').delete().eq('id', id);
    if (delErr) throw delErr;
  }

  if (typeof window !== 'undefined') {
    try {
      await db.components.delete(id);
      await db.component_locations.where('component_id').equals(id).delete();
      await db.component_tags.where('component_id').equals(id).delete();
      await db.component_totals.delete(id);
    } catch (dbErr) {
      console.warn("Offline db cleanup error on component delete:", dbErr);
    }
  }
}

export async function deleteSpatialPhoto(photoId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_spatial_photo_recursive', { p_photo_id: photoId });
  if (error) throw error;
}

export async function deleteHotspot(hotspotId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_hotspot_recursive', { p_hotspot_id: hotspotId });
  if (error) {
    console.warn("RPC delete_hotspot_recursive error, running client cascade fallback:", error);
    const { data: hs } = await supabase.from('spatial_hotspots').select('*').eq('id', hotspotId).single();
    if (hs?.child_photo_id) {
      await deleteSpatialPhoto(hs.child_photo_id).catch(() => {});
    }
    const { data: childPhotos } = await supabase.from('spatial_photos').select('id').eq('parent_hotspot_id', hotspotId);
    if (childPhotos && childPhotos.length > 0) {
      for (const cp of childPhotos) {
        await deleteSpatialPhoto(cp.id).catch(() => {});
      }
    }
    await supabase.from('component_locations').delete().eq('hotspot_id', hotspotId);
    const { error: delErr } = await supabase.from('spatial_hotspots').delete().eq('id', hotspotId);
    if (delErr) throw delErr;
  }

  if (typeof window !== 'undefined') {
    try {
      await db.spatial_hotspots.delete(hotspotId);
      await db.component_locations.where('hotspot_id').equals(hotspotId).delete();
    } catch (dbErr) {
      console.warn("Offline db cleanup error on hotspot delete:", dbErr);
    }
  }
}

export async function deleteRoom(roomId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_room_recursive', { p_room_id: roomId });
  if (error) throw error;
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
      path.unshift(p.label || 'View');
      
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

// -------------------------------------------------------------
// LENDING SYSTEM API & DYNAMIC NOTIFICATIONS
// -------------------------------------------------------------

export async function getLoans(): Promise<Loan[]> {
  const leafHotspots = await getAllLeafHotspots().catch(() => []);
  const hotspotMap = new Map<string, any>(leafHotspots.map(h => [h.id, h]));

  if (typeof window !== 'undefined' && !navigator.onLine) {
    const rawLoans = await db.loans.toArray().catch(() => []);
    const [allComps, allProjs] = await Promise.all([
      db.components.toArray().catch(() => []),
      db.projects.toArray().catch(() => [])
    ]);
    const compMap = new Map<string, any>(allComps.map(c => [c.id, c]));
    const projMap = new Map<string, any>(allProjs.map(p => [p.id, p]));

    return rawLoans.map(loan => {
      const src = loan.source_location_id ? hotspotMap.get(loan.source_location_id) : undefined;
      const ret = loan.returned_location_id ? hotspotMap.get(loan.returned_location_id) : undefined;
      const comp = loan.component_id ? compMap.get(loan.component_id) : undefined;
      const proj = loan.project_id ? projMap.get(loan.project_id) : undefined;

      return {
        ...loan,
        component_name: comp?.name || loan.component_name,
        project_name: proj?.name || loan.project_name,
        source_location_label: src?.fullLabel || src?.label || loan.source_location_label,
        returned_location_label: ret?.fullLabel || ret?.label || loan.returned_location_label,
        component: comp,
        project: proj,
        source_hotspot: src,
        returned_hotspot: ret
      };
    }).sort((a, b) => new Date(b.lent_at).getTime() - new Date(a.lent_at).getTime());
  }

  // Online fetch with graceful fallback to Dexie if remote table is missing
  try {
    const { data, error } = await supabase
      .from('loans')
      .select('*, component:components(*), project:projects(*)')
      .order('lent_at', { ascending: false });

    if (!error && data) {
      return data.map((loan: any) => {
        const src = loan.source_location_id ? hotspotMap.get(loan.source_location_id) : undefined;
        const ret = loan.returned_location_id ? hotspotMap.get(loan.returned_location_id) : undefined;

        return {
          ...loan,
          component_name: loan.component?.name || loan.component_name,
          project_name: loan.project?.name || loan.project_name,
          source_location_label: src?.fullLabel || src?.label || loan.source_location_label,
          returned_location_label: ret?.fullLabel || ret?.label || loan.returned_location_label,
          source_hotspot: src,
          returned_hotspot: ret
        };
      });
    }
  } catch (err) {
    console.warn("Could not query loans from Supabase, falling back to local Dexie:", err);
  }

  // Fallback to local Dexie
  if (typeof window !== 'undefined') {
    const localLoans = await db.loans.toArray().catch(() => []);
    return localLoans.sort((a, b) => new Date(b.lent_at).getTime() - new Date(a.lent_at).getTime());
  }

  return [];
}

export async function getActiveLoans(): Promise<Loan[]> {
  const all = await getLoans();
  return all.filter(l => !l.returned_at);
}

export async function lendComponent(params: {
  componentId: string;
  sourceLocationId: string;
  quantity: number;
  borrowerName: string;
  borrowerContact?: string;
  dueDate: string;
  notes?: string;
}): Promise<Loan> {
  const { componentId, sourceLocationId, quantity, borrowerName, borrowerContact, dueDate, notes } = params;

  if (quantity <= 0) throw new Error("Quantity must be greater than zero.");
  if (!borrowerName.trim()) throw new Error("Borrower name is required.");
  if (!dueDate) throw new Error("Return due date is required.");

  // 1. Validate leaf source location
  const leafHotspots = await getAllLeafHotspots().catch(() => []);
  const srcHotspot = leafHotspots.find(h => h.id === sourceLocationId);
  if (!srcHotspot || !srcHotspot.is_leaf) {
    throw new Error("Source location must reference a valid leaf storage location.");
  }

  // 2. Try remote RPC lend_component
  try {
    const { data, error } = await supabase.rpc('lend_component', {
      p_component_id: componentId,
      p_source_location_id: sourceLocationId,
      p_quantity: quantity,
      p_borrower_name: borrowerName.trim(),
      p_borrower_contact: borrowerContact?.trim() || null,
      p_due_date: dueDate,
      p_notes: notes?.trim() || null
    });

    if (!error && data) {
      if (typeof window !== 'undefined') {
        await db.loans.put(data);
        // Refresh local cache
        const locs = await db.component_locations.where({ component_id: componentId, hotspot_id: sourceLocationId }).first();
        if (locs) {
          if (locs.quantity <= quantity) {
            await db.component_locations.delete(locs.id);
          } else {
            await db.component_locations.update(locs.id, { quantity: locs.quantity - quantity });
          }
        }
      }
      return data;
    }
  } catch (rpcErr) {
    console.warn("RPC lend_component failed, executing client fallback:", rpcErr);
  }

  // 3. Client Fallback
  // Check location stock
  let locRecord: any = null;
  if (typeof window !== 'undefined' && !navigator.onLine) {
    locRecord = await db.component_locations.where({ component_id: componentId, hotspot_id: sourceLocationId }).first();
  } else {
    const { data: locs } = await supabase
      .from('component_locations')
      .select('*')
      .eq('component_id', componentId)
      .eq('hotspot_id', sourceLocationId)
      .single();
    locRecord = locs;
  }

  if (!locRecord || locRecord.quantity < quantity) {
    throw new Error(`Insufficient quantity in source location. Available: ${locRecord?.quantity || 0}`);
  }

  // Decrement storage
  if (locRecord.quantity === quantity) {
    await supabase.from('component_locations').delete().eq('id', locRecord.id);
    if (typeof window !== 'undefined') await db.component_locations.delete(locRecord.id);
  } else {
    await supabase.from('component_locations').update({ quantity: locRecord.quantity - quantity }).eq('id', locRecord.id);
    if (typeof window !== 'undefined') await db.component_locations.update(locRecord.id, { quantity: locRecord.quantity - quantity });
  }

  // Get component name snapshot
  let compName = "Component";
  if (typeof window !== 'undefined' && !navigator.onLine) {
    const comp = await db.components.get(componentId);
    compName = comp?.name || compName;
  } else {
    const { data: comp } = await supabase.from('components').select('name').eq('id', componentId).single();
    compName = comp?.name || compName;
  }

  const loanId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `loan-${Date.now()}`;
  const newLoan: Loan = {
    id: loanId,
    loan_type: 'component',
    component_id: componentId,
    component_name: compName,
    project_id: null,
    source_location_id: sourceLocationId,
    source_location_label: srcHotspot.fullLabel || srcHotspot.label,
    returned_location_id: null,
    quantity,
    borrower_name: borrowerName.trim(),
    borrower_contact: borrowerContact?.trim() || null,
    notes: notes?.trim() || null,
    lent_at: new Date().toISOString(),
    due_date: dueDate,
    returned_at: null
  };

  try {
    await supabase.from('loans').insert([newLoan]);
  } catch {}
  if (typeof window !== 'undefined') {
    await db.loans.put(newLoan);
  }

  return newLoan;
}

export async function returnLentComponent(loanId: string, returnLocationId: string): Promise<Loan> {
  // Validate return location is a leaf hotspot
  const leafHotspots = await getAllLeafHotspots().catch(() => []);
  const retHotspot = leafHotspots.find(h => h.id === returnLocationId);
  if (!retHotspot || !retHotspot.is_leaf) {
    throw new Error("Return location must reference a valid leaf storage location.");
  }

  // Try RPC
  try {
    const { data, error } = await supabase.rpc('return_lent_component', {
      p_loan_id: loanId,
      p_return_location_id: returnLocationId
    });
    if (!error && data) {
      if (typeof window !== 'undefined') {
        await db.loans.update(loanId, {
          returned_at: data.returned_at,
          returned_location_id: returnLocationId,
          returned_location_label: retHotspot.fullLabel || retHotspot.label
        });
      }
      return data;
    }
  } catch (rpcErr) {
    console.warn("RPC return_lent_component failed, executing client fallback:", rpcErr);
  }

  // Fallback
  let loan: any = null;
  if (typeof window !== 'undefined' && !navigator.onLine) {
    loan = await db.loans.get(loanId);
  } else {
    const { data } = await supabase.from('loans').select('*').eq('id', loanId).single();
    loan = data;
  }
  if (!loan) throw new Error("Loan record not found.");

  const now = new Date().toISOString();
  if (loan.component_id) {
    // Add quantity back to return location
    const { data: existingLoc } = await supabase
      .from('component_locations')
      .select('*')
      .eq('component_id', loan.component_id)
      .eq('hotspot_id', returnLocationId)
      .maybeSingle();

    if (existingLoc) {
      await supabase.from('component_locations').update({ quantity: existingLoc.quantity + loan.quantity }).eq('id', existingLoc.id);
      if (typeof window !== 'undefined') {
        await db.component_locations.update(existingLoc.id, { quantity: existingLoc.quantity + loan.quantity });
      }
    } else {
      const newLocId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `loc-${Date.now()}`;
      const locPayload = { id: newLocId, component_id: loan.component_id, hotspot_id: returnLocationId, quantity: loan.quantity };
      try {
        await supabase.from('component_locations').insert([locPayload]);
      } catch {}
      if (typeof window !== 'undefined') {
        await db.component_locations.put(locPayload);
      }
    }
  }

  const updates = {
    returned_at: now,
    returned_location_id: returnLocationId,
    returned_location_label: retHotspot.fullLabel || retHotspot.label
  };

  try {
    await supabase.from('loans').update(updates).eq('id', loanId);
  } catch {}
  if (typeof window !== 'undefined') {
    await db.loans.update(loanId, updates);
  }

  return { ...loan, ...updates };
}

export async function lendProject(params: {
  projectId: string;
  borrowerName: string;
  borrowerContact?: string;
  dueDate: string;
  notes?: string;
}): Promise<Loan> {
  const { projectId, borrowerName, borrowerContact, dueDate, notes } = params;

  if (!borrowerName.trim()) throw new Error("Borrower name is required.");
  if (!dueDate) throw new Error("Return due date is required.");

  // Fetch project details
  const { project } = await getProjectDetails(projectId);
  if (project.status === 'planning') {
    throw new Error("Cannot lend a project in Planning phase (no physical build or components in use).");
  }

  // Try RPC
  try {
    const { data, error } = await supabase.rpc('lend_project', {
      p_project_id: projectId,
      p_borrower_name: borrowerName.trim(),
      p_borrower_contact: borrowerContact?.trim() || null,
      p_due_date: dueDate,
      p_notes: notes?.trim() || null
    });
    if (!error && data) {
      if (typeof window !== 'undefined') {
        await db.loans.put(data);
      }
      return data;
    }
  } catch (rpcErr) {
    console.warn("RPC lend_project failed, executing client fallback:", rpcErr);
  }

  const loanId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `loan-${Date.now()}`;
  const newLoan: Loan = {
    id: loanId,
    loan_type: 'project',
    project_id: projectId,
    project_name: project.name,
    component_id: null,
    source_location_id: project.location_id || null,
    source_location_label: project.location_label || undefined,
    returned_location_id: null,
    quantity: 1,
    borrower_name: borrowerName.trim(),
    borrower_contact: borrowerContact?.trim() || null,
    notes: notes?.trim() || null,
    lent_at: new Date().toISOString(),
    due_date: dueDate,
    returned_at: null
  };

  try {
    await supabase.from('loans').insert([newLoan]);
  } catch {}
  if (typeof window !== 'undefined') {
    await db.loans.put(newLoan);
  }

  return newLoan;
}

export async function returnLentProject(loanId: string, returnLocationId?: string): Promise<Loan> {
  const leafHotspots = await getAllLeafHotspots().catch(() => []);
  const retHotspot = returnLocationId ? leafHotspots.find(h => h.id === returnLocationId) : undefined;
  if (returnLocationId && (!retHotspot || !retHotspot.is_leaf)) {
    throw new Error("Return location must reference a valid leaf storage location.");
  }

  // Try RPC
  try {
    const { data, error } = await supabase.rpc('return_lent_project', {
      p_loan_id: loanId,
      p_return_location_id: returnLocationId || null
    });
    if (!error && data) {
      if (typeof window !== 'undefined') {
        await db.loans.update(loanId, {
          returned_at: data.returned_at,
          returned_location_id: returnLocationId,
          returned_location_label: retHotspot?.fullLabel || retHotspot?.label
        });
      }
      return data;
    }
  } catch (rpcErr) {
    console.warn("RPC return_lent_project failed, executing client fallback:", rpcErr);
  }

  const now = new Date().toISOString();
  let loan: any = null;
  if (typeof window !== 'undefined' && !navigator.onLine) {
    loan = await db.loans.get(loanId);
  } else {
    const { data } = await supabase.from('loans').select('*').eq('id', loanId).single();
    loan = data;
  }
  if (!loan) throw new Error("Loan record not found.");

  if (loan.project_id && returnLocationId) {
    await updateProject(loan.project_id, { location_id: returnLocationId });
  }

  const updates = {
    returned_at: now,
    returned_location_id: returnLocationId || null,
    returned_location_label: retHotspot?.fullLabel || retHotspot?.label
  };

  try {
    await supabase.from('loans').update(updates).eq('id', loanId);
  } catch {}
  if (typeof window !== 'undefined') {
    await db.loans.update(loanId, updates);
  }

  return { ...loan, ...updates };
}

// -------------------------------------------------------------
// DYNAMIC NOTIFICATION GENERATION (No persistent DB rows)
// -------------------------------------------------------------

export async function getLoanNotifications(): Promise<LoanNotification[]> {
  const activeLoans = await getActiveLoans().catch(() => []);
  const notifications: LoanNotification[] = [];

  for (const loan of activeLoans) {
    const daysRemaining = calculateLoanDaysRemaining(loan.due_date);
    const itemName = loan.loan_type === 'project' 
      ? (loan.project_name || loan.project?.name || 'Project')
      : (loan.component_name || loan.component?.name || 'Component');

    if (daysRemaining === 1) {
      // Exactly 1 day before return date (User requirement)
      notifications.push({
        id: `notif-tomorrow-${loan.id}`,
        loanId: loan.id,
        type: 'due_tomorrow',
        title: 'Due Tomorrow',
        message: `${itemName} lent to ${loan.borrower_name} is due for return tomorrow.`,
        urgency: 'medium',
        daysRemaining,
        loan
      });
    } else if (daysRemaining === 0) {
      // Due today
      notifications.push({
        id: `notif-today-${loan.id}`,
        loanId: loan.id,
        type: 'due_today',
        title: 'Due Today',
        message: `${itemName} lent to ${loan.borrower_name} is due for return today!`,
        urgency: 'high',
        daysRemaining,
        loan
      });
    } else if (daysRemaining < 0) {
      // Overdue
      const overdueDays = Math.abs(daysRemaining);
      notifications.push({
        id: `notif-overdue-${loan.id}`,
        loanId: loan.id,
        type: 'overdue',
        title: `Overdue by ${overdueDays} day${overdueDays === 1 ? '' : 's'}`,
        message: `${itemName} lent to ${loan.borrower_name} was due on ${new Date(loan.due_date).toLocaleDateString()}.`,
        urgency: 'critical',
        daysRemaining,
        loan
      });
    }
  }

  // Sort by urgency: critical first, then high, then medium
  const priorityOrder = { critical: 0, high: 1, medium: 2 };
  return notifications.sort((a, b) => priorityOrder[a.urgency] - priorityOrder[b.urgency]);
}

