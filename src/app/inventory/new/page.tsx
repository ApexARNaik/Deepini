import { Suspense } from "react";
import { ComponentForm } from "@/components/inventory/ComponentForm";

export default function NewComponentPage() {
  return (
    <div className="p-6 h-full overflow-y-auto">
      <Suspense fallback={<div className="p-6 text-brand-text-muted">Loading form...</div>}>
        <ComponentForm />
      </Suspense>
    </div>
  );
}
