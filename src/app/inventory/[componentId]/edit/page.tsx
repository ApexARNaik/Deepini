"use client";

import { useEffect, useState } from "react";
import { ComponentForm } from "@/components/inventory/ComponentForm";
import { getComponentDetails, ComponentWithTotals, Tag } from "@/lib/api";
import { useParams } from "next/navigation";

export default function EditComponentPage() {
  const { componentId } = useParams();
  const [data, setData] = useState<{ component: ComponentWithTotals, tags: Tag[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof componentId !== 'string') return;
    getComponentDetails(componentId).then(res => {
      setData({ component: res.component, tags: res.component.tags });
      setLoading(false);
    }).catch(console.error);
  }, [componentId]);

  if (loading) return <div className="p-6 text-brand-text-muted">Loading component...</div>;
  if (!data) return <div className="p-6 text-brand-text-muted">Component not found.</div>;

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-white mb-1">Edit {data.component.name}</h1>
        <p className="text-sm text-brand-text-muted">Update details and custom fields.</p>
      </div>
      <ComponentForm initialData={data.component} initialTags={data.tags} />
    </div>
  );
}
