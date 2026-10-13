"use client";

import React from "react";
import { TooltipPosition, TooltipVariant } from "./GlobalTooltip";

export interface TooltipProps {
  content: string;
  children: React.ReactElement<React.HTMLAttributes<HTMLElement>>;
  position?: TooltipPosition;
  variant?: TooltipVariant;
  onlyOnOverflow?: boolean;
}

/**
 * Convenience wrapper component that attaches tooltip data attributes to its single child element.
 */
export function Tooltip({
  content,
  children,
  position = "top",
  variant = "default",
  onlyOnOverflow = false,
}: TooltipProps) {
  if (!content) return children;

  return React.cloneElement(children, {
    "data-tooltip": content,
    "data-tooltip-pos": position,
    "data-tooltip-variant": variant,
    ...(onlyOnOverflow ? { "data-tooltip-only-overflow": "" } : {}),
  } as React.HTMLAttributes<HTMLElement>);
}

export interface TruncatedTextTooltipProps extends React.HTMLAttributes<HTMLSpanElement> {
  text: string;
  position?: TooltipPosition;
  variant?: TooltipVariant;
}

/**
 * Renders a text span with standard truncation (ellipsis) and automatically displays
 * the full text in the customized global tooltip ONLY when the text is actually clipped/overflowing.
 */
export function TruncatedTextTooltip({
  text,
  className = "",
  position = "top",
  variant = "default",
  children,
  ...rest
}: TruncatedTextTooltipProps) {
  return (
    <span
      {...rest}
      className={`truncate block max-w-full ${className}`}
      data-tooltip={text}
      data-tooltip-only-overflow=""
      data-tooltip-pos={position}
      data-tooltip-variant={variant}
    >
      {children || text}
    </span>
  );
}
