"use client";

import { useState, useEffect } from "react";
import { 
  getInventory, 
  getComponentDetails, 
  checkoutComponent, 
  getFullHotspotPath,
  ComponentWithTotals, 
  ComponentLocation 
} from "@/lib/api";
import { Search, X, Package, MapPin, ExternalLink, Loader2, ArrowLeft } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { ThemedNumberInput } from "@/components/ThemedNumberInput";
import { StorageSequenceTooltip, StorageTooltipData } from "@/components/spatial/StorageSequenceTooltip";

interface Props {
  projectId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface EnrichedLocation extends ComponentLocation {
  fullLabel?: string;
  destination?: string;
  trail?: string;
  roomId?: string;
}

export function CheckOutModal({ projectId, onClose, onSuccess }: Props) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  
  const [searchResults, setSearchResults] = useState<ComponentWithTotals[]>([]);
  const [selectedComponent, setSelectedComponent] = useState<ComponentWithTotals | null>(null);
  
  const [locations, setLocations] = useState<EnrichedLocation[]>([]);
  const [selectedLoc, setSelectedLoc] = useState<EnrichedLocation | null>(null);
  
  const [qty, setQty] = useState("1");
  const [loading, setLoading] = useState(false);
  const [hoverTooltip, setHoverTooltip] = useState<StorageTooltipData | null>(null);

  // Dismiss hover tooltip on scroll
  useEffect(() => {
    if (!hoverTooltip) return;
    const handleScroll = () => setHoverTooltip(null);
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [hoverTooltip]);

  const handleShowTooltip = (
    e: React.MouseEvent<HTMLElement>,
    data: { fullLabel?: string; label?: string; roomName?: string; quantity?: number; footerHint?: string }
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoverTooltip({
      ...data,
      targetRect: rect,
    });
  };

  const handleHideTooltip = () => setHoverTooltip(null);

  useEffect(() => {
    if (!debouncedSearch) {
      setSearchResults([]);
      return;
    }
    getInventory(debouncedSearch).then(res => {
      // Only show components that have in_storage_qty > 0
      setSearchResults(res.filter(c => c.totals.in_storage_qty > 0));
    });
  }, [debouncedSearch]);

  const handleSelectComponent = async (comp: ComponentWithTotals) => {
    setSelectedComponent(comp);
    setLoading(true);
    try {
      const details = await getComponentDetails(comp.id);
      const validLocs = details.locations.filter(l => l.quantity > 0);
      
      const enriched = await Promise.all(
        validLocs.map(async (l) => {
          try {
            const path = await getFullHotspotPath(l.hotspot_id);
            const fullLabel = path.map(p => p.label).filter(Boolean).join(' → ');
            const roomNode = path.find(p => p.type === 'room') || path.find(p => p.type === 'photo');
            const parts = fullLabel ? fullLabel.split(' → ').map(s => s.trim()) : [];
            const destination = parts.length > 0 ? parts[parts.length - 1] : (l.hotspot?.label || 'Location');
            const trail = parts.length > 1 ? parts.slice(0, -1).join(' → ') : (l.room?.name || '');
            return {
              ...l,
              fullLabel: fullLabel || l.hotspot?.label,
              destination,
              trail,
              roomId: roomNode?.id || l.room?.id || (l.photo as any)?.room_id
            } as EnrichedLocation;
          } catch {
            return {
              ...l,
              fullLabel: l.hotspot?.label,
              destination: l.hotspot?.label || 'Location',
              trail: l.room?.name || '',
              roomId: l.room?.id
            } as EnrichedLocation;
          }
        })
      );

      setLocations(enriched);
      if (enriched.length === 1) {
        setSelectedLoc(enriched[0]);
      } else {
        setSelectedLoc(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLocateLocation = (e: React.MouseEvent, loc: EnrichedLocation) => {
    e.stopPropagation();
    e.preventDefault();
    if (loc.roomId) {
      window.open(`/rooms/${loc.roomId}?locateHotspot=${loc.hotspot_id}`, '_blank');
    } else {
      window.open(`/rooms?locateHotspot=${loc.hotspot_id}`, '_blank');
    }
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComponent || !selectedLoc) return;
    const numQty = parseInt(qty, 10);
    if (isNaN(numQty) || numQty <= 0 || numQty > selectedLoc.quantity) return;
    
    setLoading(true);
    try {
      await checkoutComponent(projectId, selectedComponent.id, selectedLoc.hotspot_id, numQty);
      onSuccess();
    } catch (err) {
      console.error(err);
      alert("Failed to checkout component.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#1a1816] border border-[#332f2a] rounded-lg w-full max-w-2xl flex flex-col max-h-[90vh] shadow-2xl shadow-black/90">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-[#332f2a]">
          <div className="flex items-center gap-3">
            {selectedComponent && (
              <button 
                type="button" 
                onClick={() => {
                  setSelectedComponent(null);
                  setSelectedLoc(null);
                  setLocations([]);
                }}
                className="p-1 rounded text-brand-text-muted hover:text-white hover:bg-[#25221e] transition-colors"
                data-tooltip="Back to search"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <h2 className="text-xl font-bold text-white font-serif">Check Out Component</h2>
          </div>
          <button onClick={onClose} className="text-brand-text-muted hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!selectedComponent ? (
            // Step 1: Search Component
            <div>
              <div className="relative w-full mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-text-muted" />
                <input 
                  autoFocus
                  type="text" 
                  placeholder="Search inventory..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-[#1a1816] border border-[#332f2a] pl-10 pr-4 py-3 text-sm text-white focus:border-brand-accent focus:outline-none transition-colors rounded"
                />
              </div>

              {search && searchResults.length === 0 && (
                <div className="text-center text-sm text-brand-text-muted py-8 border border-dashed border-[#332f2a] rounded">
                  No available components match your search.
                </div>
              )}

              <div className="space-y-2">
                {searchResults.map(c => (
                  <button 
                    key={c.id} 
                    onClick={() => handleSelectComponent(c)}
                    className="w-full flex items-center justify-between p-3 bg-[#1a1816] border border-[#332f2a] hover:border-brand-accent rounded text-left transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      {c.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.photo_url} alt="" className="h-10 w-10 object-cover rounded border border-[#332f2a]" />
                      ) : (
                        <div className="h-10 w-10 bg-[#222] rounded flex items-center justify-center text-[#555]"><Package className="h-5 w-5" /></div>
                      )}
                      <div>
                        <div className="font-bold text-white group-hover:text-brand-accent">{c.name}</div>
                        <div className="text-[10px] text-brand-text-muted uppercase tracking-widest">{c.totals.in_storage_qty} available in storage</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            // Step 2: Select Location & Quantity
            <form onSubmit={handleCheckout} className="space-y-6">
              
              {/* Selected Component Summary Banner */}
              <div className="flex items-center justify-between bg-[#151311] p-3.5 rounded-md border border-[#2e2a25]">
                <div className="flex items-center gap-3">
                  {selectedComponent.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selectedComponent.photo_url} alt="" className="h-10 w-10 object-cover rounded border border-[#332f2a]" />
                  ) : (
                    <div className="h-10 w-10 bg-[#222] rounded flex items-center justify-center text-[#555]"><Package className="h-5 w-5" /></div>
                  )}
                  <div>
                    <div className="font-bold text-white text-sm">{selectedComponent.name}</div>
                    <div className="text-[10px] text-brand-text-muted uppercase tracking-widest">
                      {selectedComponent.totals.in_storage_qty} in storage
                    </div>
                  </div>
                </div>
                <button 
                  type="button" 
                  onClick={() => {
                    setSelectedComponent(null);
                    setSelectedLoc(null);
                    setLocations([]);
                  }} 
                  className="text-xs text-brand-accent hover:underline font-medium"
                >
                  Change Component
                </button>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-brand-text-muted flex items-center justify-between">
                  <span>Select source location for check-out</span>
                  <span className="text-[10px] text-brand-gold/80 lowercase">{locations.length} {locations.length === 1 ? 'location' : 'locations'}</span>
                </div>

                {loading && locations.length === 0 ? (
                  <div className="py-8 text-center text-brand-text-muted text-sm flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-brand-accent" />
                    <span>Loading storage locations & paths...</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {locations.map(loc => {
                      const isSelected = selectedLoc?.id === loc.id;
                      return (
                        <div 
                          key={loc.id} 
                          onClick={() => setSelectedLoc(loc)}
                          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
                            isSelected 
                              ? 'bg-brand-accent/10 border-brand-accent shadow-[0_0_15px_rgba(188,115,83,0.15)] ring-1 ring-brand-accent/30' 
                              : 'bg-[#181614] border-[#332f2a] hover:border-[#4a443c] hover:bg-[#1f1c19]'
                          }`}
                        >
                          <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                            <input 
                              type="radio" 
                              name="location" 
                              checked={isSelected} 
                              onChange={() => setSelectedLoc(loc)}
                              className="accent-brand-accent mt-1 sm:mt-0 h-4 w-4 shrink-0 cursor-pointer"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-white text-sm tracking-wide">
                                {loc.destination || loc.hotspot?.label || 'Location'}
                              </div>
                              {loc.trail ? (
                                <div 
                                  className="text-[11px] text-brand-text-muted flex items-center gap-1.5 mt-0.5 truncate"
                                  onMouseEnter={(e) => {
                                    handleShowTooltip(e, {
                                      fullLabel: loc.fullLabel,
                                      label: loc.destination,
                                      roomName: loc.room?.name || loc.trail,
                                      quantity: loc.quantity,
                                      footerHint: "Click Locate to view on Room Map"
                                    });
                                  }}
                                  onMouseLeave={handleHideTooltip}
                                >
                                  <span className="text-[10px] uppercase font-mono tracking-wider text-brand-gold/80 truncate">
                                    {loc.trail}
                                  </span>
                                </div>
                              ) : loc.room?.name ? (
                                <div className="text-[10px] text-brand-text-muted uppercase tracking-widest mt-0.5">
                                  {loc.room.name}
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#2b2722]">
                            {/* Locate Button */}
                            <button
                              type="button"
                              onClick={(e) => handleLocateLocation(e, loc)}
                              onMouseEnter={(e) => {
                                handleShowTooltip(e, {
                                  fullLabel: loc.fullLabel,
                                  label: loc.destination,
                                  roomName: loc.room?.name || loc.trail,
                                  quantity: loc.quantity,
                                  footerHint: "Click to open Room Map & highlight location"
                                });
                              }}
                              onMouseLeave={handleHideTooltip}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#25211c] hover:bg-brand-accent/25 border border-[#3e3830] hover:border-brand-accent text-xs font-semibold text-brand-gold hover:text-white transition-all group/btn shadow-sm"
                              data-tooltip="View exact location on Room Map"
                            >
                              <MapPin className="h-3.5 w-3.5 text-brand-accent group-hover/btn:scale-110 transition-transform" />
                              <span className="text-[11px] uppercase tracking-wider">Locate</span>
                              <ExternalLink className="h-3 w-3 text-brand-text-muted group-hover/btn:text-white" />
                            </button>

                            {/* Available Quantity */}
                            <div className="text-right pl-3 border-l border-[#2e2a25] min-w-[70px]">
                              <div className="text-lg font-serif font-bold text-white leading-tight">
                                {loc.quantity}
                              </div>
                              <div className="text-[9px] text-brand-text-muted uppercase tracking-widest whitespace-nowrap">
                                Available Here
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {selectedLoc && (
                <div className="flex items-end gap-4 bg-[#151311] p-4 border border-[#332f2a] rounded-md">
                  <div className="flex-1">
                    <label className="block text-[10px] uppercase tracking-widest text-brand-text-muted mb-2 font-semibold">
                      Quantity to Check Out
                    </label>
                    <ThemedNumberInput 
                      min={1} 
                      max={selectedLoc.quantity} 
                      value={qty}
                      onChange={setQty}
                      className="w-full bg-[#1a1816] border border-[#332f2a]"
                    />
                  </div>
                  <button 
                    type="submit" 
                    disabled={loading} 
                    className="px-8 py-3 bg-brand-accent text-white font-bold tracking-widest text-sm rounded-sm hover:bg-brand-accent-hover disabled:opacity-50 transition-all shadow-md shadow-brand-accent/20"
                  >
                    {loading ? "PROCESSING..." : "CHECK OUT"}
                  </button>
                </div>
              )}
            </form>
          )}
        </div>
      </div>

      {/* Storage Sequence Tooltip */}
      <StorageSequenceTooltip data={hoverTooltip} />
    </div>
  );
}
