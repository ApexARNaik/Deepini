"use client";

import React from "react";
import { MapPin, ChevronRight, ExternalLink } from "lucide-react";

export interface StorageTooltipData {
  targetRect: DOMRect;
  fullLabel?: string;
  label?: string;
  roomName?: string;
  quantity?: number;
  customText?: string;
  footerHint?: string;
}

export function StorageSequenceTooltip({ data }: { data: StorageTooltipData | null }) {
  if (!data || typeof window === "undefined") return null;

  const { targetRect, fullLabel, label, roomName, quantity, customText, footerHint } = data;
  const rawCrumbs = fullLabel ? fullLabel.split(" → ").map((s) => s.trim()).filter(Boolean) : [];
  const crumbs = rawCrumbs.length > 0 ? rawCrumbs : label ? [label] : [];

  const tooltipWidth = Math.min(440, window.innerWidth - 32);
  const targetCenterX = targetRect.left + targetRect.width / 2;
  const clampedX = Math.max(16, Math.min(window.innerWidth - tooltipWidth - 16, targetCenterX - tooltipWidth / 2));

  const showBelow = targetRect.top < 160;
  const tooltipY = showBelow ? targetRect.bottom + 8 : targetRect.top - 8;
  const arrowLeft = Math.max(16, Math.min(tooltipWidth - 16, targetCenterX - clampedX));

  return (
    <div
      style={{
        position: "fixed",
        left: `${clampedX}px`,
        top: `${tooltipY}px`,
        transform: showBelow ? "none" : "translateY(-100%)",
        width: `${tooltipWidth}px`,
        zIndex: 99999,
        pointerEvents: "none",
      }}
      className="animate-fadeIn transition-all duration-100 select-none"
    >
      <div className="relative bg-[#151311]/95 backdrop-blur-md border border-[#443e38] text-brand-text rounded-lg p-3.5 shadow-2xl shadow-black/95">
        {/* Pointer Arrow */}
        <div
          style={{ left: `${arrowLeft}px` }}
          className={`absolute w-2.5 h-2.5 rotate-45 bg-[#151311] border-[#443e38] -translate-x-1/2 ${
            showBelow ? "-top-1.5 border-t border-l" : "-bottom-1.5 border-b border-r"
          }`}
        />

        {/* Tooltip Header */}
        <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-[#2d2822]">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-gold">
            <MapPin className="h-3 w-3 text-brand-accent shrink-0" />
            <span>Storage Sequence</span>
          </div>
          <div className="flex items-center gap-2">
            {quantity !== undefined && (
              <span className="text-[10px] text-brand-text-muted">
                Qty: <strong className="text-brand-accent">{quantity}</strong>
              </span>
            )}
            {roomName && (
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#201d1a] border border-[#332f2a] text-brand-text-muted">
                {roomName}
              </span>
            )}
          </div>
        </div>

        {/* Breadcrumb Path Sequence */}
        {crumbs.length > 0 ? (
          <div className="py-0.5">
            <div className="flex flex-wrap items-center gap-1.5 leading-relaxed">
              {crumbs.map((crumb, idx) => {
                const isTarget = idx === crumbs.length - 1;
                return (
                  <span key={idx} className="inline-flex items-center">
                    {idx > 0 && (
                      <ChevronRight className="h-3 w-3 text-brand-gold/50 mx-0.5 shrink-0" />
                    )}
                    <span
                      className={`px-2 py-0.5 rounded text-xs transition-colors ${
                        isTarget
                          ? "bg-brand-accent/25 text-white font-bold border border-brand-accent/60 shadow-[0_0_10px_rgba(188,115,83,0.3)] inline-flex items-center gap-1.5"
                          : "text-brand-text-muted bg-[#201d1a] border border-[#2d2822]"
                      }`}
                    >
                      {isTarget && (
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-pulse shrink-0" />
                      )}
                      {crumb}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        ) : customText ? (
          <div className="text-brand-text py-0.5 text-xs font-medium leading-relaxed">
            {customText}
          </div>
        ) : (
          <div className="text-white py-0.5 text-xs font-semibold">
            {label}
          </div>
        )}

        {footerHint && (
          <div className="mt-2.5 pt-2 border-t border-[#2d2822] flex items-center justify-between text-[10px] text-brand-text-muted">
            <span className="flex items-center gap-1 text-brand-gold/90 font-medium">
              <ExternalLink className="h-2.5 w-2.5 text-brand-accent" />
              {footerHint}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
