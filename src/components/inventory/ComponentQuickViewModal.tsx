"use client";

import { useEffect, useState } from "react";
import { getComponentDetails, ComponentWithTotals, ComponentLocation, isPersonalItem } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { X, ExternalLink, Edit2, MapPin, FileText, Package, AlertCircle, Maximize2 } from "lucide-react";
import { ImagePreviewModal } from "./ImagePreviewModal";

interface ComponentQuickViewModalProps {
  componentId: string | null;
  isOpen: boolean;
  onClose: () => void;
  currentHotspotId?: string | null;
}

export function ComponentQuickViewModal({
  componentId,
  isOpen,
  onClose,
  currentHotspotId
}: ComponentQuickViewModalProps) {
  const [data, setData] = useState<{ component: ComponentWithTotals; locations: ComponentLocation[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string; subtitle?: string } | null>(null);

  useEffect(() => {
    if (!isOpen || !componentId) {
      setData(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    getComponentDetails(componentId)
      .then(res => {
        if (isMounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch(err => {
        console.error("Failed to fetch component details for quick view:", err);
        if (isMounted) {
          setError("Failed to load component details.");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [componentId, isOpen]);

  // Handle ESC key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (previewImage) {
          setPreviewImage(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, previewImage]);

  if (!isOpen) return null;

  const component = data?.component;
  const locations = data?.locations || [];
  const isPersonal = component ? isPersonalItem(component) : false;

  const customFieldEntries = component
    ? Object.entries(component.custom_fields || {}).filter(([key]) => key !== "item_type")
    : [];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-[#171513] border border-[#332f2a] rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden text-brand-text relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#332f2a] bg-[#1d1a17] shrink-0">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <Package className="h-4 w-4 text-brand-accent shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider text-brand-text-muted truncate">
              {isPersonal ? "Personal Item Details" : "Component Details"}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {component && (
              <Link
                href={`/inventory/${component.id}/edit`}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-[#252320] hover:bg-[#332f2a] text-brand-text hover:text-white border border-[#332f2a] rounded transition-colors"
                title="Edit component details"
              >
                <Edit2 className="h-3 w-3" />
                <span className="hidden sm:inline">Edit</span>
              </Link>
            )}
            <button 
              type="button"
              onClick={onClose} 
              className="p-1 text-brand-text-muted hover:text-white hover:bg-[#252320] rounded transition-colors"
              title="Close popup (Esc)"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-brand-text-muted space-y-3">
              <div className="w-8 h-8 border-2 border-brand-accent/30 border-t-brand-accent rounded-full animate-spin" />
              <p className="text-xs tracking-wider uppercase font-medium">Loading details...</p>
            </div>
          ) : error || !component ? (
            <div className="text-center py-12 space-y-3">
              <AlertCircle className="h-8 w-8 text-red-400 mx-auto" />
              <p className="text-sm text-red-300 font-medium">{error || "Item not found."}</p>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 bg-[#252320] hover:bg-[#332f2a] text-white text-xs rounded border border-[#332f2a] transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              {/* Main Item Header Card */}
              <div className="flex gap-4 items-start bg-[#121110] border border-[#2d2924] rounded-lg p-3.5">
                <div className="h-20 w-20 bg-[#1a1816] border border-[#332f2a] rounded-md shrink-0 overflow-hidden flex items-center justify-center">
                  {component.photo_url ? (
                    <button
                      type="button"
                      onClick={() => setPreviewImage({ url: component.photo_url!, title: component.name, subtitle: isPersonal ? "Personal Item Photo" : "Component Image" })}
                      className="w-full h-full relative group/photo cursor-zoom-in block"
                      title="Click to view full image"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={component.photo_url} 
                        alt={component.name} 
                        className="w-full h-full object-cover group-hover/photo:scale-105 transition-transform duration-200" 
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <Maximize2 className="h-4 w-4" />
                      </div>
                    </button>
                  ) : (
                    <div className="text-[10px] text-brand-text-muted/60 uppercase tracking-widest text-center px-1">
                      No Photo
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <h3 className="font-serif text-xl font-bold text-white leading-tight">
                      {component.name}
                    </h3>
                    {isPersonal && (
                      <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest border border-brand-gold/40 text-brand-gold bg-brand-gold/10 rounded shrink-0">
                        Personal
                      </span>
                    )}
                  </div>

                  {component.tags && component.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {component.tags.map(t => (
                        <span 
                          key={t.id} 
                          className="px-1.5 py-0.5 text-[9px] uppercase tracking-wider border border-[#332f2a] rounded text-brand-text-muted bg-[#1a1816]"
                        >
                          {t.name}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="text-[11px] text-brand-text-muted font-mono truncate">
                    ID: {component.id}
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div>
                <h4 className="text-[10px] font-bold text-brand-text-muted uppercase tracking-widest mb-2">
                  Inventory Stock
                </h4>
                <div className={`grid gap-2.5 ${isPersonal ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
                  <div className="bg-[#121110] border border-[#2d2924] p-3 rounded-lg">
                    <div className="text-[10px] text-brand-text-muted uppercase tracking-widest mb-0.5">Total Owned</div>
                    <div className="text-lg font-serif font-bold text-white">{component.totals.total_owned_qty}</div>
                  </div>
                  <div className="bg-[#121110] border border-[#2d2924] p-3 rounded-lg">
                    <div className="text-[10px] text-brand-text-muted uppercase tracking-widest mb-0.5">In Storage</div>
                    <div className="text-lg font-serif font-bold text-brand-accent">{component.totals.in_storage_qty}</div>
                  </div>
                  {!isPersonal && (
                    <>
                      <div className="bg-[#121110] border border-[#2d2924] p-3 rounded-lg">
                        <div className="text-[10px] text-brand-text-muted uppercase tracking-widest mb-0.5">Price</div>
                        <div className="text-sm font-mono font-bold text-white mt-0.5">
                          {component.price != null ? formatCurrency(component.price) : "-"}
                        </div>
                      </div>
                      <div className="bg-[#121110] border border-[#2d2924] p-3 rounded-lg">
                        <div className="text-[10px] text-brand-text-muted uppercase tracking-widest mb-0.5">Low Stock Alert</div>
                        <div className="text-sm font-mono font-bold text-white mt-0.5">
                          {component.low_stock_threshold ?? "-"}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Notes / Description */}
              {component.notes && (
                <div>
                  <h4 className="text-[10px] font-bold text-brand-text-muted uppercase tracking-widest mb-2">
                    Description & Notes
                  </h4>
                  <div className="bg-[#121110] border border-[#2d2924] p-3.5 rounded-lg text-xs text-brand-text whitespace-pre-wrap leading-relaxed">
                    {component.notes}
                  </div>
                </div>
              )}

              {/* Resources (Links) */}
              {(component.purchase_source || component.datasheet_link) && (
                <div>
                  <h4 className="text-[10px] font-bold text-brand-text-muted uppercase tracking-widest mb-2">
                    Resources
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {component.purchase_source && (
                      <a 
                        href={component.purchase_source} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#121110] hover:bg-[#1a1816] text-brand-accent hover:text-white border border-[#2d2924] rounded text-xs font-medium transition-colors"
                      >
                        <span>Vendor / Purchase Source</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {component.datasheet_link && (
                      <a 
                        href={component.datasheet_link} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#121110] hover:bg-[#1a1816] text-brand-accent hover:text-white border border-[#2d2924] rounded text-xs font-medium transition-colors"
                      >
                        <FileText className="h-3 w-3" />
                        <span>Datasheet (PDF)</span>
                        <ExternalLink className="h-3 w-3 ml-0.5" />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Custom Specs / Custom Fields */}
              {customFieldEntries.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-bold text-brand-text-muted uppercase tracking-widest mb-2">
                    {isPersonal ? "Custom Fields" : "Custom Specifications"}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {customFieldEntries.map(([key, rawField]) => {
                      const field = typeof rawField === "object" && rawField !== null
                        ? rawField
                        : { type: "text", value: String(rawField) };
                      return (
                        <div key={key} className="bg-[#121110] p-3 border border-[#2d2924] rounded-lg">
                          <div className="text-[10px] text-brand-text-muted uppercase tracking-widest mb-1">{key}</div>
                          {field.type === "link" ? (
                            <a 
                              href={field.value} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="text-brand-accent hover:underline text-xs truncate block"
                            >
                              {field.value}
                            </a>
                          ) : field.type === "image" ? (
                            <button
                              type="button"
                              onClick={() => setPreviewImage({ url: field.value, title: `${component.name} - ${key}`, subtitle: "Custom Field Image" })}
                              className="group/img mt-1 relative block cursor-zoom-in text-left"
                              title="Click to view full image"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img 
                                src={field.value} 
                                alt={key} 
                                className="h-16 w-16 object-cover border border-[#332f2a] rounded group-hover/img:border-brand-accent group-hover/img:scale-105 transition-all duration-200" 
                              />
                            </button>
                          ) : field.type === "file" ? (
                            <div className="mt-1 flex items-center justify-between p-2 bg-black/40 border border-[#2d2924] rounded">
                              <div className="flex items-center gap-2 min-w-0 pr-2">
                                <FileText className="h-3.5 w-3.5 text-brand-accent shrink-0" />
                                <span className="text-xs text-white truncate" title={field.fileName || field.value}>
                                  {field.fileName || (typeof field.value === "string" ? field.value.split("/").pop()?.split("_").slice(2).join("_") || field.value.split("/").pop() : "Document")}
                                </span>
                              </div>
                              <a 
                                href={typeof field.value === "string" ? field.value : field.value?.url} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-xs font-bold text-brand-accent hover:underline shrink-0 flex items-center gap-1"
                              >
                                Open <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          ) : (
                            <div className="text-white text-xs font-medium">{field.value}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Storage Locations */}
              <div>
                <h4 className="text-[10px] font-bold text-brand-text-muted uppercase tracking-widest mb-2">
                  Storage Locations ({locations.length})
                </h4>
                {locations.length === 0 ? (
                  <div className="p-3 bg-[#121110] border border-[#2d2924] rounded-lg text-xs text-brand-text-muted">
                    Not currently assigned to any storage locations.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {locations.map((loc) => {
                      const isCurrentLocation = currentHotspotId && loc.hotspot_id === currentHotspotId;
                      return (
                        <div 
                          key={loc.id} 
                          className={`p-3 rounded-lg border transition-colors flex items-center justify-between ${
                            isCurrentLocation 
                              ? "bg-brand-accent/10 border-brand-accent/50 text-white" 
                              : "bg-[#121110] border-[#2d2924] text-brand-text"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <MapPin className={`h-4 w-4 shrink-0 ${isCurrentLocation ? "text-brand-accent" : "text-brand-text-muted"}`} />
                            <div className="min-w-0">
                              <div className="text-xs font-semibold truncate">
                                {loc.hotspot?.label || "Storage Hotspot"}
                                {isCurrentLocation && (
                                  <span className="ml-2 text-[9px] px-1.5 py-0.2 bg-brand-accent text-white rounded font-bold uppercase tracking-wider">
                                    Current
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-brand-text-muted uppercase tracking-wider">
                                {loc.room?.name || "Room"}
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-base font-serif font-bold text-white leading-none">
                              {loc.quantity}
                            </span>
                            <span className="text-[9px] text-brand-text-muted uppercase tracking-wider ml-1">
                              Qty
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#332f2a] bg-[#1d1a17] shrink-0">
          {component ? (
            <Link
              href={`/inventory/${component.id}`}
              className="text-xs font-semibold text-brand-accent hover:text-white flex items-center gap-1.5 transition-colors"
              title="Navigate to full component page"
            >
              <span>{isPersonal ? "Open Personal Item Page" : "Open Component Page"}</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#252320] hover:bg-[#332f2a] text-white text-xs font-bold rounded border border-[#332f2a] transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Full Image Preview Modal */}
      <ImagePreviewModal
        isOpen={!!previewImage}
        imageUrl={previewImage?.url || null}
        title={previewImage?.title}
        subtitle={previewImage?.subtitle}
        onClose={() => setPreviewImage(null)}
      />
    </div>
  );
}
