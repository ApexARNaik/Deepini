"use client";

import React, { useRef, useEffect, useCallback } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

export interface ThemedNumberInputProps {
  value: string | number;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  inputClassName?: string;
  autoFocus?: boolean;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

function getPrecision(step: number): number {
  const stepStr = step.toString();
  if (stepStr.includes(".")) {
    return stepStr.split(".")[1].length;
  }
  return 0;
}

export function ThemedNumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  placeholder,
  disabled = false,
  required = false,
  id,
  name,
  size = "md",
  className = "",
  inputClassName = "",
  autoFocus = false,
  onBlur,
  onKeyDown,
}: ThemedNumberInputProps) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const strValue = value === undefined || value === null ? "" : String(value);
  const numValue = parseFloat(strValue);
  const isInvalid = isNaN(numValue);

  const isDownDisabled = !isInvalid && min !== undefined && numValue <= min;
  const isUpDisabled = !isInvalid && max !== undefined && numValue >= max;

  const stopStepping = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const stepValue = useCallback(
    (direction: "up" | "down") => {
      const precision = getPrecision(step);
      let nextNum: number;

      if (isInvalid) {
        nextNum = min !== undefined ? min : direction === "up" ? step : 0;
      } else {
        if (direction === "up") {
          nextNum = numValue + step;
        } else {
          nextNum = numValue - step;
        }
      }

      nextNum = Number(nextNum.toFixed(precision));

      if (min !== undefined && nextNum < min) {
        nextNum = min;
      }
      if (max !== undefined && nextNum > max) {
        nextNum = max;
      }

      onChange(String(nextNum));
    },
    [isInvalid, min, max, numValue, step, onChange]
  );

  const startStepping = useCallback(
    (direction: "up" | "down") => {
      stopStepping();
      stepValue(direction);
      timerRef.current = setTimeout(() => {
        intervalRef.current = setInterval(() => {
          stepValue(direction);
        }, 60);
      }, 300);
    },
    [stepValue, stopStepping]
  );

  useEffect(() => {
    const handleMouseUp = () => stopStepping();
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
      stopStepping();
    };
  }, [stopStepping]);

  const heightClass =
    size === "sm" ? "h-7 text-xs" : size === "lg" ? "h-12 text-base" : "h-10 text-sm";
  const btnWidthClass = size === "sm" ? "w-5" : size === "lg" ? "w-7" : "w-6";
  const iconSizeClass = size === "sm" ? "h-2.5 w-2.5" : size === "lg" ? "h-3.5 w-3.5" : "h-3 w-3";

  return (
    <div
      className={`relative flex items-center bg-[#191715] border border-[#3a352e] rounded overflow-hidden transition-all focus-within:border-brand-accent focus-within:ring-1 focus-within:ring-brand-accent/40 ${heightClass} ${className}`}
    >
      <input
        ref={inputRef}
        type="number"
        min={min}
        max={max}
        step={step}
        value={strValue}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        id={id}
        name={name}
        autoFocus={autoFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        onChange={(e) => onChange(e.target.value)}
        className={`flex-1 min-w-0 h-full bg-transparent text-white px-3 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${inputClassName}`}
      />

      <div
        className={`flex flex-col h-full ${btnWidthClass} border-l border-[#3a352e] shrink-0 bg-[#151311] select-none`}
      >
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled || isUpDisabled}
          onMouseDown={(e) => {
            e.preventDefault();
            if (!disabled && !isUpDisabled) startStepping("up");
          }}
          className="flex-1 flex items-center justify-center border-b border-[#3a352e]/60 hover:bg-[#2c2823] active:bg-brand-accent/25 text-brand-text-muted hover:text-brand-accent disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-brand-text-muted disabled:cursor-not-allowed transition-colors"
          title="Increase"
        >
          <ChevronUp className={`${iconSizeClass} stroke-[2.5]`} />
        </button>
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled || isDownDisabled}
          onMouseDown={(e) => {
            e.preventDefault();
            if (!disabled && !isDownDisabled) startStepping("down");
          }}
          className="flex-1 flex items-center justify-center hover:bg-[#2c2823] active:bg-brand-accent/25 text-brand-text-muted hover:text-brand-accent disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-brand-text-muted disabled:cursor-not-allowed transition-colors"
          title="Decrease"
        >
          <ChevronDown className={`${iconSizeClass} stroke-[2.5]`} />
        </button>
      </div>
    </div>
  );
}
