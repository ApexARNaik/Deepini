"use client";

import { useState, useRef, useEffect } from "react";
import { SpatialHotspot, SpatialPhoto } from "@/lib/api";
import { ImageUploadDropzone } from "./ImageUploadDropzone";
import { X, ArrowRight, Layers, Check, Loader2, Sparkles } from "lucide-react";

interface Props {
  parentHotspot: SpatialHotspot;
  childPhoto: SpatialPhoto;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (data: {
    file: File;
    photoLabel: string;
    hotspotLabel: string;
  }) => void;
}

export function InsertIntermediateModal({
  parentHotspot,
  childPhoto,
  isSubmitting = false,
  onClose,
  onSubmit
}: Props) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [photoLabel, setPhotoLabel] = useState(`View inside ${parentHotspot.label}`);
  const [hotspotLabel, setHotspotLabel] = useState(childPhoto.label || `Opens to ${parentHotspot.label}`);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [selectedFile]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, isSubmitting]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError("Please select or drop an image for the intermediate view.");
      return;
    }
    if (!photoLabel.trim()) {
      setError("Please provide a name for the intermediate view.");
      return;
    }
    if (!hotspotLabel.trim()) {
      setError("Please provide a label for the hotspot that opens into the child view.");
      return;
    }

    setError(null);
    onSubmit({
      file: selectedFile,
      photoLabel: photoLabel.trim(),
      hotspotLabel: hotspotLabel.trim()
    });
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div 
        className="bg-[#1a1816] border border-[#332f2a] rounded-xl max-w-lg w-full overflow-hidden shadow-2xl animate-scaleUp flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#332f2a] bg-black/30 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-brand-accent/15 text-brand-accent border border-brand-accent/30">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold text-white tracking-wide">
                Insert Intermediate View
              </h3>
              <p className="text-[11px] text-brand-text-muted">
                Add a view in between two existing linked storage levels
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-brand-text-muted hover:text-white rounded-lg hover:bg-white/5 transition-colors disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Hierarchy Flow Visual Card */}
          <div className="bg-black/50 border border-[#332f2a] rounded-lg p-3 text-xs">
            <div className="text-[10px] uppercase font-mono tracking-wider text-brand-text-muted mb-2 font-bold flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-brand-accent" />
              <span>Hierarchy Flow Preview</span>
            </div>
            <div className="flex items-center justify-between gap-1.5 py-1 px-1 overflow-x-auto text-[11px]">
              {/* Parent Hotspot */}
              <div className="flex flex-col items-center text-center p-2 rounded bg-[#252320] border border-[#3a3530] min-w-[90px] flex-1">
                <span className="text-[9px] text-brand-text-muted uppercase tracking-wider">Parent</span>
                <span className="font-bold text-white truncate w-full mt-0.5" title={parentHotspot.label}>
                  {parentHotspot.label}
                </span>
              </div>

              <ArrowRight className="h-4 w-4 text-brand-accent shrink-0" />

              {/* New View */}
              <div className="flex flex-col items-center text-center p-2 rounded bg-brand-accent/20 border border-brand-accent/50 text-white min-w-[110px] flex-1 shadow-[0_0_12px_rgba(188,115,83,0.3)]">
                <span className="text-[9px] text-amber-300 uppercase tracking-wider font-bold">New View</span>
                <span className="font-bold text-brand-gold truncate w-full mt-0.5" title={photoLabel || "New View"}>
                  {photoLabel || "New View"}
                </span>
              </div>

              <ArrowRight className="h-4 w-4 text-brand-accent shrink-0" />

              {/* Child View */}
              <div className="flex flex-col items-center text-center p-2 rounded bg-[#252320] border border-[#3a3530] min-w-[90px] flex-1">
                <span className="text-[9px] text-brand-text-muted uppercase tracking-wider">Child View</span>
                <span className="font-bold text-white truncate w-full mt-0.5" title={childPhoto.label || "Target View"}>
                  {childPhoto.label || "Target View"}
                </span>
              </div>
            </div>
            <p className="text-[10px] text-brand-text-muted mt-2 text-center">
              All hotspots, inventory items, and drilldowns inside <strong>&quot;{childPhoto.label}&quot;</strong> remain completely unchanged.
            </p>
          </div>

          {/* Image Picker */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-brand-text mb-1.5">
              Intermediate View Photo <span className="text-red-400">*</span>
            </label>
            {previewUrl ? (
              <div className="relative rounded-lg overflow-hidden border border-brand-accent/40 bg-black/60 group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="Preview" className="w-full h-44 object-contain" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <label className="cursor-pointer px-3 py-1.5 bg-brand-accent hover:bg-brand-accent/90 text-white text-xs font-bold rounded shadow transition-colors">
                    Change Image
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => {
                        if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
                      }} 
                    />
                  </label>
                </div>
              </div>
            ) : (
              <ImageUploadDropzone 
                onUpload={async (file) => { setSelectedFile(file); }} 
                isUploading={false} 
                label="Drop image or click to select new intermediate photo"
              />
            )}
          </div>

          {/* New View Label */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-brand-text mb-1.5">
              Intermediate View Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={photoLabel}
              onChange={(e) => setPhotoLabel(e.target.value)}
              placeholder="e.g. Cabinet Overview, Shelf Layer"
              className="w-full bg-black/50 border border-[#332f2a] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-brand-accent transition-colors"
              required
            />
          </div>

          {/* Next Hotspot Label */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-brand-text mb-1.5">
              Hotspot Label on New View (Opens into &quot;{childPhoto.label}&quot;) <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={hotspotLabel}
              onChange={(e) => setHotspotLabel(e.target.value)}
              placeholder="e.g. Drawer 1, Storage Bin"
              className="w-full bg-black/50 border border-[#332f2a] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-brand-accent transition-colors"
              required
            />
            <p className="text-[10px] text-brand-text-muted mt-1">
              A hotspot will be created on the new view with this name, linking directly to &quot;{childPhoto.label}&quot;. You can resize or redraw its position right after.
            </p>
          </div>

          {error && (
            <div className="p-2.5 rounded bg-red-950/80 border border-red-700/60 text-red-200 text-xs font-medium">
              {error}
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-3 border-t border-[#332f2a] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-brand-text-muted hover:text-white rounded-lg border border-[#332f2a] hover:bg-[#252320] transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedFile}
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold uppercase tracking-wider bg-brand-accent hover:bg-brand-accent/90 text-white rounded-lg shadow-lg hover:shadow-brand-accent/20 transition-all disabled:opacity-40 disabled:pointer-events-none"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Inserting View...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Insert View</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
