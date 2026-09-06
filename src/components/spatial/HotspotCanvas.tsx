"use client";

import { useRef, useState, useEffect } from "react";
import { SpatialHotspot } from "@/lib/api";
import { HotspotConfigModal } from "./HotspotConfigModal";
import { useNetworkState } from "@/hooks/useNetworkState";
import { Trash2 } from "lucide-react";

interface Props {
  imageUrl: string;
  hotspots: SpatialHotspot[];
  isEditing: boolean;
  highlightedHotspotId?: string | null;
  onHotspotCreated: (shapePoints: { x: number; y: number }[], label: string, isLeaf: boolean) => void;
  onHotspotClick: (hotspot: SpatialHotspot) => void;
  onHotspotDelete?: (hotspot: SpatialHotspot) => void;
  onCancelEdit: () => void;
}

export function HotspotCanvas({ 
  imageUrl, 
  hotspots, 
  isEditing, 
  highlightedHotspotId, 
  onHotspotCreated, 
  onHotspotClick, 
  onHotspotDelete,
  onCancelEdit 
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
  const { isOnline } = useNetworkState();
  const [isDrawing, setIsDrawing] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [hoveredHotspotId, setHoveredHotspotId] = useState<string | null>(null);

  const [drawMode, setDrawMode] = useState<'freehand' | 'polygon' | 'delete'>('freehand');
  const [polygonMousePos, setPolygonMousePos] = useState<{ x: number; y: number } | null>(null);

  // Reset mode when exiting edit
  useEffect(() => {
    if (!isEditing) {
      setDrawMode('freehand');
      setCurrentPoints([]);
      setIsDrawing(false);
      setPolygonMousePos(null);
    }
  }, [isEditing]);

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
    if (!isEditing || !isOnline || drawMode === 'delete') return;
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
    if (!isEditing || !isOnline || drawMode === 'delete') return;
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

  const hoveredHotspot = hotspots.find(h => h.id === hoveredHotspotId);

  return (
    <div className="relative w-full min-h-[500px] flex items-center justify-center bg-[#0f0e0c] border border-[#332f2a] overflow-auto rounded-lg p-2 sm:p-4">
      {/* Edit Mode Toolbar */}
      {isEditing && (
        <div className="sticky top-4 left-4 z-20 flex flex-wrap items-center gap-1.5 bg-[#1a1816]/95 backdrop-blur-md p-1.5 rounded-lg border border-[#332f2a] self-start shadow-xl">
          <span className="text-[10px] text-brand-text-muted uppercase tracking-widest font-bold px-2 hidden sm:inline">
            Tool:
          </span>
          <button 
            type="button"
            onClick={() => { setDrawMode('freehand'); setCurrentPoints([]); setIsDrawing(false); }}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              drawMode === 'freehand' 
                ? 'bg-brand-accent text-white shadow-sm' 
                : 'text-brand-text-muted hover:text-white hover:bg-[#252320]'
            }`}
          >
            Freehand
          </button>
          <button 
            type="button"
            onClick={() => { setDrawMode('polygon'); setCurrentPoints([]); setIsDrawing(false); }}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              drawMode === 'polygon' 
                ? 'bg-brand-accent text-white shadow-sm' 
                : 'text-brand-text-muted hover:text-white hover:bg-[#252320]'
            }`}
          >
            Polygon
          </button>
          
          <div className="h-4 w-px bg-[#332f2a] mx-1" />

          <button 
            type="button"
            onClick={() => { setDrawMode('delete'); setCurrentPoints([]); setIsDrawing(false); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded transition-colors ${
              drawMode === 'delete' 
                ? 'bg-red-600 text-white shadow-md' 
                : 'text-red-400/90 hover:text-red-300 hover:bg-red-500/10'
            }`}
            title="Click to select and delete hotspots"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete Hotspot</span>
          </button>
        </div>
      )}

      {/* Delete mode guidance banner */}
      {isEditing && drawMode === 'delete' && (
        <div className="absolute top-4 inset-x-0 flex justify-center pointer-events-none z-20">
          <div className="bg-red-950/90 text-red-200 border border-red-700/60 px-4 py-1.5 rounded-full text-xs font-semibold shadow-lg backdrop-blur-sm flex items-center gap-2 pointer-events-auto">
            <Trash2 className="h-3.5 w-3.5 text-red-400" />
            <span>
              {hoveredHotspot 
                ? `Click to delete "${hoveredHotspot.label}"` 
                : "Click on any highlighted hotspot to delete it"}
            </span>
          </div>
        </div>
      )}

      <div 
        ref={containerRef}
        className={`relative inline-block touch-none select-none max-w-full ${
          isEditing 
            ? (drawMode === 'delete' ? 'cursor-pointer' : 'cursor-crosshair') 
            : 'cursor-default'
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* The actual image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
          src={imageUrl} 
          alt="Room Map" 
          className="max-w-full h-auto block pointer-events-none select-none"
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
            const isDeleteMode = isEditing && drawMode === 'delete';
            const isClickable = isDeleteMode || !isEditing;
            
            return (
              <polygon
                key={hs.id}
                points={hs.shape_points.map((p) => `${p.x * 100},${p.y * 100}`).join(" ")}
                fill={
                  isDeleteMode
                    ? (isHovered ? "rgba(239, 68, 68, 0.55)" : "rgba(239, 68, 68, 0.22)")
                    : isHovered 
                      ? "rgba(239, 68, 68, 0.4)" 
                      : isHighlighted 
                        ? "rgba(239, 68, 68, 0.2)" 
                        : "rgba(255, 255, 255, 0.1)"
                }
                stroke={
                  isDeleteMode
                    ? (isHovered ? "#ff2222" : "rgba(239, 68, 68, 0.85)")
                    : isHovered || isHighlighted 
                      ? "#ef4444" 
                      : "rgba(255,255,255,0.5)"
                }
                strokeWidth={isDeleteMode ? (isHovered ? "0.8" : "0.5") : (isHighlighted ? "0.6" : "0.3")}
                strokeDasharray={isDeleteMode ? (isHovered ? "none" : "2,2") : "none"}
                className={`transition-all duration-200 ${isHighlighted ? 'animate-pulse' : ''} ${
                  isClickable ? "cursor-pointer pointer-events-auto" : "pointer-events-none"
                }`}
                onMouseEnter={() => isClickable && setHoveredHotspotId(hs.id)}
                onMouseLeave={() => setHoveredHotspotId(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isDeleteMode) {
                    onHotspotDelete?.(hs);
                  } else if (!isEditing) {
                    onHotspotClick(hs);
                  }
                }}
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
