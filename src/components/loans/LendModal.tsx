"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  getInventory, 
  getComponentDetails, 
  getProjects, 
  getLoans,
  Loan,
  lendComponent, 
  lendProject, 
  getAllHotspotsWithHierarchy,
  getHotspotTreeSummary,
  lendHotspotTree,
  getMultipleHotspotsSummary,
  lendMultipleHotspots,
  HotspotHierarchyItem,
  HotspotTreeSummary,
  HotspotTreeComponentItem,
  ComponentWithTotals, 
  ComponentLocation, 
  Project 
} from "@/lib/api";
import { X, Search, Package, MapPin, Compass, AlertCircle, Calendar, User, Phone, FileText, ChevronDown, Clock, Layers, Check, ChevronRight, CheckSquare } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { ThemedNumberInput } from "@/components/ThemedNumberInput";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialType?: 'component' | 'project' | 'hotspot';
  initialComponentId?: string;
  initialProjectId?: string;
  initialHotspotId?: string;
  initialHotspotIds?: string[];
}

interface PastBorrower {
  name: string;
  contact?: string;
  lastLentAt: string;
  count: number;
}

export function LendModal({
  isOpen,
  onClose,
  onSuccess,
  initialType = 'component',
  initialComponentId,
  initialProjectId,
  initialHotspotId,
  initialHotspotIds,
}: Props) {
  const [loanType, setLoanType] = useState<'component' | 'project' | 'hotspot'>(initialType);

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

  // Hotspot lending state
  const [allHotspots, setAllHotspots] = useState<HotspotHierarchyItem[]>([]);
  const [hotspotSearch, setHotspotSearch] = useState("");
  const [selectedHotspotIds, setSelectedHotspotIds] = useState<string[]>(
    initialHotspotIds || (initialHotspotId ? [initialHotspotId] : [])
  );
  const [multiHotspotSummary, setMultiHotspotSummary] = useState<{
    hotspots: { id: string; label: string }[];
    components: HotspotTreeComponentItem[];
    totalUnits: number;
  } | null>(null);
  const [loadingHotspotSummary, setLoadingHotspotSummary] = useState(false);

  // Borrower details state
  const [borrowerName, setBorrowerName] = useState("");
  const [borrowerContact, setBorrowerContact] = useState("");
  const [pastBorrowers, setPastBorrowers] = useState<PastBorrower[]>([]);
  const [isBorrowerDropdownOpen, setIsBorrowerDropdownOpen] = useState(false);
  const [highlightedBorrowerIndex, setHighlightedBorrowerIndex] = useState(-1);
  const borrowerDropdownRef = useRef<HTMLDivElement>(null);
  const borrowerInputRef = useRef<HTMLInputElement>(null);

  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7); // Default 7 days from now
    return d.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load past borrowers from previous loans, sorted by most recently entered/lent first
  useEffect(() => {
    if (!isOpen) return;
    getLoans()
      .then((allLoans) => {
        const borrowerMap = new Map<string, PastBorrower>();
        allLoans.forEach((loan) => {
          const name = loan.borrower_name?.trim();
          if (!name) return;
          const key = name.toLowerCase();
          const loanDate = loan.lent_at || '';
          const existing = borrowerMap.get(key);
          if (!existing) {
            borrowerMap.set(key, {
              name,
              contact: loan.borrower_contact?.trim() || undefined,
              lastLentAt: loanDate,
              count: 1,
            });
          } else {
            existing.count += 1;
            if (loanDate && (!existing.lastLentAt || new Date(loanDate) > new Date(existing.lastLentAt))) {
              existing.lastLentAt = loanDate;
              if (loan.borrower_contact?.trim()) {
                existing.contact = loan.borrower_contact.trim();
              }
            } else if (!existing.contact && loan.borrower_contact?.trim()) {
              existing.contact = loan.borrower_contact.trim();
            }
          }
        });

        // Sort by most recently entered / lent first
        const sorted = Array.from(borrowerMap.values()).sort((a, b) => {
          const timeA = a.lastLentAt ? new Date(a.lastLentAt).getTime() : 0;
          const timeB = b.lastLentAt ? new Date(b.lastLentAt).getTime() : 0;
          return timeB - timeA;
        });

        setPastBorrowers(sorted);
      })
      .catch(console.error);
  }, [isOpen]);

  // Click outside to close borrower dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (borrowerDropdownRef.current && !borrowerDropdownRef.current.contains(event.target as Node)) {
        setIsBorrowerDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Scroll highlighted borrower into view
  useEffect(() => {
    if (highlightedBorrowerIndex >= 0) {
      const el = document.getElementById(`borrower-opt-${highlightedBorrowerIndex}`);
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedBorrowerIndex]);

  const handleSelectBorrower = (b: PastBorrower) => {
    setBorrowerName(b.name);
    if (!borrowerContact.trim() && b.contact) {
      setBorrowerContact(b.contact);
    }
    setIsBorrowerDropdownOpen(false);
    setHighlightedBorrowerIndex(-1);
  };

  const trimmedBorrower = borrowerName.trim().toLowerCase();
  const matchingBorrowers = pastBorrowers.filter(b => 
    !trimmedBorrower || b.name.toLowerCase().includes(trimmedBorrower)
  );

  const handleBorrowerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isBorrowerDropdownOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsBorrowerDropdownOpen(true);
      setHighlightedBorrowerIndex(0);
      return;
    }

    if (isBorrowerDropdownOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedBorrowerIndex(prev => 
          prev < matchingBorrowers.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedBorrowerIndex(prev => 
          prev > 0 ? prev - 1 : Math.max(0, matchingBorrowers.length - 1)
        );
      } else if (e.key === 'Enter') {
        if (highlightedBorrowerIndex >= 0 && matchingBorrowers[highlightedBorrowerIndex]) {
          e.preventDefault();
          handleSelectBorrower(matchingBorrowers[highlightedBorrowerIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsBorrowerDropdownOpen(false);
      }
    }
  };

  // Tomorrow's date string for min date validation
  const minDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  })();

  // Initialize initialComponentId, initialProjectId, or initialHotspotId if provided
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

    const initialHIds = initialHotspotIds && initialHotspotIds.length > 0
      ? initialHotspotIds
      : (initialHotspotId ? [initialHotspotId] : []);

    if (initialHIds.length > 0) {
      setLoanType('hotspot');
      setSelectedHotspotIds(initialHIds);
    }
  }, [isOpen, initialComponentId, initialProjectId, initialHotspotId, initialHotspotIds]);

  // Load summary whenever selectedHotspotIds changes
  useEffect(() => {
    if (!isOpen || loanType !== 'hotspot') return;
    if (selectedHotspotIds.length === 0) {
      setMultiHotspotSummary(null);
      setLoadingHotspotSummary(false);
      return;
    }

    let isMounted = true;
    setLoadingHotspotSummary(true);
    setError(null);

    getMultipleHotspotsSummary(selectedHotspotIds)
      .then(res => {
        if (!isMounted) return;
        setMultiHotspotSummary(res);
        if (res.components.length === 0) {
          setError("The selected hotspot(s) contain no components in storage to lend.");
        }
      })
      .catch(err => {
        console.error("Failed to load multi-hotspot summary:", err);
        if (isMounted) setError(err.message || "Failed to load hotspot details.");
      })
      .finally(() => {
        if (isMounted) setLoadingHotspotSummary(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, loanType, selectedHotspotIds]);

  // Load all hotspots for hotspot lending
  useEffect(() => {
    if (!isOpen || loanType !== 'hotspot') return;
    getAllHotspotsWithHierarchy()
      .then(setAllHotspots)
      .catch(console.error);
  }, [isOpen, loanType]);

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
      } else if (loanType === 'project') {
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
      } else if (loanType === 'hotspot') {
        if (selectedHotspotIds.length === 0) {
          setError("Please select at least one hotspot or container to lend.");
          setLoading(false);
          return;
        }

        if (!multiHotspotSummary || multiHotspotSummary.components.length === 0) {
          setError("The selected hotspot(s) contain no stored components to lend.");
          setLoading(false);
          return;
        }

        await lendMultipleHotspots({
          hotspotIds: selectedHotspotIds,
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
              Lend {loanType === 'component' ? 'Component' : loanType === 'project' ? 'Project' : 'Hotspot & Contents'}
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

          {/* Type Selector (only if neither initialComponent nor initialProject nor initialHotspot was fixed) */}
          {!initialComponentId && !initialProjectId && !initialHotspotId && (
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-brand-text-muted mb-2">Item to Lend</label>
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setLoanType('component');
                    setError(null);
                  }}
                  className={`py-2.5 px-3 rounded border text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
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
                  className={`py-2.5 px-3 rounded border text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                    loanType === 'project'
                      ? 'bg-brand-accent/20 border-brand-accent text-white ring-1 ring-brand-accent/50'
                      : 'bg-[#191715] border-[#332f2a] text-brand-text-muted hover:text-white'
                  }`}
                >
                  <Compass className="h-4 w-4 text-brand-accent" />
                  <span>Project</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLoanType('hotspot');
                    setError(null);
                  }}
                  className={`py-2.5 px-3 rounded border text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                    loanType === 'hotspot'
                      ? 'bg-brand-accent/20 border-brand-accent text-white ring-1 ring-brand-accent/50'
                      : 'bg-[#191715] border-[#332f2a] text-brand-text-muted hover:text-white'
                  }`}
                >
                  <Layers className="h-4 w-4 text-brand-accent" />
                  <span>Hotspot</span>
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

          {/* ================= HOTSPOT / CONTAINER SELECTION ================= */}
          {loanType === 'hotspot' && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-brand-text-muted font-bold">
                    Select One or Multiple Hotspots / Containers to Lend
                  </label>
                  {selectedHotspotIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedHotspotIds([])}
                      className="text-[10px] uppercase tracking-wider text-brand-accent hover:text-white transition-colors"
                    >
                      Clear All ({selectedHotspotIds.length})
                    </button>
                  )}
                </div>

                {/* Selected Hotspot Chips */}
                {selectedHotspotIds.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 p-2 bg-[#141210] border border-[#2d2924] rounded-lg mb-2.5">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-amber-400 flex items-center gap-1 mr-1">
                      <Layers className="h-3 w-3" />
                      <span>Selected ({selectedHotspotIds.length}):</span>
                    </span>
                    {selectedHotspotIds.map(hid => {
                      const hsObj = allHotspots.find(h => h.id === hid);
                      return (
                        <span 
                          key={hid}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#221f1c] border border-amber-600/50 text-amber-300 rounded text-xs font-semibold"
                        >
                          <span className="truncate max-w-[150px]">{hsObj?.label || "Hotspot"}</span>
                          <button
                            type="button"
                            onClick={() => setSelectedHotspotIds(prev => prev.filter(id => id !== hid))}
                            className="text-zinc-400 hover:text-white p-0.5 hover:bg-black/30 rounded"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Hotspot Search Input */}
                <div className="relative w-full mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-text-muted" />
                  <input 
                    type="text" 
                    placeholder="Search containers, toolboxes, drawers, rooms..." 
                    value={hotspotSearch}
                    onChange={(e) => setHotspotSearch(e.target.value)}
                    className="w-full bg-[#191715] border border-[#332f2a] pl-10 pr-4 py-2.5 text-sm text-white focus:border-brand-accent focus:outline-none transition-colors rounded"
                  />
                </div>

                {/* Hotspots Checkbox List */}
                {(() => {
                  const q = hotspotSearch.toLowerCase().trim();
                  const filtered = allHotspots.filter(h => {
                    if (!q) return true;
                    return (
                      h.label.toLowerCase().includes(q) ||
                      h.fullLabel.toLowerCase().includes(q) ||
                      (h.roomName && h.roomName.toLowerCase().includes(q))
                    );
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="text-center text-xs text-brand-text-muted py-6 border border-dashed border-[#332f2a] rounded">
                        No storage locations match &quot;{hotspotSearch}&quot;.
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-1.5 max-h-52 overflow-y-auto themed-scrollbar border border-[#2a2622] p-1.5 rounded bg-[#131110]">
                      {filtered.map(hs => {
                        const isChecked = selectedHotspotIds.includes(hs.id);
                        return (
                          <div
                            key={hs.id}
                            onClick={() => {
                              setSelectedHotspotIds(prev => 
                                prev.includes(hs.id) ? prev.filter(id => id !== hs.id) : [...prev, hs.id]
                              );
                            }}
                            className={`w-full flex items-center justify-between p-2.5 rounded cursor-pointer text-left transition-all ${
                              isChecked 
                                ? 'bg-amber-950/30 border border-amber-500/60 text-white' 
                                : 'bg-[#181614] hover:bg-[#201d1a] border border-[#2a2622] text-zinc-300'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              {/* Checkbox */}
                              <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                isChecked 
                                  ? 'bg-amber-500 border-amber-400 text-black' 
                                  : 'border-[#4a443c] bg-[#1d1b18]'
                              }`}>
                                {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                              </div>

                              <div className={`p-1.5 rounded shrink-0 ${hs.is_leaf ? 'bg-[#25221d] text-brand-accent' : 'bg-amber-500/10 text-amber-400'}`}>
                                {hs.is_leaf ? <Package className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                                  <span>{hs.label}</span>
                                </div>
                                <div className="text-[10px] text-brand-text-muted truncate">
                                  {hs.fullLabel}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-mono font-bold ${
                                hs.is_leaf 
                                  ? 'bg-[#25221d] text-brand-gold border border-brand-gold/30' 
                                  : 'bg-amber-950/60 text-amber-300 border border-amber-700/50'
                              }`}>
                                {hs.is_leaf ? 'Compartment' : 'Container'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Combined Contents Preview */}
              {selectedHotspotIds.length > 0 && (
                <div className="space-y-3 pt-1">
                  {loadingHotspotSummary ? (
                    <div className="p-8 text-center text-xs text-brand-text-muted flex flex-col items-center justify-center gap-2 bg-[#191715] border border-[#2a2622] rounded">
                      <div className="w-5 h-5 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                      <span>Scanning {selectedHotspotIds.length} hotspot(s) and collecting all stored components...</span>
                    </div>
                  ) : multiHotspotSummary ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-brand-text-muted">
                        <span className="font-bold text-white flex items-center gap-1.5">
                          <span>Contents to be lent</span>
                          <span className="text-brand-gold font-mono">
                            ({multiHotspotSummary.components.length} components, {multiHotspotSummary.totalUnits} units total across {selectedHotspotIds.length} hotspots)
                          </span>
                        </span>
                        <span className="text-[10px] text-brand-gold">
                          Returns automatically to exact origin compartments
                        </span>
                      </div>

                      {multiHotspotSummary.components.length === 0 ? (
                        <div className="p-4 bg-amber-950/20 border border-amber-600/30 rounded text-xs text-amber-300 flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
                          <span>None of the selected hotspots currently have components stored in physical storage.</span>
                        </div>
                      ) : (
                        <div className="max-h-56 overflow-y-auto themed-scrollbar border border-[#2e2924] rounded divide-y divide-[#26231f] bg-[#121110]">
                          {multiHotspotSummary.components.map((comp, idx) => (
                            <div key={`${comp.locationId}-${idx}`} className="p-2.5 flex items-center justify-between hover:bg-[#191715] transition-colors">
                              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                {comp.componentPhotoUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={comp.componentPhotoUrl} alt="" className="h-8 w-8 object-cover rounded border border-[#332f2a] shrink-0" />
                                ) : (
                                  <div className="h-8 w-8 bg-[#1e1c1a] rounded flex items-center justify-center text-brand-text-muted shrink-0">
                                    <Package className="h-4 w-4" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="text-xs font-bold text-white truncate">
                                    {comp.componentName}
                                  </div>
                                  <div className="text-[10px] text-brand-text-muted truncate flex items-center gap-1">
                                    <MapPin className="h-2.5 w-2.5 text-amber-400 shrink-0" />
                                    <span>{comp.hotspotFullPath || comp.hotspotLabel}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <span className="font-mono text-xs font-bold text-brand-gold bg-[#201d1a] px-2 py-0.5 rounded border border-[#332f2a]">
                                  {comp.quantity}x
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
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

            {/* Quick Select Chips for Recent Borrowers */}
            {pastBorrowers.length > 0 && (
              <div className="bg-[#141210] p-2.5 rounded border border-[#2c2823] space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-brand-text-muted uppercase tracking-wider font-semibold">
                  <span className="flex items-center gap-1.5 text-brand-gold">
                    <Clock className="w-3 h-3" />
                    <span>Quick Select Recent Borrowers</span>
                  </span>
                  <span className="text-[9px] text-zinc-500">Recently entered first</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  {pastBorrowers.slice(0, 6).map((b) => {
                    const isSelected = borrowerName.trim().toLowerCase() === b.name.toLowerCase();
                    return (
                      <button
                        key={b.name}
                        type="button"
                        onClick={() => handleSelectBorrower(b)}
                        className={`px-2.5 py-1 rounded text-xs font-medium transition-all flex items-center gap-1.5 border ${
                          isSelected
                            ? 'bg-brand-accent/20 border-brand-accent text-white shadow-sm ring-1 ring-brand-accent/40 font-bold'
                            : 'bg-[#1e1b18] hover:bg-[#282420] border-[#38332c] text-zinc-300 hover:text-white hover:border-[#4d463d]'
                        }`}
                      >
                        <User className={`w-3 h-3 ${isSelected ? 'text-brand-accent' : 'text-brand-gold/70'}`} />
                        <span>{b.name}</span>
                        {b.count > 1 && (
                          <span className="text-[9px] text-zinc-500 font-mono">
                            ({b.count})
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <div ref={borrowerDropdownRef} className="relative">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] uppercase tracking-widest text-brand-text-muted font-bold">
                    Borrower Name <span className="text-brand-accent">*</span>
                  </label>
                  {pastBorrowers.length > 0 && (
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setIsBorrowerDropdownOpen(prev => !prev)}
                      className="text-[10px] text-brand-accent hover:underline flex items-center gap-0.5"
                    >
                      <span>{isBorrowerDropdownOpen ? 'Close list' : 'View all'}</span>
                      <ChevronDown className={`w-3 h-3 transition-transform ${isBorrowerDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </div>

                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-brand-text-muted pointer-events-none" />
                  <input
                    ref={borrowerInputRef}
                    required
                    type="text"
                    placeholder="e.g. Rahul Sharma"
                    value={borrowerName}
                    onChange={(e) => {
                      setBorrowerName(e.target.value);
                      setIsBorrowerDropdownOpen(true);
                      setHighlightedBorrowerIndex(0);
                    }}
                    onFocus={() => {
                      if (pastBorrowers.length > 0) {
                        setIsBorrowerDropdownOpen(true);
                      }
                    }}
                    onKeyDown={handleBorrowerKeyDown}
                    className="w-full bg-[#191715] border border-[#332f2a] pl-9 pr-8 py-2 text-xs text-white focus:border-brand-accent focus:outline-none rounded transition-colors"
                  />
                  {pastBorrowers.length > 0 && (
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setIsBorrowerDropdownOpen(prev => !prev)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-text-muted hover:text-white transition-colors p-1"
                      data-tooltip="Toggle previous borrowers"
                    >
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${isBorrowerDropdownOpen ? 'rotate-180 text-brand-accent' : ''}`} />
                    </button>
                  )}
                </div>

                {/* Dropdown Menu (Styled like the Tag dropdown in ComponentForm) */}
                {isBorrowerDropdownOpen && pastBorrowers.length > 0 && (
                  <div className="absolute left-0 top-full mt-1 w-full z-50 bg-[#191715] border border-[#3a352e] rounded-md shadow-2xl shadow-black/90 overflow-hidden ring-1 ring-black/50">
                    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-brand-text-muted bg-[#12110f] border-b border-[#2e2a25] flex justify-between items-center select-none">
                      <span>{trimmedBorrower ? "Matching Borrowers" : "Previous Borrowers (Recent First)"}</span>
                      <span className="text-[9px] text-[#807a70]">{matchingBorrowers.length} available</span>
                    </div>

                    <div className="max-h-52 overflow-y-auto themed-scrollbar divide-y divide-[#26231f]/60 py-1">
                      {matchingBorrowers.length === 0 ? (
                        <div className="px-3 py-3 text-center text-xs text-brand-text-muted">
                          New borrower: <strong className="text-white">&quot;{borrowerName}&quot;</strong>
                        </div>
                      ) : (
                        matchingBorrowers.map((b, idx) => {
                          const isHighlighted = idx === highlightedBorrowerIndex;
                          const isSelected = borrowerName.trim().toLowerCase() === b.name.toLowerCase();
                          return (
                            <div
                              key={b.name}
                              id={`borrower-opt-${idx}`}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelectBorrower(b);
                              }}
                              onMouseEnter={() => setHighlightedBorrowerIndex(idx)}
                              className={`w-full px-3 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer group ${
                                isHighlighted 
                                  ? 'bg-[#2a2622] text-white' 
                                  : isSelected 
                                  ? 'bg-brand-accent/15 text-white' 
                                  : 'text-brand-text hover:bg-[#201d1a] hover:text-white'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 truncate flex-1 min-w-0 pr-2">
                                <User className={`w-3.5 h-3.5 shrink-0 ${isHighlighted || isSelected ? 'text-brand-accent' : 'text-brand-gold/70'}`} />
                                <div className="truncate min-w-0">
                                  <span className="font-semibold text-white truncate block">{b.name}</span>
                                  {b.contact && (
                                    <span className="text-[10px] text-brand-text-muted truncate block">{b.contact}</span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 text-right">
                                {b.lastLentAt && (
                                  <span className="text-[10px] text-zinc-500 font-mono">
                                    {new Date(b.lastLentAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                  </span>
                                )}
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#161412] text-brand-gold/80 border border-[#2e2a25] font-mono">
                                  {b.count} loan{b.count === 1 ? '' : 's'}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
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
              disabled={
                loading || 
                (loanType === 'component' && (!selectedComponent || !selectedLocationId)) || 
                (loanType === 'project' && !selectedProjectId) ||
                (loanType === 'hotspot' && (selectedHotspotIds.length === 0 || !multiHotspotSummary || multiHotspotSummary.components.length === 0))
              }
              className="px-6 py-2 bg-brand-accent hover:bg-brand-accent-hover text-white text-xs font-bold uppercase tracking-widest rounded-sm transition-colors disabled:opacity-50 shadow-sm"
            >
              {loading 
                ? "RECORDING LOAN..." 
                : loanType === 'hotspot' && multiHotspotSummary
                ? `LEND ${selectedHotspotIds.length === 1 ? 'HOTSPOT' : `${selectedHotspotIds.length} HOTSPOTS`} (${multiHotspotSummary.totalUnits} UNITS)`
                : "CONFIRM & LEND"}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
