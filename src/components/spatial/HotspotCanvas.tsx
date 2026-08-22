"use client";

import { useRef, useState, useEffect } from "react";
import { SpatialHotspot } from "@/lib/api";
import { HotspotConfigModal } from "./HotspotConfigModal";
import { useNetworkState } from "@/hooks/useNetworkState";

interface Props {
  imageUrl: string;
  hotspots: SpatialHotspot[];
  isEditing: boolean;
  highlightedHotspotId?: string | null;
  onHotspotCreated: (shapePoints: { x: number; y: number }[], label: string, isLeaf: boolean) => void;
  onHotspotClick: (hotspot: SpatialHotspot) => void;
  onCancelEdit: () => void;
}

export function HotspotCanvas({ imageUrl, hotspots, isEditing, highlightedHotspotId, onHotspotCreated, onHotspotClick, onCancelEdit }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
  const { isOnline } = useNetworkState();
  const [isDrawing, setIsDrawing] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [hoveredHotspotId, setHoveredHotspotId] = useState<string | null>(null);

  const [drawMode, setDrawMode] = useState<'freehand' | 'polygon'>('freehand');
  const [polygonMousePos, setPolygonMousePos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isEditing || !isOnline || drawMode !== 'polygon') return;
      if (e.key === 'Enter' && currentPoints.length > 2) {
        setIsDrawing(false);
        setShowConfig(true);
        setPolygonMousePos(null);
      } else if (e.key === 'Escape') {
        setIsDrawing(false);
        setCurrentPoints([]);
        setPolygonMousePos(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, isOnline, drawMode, currentPoints]);

  const getNormalizedPoint = (e: React.PointerEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return { x, y };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isEditing || !isOnline) return;
    e.preventDefault();
    
    if (drawMode === 'freehand') {
      containerRef.current?.setPointerCapture(e.pointerId);
      setIsDrawing(true);
      setCurrentPoints([getNormalizedPoint(e)]);
    } else {
      const pt = getNormalizedPoint(e);
      if (currentPoints.length === 0) {
        setIsDrawing(true);
        setCurrentPoints([pt]);
      } else {
        const start = currentPoints[0];
        const dist = Math.hypot(pt.x - start.x, pt.y - start.y);
        // snap to close if clicking near start
        if (currentPoints.length > 2 && dist < 0.03) {
          setIsDrawing(false);
          setShowConfig(true);
          setPolygonMousePos(null);
        } else {
          setCurrentPoints([...currentPoints, pt]);
        }
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isEditing || !isOnline) return;
    e.preventDefault();
    if (drawMode === 'freehand') {
      if (!isDrawing) return;
      setCurrentPoints((prev) => [...prev, getNormalizedPoint(e)]);
    } else {
      if (!isDrawing) return;
      setPolygonMousePos(getNormalizedPoint(e));
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isEditing || !isOnline || drawMode !== 'freehand') return;
    e.preventDefault();
    if (!isDrawing) return;
    containerRef.current?.releasePointerCapture(e.pointerId);
    setIsDrawing(false);
    
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
    <div className="relative w-full h-full min-h-[600px] flex items-center justify-center bg-[#0f0e0c] border border-[#332f2a] overflow-hidden rounded-lg">
      {isEditing && (
        <div className="absolute top-4 left-4 z-10 flex gap-2 bg-[#1a1816] p-2 rounded border border-[#332f2a]">
          <button 
            onClick={() => { setDrawMode('freehand'); setCurrentPoints([]); setIsDrawing(false); }}
            className={`px-3 py-1 text-xs font-medium rounded ${drawMode === 'freehand' ? 'bg-brand-accent text-white' : 'text-brand-text-muted hover:text-white'}`}
          >
            Freehand
          </button>
          <button 
            onClick={() => { setDrawMode('polygon'); setCurrentPoints([]); setIsDrawing(false); }}
            className={`px-3 py-1 text-xs font-medium rounded ${drawMode === 'polygon' ? 'bg-brand-accent text-white' : 'text-brand-text-muted hover:text-white'}`}
          >
            Polygon
          </button>
        </div>
      )}
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
          {hotspots.map((hs) => {
            const isHovered = hoveredHotspotId === hs.id;
            const isHighlighted = highlightedHotspotId === hs.id;
            
            return (
              <polygon
                key={hs.id}
                points={hs.shape_points.map((p) => `${p.x * 100},${p.y * 100}`).join(" ")}
                fill={isHovered ? "rgba(239, 68, 68, 0.4)" : isHighlighted ? "rgba(239, 68, 68, 0.2)" : "rgba(255, 255, 255, 0.1)"}
                stroke={isHovered || isHighlighted ? "#ef4444" : "rgba(255,255,255,0.5)"}
                strokeWidth={isHighlighted ? "0.6" : "0.3"}
                className={`transition-all duration-300 ${isHighlighted ? 'animate-pulse' : ''} ${!isEditing ? "cursor-pointer pointer-events-auto" : "pointer-events-none"}`}
                onMouseEnter={() => !isEditing && setHoveredHotspotId(hs.id)}
                onMouseLeave={() => setHoveredHotspotId(null)}
                onClick={() => !isEditing && onHotspotClick(hs)}
              />
            );
          })}

          {/* Current Drawing */}
          {isDrawing && currentPoints.length > 0 && (
            <polyline 
              points={toPolygonString(drawMode === 'polygon' && polygonMousePos ? [...currentPoints, polygonMousePos] : currentPoints)} 
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
