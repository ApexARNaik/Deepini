"use client";

import { useEffect, useState } from "react";
import { getComponentDetails, ComponentWithTotals, ComponentLocation } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Edit2, MapPin, ExternalLink, ArrowLeft } from "lucide-react";

export default function ComponentDetailPage() {
  const { componentId } = useParams();
  const router = useRouter();
  const [data, setData] = useState<{ component: ComponentWithTotals, locations: ComponentLocation[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof componentId !== 'string') return;
    getComponentDetails(componentId).then(res => {
      setData(res);
      setLoading(false);
    }).catch(console.error);
  }, [componentId]);

  if (loading) return <div className="p-6 text-brand-text-muted">Loading component...</div>;
  if (!data) return <div className="p-6 text-brand-text-muted">Component not found.</div>;

  const { component, locations } = data;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-brand-bg">
      <div className="p-6 border-b border-[#222] bg-[#151515] shrink-0">
        <button onClick={() => router.push('/inventory')} className="flex items-center text-xs text-brand-text-muted hover:text-white uppercase tracking-widest mb-6 transition-colors">
          <ArrowLeft className="h-3 w-3 mr-2" /> Back to Inventory
        </button>
        <div className="flex justify-between items-start">
          <div className="flex gap-6">
            <div className="h-24 w-24 bg-[#111] border border-[#333] rounded shrink-0 overflow-hidden">
              {component.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={component.photo_url} alt={component.name} className="w-full h-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-[10px] text-[#555] uppercase tracking-widest">No Img</div>
              )}
            </div>
            <div>
              <h1 className="font-serif text-3xl font-bold text-white mb-2">{component.name}</h1>
              <div className="flex flex-wrap gap-2 mb-3">
                {component.tags.map(t => (
                  <span key={t.id} className="px-2 py-0.5 text-[10px] uppercase tracking-widest border border-[#444] rounded text-brand-text-muted bg-[#1a1a1a]">
                    {t.name}
                  </span>
                ))}
              </div>
              <div className="text-xs text-brand-text-muted font-mono tracking-wider">
                ID: {component.id}
              </div>
            </div>
          </div>
          <Link 
            href={`/inventory/${component.id}/edit`}
            className="flex items-center px-4 py-2 bg-[#1a1a1a] border border-[#333] text-brand-text text-xs font-bold uppercase tracking-widest hover:border-[#555] transition-colors"
          >
            <Edit2 className="h-3 w-3 mr-2" /> Edit Component
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col lg:flex-row gap-8">
        <div className="flex-1 space-y-8">
          
          <section>
            <h2 className="text-xs font-bold text-brand-text-muted uppercase tracking-widest border-b border-[#333] pb-2 mb-4">Details</h2>
            <div className="grid grid-cols-2 gap-4 bg-[#151515] p-4 border border-[#222] rounded">
              <div>
                <div className="text-[10px] text-brand-text-muted uppercase tracking-widest mb-1">Total Owned</div>
                <div className="text-xl font-serif text-white">{component.totals.total_owned_qty}</div>
              </div>
              <div>
                <div className="text-[10px] text-brand-text-muted uppercase tracking-widest mb-1">In Storage</div>
                <div className="text-xl font-serif text-white">{component.totals.in_storage_qty}</div>
              </div>
              <div>
                <div className="text-[10px] text-brand-text-muted uppercase tracking-widest mb-1">Price</div>
                <div className="text-sm font-mono text-white">{component.price != null ? formatCurrency(component.price) : '-'}</div>
              </div>
              <div>
                <div className="text-[10px] text-brand-text-muted uppercase tracking-widest mb-1">Low Stock Alert</div>
                <div className="text-sm font-mono text-white">{component.low_stock_threshold ?? '-'}</div>
              </div>
            </div>
          </section>

          {(component.purchase_source || component.datasheet_link || component.notes) && (
            <section>
              <h2 className="text-xs font-bold text-brand-text-muted uppercase tracking-widest border-b border-[#333] pb-2 mb-4">Resources</h2>
              <div className="space-y-4 text-sm text-brand-text">
                {component.purchase_source && (
                  <div className="flex gap-2">
                    <span className="text-brand-text-muted w-32">Source:</span>
                    <a href={component.purchase_source} target="_blank" rel="noreferrer" className="text-brand-accent hover:underline inline-flex items-center">
                      Vendor Link <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  </div>
                )}
                {component.datasheet_link && (
                  <div className="flex gap-2">
                    <span className="text-brand-text-muted w-32">Datasheet:</span>
                    <a href={component.datasheet_link} target="_blank" rel="noreferrer" className="text-brand-accent hover:underline inline-flex items-center">
                      PDF Link <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  </div>
                )}
                {component.notes && (
                  <div>
                    <div className="text-brand-text-muted mb-1">Notes:</div>
                    <p className="bg-[#151515] border border-[#222] p-4 rounded whitespace-pre-wrap">{component.notes}</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {Object.keys(component.custom_fields).length > 0 && (
            <section>
              <h2 className="text-xs font-bold text-brand-text-muted uppercase tracking-widest border-b border-[#333] pb-2 mb-4">Custom Specs</h2>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(component.custom_fields).map(([key, field]) => (
                  <div key={key} className="bg-[#151515] p-3 border border-[#222] rounded">
                    <div className="text-[10px] text-brand-text-muted uppercase tracking-widest mb-1">{key}</div>
                    {field.type === 'link' ? (
                      <a href={field.value} target="_blank" rel="noreferrer" className="text-brand-accent hover:underline text-sm truncate block">{field.value}</a>
                    ) : field.type === 'image' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={field.value} alt={key} className="h-16 w-16 object-cover border border-[#333] rounded mt-1" />
                    ) : (
                      <div className="text-white text-sm">{field.value}</div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>

        <div className="w-full lg:w-96 shrink-0 space-y-6">
          <section>
            <h2 className="text-xs font-bold text-brand-text-muted uppercase tracking-widest border-b border-[#333] pb-2 mb-4">Storage Locations</h2>
            {locations.length === 0 ? (
              <div className="text-sm text-brand-text-muted italic bg-[#151515] p-4 rounded border border-[#222]">
                Not currently stored in any physical location.
              </div>
            ) : (
              <div className="space-y-3">
                {locations.map(loc => (
                  <div key={loc.id} className="bg-[#151515] border border-[#333] rounded p-4 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-white font-bold mb-1">{loc.hotspot?.label}</div>
                        <div className="text-xs text-brand-text-muted uppercase tracking-widest">
                          {loc.room?.name}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-serif text-white leading-none">{loc.quantity}</div>
                        <div className="text-[9px] text-brand-text-muted uppercase tracking-widest">Qty</div>
                      </div>
                    </div>
                    {loc.room && (
                      <Link 
                        href={`/rooms/${loc.room.id}?locateHotspot=${loc.hotspot_id}`}
                        className="w-full flex items-center justify-center px-4 py-2 bg-[#222] hover:bg-[#333] text-brand-text text-xs uppercase tracking-widest font-bold transition-colors"
                      >
                        <MapPin className="h-3 w-3 mr-2" /> Locate
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
