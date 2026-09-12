"use client";

import { useState, useEffect } from "react";
import { ComponentWithTotals, ComponentLocationSummary, deleteComponent, getComponentLocationAssignments, getFullHotspotPath } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { ChevronRight, Trash2, AlertTriangle, ExternalLink, Loader2, MapPin, ChevronDown, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { ImagePreviewModal } from "./ImagePreviewModal";

interface Props {
  components: ComponentWithTotals[];
  viewMode?: 'components' | 'personal';
  onComponentDeleted?: (deletedId: string) => void;
}

export function InventoryTable({ components, viewMode = 'components', onComponentDeleted }: Props) {
  const router = useRouter();
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<ComponentWithTotals | null>(null);
  const [locationConflict, setLocationConflict] = useState<{
    component: ComponentWithTotals;
    locations: { id: string; quantity: number; hotspot_id: string; label?: string }[];
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);
  const [selectedLocationItem, setSelectedLocationItem] = useState<ComponentWithTotals | null>(null);
  const [navigatingId, setNavigatingId] = useState<string | null>(null);
  const [hoverTooltip, setHoverTooltip] = useState<{
    fullLabel?: string;
    label?: string;
    roomName?: string;
    quantity?: number;
    customText?: string;
    targetRect: DOMRect;
  } | null>(null);

  // Close tooltip on any scroll
  useEffect(() => {
    if (!hoverTooltip) return;
    const handleScroll = () => setHoverTooltip(null);
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [hoverTooltip]);

  const handleShowTooltip = (
    e: React.MouseEvent<HTMLElement>,
    data: { fullLabel?: string; label?: string; roomName?: string; quantity?: number; customText?: string }
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoverTooltip({
      ...data,
      targetRect: rect
    });
  };

  const handleHideTooltip = () => {
    setHoverTooltip(null);
  };

  const navigateToLocation = async (loc: ComponentLocationSummary, componentId?: string) => {
    if (componentId) setNavigatingId(componentId);
    try {
      if (loc.room_id) {
        router.push(`/rooms/${loc.room_id}?locateHotspot=${loc.hotspot_id}`);
        return;
      }
      const path = await getFullHotspotPath(loc.hotspot_id);
      const roomNode = path.find(p => p.type === 'photo');
      if (roomNode) {
        router.push(`/rooms/${roomNode.id}?locateHotspot=${loc.hotspot_id}`);
      } else {
        alert("Storage location room not found.");
      }
    } catch (err) {
      console.error("Error navigating to location:", err);
    } finally {
      if (componentId) setNavigatingId(null);
    }
  };

  if (components.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-brand-text-muted border border-[#332f2a] rounded-lg">
        <p>{viewMode === 'personal' ? 'No personal items found.' : 'No components found.'}</p>
      </div>
    );
  }

  const isPersonal = viewMode === 'personal';

  const handleDeleteClick = async (e: React.MouseEvent, component: ComponentWithTotals) => {
    e.stopPropagation();
    setCheckingId(component.id);
    try {
      const locations = await getComponentLocationAssignments(component.id);
      if (locations.length > 0) {
        setLocationConflict({ component, locations });
      } else {
        setDeleteConfirmation(component);
      }
    } catch (err) {
      console.error("Error checking component locations:", err);
      if (component.totals.in_storage_qty > 0) {
        setLocationConflict({
          component,
          locations: [{ id: 'loc', quantity: component.totals.in_storage_qty, hotspot_id: '' }]
        });
      } else {
        setDeleteConfirmation(component);
      }
    } finally {
      setCheckingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmation) return;
    setIsDeleting(true);
    try {
      await deleteComponent(deleteConfirmation.id);
      onComponentDeleted?.(deleteConfirmation.id);
      setDeleteConfirmation(null);
    } catch (err: any) {
      console.error("Failed to delete component:", err);
      alert("Failed to delete component: " + (err.message || "Unknown error"));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-[#332f2a]">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-[#1a1816] text-brand-text-muted text-[10px] uppercase tracking-widest border-b border-[#332f2a]">
            <tr>
              <th className="px-6 py-4 font-medium">Img</th>
              <th className="px-6 py-4 font-medium">{isPersonal ? "Item Name" : "Component Name"}</th>
              {isPersonal ? (
                <th className="px-6 py-4 font-medium max-w-xs">Description</th>
              ) : null}
              <th className="px-6 py-4 font-medium">Location</th>
              <th className="px-6 py-4 font-medium">Tags</th>
              <th className="px-6 py-4 font-medium text-right">Quantity</th>
              {!isPersonal && (
                <>
                  <th className="px-6 py-4 font-medium text-right">Price</th>
                  <th className="px-6 py-4 font-medium text-center">Status</th>
                </>
              )}
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#222] bg-black/20">
            {components.map((c) => {
              const isLowStock = !isPersonal && c.low_stock_threshold !== null && c.low_stock_threshold !== undefined && c.totals.total_owned_qty <= c.low_stock_threshold;
              
              return (
                <tr 
                  key={c.id} 
                  onClick={() => router.push(`/inventory/${c.id}`)}
                  className="hover:bg-[#1a1816] transition-colors group cursor-pointer"
                >
                  <td className="px-6 py-4">
                    {c.photo_url ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewImage({ url: c.photo_url!, title: c.name });
                        }}
                        className="h-10 w-10 relative group/img rounded overflow-hidden border border-[#332f2a] hover:border-brand-accent transition-all cursor-zoom-in block"
                        title={`Click to view full image of ${c.name}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={c.photo_url} alt={c.name} className="h-full w-full object-cover group-hover/img:scale-110 transition-transform duration-200" />
                      </button>
                    ) : (
                      <div className="h-10 w-10 bg-[#222] rounded flex items-center justify-center text-[#555] text-xs">
                        No Img
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-white mb-1">{c.name}</div>
                    <div className="text-[10px] text-brand-text-muted tracking-widest font-mono">
                      ID: {c.id.split('-')[0].toUpperCase()}
                    </div>
                  </td>
                  {isPersonal && (
                    <td className="px-6 py-4 max-w-xs truncate text-brand-text-muted">
                      {c.notes || "-"}
                    </td>
                  )}
                  <td className="px-6 py-4">
                    {(!c.locations || c.locations.length === 0) ? (
                      <span className="text-[11px] text-brand-text-muted/40 italic flex items-center gap-1 select-none">
                        <MapPin className="h-3 w-3 opacity-30 shrink-0" /> Unassigned
                      </span>
                    ) : c.locations.length === 1 ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleHideTooltip();
                          navigateToLocation(c.locations![0], c.id);
                        }}
                        onMouseEnter={(e) => handleShowTooltip(e, {
                          fullLabel: c.locations![0].fullLabel,
                          label: c.locations![0].label,
                          roomName: c.locations![0].room_name,
                          quantity: c.locations![0].quantity
                        })}
                        onMouseLeave={handleHideTooltip}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1c1a17] border border-[#332f2a] hover:border-brand-accent hover:bg-brand-accent/15 text-brand-gold hover:text-white text-xs font-medium transition-all group/btn shadow-xs max-w-[220px]"
                      >
                        {navigatingId === c.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-accent shrink-0" />
                        ) : (
                          <MapPin className="h-3.5 w-3.5 text-brand-accent shrink-0 group-hover/btn:scale-110 transition-transform" />
                        )}
                        <span className="truncate">{c.locations[0].label || c.locations[0].fullLabel}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleHideTooltip();
                          setSelectedLocationItem(c);
                        }}
                        onMouseEnter={(e) => handleShowTooltip(e, {
                          customText: `Stored across ${c.locations!.length} locations in ${[...new Set(c.locations!.map(l => l.room_name).filter(Boolean))].join(', ') || 'rooms'}. Click to view & navigate.`
                        })}
                        onMouseLeave={handleHideTooltip}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1c1a17] border border-[#332f2a] hover:border-brand-accent hover:bg-brand-accent/15 text-brand-gold hover:text-white text-xs font-medium transition-all group/btn shadow-xs"
                      >
                        <MapPin className="h-3.5 w-3.5 text-brand-accent shrink-0 group-hover/btn:scale-110 transition-transform" />
                        <span>{c.locations.length} Locations</span>
                        <ChevronDown className="h-3 w-3 text-brand-text-muted group-hover/btn:text-white transition-colors" />
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2 flex-wrap max-w-[200px]">
                      {c.tags.map(t => (
                        <span key={t.id} className="px-2 py-0.5 text-[9px] uppercase tracking-widest border border-[#332f2a] rounded text-brand-text-muted bg-[#1a1816]">
                          {t.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className={`font-serif text-xl font-bold ${isLowStock ? 'text-brand-accent' : 'text-brand-text'}`}>
                      {c.totals.total_owned_qty}
                    </div>
                    <div className="text-[9px] uppercase tracking-widest text-brand-text-muted">
                      Units
                    </div>
                  </td>
                  {!isPersonal && (
                    <>
                      <td className="px-6 py-4 text-right font-mono text-brand-text-muted">
                        {c.price != null ? formatCurrency(c.price) : '-'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className={`inline-block h-2 w-2 rounded-full ${isLowStock ? 'bg-brand-accent shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-green-500/80 shadow-[0_0_8px_rgba(34,197,94,0.4)]'}`} />
                      </td>
                    </>
                  )}
                  <td className="px-6 py-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleHideTooltip();
                          if (!c.locations || c.locations.length === 0) return;
                          if (c.locations.length === 1) {
                            navigateToLocation(c.locations[0], c.id);
                          } else {
                            setSelectedLocationItem(c);
                          }
                        }}
                        onMouseEnter={(e) => {
                          if (!c.locations || c.locations.length === 0) {
                            handleShowTooltip(e, { customText: "No storage location assigned." });
                          } else if (c.locations.length === 1) {
                            handleShowTooltip(e, {
                              fullLabel: c.locations[0].fullLabel,
                              label: c.locations[0].label,
                              roomName: c.locations[0].room_name,
                              quantity: c.locations[0].quantity
                            });
                          } else {
                            handleShowTooltip(e, {
                              customText: `Stored in ${c.locations.length} locations. Click to choose.`
                            });
                          }
                        }}
                        onMouseLeave={handleHideTooltip}
                        disabled={!c.locations || c.locations.length === 0 || navigatingId === c.id}
                        className="p-1.5 text-brand-text-muted hover:text-brand-accent hover:bg-brand-accent/10 rounded transition-colors disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-brand-text-muted"
                      >
                        {navigatingId === c.id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-brand-accent" />
                        ) : (
                          <MapPin className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteClick(e, c)}
                        disabled={checkingId === c.id || isDeleting}
                        className="p-1.5 text-brand-text-muted hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                        title={`Delete ${isPersonal ? 'personal item' : 'component'} "${c.name}"`}
                      >
                        {checkingId === c.id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-brand-text-muted" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                      <div className="inline-flex items-center text-brand-text-muted group-hover:text-white transition-colors opacity-0 group-hover:opacity-100">
                        <span className="text-[10px] uppercase tracking-widest mr-1">View</span>
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Location Conflict Modal */}
      {locationConflict && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setLocationConflict(null)}
        >
          <div 
            className="bg-[#1a1816] border border-[#332f2a] rounded-lg max-w-md w-full p-6 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-amber-400 mb-4">
              <div className="p-2 bg-amber-400/10 rounded-full border border-amber-400/20">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-white uppercase tracking-wider">
                Assigned to Storage Locations
              </h3>
            </div>
            
            <p className="text-sm text-brand-text-muted mb-3 leading-relaxed">
              <strong className="text-white">&quot;{locationConflict.component.name}&quot;</strong> cannot be deleted directly because it is currently assigned to <strong className="text-brand-accent">{locationConflict.locations.length} storage location{locationConflict.locations.length > 1 ? 's' : ''}</strong>.
            </p>

            {locationConflict.locations.some(l => l.label) && (
              <div className="mb-4 bg-black/40 border border-[#332f2a] p-3 rounded text-xs text-brand-text-muted flex flex-wrap gap-1.5">
                <span className="font-bold text-white/80 block w-full mb-1">Assigned locations:</span>
                {locationConflict.locations.map((loc, idx) => (
                  <span key={loc.id || idx} className="px-2 py-0.5 bg-[#252320] border border-[#332f2a] rounded text-[11px] text-brand-accent font-medium">
                    {loc.label || "Storage Bin"} {loc.quantity > 0 ? `(${loc.quantity})` : ''}
                  </span>
                ))}
              </div>
            )}

            <p className="text-xs text-brand-text-muted mb-6 bg-amber-500/10 border border-amber-500/20 p-3 rounded leading-relaxed text-amber-200/90">
              To keep inventory records accurate, please open the edit page and individually delete the component from its assigned locations first.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setLocationConflict(null)}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-brand-text-muted hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const compId = locationConflict.component.id;
                  setLocationConflict(null);
                  router.push(`/inventory/${compId}/edit`);
                }}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider bg-brand-accent hover:bg-brand-accent-hover text-white rounded transition-colors shadow-lg"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Open Edit Component</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => !isDeleting && setDeleteConfirmation(null)}
        >
          <div 
            className="bg-[#1a1816] border border-red-500/40 rounded-lg max-w-md w-full p-6 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-red-400 mb-4">
              <div className="p-2 bg-red-500/10 rounded-full border border-red-500/20">
                <Trash2 className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-white uppercase tracking-wider">
                Delete {isPersonal ? "Personal Item" : "Component"}
              </h3>
            </div>

            <p className="text-sm text-brand-text-muted mb-6 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-white">&quot;{deleteConfirmation.name}&quot;</strong>? This item is not assigned to any storage locations. This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmation(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-brand-text-muted hover:text-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider bg-red-600 hover:bg-red-700 text-white rounded transition-colors shadow-lg disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Popup Modal */}
      <ImagePreviewModal
        isOpen={!!previewImage}
        imageUrl={previewImage?.url || null}
        title={previewImage?.title}
        subtitle={isPersonal ? "Personal Item Photo" : "Component Image"}
        onClose={() => setPreviewImage(null)}
      />

      {/* Multiple Locations Chooser Modal */}
      {selectedLocationItem && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setSelectedLocationItem(null)}
        >
          <div 
            className="bg-[#1a1816] border border-[#332f2a] rounded-lg max-w-md w-full p-6 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#332f2a]">
              <div className="flex items-center gap-2 text-white">
                <div className="p-1.5 bg-brand-accent/15 rounded border border-brand-accent/30">
                  <MapPin className="h-4 w-4 text-brand-accent" />
                </div>
                <h3 className="font-bold text-sm uppercase tracking-wider">
                  Select Storage Location
                </h3>
              </div>
              <button 
                type="button"
                onClick={() => setSelectedLocationItem(null)} 
                className="text-brand-text-muted hover:text-white transition-colors p-1"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-brand-text-muted mb-4 leading-relaxed">
              <strong className="text-white">&quot;{selectedLocationItem.name}&quot;</strong> is stored in multiple locations. Select which location to navigate to on the room map:
            </p>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {selectedLocationItem.locations?.map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => {
                    const item = selectedLocationItem;
                    handleHideTooltip();
                    setSelectedLocationItem(null);
                    navigateToLocation(loc, item.id);
                  }}
                  onMouseEnter={(e) => handleShowTooltip(e, {
                    fullLabel: loc.fullLabel,
                    label: loc.label,
                    roomName: loc.room_name,
                    quantity: loc.quantity
                  })}
                  onMouseLeave={handleHideTooltip}
                  className="w-full text-left p-3.5 rounded-lg bg-[#201e1b] hover:bg-brand-accent/15 border border-[#332f2a] hover:border-brand-accent flex items-center justify-between group transition-all cursor-pointer shadow-xs hover:shadow-md"
                >
                  <div className="min-w-0 pr-3 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="h-3.5 w-3.5 text-brand-accent shrink-0" />
                      <span className="text-sm font-bold text-white group-hover:text-brand-accent transition-colors">
                        {loc.label || "Storage Bin"}
                      </span>
                      {loc.room_name && (
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-black/40 text-brand-text-muted border border-[#332f2a]">
                          {loc.room_name}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-brand-text-muted group-hover:text-brand-text/80 transition-colors line-clamp-1 flex items-center gap-1">
                      <span className="text-[10px] uppercase font-semibold text-brand-gold/70 tracking-wider shrink-0">Path:</span>
                      <span className="truncate">{loc.fullLabel || loc.label}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-black/50 text-brand-gold border border-[#332f2a]">
                      Qty: {loc.quantity}
                    </span>
                    <ChevronRight className="h-4 w-4 text-brand-text-muted group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-[#332f2a] flex justify-end">
              <button
                type="button"
                onClick={() => {
                  handleHideTooltip();
                  setSelectedLocationItem(null);
                }}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-brand-text-muted hover:text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Custom Storage Sequence Tooltip */}
      {hoverTooltip && typeof window !== 'undefined' && (() => {
        const { targetRect, fullLabel, label, roomName, quantity, customText } = hoverTooltip;
        const crumbs = fullLabel ? fullLabel.split(' → ').map(s => s.trim()).filter(Boolean) : [];
        
        const tooltipWidth = Math.min(420, window.innerWidth - 32);
        const targetCenterX = targetRect.left + targetRect.width / 2;
        const clampedX = Math.max(16, Math.min(window.innerWidth - tooltipWidth - 16, targetCenterX - tooltipWidth / 2));
        
        const showBelow = targetRect.top < 150;
        const tooltipY = showBelow ? targetRect.bottom + 8 : targetRect.top - 8;
        const arrowLeft = Math.max(16, Math.min(tooltipWidth - 16, targetCenterX - clampedX));

        return (
          <div
            style={{
              position: 'fixed',
              left: `${clampedX}px`,
              top: `${tooltipY}px`,
              transform: showBelow ? 'none' : 'translateY(-100%)',
              width: `${tooltipWidth}px`,
              zIndex: 9999,
              pointerEvents: 'none'
            }}
            className="animate-fadeIn transition-all duration-100"
          >
            <div className="relative bg-[#151311]/95 backdrop-blur-md border border-[#443e38] text-brand-text rounded-lg p-3.5 shadow-2xl shadow-black/95">
              {/* Pointer Arrow */}
              <div
                style={{ left: `${arrowLeft}px` }}
                className={`absolute w-2.5 h-2.5 rotate-45 bg-[#151311] border-[#443e38] -translate-x-1/2 ${
                  showBelow ? "-top-1.5 border-t border-l" : "-bottom-1.5 border-b border-r"
                }`}
              />

              {/* Tooltip Header */}
              <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-[#2d2822]">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-gold">
                  <MapPin className="h-3 w-3 text-brand-accent shrink-0" />
                  <span>Storage Sequence</span>
                </div>
                {roomName && (
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#201d1a] border border-[#332f2a] text-brand-text-muted">
                    {roomName}
                  </span>
                )}
              </div>

              {/* Breadcrumb Path Sequence */}
              {crumbs.length > 0 ? (
                <div className="py-0.5">
                  <div className="flex flex-wrap items-center gap-1.5 leading-relaxed">
                    {crumbs.map((crumb, idx) => {
                      const isTarget = idx === crumbs.length - 1;
                      return (
                        <span key={idx} className="inline-flex items-center">
                          {idx > 0 && (
                            <ChevronRight className="h-3 w-3 text-brand-gold/50 mx-0.5 shrink-0" />
                          )}
                          <span
                            className={`px-2 py-0.5 rounded text-xs transition-colors ${
                              isTarget
                                ? "bg-brand-accent/25 text-white font-bold border border-brand-accent/60 shadow-[0_0_10px_rgba(188,115,83,0.3)] inline-flex items-center gap-1.5"
                                : "text-brand-text-muted bg-[#201d1a] border border-[#2d2822]"
                            }`}
                          >
                            {isTarget && (
                              <span className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-pulse shrink-0" />
                            )}
                            {crumb}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              ) : customText ? (
                <div className="text-brand-text py-0.5 text-xs font-medium leading-relaxed">
                  {customText}
                </div>
              ) : (
                <div className="text-white py-0.5 text-xs font-semibold">
                  {label}
                </div>
              )}

              {/* Footer info */}
              <div className="mt-2.5 pt-2 border-t border-[#2d2822] flex items-center justify-between text-[10px] text-brand-text-muted">
                <span className="flex items-center gap-1 text-brand-gold/90 font-medium">
                  <ExternalLink className="h-2.5 w-2.5 text-brand-accent" />
                  Click to open room map & highlight
                </span>
                {quantity !== undefined && (
                  <span className="font-mono text-brand-accent font-bold">Qty: {quantity}</span>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
