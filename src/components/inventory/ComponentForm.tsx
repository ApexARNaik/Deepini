"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Component, Tag, getTags, upsertTag, upsertComponent, uploadImage, uploadFile, getAllLeafHotspots, isPersonalItem } from "@/lib/api";
import { X, Plus, UploadCloud, FileText, Maximize2 } from "lucide-react";
import { useNetworkState } from "@/hooks/useNetworkState";
import { ImagePreviewModal } from "./ImagePreviewModal";

interface Props {
  initialData?: Component;
  initialTags?: Tag[];
  initialLocations?: any[];
}

export function ComponentForm({ initialData, initialTags, initialLocations }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isOnline } = useNetworkState();
  
  const typeParam = searchParams.get('type');
  const locationIdParam = searchParams.get('locationId') || searchParams.get('location');
  const isInitialPersonal = initialData ? isPersonalItem(initialData) : (typeParam === 'personal');
  const [itemType, setItemType] = useState<'component' | 'personal'>(isInitialPersonal ? 'personal' : 'component');

  // Standard Fields
  const [name, setName] = useState(initialData?.name || "");
  const [price, setPrice] = useState(initialData?.price?.toString() || "");
  const [purchaseSource, setPurchaseSource] = useState(initialData?.purchase_source || "");
  const [datasheetLink, setDatasheetLink] = useState(initialData?.datasheet_link || "");
  const [lowStock, setLowStock] = useState(initialData?.low_stock_threshold?.toString() || "");
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [photoUrl, setPhotoUrl] = useState(initialData?.photo_url || "");
  
  // Tags
  const [tags, setTags] = useState<Tag[]>(initialTags || []);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [tagInput, setTagInput] = useState("");
  
  // Locations
  const [locations, setLocations] = useState<{ hotspot_id: string, quantity: number, label?: string }[]>(
    initialLocations?.map(l => {
      const fullPath = l.room?.name && l.hotspot?.label
        ? `${l.room.name}${l.photo?.label ? ` → ${l.photo.label}` : ''} → ${l.hotspot.label}`
        : null;
      return {
        hotspot_id: l.hotspot_id,
        quantity: l.quantity,
        label: l.label || fullPath || l.hotspot?.label || l.spatial_hotspots?.label || "Unknown Location"
      };
    }) || []
  );
  const [availableHotspots, setAvailableHotspots] = useState<any[]>([]);
  const [selectedHotspot, setSelectedHotspot] = useState("");
  const [locationQuantity, setLocationQuantity] = useState("1");
  
  // Custom Fields
  const [customFields, setCustomFields] = useState<Record<string, { type: 'text' | 'number' | 'link' | 'image' | 'file'; value: any; fileName?: string; fileSize?: number }>>(() => {
    const fields = { ...(initialData?.custom_fields || {}) };
    delete fields.item_type;
    return fields;
  });
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<'text' | 'number' | 'link' | 'image' | 'file'>('text');
  const [uploadingFieldKey, setUploadingFieldKey] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string; subtitle?: string } | null>(null);
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getTags().then(setAvailableTags).catch(console.error);
    getAllLeafHotspots().then((hotspots) => {
      setAvailableHotspots(hotspots);
      setLocations((prevLocations) => {
        let updated = prevLocations.map((loc) => {
          const matched = hotspots.find((h) => h.id === loc.hotspot_id);
          if (matched && (!loc.label || loc.label === "Unknown Location" || !loc.label.includes('→'))) {
            return { ...loc, label: matched.fullLabel || matched.label || loc.label };
          }
          return loc;
        });

        // If creating new component with locationIdParam and no assigned locations yet, pre-assign it
        if (!initialData && locationIdParam && updated.length === 0) {
          const matched = hotspots.find((h) => h.id === locationIdParam);
          if (matched) {
            updated = [{
              hotspot_id: matched.id,
              quantity: 1,
              label: matched.fullLabel || matched.label
            }];
          }
        }

        return updated;
      });

      // Pre-select in the dropdown as well
      if (!initialData && locationIdParam) {
        const matched = hotspots.find((h) => h.id === locationIdParam);
        if (matched) {
          setSelectedHotspot(matched.id);
        }
      }
    }).catch(console.error);
  }, [initialData, locationIdParam]);

  const handleAddTag = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!tagInput.trim()) return;
    try {
      const tag = await upsertTag(tagInput.trim());
      if (!tags.find(t => t.id === tag.id)) {
        setTags([...tags, tag]);
      }
      setTagInput("");
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveTag = (id: string) => {
    setTags(tags.filter(t => t.id !== id));
  };

  const handleAddLocation = () => {
    if (!selectedHotspot) return;
    const qty = parseInt(locationQuantity, 10);
    if (isNaN(qty) || qty <= 0) return;
    
    const hs = availableHotspots.find(h => h.id === selectedHotspot);
    if (!hs) return;

    const existing = locations.find(l => l.hotspot_id === selectedHotspot);
    if (existing) {
      setLocations(locations.map(l => l.hotspot_id === selectedHotspot ? { ...l, quantity: l.quantity + qty } : l));
    } else {
      setLocations([...locations, { hotspot_id: selectedHotspot, quantity: qty, label: hs.fullLabel }]);
    }
    setSelectedHotspot("");
    setLocationQuantity("1");
  };

  const handleRemoveLocation = (id: string) => {
    setLocations(locations.filter(l => l.hotspot_id !== id));
    if (selectedHotspot === id) {
      setSelectedHotspot("");
    }
  };

  const handleAddCustomField = () => {
    if (!newFieldName.trim() || customFields[newFieldName.trim()]) return;
    setCustomFields({
      ...customFields,
      [newFieldName.trim()]: { type: newFieldType, value: "" }
    });
    setNewFieldName("");
  };

  const handleRemoveCustomField = (key: string) => {
    const next = { ...customFields };
    delete next[key];
    setCustomFields(next);
  };

  const handleCustomFieldValueChange = async (key: string, value: any) => {
    setCustomFields({
      ...customFields,
      [key]: { ...customFields[key], value }
    });
  };

  const handleCustomFieldImageUpload = async (key: string, file: File) => {
    setUploadingFieldKey(key);
    try {
      const url = await uploadImage(file, 'custom');
      handleCustomFieldValueChange(key, url);
    } catch (err) {
      console.error(err);
      alert("Failed to upload image");
    } finally {
      setUploadingFieldKey(null);
    }
  };

  const handleCustomFieldFileUpload = async (key: string, file: File) => {
    setUploadingFieldKey(key);
    try {
      const result = await uploadFile(file, 'docs');
      setCustomFields(prev => ({
        ...prev,
        [key]: {
          ...prev[key],
          value: result.url,
          fileName: result.name,
          fileSize: result.size,
        }
      }));
    } catch (err: any) {
      console.error(err);
      alert("Failed to upload file: " + (err?.message || String(err)));
    } finally {
      setUploadingFieldKey(null);
    }
  };

  const handleMainPhotoUpload = async (file: File) => {
    try {
      const url = await uploadImage(file, 'main');
      setPhotoUrl(url);
    } catch (err) {
      console.error(err);
      alert("Failed to upload image");
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    if (uploadingFieldKey) {
      alert("Please wait for the file to finish uploading before saving.");
      return;
    }

    setLoading(true);
    let success = false;
    try {
      let finalTagIds = tags.map(t => t.id);

      // Auto-commit any pending tag input if user didn't click Add / press Enter
      if (tagInput.trim()) {
        try {
          const autoTag = await upsertTag(tagInput.trim());
          if (!finalTagIds.includes(autoTag.id)) {
            finalTagIds.push(autoTag.id);
          }
        } catch (tErr) {
          console.warn("Could not auto-add tagInput:", tErr);
        }
      }

      // If personal item, automatically ensure it has a "Personal" tag
      if (itemType === 'personal') {
        const hasPersonalTag = tags.some(t => t.name.toLowerCase() === 'personal');
        if (!hasPersonalTag) {
          try {
            const personalTag = availableTags.find(t => t.name.toLowerCase() === 'personal') || await upsertTag('Personal');
            if (personalTag && !finalTagIds.includes(personalTag.id)) {
              finalTagIds = [...finalTagIds, personalTag.id];
            }
          } catch (tErr) {
            console.warn("Could not tag as personal:", tErr);
          }
        }
      }

      // Auto-commit any pending location if user selected a hotspot but didn't click Add
      let finalLocations = [...locations];
      if (selectedHotspot) {
        const qty = parseInt(locationQuantity, 10);
        if (!isNaN(qty) && qty > 0) {
          const existing = finalLocations.find(l => l.hotspot_id === selectedHotspot);
          if (!existing) {
            finalLocations.push({ hotspot_id: selectedHotspot, quantity: qty });
          }
        }
      }

      const payload: Partial<Component> = {
        name: name.trim(),
        item_type: itemType,
        photo_url: photoUrl || undefined,
        notes: notes ? notes.trim() : undefined,
        custom_fields: {
          ...customFields,
          item_type: itemType
        }
      };

      if (itemType === 'component') {
        payload.price = (price && price.trim() !== "") ? parseFloat(price.trim()) : undefined;
        payload.purchase_source = purchaseSource ? purchaseSource.trim() : undefined;
        payload.datasheet_link = datasheetLink ? datasheetLink.trim() : undefined;
        payload.low_stock_threshold = (lowStock && lowStock.trim() !== "") ? parseInt(lowStock.trim(), 10) : undefined;
      } else {
        payload.price = undefined;
        payload.purchase_source = undefined;
        payload.datasheet_link = undefined;
        payload.low_stock_threshold = undefined;
      }
    
      if (initialData?.id) {
        payload.id = initialData.id;
      }

      await upsertComponent(payload, finalTagIds, finalLocations);
      success = true;
    } catch (err: any) {
      console.error("Full error:", err);
      alert(`Failed to save ${itemType === 'personal' ? 'personal item' : 'component'}: ${err?.message || String(err)}`);
      setLoading(false);
    }
    
    if (success) {
      router.push(`/inventory?view=${itemType === 'personal' ? 'personal' : 'components'}`);
    }
  };

  return (
    <form onSubmit={onSubmit} className="max-w-4xl mx-auto space-y-8 pb-20">
      <fieldset disabled={!isOnline} className="space-y-8">
      
      {/* Header & Item Type Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#332f2a]">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-white mb-1">
            {initialData 
              ? `Edit ${itemType === 'personal' ? 'Personal Item' : 'Component'}` 
              : (itemType === 'personal' ? 'Add Personal Item' : 'Add New Component')}
          </h1>
          <p className="text-xs sm:text-sm text-brand-text-muted">
            {itemType === 'personal'
              ? 'Name, description, and physical storage location.'
              : 'Technical specs, pricing, datasheets, and storage locations.'}
          </p>
        </div>
        
        {/* Toggle between Component and Personal Item */}
        <div className="inline-flex p-1 bg-[#141312] border border-[#332f2a] rounded shrink-0">
          <button
            type="button"
            onClick={() => setItemType('component')}
            className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded transition-all ${
              itemType === 'component'
                ? 'bg-brand-accent text-white shadow'
                : 'text-brand-text-muted hover:text-white'
            }`}
          >
            Component
          </button>
          <button
            type="button"
            onClick={() => setItemType('personal')}
            className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded transition-all ${
              itemType === 'personal'
                ? 'bg-brand-accent text-white shadow'
                : 'text-brand-text-muted hover:text-white'
            }`}
          >
            Personal Item
          </button>
        </div>
      </div>

      {/* Photo + Main details */}
      <div className="flex flex-col md:flex-row gap-8">
        <div className="w-48 shrink-0 flex flex-col gap-2">
          <label className="block text-[10px] tracking-widest text-brand-text-muted uppercase">
            {itemType === 'personal' ? "Item Photo" : "Component Image"}
          </label>
          <div className="relative h-48 border border-[#332f2a] rounded overflow-hidden bg-[#1a1816] group">
            {photoUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl} alt="Preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewImage({ url: photoUrl, title: name || "Item Photo", subtitle: itemType === 'personal' ? "Personal Item Photo" : "Component Image" });
                  }}
                  className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black text-white/80 hover:text-white rounded border border-[#444] z-10 transition-colors cursor-zoom-in"
                  title="View full image"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-brand-text-muted">
                <UploadCloud className="h-8 w-8" />
              </div>
            )}
            <input 
              type="file" 
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && handleMainPhotoUpload(e.target.files[0])}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
            />
            <div className="absolute inset-x-0 bottom-0 bg-black/80 p-2 text-center text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-white">
              Click to replace
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-6">
          <div>
            <label className="block text-[10px] tracking-widest text-brand-text-muted uppercase mb-2">
              {itemType === 'personal' ? "Item Name *" : "Component Name *"}
            </label>
            <input
              required
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={itemType === 'personal' ? "e.g. Screwdriver Kit, Soldering Iron, Notebook, Keys..." : "e.g. ESP32 WROOM-32D"}
              className="w-full bg-brand-bg border border-[#332f2a] p-3 text-white focus:border-brand-accent focus:outline-none font-bold text-lg"
            />
          </div>

          {itemType === 'personal' ? (
            <div>
              <label className="block text-[10px] tracking-widest text-brand-text-muted uppercase mb-2">
                Description
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Description, notes, or details about this personal item..."
                className="w-full h-28 bg-brand-bg border border-[#332f2a] p-3 text-sm text-white focus:border-brand-accent focus:outline-none resize-none"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] tracking-widest text-brand-text-muted uppercase mb-2">
                  Price (INR)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  className="w-full bg-brand-bg border border-[#332f2a] p-3 text-white focus:border-brand-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] tracking-widest text-brand-text-muted uppercase mb-2">
                  Low Stock Alert At
                </label>
                <input
                  type="number"
                  value={lowStock}
                  onChange={e => setLowStock(e.target.value)}
                  className="w-full bg-brand-bg border border-[#332f2a] p-3 text-white focus:border-brand-accent focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <hr className="border-[#332f2a]" />

      {/* Storage Locations */}
      <div>
        <label className="block text-[10px] tracking-widest text-brand-text-muted uppercase mb-2">
          Storage Locations
        </label>
        <p className="text-xs text-brand-text-muted mb-3">
          Assign this {itemType === 'personal' ? 'item' : 'component'} to a physical location or container on the room map.
        </p>
        {locations.length > 0 && (
          <div className="flex flex-col gap-2 mb-3">
            {locations.map(l => (
              <div key={l.hotspot_id} className="flex items-center justify-between p-3 bg-[#1a1816] border border-[#332f2a] rounded">
                <div className="text-sm text-white">{l.label}</div>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-brand-text-muted">Qty: <span className="text-brand-accent font-bold">{l.quantity}</span></div>
                  <button type="button" onClick={() => handleRemoveLocation(l.hotspot_id)} className="text-brand-text-muted hover:text-red-400 transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <select
              value={selectedHotspot}
              onChange={e => setSelectedHotspot(e.target.value)}
              className="w-full bg-brand-bg border border-[#332f2a] p-2 text-sm text-white focus:border-brand-accent focus:outline-none"
            >
              <option value="">Select a location on the map...</option>
              {availableHotspots.map(hs => (
                <option key={hs.id} value={hs.id}>{hs.fullLabel}</option>
              ))}
            </select>
          </div>
          <div className="w-24">
            <input
              type="number"
              min="1"
              value={locationQuantity}
              onChange={e => setLocationQuantity(e.target.value)}
              className="w-full bg-brand-bg border border-[#332f2a] p-2 text-sm text-white focus:border-brand-accent focus:outline-none"
            />
          </div>
          <button type="button" onClick={handleAddLocation} disabled={!selectedHotspot} className="px-4 py-2 bg-brand-accent text-white font-medium hover:bg-brand-accent-hover disabled:opacity-50">
            Add
          </button>
        </div>
      </div>

      <hr className="border-[#332f2a]" />

      {/* Tags */}
      <div>
        <label className="block text-[10px] tracking-widest text-brand-text-muted uppercase mb-2">
          Tags
        </label>
        <div className="flex flex-wrap gap-2 mb-3">
          {tags.map(t => (
            <span key={t.id} className="inline-flex items-center gap-1 px-3 py-1 bg-[#1a1816] border border-[#332f2a] rounded text-xs text-brand-text">
              {t.name}
              <button type="button" onClick={() => handleRemoveTag(t.id)} className="text-brand-text-muted hover:text-white">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2 max-w-sm">
          <input
            type="text"
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddTag(e)}
            placeholder="Add new or existing tag..."
            className="flex-1 bg-brand-bg border border-[#332f2a] p-2 text-sm text-white focus:border-brand-accent focus:outline-none"
            list="available-tags"
          />
          <datalist id="available-tags">
            {availableTags.map(t => <option key={t.id} value={t.name} />)}
          </datalist>
          <button type="button" onClick={handleAddTag} className="px-3 bg-[#1a1816] border border-[#332f2a] text-brand-text hover:bg-[#222]">
            Add
          </button>
        </div>
      </div>

      {/* Component-only technical fields */}
      {itemType === 'component' && (
        <div className="space-y-6">
          <hr className="border-[#332f2a]" />

          {/* Links & Notes */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] tracking-widest text-brand-text-muted uppercase mb-2">
                  Purchase Source URL
                </label>
                <input
                  type="url"
                  value={purchaseSource}
                  onChange={e => setPurchaseSource(e.target.value)}
                  className="w-full bg-brand-bg border border-[#332f2a] p-3 text-sm text-white focus:border-brand-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] tracking-widest text-brand-text-muted uppercase mb-2">
                  Datasheet URL
                </label>
                <input
                  type="url"
                  value={datasheetLink}
                  onChange={e => setDatasheetLink(e.target.value)}
                  className="w-full bg-brand-bg border border-[#332f2a] p-3 text-sm text-white focus:border-brand-accent focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] tracking-widest text-brand-text-muted uppercase mb-2">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full h-32 bg-brand-bg border border-[#332f2a] p-3 text-sm text-white focus:border-brand-accent focus:outline-none resize-none"
              />
            </div>
          </div>
        </div>
      )}

      <hr className="border-[#332f2a]" />

      {/* Custom Fields Builder (Available for both Components and Personal Items) */}
      <div>
        <label className="block text-[10px] tracking-widest text-brand-text-muted uppercase mb-4">
          {itemType === 'personal' ? "Custom Fields" : "Custom Fields / Specifications"}
        </label>
        
        <div className="space-y-4 mb-6">
          {Object.entries(customFields)
            .filter(([key]) => key !== 'item_type')
            .map(([key, field]) => (
            <div key={key} className="flex gap-4 items-start">
              <div className="w-1/3">
                <div className="text-xs font-bold text-brand-text-muted uppercase">{key}</div>
                <div className="text-[10px] text-[#555] uppercase">{field.type}</div>
              </div>
              <div className="flex-1">
                {field.type === 'text' && (
                  <input type="text" value={field.value} onChange={e => handleCustomFieldValueChange(key, e.target.value)} className="w-full bg-brand-bg border border-[#332f2a] p-2 text-sm text-white" />
                )}
                {field.type === 'number' && (
                  <input type="number" value={field.value} onChange={e => handleCustomFieldValueChange(key, e.target.value)} className="w-full bg-brand-bg border border-[#332f2a] p-2 text-sm text-white" />
                )}
                {field.type === 'link' && (
                  <input type="url" value={field.value} onChange={e => handleCustomFieldValueChange(key, e.target.value)} className="w-full bg-brand-bg border border-[#332f2a] p-2 text-sm text-white" />
                )}
                {field.type === 'image' && (
                  <div className="flex items-center gap-4">
                    {field.value && (
                      <button
                        type="button"
                        onClick={() => setPreviewImage({ url: field.value, title: `${name || "Item"} - ${key}`, subtitle: "Custom Field Image" })}
                        className="group/img relative cursor-zoom-in"
                        title="Click to preview full image"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={field.value} alt={key} className="h-12 w-12 object-cover border border-[#332f2a] rounded group-hover/img:border-brand-accent group-hover/img:scale-105 transition-all duration-200" />
                      </button>
                    )}
                    <label className="cursor-pointer text-xs text-brand-text-muted hover:text-white flex items-center gap-1.5 px-3 py-1.5 bg-black/30 border border-[#332f2a] hover:border-brand-accent rounded transition-colors">
                      <UploadCloud className="h-3.5 w-3.5 text-brand-accent" />
                      <span>{uploadingFieldKey === key ? "Uploading image..." : (field.value ? "Change Image" : "Upload Image")}</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={e => e.target.files?.[0] && handleCustomFieldImageUpload(key, e.target.files[0])} 
                        className="hidden"
                        disabled={uploadingFieldKey === key}
                      />
                    </label>
                  </div>
                )}
                {field.type === 'file' && (
                  <div className="space-y-2">
                    {field.value ? (
                      <div className="flex items-center justify-between p-2.5 bg-black/40 border border-[#332f2a] rounded">
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <FileText className="h-5 w-5 text-brand-accent shrink-0" />
                          <div className="min-w-0">
                            <a 
                              href={field.value} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="text-xs font-semibold text-white hover:text-brand-accent underline truncate block"
                              title={field.fileName || field.value}
                            >
                              {field.fileName || field.value.split('/').pop()?.split('_').slice(2).join('_') || field.value.split('/').pop() || "Document"}
                            </a>
                            {field.fileSize && (
                              <span className="text-[10px] text-brand-text-muted font-mono">
                                {(field.fileSize / (1024 * 1024)).toFixed(2)} MB
                              </span>
                            )}
                          </div>
                        </div>
                        <label className="cursor-pointer text-[11px] font-bold text-brand-accent hover:underline px-2.5 py-1 bg-brand-accent/10 border border-brand-accent/30 rounded shrink-0 transition-colors hover:bg-brand-accent/20">
                          {uploadingFieldKey === key ? "Uploading..." : "Replace"}
                          <input 
                            type="file" 
                            accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.zip,.txt,application/*,image/*" 
                            onChange={e => e.target.files?.[0] && handleCustomFieldFileUpload(key, e.target.files[0])} 
                            className="hidden" 
                            disabled={uploadingFieldKey === key}
                          />
                        </label>
                      </div>
                    ) : (
                      <label className={`flex items-center gap-2 px-3 py-2 border border-dashed rounded text-xs font-medium cursor-pointer transition-colors ${
                        uploadingFieldKey === key 
                          ? 'border-brand-accent text-brand-accent bg-brand-accent/10' 
                          : 'border-[#332f2a] text-brand-text-muted hover:border-brand-accent hover:text-white bg-black/30'
                      }`}>
                        <FileText className="h-4 w-4 text-brand-accent" />
                        <span>{uploadingFieldKey === key ? "Uploading file..." : "Upload File (PDF, PPT, Word, etc.)"}</span>
                        <input 
                          type="file" 
                          accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.zip,.txt,application/*,image/*" 
                          onChange={e => e.target.files?.[0] && handleCustomFieldFileUpload(key, e.target.files[0])} 
                          className="hidden" 
                          disabled={uploadingFieldKey === key}
                        />
                      </label>
                    )}
                  </div>
                )}
              </div>
              <button type="button" onClick={() => handleRemoveCustomField(key)} className="mt-2 text-brand-text-muted hover:text-red-400">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2 p-4 border border-dashed border-[#332f2a] bg-[#1a1816] rounded items-center">
          <input
            type="text"
            placeholder="New Field Name"
            value={newFieldName}
            onChange={e => setNewFieldName(e.target.value)}
            className="flex-1 bg-brand-bg border border-[#332f2a] p-2 text-sm text-white focus:border-brand-accent focus:outline-none"
          />
          <select 
            value={newFieldType}
            onChange={e => setNewFieldType(e.target.value as any)}
            className="w-36 bg-brand-bg border border-[#332f2a] p-2 text-sm text-white focus:outline-none"
          >
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="link">Link</option>
            <option value="image">Image</option>
            <option value="file">File (PDF, PPT...)</option>
          </select>
          <button type="button" onClick={handleAddCustomField} className="px-3 py-2 bg-brand-accent/20 text-brand-accent hover:bg-brand-accent/30 rounded text-sm flex items-center">
            <Plus className="h-4 w-4 mr-1" /> Add
          </button>
        </div>
      </div>

      </fieldset>
      <div className="fixed bottom-0 inset-x-0 ml-64 bg-[#1a1816] border-t border-[#332f2a] p-4 flex justify-between items-center z-20">
        {isOnline ? (
          <>
            {initialData ? (
              <button 
                type="button" 
                onClick={() => {
                  if (confirm(`Are you sure you want to delete this ${itemType === 'personal' ? 'personal item' : 'component'}?`)) {
                    import('@/lib/api').then(({ deleteComponent }) => {
                      setLoading(true);
                      deleteComponent(initialData.id).then(() => {
                        router.push(`/inventory?view=${itemType === 'personal' ? 'personal' : 'components'}`);
                      }).catch(err => {
                        console.error(err);
                        alert(`Failed to delete ${itemType === 'personal' ? 'personal item' : 'component'}`);
                        setLoading(false);
                      });
                    });
                  }
                }} 
                className="px-4 py-2 text-brand-accent hover:text-red-400 text-xs font-bold uppercase tracking-widest transition-colors"
              >
                Delete {itemType === 'personal' ? 'Item' : 'Component'}
              </button>
            ) : <div/>}

            <div className="flex gap-4">
              <button type="button" onClick={() => router.back()} className="px-6 py-2 text-brand-text-muted hover:text-white text-sm">
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={loading || !!uploadingFieldKey} 
                className="px-8 py-2 bg-brand-accent text-white font-bold tracking-widest text-sm rounded-sm hover:bg-brand-accent-hover disabled:opacity-50 transition-opacity"
              >
                {loading 
                  ? "SAVING..." 
                  : uploadingFieldKey 
                    ? "UPLOADING FILE..." 
                    : (initialData 
                        ? (itemType === 'personal' ? "UPDATE PERSONAL ITEM" : "UPDATE COMPONENT") 
                        : (itemType === 'personal' ? "SAVE PERSONAL ITEM" : "SAVE COMPONENT"))}
              </button>
            </div>
          </>
        ) : (
          <div className="w-full text-center text-brand-text-muted text-sm font-bold tracking-widest uppercase py-2">
            Read Only Mode - Go online to edit
          </div>
        )}
      </div>

      {/* Full Image Preview Modal */}
      <ImagePreviewModal
        isOpen={!!previewImage}
        imageUrl={previewImage?.url || null}
        title={previewImage?.title}
        subtitle={previewImage?.subtitle}
        onClose={() => setPreviewImage(null)}
      />
    </form>
  );
}
