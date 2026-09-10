"use client";

import { useEffect, useState } from "react";
import { X, ExternalLink, Download, ZoomIn, ZoomOut, Image as ImageIcon } from "lucide-react";

interface ImagePreviewModalProps {
  isOpen: boolean;
  imageUrl: string | null;
  title?: string;
  subtitle?: string;
  onClose: () => void;
}

export function ImagePreviewModal({
  isOpen,
  imageUrl,
  title,
  subtitle,
  onClose,
}: ImagePreviewModalProps) {
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsZoomed(false);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [isOpen, onClose]);

  if (!isOpen || !imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="flex flex-col max-w-[95vw] max-h-[95vh] w-auto bg-[#141210] border border-[#332f2a] rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2d2924] bg-[#1a1816] shrink-0 gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <ImageIcon className="h-4 w-4 text-brand-accent shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white truncate leading-tight">
                {title || "Image Preview"}
              </h3>
              {subtitle && (
                <p className="text-[10px] uppercase tracking-wider text-brand-text-muted truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsZoomed(!isZoomed)}
              className="p-1.5 text-brand-text-muted hover:text-white hover:bg-[#282522] rounded transition-colors"
              title={isZoomed ? "Fit to view" : "Zoom in"}
            >
              {isZoomed ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}
            </button>

            <a
              href={imageUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 text-brand-text-muted hover:text-white hover:bg-[#282522] rounded transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="h-4 w-4" />
            </a>

            <a
              href={imageUrl}
              download
              target="_blank"
              rel="noreferrer"
              className="p-1.5 text-brand-text-muted hover:text-white hover:bg-[#282522] rounded transition-colors"
              title="Download original image"
            >
              <Download className="h-4 w-4" />
            </a>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-brand-text-muted hover:text-white hover:bg-[#282522] rounded transition-colors ml-1"
              title="Close (Esc)"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Image body */}
        <div
          className={`overflow-auto flex items-center justify-center p-2 sm:p-4 bg-[#0d0c0a] max-h-[calc(95vh-56px)] select-none ${
            isZoomed ? "cursor-zoom-out" : "cursor-zoom-in"
          }`}
          onClick={() => setIsZoomed(!isZoomed)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={title || "Display Image"}
            className={`transition-all duration-200 rounded border border-[#26231f] shadow-lg ${
              isZoomed
                ? "max-w-none w-auto object-none"
                : "max-h-[80vh] max-w-[88vw] object-contain w-auto h-auto"
            }`}
          />
        </div>
      </div>
    </div>
  );
}
