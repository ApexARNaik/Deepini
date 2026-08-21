"use client";

import { useState, useEffect, useMemo } from "react";
import { ComponentWithTotals, getInventory } from "@/lib/api";
import { InventoryTable } from "@/components/inventory/InventoryTable";
import { Search, Plus } from "lucide-react";
import Link from "next/link";
import { useDebounce } from "@/hooks/useDebounce";
import { useNetworkState } from "@/hooks/useNetworkState";

export default function InventoryPage() {
  const [components, setComponents] = useState<ComponentWithTotals[]>([]);
  const [loading, setLoading] = useState(true);
  const { isOnline } = useNetworkState();
  const [search, setSearch] = useState("");
  
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

  return (
    <div className="flex flex-col h-full overflow-hidden bg-brand-bg">
      <div className="p-6 border-b border-[#332f2a] bg-[#1a1816] shrink-0">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h1 className="font-serif text-4xl font-bold text-white mb-2">INVENTORY</h1>
            <p className="text-brand-text-muted italic">All tracked components in the workshop.</p>
          </div>
          {isOnline && (
            <Link 
              href="/inventory/new" 
              className="flex items-center px-4 py-2 bg-brand-accent text-white text-xs font-bold uppercase tracking-widest rounded-sm hover:bg-brand-accent-hover transition-colors"
            >
              <Plus className="h-4 w-4 mr-1" /> Add Component
            </Link>
          )}
        </div>

      {/* Filters Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-6 border-b border-[#332f2a]">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-text-muted" />
          <input 
            type="text" 
            placeholder="Search components, tags, locations..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#1a1816] border border-[#332f2a] pl-10 pr-4 py-2 text-sm text-white focus:border-brand-accent focus:outline-none transition-colors"
          />
        </div>
        
        {/* We can add tag dropdown here later if needed */}
      </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto min-h-0">
        {loading ? (
          <div className="text-brand-text-muted">Loading inventory...</div>
        ) : (
          <InventoryTable components={components} />
        )}
      </div>
    </div>
  );
}
