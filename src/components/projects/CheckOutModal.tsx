"use client";

import { useState, useEffect } from "react";
import { getInventory, getComponentDetails, checkoutComponent, ComponentWithTotals, ComponentLocation } from "@/lib/api";
import { Search, X, Package } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";

interface Props {
  projectId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function CheckOutModal({ projectId, onClose, onSuccess }: Props) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  
  const [searchResults, setSearchResults] = useState<ComponentWithTotals[]>([]);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  
  const [locations, setLocations] = useState<ComponentLocation[]>([]);
  const [selectedLoc, setSelectedLoc] = useState<ComponentLocation | null>(null);
  
  const [qty, setQty] = useState("1");
  const [loading, setLoading] = useState(false);

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

  const handleSelectComponent = async (cId: string) => {
    setSelectedComponentId(cId);
    setLoading(true);
    try {
      const details = await getComponentDetails(cId);
      // Only locations with qty > 0
      setLocations(details.locations.filter(l => l.quantity > 0));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComponentId || !selectedLoc) return;
    const numQty = parseInt(qty, 10);
    if (isNaN(numQty) || numQty <= 0 || numQty > selectedLoc.quantity) return;
    
    setLoading(true);
    try {
      await checkoutComponent(projectId, selectedComponentId, selectedLoc.hotspot_id, numQty);
      onSuccess();
    } catch (err) {
      console.error(err);
      alert("Failed to checkout component.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#1a1816] border border-[#332f2a] rounded-lg w-full max-w-2xl flex flex-col max-h-[90vh]">
        
        <div className="flex justify-between items-center p-6 border-b border-[#332f2a]">
          <h2 className="text-xl font-bold text-white font-serif">Check Out Component</h2>
          <button onClick={onClose} className="text-brand-text-muted hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!selectedComponentId ? (
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
                    onClick={() => handleSelectComponent(c.id)}
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
              <div className="flex justify-between items-center mb-6">
                <div className="text-sm text-brand-text-muted">Select source location for check-out</div>
                <button type="button" onClick={() => setSelectedComponentId(null)} className="text-xs text-brand-accent hover:underline">Change Component</button>
              </div>

              {loading && locations.length === 0 ? (
                <div className="text-brand-text-muted text-sm">Loading locations...</div>
              ) : (
                <div className="space-y-3">
                  {locations.map(loc => (
                    <label 
                      key={loc.id} 
                      className={`block flex justify-between items-center p-4 border rounded cursor-pointer transition-colors ${selectedLoc?.id === loc.id ? 'bg-brand-accent/10 border-brand-accent' : 'bg-[#1a1816] border-[#332f2a] hover:border-[#332f2a]'}`}
                    >
                      <div className="flex items-center gap-3">
                        <input 
                          type="radio" 
                          name="location" 
                          checked={selectedLoc?.id === loc.id} 
                          onChange={() => setSelectedLoc(loc)}
                          className="accent-brand-accent"
                        />
                        <div>
                          <div className="font-bold text-white">{loc.hotspot?.label}</div>
                          <div className="text-[10px] text-brand-text-muted uppercase tracking-widest">{loc.room?.name}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-serif text-white">{loc.quantity}</div>
                        <div className="text-[9px] text-brand-text-muted uppercase tracking-widest">Available Here</div>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {selectedLoc && (
                <div className="flex items-end gap-4 bg-[#1a1816] p-4 border border-[#332f2a] rounded">
                  <div className="flex-1">
                    <label className="block text-[10px] uppercase tracking-widest text-brand-text-muted mb-2">Quantity to Check Out</label>
                    <input 
                      type="number" 
                      min="1" 
                      max={selectedLoc.quantity} 
                      value={qty}
                      onChange={e => setQty(e.target.value)}
                      className="w-full bg-[#1a1816] border border-[#332f2a] p-3 text-white focus:border-brand-accent focus:outline-none"
                    />
                  </div>
                  <button type="submit" disabled={loading} className="px-8 py-3 bg-brand-accent text-white font-bold tracking-widest text-sm rounded-sm hover:bg-brand-accent-hover disabled:opacity-50">
                    {loading ? "PROCESSING..." : "CHECK OUT"}
                  </button>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
