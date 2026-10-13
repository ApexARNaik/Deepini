"use client";

import { useState, useEffect } from "react";
import { X, StickyNote, Package, MapPin, Trash2, Check, ArrowRightLeft, Sparkles } from "lucide-react";
import { SpatialNote, SpatialHotspot, ComponentWithTotals, isPersonalItem } from "@/lib/api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialNote?: SpatialNote | null;
  defaultX?: number;
  defaultY?: number;
  defaultHotspotId?: string | null;
  defaultComponentId?: string | null;
  photoId?: string | null;
  availableHotspots: SpatialHotspot[];
  availableComponents: (ComponentWithTotals | any)[];
  onSave: (noteData: Omit<SpatialNote, 'id' | 'created_at' | 'updated_at'>) => void;
  onDelete?: (id: string) => void;
}

type NoteTargetType = "component" | "hotspot" | "general";

const NOTE_COLORS = [
  { id: "amber", name: "Amber Sticky", bg: "bg-amber-400", border: "border-amber-300", text: "text-amber-950", ring: "ring-amber-400" },
  { id: "sky", name: "Sky Blue", bg: "bg-sky-400", border: "border-sky-300", text: "text-sky-950", ring: "ring-sky-400" },
  { id: "emerald", name: "Emerald Green", bg: "bg-emerald-400", border: "border-emerald-300", text: "text-emerald-950", ring: "ring-emerald-400" },
  { id: "purple", name: "Purple / Violet", bg: "bg-purple-400", border: "border-purple-300", text: "text-purple-950", ring: "ring-purple-400" },
  { id: "rose", name: "Rose / Warning", bg: "bg-rose-400", border: "border-rose-300", text: "text-rose-950", ring: "ring-rose-400" },
];

export function SpatialNoteModal({
  isOpen,
  onClose,
  initialNote,
  defaultX = 0.5,
  defaultY = 0.5,
  defaultHotspotId = null,
  defaultComponentId = null,
  photoId = null,
  availableHotspots,
  availableComponents,
  onSave,
  onDelete
}: Props) {
  const [text, setText] = useState("");
  const [targetType, setTargetType] = useState<NoteTargetType>("component");
  const [selectedComponentId, setSelectedComponentId] = useState<string>("");
  const [selectedHotspotId, setSelectedHotspotId] = useState<string>("");
  const [color, setColor] = useState<string>("amber");
  const [componentSearch, setComponentSearch] = useState("");
  const [hotspotSearch, setHotspotSearch] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (initialNote) {
        setText(initialNote.text || "");
        setColor(initialNote.color || "amber");
        if (initialNote.component_id) {
          setTargetType("component");
          setSelectedComponentId(initialNote.component_id);
          setSelectedHotspotId(initialNote.hotspot_id || "");
        } else if (initialNote.hotspot_id) {
          setTargetType("hotspot");
          setSelectedHotspotId(initialNote.hotspot_id);
          setSelectedComponentId("");
        } else {
          setTargetType("general");
          setSelectedComponentId("");
          setSelectedHotspotId("");
        }
      } else {
        setText("");
        setColor("amber");
        if (defaultComponentId) {
          setTargetType("component");
          setSelectedComponentId(defaultComponentId);
          setSelectedHotspotId(defaultHotspotId || "");
        } else if (defaultHotspotId) {
          setTargetType("hotspot");
          setSelectedHotspotId(defaultHotspotId);
          setSelectedComponentId("");
        } else {
          setTargetType(availableComponents.length > 0 ? "component" : "hotspot");
          setSelectedComponentId(availableComponents[0]?.id || "");
          setSelectedHotspotId(availableHotspots[0]?.id || "");
        }
      }
      setComponentSearch("");
      setHotspotSearch("");
    }
  }, [isOpen, initialNote, defaultHotspotId, defaultComponentId, availableHotspots, availableComponents]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    const payload: Omit<SpatialNote, 'id' | 'created_at' | 'updated_at'> = {
      photo_id: photoId || initialNote?.photo_id || null,
      hotspot_id: targetType === "hotspot" ? (selectedHotspotId || null) : (targetType === "component" ? (selectedHotspotId || null) : null),
      component_id: targetType === "component" ? (selectedComponentId || null) : null,
      text: text.trim(),
      x: initialNote ? initialNote.x : defaultX,
      y: initialNote ? initialNote.y : defaultY,
      color
    };

    onSave(payload);
    onClose();
  };

  const filteredComponents = availableComponents.filter(c => {
    if (!componentSearch.trim()) return true;
    const q = componentSearch.toLowerCase().trim();
    return (c.name || "").toLowerCase().includes(q) || (c.notes || "").toLowerCase().includes(q);
  });

  const filteredHotspots = availableHotspots.filter(h => {
    if (!hotspotSearch.trim()) return true;
    const q = hotspotSearch.toLowerCase().trim();
    return (h.label || "").toLowerCase().includes(q);
  });

  const selectedCompObj = availableComponents.find(c => c.id === selectedComponentId);
  const selectedHsObj = availableHotspots.find(h => h.id === selectedHotspotId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-[#181614] border border-[#38332c] rounded-xl shadow-2xl shadow-black/95 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#2d2924] bg-[#141210]">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <StickyNote className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold text-white tracking-wide">
                {initialNote ? "Edit Spatial Note" : "Add Spatial Note"}
              </h2>
              <p className="text-xs text-brand-text-muted mt-0.5">
                Place an interactive note on the visual map, revealed on hover.
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="text-brand-text-muted hover:text-white transition-colors p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-5 themed-scrollbar flex-1">
          {/* Note Textarea */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-brand-text-muted">
                Note Content *
              </label>
              <span className="text-[10px] text-brand-text-muted">{text.length} chars</span>
            </div>
            <textarea
              required
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. ESD sensitive, fragile pins. Needs firmware v2.1. Bottom compartment sticks..."
              autoFocus
              className="w-full bg-[#100f0e] border border-[#38332c] rounded-lg p-3 text-sm text-white placeholder-brand-text-muted/60 focus:border-brand-accent focus:outline-none focus:ring-1 focus:ring-brand-accent/50 resize-y min-h-[90px]"
            />
          </div>

          {/* Target Type Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-brand-text-muted mb-2">
              Attach Note To
            </label>
            <div className="grid grid-cols-3 gap-2 p-1 bg-[#121110] border border-[#2d2924] rounded-lg">
              <button
                type="button"
                onClick={() => setTargetType("component")}
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-md text-xs font-semibold transition-all ${
                  targetType === "component"
                    ? "bg-brand-accent text-white shadow-sm"
                    : "text-brand-text-muted hover:text-white hover:bg-[#1f1d1a]"
                }`}
              >
                <Package className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Component</span>
              </button>
              <button
                type="button"
                onClick={() => setTargetType("hotspot")}
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-md text-xs font-semibold transition-all ${
                  targetType === "hotspot"
                    ? "bg-brand-accent text-white shadow-sm"
                    : "text-brand-text-muted hover:text-white hover:bg-[#1f1d1a]"
                }`}
              >
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Storage Location</span>
              </button>
              <button
                type="button"
                onClick={() => setTargetType("general")}
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-md text-xs font-semibold transition-all ${
                  targetType === "general"
                    ? "bg-brand-accent text-white shadow-sm"
                    : "text-brand-text-muted hover:text-white hover:bg-[#1f1d1a]"
                }`}
              >
                <StickyNote className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">General Note</span>
              </button>
            </div>
          </div>

          {/* Component Selection */}
          {targetType === "component" && (
            <div className="space-y-2 bg-[#121110] border border-[#2d2924] p-3.5 rounded-lg animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-brand-accent" />
                  Select Component
                </span>
                <span className="text-[10px] text-amber-400/90 flex items-center gap-1 font-mono">
                  <ArrowRightLeft className="h-3 w-3" />
                  Follows item when moved
                </span>
              </div>
              <p className="text-[11px] text-brand-text-muted leading-relaxed">
                This note stays linked to the chosen component and will automatically follow it on the visual map if it is moved to another compartment or room.
              </p>

              {availableComponents.length > 5 && (
                <input
                  type="text"
                  value={componentSearch}
                  onChange={(e) => setComponentSearch(e.target.value)}
                  placeholder="Filter components..."
                  className="w-full bg-[#1b1917] border border-[#38332c] rounded px-3 py-1.5 text-xs text-white placeholder-brand-text-muted focus:border-brand-accent focus:outline-none mb-2"
                />
              )}

              <div className="max-h-40 overflow-y-auto themed-scrollbar space-y-1.5 pr-1">
                {filteredComponents.length === 0 ? (
                  <div className="text-center py-4 text-xs text-brand-text-muted">
                    No components found.
                  </div>
                ) : (
                  filteredComponents.map((c) => {
                    const isSelected = selectedComponentId === c.id;
                    const personal = isPersonalItem(c);
                    return (
                      <div
                        key={c.id}
                        onClick={() => setSelectedComponentId(c.id)}
                        className={`p-2 rounded cursor-pointer flex items-center justify-between text-xs transition-colors ${
                          isSelected
                            ? "bg-brand-accent/20 border border-brand-accent text-white font-medium"
                            : "bg-[#181614] border border-[#2e2a25] text-brand-text hover:bg-[#221f1c] hover:text-white"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <Package className={`h-3.5 w-3.5 shrink-0 ${isSelected ? "text-brand-accent" : "text-brand-text-muted"}`} />
                          <span className="truncate">{c.name}</span>
                          {personal && (
                            <span className="text-[9px] px-1 py-0.2 bg-amber-500/20 text-amber-300 rounded font-mono shrink-0">
                              Personal
                            </span>
                          )}
                        </div>
                        {isSelected && <Check className="h-3.5 w-3.5 text-brand-accent shrink-0" />}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Storage Location Selection */}
          {targetType === "hotspot" && (
            <div className="space-y-2 bg-[#121110] border border-[#2d2924] p-3.5 rounded-lg animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-brand-accent" />
                  Select Storage Compartment
                </span>
                <span className="text-[10px] text-brand-text-muted">
                  {filteredHotspots.length} location{filteredHotspots.length === 1 ? '' : 's'}
                </span>
              </div>
              <p className="text-[11px] text-brand-text-muted leading-relaxed">
                This note attaches permanently to this physical location/shelf on the room map.
              </p>

              {availableHotspots.length > 5 && (
                <input
                  type="text"
                  value={hotspotSearch}
                  onChange={(e) => setHotspotSearch(e.target.value)}
                  placeholder="Filter locations..."
                  className="w-full bg-[#1b1917] border border-[#38332c] rounded px-3 py-1.5 text-xs text-white placeholder-brand-text-muted focus:border-brand-accent focus:outline-none mb-2"
                />
              )}

              <div className="max-h-40 overflow-y-auto themed-scrollbar space-y-1.5 pr-1">
                {filteredHotspots.length === 0 ? (
                  <div className="text-center py-4 text-xs text-brand-text-muted">
                    No storage locations found on this view.
                  </div>
                ) : (
                  filteredHotspots.map((h) => {
                    const isSelected = selectedHotspotId === h.id;
                    return (
                      <div
                        key={h.id}
                        onClick={() => setSelectedHotspotId(h.id)}
                        className={`p-2 rounded cursor-pointer flex items-center justify-between text-xs transition-colors ${
                          isSelected
                            ? "bg-brand-accent/20 border border-brand-accent text-white font-medium"
                            : "bg-[#181614] border border-[#2e2a25] text-brand-text hover:bg-[#221f1c] hover:text-white"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <MapPin className={`h-3.5 w-3.5 shrink-0 ${isSelected ? "text-brand-accent" : "text-brand-text-muted"}`} />
                          <span className="truncate">{h.label}</span>
                          <span className="text-[9px] px-1 py-0.2 bg-[#25221e] text-brand-text-muted rounded font-mono shrink-0">
                            {h.is_leaf ? "Leaf Storage" : "Drill-down"}
                          </span>
                        </div>
                        {isSelected && <Check className="h-3.5 w-3.5 text-brand-accent shrink-0" />}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Color Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-brand-text-muted mb-2">
              Note Pin Color
            </label>
            <div className="flex items-center gap-3">
              {NOTE_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColor(c.id)}
                  className={`h-7 w-7 rounded-full ${c.bg} border-2 transition-all flex items-center justify-center ${
                    color === c.id 
                      ? "ring-2 ring-white scale-110 border-white" 
                      : "border-black/40 opacity-80 hover:opacity-100"
                  }`}
                  data-tooltip={c.name}
                  aria-label={c.name}
                >
                  {color === c.id && <Check className={`h-3.5 w-3.5 ${c.text} stroke-[3]`} />}
                </button>
              ))}
            </div>
          </div>

          {/* Live Preview Card */}
          <div className="p-3 bg-[#11100e] border border-[#2a2622] rounded-lg">
            <div className="text-[10px] uppercase font-bold tracking-wider text-brand-text-muted mb-2 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-amber-400" />
              <span>Hover Preview on Room Map</span>
            </div>
            <div className="bg-[#191715]/95 border border-[#3d3831] rounded p-2.5 text-xs text-brand-text shadow-lg flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-[10px] uppercase font-semibold text-amber-400">
                {targetType === "component" ? (
                  <>
                    <Package className="h-3 w-3" />
                    <span>Component: {selectedCompObj?.name || "Selected Component"}</span>
                  </>
                ) : targetType === "hotspot" ? (
                  <>
                    <MapPin className="h-3 w-3" />
                    <span>Location: {selectedHsObj?.label || "Selected Location"}</span>
                  </>
                ) : (
                  <>
                    <StickyNote className="h-3 w-3" />
                    <span>General View Note</span>
                  </>
                )}
              </div>
              <div className="text-xs text-white/95 leading-relaxed italic whitespace-pre-wrap">
                &quot;{text.trim() || "Your note text will appear here when hovered..."}&quot;
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 border-t border-[#2d2924] flex items-center justify-between gap-3">
            {initialNote && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Delete this spatial note from the map?")) {
                    onDelete(initialNote.id);
                    onClose();
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete Note</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-brand-text-muted hover:text-white hover:bg-[#25221e] rounded transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!text.trim()}
                className="px-5 py-2 bg-brand-accent hover:bg-brand-accent-hover disabled:opacity-40 text-white text-xs font-bold rounded shadow transition-colors"
              >
                {initialNote ? "Save Changes" : "Place Note"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
