"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { SpatialPhoto, SpatialHotspot, getPhotosForRoom, getHotspotsForPhoto, getHotspotById, uploadPhotoAndCreate, replaceSpatialPhoto, batchUpdateHotspotPoints, insertIntermediateSpatialPhoto, createHotspot, updateHotspot, getFullHotspotPath, getInventory, ComponentWithTotals, getHotspotComponents, updateHotspotComponents, getRoom, updatePhotoLabel, deleteSpatialPhoto, deleteHotspot, updateRoom, deleteRoom, reorderSpatialPhotos, isPersonalItem, undoInsertIntermediateSpatialPhoto, undoReplaceSpatialPhoto, restoreDeletedHotspot } from "@/lib/api";
import { HotspotCanvas } from "./HotspotCanvas";
import { HotspotConfigModal } from "./HotspotConfigModal";
import { ImageUploadDropzone } from "./ImageUploadDropzone";
import { InsertIntermediateModal } from "./InsertIntermediateModal";
import { ChevronRight, ChevronLeft, ChevronUp, ChevronDown, Plus, Edit2, X, Search, Archive, Trash2, GripVertical, MapPin, Crop, ImageIcon, RefreshCw, Layers, RotateCcw } from "lucide-react";
import { useNetworkState } from "@/hooks/useNetworkState";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type UndoAction =
  | {
      id: string;
      timestamp: number;
      type: 'insert_intermediate_photo';
      description: string;
      data: {
        parentHotspotId: string;
        intermediatePhotoId: string;
        intermediateHotspotId: string;
        childPhotoId: string;
        previousActivePhotoId: string;
        previousBreadcrumbChain: { id: string; label: string }[];
        previousParentHotspot: SpatialHotspot;
        previousChildPhoto: SpatialPhoto;
      };
    }
  | {
      id: string;
      timestamp: number;
      type: 'replace_photo_image';
      description: string;
      data: {
        photoId: string;
        previousImageUrl: string;
        previousHotspots: SpatialHotspot[];
      };
    }
  | {
      id: string;
      timestamp: number;
      type: 'create_hotspot';
      description: string;
      data: {
        createdHotspotId: string;
        photoId: string;
        createdHotspot: SpatialHotspot;
      };
    }
  | {
      id: string;
      timestamp: number;
      type: 'reshape_hotspot';
      description: string;
      data: {
        hotspotId: string;
        photoId: string;
        previousShapePoints: { x: number; y: number }[];
      };
    }
  | {
      id: string;
      timestamp: number;
      type: 'batch_update_hotspots';
      description: string;
      data: {
        photoId: string;
        previousHotspots: { id: string; shape_points: { x: number; y: number }[] }[];
      };
    }
  | {
      id: string;
      timestamp: number;
      type: 'update_hotspot_details';
      description: string;
      data: {
        hotspotId: string;
        photoId: string;
        previousHotspot: SpatialHotspot;
      };
    }
  | {
      id: string;
      timestamp: number;
      type: 'update_photo_label';
      description: string;
      data: {
        photoId: string;
        previousLabel: string;
      };
    }
  | {
      id: string;
      timestamp: number;
      type: 'reorder_photos';
      description: string;
      data: {
        previousPhotoOrders: { id: string; order_index: number }[];
        previousPhotosList: SpatialPhoto[];
      };
    }
  | {
      id: string;
      timestamp: number;
      type: 'delete_hotspot';
      description: string;
      data: {
        deletedHotspot: SpatialHotspot;
        deletedComponentLocations: { component_id: string; quantity: number }[];
      };
    };

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
  const [editingHotspot, setEditingHotspot] = useState<SpatialHotspot | null>(null);
  const [reshapingHotspot, setReshapingHotspot] = useState<SpatialHotspot | null>(null);
  const [replacingImage, setReplacingImage] = useState(false);
  const [replaceImageNotice, setReplaceImageNotice] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [isUndoing, setIsUndoing] = useState(false);

  const pushUndoAction = useCallback((action: UndoAction) => {
    setUndoStack(prev => [...prev.slice(-29), action]);
  }, []);

  const [insertIntermediateTarget, setInsertIntermediateTarget] = useState<{
    parentHotspot: SpatialHotspot;
    childPhoto: SpatialPhoto;
  } | null>(null);
  const [isInsertingIntermediate, setIsInsertingIntermediate] = useState(false);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);
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
      pushUndoAction({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        type: 'create_hotspot',
        description: `Create hotspot "${newHotspot.label}"`,
        data: {
          createdHotspotId: newHotspot.id,
          photoId: activePhotoId,
          createdHotspot: JSON.parse(JSON.stringify(newHotspot))
        }
      });
    } catch (err) {
      console.error(err);
      alert("Failed to save hotspot");
    }
  };

  const handleUpdateHotspotDetails = async (hotspotId: string, newLabel: string, newIsLeaf: boolean) => {
    const existing = hotspots.find(h => h.id === hotspotId);
    try {
      await updateHotspot(hotspotId, {
        label: newLabel,
        is_leaf: newIsLeaf
      });
      
      if (existing) {
        pushUndoAction({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          type: 'update_hotspot_details',
          description: `Edit hotspot "${newLabel}"`,
          data: {
            hotspotId,
            photoId: existing.photo_id,
            previousHotspot: JSON.parse(JSON.stringify(existing))
          }
        });
      }

      setHotspots(prev => prev.map(h => h.id === hotspotId ? { ...h, label: newLabel, is_leaf: newIsLeaf } : h));

      // If this hotspot was open in the leaf side drawer
      if (selectedLeafHotspot?.id === hotspotId) {
        if (newIsLeaf) {
          setSelectedLeafHotspot(prev => prev ? { ...prev, label: newLabel, is_leaf: true } : null);
        } else {
          // Converted from leaf to drilldown! Close leaf drawer and prompt for child upload
          setSelectedLeafHotspot(null);
          setPendingChildUpload({ ...selectedLeafHotspot, label: newLabel, is_leaf: false });
        }
      }

      // If this hotspot was pending child photo upload
      if (pendingChildUpload?.id === hotspotId) {
        if (!newIsLeaf) {
          setPendingChildUpload(prev => prev ? { ...prev, label: newLabel, is_leaf: false } : null);
        } else {
          // Converted from drilldown to leaf! Close upload card and open leaf components drawer
          const updatedLeaf = { ...pendingChildUpload, label: newLabel, is_leaf: true };
          setPendingChildUpload(null);
          handleHotspotClick(updatedLeaf);
        }
      }

      setEditingHotspot(null);
    } catch (err) {
      console.error("Failed to update hotspot:", err);
      alert("Failed to update hotspot details");
    }
  };

  const getImageDimensions = (urlOrBlob: string): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = reject;
      img.src = urlOrBlob;
    });
  };

  const handleStartReshape = (hotspot: SpatialHotspot) => {
    setReshapingHotspot(hotspot);
    setIsEditing(true);
    setEditingHotspot(null);
  };

  const handleConfirmReshape = async (hotspotId: string, newPoints: { x: number; y: number }[]) => {
    const target = hotspots.find(h => h.id === hotspotId) || reshapingHotspot;
    const previousShapePoints = target?.shape_points
      ? JSON.parse(JSON.stringify(target.shape_points))
      : [];
    try {
      await updateHotspot(hotspotId, { shape_points: newPoints });
      setHotspots(prev => prev.map(h => h.id === hotspotId ? { ...h, shape_points: newPoints } : h));
      if (selectedLeafHotspot?.id === hotspotId) {
        setSelectedLeafHotspot(prev => prev ? { ...prev, shape_points: newPoints } : null);
      }
      if (target) {
        pushUndoAction({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          type: 'reshape_hotspot',
          description: `Reshape hotspot "${target.label}"`,
          data: {
            hotspotId,
            photoId: target.photo_id,
            previousShapePoints
          }
        });
      }
      setReshapingHotspot(null);
    } catch (err) {
      console.error("Failed to reshape hotspot:", err);
      alert("Failed to save new hotspot shape");
    }
  };

  const handleCancelReshape = () => {
    setReshapingHotspot(null);
  };

  const handleBatchUpdateHotspots = async (updates: { id: string; shape_points: { x: number; y: number }[] }[]) => {
    const previousHotspots = updates.map(u => {
      const existing = hotspots.find(h => h.id === u.id);
      return {
        id: u.id,
        shape_points: existing?.shape_points
          ? JSON.parse(JSON.stringify(existing.shape_points))
          : []
      };
    });
    try {
      await batchUpdateHotspotPoints(updates);
      const updateMap = new Map(updates.map(u => [u.id, u.shape_points]));
      setHotspots(prev => prev.map(h => updateMap.has(h.id) ? { ...h, shape_points: updateMap.get(h.id)! } : h));
      if (selectedLeafHotspot && updateMap.has(selectedLeafHotspot.id)) {
        setSelectedLeafHotspot(prev => prev ? { ...prev, shape_points: updateMap.get(selectedLeafHotspot.id)! } : null);
      }
      pushUndoAction({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        type: 'batch_update_hotspots',
        description: `Adjust ${updates.length} hotspots`,
        data: {
          photoId: activePhotoId || '',
          previousHotspots
        }
      });
    } catch (err) {
      console.error("Failed to batch update hotspots:", err);
      alert("Failed to save adjusted hotspot positions");
    }
  };

  const handleReplaceImageFile = async (file: File) => {
    if (!activePhotoId || !activePhoto) return;
    setReplacingImage(true);
    const previousImageUrl = activePhoto.image_url;
    const previousHotspots = JSON.parse(JSON.stringify(hotspots));
    try {
      // 1. Measure dimensions of old and new images to determine if framing is preserved
      let oldDims = { width: 1, height: 1 };
      try {
        oldDims = await getImageDimensions(activePhoto.image_url);
      } catch (err) {
        console.warn("Could not determine old image dimensions", err);
      }

      const objectUrl = URL.createObjectURL(file);
      let newDims = { width: 1, height: 1 };
      try {
        newDims = await getImageDimensions(objectUrl);
      } catch (err) {
        console.warn("Could not determine new image dimensions", err);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }

      const oldAspect = oldDims.width / (oldDims.height || 1);
      const newAspect = newDims.width / (newDims.height || 1);
      const aspectDelta = Math.abs(oldAspect - newAspect) / (oldAspect || 1);
      const isSameFraming = aspectDelta < 0.04; // Proportional scaling when framing is genuinely the same

      // Clamp normalized coordinates within [0.005, 0.995] to prevent edge overflows.
      // For changed/cropped aspect ratios, preserve normalized coordinates directly (no blind distortion/scaling)
      // and provide the Adjust Hotspots workflow for manual correction.
      const clampedUpdates: { id: string; shape_points: { x: number; y: number }[] }[] = [];
      let hadClamping = false;

      for (const hs of hotspots) {
        if (hs.shape_points && hs.shape_points.length > 0) {
          let changed = false;
          const newPts = hs.shape_points.map(pt => {
            const cx = Math.max(0.005, Math.min(0.995, pt.x));
            const cy = Math.max(0.005, Math.min(0.995, pt.y));
            if (cx !== pt.x || cy !== pt.y) changed = true;
            return { x: cx, y: cy };
          });
          if (changed) hadClamping = true;
          clampedUpdates.push({ id: hs.id, shape_points: newPts });
        }
      }

      // 2. Upload image and update spatial_photos table (Supabase & Dexie)
      // All hotspot IDs, component links, and child photos remain 100% intact!
      const newImageUrl = await replaceSpatialPhoto(activePhotoId, file);

      // 3. Persist clamped points if any
      if (hadClamping && clampedUpdates.length > 0) {
        await batchUpdateHotspotPoints(clampedUpdates);
        const updateMap = new Map(clampedUpdates.map(u => [u.id, u.shape_points]));
        setHotspots(prev => prev.map(h => updateMap.has(h.id) ? { ...h, shape_points: updateMap.get(h.id)! } : h));
      }

      // 4. Update local photos state with the new image URL
      setPhotos(prev => prev.map(p => p.id === activePhotoId ? { ...p, image_url: newImageUrl } : p));

      pushUndoAction({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        type: 'replace_photo_image',
        description: `Replace image on "${activePhoto.label || 'View'}"`,
        data: {
          photoId: activePhotoId,
          previousImageUrl,
          previousHotspots
        }
      });

      if (!isSameFraming) {
        setReplaceImageNotice(
          "Image replaced! Because the aspect ratio changed, hotspots were kept at their normalized positions. You can use the 'Adjust Hotspots' tool in Edit mode to adjust them collectively if needed."
        );
      } else {
        setReplaceImageNotice("Image replaced successfully! All hotspots and assignments preserved.");
      }
      setTimeout(() => setReplaceImageNotice(null), 8000);
    } catch (err) {
      console.error("Failed to replace image:", err);
      alert("Failed to replace image. Please try again.");
    } finally {
      setReplacingImage(false);
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

  const handleOpenInsertIntermediate = (parentHotspot: SpatialHotspot) => {
    // Find child photo
    const childPhoto = photos.find(p => p.id === parentHotspot.child_photo_id || p.parent_hotspot_id === parentHotspot.id);
    if (!childPhoto) {
      alert("Child view for this hotspot could not be found.");
      return;
    }
    setInsertIntermediateTarget({ parentHotspot, childPhoto });
    setEditingHotspot(null);
    setShowHotspotsList(false);
  };

  const handleOpenInsertIntermediateFromChild = async () => {
    if (!activePhoto || !activePhoto.parent_hotspot_id) return;
    try {
      const parentHs = await getHotspotById(activePhoto.parent_hotspot_id);
      if (parentHs) {
        setInsertIntermediateTarget({ parentHotspot: parentHs, childPhoto: activePhoto });
      } else {
        alert("Parent hotspot for this view could not be found.");
      }
    } catch (err) {
      console.error("Failed to find parent hotspot:", err);
      alert("Failed to locate parent hotspot.");
    }
  };

  const handleExecuteInsertIntermediate = async (data: { file: File; photoLabel: string; hotspotLabel: string }) => {
    if (!insertIntermediateTarget) return;
    const { parentHotspot, childPhoto } = insertIntermediateTarget;
    const prevActiveId = activePhotoId || parentHotspot.photo_id;
    const prevBreadcrumbs = JSON.parse(JSON.stringify(breadcrumbChain));
    const prevParentHotspot = JSON.parse(JSON.stringify(parentHotspot));
    const prevChildPhoto = JSON.parse(JSON.stringify(childPhoto));

    setIsInsertingIntermediate(true);
    try {
      const { newPhoto, newHotspot } = await insertIntermediateSpatialPhoto({
        roomId,
        parentHotspotId: parentHotspot.id,
        childPhotoId: childPhoto.id,
        file: data.file,
        photoLabel: data.photoLabel,
        hotspotLabel: data.hotspotLabel
      });

      // 1. Update photos state: add newPhoto and update childPhoto's parent_hotspot_id
      setPhotos(prev => [
        ...prev.map(p => p.id === childPhoto.id ? { ...p, parent_hotspot_id: newHotspot.id } : p),
        newPhoto
      ]);

      // 2. Update hotspots state: update parentHotspot's child_photo_id
      setHotspots(prev => prev.map(h => h.id === parentHotspot.id ? { ...h, child_photo_id: newPhoto.id } : h));

      pushUndoAction({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        type: 'insert_intermediate_photo',
        description: `Insert view "${newPhoto.label}"`,
        data: {
          parentHotspotId: parentHotspot.id,
          intermediatePhotoId: newPhoto.id,
          intermediateHotspotId: newHotspot.id,
          childPhotoId: childPhoto.id,
          previousActivePhotoId: prevActiveId,
          previousBreadcrumbChain: prevBreadcrumbs,
          previousParentHotspot: prevParentHotspot,
          previousChildPhoto: prevChildPhoto
        }
      });

      // 3. Close modal
      setInsertIntermediateTarget(null);

      // 4. Navigate into the new intermediate photo
      const path = await getFullHotspotPath(newHotspot.id);
      const photoNodes = path.filter(p => p.type === 'photo');
      if (photoNodes.length > 0) {
        setBreadcrumbChain(photoNodes.map(p => ({ id: p.id, label: p.label })));
      } else {
        setBreadcrumbChain(prev => [...prev.slice(0, -1), { id: newPhoto.id, label: newPhoto.label || 'View' }]);
      }
      setActivePhotoId(newPhoto.id);
      setHighlightedHotspotId(newHotspot.id);
      setIsEditing(true);

      setReplaceImageNotice(
        `Intermediate view "${newPhoto.label}" created! Hotspot "${newHotspot.label}" connects to "${childPhoto.label}". You can resize or adjust it.`
      );
      setTimeout(() => setReplaceImageNotice(null), 8000);
    } catch (err: any) {
      console.error("Failed to insert intermediate view:", err);
      alert(err.message || "Failed to insert intermediate view");
    } finally {
      setIsInsertingIntermediate(false);
    }
  };

  const handleUndo = useCallback(async () => {
    if (undoStack.length === 0 || isUndoing) return;
    setIsUndoing(true);
    const action = undoStack[undoStack.length - 1];
    try {
      switch (action.type) {
        case 'insert_intermediate_photo': {
          const {
            parentHotspotId,
            intermediatePhotoId,
            intermediateHotspotId,
            childPhotoId,
            previousActivePhotoId,
            previousBreadcrumbChain
          } = action.data;

          await undoInsertIntermediateSpatialPhoto({
            parentHotspotId,
            intermediatePhotoId,
            intermediateHotspotId,
            childPhotoId
          });

          setPhotos(prev =>
            prev
              .filter(p => p.id !== intermediatePhotoId)
              .map(p => (p.id === childPhotoId ? { ...p, parent_hotspot_id: parentHotspotId } : p))
          );

          setHotspots(prev =>
            prev
              .filter(h => h.id !== intermediateHotspotId)
              .map(h => (h.id === parentHotspotId ? { ...h, child_photo_id: childPhotoId } : h))
          );

          setActivePhotoId(previousActivePhotoId);
          setBreadcrumbChain(previousBreadcrumbChain);
          setHighlightedHotspotId(null);
          break;
        }

        case 'replace_photo_image': {
          const { photoId, previousImageUrl, previousHotspots } = action.data;
          const hotspotUpdates = previousHotspots.map(h => ({
            id: h.id,
            shape_points: h.shape_points || []
          }));

          await undoReplaceSpatialPhoto({
            photoId,
            previousImageUrl,
            previousHotspotsUpdates: hotspotUpdates
          });

          setPhotos(prev => prev.map(p => (p.id === photoId ? { ...p, image_url: previousImageUrl } : p)));
          if (activePhotoId === photoId) {
            setHotspots(previousHotspots);
          }
          break;
        }

        case 'create_hotspot': {
          const { createdHotspotId } = action.data;
          await deleteHotspot(createdHotspotId);
          setHotspots(prev => prev.filter(h => h.id !== createdHotspotId));
          if (selectedLeafHotspot?.id === createdHotspotId) {
            setSelectedLeafHotspot(null);
          }
          break;
        }

        case 'reshape_hotspot': {
          const { hotspotId, previousShapePoints } = action.data;
          await updateHotspot(hotspotId, { shape_points: previousShapePoints });
          setHotspots(prev =>
            prev.map(h => (h.id === hotspotId ? { ...h, shape_points: previousShapePoints } : h))
          );
          if (selectedLeafHotspot?.id === hotspotId) {
            setSelectedLeafHotspot(prev => (prev ? { ...prev, shape_points: previousShapePoints } : null));
          }
          break;
        }

        case 'batch_update_hotspots': {
          const { previousHotspots } = action.data;
          await batchUpdateHotspotPoints(previousHotspots);
          const updateMap = new Map(previousHotspots.map(u => [u.id, u.shape_points]));
          setHotspots(prev =>
            prev.map(h => (updateMap.has(h.id) ? { ...h, shape_points: updateMap.get(h.id)! } : h))
          );
          if (selectedLeafHotspot && updateMap.has(selectedLeafHotspot.id)) {
            setSelectedLeafHotspot(prev =>
              prev ? { ...prev, shape_points: updateMap.get(selectedLeafHotspot.id)! } : null
            );
          }
          break;
        }

        case 'update_hotspot_details': {
          const { hotspotId, previousHotspot } = action.data;
          await updateHotspot(hotspotId, {
            label: previousHotspot.label,
            is_leaf: previousHotspot.is_leaf
          });
          setHotspots(prev =>
            prev.map(h =>
              h.id === hotspotId
                ? { ...h, label: previousHotspot.label, is_leaf: previousHotspot.is_leaf }
                : h
            )
          );
          if (selectedLeafHotspot?.id === hotspotId) {
            setSelectedLeafHotspot(prev =>
              prev ? { ...prev, label: previousHotspot.label, is_leaf: previousHotspot.is_leaf } : null
            );
          }
          break;
        }

        case 'update_photo_label': {
          const { photoId, previousLabel } = action.data;
          await updatePhotoLabel(photoId, previousLabel);
          setPhotos(prev => prev.map(p => (p.id === photoId ? { ...p, label: previousLabel } : p)));
          setBreadcrumbChain(prev => {
            const newChain = [...prev];
            if (newChain.length > 0 && newChain[newChain.length - 1].id === photoId) {
              newChain[newChain.length - 1].label = previousLabel;
            }
            return newChain;
          });
          break;
        }

        case 'reorder_photos': {
          const { previousPhotoOrders } = action.data;
          await reorderSpatialPhotos(previousPhotoOrders);
          setPhotos(prev => {
            const orderMap = new Map(previousPhotoOrders.map(p => [p.id, p.order_index]));
            return prev.map(p => (orderMap.has(p.id) ? { ...p, order_index: orderMap.get(p.id)! } : p));
          });
          break;
        }

        case 'delete_hotspot': {
          const { deletedHotspot, deletedComponentLocations } = action.data;
          await restoreDeletedHotspot(deletedHotspot, deletedComponentLocations);
          setHotspots(prev => [...prev, deletedHotspot]);
          break;
        }
      }

      setUndoStack(prev => prev.slice(0, -1));
      setReplaceImageNotice(`Undid: ${action.description}`);
      setTimeout(() => setReplaceImageNotice(null), 5000);
    } catch (err: any) {
      console.error("Undo failed:", err);
      alert(err.message || "Failed to undo action");
    } finally {
      setIsUndoing(false);
    }
  }, [undoStack, isUndoing, activePhotoId, selectedLeafHotspot]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo]);

  const resetViewInteractionState = () => {
    setIsEditing(false);
    setReshapingHotspot(null);
    setSelectedLeafHotspot(null);
    setHighlightedHotspotId(null);
    setPendingChildUpload(null);
    setShowHotspotsList(false);
    setInsertIntermediateTarget(null);

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
    const previousPhotoOrders = rootPhotos.map(p => ({ id: p.id, order_index: p.order_index }));
    const previousPhotosList = JSON.parse(JSON.stringify(rootPhotos));

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
      pushUndoAction({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        type: 'reorder_photos',
        description: 'Reorder views',
        data: {
          previousPhotoOrders,
          previousPhotosList
        }
      });
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
    const previousLabel = breadcrumbChain[breadcrumbChain.length - 1]?.label || activePhoto?.label || 'View';
    if (newLabel === previousLabel) {
      setIsEditingPhotoLabel(false);
      return;
    }
    try {
      await updatePhotoLabel(activePhotoId, newLabel);
      pushUndoAction({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        type: 'update_photo_label',
        description: `Rename view to "${newLabel}"`,
        data: {
          photoId: activePhotoId,
          previousLabel
        }
      });
      
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
      // Serialize component assignments before deletion
      let serializedComps: { component_id: string; quantity: number }[] = [];
      try {
        const comps = await getHotspotComponents(hotspot.id);
        if (comps && Array.isArray(comps)) {
          serializedComps = comps.map((c: any) => ({ component_id: c.component_id, quantity: c.quantity }));
        }
      } catch (cErr) {
        console.warn("Could not serialize hotspot component locations before delete:", cErr);
      }

      await deleteHotspot(hotspot.id);

      pushUndoAction({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        type: 'delete_hotspot',
        description: `Delete hotspot "${hotspot.label}"`,
        data: {
          deletedHotspot: JSON.parse(JSON.stringify(hotspot)),
          deletedComponentLocations: serializedComps
        }
      });
      
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
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowHotspotsList(false);
                                      handleStartReshape(hs);
                                    }}
                                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 rounded transition-colors"
                                    title={`Redraw boundary shape for "${hs.label}"`}
                                  >
                                    <Crop className="h-3 w-3" />
                                    <span>Redraw</span>
                                  </button>
                                  {!hs.is_leaf && hs.child_photo_id && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenInsertIntermediate(hs);
                                      }}
                                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded transition-colors"
                                      title={`Insert an intermediate view between "${hs.label}" and its child view`}
                                    >
                                      <Layers className="h-3 w-3" />
                                      <span>Insert Step</span>
                                    </button>
                                  )}
                                  {!hs.child_photo_id && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingHotspot(hs);
                                      }}
                                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-brand-accent bg-brand-accent/10 hover:bg-brand-accent/20 border border-brand-accent/30 rounded transition-colors"
                                      title="Edit hotspot name and storage type"
                                    >
                                      <Edit2 className="h-3 w-3" />
                                      <span>Edit</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteHotspot(hs);
                                    }}
                                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded transition-colors"
                                    title={`Delete hotspot "${hs.label}"`}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                    <span>Delete</span>
                                  </button>
                                </div>
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
              <>
                {activePhoto.parent_hotspot_id && (
                  <button
                    type="button"
                    onClick={handleOpenInsertIntermediateFromChild}
                    disabled={replacingImage}
                    className="flex items-center px-3.5 py-2 text-xs font-bold uppercase tracking-widest border border-amber-500/50 text-amber-300 hover:bg-amber-500/10 transition-colors disabled:opacity-50"
                    title="Insert an intermediate view above this view"
                  >
                    <Layers className="h-3 w-3 mr-1.5" />
                    <span>Insert View Above</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => replaceFileInputRef.current?.click()}
                  disabled={replacingImage}
                  className="flex items-center px-3.5 py-2 text-xs font-bold uppercase tracking-widest border border-amber-500/50 text-amber-300 hover:bg-amber-500/10 transition-colors disabled:opacity-50"
                  title="Replace this view's background image (preserves all hotspots & items)"
                >
                  {replacingImage ? (
                    <>
                      <RefreshCw className="h-3 w-3 mr-1.5 animate-spin" />
                      <span>Replacing...</span>
                    </>
                  ) : (
                    <>
                      <ImageIcon className="h-3 w-3 mr-1.5" />
                      <span>Replace Image</span>
                    </>
                  )}
                </button>
                <input
                  ref={replaceFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleReplaceImageFile(e.target.files[0]);
                      e.target.value = '';
                    }
                  }}
                />
                <button
                  onClick={handleDeletePhoto}
                  className="flex items-center px-4 py-2 text-xs font-bold uppercase tracking-widest border border-red-500/50 text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Delete View"
                >
                  <Trash2 className="h-3 w-3 mr-2" /> Delete View
                </button>
              </>
            )}
            {/* Undo Button */}
            <button
              type="button"
              onClick={handleUndo}
              disabled={undoStack.length === 0 || isUndoing}
              className="flex items-center px-3.5 py-2 text-xs font-bold uppercase tracking-widest border transition-all bg-[#1a1816] border-[#332f2a] text-brand-text hover:border-[#4a443c] hover:text-white disabled:opacity-30 disabled:pointer-events-none"
              title={
                undoStack.length > 0
                  ? `Undo: ${undoStack[undoStack.length - 1].description} (Ctrl+Z)`
                  : "Nothing to undo (Ctrl+Z)"
              }
            >
              <RotateCcw className={`h-3.5 w-3.5 mr-1.5 ${isUndoing ? 'animate-spin' : ''}`} />
              <span>Undo</span>
              {undoStack.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-brand-accent/20 text-brand-accent rounded text-[10px] font-mono leading-none">
                  {undoStack.length}
                </span>
              )}
            </button>

            <button 
              onClick={() => {
                if (!isEditing) {
                  setSelectedLeafHotspot(null);
                } else {
                  setShowHotspotsList(false);
                  setReshapingHotspot(null);
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

      {replaceImageNotice && (
        <div className="mb-4 p-3 bg-brand-accent/20 border border-brand-accent/50 rounded-lg text-xs text-brand-text flex items-center justify-between gap-3 shadow-lg animate-fadeIn">
          <span>{replaceImageNotice}</span>
          <div className="flex items-center gap-2 shrink-0">
            {undoStack.length > 0 && !isUndoing && (
              <button
                type="button"
                onClick={handleUndo}
                className="flex items-center gap-1 px-2.5 py-1 bg-brand-accent hover:bg-brand-accent/80 text-white font-bold rounded shadow transition-colors text-[11px]"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Undo</span>
              </button>
            )}
            <button 
              type="button" 
              onClick={() => setReplaceImageNotice(null)} 
              className="text-brand-text-muted hover:text-white p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {pendingChildUpload && (
        <div className="mb-6 p-4 bg-brand-accent/10 border border-brand-accent/30 rounded-lg text-sm text-brand-text">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <p className="font-medium">Please upload the inside photo for <strong>{pendingChildUpload.label}</strong></p>
            <button
              type="button"
              onClick={() => setEditingHotspot(pendingChildUpload)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold bg-[#1a1816] hover:bg-[#252320] text-brand-accent hover:text-white border border-[#332f2a] rounded transition-colors"
              title="Edit hotspot name and storage type"
            >
              <Edit2 className="h-3.5 w-3.5" />
              <span>Edit Hotspot</span>
            </button>
          </div>
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
              reshapingHotspot={reshapingHotspot}
              onCancelEdit={() => {
                setIsEditing(false);
                setReshapingHotspot(null);
              }}
              onHotspotCreated={handleHotspotCreated}
              onHotspotClick={handleHotspotClick}
              onHotspotDelete={handleDeleteHotspot}
              onHotspotEdit={setEditingHotspot}
              onConfirmReshape={handleConfirmReshape}
              onCancelReshape={handleCancelReshape}
              onBatchUpdateHotspots={handleBatchUpdateHotspots}
              onUndo={handleUndo}
              canUndo={undoStack.length > 0 && !isUndoing}
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
                  <>
                    <button 
                      onClick={() => handleStartReshape(selectedLeafHotspot)}
                      className="p-1.5 text-brand-text-muted hover:text-sky-400 hover:bg-sky-500/10 rounded transition-colors"
                      title={`Redraw boundary for "${selectedLeafHotspot.label}"`}
                    >
                      <Crop className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => setEditingHotspot(selectedLeafHotspot)}
                      className="p-1.5 text-brand-text-muted hover:text-brand-accent hover:bg-brand-accent/10 rounded transition-colors"
                      title={`Edit hotspot "${selectedLeafHotspot.label}"`}
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteHotspot(selectedLeafHotspot)}
                      className="p-1.5 text-brand-text-muted hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                      title={`Delete hotspot "${selectedLeafHotspot.label}"`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
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
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => setIsAddingComponent(true)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-[#2a2a2a] hover:bg-brand-accent text-white rounded text-xs font-medium transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add Components</span>
                      </button>
                      <Link
                        href={`/inventory/new?locationId=${selectedLeafHotspot.id}`}
                        className="flex items-center gap-1 px-3 py-1.5 bg-brand-accent/15 hover:bg-brand-accent border border-brand-accent/40 hover:border-brand-accent text-brand-accent hover:text-white rounded text-xs font-medium transition-colors"
                        title="Create and assign new item to this location"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>New Item</span>
                      </Link>
                    </div>
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
                      href={`/inventory/new?locationId=${selectedLeafHotspot.id}`} 
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

      {editingHotspot && (
        <HotspotConfigModal
          title="Edit Hotspot"
          initialLabel={editingHotspot.label}
          initialType={editingHotspot.is_leaf ? "leaf" : "drill"}
          submitText="Save Changes"
          onClose={() => setEditingHotspot(null)}
          onSubmit={(label, isLeaf) => {
            handleUpdateHotspotDetails(editingHotspot.id, label, isLeaf);
          }}
          onRedrawShape={() => handleStartReshape(editingHotspot)}
          onInsertIntermediate={
            !editingHotspot.is_leaf && editingHotspot.child_photo_id
              ? () => handleOpenInsertIntermediate(editingHotspot)
              : undefined
          }
        />
      )}

      {insertIntermediateTarget && (
        <InsertIntermediateModal
          parentHotspot={insertIntermediateTarget.parentHotspot}
          childPhoto={insertIntermediateTarget.childPhoto}
          isSubmitting={isInsertingIntermediate}
          onClose={() => setInsertIntermediateTarget(null)}
          onSubmit={handleExecuteInsertIntermediate}
        />
      )}
    </div>
  );
}
