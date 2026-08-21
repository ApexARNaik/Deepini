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

export type SpatialHotspot = {
  id: string
  photo_id: string
  label: string
  shape_points: { x: number; y: number }[]
  is_leaf: boolean
  child_photo_id: string | null
}

export async function getRooms() {
  const { data, error } = await supabase.from('rooms').select('*').order('order_index')
  if (error) throw error
  return data as Room[]
}

export async function createRoom(name: string) {
  const { data, error } = await supabase.from('rooms').insert([{ name }]).select().single()
  if (error) throw error
  return data as Room
}

export async function getPhotosForRoom(roomId: string) {
  const { data, error } = await supabase.from('spatial_photos').select('*').eq('room_id', roomId).order('order_index')
  if (error) throw error
  return data as SpatialPhoto[]
}

export async function getHotspotsForPhoto(photoId: string) {
  const { data, error } = await supabase.from('spatial_hotspots').select('*').eq('photo_id', photoId)
  if (error) throw error
  return data as SpatialHotspot[]
}

export async function uploadPhotoAndCreate(file: File, roomId: string, parentHotspotId: string | null = null, label: string = 'Perspective') {
  // Compress image
  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    fileType: 'image/webp' as const
  }
  const compressedFile = await imageCompression(file, options)

  // Upload to Supabase Storage
  const fileName = `${Date.now()}_${crypto.randomUUID()}.webp`
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('images')
    .upload(fileName, compressedFile)

  if (uploadError) throw uploadError

  // Get public URL
  const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(fileName)

  // Insert spatial_photo record
  const { data, error } = await supabase.from('spatial_photos').insert([{
    room_id: roomId,
    parent_hotspot_id: parentHotspotId,
    image_url: publicUrl,
    label
  }]).select().single()

  if (error) throw error

  // If this was for a drill-down hotspot, update the hotspot's child_photo_id
  if (parentHotspotId) {
    const { error: updateError } = await supabase.from('spatial_hotspots')
      .update({ child_photo_id: data.id })
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
