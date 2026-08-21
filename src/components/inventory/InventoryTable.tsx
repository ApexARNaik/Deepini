"use client";

import { ComponentWithTotals } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface Props {
  components: ComponentWithTotals[];
}

export function InventoryTable({ components }: Props) {
  if (components.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-brand-text-muted border border-[#333] rounded-lg">
        <p>No components found.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[#222]">
      <table className="w-full text-left text-sm whitespace-nowrap">
        <thead className="bg-[#1a1a1a] text-brand-text-muted text-[10px] uppercase tracking-widest border-b border-[#222]">
          <tr>
            <th className="px-6 py-4 font-medium">Img</th>
            <th className="px-6 py-4 font-medium">Component Name</th>
            <th className="px-6 py-4 font-medium">Tags</th>
            <th className="px-6 py-4 font-medium text-right">Quantity</th>
            <th className="px-6 py-4 font-medium text-right">Price</th>
            <th className="px-6 py-4 font-medium text-center">Status</th>
            <th className="px-6 py-4"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#222] bg-black/20">
          {components.map((c) => {
            const isLowStock = c.low_stock_threshold !== null && c.low_stock_threshold !== undefined && c.totals.total_owned_qty <= c.low_stock_threshold;
            
            return (
              <tr key={c.id} className="hover:bg-[#151515] transition-colors group">
                <td className="px-6 py-4">
                  {c.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.photo_url} alt={c.name} className="h-10 w-10 object-cover rounded border border-[#333]" />
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
                <td className="px-6 py-4">
                  <div className="flex gap-2 flex-wrap max-w-[200px]">
                    {c.tags.map(t => (
                      <span key={t.id} className="px-2 py-0.5 text-[9px] uppercase tracking-widest border border-[#444] rounded text-brand-text-muted bg-[#1a1a1a]">
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
                <td className="px-6 py-4 text-right font-mono text-brand-text-muted">
                  {c.price != null ? formatCurrency(c.price) : '-'}
                </td>
                <td className="px-6 py-4 text-center">
                  <div className={`inline-block h-2 w-2 rounded-full ${isLowStock ? 'bg-brand-accent shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-green-500/80 shadow-[0_0_8px_rgba(34,197,94,0.4)]'}`} />
                </td>
                <td className="px-6 py-4 text-right">
                  <Link href={`/inventory/${c.id}`} className="inline-flex items-center text-brand-text-muted hover:text-white transition-colors opacity-0 group-hover:opacity-100">
                    <span className="text-[10px] uppercase tracking-widest mr-1">View</span>
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
