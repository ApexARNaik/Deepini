"use client";

import { useState, useEffect, useRef } from "react";
import { SpatialPhoto, SpatialHotspot, getPhotosForRoom, getHotspotsForPhoto, uploadPhotoAndCreate, createHotspot, getFullHotspotPath, getInventory, ComponentWithTotals, getHotspotComponents, updateHotspotComponents, getRoom, updatePhotoLabel, deleteSpatialPhoto, deleteHotspot, updateRoom, deleteRoom, reorderSpatialPhotos, isPersonalItem } from "@/lib/api";
import { HotspotCanvas } from "./HotspotCanvas";
import { ImageUploadDropzone } from "./ImageUploadDropzone";
import { ChevronRight, ChevronLeft, ChevronUp, ChevronDown, Plus, Edit2, X, Search, Archive, Trash2, GripVertical, MapPin } from "lucide-react";
import { useNetworkState } from "@/hooks/useNetworkState";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Props {
  roomId: string;
  locateHotspotId?: string;
}

export function RoomView({ roomId, locateHotspotId }: Props) {
  const { isOnline } = useNetworkState();
  const [photos, setPhotos] = useState<SpatialPhoto[]>([]);
  const [hotspots, setHotspots] = useState<SpatialHotspot[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showHotspotsList, setShowHotspotsList] = useState(false);
  const router = useRouter();
  
  // Room Edit State
  const [isEditingRoomName, setIsEditingRoomName] = useState(false);
  const [editingRoomName, setEditingRoomName] = useState("");
  
  // Breadcrumb/drill-down state
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [breadcrumbChain, setBreadcrumbChain] = useState<{ id: string; label: string }[]>([]);
  const [roomName, setRoomName] = useState("Workshop");
  const [isEditingPhotoLabel, setIsEditingPhotoLabel] = useState(false);
  const [editingLabel, setEditingLabel] = useState("");

  // Side Drawer State
  const [selectedLeafHotspot, setSelectedLeafHotspot] = useState<SpatialHotspot | null>(null);
  const [leafComponents, setLeafComponents] = useState<any[]>([]);
  const [allInventory, setAllInventory] = useState<ComponentWithTotals[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddingComponent, setIsAddingComponent] = useState(false);

  useEffect(() => {
    getInventory().then(setAllInventory).catch(console.error);
  }, []);
  // We'll highlight the specific hotspot if locating
  const [highlightedHotspotId, setHighlightedHotspotId] = useState<string | null>(null);

  useEffect(() => {
    loadRoomData();
  }, [roomId, locateHotspotId]);

  useEffect(() => {
    if (activePhotoId) {
      loadHotspots(activePhotoId);
    } else {
      setHotspots([]);
    }
  }, [activePhotoId]);

  const loadRoomData = async () => {
    setLoading(true);
    try {
      const room = await getRoom(roomId);
      setRoomName(room.name);

      const allPhotos = await getPhotosForRoom(roomId);
      setPhotos(allPhotos);
      
      if (locateHotspotId) {
        // Compute path and set state
        const path = await getFullHotspotPath(locateHotspotId);
        if (path.length > 0) {
          // The last element is the leaf hotspot.
          // The elements before it are photos and drill hotspots.
          // The breadcrumb chain tracks PHOTOS. 
          const photoNodes = path.filter(p => p.type === 'photo');
          if (photoNodes.length > 0) {
            setBreadcrumbChain(photoNodes.map(p => ({ id: p.id, label: p.label })));
            setActivePhotoId(photoNodes[photoNodes.length - 1].id);
            setHighlightedHotspotId(locateHotspotId);
          }
        }
      } else {
        // If we don't have an active photo, set it to the first root photo
        if (!activePhotoId && allPhotos.length > 0) {
          const rootPhotos = allPhotos.filter(p => p.parent_hotspot_id === null);
          if (rootPhotos.length > 0) {
            setActivePhotoId(rootPhotos[0].id);
            setBreadcrumbChain([{ id: rootPhotos[0].id, label: rootPhotos[0].label || 'Root' }]);
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadHotspots = async (photoId: string) => {
    try {
      const hs = await getHotspotsForPhoto(photoId);
      setHotspots(hs);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUploadRootPhoto = async (file: File) => {
    setUploading(true);
    try {
      const orderIndex = rootPhotos.length;
      const newPhoto = await uploadPhotoAndCreate(file, roomId, null, `View ${orderIndex + 1}`, orderIndex);
      setPhotos(prev => [...prev, newPhoto]);
      if (!activePhotoId) {
        setActivePhotoId(newPhoto.id);
        setBreadcrumbChain([{ id: newPhoto.id, label: newPhoto.label || 'View' }]);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to upload photo");
    } finally {
      setUploading(false);
    }
  };

  const handleHotspotCreated = async (shapePoints: { x: number; y: number }[], label: string, isLeaf: boolean) => {
    if (!activePhotoId) return;
    try {
      const newHotspot = await createHotspot(activePhotoId, label, shapePoints, isLeaf);
      setHotspots(prev => [...prev, newHotspot]);
      setIsEditing(false);

      if (!isLeaf) {
        // Automatically prompt for child photo upload (simulated via file input click logic)
        // For now, we'll just alert to upload in the UI. 
        // Real implementation might trigger a hidden file input here.
        alert(`Hotspot created. Please upload the inside photo for '${label}'.`);
        // We set up a temporary state to expect the next upload to link to this hotspot.
        setPendingChildUpload(newHotspot);
      } else {
        // Immediately select the new leaf storage location and open the add component UI
        setSelectedLeafHotspot(newHotspot);
        setLeafComponents([]);
        setIsAddingComponent(true);
        getInventory().then(setAllInventory).catch(console.error);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save hotspot");
    }
  };

  const [pendingChildUpload, setPendingChildUpload] = useState<SpatialHotspot | null>(null);

  const handleChildUpload = async (file: File) => {
    if (!pendingChildUpload) return;
    setUploading(true);
    try {
      const newPhoto = await uploadPhotoAndCreate(file, roomId, pendingChildUpload.id, `Inside ${pendingChildUpload.label}`);
      setPhotos(prev => [...prev, newPhoto]);
      
      // Update local hotspot child_photo_id
      setHotspots(prev => prev.map(h => h.id === pendingChildUpload.id ? { ...h, child_photo_id: newPhoto.id } : h));
      setPendingChildUpload(null);
      
      // Auto navigate into it
      navigateToDrilldown(pendingChildUpload, newPhoto.id);
    } catch (err) {
      console.error(err);
      alert("Failed to upload child photo");
    } finally {
      setUploading(false);
    }
  };

  const resetViewInteractionState = () => {
    setIsEditing(false);
    setSelectedLeafHotspot(null);
    setHighlightedHotspotId(null);
    setPendingChildUpload(null);
    setShowHotspotsList(false);

    if (typeof document !== 'undefined') {
      const mainEl = document.querySelector('main');
      if (mainEl) {
        mainEl.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const navigateToDrilldown = (hotspot: SpatialHotspot, childPhotoId: string) => {
    setBreadcrumbChain(prev => [...prev, { id: childPhotoId, label: hotspot.label }]);
    setActivePhotoId(childPhotoId);
    resetViewInteractionState();
  };

  const handleHotspotClick = async (hotspot: SpatialHotspot) => {
    if (hotspot.is_leaf) {
      setSelectedLeafHotspot(hotspot);
      setIsAddingComponent(false);
      setSearchQuery("");
      try {
        const [comps, inv] = await Promise.all([
          getHotspotComponents(hotspot.id),
          getInventory()
        ]);
        setLeafComponents(comps);
        setAllInventory(inv);
        if (comps.length === 0) {
          setIsAddingComponent(true);
        }
      } catch (err) {
        console.error(err);
      }
    } else {
      if (hotspot.child_photo_id) {
        navigateToDrilldown(hotspot, hotspot.child_photo_id);
      } else {
        setPendingChildUpload(hotspot);
      }
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    const target = breadcrumbChain[index];
    if (!target) return;
    setActivePhotoId(target.id);
    setBreadcrumbChain(prev => prev.slice(0, index + 1));
    resetViewInteractionState();
  };

  const handleUpdateLeafComponents = async (newComps: any[]) => {
    if (!selectedLeafHotspot) return;
    setLeafComponents(newComps);
    try {
      await updateHotspotComponents(
        selectedLeafHotspot.id, 
        newComps.map(c => ({ component_id: c.component_id, quantity: c.quantity }))
      );
    } catch (err) {
      console.error(err);
      alert("Failed to update components");
    }
  };

  const activePhoto = photos.find(p => p.id === activePhotoId);
  const rootPhotos = photos
    .filter(p => p.parent_hotspot_id === null)
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0) || new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime());

  // Views drag and drop reordering state
  const isDraggingRef = useRef(false);
  const [draggedPhotoId, setDraggedPhotoId] = useState<string | null>(null);
  const [dragOverState, setDragOverState] = useState<{ id: string; position: 'before' | 'after' } | null>(null);

  const handleReorderViews = async (newOrderedRootPhotos: SpatialPhoto[]) => {
    // 1. Assign sequential order_index
    const updatedRootPhotos = newOrderedRootPhotos.map((photo, index) => ({
      ...photo,
      order_index: index,
    }));

    // 2. Optimistically update state
    setPhotos(prev => {
      const childPhotos = prev.filter(p => p.parent_hotspot_id !== null);
      return [...updatedRootPhotos, ...childPhotos];
    });

    // 3. Atomically persist to Supabase & Dexie
    try {
      const updates = updatedRootPhotos.map(p => ({
        id: p.id,
        order_index: p.order_index,
      }));
      await reorderSpatialPhotos(updates);
    } catch (err) {
      console.error("Failed to persist view order:", err);
      // Re-fetch to restore state if persistence failed
      try {
        const refreshed = await getPhotosForRoom(roomId);
        setPhotos(refreshed);
      } catch {}
    }
  };

  const handleDragStart = (e: React.DragEvent, photoId: string) => {
    isDraggingRef.current = true;
    setDraggedPhotoId(photoId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", photoId);
  };

  const handleDragOver = (e: React.DragEvent, targetPhoto: SpatialPhoto) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!draggedPhotoId || draggedPhotoId === targetPhoto.id) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const isDesktop = window.innerWidth >= 1024;
    let position: 'before' | 'after';
    if (isDesktop) {
      const midY = rect.top + rect.height / 2;
      position = e.clientY < midY ? 'before' : 'after';
    } else {
      const midX = rect.left + rect.width / 2;
      position = e.clientX < midX ? 'before' : 'after';
    }

    if (!dragOverState || dragOverState.id !== targetPhoto.id || dragOverState.position !== position) {
      setDragOverState({ id: targetPhoto.id, position });
    }
  };

  const handleDragLeave = (e: React.DragEvent, targetPhotoId: string) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      if (dragOverState?.id === targetPhotoId) {
        setDragOverState(null);
      }
    }
  };

  const handleDrop = async (e: React.DragEvent, targetPhoto: SpatialPhoto) => {
    e.preventDefault();
    const sourceId = draggedPhotoId || e.dataTransfer.getData("text/plain");
    const dropState = dragOverState;

    setDraggedPhotoId(null);
    setDragOverState(null);
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 100);

    if (!sourceId || sourceId === targetPhoto.id) return;

    const currentList = [...rootPhotos];
    const sourceIndex = currentList.findIndex(p => p.id === sourceId);
    if (sourceIndex === -1) return;

    const [movedItem] = currentList.splice(sourceIndex, 1);
    const targetIndex = currentList.findIndex(p => p.id === targetPhoto.id);
    if (targetIndex === -1) return;

    const insertIndex = dropState?.position === 'after' ? targetIndex + 1 : targetIndex;
    currentList.splice(insertIndex, 0, movedItem);

    await handleReorderViews(currentList);
  };

  const handleDragEnd = () => {
    setDraggedPhotoId(null);
    setDragOverState(null);
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 100);
  };

  const handleMoveView = async (photoId: string, direction: -1 | 1) => {
    const currentList = [...rootPhotos];
    const index = currentList.findIndex(p => p.id === photoId);
    if (index === -1) return;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= currentList.length) return;

    const [item] = currentList.splice(index, 1);
    currentList.splice(newIndex, 0, item);
    await handleReorderViews(currentList);
  };

  const handleSavePhotoLabel = async () => {
    if (!activePhotoId || !editingLabel.trim()) {
      setIsEditingPhotoLabel(false);
      return;
    }
    
    const newLabel = editingLabel.trim();
    try {
      await updatePhotoLabel(activePhotoId, newLabel);
      
      // Update local state
      setPhotos(prev => prev.map(p => p.id === activePhotoId ? { ...p, label: newLabel } : p));
      
      // Update breadcrumb
      setBreadcrumbChain(prev => {
        const newChain = [...prev];
        if (newChain.length > 0) {
          newChain[newChain.length - 1].label = newLabel;
        }
        return newChain;
      });
      
    } catch (err) {
      console.error(err);
      alert("Failed to update perspective name");
    } finally {
      setIsEditingPhotoLabel(false);
    }
  };

  const handleSaveRoomName = async () => {
    if (!editingRoomName.trim()) {
      setIsEditingRoomName(false);
      return;
    }
    const newName = editingRoomName.trim();
    try {
      await updateRoom(roomId, newName);
      setRoomName(newName);
    } catch (err) {
      console.error(err);
      alert("Failed to update room name");
    } finally {
      setIsEditingRoomName(false);
    }
  };

  const handleDeleteRoomAction = async () => {
    if (!confirm(`Are you sure you want to delete the room "${roomName}"? This will recursively delete all views, hotspots, and remove components stored within it.`)) return;
    try {
      await deleteRoom(roomId);
      router.push('/rooms');
    } catch (err) {
      console.error("Failed to delete room", err);
      alert("Failed to delete room");
    }
  };

  const handleDeletePhoto = async () => {
    if (!activePhotoId) return;
    if (!confirm("Are you sure you want to delete this view? This will recursively delete all child views, hotspots, and remove components stored within them.")) return;
    try {
      await deleteSpatialPhoto(activePhotoId);
      // Reset active photo to root or clear it, loadRoomData does this well.
      setActivePhotoId(null);
      setBreadcrumbChain([]);
      loadRoomData();
    } catch (err) {
      console.error(err);
      alert("Failed to delete view");
    }
  };

  const handleDeleteHotspot = async (hotspot: SpatialHotspot) => {
    if (!isOnline) {
      alert("You must be online to delete hotspots.");
      return;
    }

    const warningMsg = hotspot.is_leaf
      ? `Are you sure you want to delete the hotspot "${hotspot.label}"?\nAny components or personal items stored in this location will be unassigned from it.`
      : `Are you sure you want to delete the hotspot "${hotspot.label}"?\nThis hotspot opens into deeper storage views. Deleting it will permanently delete all child photos, nested hotspots, and remove stored items.`;

    if (!confirm(warningMsg)) return;

    try {
      await deleteHotspot(hotspot.id);
      
      if (selectedLeafHotspot?.id === hotspot.id) {
        setSelectedLeafHotspot(null);
      }
      
      setHotspots(prev => prev.filter(h => h.id !== hotspot.id));
      loadRoomData();
    } catch (err) {
      console.error("Failed to delete hotspot:", err);
      alert("Failed to delete hotspot. Please try again.");
    }
  };

  if (loading) return <div className="text-brand-text-muted">Loading room map...</div>;

  return (
    <div className="flex flex-col min-h-full pb-8">
      {/* Top Header */}
      <div className="mb-6 flex justify-between items-start">
        <div>
          <div className="flex items-center text-[10px] tracking-widest text-brand-text-muted uppercase mb-2 group/room">
            {isEditingRoomName ? (
              <input
                 type="text"
                 value={editingRoomName}
                 onChange={e => setEditingRoomName(e.target.value)}
                 onBlur={handleSaveRoomName}
                 onKeyDown={e => e.key === 'Enter' && handleSaveRoomName()}
                 className="bg-transparent border-b border-brand-accent focus:outline-none min-w-[150px] text-white"
                 autoFocus
              />
            ) : (
              <>
                <Link href="/rooms" className="hover:text-brand-accent transition-colors" title="Back to Spatial Map">
                  {roomName.length > 20 ? roomName.slice(0, 20) + '...' : roomName}
                </Link>
                {isOnline && (
                  <div className="opacity-0 group-hover/room:opacity-100 flex items-center transition-opacity ml-2 gap-1">
                    <button onClick={() => { setEditingRoomName(roomName); setIsEditingRoomName(true); }} className="hover:text-white" title="Rename Room">
                      <Edit2 className="h-3 w-3" />
                    </button>
                    <button onClick={handleDeleteRoomAction} className="text-red-500/50 hover:text-red-500" title="Delete Room">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </>
            )}
            
            {breadcrumbChain.map((bc, idx) => (
              <span key={bc.id} className="flex items-center ml-2">
                <ChevronRight className="h-3 w-3 mr-2 text-brand-text-muted" />
                <button 
                  type="button"
                  onClick={() => handleBreadcrumbClick(idx)}
                  className={`hover:text-brand-accent transition-colors ${idx === breadcrumbChain.length - 1 ? 'text-brand-accent font-bold' : 'text-brand-text'}`}
                  title={`Jump to ${bc.label}`}
                >
                  {bc.label}
                </button>
              </span>
            ))}
          </div>
          <h1 className="font-serif text-3xl font-bold text-white mb-1 group flex items-center h-10">
            {isEditingPhotoLabel ? (
              <input
                 type="text"
                 value={editingLabel}
                 onChange={e => setEditingLabel(e.target.value)}
                 onBlur={handleSavePhotoLabel}
                 onKeyDown={e => e.key === 'Enter' && handleSavePhotoLabel()}
                 className="bg-transparent border-b border-brand-accent focus:outline-none min-w-[200px]"
                 autoFocus
              />
            ) : (
              <>
                {breadcrumbChain[breadcrumbChain.length - 1]?.label || 'Storage Array'}
                {activePhoto && (
                  <button onClick={() => {
                    setEditingLabel(breadcrumbChain[breadcrumbChain.length - 1]?.label || 'View');
                    setIsEditingPhotoLabel(true);
                  }} className="ml-3 opacity-0 group-hover:opacity-100 text-brand-text-muted hover:text-white transition-opacity" title="Rename view">
                    <Edit2 className="h-4 w-4" />
                  </button>
                )}
              </>
            )}
          </h1>
          <p className="text-sm text-brand-text-muted">
            Interactive schematic of the primary electronics workbench and cabinetry.
          </p>
        </div>
        
        {activePhoto && !pendingChildUpload && (
          <div className="flex items-center gap-3">
            {/* Extendable Hotspots on this View Menu */}
            {isEditing && isOnline && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowHotspotsList(!showHotspotsList)}
                  className={`flex items-center px-3 py-2 text-xs font-bold uppercase tracking-widest border transition-all ${
                    showHotspotsList
                      ? 'bg-brand-accent/20 border-brand-accent text-brand-accent'
                      : 'bg-[#1a1816] border-[#332f2a] text-brand-text hover:border-[#4a443c] hover:text-white'
                  }`}
                  title="View and manage hotspots on this view"
                >
                  <MapPin className="h-3.5 w-3.5 mr-1.5 text-brand-accent" />
                  <span>Hotspots ({hotspots.length})</span>
                  <ChevronDown className={`h-3.5 w-3.5 ml-1.5 transition-transform duration-200 ${showHotspotsList ? 'rotate-180 text-brand-accent' : 'text-brand-text-muted'}`} />
                </button>

                {showHotspotsList && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowHotspotsList(false)} 
                    />
                    <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-[#1a1816] border border-[#332f2a] rounded-lg shadow-2xl z-50 overflow-hidden flex flex-col max-h-[28rem] animate-fadeIn">
                      <div className="flex items-center justify-between p-3.5 border-b border-[#332f2a] bg-black/40">
                        <div>
                          <div className="text-xs font-bold text-white uppercase tracking-wider">Hotspots on this View</div>
                          <div className="text-[10px] text-brand-text-muted mt-0.5">Click name to highlight & show • Click Delete to remove</div>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 bg-[#252320] border border-[#332f2a] text-brand-text-muted rounded-full font-mono">
                          {hotspots.length}
                        </span>
                      </div>

                      <div className="p-3 overflow-y-auto space-y-2">
                        {hotspots.length === 0 ? (
                          <div className="text-xs text-brand-text-muted text-center py-6 border border-dashed border-[#332f2a] rounded p-4">
                            No hotspots marked on this view yet. Use the Freehand or Polygon tools on the canvas to trace one.
                          </div>
                        ) : (
                          hotspots.map((hs) => {
                            const isHsHighlighted = highlightedHotspotId === hs.id;
                            return (
                              <div 
                                key={hs.id} 
                                onClick={() => {
                                  setHighlightedHotspotId(prev => prev === hs.id ? null : hs.id);
                                }}
                                className={`flex items-center justify-between p-2.5 border rounded transition-all cursor-pointer group ${
                                  isHsHighlighted
                                    ? 'bg-brand-accent/25 border-brand-accent shadow-[0_0_14px_rgba(188,115,83,0.35)] ring-1 ring-brand-accent'
                                    : 'bg-black/40 border-[#332f2a] hover:border-[#4a443c] hover:bg-black/60'
                                }`}
                                title="Click to highlight and locate on the map"
                              >
                                <div className="min-w-0 pr-2 flex items-center gap-2.5 flex-1">
                                  <div className={`p-1.5 rounded shrink-0 transition-colors ${
                                    isHsHighlighted ? 'bg-brand-accent text-white' : 'bg-[#252320] text-brand-text-muted group-hover:text-white'
                                  }`}>
                                    <MapPin className="h-3.5 w-3.5" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className={`text-sm font-bold truncate transition-colors ${
                                      isHsHighlighted ? 'text-white' : 'text-white/90 group-hover:text-brand-accent'
                                    }`}>
                                      {hs.label}
                                    </div>
                                    <div className="text-[10px] text-brand-text-muted tracking-wider uppercase flex items-center gap-1.5">
                                      <span>{hs.is_leaf ? "Storage Location" : "Opens into Storage"}</span>
                                      {isHsHighlighted && (
                                        <span className="text-[9px] font-bold text-brand-accent font-mono tracking-normal bg-brand-accent/20 px-1.5 py-0.5 rounded">
                                          HIGHLIGHTED
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteHotspot(hs);
                                  }}
                                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded transition-colors shrink-0"
                                  title={`Delete hotspot "${hs.label}"`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {isEditing && isOnline && (
              <button
                onClick={handleDeletePhoto}
                className="flex items-center px-4 py-2 text-xs font-bold uppercase tracking-widest border border-red-500/50 text-red-400 hover:bg-red-500/10 transition-colors"
                title="Delete View"
              >
                <Trash2 className="h-3 w-3 mr-2" /> Delete View
              </button>
            )}
            <button 
              onClick={() => {
                if (!isEditing) {
                  setSelectedLeafHotspot(null);
                } else {
                  setShowHotspotsList(false);
                }
                setIsEditing(!isEditing);
              }}
              className={`flex items-center px-4 py-2 text-xs font-bold uppercase tracking-widest border transition-colors ${
                isEditing 
                  ? 'bg-brand-accent border-brand-accent text-white' 
                  : 'bg-[#1a1816] border-[#332f2a] text-brand-text hover:border-[#4a443c]'
              }`}
            >
              {isEditing ? 'Done Editing' : (
                <><Edit2 className="h-3 w-3 mr-2" /> Edit Map</>
              )}
            </button>
          </div>
        )}
      </div>

      {pendingChildUpload && (
        <div className="mb-6 p-4 bg-brand-accent/10 border border-brand-accent/30 rounded-lg text-sm text-brand-text">
          <p className="mb-3 font-medium">Please upload the inside photo for <strong>{pendingChildUpload.label}</strong></p>
          <ImageUploadDropzone onUpload={handleChildUpload} isUploading={uploading} label="Upload Drill-down Photo" />
          <button 
            className="mt-3 text-brand-text-muted hover:text-white underline text-xs"
            onClick={() => setPendingChildUpload(null)}
          >
            Cancel upload
          </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row flex-1 gap-4 lg:gap-8 relative items-start">
        {/* Views Thumbnails */}
        <div className="w-full lg:w-64 shrink-0 flex flex-row lg:flex-col gap-4 overflow-x-auto lg:overflow-y-auto pb-2 lg:pr-2 lg:pb-4 hide-scrollbar lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)]">
          <div className="text-[10px] tracking-widest text-brand-text-muted uppercase font-medium">
            Views
          </div>
          {rootPhotos.map((p, index) => {
            const isSelected = breadcrumbChain[0]?.id === p.id;
            const isDragging = draggedPhotoId === p.id;
            const isOverBefore = dragOverState?.id === p.id && dragOverState.position === 'before';
            const isOverAfter = dragOverState?.id === p.id && dragOverState.position === 'after';

            return (
              <div
                key={p.id}
                draggable
                onDragStart={e => handleDragStart(e, p.id)}
                onDragOver={e => handleDragOver(e, p)}
                onDragLeave={e => handleDragLeave(e, p.id)}
                onDrop={e => handleDrop(e, p)}
                onDragEnd={handleDragEnd}
                className={`group relative h-24 w-36 lg:h-32 lg:w-full shrink-0 rounded overflow-hidden border-2 transition-all cursor-grab active:cursor-grabbing select-none ${
                  isSelected 
                    ? 'border-brand-accent opacity-100 shadow-[0_0_12px_rgba(217,119,6,0.25)]' 
                    : 'border-transparent opacity-60 hover:opacity-100'
                } ${isDragging ? 'opacity-30 scale-95 border-dashed border-brand-accent/60' : ''}`}
              >
                {/* Visual Drop Indicators */}
                {isOverBefore && (
                  <div className="absolute inset-x-0 top-0 h-1.5 lg:h-1.5 bg-brand-accent shadow-[0_0_8px_rgba(217,119,6,1)] z-30 pointer-events-none" />
                )}
                {isOverAfter && (
                  <div className="absolute inset-x-0 bottom-0 h-1.5 lg:h-1.5 bg-brand-accent shadow-[0_0_8px_rgba(217,119,6,1)] z-30 pointer-events-none" />
                )}

                {/* Card Button / Click Action */}
                <button
                  type="button"
                  onClick={() => {
                    if (isDraggingRef.current) return;
                    setActivePhotoId(p.id);
                    setBreadcrumbChain([{ id: p.id, label: p.label || 'View' }]);
                    resetViewInteractionState();
                  }}
                  className="w-full h-full text-left relative focus:outline-none"
                  title={`View: ${p.label || 'View'} (Drag to reorder)`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.image_url} alt={p.label || ''} className="w-full h-full object-cover pointer-events-none" />
                  
                  {/* Bottom gradient & label */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-2 text-left flex justify-between items-end pointer-events-none">
                    <span className="text-[10px] font-bold text-white tracking-wider truncate">{p.label}</span>
                    <span className="text-[9px] text-brand-text-muted font-mono ml-1">#{index + 1}</span>
                  </div>
                </button>

                {/* Drag Grip Handle */}
                <div 
                  className="absolute top-1.5 left-1.5 p-1 bg-black/60 backdrop-blur-xs rounded text-white/60 hover:text-white pointer-events-none transition-opacity opacity-70 group-hover:opacity-100" 
                  title="Drag to reorder"
                >
                  <GripVertical className="h-3.5 w-3.5" />
                </div>

                {/* Quick accessible reorder buttons on hover / focus */}
                <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                  {index > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveView(p.id, -1);
                      }}
                      className="p-1 bg-black/75 hover:bg-brand-accent rounded text-white/80 hover:text-white transition-colors"
                      title="Move view backward / up"
                    >
                      <ChevronUp className="h-3 w-3 hidden lg:block" />
                      <ChevronLeft className="h-3 w-3 lg:hidden" />
                    </button>
                  )}
                  {index < rootPhotos.length - 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveView(p.id, 1);
                      }}
                      className="p-1 bg-black/75 hover:bg-brand-accent rounded text-white/80 hover:text-white transition-colors"
                      title="Move view forward / down"
                    >
                      <ChevronDown className="h-3 w-3 hidden lg:block" />
                      <ChevronRight className="h-3 w-3 lg:hidden" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          
          {isOnline && (
            <div className="mt-2 lg:mt-2 shrink-0 h-24 w-36 lg:h-auto lg:w-full flex items-center justify-center">
              <label className="flex flex-col lg:flex-row items-center justify-center gap-2 w-full h-full lg:p-3 border border-dashed border-[#332f2a] rounded text-brand-text-muted hover:text-white hover:border-brand-accent cursor-pointer transition-colors bg-black/20 hover:bg-black/40">
                {uploading ? <span className="text-[10px] lg:text-xs">Uploading...</span> : (
                  <>
                    <Plus className="h-4 w-4" />
                    <span className="text-[10px] lg:text-xs uppercase tracking-widest font-bold text-center">Add View</span>
                  </>
                )}
                <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleUploadRootPhoto(e.target.files[0]);
                  }
                }} disabled={uploading} />
              </label>
            </div>
          )}
        </div>

        {/* Main Canvas Area */}
        <div className="flex-1 w-full bg-black/40 rounded-lg border border-[#332f2a] overflow-auto">
          {activePhoto ? (
            <HotspotCanvas 
              key={activePhoto.id}
              imageUrl={activePhoto.image_url} 
              hotspots={hotspots}
              isEditing={isEditing}
              highlightedHotspotId={highlightedHotspotId}
              onCancelEdit={() => setIsEditing(false)}
              onHotspotCreated={handleHotspotCreated}
              onHotspotClick={handleHotspotClick}
              onHotspotDelete={handleDeleteHotspot}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-brand-text-muted flex-col">
              <p className="mb-4 text-center">No views uploaded for this room yet.</p>
              {!uploading && (
                <div className="w-72">
                  <ImageUploadDropzone onUpload={handleUploadRootPhoto} isUploading={uploading} label="Upload First Photo" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Side Drawer for Leaf Hotspot */}
        {selectedLeafHotspot && (
          <div className="fixed inset-x-0 bottom-16 top-16 lg:static lg:sticky lg:top-4 lg:w-80 lg:self-start lg:max-h-[calc(100vh-6rem)] shrink-0 bg-[#1a1816] border-t lg:border border-[#332f2a] lg:rounded-lg flex flex-col overflow-hidden z-40 lg:z-auto shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[#332f2a] shrink-0">
              <h2 className="font-serif text-lg font-bold text-white tracking-widest uppercase truncate mr-2">{selectedLeafHotspot.label}</h2>
              <div className="flex items-center gap-1 shrink-0">
                {isOnline && (
                  <button 
                    onClick={() => handleDeleteHotspot(selectedLeafHotspot)}
                    className="p-1.5 text-brand-text-muted hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                    title={`Delete hotspot "${selectedLeafHotspot.label}"`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <button onClick={() => setSelectedLeafHotspot(null)} className="p-1.5 text-brand-text-muted hover:text-white transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[10px] tracking-widest text-brand-text-muted uppercase font-medium">Contents</div>
                <button
                  type="button"
                  onClick={() => setIsAddingComponent(prev => !prev)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider transition-all border ${
                    isAddingComponent
                      ? 'bg-brand-accent border-brand-accent text-white'
                      : 'bg-brand-accent/15 border-brand-accent/40 text-brand-accent hover:bg-brand-accent hover:text-white'
                  }`}
                  title="Add component to this location"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add</span>
                </button>
              </div>

              {leafComponents.length === 0 ? (
                <div className="text-sm text-brand-text-muted text-center py-6 border border-dashed border-[#332f2a] rounded flex flex-col items-center gap-2">
                  <span>This location is empty.</span>
                  {!isAddingComponent && (
                    <button
                      type="button"
                      onClick={() => setIsAddingComponent(true)}
                      className="mt-1 flex items-center gap-1 px-3 py-1.5 bg-[#2a2a2a] hover:bg-brand-accent text-white rounded text-xs font-medium transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Components</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {leafComponents.map(lc => (
                    <div key={lc.component_id} className="flex items-center justify-between bg-black/40 border border-[#332f2a] p-2.5 rounded group hover:border-[#4a443c] transition-colors">
                      <div className="flex flex-col flex-1 min-w-0 mr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm text-white font-medium truncate">{lc.components?.name || "Unknown Item"}</span>
                          {isPersonalItem(lc.components) && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-brand-gold/10 border border-brand-gold/40 text-brand-gold rounded uppercase tracking-wider font-semibold shrink-0">
                              Personal
                            </span>
                          )}
                        </div>
                        {lc.components?.notes && (
                          <span className="text-[10px] text-brand-text-muted truncate">{lc.components.notes}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Quantity Stepper */}
                        <div className="flex items-center border border-[#332f2a] rounded overflow-hidden bg-[#141311]">
                          <button
                            type="button"
                            onClick={() => {
                              const newQty = lc.quantity - 1;
                              if (newQty <= 0) {
                                handleUpdateLeafComponents(leafComponents.filter(c => c.component_id !== lc.component_id));
                              } else {
                                handleUpdateLeafComponents(leafComponents.map(c => c.component_id === lc.component_id ? { ...c, quantity: newQty } : c));
                              }
                            }}
                            className="px-1.5 py-0.5 text-brand-text-muted hover:text-white hover:bg-[#2a2a2a] transition-colors text-xs font-bold"
                            title="Decrease quantity"
                          >
                            -
                          </button>
                          <input 
                            type="number" 
                            min="1" 
                            value={lc.quantity}
                            onChange={(e) => {
                              const qty = parseInt(e.target.value, 10);
                              if (!isNaN(qty) && qty > 0) {
                                handleUpdateLeafComponents(leafComponents.map(c => c.component_id === lc.component_id ? { ...c, quantity: qty } : c));
                              }
                            }}
                            className="w-10 bg-transparent text-white text-xs text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-mono font-bold"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              handleUpdateLeafComponents(leafComponents.map(c => c.component_id === lc.component_id ? { ...c, quantity: lc.quantity + 1 } : c));
                            }}
                            className="px-1.5 py-0.5 text-brand-text-muted hover:text-white hover:bg-[#2a2a2a] transition-colors text-xs font-bold"
                            title="Increase quantity"
                          >
                            +
                          </button>
                        </div>
                        
                        <button 
                          type="button"
                          onClick={() => handleUpdateLeafComponents(leafComponents.filter(c => c.component_id !== lc.component_id))}
                          className="p-1 text-brand-text-muted hover:text-red-400 transition-colors opacity-70 group-hover:opacity-100"
                          title="Remove from location"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Components Panel */}
              {(isAddingComponent || isEditing) && (
                <div className="mt-4 border-t border-[#332f2a] pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] tracking-widest text-brand-text-muted uppercase font-medium">Add Items to Location</div>
                    <Link 
                      href="/inventory/new" 
                      className="text-[10px] text-brand-accent hover:underline flex items-center gap-1 font-semibold"
                      title="Create new item in inventory"
                    >
                      <Plus className="h-3 w-3" /> New Item
                    </Link>
                  </div>
                  
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-brand-text-muted" />
                    <input 
                      type="text" 
                      placeholder="Search inventory..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full bg-black/40 border border-[#332f2a] text-white text-sm pl-9 pr-3 py-2 rounded focus:border-brand-accent focus:outline-none"
                      autoFocus
                    />
                  </div>
                  
                  <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto pr-1">
                    {allInventory
                      .filter(c => !leafComponents.some(lc => lc.component_id === c.id))
                      .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.tags?.some(t => t.name.toLowerCase().includes(searchQuery.toLowerCase())))
                      .slice(0, 50)
                      .map(c => (
                      <button 
                        key={c.id}
                        type="button"
                        onClick={() => {
                          handleUpdateLeafComponents([...leafComponents, { component_id: c.id, quantity: 1, components: c }]);
                          setSearchQuery("");
                        }}
                        className="flex items-center justify-between p-2.5 text-left bg-black/20 hover:bg-[#2a2825] border border-transparent hover:border-[#332f2a] rounded transition-colors group"
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm text-brand-text group-hover:text-white font-medium truncate">{c.name}</span>
                            {isPersonalItem(c) && (
                              <span className="text-[8px] px-1 py-0.2 bg-brand-gold/10 border border-brand-gold/40 text-brand-gold rounded uppercase tracking-wider font-semibold shrink-0">
                                Personal
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-brand-text-muted">
                            Total: {c.totals?.total_owned_qty ?? 0} | In storage: {c.totals?.in_storage_qty ?? 0}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-brand-accent font-bold px-2 py-1 bg-brand-accent/10 rounded group-hover:bg-brand-accent group-hover:text-white transition-colors shrink-0">
                          <Plus className="h-3.5 w-3.5" />
                          <span>Add</span>
                        </div>
                      </button>
                    ))}

                    {allInventory.filter(c => !leafComponents.some(lc => lc.component_id === c.id)).filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                      <div className="text-center py-4 text-xs text-brand-text-muted border border-dashed border-[#332f2a] rounded">
                        {searchQuery ? `No items match "${searchQuery}"` : "All inventory items are already in this location"}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
