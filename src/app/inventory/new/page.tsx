import { ComponentForm } from "@/components/inventory/ComponentForm";

export default function NewComponentPage() {
  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-white mb-1">Add New Component</h1>
        <p className="text-sm text-brand-text-muted">Enter component details and custom fields.</p>
      </div>
      <ComponentForm />
    </div>
  );
}
