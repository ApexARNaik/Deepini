"use client";

import React, { useEffect, useState, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";

export type TooltipVariant = "default" | "danger" | "warning" | "accent";
export type TooltipPosition = "top" | "bottom" | "left" | "right";

interface TooltipState {
  text: string;
  triggerEl: HTMLElement;
  preferredPos: TooltipPosition;
  variant: TooltipVariant;
}

export function GlobalTooltip() {
  const [mounted, setMounted] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [coords, setCoords] = useState<{
    x: number;
    y: number;
    arrowOffset: number;
    actualPos: TooltipPosition;
  } | null>(null);

  const tooltipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const currentTriggerRef = useRef<HTMLElement | null>(null);

  // Measure and position tooltip
  useLayoutEffect(() => {
    if (!tooltip || !tooltipRef.current) {
      setCoords(null);
      return;
    }

    const ttEl = tooltipRef.current;
    const triggerRect = tooltip.triggerEl.getBoundingClientRect();
    const ttRect = ttEl.getBoundingClientRect();

    const ttWidth = ttRect.width;
    const ttHeight = ttRect.height;
    const triggerCenterX = triggerRect.left + triggerRect.width / 2;
    const triggerCenterY = triggerRect.top + triggerRect.height / 2;

    let actualPos = tooltip.preferredPos;

    // Auto-flip for top / bottom
    if (actualPos === "top" && triggerRect.top - ttHeight - 8 < 8) {
      actualPos = "bottom";
    } else if (actualPos === "bottom" && triggerRect.bottom + ttHeight + 8 > window.innerHeight - 8) {
      actualPos = "top";
    }

    // Auto-flip for left / right
    if (actualPos === "left" && triggerRect.left - ttWidth - 8 < 8) {
      actualPos = "right";
    } else if (actualPos === "right" && triggerRect.right + ttWidth + 8 > window.innerWidth - 8) {
      actualPos = "left";
    }

    let x = 0;
    let y = 0;
    let arrowOffset = 0;

    if (actualPos === "top" || actualPos === "bottom") {
      y = actualPos === "top" ? triggerRect.top - ttHeight - 8 : triggerRect.bottom + 8;
      const idealX = triggerCenterX - ttWidth / 2;
      const clampedX = Math.max(8, Math.min(window.innerWidth - ttWidth - 8, idealX));
      x = clampedX;
      arrowOffset = Math.max(12, Math.min(ttWidth - 12, triggerCenterX - clampedX));
    } else {
      x = actualPos === "left" ? triggerRect.left - ttWidth - 8 : triggerRect.right + 8;
      const idealY = triggerCenterY - ttHeight / 2;
      const clampedY = Math.max(8, Math.min(window.innerHeight - ttHeight - 8, idealY));
      y = clampedY;
      arrowOffset = Math.max(10, Math.min(ttHeight - 10, triggerCenterY - clampedY));
    }

    setCoords({ x, y, arrowOffset, actualPos });
  }, [tooltip]);

  useEffect(() => {
    // 1. Sanitize any existing native [title] elements in the DOM on mount & mutations
    const sanitizeElement = (el: Element) => {
      if (el.hasAttribute("title")) {
        const titleVal = el.getAttribute("title");
        if (titleVal && titleVal.trim()) {
          if (!el.hasAttribute("data-tooltip")) {
            el.setAttribute("data-tooltip", titleVal);
          }
        }
        el.removeAttribute("title");
      }
    };

    const sanitizeSubtree = (root: Node) => {
      if (root instanceof Element) {
        sanitizeElement(root);
        const titleNodes = root.querySelectorAll("[title]");
        titleNodes.forEach(sanitizeElement);
      }
    };

    // Initial pass
    sanitizeSubtree(document.body);

    // Mutation observer to capture any dynamically added or modified elements with [title]
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes" && mutation.attributeName === "title") {
          if (mutation.target instanceof Element) {
            sanitizeElement(mutation.target);
          }
        } else if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => sanitizeSubtree(node));
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["title"],
    });

    // 2. Event listeners for displaying and hiding custom tooltips
    const hide = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      currentTriggerRef.current = null;
      setTooltip(null);
      setCoords(null);
    };

    const handlePointerOver = (e: PointerEvent | MouseEvent) => {
      const target = e.target as Element | null;
      if (!target) return;

      // In case title exists on hover, sanitize immediately
      if (target.hasAttribute("title")) {
        sanitizeElement(target);
      }

      const trigger = target.closest("[data-tooltip]") as HTMLElement | null;
      if (!trigger) {
        hide();
        return;
      }

      if (trigger === currentTriggerRef.current) return;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      currentTriggerRef.current = trigger;

      // Small debounce delay (120ms) to ensure smooth browsing without flicker
      timerRef.current = setTimeout(() => {
        const text = trigger.getAttribute("data-tooltip");
        if (!text || !text.trim()) {
          hide();
          return;
        }

        const preferredPos = (trigger.getAttribute("data-tooltip-pos") as TooltipPosition) || "top";
        const variant = (trigger.getAttribute("data-tooltip-variant") as TooltipVariant) || "default";

        setTooltip({
          text: text.trim(),
          triggerEl: trigger,
          preferredPos,
          variant,
        });
      }, 120);
    };

    const handlePointerOut = (e: PointerEvent | MouseEvent) => {
      const target = e.target as Element | null;
      if (!target) return;
      const trigger = target.closest("[data-tooltip]");
      if (trigger && trigger === currentTriggerRef.current) {
        const related = (e as MouseEvent).relatedTarget as Element | null;
        if (!related || !trigger.contains(related)) {
          hide();
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };

    // Global listeners
    document.addEventListener("pointerover", handlePointerOver, { passive: true });
    document.addEventListener("pointerout", handlePointerOut, { passive: true });
    document.addEventListener("pointerdown", hide, { passive: true });
    document.addEventListener("scroll", hide, { capture: true, passive: true });
    window.addEventListener("keydown", handleKeyDown, { passive: true });

    setMounted(true);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      observer.disconnect();
      document.removeEventListener("pointerover", handlePointerOver);
      document.removeEventListener("pointerout", handlePointerOut);
      document.removeEventListener("pointerdown", hide);
      document.removeEventListener("scroll", hide, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  if (!tooltip || !mounted || typeof document === "undefined") return null;

  const { variant } = tooltip;

  const variantStyles = {
    default: {
      container: "bg-[#151311]/95 text-[#f5f0eb] border-[#443e38] shadow-2xl shadow-black/95",
      arrow: "bg-[#151311] border-[#443e38]",
    },
    danger: {
      container: "bg-[#1c1212]/95 text-red-200 border-red-500/70 shadow-2xl shadow-black/95 ring-1 ring-red-500/20",
      arrow: "bg-[#1c1212] border-red-500/70",
    },
    warning: {
      container: "bg-[#1c1712]/95 text-amber-200 border-amber-500/70 shadow-2xl shadow-black/95 ring-1 ring-amber-500/20",
      arrow: "bg-[#1c1712] border-amber-500/70",
    },
    accent: {
      container: "bg-[#181412]/95 text-white border-brand-accent/80 shadow-2xl shadow-black/95 ring-1 ring-brand-accent/30",
      arrow: "bg-[#181412] border-brand-accent/80",
    },
  }[variant];

  const actualPos = coords?.actualPos || tooltip.preferredPos;

  const tooltipNode = (
    <div
      ref={tooltipRef}
      role="tooltip"
      style={{
        position: "fixed",
        left: coords ? `${coords.x}px` : "-9999px",
        top: coords ? `${coords.y}px` : "-9999px",
        zIndex: 999999,
        pointerEvents: "none",
        opacity: coords ? 1 : 0,
      }}
      className="transition-opacity duration-100 ease-out select-none"
    >
      <div
        className={`relative px-2.5 py-1.5 rounded-md border text-xs font-medium backdrop-blur-md max-w-xs whitespace-pre-wrap break-words leading-snug tracking-normal ${variantStyles.container}`}
      >
        {/* Micro Arrow Pointer */}
        {coords && (
          <div
            style={{
              ...(actualPos === "top" || actualPos === "bottom"
                ? { left: `${coords.arrowOffset}px` }
                : { top: `${coords.arrowOffset}px` }),
            }}
            className={`absolute w-2 h-2 rotate-45 ${variantStyles.arrow} ${
              actualPos === "top"
                ? "-bottom-1 border-b border-r -translate-x-1/2"
                : actualPos === "bottom"
                ? "-top-1 border-t border-l -translate-x-1/2"
                : actualPos === "left"
                ? "-right-1 border-t border-r -translate-y-1/2"
                : "-left-1 border-b border-l -translate-y-1/2"
            }`}
          />
        )}
        <span className="relative z-10">{tooltip.text}</span>
      </div>
    </div>
  );

  return createPortal(tooltipNode, document.body);
}
