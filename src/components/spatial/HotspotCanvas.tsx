"use client";

import { useRef, useState } from "react";
import { SpatialHotspot } from "@/lib/api";
import { HotspotConfigModal } from "./HotspotConfigModal";

interface Props {
  imageUrl: string;
  hotspots: SpatialHotspot[];
  isEditing: boolean;
  onHotspotCreated: (shapePoints: { x: number; y: number }[], label: string, isLeaf: boolean) => void;
  onHotspotClick: (hotspot: SpatialHotspot) => void;
  onCancelEdit: () => void;
}

export function HotspotCanvas({ imageUrl, hotspots, isEditing, onHotspotCreated, onHotspotClick, onCancelEdit }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  const getNormalizedPoint = (e: React.PointerEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return { x, y };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isEditing) return;
    e.preventDefault();
    containerRef.current?.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    setCurrentPoints([getNormalizedPoint(e)]);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isEditing || !isDrawing) return;
    e.preventDefault();
    setCurrentPoints((prev) => [...prev, getNormalizedPoint(e)]);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isEditing || !isDrawing) return;
    e.preventDefault();
    containerRef.current?.releasePointerCapture(e.pointerId);
    setIsDrawing(false);
    
    // Only open config if we drew a reasonable shape (more than 3 points)
    if (currentPoints.length > 3) {
      setShowConfig(true);
    } else {
      setCurrentPoints([]);
    }
  };

  const toPolygonString = (points: { x: number; y: number }[]) => {
    return points.map(p => `${p.x * 100},${p.y * 100}`).join(" ");
  };

  return (
    <div className="relative w-full h-full min-h-[600px] flex items-center justify-center bg-[#0a0a0a] border border-[#222] overflow-hidden rounded-lg">
      <div 
        ref={containerRef}
        className={`relative max-w-full max-h-full inline-block touch-none select-none ${isEditing ? 'cursor-crosshair' : 'cursor-default'}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* The actual image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
          src={imageUrl} 
          alt="Room Map" 
          className="max-w-full max-h-[80vh] object-contain pointer-events-none"
          draggable={false}
        />

        {/* SVG Overlay for existing hotspots and current drawing */}
        <svg 
          className="absolute inset-0 w-full h-full pointer-events-none" 
          viewBox="0 0 100 100" 
          preserveAspectRatio="none"
        >
          {/* Existing Hotspots */}
          {hotspots.map(h => (
            <g key={h.id} className={isEditing ? 'opacity-30' : 'group pointer-events-auto cursor-pointer'} onClick={() => !isEditing && onHotspotClick(h)}>
              <polygon 
                points={toPolygonString(h.shape_points)} 
                className="fill-transparent stroke-brand-accent/50 stroke-[0.2] transition-all duration-200 group-hover:fill-brand-accent/10 group-hover:stroke-brand-accent group-hover:stroke-[0.4]"
              />
              {/* Label positioned at the first point */}
              {!isEditing && h.shape_points.length > 0 && (
                <text 
                  x={h.shape_points[0].x * 100} 
                  y={(h.shape_points[0].y * 100) - 1} 
                  className="fill-white text-[1px] font-sans opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md"
                >
                  {h.label} {h.is_leaf ? '(Storage)' : '→'}
                </text>
              )}
            </g>
          ))}

          {/* Current Drawing */}
          {isDrawing && currentPoints.length > 0 && (
            <polyline 
              points={toPolygonString(currentPoints)} 
              className="fill-transparent stroke-brand-accent stroke-[0.3] border-dashed"
            />
          )}
          {/* Closed shape preview when finished drawing but modal is open */}
          {!isDrawing && currentPoints.length > 0 && (
            <polygon 
              points={toPolygonString(currentPoints)} 
              className="fill-brand-accent/20 stroke-brand-accent stroke-[0.3]"
            />
          )}
        </svg>
      </div>

      {showConfig && (
        <HotspotConfigModal 
          onClose={() => {
            setShowConfig(false);
            setCurrentPoints([]);
            onCancelEdit();
          }}
          onSubmit={(label, isLeaf) => {
            onHotspotCreated(currentPoints, label, isLeaf);
            setShowConfig(false);
            setCurrentPoints([]);
          }}
        />
      )}
    </div>
  );
}
