"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { ComponentWithTotals, getInventory, isPersonalItem } from "@/lib/api";
import { InventoryTable } from "@/components/inventory/InventoryTable";
import { Search, Plus } from "lucide-react";
import Link from "next/link";
import { useDebounce } from "@/hooks/useDebounce";
import { useNetworkState } from "@/hooks/useNetworkState";
import { useSearchParams } from "next/navigation";

function InventoryContent() {
  const searchParams = useSearchParams();
  const initialView = searchParams.get('view') === 'personal' ? 'personal' : 'components';
  const [components, setComponents] = useState<ComponentWithTotals[]>([]);
  const [loading, setLoading] = useState(true);
  const { isOnline } = useNetworkState();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<'components' | 'personal'>(initialView);
  
  // Sync viewMode if searchParams change
  useEffect(() => {
    const v = searchParams.get('view');
    if (v === 'personal' || v === 'components') {
      setViewMode(v);
    }
  }, [searchParams]);

  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    load();
  }, [debouncedSearch]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getInventory(debouncedSearch);
      setComponents(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const componentItems = useMemo(() => components.filter(c => !isPersonalItem(c)), [components]);
  const personalItems = useMemo(() => components.filter(c => isPersonalItem(c)), [components]);
  const displayedItems = viewMode === 'personal' ? personalItems : componentItems;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-brand-bg">
      <div className="p-6 border-b border-[#332f2a] bg-[#1a1816] shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="font-serif text-[28px] font-bold tracking-widest text-white uppercase">INVENTORY</h1>
            <p className="mt-1 text-[10px] tracking-[0.2em] text-brand-gold uppercase">
              {viewMode === 'components' ? 'All tracked electronics components.' : 'All personal items and belongings.'}
            </p>
          </div>
          {isOnline && (
            <Link 
              href={viewMode === 'personal' ? "/inventory/new?type=personal" : "/inventory/new?type=component"} 
              className="flex items-center px-4 py-2 bg-brand-accent text-white text-xs font-bold uppercase tracking-widest rounded-sm hover:bg-brand-accent-hover transition-colors shrink-0 self-start sm:self-auto"
            >
              <Plus className="h-4 w-4 mr-1" /> {viewMode === 'personal' ? 'Add Personal Item' : 'Add Component'}
            </Link>
          )}
        </div>

        {/* View Mode Toggle (Components vs Personal) */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div className="inline-flex p-1 bg-black/40 border border-[#332f2a] rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('components')}
              className={`px-4 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all ${
                viewMode === 'components'
                  ? 'bg-brand-accent text-white shadow-sm'
                  : 'text-brand-text-muted hover:text-white'
              }`}
            >
              Components ({componentItems.length})
            </button>
            <button
              type="button"
              onClick={() => setViewMode('personal')}
              className={`px-4 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all ${
                viewMode === 'personal'
                  ? 'bg-brand-accent text-white shadow-sm'
                  : 'text-brand-text-muted hover:text-white'
              }`}
            >
              Personal ({personalItems.length})
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-text-muted" />
            <input 
              type="text" 
              placeholder={viewMode === 'personal' ? "Search personal items..." : "Search components, tags..."} 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#1a1816] border border-[#332f2a] pl-10 pr-4 py-2 text-sm text-white focus:border-brand-accent focus:outline-none transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto min-h-0">
        {loading ? (
          <div className="p-6 text-brand-text-muted">Loading {viewMode === 'personal' ? 'personal items' : 'components'}...</div>
        ) : (
          <InventoryTable components={displayedItems} viewMode={viewMode} />
        )}
      </div>
    </div>
  );
}

export default function InventoryPage() {
  return (
    <Suspense fallback={<div className="p-6 text-brand-text-muted">Loading inventory...</div>}>
      <InventoryContent />
    </Suspense>
  );
}
