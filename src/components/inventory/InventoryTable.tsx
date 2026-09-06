"use client";

import { useState } from "react";
import { ComponentWithTotals, deleteComponent, getComponentLocationAssignments } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { ChevronRight, Trash2, AlertTriangle, ExternalLink, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

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
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.photo_url} alt={c.name} className="h-10 w-10 object-cover rounded border border-[#332f2a]" />
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
    </>
  );
}
