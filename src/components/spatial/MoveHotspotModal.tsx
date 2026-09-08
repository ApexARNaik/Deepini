"use client";

import { useState, useMemo, useEffect } from "react";
import { SpatialPhoto, SpatialHotspot } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { db } from "@/lib/db";
import { X, ArrowRightLeft, Search, ImageIcon, AlertCircle, CheckCircle2, ShieldAlert } from "lucide-react";

interface Props {
  hotspot: SpatialHotspot;
  currentPhotoId: string;
  photos: SpatialPhoto[];
  allHotspots: SpatialHotspot[];
  onClose: () => void;
  onSelectDestination: (destinationPhoto: SpatialPhoto) => void;
}

export function MoveHotspotModal({
  hotspot,
  currentPhotoId,
  photos,
  allHotspots,
  onClose,
  onSelectDestination
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);

  const [allPhotosList, setAllPhotosList] = useState<SpatialPhoto[]>(photos);
  const [allHotspotsList, setAllHotspotsList] = useState<SpatialHotspot[]>(allHotspots);
  const [roomsMap, setRoomsMap] = useState<Map<string, string>>(new Map());

  // Load complete spatial dataset across all rooms for comprehensive hierarchy & cycle prevention
  useEffect(() => {
    let isMounted = true;
    async function loadGlobalSpatialData() {
      try {
        let roomsData: any[] = [];
        let photosData: SpatialPhoto[] = [];
        let hotspotsData: SpatialHotspot[] = [];

        if (typeof window !== 'undefined' && !navigator.onLine) {
          roomsData = await db.rooms.toArray();
          photosData = await db.spatial_photos.toArray();
          hotspotsData = await db.spatial_hotspots.toArray();
        } else {
          const [roomsRes, photosRes, hotspotsRes] = await Promise.all([
            supabase.from('rooms').select('id, name'),
            supabase.from('spatial_photos').select('*'),
            supabase.from('spatial_hotspots').select('*')
          ]);
          roomsData = roomsRes.data || [];
          photosData = (photosRes.data as SpatialPhoto[]) || [];
          hotspotsData = (hotspotsRes.data as SpatialHotspot[]) || [];
        }

        if (isMounted) {
          if (roomsData.length > 0) {
            setRoomsMap(new Map(roomsData.map(r => [r.id, r.name])));
          }
          if (photosData.length > 0) {
            setAllPhotosList(photosData);
          }
          if (hotspotsData.length > 0) {
            setAllHotspotsList(hotspotsData);
          }
        }
      } catch (err) {
        console.warn("Could not load global spatial data for move modal:", err);
      }
    }
    loadGlobalSpatialData();
    return () => { isMounted = false; };
  }, []);

  // 1. Identify all descendant photos of this hotspot to strictly prevent circular moves
  const descendantPhotoIds = useMemo(() => {
    const descendants = new Set<string>();
    const photoMap = new Map(allPhotosList.map(p => [p.id, p]));
    const hotspotMap = new Map(allHotspotsList.map(h => [h.id, h]));

    const queue: string[] = [];

    // Direct child photo
    if (hotspot.child_photo_id) {
      queue.push(hotspot.child_photo_id);
    }
    const directChildByParent = allPhotosList.find(p => p.parent_hotspot_id === hotspot.id);
    if (directChildByParent && !queue.includes(directChildByParent.id)) {
      queue.push(directChildByParent.id);
    }

    while (queue.length > 0) {
      const currId = queue.shift()!;
      descendants.add(currId);

      // Child hotspots on this photo
      const childHsList = allHotspotsList.filter(h => h.photo_id === currId);
      for (const ch of childHsList) {
        if (ch.child_photo_id && !descendants.has(ch.child_photo_id)) {
          queue.push(ch.child_photo_id);
        }
      }

      // Photos pointing to any child hotspot on this photo
      const chIds = new Set(childHsList.map(h => h.id));
      const subPhotos = allPhotosList.filter(p => p.parent_hotspot_id && chIds.has(p.parent_hotspot_id));
      for (const sp of subPhotos) {
        if (!descendants.has(sp.id)) {
          queue.push(sp.id);
        }
      }
    }

    return descendants;
  }, [hotspot, allPhotosList, allHotspotsList]);

  // 2. Build human-readable hierarchy paths for each photo (including Room name)
  const photoPaths = useMemo(() => {
    const map = new Map<string, string>();
    const photoMap = new Map(allPhotosList.map(p => [p.id, p]));
    const hotspotMap = new Map(allHotspotsList.map(h => [h.id, h]));

    for (const photo of allPhotosList) {
      const pathParts: string[] = [photo.label || "View"];
      let curr = photo;
      const visited = new Set<string>([photo.id]);

      while (curr.parent_hotspot_id) {
        const parentHs = hotspotMap.get(curr.parent_hotspot_id);
        if (!parentHs) break;
        pathParts.unshift(parentHs.label);

        const parentPhoto = photoMap.get(parentHs.photo_id);
        if (!parentPhoto || visited.has(parentPhoto.id)) break;
        visited.add(parentPhoto.id);
        curr = parentPhoto;
      }

      const roomName = roomsMap.get(curr.room_id);
      if (roomName) {
        pathParts.unshift(roomName);
      }

      map.set(photo.id, pathParts.join(" > "));
    }
    return map;
  }, [allPhotosList, allHotspotsList, roomsMap]);

  // 3. Filter photos based on search
  const filteredPhotos = useMemo(() => {
    return allPhotosList.filter(p => {
      const path = photoPaths.get(p.id) || p.label || "";
      return path.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [allPhotosList, photoPaths, searchQuery]);

  const selectedPhoto = allPhotosList.find(p => p.id === selectedPhotoId);

  const handleConfirm = () => {
    if (!selectedPhoto) return;
    onSelectDestination(selectedPhoto);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-[#1a1816] border border-[#332f2a] rounded-lg shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#332f2a] bg-black/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-brand-accent/20 border border-brand-accent/30 text-brand-accent">
              <ArrowRightLeft className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-serif text-xl font-bold text-white">Move Storage Location</h2>
              <p className="text-xs text-brand-text-muted mt-0.5">
                Relocate &quot;{hotspot.label}&quot; and all its contents to another view
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-brand-text-muted hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Hotspot Summary Card */}
        <div className="p-4 bg-brand-bg border-b border-[#332f2a] flex items-center justify-between text-xs">
          <div>
            <span className="text-brand-text-muted uppercase tracking-wider font-mono text-[10px]">Moving:</span>
            <span className="ml-2 font-bold text-white text-sm">{hotspot.label}</span>
            <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-mono border border-[#332f2a] bg-[#252320] text-brand-text-muted">
              {hotspot.is_leaf ? "Storage Location" : "Opens into Storage View"}
            </span>
          </div>
          {!hotspot.is_leaf && descendantPhotoIds.size > 0 && (
            <div className="text-[11px] text-amber-400/90 flex items-center gap-1.5 font-mono">
              <span>Includes {descendantPhotoIds.size} sub-view{descendantPhotoIds.size > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-[#332f2a] bg-black/20">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search destination view or path..."
              className="w-full bg-[#121110] border border-[#332f2a] rounded pl-9 pr-3 py-2 text-sm text-white placeholder-brand-text-muted focus:border-brand-accent focus:outline-none"
            />
          </div>
        </div>

        {/* Views List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredPhotos.length === 0 ? (
            <div className="text-center py-8 text-xs text-brand-text-muted">
              No views found matching &quot;{searchQuery}&quot;
            </div>
          ) : (
            filteredPhotos.map((photo) => {
              const isCurrent = photo.id === currentPhotoId;
              const isDescendant = descendantPhotoIds.has(photo.id);
              const isDisabled = isCurrent || isDescendant;
              const isSelected = selectedPhotoId === photo.id;
              const pathLabel = photoPaths.get(photo.id) || photo.label || "View";

              return (
                <div
                  key={photo.id}
                  onClick={() => {
                    if (!isDisabled) {
                      setSelectedPhotoId(photo.id);
                    }
                  }}
                  className={`flex items-center justify-between p-3 rounded border transition-all ${
                    isDisabled
                      ? "opacity-40 bg-black/20 border-[#262320] cursor-not-allowed"
                      : isSelected
                      ? "bg-brand-accent/20 border-brand-accent shadow-[0_0_12px_rgba(188,115,83,0.3)] ring-1 ring-brand-accent cursor-pointer"
                      : "bg-black/40 border-[#332f2a] hover:border-[#4a443c] hover:bg-black/60 cursor-pointer group"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="relative w-12 h-12 rounded bg-[#252320] border border-[#332f2a] shrink-0 overflow-hidden flex items-center justify-center">
                      {photo.image_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={photo.image_url}
                          alt={photo.label || "View"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-brand-text-muted" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm font-bold truncate ${isSelected ? "text-white" : "text-white/90 group-hover:text-brand-accent transition-colors"}`}>
                        {photo.label || "View"}
                      </div>
                      <div className="text-[11px] text-brand-text-muted truncate mt-0.5">
                        {pathLabel}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 ml-3">
                    {isCurrent ? (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[#252320] border border-[#332f2a] text-brand-text-muted font-mono">
                        Current View
                      </span>
                    ) : isDescendant ? (
                      <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-red-950/40 border border-red-800/40 text-red-400 font-mono" title="Cannot move into its own descendant view">
                        <ShieldAlert className="h-3 w-3" />
                        Inside Itself
                      </span>
                    ) : isSelected ? (
                      <div className="flex items-center gap-1.5 text-xs text-brand-accent font-bold">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Selected</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="text-xs text-brand-text-muted group-hover:text-white px-2 py-1 rounded bg-[#252320] border border-[#332f2a]"
                      >
                        Select
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#332f2a] bg-black/40 flex items-center justify-between">
          <div className="text-xs text-brand-text-muted flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-brand-accent" />
            <span>You will be prompted to draw the new boundary outline on the selected view.</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-brand-text-muted hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!selectedPhotoId}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold uppercase tracking-wider bg-brand-accent text-white hover:bg-brand-accent-hover transition-colors rounded-sm disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
            >
              <span>Continue to Draw</span>
              <ArrowRightLeft className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
