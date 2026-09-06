"use client";

import { useEffect, useState, Suspense } from "react";
import { ComponentForm } from "@/components/inventory/ComponentForm";
import { getComponentDetails, ComponentWithTotals, Tag } from "@/lib/api";
import { useParams } from "next/navigation";

export default function EditComponentPage() {
  const { componentId } = useParams();
  const [data, setData] = useState<{ component: ComponentWithTotals, tags: Tag[], locations: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof componentId !== 'string') return;
    getComponentDetails(componentId).then(res => {
      setData({ component: res.component, tags: res.component.tags, locations: res.locations });
      setLoading(false);
    }).catch(console.error);
  }, [componentId]);

  if (loading) return <div className="p-6 text-brand-text-muted">Loading...</div>;
  if (!data) return <div className="p-6 text-brand-text-muted">Item not found.</div>;

  return (
    <div className="p-6 h-full overflow-y-auto">
      <Suspense fallback={<div className="p-6 text-brand-text-muted">Loading form...</div>}>
        <ComponentForm initialData={data.component} initialTags={data.tags} initialLocations={data.locations} />
      </Suspense>
    </div>
  );
}
