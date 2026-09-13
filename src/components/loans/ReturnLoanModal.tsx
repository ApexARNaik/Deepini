"use client";

import React, { useState, useEffect, useRef } from "react";
import { Loan, getAllLeafHotspots, returnLentComponent, returnLentProject } from "@/lib/api";
import { X, MapPin, Search, Check, ChevronDown, AlertCircle, RotateCcw, Package, Compass } from "lucide-react";
import { StorageSequenceTooltip, StorageTooltipData } from "@/components/spatial/StorageSequenceTooltip";

interface Props {
  loan: Loan;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ReturnLoanModal({ loan, isOpen, onClose, onSuccess }: Props) {
  const [availableHotspots, setAvailableHotspots] = useState<any[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>(loan.source_location_id || "");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [locationSearch, setLocationSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [hoverTooltip, setHoverTooltip] = useState<StorageTooltipData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    getAllLeafHotspots()
      .then((hotspots) => {
        setAvailableHotspots(hotspots);
        // Pre-select original location if valid, otherwise fallback to first available
        if (loan.source_location_id && hotspots.some(h => h.id === loan.source_location_id)) {
          setSelectedLocationId(loan.source_location_id);
        } else if (hotspots.length > 0) {
          setSelectedLocationId(hotspots[0].id);
        }
      })
      .catch(console.error);
  }, [isOpen, loan.source_location_id]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Dismiss hover tooltip on scroll
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

  const isOriginalLocationPresent = availableHotspots.some(h => h.id === loan.source_location_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLocationId) {
      setError("Please select a physical storage compartment to return this item to.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (loan.loan_type === 'component') {
        await returnLentComponent(loan.id, selectedLocationId);
      } else {
        await returnLentProject(loan.id, selectedLocationId);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Return loan failed:", err);
      setError(err.message || "Failed to return loan.");
    } finally {
      setLoading(false);
    }
  };

  const selectedDisplay = getHotspotDisplay(selectedHotspotObj);
  const itemName = loan.loan_type === 'project' 
    ? (loan.project_name || loan.project?.name || "Project")
    : (loan.component_name || loan.component?.name || "Component");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#1a1816] border border-[#332f2a] rounded-lg w-full max-w-lg flex flex-col shadow-2xl shadow-black/90 my-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-[#332f2a] bg-[#161412] shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white font-serif tracking-wide">
                Return Loan
              </h2>
              <p className="text-xs text-brand-text-muted">
                Return borrowed {loan.loan_type} back into workshop physical inventory.
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

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Loan Summary Card */}
          <div className="p-4 bg-[#141211] border border-[#2e2a25] rounded-md space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {loan.loan_type === 'component' ? (
                  <div className="h-8 w-8 rounded bg-brand-accent/15 border border-brand-accent/30 flex items-center justify-center text-brand-accent shrink-0">
                    <Package className="h-4 w-4" />
                  </div>
                ) : (
                  <div className="h-8 w-8 rounded bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                    <Compass className="h-4 w-4" />
                  </div>
                )}
                <div>
                  <div className="text-sm font-bold text-white leading-snug">{itemName}</div>
                  <div className="text-[11px] text-brand-text-muted">
                    Lent to: <span className="text-zinc-200 font-medium">{loan.borrower_name}</span>
                    {loan.quantity > 1 && ` • ${loan.quantity} units`}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-[#26221e] flex flex-col gap-1 text-[11px] text-brand-text-muted">
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3 w-3 text-amber-400 shrink-0" />
                <span>Originally taken from: </span>
                <span className="text-zinc-300 font-medium">
                  {loan.source_location_label || "Storage Compartment"}
                </span>
              </div>
              {!isOriginalLocationPresent && (
                <div className="text-[10px] text-amber-400 italic">
                  Note: The original compartment is no longer active in spatial maps. You can return it to any other valid leaf storage location below.
                </div>
              )}
            </div>
          </div>

          {/* Return Storage Location Picker */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-brand-text-muted font-bold mb-1.5">
              Select Return Compartment (Leaf Hotspot) <span className="text-brand-accent">*</span>
            </label>

            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => {
                  setIsDropdownOpen(!isDropdownOpen);
                  if (!isDropdownOpen) {
                    setTimeout(() => searchInputRef.current?.focus(), 50);
                  }
                }}
                className={`w-full bg-[#141211] border ${
                  isDropdownOpen ? "border-brand-accent ring-1 ring-brand-accent/50" : "border-[#3a352e] hover:border-[#4a443c]"
                } p-2.5 rounded-md text-left flex items-center justify-between text-xs transition-colors`}
              >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <MapPin className="h-4 w-4 text-brand-accent shrink-0" />
                  {selectedHotspotObj ? (
                    <div className="min-w-0">
                      <div className="text-white font-medium truncate">
                        {selectedDisplay.destination}
                        {selectedHotspotObj.id === loan.source_location_id && (
                          <span className="ml-2 text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded uppercase font-bold">
                            Original Location
                          </span>
                        )}
                      </div>
                      {selectedDisplay.trail && (
                        <div className="text-[10px] text-brand-text-muted truncate">{selectedDisplay.trail}</div>
                      )}
                    </div>
                  ) : (
                    <span className="text-brand-text-muted">Select a storage location...</span>
                  )}
                </div>
                <ChevronDown className={`h-4 w-4 text-brand-text-muted shrink-0 transition-transform duration-200 ${isDropdownOpen ? "rotate-180 text-brand-accent" : ""}`} />
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#161412] border border-[#3a352e] rounded-md shadow-2xl shadow-black/90 p-2 max-h-64 flex flex-col">
                  <div className="relative mb-2 shrink-0">
                    <Search className="h-3.5 w-3.5 text-brand-text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search compartments or rooms..."
                      value={locationSearch}
                      onChange={(e) => {
                        setLocationSearch(e.target.value);
                        setHighlightedIndex(-1);
                      }}
                      className="w-full bg-[#100f0e] border border-[#2e2a25] rounded pl-8 pr-2.5 py-1.5 text-xs text-white placeholder-brand-text-muted focus:border-brand-accent focus:outline-none"
                    />
                  </div>

                  <div className="overflow-y-auto themed-scrollbar flex-1 space-y-1">
                    {filteredHotspots.length === 0 ? (
                      <div className="p-3 text-center text-xs text-brand-text-muted italic">
                        No matching leaf compartments found.
                      </div>
                    ) : (
                      filteredHotspots.map((hs, idx) => {
                        const isSelected = selectedLocationId === hs.id;
                        const isOriginal = hs.id === loan.source_location_id;
                        const display = getHotspotDisplay(hs);

                        return (
                          <div
                            key={hs.id}
                            onClick={() => {
                              setSelectedLocationId(hs.id);
                              setIsDropdownOpen(false);
                            }}
                            onMouseEnter={(e) =>
                              handleShowTooltip(e, {
                                fullLabel: hs.fullLabel,
                                label: hs.label,
                                roomName: hs.roomName,
                              })
                            }
                            onMouseLeave={handleHideTooltip}
                            className={`p-2 rounded cursor-pointer flex items-center justify-between text-xs transition-colors ${
                              isSelected
                                ? "bg-brand-accent/20 text-white font-medium border border-brand-accent/30"
                                : idx === highlightedIndex
                                ? "bg-[#25221d] text-white"
                                : "text-brand-text hover:bg-[#201d1a] hover:text-white"
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="font-medium text-white flex items-center gap-1.5">
                                <span className="truncate">{display.destination}</span>
                                {isOriginal && (
                                  <span className="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1 py-0.2 rounded uppercase shrink-0">
                                    Original
                                  </span>
                                )}
                              </div>
                              {display.trail && (
                                <div className="text-[10px] text-brand-text-muted truncate">{display.trail}</div>
                              )}
                            </div>
                            {isSelected && <Check className="h-4 w-4 text-brand-accent shrink-0" />}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 border-t border-[#332f2a] flex justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-brand-text-muted hover:text-white uppercase tracking-widest font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selectedLocationId}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-widest rounded-sm transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{loading ? "PROCESSING..." : "CONFIRM RETURN"}</span>
            </button>
          </div>

        </form>

      </div>

      {hoverTooltip && (
        <StorageSequenceTooltip data={hoverTooltip} />
      )}
    </div>
  );
}
