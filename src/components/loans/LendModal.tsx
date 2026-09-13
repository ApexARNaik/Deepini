"use client";

import React, { useState, useEffect } from "react";
import { 
  getInventory, 
  getComponentDetails, 
  getProjects, 
  lendComponent, 
  lendProject, 
  ComponentWithTotals, 
  ComponentLocation, 
  Project 
} from "@/lib/api";
import { X, Search, Package, MapPin, Compass, AlertCircle, Calendar, User, Phone, FileText } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { ThemedNumberInput } from "@/components/ThemedNumberInput";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialType?: 'component' | 'project';
  initialComponentId?: string;
  initialProjectId?: string;
}

export function LendModal({
  isOpen,
  onClose,
  onSuccess,
  initialType = 'component',
  initialComponentId,
  initialProjectId,
}: Props) {
  const [loanType, setLoanType] = useState<'component' | 'project'>(initialType);

  // Component lending state
  const [componentSearch, setComponentSearch] = useState("");
  const debouncedCompSearch = useDebounce(componentSearch, 250);
  const [componentResults, setComponentResults] = useState<ComponentWithTotals[]>([]);
  const [selectedComponent, setSelectedComponent] = useState<ComponentWithTotals | null>(null);
  const [locations, setLocations] = useState<ComponentLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("1");

  // Project lending state
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId || "");

  // Borrower details state
  const [borrowerName, setBorrowerName] = useState("");
  const [borrowerContact, setBorrowerContact] = useState("");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7); // Default 7 days from now
    return d.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tomorrow's date string for min date validation
  const minDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  })();

  // Initialize initialComponentId or initialProjectId if provided
  useEffect(() => {
    if (!isOpen) return;
    if (initialComponentId) {
      setLoanType('component');
      getComponentDetails(initialComponentId).then(details => {
        setSelectedComponent(details.component as any);
        const availableLocs = (details.locations || []).filter(l => l.quantity > 0);
        setLocations(availableLocs);
        if (availableLocs.length > 0) {
          setSelectedLocationId(availableLocs[0].hotspot_id);
        }
      }).catch(console.error);
    }

    if (initialProjectId) {
      setLoanType('project');
      setSelectedProjectId(initialProjectId);
    }
  }, [isOpen, initialComponentId, initialProjectId]);

  // Search components
  useEffect(() => {
    if (!isOpen || loanType !== 'component' || selectedComponent || !debouncedCompSearch.trim()) {
      if (!debouncedCompSearch.trim()) setComponentResults([]);
      return;
    }
    getInventory(debouncedCompSearch).then(res => {
      setComponentResults(res.filter(c => c.totals.in_storage_qty > 0));
    }).catch(console.error);
  }, [debouncedCompSearch, loanType, selectedComponent, isOpen]);

  // Load projects list
  useEffect(() => {
    if (!isOpen || loanType !== 'project') return;
    getProjects().then(projs => {
      // Filter out planning projects (planning has 0 components and cannot be lent)
      setProjectList(projs.filter(p => p.status !== 'planning'));
    }).catch(console.error);
  }, [isOpen, loanType]);

  const handleSelectComponent = async (c: ComponentWithTotals) => {
    setSelectedComponent(c);
    setLoading(true);
    setError(null);
    try {
      const details = await getComponentDetails(c.id);
      const availableLocs = (details.locations || []).filter(l => l.quantity > 0);
      setLocations(availableLocs);
      if (availableLocs.length > 0) {
        setSelectedLocationId(availableLocs[0].hotspot_id);
      } else {
        setSelectedLocationId("");
        setError("This component has no available stock in physical storage.");
      }
    } catch (err: any) {
      console.error(err);
      setError("Failed to load component locations.");
    } finally {
      setLoading(false);
    }
  };

  const selectedLoc = locations.find(l => l.hotspot_id === selectedLocationId);
  const selectedProjObj = projectList.find(p => p.id === selectedProjectId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!borrowerName.trim()) {
      setError("Borrower name is required.");
      return;
    }

    if (!dueDate) {
      setError("Return due date is required.");
      return;
    }

    setLoading(true);
    try {
      if (loanType === 'component') {
        if (!selectedComponent) {
          setError("Please select a component to lend.");
          setLoading(false);
          return;
        }

        // Strict enforcement: source leaf hotspot must be selected
        if (!selectedLocationId) {
          setError("You must select which storage compartment the component was taken from.");
          setLoading(false);
          return;
        }

        const numQty = parseInt(quantity, 10);
        if (isNaN(numQty) || numQty <= 0) {
          setError("Please enter a valid quantity.");
          setLoading(false);
          return;
        }

        if (selectedLoc && numQty > selectedLoc.quantity) {
          setError(`Cannot lend ${numQty} units. Only ${selectedLoc.quantity} available in this compartment.`);
          setLoading(false);
          return;
        }

        await lendComponent({
          componentId: selectedComponent.id,
          sourceLocationId: selectedLocationId,
          quantity: numQty,
          borrowerName: borrowerName.trim(),
          borrowerContact: borrowerContact.trim() || undefined,
          dueDate,
          notes: notes.trim() || undefined
        });
      } else {
        if (!selectedProjectId) {
          setError("Please select a project to lend.");
          setLoading(false);
          return;
        }

        await lendProject({
          projectId: selectedProjectId,
          borrowerName: borrowerName.trim(),
          borrowerContact: borrowerContact.trim() || undefined,
          dueDate,
          notes: notes.trim() || undefined
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Lending failed:", err);
      setError(err.message || "Failed to record loan.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#1a1816] border border-[#332f2a] rounded-lg w-full max-w-2xl flex flex-col max-h-[92vh] shadow-2xl shadow-black/80 my-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-[#332f2a] bg-[#161412] shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white font-serif tracking-wide">
              Lend {loanType === 'component' ? 'Component' : 'Project'}
            </h2>
            <p className="text-xs text-brand-text-muted mt-0.5">
              Record borrower details, expected return date, and enforce origin location tracking.
            </p>
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 themed-scrollbar">
          
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Type Selector (only if neither initialComponent nor initialProject was fixed) */}
          {!initialComponentId && !initialProjectId && (
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-brand-text-muted mb-2">Item to Lend</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setLoanType('component');
                    setError(null);
                  }}
                  className={`py-3 px-4 rounded border text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                    loanType === 'component'
                      ? 'bg-brand-accent/20 border-brand-accent text-white ring-1 ring-brand-accent/50'
                      : 'bg-[#191715] border-[#332f2a] text-brand-text-muted hover:text-white'
                  }`}
                >
                  <Package className="h-4 w-4 text-brand-accent" />
                  <span>Component</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLoanType('project');
                    setError(null);
                  }}
                  className={`py-3 px-4 rounded border text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                    loanType === 'project'
                      ? 'bg-brand-accent/20 border-brand-accent text-white ring-1 ring-brand-accent/50'
                      : 'bg-[#191715] border-[#332f2a] text-brand-text-muted hover:text-white'
                  }`}
                >
                  <Compass className="h-4 w-4 text-brand-accent" />
                  <span>Project</span>
                </button>
              </div>
            </div>
          )}

          {/* ================= COMPONENT SELECTION & LOCATION ENFORCEMENT ================= */}
          {loanType === 'component' && (
            <div className="space-y-4">
              {!selectedComponent ? (
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-brand-text-muted mb-1.5">Search Component</label>
                  <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-text-muted" />
                    <input 
                      autoFocus
                      type="text" 
                      placeholder="Search inventory by name, tags, or notes..." 
                      value={componentSearch}
                      onChange={(e) => setComponentSearch(e.target.value)}
                      className="w-full bg-[#191715] border border-[#332f2a] pl-10 pr-4 py-2.5 text-sm text-white focus:border-brand-accent focus:outline-none transition-colors rounded"
                    />
                  </div>

                  {componentSearch && componentResults.length === 0 && (
                    <div className="text-center text-xs text-brand-text-muted py-6 border border-dashed border-[#332f2a] rounded mt-2">
                      No available components in storage match your search.
                    </div>
                  )}

                  {componentResults.length > 0 && (
                    <div className="space-y-2 mt-2 max-h-56 overflow-y-auto themed-scrollbar border border-[#2a2622] p-1 rounded">
                      {componentResults.map(c => (
                        <button 
                          key={c.id} 
                          type="button"
                          onClick={() => handleSelectComponent(c)}
                          className="w-full flex items-center justify-between p-2.5 bg-[#191715] border border-[#332f2a] hover:border-brand-accent rounded text-left transition-colors group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {c.photo_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={c.photo_url} alt="" className="h-9 w-9 object-cover rounded border border-[#332f2a] shrink-0" />
                            ) : (
                              <div className="h-9 w-9 bg-[#222] rounded flex items-center justify-center text-[#555] shrink-0"><Package className="h-4 w-4" /></div>
                            )}
                            <div className="min-w-0">
                              <div className="font-bold text-white text-sm group-hover:text-brand-accent truncate">{c.name}</div>
                              <div className="text-[10px] text-brand-text-muted uppercase tracking-wider">{c.totals.in_storage_qty} available in storage</div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-[#161412] border border-[#332f2a] rounded flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    {selectedComponent.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={selectedComponent.photo_url} alt="" className="h-10 w-10 object-cover rounded border border-[#332f2a] shrink-0" />
                    ) : (
                      <div className="h-10 w-10 bg-[#222] rounded flex items-center justify-center text-[#555] shrink-0"><Package className="h-5 w-5" /></div>
                    )}
                    <div className="min-w-0">
                      <div className="font-bold text-white text-sm truncate">{selectedComponent.name}</div>
                      <div className="text-[10px] text-brand-text-muted uppercase tracking-wider">
                        {selectedComponent.totals?.in_storage_qty ?? 0} total in storage
                      </div>
                    </div>
                  </div>
                  {!initialComponentId && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedComponent(null);
                        setLocations([]);
                        setSelectedLocationId("");
                      }}
                      className="text-xs text-brand-accent hover:underline font-medium shrink-0 ml-2"
                    >
                      Change
                    </button>
                  )}
                </div>
              )}

              {/* ENFORCED SOURCE LOCATION SELECTION */}
              {selectedComponent && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] uppercase tracking-widest text-brand-text-muted font-bold flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-brand-accent" />
                      <span>Taken From Storage Location (Enforced Origin)</span>
                    </label>
                    <span className="text-[10px] text-brand-gold uppercase tracking-wider">Required</span>
                  </div>

                  {locations.length === 0 ? (
                    <div className="p-4 bg-[#191715] border border-amber-900/30 rounded text-xs text-amber-400">
                      No stock currently available in any storage compartment.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto themed-scrollbar">
                      {locations.map(loc => {
                        const isSelected = selectedLocationId === loc.hotspot_id;
                        return (
                          <label 
                            key={loc.id} 
                            className={`flex justify-between items-center p-3 border rounded cursor-pointer transition-all ${
                              isSelected 
                                ? 'bg-brand-accent/15 border-brand-accent ring-1 ring-brand-accent/40' 
                                : 'bg-[#191715] border-[#332f2a] hover:border-[#4a443c]'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input 
                                type="radio" 
                                name="sourceLocation" 
                                checked={isSelected} 
                                onChange={() => setSelectedLocationId(loc.hotspot_id)}
                                className="accent-brand-accent h-4 w-4"
                              />
                              <div>
                                <div className="font-bold text-white text-xs">{loc.hotspot?.label || 'Compartment'}</div>
                                <div className="text-[10px] text-brand-text-muted uppercase tracking-wider">{loc.room?.name || 'Room'}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-base font-serif text-white">{loc.quantity}</div>
                              <div className="text-[9px] text-brand-text-muted uppercase tracking-wider">Units here</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {/* Quantity to Lend */}
                  {selectedLoc && (
                    <div className="mt-3">
                      <label className="block text-[10px] uppercase tracking-widest text-brand-text-muted mb-1.5">Quantity to Lend</label>
                      <ThemedNumberInput
                        min={1}
                        max={selectedLoc.quantity}
                        value={quantity}
                        onChange={setQuantity}
                        className="w-full bg-[#191715] border border-[#332f2a]"
                      />
                      <div className="text-[10px] text-brand-text-muted mt-1">
                        Max available from {selectedLoc.hotspot?.label}: <span className="text-white font-medium">{selectedLoc.quantity}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ================= PROJECT SELECTION ================= */}
          {loanType === 'project' && (
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-brand-text-muted mb-1.5">Select Project</label>
                {projectList.length === 0 ? (
                  <div className="p-4 bg-[#191715] border border-[#332f2a] rounded text-xs text-brand-text-muted">
                    No active or archived projects available to lend.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto themed-scrollbar">
                    {projectList.map(proj => {
                      const isSelected = selectedProjectId === proj.id;
                      return (
                        <label
                          key={proj.id}
                          className={`flex justify-between items-center p-3 border rounded cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-brand-accent/15 border-brand-accent ring-1 ring-brand-accent/40'
                              : 'bg-[#191715] border-[#332f2a] hover:border-[#4a443c]'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="projectSelection"
                              checked={isSelected}
                              onChange={() => setSelectedProjectId(proj.id)}
                              className="accent-brand-accent h-4 w-4"
                            />
                            <div>
                              <div className="font-bold text-white text-sm">{proj.name}</div>
                              <div className="text-[10px] text-brand-text-muted flex items-center gap-2">
                                <span className={`uppercase tracking-wider font-semibold ${
                                  proj.status === 'archived' ? 'text-zinc-400' : 'text-emerald-400'
                                }`}>
                                  {proj.status}
                                </span>
                                {proj.location_label && (
                                  <span className="flex items-center gap-1 text-amber-400/90">
                                    <MapPin className="h-3 w-3" /> {proj.location_label}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {selectedProjObj && selectedProjObj.status === 'archived' && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded flex items-center gap-2.5 text-xs text-amber-300">
                  <MapPin className="h-4 w-4 shrink-0 text-amber-400" />
                  <div>
                    <span className="font-bold uppercase tracking-wider text-[10px] block">Enforced Origin Location:</span>
                    <span>This archived build will be physically taken from <strong>{selectedProjObj.location_label || "Assigned Leaf Hotspot"}</strong>.</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= BORROWER DETAILS ================= */}
          <div className="pt-4 border-t border-[#332f2a] space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <User className="h-3.5 w-3.5 text-brand-accent" />
              <span>Borrower Information</span>
            </h3>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-brand-text-muted mb-1 font-bold">
                  Borrower Name <span className="text-brand-accent">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-brand-text-muted pointer-events-none" />
                  <input
                    required
                    type="text"
                    placeholder="e.g. Rahul Sharma"
                    value={borrowerName}
                    onChange={(e) => setBorrowerName(e.target.value)}
                    className="w-full bg-[#191715] border border-[#332f2a] pl-9 pr-3 py-2 text-xs text-white focus:border-brand-accent focus:outline-none rounded"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-widest text-brand-text-muted mb-1">
                  Contact Info / Phone (Optional)
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-brand-text-muted pointer-events-none" />
                  <input
                    type="text"
                    placeholder="+91 98765 43210 or @telegram"
                    value={borrowerContact}
                    onChange={(e) => setBorrowerContact(e.target.value)}
                    className="w-full bg-[#191715] border border-[#332f2a] pl-9 pr-3 py-2 text-xs text-white focus:border-brand-accent focus:outline-none rounded"
                  />
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-brand-text-muted mb-1 font-bold">
                  Return Due Date <span className="text-brand-accent">*</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-brand-text-muted pointer-events-none" />
                  <input
                    required
                    type="date"
                    min={minDate}
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-[#191715] border border-[#332f2a] pl-9 pr-3 py-2 text-xs text-white focus:border-brand-accent focus:outline-none rounded [color-scheme:dark]"
                  />
                </div>
                <div className="text-[10px] text-brand-gold mt-1">
                  You will receive an in-app notification 1 day prior to this date.
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-widest text-brand-text-muted mb-1">
                  Purpose / Notes (Optional)
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 h-3.5 w-3.5 text-brand-text-muted pointer-events-none" />
                  <textarea
                    rows={2}
                    placeholder="e.g. For robotics testing competition"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-[#191715] border border-[#332f2a] pl-9 pr-3 py-2 text-xs text-white focus:border-brand-accent focus:outline-none rounded resize-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-[#332f2a] flex justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-brand-text-muted hover:text-white uppercase tracking-widest transition-colors font-medium"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading || (loanType === 'component' && (!selectedComponent || !selectedLocationId)) || (loanType === 'project' && !selectedProjectId)}
              className="px-6 py-2 bg-brand-accent hover:bg-brand-accent-hover text-white text-xs font-bold uppercase tracking-widest rounded-sm transition-colors disabled:opacity-50 shadow-sm"
            >
              {loading ? "RECORDING LOAN..." : "CONFIRM & LEND"}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
