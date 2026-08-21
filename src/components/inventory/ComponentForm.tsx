"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Component, Tag, getTags, upsertTag, upsertComponent, uploadImage } from "@/lib/api";
import { X, Plus, UploadCloud } from "lucide-react";
import { useNetworkState } from "@/hooks/useNetworkState";

interface Props {
  initialData?: Component;
  initialTags?: Tag[];
}

export function ComponentForm({ initialData, initialTags }: Props) {
  const router = useRouter();
  const { isOnline } = useNetworkState();
  
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
  
  // Custom Fields
  const [customFields, setCustomFields] = useState(initialData?.custom_fields || {});
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<'text' | 'number' | 'link' | 'image'>('text');
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getTags().then(setAvailableTags).catch(console.error);
  }, []);

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
    try {
      const url = await uploadImage(file, 'custom');
      handleCustomFieldValueChange(key, url);
    } catch (err) {
      console.error(err);
      alert("Failed to upload image");
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
    
    setLoading(true);
    try {
      const payload: Partial<Component> = {
        id: initialData?.id,
        name: name.trim(),
        price: price ? parseFloat(price) : null,
        purchase_source: purchaseSource || null,
        datasheet_link: datasheetLink || null,
        low_stock_threshold: lowStock ? parseInt(lowStock, 10) : null,
        notes: notes || null,
        photo_url: photoUrl || null,
        custom_fields: customFields
      };

      await upsertComponent(payload, tags.map(t => t.id));
      router.push("/inventory");
    } catch (err) {
      console.error(err);
      alert("Failed to save component");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="max-w-4xl mx-auto space-y-8 pb-20">
      <fieldset disabled={!isOnline} className="space-y-8">
      
      {/* Top section: Photo + Main details */}
      <div className="flex flex-col md:flex-row gap-8">
        <div className="w-48 shrink-0 flex flex-col gap-2">
          <label className="block text-[10px] tracking-widest text-brand-text-muted uppercase">
            Component Image
          </label>
          <div className="relative h-48 border border-[#333] rounded overflow-hidden bg-[#151515] group">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="Preview" className="w-full h-full object-cover" />
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
              Component Name *
            </label>
            <input
              required
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. ESP32 WROOM-32D"
              className="w-full bg-[#121212] border border-[#333] p-3 text-white focus:border-brand-accent focus:outline-none font-bold text-lg"
            />
          </div>

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
                className="w-full bg-[#121212] border border-[#333] p-3 text-white focus:border-brand-accent focus:outline-none"
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
                className="w-full bg-[#121212] border border-[#333] p-3 text-white focus:border-brand-accent focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      <hr className="border-[#222]" />

      {/* Tags */}
      <div>
        <label className="block text-[10px] tracking-widest text-brand-text-muted uppercase mb-2">
          Tags
        </label>
        <div className="flex flex-wrap gap-2 mb-3">
          {tags.map(t => (
            <span key={t.id} className="inline-flex items-center gap-1 px-3 py-1 bg-[#1a1a1a] border border-[#444] rounded text-xs text-brand-text">
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
            className="flex-1 bg-[#121212] border border-[#333] p-2 text-sm text-white focus:border-brand-accent focus:outline-none"
            list="available-tags"
          />
          <datalist id="available-tags">
            {availableTags.map(t => <option key={t.id} value={t.name} />)}
          </datalist>
          <button type="button" onClick={handleAddTag} className="px-3 bg-[#1a1a1a] border border-[#333] text-brand-text hover:bg-[#222]">
            Add
          </button>
        </div>
      </div>

      <hr className="border-[#222]" />

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
              className="w-full bg-[#121212] border border-[#333] p-3 text-sm text-white focus:border-brand-accent focus:outline-none"
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
              className="w-full bg-[#121212] border border-[#333] p-3 text-sm text-white focus:border-brand-accent focus:outline-none"
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
            className="w-full h-32 bg-[#121212] border border-[#333] p-3 text-sm text-white focus:border-brand-accent focus:outline-none resize-none"
          />
        </div>
      </div>

      <hr className="border-[#222]" />

      {/* Custom Fields Builder */}
      <div>
        <label className="block text-[10px] tracking-widest text-brand-text-muted uppercase mb-4">
          Custom Fields
        </label>
        
        <div className="space-y-4 mb-6">
          {Object.entries(customFields).map(([key, field]) => (
            <div key={key} className="flex gap-4 items-start">
              <div className="w-1/3">
                <div className="text-xs font-bold text-brand-text-muted uppercase">{key}</div>
                <div className="text-[10px] text-[#555] uppercase">{field.type}</div>
              </div>
              <div className="flex-1">
                {field.type === 'text' && (
                  <input type="text" value={field.value} onChange={e => handleCustomFieldValueChange(key, e.target.value)} className="w-full bg-[#121212] border border-[#333] p-2 text-sm text-white" />
                )}
                {field.type === 'number' && (
                  <input type="number" value={field.value} onChange={e => handleCustomFieldValueChange(key, e.target.value)} className="w-full bg-[#121212] border border-[#333] p-2 text-sm text-white" />
                )}
                {field.type === 'link' && (
                  <input type="url" value={field.value} onChange={e => handleCustomFieldValueChange(key, e.target.value)} className="w-full bg-[#121212] border border-[#333] p-2 text-sm text-white" />
                )}
                {field.type === 'image' && (
                  <div className="flex items-center gap-4">
                    {field.value && <img src={field.value} alt={key} className="h-10 w-10 object-cover border border-[#333] rounded" />}
                    <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && handleCustomFieldImageUpload(key, e.target.files[0])} className="text-xs text-brand-text-muted" />
                  </div>
                )}
              </div>
              <button type="button" onClick={() => handleRemoveCustomField(key)} className="mt-2 text-brand-text-muted hover:text-red-400">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2 p-4 border border-dashed border-[#333] bg-[#1a1a1a] rounded items-center">
          <input
            type="text"
            placeholder="New Field Name"
            value={newFieldName}
            onChange={e => setNewFieldName(e.target.value)}
            className="flex-1 bg-[#121212] border border-[#333] p-2 text-sm text-white focus:border-brand-accent focus:outline-none"
          />
          <select 
            value={newFieldType}
            onChange={e => setNewFieldType(e.target.value as any)}
            className="w-32 bg-[#121212] border border-[#333] p-2 text-sm text-white focus:outline-none"
          >
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="link">Link</option>
            <option value="image">Image</option>
          </select>
          <button type="button" onClick={handleAddCustomField} className="px-3 py-2 bg-brand-accent/20 text-brand-accent hover:bg-brand-accent/30 rounded text-sm flex items-center">
            <Plus className="h-4 w-4 mr-1" /> Add
          </button>
        </div>
      </div>

      </fieldset>
      <div className="fixed bottom-0 inset-x-0 ml-64 bg-[#111] border-t border-[#222] p-4 flex justify-between items-center">
        {isOnline ? (
          <>
            {initialData ? (
              <button 
                type="button" 
                onClick={() => {
                  if (confirm("Are you sure you want to delete this component? If it has active checkouts, it will be marked as pending delete until returned.")) {
                    import('@/lib/api').then(({ deleteComponent }) => {
                      setLoading(true);
                      deleteComponent(initialData.id).then(() => {
                        router.push('/inventory');
                      }).catch(err => {
                        console.error(err);
                        alert("Failed to delete component");
                        setLoading(false);
                      });
                    });
                  }
                }} 
                className="px-4 py-2 text-brand-accent hover:text-red-400 text-xs font-bold uppercase tracking-widest transition-colors"
              >
                Delete Component
              </button>
            ) : <div/>}

            <div className="flex gap-4">
              <button type="button" onClick={() => router.back()} className="px-6 py-2 text-brand-text-muted hover:text-white text-sm">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="px-8 py-2 bg-brand-accent text-white font-bold tracking-widest text-sm rounded-sm hover:bg-brand-accent-hover disabled:opacity-50">
                {loading ? "SAVING..." : "SAVE COMPONENT"}
              </button>
            </div>
          </>
        ) : (
          <div className="w-full text-center text-brand-text-muted text-sm font-bold tracking-widest uppercase py-2">
            Read Only Mode - Go online to edit
          </div>
        )}
      </div>
    </form>
  );
}
