"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface Props {
  onClose: () => void;
  onSubmit: (label: string, isLeaf: boolean) => void;
}

export function HotspotConfigModal({ onClose, onSubmit }: Props) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<"leaf" | "drill">("drill");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    onSubmit(label.trim(), type === "leaf");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#1a1a1a] border border-[#333] rounded-lg shadow-2xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-serif text-2xl font-bold text-white">Configure Hotspot</h2>
          <button onClick={onClose} className="text-brand-text-muted hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs tracking-widest text-brand-text-muted uppercase mb-2">
              Label / Name
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Blue Drawer"
              autoFocus
              className="w-full bg-[#121212] border border-[#333] p-3 text-white focus:border-brand-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs tracking-widest text-brand-text-muted uppercase mb-3">
              Hotspot Type
            </label>
            <div className="space-y-3">
              <label className={`flex items-start p-3 border rounded cursor-pointer transition-colors ${type === 'drill' ? 'border-brand-accent bg-brand-accent/5' : 'border-[#333] hover:border-[#444]'}`}>
                <input
                  type="radio"
                  name="type"
                  checked={type === "drill"}
                  onChange={() => setType("drill")}
                  className="mt-1 mr-3 text-brand-accent focus:ring-brand-accent bg-[#121212] border-[#333]"
                />
                <div>
                  <div className="text-white font-medium">Opens into more storage</div>
                  <div className="text-xs text-brand-text-muted mt-1">Prompt for another photo to drill deeper</div>
                </div>
              </label>

              <label className={`flex items-start p-3 border rounded cursor-pointer transition-colors ${type === 'leaf' ? 'border-brand-accent bg-brand-accent/5' : 'border-[#333] hover:border-[#444]'}`}>
                <input
                  type="radio"
                  name="type"
                  checked={type === "leaf"}
                  onChange={() => setType("leaf")}
                  className="mt-1 mr-3 text-brand-accent focus:ring-brand-accent bg-[#121212] border-[#333]"
                />
                <div>
                  <div className="text-white font-medium">This is a storage location</div>
                  <div className="text-xs text-brand-text-muted mt-1">Can hold actual components</div>
                </div>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#333]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-brand-text-muted hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!label.trim()}
              className="px-6 py-2 text-sm font-medium bg-brand-accent text-white rounded-sm hover:bg-brand-accent-hover disabled:opacity-50"
            >
              Save Hotspot
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
