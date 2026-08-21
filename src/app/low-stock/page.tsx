"use client";

import { useState, useEffect } from "react";
import { ComponentWithTotals, getLowStock } from "@/lib/api";
import { InventoryTable } from "@/components/inventory/InventoryTable";

export default function LowStockPage() {
  const [components, setComponents] = useState<ComponentWithTotals[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await getLowStock();
        setComponents(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-serif text-4xl font-bold text-brand-accent mb-2">LOW STOCK ALERTS</h1>
        <p className="text-brand-text-muted italic">Components at or below their minimum threshold.</p>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto min-h-0">
        {loading ? (
          <div className="text-brand-text-muted">Loading low stock alerts...</div>
        ) : (
          <InventoryTable components={components} />
        )}
      </div>
    </div>
  );
}
