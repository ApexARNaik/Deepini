"use client";

import { useState, useEffect } from "react";
import { SpatialPhoto, SpatialHotspot, getPhotosForRoom, getHotspotsForPhoto, uploadPhotoAndCreate, createHotspot, getFullHotspotPath, getInventory, ComponentWithTotals, getHotspotComponents, updateHotspotComponents, getRoom, updatePhotoLabel } from "@/lib/api";
import { HotspotCanvas } from "./HotspotCanvas";
import { ImageUploadDropzone } from "./ImageUploadDropzone";
import { ChevronRight, Plus, Edit2, X, Search, Archive } from "lucide-react";
import { useNetworkState } from "@/hooks/useNetworkState";
import Link from "next/link";

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
      const newPhoto = await uploadPhotoAndCreate(file, roomId, null, `View ${photos.filter(p => !p.parent_hotspot_id).length + 1}`);
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

  const navigateToDrilldown = (hotspot: SpatialHotspot, childPhotoId: string) => {
    setBreadcrumbChain(prev => [...prev, { id: childPhotoId, label: hotspot.label }]);
    setActivePhotoId(childPhotoId);
  };

  const handleHotspotClick = async (hotspot: SpatialHotspot) => {
    if (hotspot.is_leaf) {
      setSelectedLeafHotspot(hotspot);
      try {
        const comps = await getHotspotComponents(hotspot.id);
        setLeafComponents(comps);
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
    setActivePhotoId(target.id);
    setBreadcrumbChain(prev => prev.slice(0, index + 1));
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
  const rootPhotos = photos.filter(p => p.parent_hotspot_id === null);

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

  if (loading) return <div className="text-brand-text-muted">Loading room map...</div>;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top Header */}
      <div className="mb-6 flex justify-between items-start">
        <div>
          <div className="flex items-center text-[10px] tracking-widest text-brand-text-muted uppercase mb-2">
            <Link href="/rooms" className="hover:text-brand-accent transition-colors" title="Back to Spatial Map">
              {roomName.length > 10 ? roomName.slice(0, 10) + '...' : roomName}
            </Link>
            {breadcrumbChain.map((bc, idx) => (
              <span key={bc.id} className="flex items-center">
                <ChevronRight className="h-3 w-3 mx-1" />
                <button 
                  onClick={() => handleBreadcrumbClick(idx)}
                  className={`hover:text-brand-accent transition-colors ${idx === breadcrumbChain.length - 1 ? 'text-brand-accent font-bold' : ''}`}
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
          <div className="flex gap-3">
            <button 
              onClick={() => setIsEditing(!isEditing)}
              className={`flex items-center px-4 py-2 text-xs font-bold uppercase tracking-widest border transition-colors ${
                isEditing 
                  ? 'bg-brand-accent border-brand-accent text-white' 
                  : 'bg-[#1a1816] border-[#332f2a] text-brand-text hover:border-[#4a443c]'
              }`}
            >
              {isEditing ? 'Cancel Edit' : (
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

      <div className="flex flex-col lg:flex-row flex-1 gap-4 lg:gap-8 min-h-0 relative">
        {/* Views Thumbnails */}
        <div className="w-full lg:w-64 shrink-0 flex flex-row lg:flex-col gap-4 overflow-x-auto lg:overflow-y-auto pb-2 lg:pr-2 lg:pb-4 hide-scrollbar">
          <div className="text-[10px] tracking-widest text-brand-text-muted uppercase font-medium">
            Views
          </div>
          {rootPhotos.map(p => (
            <button
              key={p.id}
              onClick={() => {
                setActivePhotoId(p.id);
                setBreadcrumbChain([{ id: p.id, label: p.label || 'View' }]);
                setPendingChildUpload(null);
                setIsEditing(false);
              }}
              className={`relative h-24 w-36 lg:h-32 lg:w-full shrink-0 rounded overflow-hidden border-2 transition-all ${
                breadcrumbChain[0]?.id === p.id 
                  ? 'border-brand-accent opacity-100' 
                  : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.image_url} alt={p.label || ''} className="w-full h-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 p-2 text-left flex justify-between items-end">
                <span className="text-[10px] font-bold text-white tracking-wider truncate">{p.label}</span>
              </div>
            </button>
          ))}
          
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
        <div className="flex-1 bg-black/40 rounded-lg overflow-hidden border border-[#332f2a]">
          {activePhoto ? (
            <HotspotCanvas 
              imageUrl={activePhoto.image_url} 
              hotspots={hotspots}
              isEditing={isEditing}
              highlightedHotspotId={highlightedHotspotId}
              onCancelEdit={() => setIsEditing(false)}
              onHotspotCreated={handleHotspotCreated}
              onHotspotClick={handleHotspotClick}
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
          <div className="fixed inset-x-0 bottom-16 top-16 lg:static lg:w-80 shrink-0 bg-[#1a1816] border-t lg:border border-[#332f2a] lg:rounded-lg flex flex-col overflow-hidden z-40 lg:z-auto">
            <div className="flex items-center justify-between p-4 border-b border-[#332f2a] shrink-0">
              <h2 className="font-serif text-lg font-bold text-white tracking-widest uppercase">{selectedLeafHotspot.label}</h2>
              <button onClick={() => setSelectedLeafHotspot(null)} className="text-brand-text-muted hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto">
              <div className="text-[10px] tracking-widest text-brand-text-muted uppercase mb-3">Contents</div>
              {leafComponents.length === 0 ? (
                <div className="text-sm text-brand-text-muted text-center py-6 border border-dashed border-[#332f2a] rounded">
                  This location is empty.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {leafComponents.map(lc => (
                    <div key={lc.component_id} className="flex items-center justify-between bg-black/40 border border-[#332f2a] p-3 rounded">
                      <div className="flex flex-col flex-1 min-w-0 mr-3">
                        <span className="text-sm text-white font-medium truncate">{lc.components?.name || "Unknown Component"}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {isEditing ? (
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
                            className="w-16 bg-[#1a1816] border border-[#332f2a] text-white p-1 text-xs text-center focus:border-brand-accent focus:outline-none"
                          />
                        ) : (
                          <span className="text-xs font-bold text-brand-accent px-2 py-1 bg-brand-accent/10 rounded">x{lc.quantity}</span>
                        )}
                        
                        {isEditing && (
                          <button 
                            onClick={() => handleUpdateLeafComponents(leafComponents.filter(c => c.component_id !== lc.component_id))}
                            className="text-brand-text-muted hover:text-red-400"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {isEditing && (
                <div className="mt-6 border-t border-[#332f2a] pt-4">
                  <div className="text-[10px] tracking-widest text-brand-text-muted uppercase mb-3">Add Components</div>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-brand-text-muted" />
                    <input 
                      type="text" 
                      placeholder="Search inventory..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full bg-black/40 border border-[#332f2a] text-white text-sm pl-9 pr-3 py-2 focus:border-brand-accent focus:outline-none"
                    />
                  </div>
                  
                  <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                    {allInventory
                      .filter(c => !leafComponents.some(lc => lc.component_id === c.id))
                      .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                      .slice(0, 50)
                      .map(c => (
                      <button 
                        key={c.id}
                        onClick={() => {
                          handleUpdateLeafComponents([...leafComponents, { component_id: c.id, quantity: 1, components: c }]);
                          setSearchQuery("");
                        }}
                        className="flex items-center justify-between p-2 text-left hover:bg-[#332f2a] rounded transition-colors group"
                      >
                        <span className="text-sm text-brand-text group-hover:text-white truncate pr-2">{c.name}</span>
                        <Plus className="h-4 w-4 text-brand-text-muted group-hover:text-brand-accent shrink-0" />
                      </button>
                    ))}
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
