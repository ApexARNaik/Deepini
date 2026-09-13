"use client";

import React, { useState, useEffect, useRef } from "react";
import { Project, getAllLeafHotspots, updateProject } from "@/lib/api";
import { X, MapPin, Search, Check, ChevronDown, AlertCircle, Clock, Archive, Sparkles, FolderEdit } from "lucide-react";
import { StorageSequenceTooltip, StorageTooltipData } from "@/components/spatial/StorageSequenceTooltip";

interface Props {
  project: Project;
  activeCount?: number;
  initialStatus?: 'planning' | 'active' | 'archived';
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: Project) => void;
}

export function EditProjectModal({
  project,
  activeCount = 0,
  initialStatus,
  isOpen,
  onClose,
  onSuccess,
}: Props) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || "");
  const [status, setStatus] = useState<'planning' | 'active' | 'archived'>(
    initialStatus || (project.status === ('completed' as any) ? 'archived' : project.status)
  );

  // Storage Location state (mandatory when status === 'archived')
  const [availableHotspots, setAvailableHotspots] = useState<any[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>(project.location_id || "");
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
  const [locationSearch, setLocationSearch] = useState("");
  const [highlightedLocIndex, setHighlightedLocIndex] = useState(-1);
  const locationDropdownRef = useRef<HTMLDivElement>(null);
  const locationSearchInputRef = useRef<HTMLInputElement>(null);

  const [hoverTooltip, setHoverTooltip] = useState<StorageTooltipData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load available leaf hotspots
  useEffect(() => {
    if (!isOpen) return;
    getAllLeafHotspots()
      .then((hotspots) => {
        setAvailableHotspots(hotspots);
      })
      .catch(console.error);
  }, [isOpen]);

  // Click outside to close location dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(event.target as Node)) {
        setIsLocationDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Tooltip dismissal on scroll
  useEffect(() => {
    if (!hoverTooltip) return;
    const handleScroll = () => setHoverTooltip(null);
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [hoverTooltip]);

  const handleShowTooltip = (
    e: React.MouseEvent<HTMLElement>,
    data: { fullLabel?: string; label?: string; roomName?: string }
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoverTooltip({
      ...data,
      targetRect: rect,
    });
  };

  const handleHideTooltip = () => setHoverTooltip(null);

  if (!isOpen) return null;

  const filteredHotspots = availableHotspots.filter((hs) => {
    if (!locationSearch.trim()) return true;
    const query = locationSearch.toLowerCase().trim();
    const full = (hs.fullLabel || "").toLowerCase();
    const label = (hs.label || "").toLowerCase();
    const room = (hs.roomName || "").toLowerCase();
    return full.includes(query) || label.includes(query) || room.includes(query);
  });

  const selectedHotspotObj = availableHotspots.find((h) => h.id === selectedLocationId);

  const getHotspotDisplay = (hs: any) => {
    if (!hs) return { destination: "", trail: "" };
    const label = hs.fullLabel || hs.label || "";
    if (label.includes("→")) {
      const parts = label.split("→").map((s: string) => s.trim());
      return {
        destination: parts[parts.length - 1],
        trail: parts.slice(0, parts.length - 1).join(" → "),
      };
    }
    return { destination: label, trail: hs.roomName || "" };
  };

  const isPlanningBlocked = status === "planning" && activeCount > 0;
  const isArchivedMissingLocation = status === "archived" && !selectedLocationId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Project name is required.");
      return;
    }

    if (status === "planning" && activeCount > 0) {
      setError(`Cannot save in Planning phase: ${activeCount} active component(s) are currently in use. Check them in first.`);
      return;
    }

    if (status === "archived" && !selectedLocationId) {
      setError("A project cannot become Archived without a valid leaf storage location.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const updated = await updateProject(project.id, {
        name: name.trim(),
        description: description.trim() || null,
        status,
        location_id: status === "archived" ? selectedLocationId : null,
      });

      onSuccess(updated);
      onClose();
    } catch (err: any) {
      console.error("Failed to update project:", err);
      setError(err.message || "Failed to update project.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-[#171513] border border-[#332f2a] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#332f2a] bg-[#1d1a17] shrink-0">
          <div className="flex items-center gap-2.5">
            <FolderEdit className="h-5 w-5 text-brand-accent" />
            <h2 className="font-serif text-lg font-bold text-white tracking-wide">
              {status === "archived" && project.status !== "archived" ? "Archive Project" : "Edit Project"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-brand-text-muted hover:text-white transition-colors p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto themed-scrollbar p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-950/40 border border-red-800/60 rounded text-red-300 text-xs flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Project Name */}
          <div>
            <label className="block text-[10px] tracking-widest text-brand-text-muted uppercase mb-1.5 font-semibold">
              Project Name <span className="text-brand-accent">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Quadcopter Drone v2"
              className="w-full bg-[#1e1b18] border border-[#3a352e] rounded p-2.5 text-sm text-white focus:border-brand-accent focus:outline-none transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] tracking-widest text-brand-text-muted uppercase mb-1.5 font-semibold">
              Description / Notes
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Build notes, specifications, or goal description..."
              className="w-full h-24 bg-[#1e1b18] border border-[#3a352e] rounded p-2.5 text-sm text-white focus:border-brand-accent focus:outline-none resize-none transition-colors"
            />
          </div>

          {/* Project Phase / Status */}
          <div>
            <label className="block text-[10px] tracking-widest text-brand-text-muted uppercase mb-2 font-semibold">
              Project Phase <span className="text-brand-accent">*</span>
            </label>
            <div className="grid grid-cols-1 gap-2.5">
              {/* Planning Option */}
              <label
                onClick={() => setStatus("planning")}
                className={`p-3 border rounded-lg cursor-pointer transition-all flex items-start gap-3 ${
                  status === "planning"
                    ? "bg-amber-500/10 border-amber-500/60 text-white"
                    : "bg-[#141210] border-[#2c2823] hover:border-[#3d3730] text-brand-text"
                }`}
              >
                <div className="mt-0.5">
                  <span className="h-3 w-3 rounded-full bg-amber-400 inline-block shrink-0 shadow-sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs uppercase tracking-wider text-amber-300">
                      Planning Phase
                    </span>
                    {status === "planning" && <Check className="h-4 w-4 text-amber-400" />}
                  </div>
                  <p className="text-[11px] text-brand-text-muted mt-0.5 leading-relaxed">
                    Pre-build phase. No components are being used.
                  </p>
                  {isPlanningBlocked && (
                    <div className="mt-2 p-2 bg-amber-950/40 border border-amber-800/60 rounded text-[11px] text-amber-300 flex items-start gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-400" />
                      <span>
                        Cannot move to Planning: <strong>{activeCount}</strong> component(s) are currently in use. Check them in first.
                      </span>
                    </div>
                  )}
                </div>
              </label>

              {/* Active Option */}
              <label
                onClick={() => setStatus("active")}
                className={`p-3 border rounded-lg cursor-pointer transition-all flex items-start gap-3 ${
                  status === "active"
                    ? "bg-emerald-500/10 border-emerald-500/60 text-white"
                    : "bg-[#141210] border-[#2c2823] hover:border-[#3d3730] text-brand-text"
                }`}
              >
                <div className="mt-0.5">
                  <span className="h-3 w-3 rounded-full bg-emerald-400 inline-block shrink-0 shadow-sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs uppercase tracking-wider text-emerald-300">
                      Active Phase
                    </span>
                    {status === "active" && <Check className="h-4 w-4 text-emerald-400" />}
                  </div>
                  <p className="text-[11px] text-brand-text-muted mt-0.5 leading-relaxed">
                    Build & usage phase. Components are actively attached and cannot be dismantled.
                  </p>
                </div>
              </label>

              {/* Archived Option */}
              <label
                onClick={() => setStatus("archived")}
                className={`p-3 border rounded-lg cursor-pointer transition-all flex items-start gap-3 ${
                  status === "archived"
                    ? "bg-zinc-500/15 border-zinc-400/60 text-white"
                    : "bg-[#141210] border-[#2c2823] hover:border-[#3d3730] text-brand-text"
                }`}
              >
                <div className="mt-0.5">
                  <span className="h-3 w-3 rounded-full bg-zinc-400 inline-block shrink-0 shadow-sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs uppercase tracking-wider text-zinc-300">
                      Archived Phase
                    </span>
                    {status === "archived" && <Check className="h-4 w-4 text-zinc-300" />}
                  </div>
                  <p className="text-[11px] text-brand-text-muted mt-0.5 leading-relaxed">
                    Stored phase. Project is stored at a physical location with all components attached. Components cannot be reused.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Physical Storage Location (MANDATORY & ATOMIC for Archived Phase) */}
          {status === "archived" && (
            <div className="p-4 bg-[#141210] border border-[#3a352e] rounded-lg space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <label className="text-[10px] tracking-widest text-brand-accent uppercase font-bold flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-brand-accent" />
                  <span>Physical Storage Location (Required) *</span>
                </label>
                {selectedLocationId && (
                  <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-brand-accent/20 text-brand-accent border border-brand-accent/30">
                    Location Selected
                  </span>
                )}
              </div>
              <p className="text-[11px] text-brand-text-muted leading-relaxed">
                Assign the compartment or shelf where the assembled project is physically stored.
              </p>

              {/* Custom Searchable Location Picker Dropdown */}
              <div className="relative pt-1" ref={locationDropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    handleHideTooltip();
                    setIsLocationDropdownOpen((prev) => !prev);
                  }}
                  onMouseEnter={(e) => {
                    if (selectedHotspotObj) {
                      handleShowTooltip(e, {
                        fullLabel: selectedHotspotObj.fullLabel || selectedHotspotObj.label,
                        label: selectedHotspotObj.label,
                        roomName: selectedHotspotObj.roomName,
                      });
                    }
                  }}
                  onMouseLeave={handleHideTooltip}
                  className={`w-full bg-[#1e1b18] border ${
                    !selectedLocationId
                      ? "border-brand-accent/80 ring-1 ring-brand-accent/40"
                      : isLocationDropdownOpen
                      ? "border-brand-accent ring-1 ring-brand-accent/50"
                      : "border-[#3a352e] hover:border-[#4a443c]"
                  } p-2.5 rounded text-sm text-left flex items-center justify-between transition-all focus:outline-none`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <MapPin className={`h-4 w-4 shrink-0 ${selectedHotspotObj ? "text-brand-accent" : "text-brand-text-muted"}`} />
                    {selectedHotspotObj ? (
                      <div className="flex items-baseline gap-2 min-w-0 truncate">
                        <span className="text-white font-medium truncate">
                          {getHotspotDisplay(selectedHotspotObj).destination}
                        </span>
                        {getHotspotDisplay(selectedHotspotObj).trail && (
                          <span className="text-[11px] text-brand-text-muted truncate hidden sm:inline">
                            ({getHotspotDisplay(selectedHotspotObj).trail})
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-brand-text-muted text-xs">Select physical storage location...</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {selectedLocationId && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          handleHideTooltip();
                          setSelectedLocationId("");
                        }}
                        title="Clear selection"
                        className="p-1 text-brand-text-muted hover:text-white rounded transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </span>
                    )}
                    <ChevronDown className={`h-4 w-4 text-brand-text-muted transition-transform duration-200 ${isLocationDropdownOpen ? "rotate-180 text-brand-accent" : ""}`} />
                  </div>
                </button>

                {/* Popover Dropdown matching full container width */}
                {isLocationDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 w-full z-50 bg-[#191715] border border-[#3a352e] rounded-md shadow-2xl shadow-black/95 ring-1 ring-black/50 overflow-hidden flex flex-col">
                    {/* Search Bar */}
                    <div className="p-2.5 bg-[#141210] border-b border-[#2e2a25] shrink-0">
                      <div className="relative">
                        <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-muted" />
                        <input
                          ref={locationSearchInputRef}
                          type="text"
                          value={locationSearch}
                          onChange={(e) => {
                            setLocationSearch(e.target.value);
                            setHighlightedLocIndex(0);
                          }}
                          placeholder="Search compartment or room path..."
                          className="w-full bg-[#1e1b18] border border-[#3a352e] rounded pl-8 pr-7 py-1.5 text-xs text-white placeholder-brand-text-muted focus:border-brand-accent focus:outline-none"
                        />
                        {locationSearch && (
                          <button
                            type="button"
                            onClick={() => setLocationSearch("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-text-muted hover:text-white"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <div className="flex justify-between items-center px-1 mt-2 text-[10px] uppercase tracking-wider text-brand-text-muted font-medium select-none">
                        <span>Leaf Storage Locations</span>
                        <span className="text-brand-gold/80">{filteredHotspots.length} available</span>
                      </div>
                    </div>

                    {/* Locations List */}
                    <div className="max-h-56 overflow-y-auto themed-scrollbar divide-y divide-[#26231f]/60 py-1">
                      {filteredHotspots.length === 0 ? (
                        <div className="p-6 text-center text-xs text-brand-text-muted">
                          No locations match &quot;{locationSearch}&quot;
                        </div>
                      ) : (
                        filteredHotspots.map((hs, idx) => {
                          const isSelected = selectedLocationId === hs.id;
                          const isHighlighted = idx === highlightedLocIndex;
                          const display = getHotspotDisplay(hs);

                          return (
                            <button
                              key={hs.id}
                              type="button"
                              onClick={() => {
                                handleHideTooltip();
                                setSelectedLocationId(hs.id);
                                setIsLocationDropdownOpen(false);
                              }}
                              onMouseEnter={(e) => {
                                setHighlightedLocIndex(idx);
                                handleShowTooltip(e, {
                                  fullLabel: hs.fullLabel || hs.label,
                                  label: display.destination,
                                  roomName: hs.roomName || (hs.fullLabel ? hs.fullLabel.split("→")[0].trim() : undefined),
                                });
                              }}
                              onMouseLeave={handleHideTooltip}
                              className={`w-full text-left px-3.5 py-2.5 text-xs flex items-start justify-between gap-3 transition-colors ${
                                isSelected
                                  ? "bg-brand-accent/20 border-l-2 border-brand-accent text-white font-medium"
                                  : isHighlighted
                                  ? "bg-[#25221e] text-white"
                                  : "text-brand-text hover:bg-[#1f1c19] hover:text-white"
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <MapPin className={`h-3.5 w-3.5 shrink-0 ${isSelected ? "text-brand-accent" : "text-brand-gold/70"}`} />
                                  <span className="font-semibold text-white truncate">{display.destination}</span>
                                </div>
                                {display.trail && (
                                  <div className="text-[11px] text-brand-text-muted truncate ml-5.5 mt-0.5">
                                    {display.trail}
                                  </div>
                                )}
                              </div>
                              {isSelected && (
                                <Check className="h-4 w-4 text-brand-accent shrink-0 mt-0.5" />
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#2e2a25]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-brand-text-muted hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || isPlanningBlocked || isArchivedMissingLocation || !name.trim()}
              className="px-6 py-2 bg-brand-accent text-white text-xs font-bold uppercase tracking-wider rounded-sm hover:bg-brand-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Saving..." : status === "archived" && project.status !== "archived" ? "Archive Project" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>

      {/* Floating Storage Sequence Tooltip */}
      <StorageSequenceTooltip data={hoverTooltip} />
    </div>
  );
}
