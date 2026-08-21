"use client";

import { useState, useEffect } from "react";
import { ProjectComponent, searchLeafHotspots, checkinComponent } from "@/lib/api";
import { X, Search } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";

interface Props {
  item: ProjectComponent;
  onClose: () => void;
  onSuccess: () => void;
}

export function CheckInModal({ item, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  
  // Location Search State
  const [locSearch, setLocSearch] = useState("");
  const debouncedLocSearch = useDebounce(locSearch, 300);
  const [locResults, setLocResults] = useState<{ id: string, pathLabel: string }[]>([]);
  
  // By default, return to source location
  const [selectedLocId, setSelectedLocId] = useState(item.source_location_id);
  const [selectedLocLabel, setSelectedLocLabel] = useState("Original Source Location"); // We can fetch the real path if needed, but it's okay for now.
  
  useEffect(() => {
    searchLeafHotspots(debouncedLocSearch).then(res => {
      setLocResults(res);
    }).catch(console.error);
  }, [debouncedLocSearch]);

  const handleSelectLoc = (id: string, label: string) => {
    setSelectedLocId(id);
    setSelectedLocLabel(label);
    setLocSearch(""); // clear search to collapse dropdown
  };

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLocId) return;
    
    setLoading(true);
    try {
      await checkinComponent(item.id, selectedLocId);
      onSuccess();
    } catch (err) {
      console.error(err);
      alert("Failed to check in component.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#1a1816] border border-[#332f2a] rounded-lg w-full max-w-lg flex flex-col">
        
        <div className="flex justify-between items-center p-6 border-b border-[#332f2a]">
          <h2 className="text-xl font-bold text-white font-serif">Check In Component</h2>
          <button onClick={onClose} className="text-brand-text-muted hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleCheckIn} className="p-6 space-y-8">
          
          <div className="flex items-center gap-4 bg-[#1a1816] p-4 rounded border border-[#332f2a]">
            {item.component?.photo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.component.photo_url} alt="" className="h-12 w-12 object-cover rounded border border-[#332f2a]" />
            )}
            <div>
              <div className="font-bold text-white mb-1">{item.component?.name}</div>
              <div className="text-[10px] text-brand-text-muted uppercase tracking-widest">
                Returning {item.quantity} units
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest text-brand-text-muted mb-2">Return Location</label>
            <div className="relative">
              <div className="w-full bg-[#1a1816] border border-[#332f2a] p-3 text-sm text-white mb-2 rounded font-bold truncate">
                {selectedLocLabel}
              </div>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-text-muted" />
                <input 
                  type="text" 
                  placeholder="Search for a different location..." 
                  value={locSearch}
                  onChange={(e) => setLocSearch(e.target.value)}
                  className="w-full bg-[#1a1816] border border-[#332f2a] pl-10 pr-4 py-2 text-sm text-brand-text focus:border-brand-accent focus:outline-none transition-colors"
                />
              </div>

              {locSearch && (
                <div className="absolute z-10 w-full mt-1 bg-[#1a1816] border border-[#332f2a] max-h-48 overflow-y-auto rounded shadow-xl">
                  {locResults.map(loc => (
                    <button 
                      key={loc.id} 
                      type="button"
                      onClick={() => handleSelectLoc(loc.id, loc.pathLabel)}
                      className="w-full text-left p-3 text-sm text-brand-text hover:bg-[#222] hover:text-white border-b border-[#332f2a] last:border-0 truncate"
                    >
                      {loc.pathLabel}
                    </button>
                  ))}
                  {locResults.length === 0 && (
                    <div className="p-3 text-sm text-brand-text-muted text-center">No locations found.</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-[#332f2a]">
            <button type="submit" disabled={loading} className="px-8 py-3 bg-brand-accent text-white font-bold tracking-widest text-sm rounded-sm hover:bg-brand-accent-hover disabled:opacity-50">
              {loading ? "PROCESSING..." : "CONFIRM CHECK IN"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
