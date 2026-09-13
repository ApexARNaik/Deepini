"use client";

import React from "react";
import { TooltipPosition, TooltipVariant } from "./GlobalTooltip";

interface TooltipProps {
  content: string;
  children: React.ReactElement<React.HTMLAttributes<HTMLElement>>;
  position?: TooltipPosition;
  variant?: TooltipVariant;
}

/**
 * Convenience wrapper component that attaches tooltip data attributes to its single child element.
 */
export function Tooltip({
  content,
  children,
  position = "top",
  variant = "default",
}: TooltipProps) {
  if (!content) return children;

  return React.cloneElement(children, {
    "data-tooltip": content,
    "data-tooltip-pos": position,
    "data-tooltip-variant": variant,
  } as React.HTMLAttributes<HTMLElement>);
}
