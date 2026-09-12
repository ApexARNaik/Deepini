"use client";

import { useRef, useState, useEffect } from "react";
import { SpatialHotspot } from "@/lib/api";
import { HotspotConfigModal } from "./HotspotConfigModal";
import { useNetworkState } from "@/hooks/useNetworkState";
import { Trash2, MapPin, Check, RotateCcw, Edit2, Sliders, Crop, Move, ArrowRightLeft } from "lucide-react";

interface Props {
  imageUrl: string;
  hotspots: SpatialHotspot[];
  isEditing: boolean;
  highlightedHotspotId?: string | null;
  reshapingHotspot?: SpatialHotspot | null;
  movingHotspot?: { hotspot: SpatialHotspot; sourcePhotoId: string } | null;
  onHotspotCreated: (shapePoints: { x: number; y: number }[], label: string, isLeaf: boolean) => void;
  onHotspotClick: (hotspot: SpatialHotspot) => void;
  onHotspotDelete?: (hotspot: SpatialHotspot) => void;
  onHotspotEdit?: (hotspot: SpatialHotspot) => void;
  onConfirmReshape?: (hotspotId: string, newPoints: { x: number; y: number }[]) => void;
  onCancelReshape?: () => void;
  onConfirmMoveHotspot?: (hotspotId: string, newPoints: { x: number; y: number }[]) => void;
  onCancelMoveHotspot?: () => void;
  onBatchUpdateHotspots?: (updates: { id: string; shape_points: { x: number; y: number }[] }[]) => void;
  onUndo?: () => void;
  canUndo?: boolean;
  onCancelEdit: () => void;
}

type DrawMode = 'freehand' | 'polygon' | 'rectangle' | 'arrow' | 'delete' | 'edit' | 'adjust';
type RectStage = 'idle' | 'drawing' | 'resizing';
type ResizeHandle = 'top' | 'bottom' | 'left' | 'right' | 'tl' | 'tr' | 'bl' | 'br' | 'move';
type ArrowStage = 'idle' | 'drawing' | 'adjusting';
type ArrowHandle = 'tail' | 'tip' | 'body' | 'width1' | 'width2';

export function HotspotCanvas({ 
  imageUrl, 
  hotspots, 
  isEditing, 
  highlightedHotspotId, 
  reshapingHotspot,
  movingHotspot,
  onHotspotCreated, 
  onHotspotClick, 
  onHotspotDelete,
  onHotspotEdit,
  onConfirmReshape,
  onCancelReshape,
  onConfirmMoveHotspot,
  onCancelMoveHotspot,
  onBatchUpdateHotspots,
  onUndo,
  canUndo = false,
  onCancelEdit 
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
  const { isOnline } = useNetworkState();
  const [isDrawing, setIsDrawing] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [hoveredHotspotId, setHoveredHotspotId] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  const [drawMode, setDrawMode] = useState<DrawMode>('polygon');
  const [polygonMousePos, setPolygonMousePos] = useState<{ x: number; y: number } | null>(null);

  // Rectangle Mode States
  const [rectStage, setRectStage] = useState<RectStage>('idle');
  const [rectStart, setRectStart] = useState<{ x: number; y: number } | null>(null);
  const [rectCurrent, setRectCurrent] = useState<{ x: number; y: number } | null>(null);
  const [rectBounds, setRectBounds] = useState<{ minX: number; minY: number; maxX: number; maxY: number } | null>(null);
  const [activeResizeHandle, setActiveResizeHandle] = useState<ResizeHandle | null>(null);
  const [dragStartInfo, setDragStartInfo] = useState<{
    startX: number;
    startY: number;
    origBounds: { minX: number; minY: number; maxX: number; maxY: number };
  } | null>(null);
  const lastPolygonClickRef = useRef<number>(0);

  // Arrow Mode States
  const [arrowStage, setArrowStage] = useState<ArrowStage>('idle');
  const [arrowStart, setArrowStart] = useState<{ x: number; y: number } | null>(null);
  const [arrowEnd, setArrowEnd] = useState<{ x: number; y: number } | null>(null);
  const [arrowWidthScale, setArrowWidthScale] = useState<number>(1.0);
  const [activeArrowHandle, setActiveArrowHandle] = useState<ArrowHandle | null>(null);
  const [arrowDragInfo, setArrowDragInfo] = useState<{
    startX: number;
    startY: number;
    origStart: { x: number; y: number };
    origEnd: { x: number; y: number };
  } | null>(null);
  const lastFreehandClickRef = useRef<number>(0);

  // Adjust Mode States
  const [adjustBounds, setAdjustBounds] = useState<{ minX: number; minY: number; maxX: number; maxY: number } | null>(null);
  const [adjustedHotspots, setAdjustedHotspots] = useState<SpatialHotspot[]>([]);
  const [activeAdjustHandle, setActiveAdjustHandle] = useState<ResizeHandle | null>(null);
  const [adjustDragStart, setAdjustDragStart] = useState<{
    startX: number;
    startY: number;
    origBounds: { minX: number; minY: number; maxX: number; maxY: number };
    origHotspots: SpatialHotspot[];
  } | null>(null);

  const initAdjustMode = () => {
    if (hotspots.length === 0) return;
    const allPts = hotspots.flatMap(h => h.shape_points || []);
    if (allPts.length === 0) return;
    const minX = Math.min(...allPts.map(p => p.x));
    const maxX = Math.max(...allPts.map(p => p.x));
    const minY = Math.min(...allPts.map(p => p.y));
    const maxY = Math.max(...allPts.map(p => p.y));
    setAdjustBounds({ minX, minY, maxX, maxY });
    setAdjustedHotspots(JSON.parse(JSON.stringify(hotspots)));
  };

  const resetRectangleState = () => {
    setRectStage('idle');
    setRectStart(null);
    setRectCurrent(null);
    setRectBounds(null);
    setActiveResizeHandle(null);
    setDragStartInfo(null);
  };

  const resetArrowState = () => {
    setArrowStage('idle');
    setArrowStart(null);
    setArrowEnd(null);
    setActiveArrowHandle(null);
    setArrowDragInfo(null);
    setArrowWidthScale(1.0);
  };

  const computeArrowPoints = (
    start: { x: number; y: number },
    end: { x: number; y: number },
    widthScale: number = 1.0
  ): { x: number; y: number }[] => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    if (length < 0.005) return [];

    const ux = dx / length;
    const uy = dy / length;
    const nx = -uy;
    const ny = ux;

    const headLength = Math.min(length * 0.38, Math.max(0.025, length * 0.25));
    const baseHeadWidth = Math.min(headLength * 0.55, 0.045);
    const headHalfWidth = Math.max(0.008, Math.min(0.20, baseHeadWidth * widthScale));
    const shaftHalfWidth = Math.max(0.004, Math.min(0.12, headHalfWidth * 0.45));

    const bx = end.x - ux * headLength;
    const by = end.y - uy * headLength;

    const clampPt = (pt: { x: number; y: number }) => ({
      x: Math.max(0.002, Math.min(0.998, pt.x)),
      y: Math.max(0.002, Math.min(0.998, pt.y))
    });

    return [
      clampPt({ x: start.x - nx * shaftHalfWidth, y: start.y - ny * shaftHalfWidth }), // 0: tail bottom
      clampPt({ x: bx - nx * shaftHalfWidth, y: by - ny * shaftHalfWidth }),           // 1: shaft neck bottom
      clampPt({ x: bx - nx * headHalfWidth, y: by - ny * headHalfWidth }),             // 2: wing bottom
      clampPt({ x: end.x, y: end.y }),                                                 // 3: tip
      clampPt({ x: bx + nx * headHalfWidth, y: by + ny * headHalfWidth }),             // 4: wing top
      clampPt({ x: bx + nx * shaftHalfWidth, y: by + ny * shaftHalfWidth }),           // 5: shaft neck top
      clampPt({ x: start.x + nx * shaftHalfWidth, y: start.y + ny * shaftHalfWidth })  // 6: tail top
    ];
  };

  /**
   * Detects if a hotspot's polygon coordinates form an arrow shape,
   * so it can be rendered with yellow shading rather than the standard white frosted blur.
   */
  const isArrowShape = (points?: { x: number; y: number }[]): boolean => {
    if (!points || points.length !== 7) return false;
    
    // Midpoints of neck (P1 & P5) and wings (P2 & P4)
    const neckMidX = (points[1].x + points[5].x) / 2;
    const neckMidY = (points[1].y + points[5].y) / 2;
    const wingsMidX = (points[2].x + points[4].x) / 2;
    const wingsMidY = (points[2].y + points[4].y) / 2;
    
    const midDist = Math.hypot(neckMidX - wingsMidX, neckMidY - wingsMidY);
    if (midDist > 0.03) return false;

    const neckWidth = Math.hypot(points[5].x - points[1].x, points[5].y - points[1].y);
    const wingsWidth = Math.hypot(points[4].x - points[2].x, points[4].y - points[2].y);
    const tailWidth = Math.hypot(points[6].x - points[0].x, points[6].y - points[0].y);

    if (wingsWidth <= neckWidth * 1.1) return false;
    if (Math.abs(tailWidth - neckWidth) > Math.max(tailWidth, neckWidth) * 0.45 + 0.01) return false;

    return true;
  };

  // Reset mode when exiting edit
  useEffect(() => {
    if (!isEditing) {
      setDrawMode('polygon');
      setCurrentPoints([]);
      setIsDrawing(false);
      setPolygonMousePos(null);
      resetRectangleState();
      resetArrowState();
      setAdjustBounds(null);
      setAdjustedHotspots([]);
    }
  }, [isEditing]);

  // When reshaping a specific hotspot, reset drawing points & adjust bounds
  useEffect(() => {
    if (reshapingHotspot) {
      setDrawMode('polygon');
      setCurrentPoints([]);
      setIsDrawing(false);
      resetRectangleState();
      resetArrowState();
      setAdjustBounds(null);
      setAdjustedHotspots([]);
    }
  }, [reshapingHotspot]);

  // When moving a specific hotspot to this canvas, reset drawing points & adjust bounds
  useEffect(() => {
    if (movingHotspot) {
      setDrawMode('polygon');
      setCurrentPoints([]);
      setIsDrawing(false);
      resetRectangleState();
      resetArrowState();
      setAdjustBounds(null);
      setAdjustedHotspots([]);
    }
  }, [movingHotspot]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isEditing || !isOnline) return;
      if (drawMode === 'polygon') {
        if (e.key === 'Enter' && currentPoints.length > 2) {
          setIsDrawing(false);
          if (reshapingHotspot) {
            onConfirmReshape?.(reshapingHotspot.id, currentPoints);
            setCurrentPoints([]);
          } else if (movingHotspot) {
            onConfirmMoveHotspot?.(movingHotspot.hotspot.id, currentPoints);
            setCurrentPoints([]);
          } else {
            setShowConfig(true);
          }
          setPolygonMousePos(null);
        } else if (e.key === 'Escape') {
          setIsDrawing(false);
          setCurrentPoints([]);
          setPolygonMousePos(null);
          if (reshapingHotspot) {
            onCancelReshape?.();
          } else if (movingHotspot) {
            onCancelMoveHotspot?.();
          }
        }
      } else if (drawMode === 'rectangle') {
        if (e.key === 'Enter' && rectStage === 'resizing' && rectBounds) {
          e.preventDefault();
          const pts = [
            { x: rectBounds.minX, y: rectBounds.minY },
            { x: rectBounds.maxX, y: rectBounds.minY },
            { x: rectBounds.maxX, y: rectBounds.maxY },
            { x: rectBounds.minX, y: rectBounds.maxY }
          ];
          setCurrentPoints(pts);
          if (reshapingHotspot) {
            onConfirmReshape?.(reshapingHotspot.id, pts);
            resetRectangleState();
            setCurrentPoints([]);
          } else if (movingHotspot) {
            onConfirmMoveHotspot?.(movingHotspot.hotspot.id, pts);
            resetRectangleState();
            setCurrentPoints([]);
          } else {
            setShowConfig(true);
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          resetRectangleState();
          setCurrentPoints([]);
          setIsDrawing(false);
          if (reshapingHotspot) {
            onCancelReshape?.();
          } else if (movingHotspot) {
            onCancelMoveHotspot?.();
          }
        }
      } else if (drawMode === 'arrow') {
        if (e.key === 'Enter' && arrowStage === 'adjusting' && currentPoints.length > 0) {
          e.preventDefault();
          if (reshapingHotspot) {
            onConfirmReshape?.(reshapingHotspot.id, currentPoints);
            resetArrowState();
            setCurrentPoints([]);
          } else if (movingHotspot) {
            onConfirmMoveHotspot?.(movingHotspot.hotspot.id, currentPoints);
            resetArrowState();
            setCurrentPoints([]);
          } else {
            setShowConfig(true);
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          resetArrowState();
          setCurrentPoints([]);
          setIsDrawing(false);
          if (reshapingHotspot) {
            onCancelReshape?.();
          } else if (movingHotspot) {
            onCancelMoveHotspot?.();
          }
        }
      } else if (drawMode === 'adjust') {
        if (e.key === 'Escape') {
          setDrawMode('polygon');
          setAdjustBounds(null);
          setAdjustedHotspots([]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, isOnline, drawMode, currentPoints, rectStage, rectBounds, arrowStage, reshapingHotspot, movingHotspot, onConfirmReshape, onCancelReshape, onConfirmMoveHotspot, onCancelMoveHotspot]);

  const getNormalizedPoint = (e: React.PointerEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return { x, y };
  };

  // Polygon button click handlers supporting double-click toggle
  const handlePolygonButtonClick = () => {
    const now = Date.now();
    const diff = now - lastPolygonClickRef.current;
    lastPolygonClickRef.current = now;

    if (diff < 400) {
      // Double click detected -> enable Rectangle mode
      setDrawMode('rectangle');
      setCurrentPoints([]);
      setIsDrawing(false);
      setPolygonMousePos(null);
      resetRectangleState();
      return;
    }

    // Single click
    if (drawMode === 'rectangle') {
      // Toggle back to polygon
      setDrawMode('polygon');
      setCurrentPoints([]);
      setIsDrawing(false);
      setPolygonMousePos(null);
      resetRectangleState();
    } else {
      setDrawMode('polygon');
      setCurrentPoints([]);
      setIsDrawing(false);
      setPolygonMousePos(null);
      resetRectangleState();
    }
  };

  const handlePolygonButtonDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDrawMode('rectangle');
    setCurrentPoints([]);
    setIsDrawing(false);
    setPolygonMousePos(null);
    resetRectangleState();
    resetArrowState();
  };

  // Freehand button click handlers supporting double-click toggle for Arrow mode
  const handleFreehandButtonClick = () => {
    const now = Date.now();
    const diff = now - lastFreehandClickRef.current;
    lastFreehandClickRef.current = now;

    if (diff < 400) {
      // Double click detected -> toggle Arrow mode
      setDrawMode(drawMode === 'arrow' ? 'freehand' : 'arrow');
      setCurrentPoints([]);
      setIsDrawing(false);
      setPolygonMousePos(null);
      resetRectangleState();
      resetArrowState();
      return;
    }

    // Single click
    if (drawMode === 'arrow') {
      setDrawMode('freehand');
    } else {
      setDrawMode('freehand');
    }
    setCurrentPoints([]);
    setIsDrawing(false);
    setPolygonMousePos(null);
    resetRectangleState();
    resetArrowState();
  };

  const handleFreehandButtonDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDrawMode('arrow');
    setCurrentPoints([]);
    setIsDrawing(false);
    setPolygonMousePos(null);
    resetRectangleState();
    resetArrowState();
  };

  // Arrow resize and drag handlers
  const handleArrowResizeStart = (e: React.PointerEvent, handle: ArrowHandle) => {
    if (drawMode !== 'arrow' || arrowStage !== 'adjusting' || !arrowStart || !arrowEnd) return;
    e.preventDefault();
    e.stopPropagation();

    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setActiveArrowHandle(handle);
    const pt = getNormalizedPoint(e);
    setArrowDragInfo({
      startX: pt.x,
      startY: pt.y,
      origStart: { ...arrowStart },
      origEnd: { ...arrowEnd }
    });
  };

  const handleArrowResizeMove = (e: React.PointerEvent) => {
    if (!activeArrowHandle || !arrowDragInfo || !arrowStart || !arrowEnd) return;
    e.preventDefault();
    e.stopPropagation();

    const pt = getNormalizedPoint(e);
    const dx = pt.x - arrowDragInfo.startX;
    const dy = pt.y - arrowDragInfo.startY;

    let newStart = { ...arrowDragInfo.origStart };
    let newEnd = { ...arrowDragInfo.origEnd };

    if (activeArrowHandle === 'tip') {
      newEnd = {
        x: Math.max(0.002, Math.min(0.998, pt.x)),
        y: Math.max(0.002, Math.min(0.998, pt.y))
      };
      setArrowEnd(newEnd);
      const pts = computeArrowPoints(arrowStart, newEnd, arrowWidthScale);
      if (pts.length > 0) {
        setCurrentPoints(pts);
      }
    } else if (activeArrowHandle === 'tail') {
      newStart = {
        x: Math.max(0.002, Math.min(0.998, pt.x)),
        y: Math.max(0.002, Math.min(0.998, pt.y))
      };
      setArrowStart(newStart);
      const pts = computeArrowPoints(newStart, arrowEnd, arrowWidthScale);
      if (pts.length > 0) {
        setCurrentPoints(pts);
      }
    } else if (activeArrowHandle === 'body') {
      const clampDx = Math.max(-arrowDragInfo.origStart.x + 0.01, Math.min(0.99 - arrowDragInfo.origEnd.x, dx));
      const clampDy = Math.max(-arrowDragInfo.origStart.y + 0.01, Math.min(0.99 - arrowDragInfo.origEnd.y, dy));
      newStart = { x: arrowDragInfo.origStart.x + clampDx, y: arrowDragInfo.origStart.y + clampDy };
      newEnd = { x: arrowDragInfo.origEnd.x + clampDx, y: arrowDragInfo.origEnd.y + clampDy };
      setArrowStart(newStart);
      setArrowEnd(newEnd);
      const pts = computeArrowPoints(newStart, newEnd, arrowWidthScale);
      if (pts.length > 0) {
        setCurrentPoints(pts);
      }
    } else if (activeArrowHandle === 'width1' || activeArrowHandle === 'width2') {
      // Calculate perpendicular distance from pointer to arrow center line
      const adx = arrowEnd.x - arrowStart.x;
      const ady = arrowEnd.y - arrowStart.y;
      const length = Math.hypot(adx, ady);
      if (length > 0.005) {
        const nx = -ady / length;
        const ny = adx / length;
        const vpx = pt.x - arrowStart.x;
        const vpy = pt.y - arrowStart.y;
        const perpDist = Math.abs(vpx * nx + vpy * ny);

        const headLength = Math.min(length * 0.38, Math.max(0.025, length * 0.25));
        const baseHeadWidth = Math.min(headLength * 0.55, 0.045);
        if (baseHeadWidth > 0.001) {
          const newScale = Math.max(0.3, Math.min(3.5, Number((perpDist / baseHeadWidth).toFixed(2))));
          setArrowWidthScale(newScale);
          const pts = computeArrowPoints(arrowStart, arrowEnd, newScale);
          if (pts.length > 0) {
            setCurrentPoints(pts);
          }
        }
      }
    }
  };

  const handleAdjustArrowWidth = (delta: number) => {
    if (!arrowStart || !arrowEnd) return;
    const newScale = Math.max(0.3, Math.min(3.5, Number((arrowWidthScale + delta).toFixed(2))));
    setArrowWidthScale(newScale);
    const pts = computeArrowPoints(arrowStart, arrowEnd, newScale);
    if (pts.length > 0) {
      setCurrentPoints(pts);
    }
  };

  const handleArrowResizeEnd = (e: React.PointerEvent) => {
    if (!activeArrowHandle) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch {}
    setActiveArrowHandle(null);
    setArrowDragInfo(null);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isEditing || !isOnline || drawMode === 'delete' || drawMode === 'edit' || drawMode === 'adjust') return;
    
    if (drawMode === 'freehand') {
      e.preventDefault();
      containerRef.current?.setPointerCapture(e.pointerId);
      setIsDrawing(true);
      setCurrentPoints([getNormalizedPoint(e)]);
    } else if (drawMode === 'polygon') {
      e.preventDefault();
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
          if (reshapingHotspot) {
            onConfirmReshape?.(reshapingHotspot.id, currentPoints);
            setCurrentPoints([]);
          } else if (movingHotspot) {
            onConfirmMoveHotspot?.(movingHotspot.hotspot.id, currentPoints);
            setCurrentPoints([]);
          } else {
            setShowConfig(true);
          }
          setPolygonMousePos(null);
        } else {
          setCurrentPoints([...currentPoints, pt]);
        }
      }
    } else if (drawMode === 'rectangle') {
      // Only start drawing on pointerdown if idle (do not reset if in resizing stage!)
      if (rectStage === 'idle') {
        e.preventDefault();
        const pt = getNormalizedPoint(e);
        containerRef.current?.setPointerCapture(e.pointerId);
        setRectStart(pt);
        setRectCurrent(pt);
        setRectStage('drawing');
        setIsDrawing(true);
        setCurrentPoints([]);
        setRectBounds(null);
      }
    } else if (drawMode === 'arrow') {
      if (arrowStage === 'idle') {
        e.preventDefault();
        const pt = getNormalizedPoint(e);
        containerRef.current?.setPointerCapture(e.pointerId);
        setArrowStart(pt);
        setArrowEnd(pt);
        setArrowStage('drawing');
        setIsDrawing(true);
        setCurrentPoints([]);
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isEditing || !isOnline || drawMode === 'delete' || drawMode === 'edit') return;
    if (drawMode === 'adjust') {
      if (activeAdjustHandle) {
        handleAdjustMove(e);
      }
      return;
    }
    if (drawMode === 'freehand') {
      if (!isDrawing) return;
      e.preventDefault();
      setCurrentPoints((prev) => [...prev, getNormalizedPoint(e)]);
    } else if (drawMode === 'polygon') {
      if (!isDrawing) return;
      e.preventDefault();
      setPolygonMousePos(getNormalizedPoint(e));
    } else if (drawMode === 'rectangle') {
      if (rectStage === 'drawing' && isDrawing) {
        e.preventDefault();
        setRectCurrent(getNormalizedPoint(e));
      } else if (rectStage === 'resizing' && activeResizeHandle) {
        handleResizeMove(e);
      }
    } else if (drawMode === 'arrow') {
      if (arrowStage === 'drawing' && isDrawing && arrowStart) {
        e.preventDefault();
        const pt = getNormalizedPoint(e);
        setArrowEnd(pt);
        const pts = computeArrowPoints(arrowStart, pt, arrowWidthScale);
        if (pts.length > 0) {
          setCurrentPoints(pts);
        }
      } else if (arrowStage === 'adjusting' && activeArrowHandle) {
        handleArrowResizeMove(e);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isEditing || !isOnline) return;
    if (drawMode === 'adjust') {
      if (activeAdjustHandle) {
        handleAdjustResizeEnd(e);
      }
      return;
    }
    if (drawMode === 'freehand') {
      if (!isDrawing) return;
      e.preventDefault();
      containerRef.current?.releasePointerCapture(e.pointerId);
      setIsDrawing(false);
      
      if (currentPoints.length > 3) {
        if (reshapingHotspot) {
          onConfirmReshape?.(reshapingHotspot.id, currentPoints);
          setCurrentPoints([]);
        } else if (movingHotspot) {
          onConfirmMoveHotspot?.(movingHotspot.hotspot.id, currentPoints);
          setCurrentPoints([]);
        } else {
          setShowConfig(true);
        }
      } else {
        setCurrentPoints([]);
      }
    } else if (drawMode === 'rectangle') {
      if (rectStage === 'drawing' && isDrawing && rectStart && rectCurrent) {
        e.preventDefault();
        try {
          containerRef.current?.releasePointerCapture(e.pointerId);
        } catch {}
        setIsDrawing(false);

        const minX = Math.max(0, Math.min(1, Math.min(rectStart.x, rectCurrent.x)));
        const maxX = Math.max(0, Math.min(1, Math.max(rectStart.x, rectCurrent.x)));
        const minY = Math.max(0, Math.min(1, Math.min(rectStart.y, rectCurrent.y)));
        const maxY = Math.max(0, Math.min(1, Math.max(rectStart.y, rectCurrent.y)));

        if (maxX - minX > 0.015 && maxY - minY > 0.015) {
          const bounds = { minX, minY, maxX, maxY };
          setRectBounds(bounds);
          const pts = [
            { x: minX, y: minY },
            { x: maxX, y: minY },
            { x: maxX, y: maxY },
            { x: minX, y: maxY }
          ];
          setCurrentPoints(pts);
          setRectStage('resizing');
        } else {
          resetRectangleState();
          setCurrentPoints([]);
        }
      }
    } else if (drawMode === 'arrow') {
      if (arrowStage === 'drawing' && isDrawing && arrowStart && arrowEnd) {
        e.preventDefault();
        try {
          containerRef.current?.releasePointerCapture(e.pointerId);
        } catch {}
        setIsDrawing(false);

        const dist = Math.hypot(arrowEnd.x - arrowStart.x, arrowEnd.y - arrowStart.y);
        if (dist > 0.02) {
          const pts = computeArrowPoints(arrowStart, arrowEnd, arrowWidthScale);
          if (pts.length > 0) {
            setCurrentPoints(pts);
            setArrowStage('adjusting');
          } else {
            resetArrowState();
            setCurrentPoints([]);
          }
        } else {
          resetArrowState();
          setCurrentPoints([]);
        }
      }
    }
  };

  // Edge and Corner Resize Handlers (exclusive to rectangle mode)
  const handleResizeStart = (e: React.PointerEvent, handle: ResizeHandle) => {
    if (drawMode !== 'rectangle' || rectStage !== 'resizing' || !rectBounds) return;
    e.preventDefault();
    e.stopPropagation();
    
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setActiveResizeHandle(handle);
    const pt = getNormalizedPoint(e);
    setDragStartInfo({
      startX: pt.x,
      startY: pt.y,
      origBounds: { ...rectBounds }
    });
  };

  const handleResizeMove = (e: React.PointerEvent) => {
    if (!activeResizeHandle || !dragStartInfo || !rectBounds) return;
    e.preventDefault();
    e.stopPropagation();
    const pt = getNormalizedPoint(e);
    const dx = pt.x - dragStartInfo.startX;
    const dy = pt.y - dragStartInfo.startY;
    const orig = dragStartInfo.origBounds;
    
    let newMinX = orig.minX;
    let newMaxX = orig.maxX;
    let newMinY = orig.minY;
    let newMaxY = orig.maxY;

    const MIN_SIZE = 0.015;

    switch (activeResizeHandle) {
      case 'top':
        newMinY = Math.max(0, Math.min(orig.maxY - MIN_SIZE, orig.minY + dy));
        break;
      case 'bottom':
        newMaxY = Math.min(1, Math.max(orig.minY + MIN_SIZE, orig.maxY + dy));
        break;
      case 'left':
        newMinX = Math.max(0, Math.min(orig.maxX - MIN_SIZE, orig.minX + dx));
        break;
      case 'right':
        newMaxX = Math.min(1, Math.max(orig.minX + MIN_SIZE, orig.maxX + dx));
        break;
      case 'tl':
        newMinX = Math.max(0, Math.min(orig.maxX - MIN_SIZE, orig.minX + dx));
        newMinY = Math.max(0, Math.min(orig.maxY - MIN_SIZE, orig.minY + dy));
        break;
      case 'tr':
        newMaxX = Math.min(1, Math.max(orig.minX + MIN_SIZE, orig.maxX + dx));
        newMinY = Math.max(0, Math.min(orig.maxY - MIN_SIZE, orig.minY + dy));
        break;
      case 'bl':
        newMinX = Math.max(0, Math.min(orig.maxX - MIN_SIZE, orig.minX + dx));
        newMaxY = Math.min(1, Math.max(orig.minY + MIN_SIZE, orig.maxY + dy));
        break;
      case 'br':
        newMaxX = Math.min(1, Math.max(orig.minX + MIN_SIZE, orig.maxX + dx));
        newMaxY = Math.min(1, Math.max(orig.minY + MIN_SIZE, orig.maxY + dy));
        break;
      case 'move': {
        const width = orig.maxX - orig.minX;
        const height = orig.maxY - orig.minY;
        let clampedDx = dx;
        let clampedDy = dy;
        if (orig.minX + clampedDx < 0) clampedDx = -orig.minX;
        if (orig.maxX + clampedDx > 1) clampedDx = 1 - orig.maxX;
        if (orig.minY + clampedDy < 0) clampedDy = -orig.minY;
        if (orig.maxY + clampedDy > 1) clampedDy = 1 - orig.maxY;
        newMinX = orig.minX + clampedDx;
        newMaxX = orig.maxX + clampedDx;
        newMinY = orig.minY + clampedDy;
        newMaxY = orig.maxY + clampedDy;
        break;
      }
    }

    const updatedBounds = { minX: newMinX, minY: newMinY, maxX: newMaxX, maxY: newMaxY };
    setRectBounds(updatedBounds);
    setCurrentPoints([
      { x: newMinX, y: newMinY },
      { x: newMaxX, y: newMinY },
      { x: newMaxX, y: newMaxY },
      { x: newMinX, y: newMaxY }
    ]);
  };

  const handleResizeEnd = (e: React.PointerEvent) => {
    if (activeResizeHandle) {
      e.preventDefault();
      e.stopPropagation();
      try {
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
      } catch {}
      setActiveResizeHandle(null);
      setDragStartInfo(null);
    }
  };

  // Adjust Mode Handlers
  const handleAdjustResizeStart = (e: React.PointerEvent, handle: ResizeHandle) => {
    if (drawMode !== 'adjust' || !adjustBounds) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setActiveAdjustHandle(handle);
    const pt = getNormalizedPoint(e);
    setAdjustDragStart({
      startX: pt.x,
      startY: pt.y,
      origBounds: { ...adjustBounds },
      origHotspots: JSON.parse(JSON.stringify(adjustedHotspots))
    });
  };

  const handleAdjustMove = (e: React.PointerEvent) => {
    if (!activeAdjustHandle || !adjustDragStart || !adjustBounds) return;
    e.preventDefault();
    e.stopPropagation();
    const pt = getNormalizedPoint(e);
    const dx = pt.x - adjustDragStart.startX;
    const dy = pt.y - adjustDragStart.startY;
    const orig = adjustDragStart.origBounds;

    let newMinX = orig.minX;
    let newMaxX = orig.maxX;
    let newMinY = orig.minY;
    let newMaxY = orig.maxY;

    const MIN_SIZE = 0.02;

    switch (activeAdjustHandle) {
      case 'top':
        newMinY = Math.max(0.005, Math.min(orig.maxY - MIN_SIZE, orig.minY + dy));
        break;
      case 'bottom':
        newMaxY = Math.min(0.995, Math.max(orig.minY + MIN_SIZE, orig.maxY + dy));
        break;
      case 'left':
        newMinX = Math.max(0.005, Math.min(orig.maxX - MIN_SIZE, orig.minX + dx));
        break;
      case 'right':
        newMaxX = Math.min(0.995, Math.max(orig.minX + MIN_SIZE, orig.maxX + dx));
        break;
      case 'tl':
        newMinX = Math.max(0.005, Math.min(orig.maxX - MIN_SIZE, orig.minX + dx));
        newMinY = Math.max(0.005, Math.min(orig.maxY - MIN_SIZE, orig.minY + dy));
        break;
      case 'tr':
        newMaxX = Math.min(0.995, Math.max(orig.minX + MIN_SIZE, orig.maxX + dx));
        newMinY = Math.max(0.005, Math.min(orig.maxY - MIN_SIZE, orig.minY + dy));
        break;
      case 'bl':
        newMinX = Math.max(0.005, Math.min(orig.maxX - MIN_SIZE, orig.minX + dx));
        newMaxY = Math.min(0.995, Math.max(orig.minY + MIN_SIZE, orig.maxY + dy));
        break;
      case 'br':
        newMaxX = Math.min(0.995, Math.max(orig.minX + MIN_SIZE, orig.maxX + dx));
        newMaxY = Math.min(0.995, Math.max(orig.minY + MIN_SIZE, orig.maxY + dy));
        break;
      case 'move': {
        let clampedDx = dx;
        let clampedDy = dy;
        if (orig.minX + clampedDx < 0.005) clampedDx = 0.005 - orig.minX;
        if (orig.maxX + clampedDx > 0.995) clampedDx = 0.995 - orig.maxX;
        if (orig.minY + clampedDy < 0.005) clampedDy = 0.005 - orig.minY;
        if (orig.maxY + clampedDy > 0.995) clampedDy = 0.995 - orig.maxY;
        newMinX = orig.minX + clampedDx;
        newMaxX = orig.maxX + clampedDx;
        newMinY = orig.minY + clampedDy;
        newMaxY = orig.maxY + clampedDy;
        break;
      }
    }

    const updatedBounds = { minX: newMinX, minY: newMinY, maxX: newMaxX, maxY: newMaxY };
    setAdjustBounds(updatedBounds);

    const origW = orig.maxX - orig.minX || 1;
    const origH = orig.maxY - orig.minY || 1;
    const newW = newMaxX - newMinX;
    const newH = newMaxY - newMinY;

    const remapped = adjustDragStart.origHotspots.map(hs => {
      const updatedPts = (hs.shape_points || []).map(p => {
        if (activeAdjustHandle === 'move') {
          const moveDx = newMinX - orig.minX;
          const moveDy = newMinY - orig.minY;
          return {
            x: Math.max(0.005, Math.min(0.995, p.x + moveDx)),
            y: Math.max(0.005, Math.min(0.995, p.y + moveDy))
          };
        } else {
          const relX = (p.x - orig.minX) / origW;
          const relY = (p.y - orig.minY) / origH;
          return {
            x: Math.max(0.005, Math.min(0.995, newMinX + relX * newW)),
            y: Math.max(0.005, Math.min(0.995, newMinY + relY * newH))
          };
        }
      });
      return { ...hs, shape_points: updatedPts };
    });

    setAdjustedHotspots(remapped);
  };

  const handleAdjustResizeEnd = (e: React.PointerEvent) => {
    if (activeAdjustHandle) {
      e.preventDefault();
      e.stopPropagation();
      try {
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
      } catch {}
      setActiveAdjustHandle(null);
      setAdjustDragStart(null);
    }
  };

  const handleScaleToFitAll = () => {
    if (!adjustBounds || adjustedHotspots.length === 0) return;
    const orig = adjustBounds;
    const origW = orig.maxX - orig.minX || 1;
    const origH = orig.maxY - orig.minY || 1;

    const TARGET_MIN = 0.04;
    const TARGET_MAX = 0.96;
    const targetW = TARGET_MAX - TARGET_MIN;
    const targetH = TARGET_MAX - TARGET_MIN;

    const scale = Math.min(targetW / origW, targetH / origH);
    const fittedW = origW * scale;
    const fittedH = origH * scale;
    const newMinX = 0.5 - fittedW / 2;
    const newMaxX = newMinX + fittedW;
    const newMinY = 0.5 - fittedH / 2;
    const newMaxY = newMinY + fittedH;

    const newBounds = { minX: newMinX, minY: newMinY, maxX: newMaxX, maxY: newMaxY };
    setAdjustBounds(newBounds);

    const remapped = adjustedHotspots.map(hs => {
      const updatedPts = (hs.shape_points || []).map(p => {
        const relX = (p.x - orig.minX) / origW;
        const relY = (p.y - orig.minY) / origH;
        return {
          x: Math.max(0.005, Math.min(0.995, newMinX + relX * fittedW)),
          y: Math.max(0.005, Math.min(0.995, newMinY + relY * fittedH))
        };
      });
      return { ...hs, shape_points: updatedPts };
    });
    setAdjustedHotspots(remapped);
  };

  const handleCenterAll = () => {
    if (!adjustBounds || adjustedHotspots.length === 0) return;
    const orig = adjustBounds;
    const curW = orig.maxX - orig.minX;
    const curH = orig.maxY - orig.minY;
    const newMinX = Math.max(0.005, (1 - curW) / 2);
    const newMaxX = newMinX + curW;
    const newMinY = Math.max(0.005, (1 - curH) / 2);
    const newMaxY = newMinY + curH;
    const dx = newMinX - orig.minX;
    const dy = newMinY - orig.minY;

    setAdjustBounds({ minX: newMinX, minY: newMinY, maxX: newMaxX, maxY: newMaxY });

    const remapped = adjustedHotspots.map(hs => {
      const updatedPts = (hs.shape_points || []).map(p => ({
        x: Math.max(0.005, Math.min(0.995, p.x + dx)),
        y: Math.max(0.005, Math.min(0.995, p.y + dy))
      }));
      return { ...hs, shape_points: updatedPts };
    });
    setAdjustedHotspots(remapped);
  };

  const handleApplyAdjustments = () => {
    if (adjustedHotspots.length > 0 && onBatchUpdateHotspots) {
      const updates = adjustedHotspots.map(h => ({
        id: h.id,
        shape_points: h.shape_points
      }));
      onBatchUpdateHotspots(updates);
    }
    setDrawMode('polygon');
    setAdjustBounds(null);
    setAdjustedHotspots([]);
  };

  const handleCancelAdjustments = () => {
    setDrawMode('polygon');
    setAdjustBounds(null);
    setAdjustedHotspots([]);
  };

  const toPolygonString = (points: { x: number; y: number }[]) => {
    return points.map(p => `${p.x * 100},${p.y * 100}`).join(" ");
  };

  const isDeleteMode = isEditing && drawMode === 'delete';
  const isEditMode = isEditing && drawMode === 'edit';
  const hoveredHotspot = hotspots.find(h => h.id === hoveredHotspotId);

  return (
    <div className="relative w-full flex flex-col bg-[#0f0e0c] border border-[#332f2a] rounded-lg overflow-hidden">
      {/* Edit Mode Top Toolbar & Guidance Bar (completely outside the image box) */}
      {isEditing && (
        <div className="w-full bg-[#141211] border-b border-[#332f2a] px-3 py-2 sm:px-4 flex flex-wrap items-center justify-between gap-2.5 z-20 shrink-0 shadow-md">
          {/* Left: Tool Selectors */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-brand-text-muted uppercase tracking-widest font-bold px-1 hidden sm:inline">
              Tool:
            </span>
            <button 
              type="button"
              onClick={handlePolygonButtonClick}
              onDoubleClick={handlePolygonButtonDoubleClick}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-all ${
                drawMode === 'rectangle'
                  ? 'bg-gradient-to-r from-brand-accent to-amber-600 text-white shadow-md ring-1 ring-amber-400/50'
                  : drawMode === 'polygon' 
                    ? 'bg-brand-accent text-white shadow-sm' 
                    : 'text-brand-text-muted hover:text-white hover:bg-[#252320]'
              }`}
              title={
                drawMode === 'rectangle'
                  ? "Rectangle Mode Active (Click to switch to Polygon, or double-click to toggle)"
                  : "Polygon Tool (Double-click to activate Rectangle mode)"
              }
            >
              <span>Polygon</span>
              {drawMode === 'rectangle' && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/40 text-amber-200 border border-amber-400/40">
                  Rect ⬚
                </span>
              )}
            </button>
            <button 
              type="button"
              onClick={handleFreehandButtonClick}
              onDoubleClick={handleFreehandButtonDoubleClick}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-all ${
                drawMode === 'arrow' 
                  ? 'bg-gradient-to-r from-amber-600 to-yellow-600 text-white shadow-md ring-1 ring-yellow-400/50' 
                  : drawMode === 'freehand' 
                    ? 'bg-brand-accent text-white shadow-sm' 
                    : 'text-brand-text-muted hover:text-white hover:bg-[#252320]'
              }`}
              title={
                drawMode === 'arrow'
                  ? "Arrow Mode Active (Click to switch to Freehand, or double-click to toggle)"
                  : "Freehand Tool (Double-click to activate Arrow mode)"
              }
            >
              <span>Freehand</span>
              {drawMode === 'arrow' && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/40 text-amber-200 border border-amber-400/40">
                  Arrow ➔
                </span>
              )}
            </button>
          </div>

          {/* Right: Contextual Status, Guidance & Quick Action Buttons */}
          <div className="flex items-center gap-2">
            {reshapingHotspot && (
              <div className="bg-sky-950/90 text-sky-200 border border-sky-600/70 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-2 shadow-sm animate-pulse">
                <Crop className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                <span>
                  Redrawing shape for <strong>&quot;{reshapingHotspot.label}&quot;</strong> — draw new outline with Polygon, Rect, Arrow, or Freehand.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPoints([]);
                    setIsDrawing(false);
                    resetRectangleState();
                    resetArrowState();
                    onCancelReshape?.();
                  }}
                  className="ml-2 px-2 py-0.5 bg-[#252320] hover:bg-[#332f2a] text-white text-[11px] rounded border border-sky-400/40"
                >
                  Cancel Redraw
                </button>
              </div>
            )}

            {movingHotspot && (
              <div className="bg-purple-950/90 text-purple-200 border border-purple-600/70 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-2 shadow-sm animate-pulse">
                <ArrowRightLeft className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                <span>
                  Moving <strong>&quot;{movingHotspot.hotspot.label}&quot;</strong> to this view — Draw new boundary outline with Polygon, Rect, Arrow, or Freehand.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPoints([]);
                    setIsDrawing(false);
                    resetRectangleState();
                    resetArrowState();
                    onCancelMoveHotspot?.();
                  }}
                  className="ml-2 px-2 py-0.5 bg-[#252320] hover:bg-[#332f2a] text-white text-[11px] rounded border border-purple-400/40"
                >
                  Cancel Move
                </button>
              </div>
            )}

            {drawMode === 'adjust' && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="bg-sky-950/80 text-sky-200 border border-sky-600/60 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-sm">
                  <Sliders className="h-3.5 w-3.5 text-sky-400" />
                  <span>Adjusting {adjustedHotspots.length} hotspots — Drag box or handles to move/scale</span>
                </div>
                <button
                  type="button"
                  onClick={handleScaleToFitAll}
                  className="flex items-center gap-1 px-2.5 py-1 bg-[#252320] hover:bg-[#332f2a] text-sky-300 hover:text-white text-xs font-medium rounded border border-[#332f2a] transition-colors"
                  title="Scale hotspots proportionally to fit canvas bounds"
                >
                  <span>Fit to Canvas</span>
                </button>
                <button
                  type="button"
                  onClick={handleCenterAll}
                  className="flex items-center gap-1 px-2.5 py-1 bg-[#252320] hover:bg-[#332f2a] text-sky-300 hover:text-white text-xs font-medium rounded border border-[#332f2a] transition-colors"
                  title="Center all hotspots horizontally and vertically"
                >
                  <span>Center</span>
                </button>
                <button
                  type="button"
                  onClick={handleApplyAdjustments}
                  className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded shadow transition-colors"
                  title="Save new positions for all hotspots"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Save Adjustments</span>
                </button>
                <button
                  type="button"
                  onClick={handleCancelAdjustments}
                  className="flex items-center gap-1 px-2.5 py-1 bg-[#2a2724] hover:bg-[#383430] text-brand-text-muted hover:text-white text-xs font-medium rounded transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Cancel</span>
                </button>
              </div>
            )}

            {drawMode === 'edit' && (
              <div className="bg-amber-950/80 text-amber-200 border border-amber-700/60 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-sm">
                <Edit2 className="h-3.5 w-3.5 text-amber-400" />
                <span>
                  {hoveredHotspot 
                    ? hoveredHotspot.child_photo_id 
                      ? `"${hoveredHotspot.label}" already has a saved image (cannot edit type)` 
                      : `Click to edit "${hoveredHotspot.label}"` 
                    : "Click on any unsaved image hotspot to edit its name & type"}
                </span>
              </div>
            )}

            {drawMode === 'delete' && (
              <div className="bg-red-950/80 text-red-200 border border-red-700/60 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-sm">
                <Trash2 className="h-3.5 w-3.5 text-red-400" />
                <span>
                  {hoveredHotspot 
                    ? `Click to delete "${hoveredHotspot.label}"` 
                    : "Click on any highlighted hotspot to delete it"}
                </span>
              </div>
            )}

            {drawMode === 'rectangle' && (
              <div className="flex items-center gap-2">
                <div className="bg-amber-950/80 text-amber-200 border border-amber-600/60 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-2 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>
                    {rectStage === 'idle'
                      ? "Click & drag diagonally on image to draw hotspot"
                      : rectStage === 'drawing'
                        ? "Release pointer to complete diagonal"
                        : "Drag edges or corners to resize. Press Enter or Confirm to save."}
                  </span>
                </div>

                {rectStage === 'resizing' && rectBounds && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        const pts = [
                          { x: rectBounds.minX, y: rectBounds.minY },
                          { x: rectBounds.maxX, y: rectBounds.minY },
                          { x: rectBounds.maxX, y: rectBounds.maxY },
                          { x: rectBounds.minX, y: rectBounds.maxY }
                        ];
                        if (reshapingHotspot) {
                          onConfirmReshape?.(reshapingHotspot.id, pts);
                          resetRectangleState();
                          setCurrentPoints([]);
                        } else if (movingHotspot) {
                          onConfirmMoveHotspot?.(movingHotspot.hotspot.id, pts);
                          resetRectangleState();
                          setCurrentPoints([]);
                        } else {
                          setCurrentPoints(pts);
                          setShowConfig(true);
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded shadow transition-colors"
                      title="Confirm rectangle hotspot (Enter)"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Confirm Hotspot</span>
                    </button>
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        resetRectangleState();
                        setCurrentPoints([]);
                        setIsDrawing(false);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 bg-[#2a2724] hover:bg-[#383430] text-brand-text-muted hover:text-white text-xs font-medium rounded transition-colors"
                      title="Cancel and redraw (Esc)"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Redraw</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {drawMode === 'arrow' && (
              <div className="flex items-center gap-2">
                <div className="bg-amber-950/80 text-amber-200 border border-amber-600/60 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-2 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>
                    {arrowStage === 'idle'
                      ? "Click & drag on image to draw yellow arrow"
                      : arrowStage === 'drawing'
                        ? "Release pointer to set arrow"
                        : "Drag tip/tail to aim, wings or +/- for width. Enter to confirm."}
                  </span>
                </div>

                {arrowStage === 'adjusting' && currentPoints.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    {/* Width adjustment buttons */}
                    <div className="flex items-center gap-1 bg-[#252320] border border-[#3d3832] rounded px-1.5 py-0.5 text-xs text-amber-200 shadow-sm">
                      <span className="text-[11px] font-semibold text-amber-300/90">Width:</span>
                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAdjustArrowWidth(-0.25);
                        }}
                        className="w-5 h-5 flex items-center justify-center rounded bg-[#332f2a] hover:bg-[#443f38] text-white text-xs font-bold transition-colors"
                        title="Decrease arrow width (-)"
                      >
                        -
                      </button>
                      <span className="text-[10px] font-mono px-1 font-bold text-amber-100 min-w-[28px] text-center">
                        {Math.round(arrowWidthScale * 100)}%
                      </span>
                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAdjustArrowWidth(0.25);
                        }}
                        className="w-5 h-5 flex items-center justify-center rounded bg-[#332f2a] hover:bg-[#443f38] text-white text-xs font-bold transition-colors"
                        title="Increase arrow width (+)"
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (reshapingHotspot) {
                          onConfirmReshape?.(reshapingHotspot.id, currentPoints);
                          resetArrowState();
                          setCurrentPoints([]);
                        } else if (movingHotspot) {
                          onConfirmMoveHotspot?.(movingHotspot.hotspot.id, currentPoints);
                          resetArrowState();
                          setCurrentPoints([]);
                        } else {
                          setShowConfig(true);
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded shadow transition-colors"
                      title="Confirm arrow hotspot (Enter)"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Confirm Hotspot</span>
                    </button>
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        resetArrowState();
                        setCurrentPoints([]);
                        setIsDrawing(false);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 bg-[#2a2724] hover:bg-[#383430] text-brand-text-muted hover:text-white text-xs font-medium rounded transition-colors"
                      title="Cancel and redraw (Esc)"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Redraw</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {drawMode === 'polygon' && (
              <div className="text-xs text-brand-text-muted hidden sm:flex items-center gap-1.5 font-medium">
                <span>Click to place vertices. Click start point or press <kbd className="bg-[#252320] px-1.5 py-0.5 rounded border border-[#332f2a] text-[10px] text-white font-mono">Enter</kbd> to close.</span>
              </div>
            )}

            {drawMode === 'freehand' && (
              <div className="text-xs text-brand-text-muted hidden sm:flex items-center gap-1.5 font-medium">
                <span>Click & drag on image to trace boundary.</span>
              </div>
            )}
          </div>

          {/* Right Corner: Minimized Action Icons */}
          <div className="flex items-center gap-1 shrink-0 ml-auto">
            <div className="h-4 w-px bg-[#332f2a] mx-1 hidden sm:block" />
            <button 
              type="button"
              onClick={() => { 
                if (drawMode === 'adjust') {
                  setDrawMode('polygon');
                  setAdjustBounds(null);
                  setAdjustedHotspots([]);
                } else {
                  setDrawMode('adjust');
                  setCurrentPoints([]);
                  setIsDrawing(false);
                  setPolygonMousePos(null);
                  resetRectangleState();
                  initAdjustMode();
                }
              }}
              disabled={hotspots.length === 0}
              className={`h-8 w-8 inline-flex items-center justify-center rounded-md transition-colors ${
                drawMode === 'adjust' 
                  ? 'bg-sky-600 text-white shadow-md' 
                  : 'text-sky-400 hover:text-sky-300 hover:bg-sky-500/15 disabled:opacity-30 disabled:pointer-events-none'
              }`}
              title="Adjust Hotspots"
              aria-label="Adjust Hotspots"
            >
              <Sliders className="h-4 w-4" />
            </button>

            <button 
              type="button"
              onClick={() => { 
                setDrawMode(drawMode === 'edit' ? 'polygon' : 'edit'); 
                setCurrentPoints([]); 
                setIsDrawing(false); 
                setPolygonMousePos(null);
                resetRectangleState();
              }}
              className={`h-8 w-8 inline-flex items-center justify-center rounded-md transition-colors ${
                drawMode === 'edit' 
                  ? 'bg-amber-600 text-white shadow-md' 
                  : 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/15'
              }`}
              title="Edit Hotspot"
              aria-label="Edit Hotspot"
            >
              <Edit2 className="h-4 w-4" />
            </button>

            <button 
              type="button"
              onClick={() => { 
                setDrawMode(drawMode === 'delete' ? 'polygon' : 'delete'); 
                setCurrentPoints([]); 
                setIsDrawing(false); 
                setPolygonMousePos(null);
                resetRectangleState();
              }}
              className={`h-8 w-8 inline-flex items-center justify-center rounded-md transition-colors ${
                drawMode === 'delete' 
                  ? 'bg-red-600 text-white shadow-md' 
                  : 'text-red-400 hover:text-red-300 hover:bg-red-500/15'
              }`}
              title="Delete Hotspot"
              aria-label="Delete Hotspot"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Image Canvas Area (purely dedicated to image display & drawing) */}
      <div className="flex-1 w-full min-h-[500px] flex items-center justify-center overflow-auto p-2 sm:p-4 bg-[#0a0908]">
        <div 
          ref={containerRef}
          className={`relative inline-block touch-none select-none max-w-full ${
            isEditing 
              ? (drawMode === 'delete' || drawMode === 'edit' ? 'cursor-pointer' : 'cursor-crosshair') 
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
          {/* Adjust Mode: Collective Hotspot Polygons & Collective Bounding Box */}
          {drawMode === 'adjust' && (
            <>
              {adjustedHotspots.map((hs) => (
                <polygon
                  key={`adj-${hs.id}`}
                  points={hs.shape_points.map((p) => `${p.x * 100},${p.y * 100}`).join(" ")}
                  fill="rgba(56, 189, 248, 0.25)"
                  stroke="#38bdf8"
                  strokeWidth="0.5"
                  strokeDasharray="2,2"
                  className="pointer-events-none"
                />
              ))}

              {adjustBounds && (() => {
                const minX = adjustBounds.minX * 100;
                const maxX = adjustBounds.maxX * 100;
                const minY = adjustBounds.minY * 100;
                const maxY = adjustBounds.maxY * 100;
                const w = maxX - minX;
                const h = maxY - minY;
                const midX = (minX + maxX) / 2;
                const midY = (minY + maxY) / 2;

                return (
                  <g className="adjust-editor-group">
                    {/* Draggable collective bounding box */}
                    <rect 
                      x={minX} 
                      y={minY} 
                      width={w} 
                      height={h} 
                      className="fill-sky-500/10 stroke-sky-400 stroke-[0.5] cursor-move pointer-events-auto"
                      strokeDasharray="2,2"
                      onPointerDown={(e) => handleAdjustResizeStart(e, 'move')}
                      onPointerMove={handleAdjustMove}
                      onPointerUp={handleAdjustResizeEnd}
                    />

                    {/* Top Edge */}
                    <line x1={minX} y1={minY} x2={maxX} y2={minY} stroke="#38bdf8" strokeWidth="0.5" className="pointer-events-none" />
                    <line 
                      x1={minX} y1={minY} x2={maxX} y2={minY} 
                      stroke="transparent" strokeWidth="4" 
                      className="cursor-ns-resize pointer-events-auto"
                      onPointerDown={(e) => handleAdjustResizeStart(e, 'top')}
                      onPointerMove={handleAdjustMove}
                      onPointerUp={handleAdjustResizeEnd}
                    />
                    <circle 
                      cx={midX} cy={minY} r="1.1" 
                      fill="#ffffff" stroke="#0284c7" strokeWidth="0.35" 
                      className="cursor-ns-resize pointer-events-auto shadow hover:scale-125 transition-transform"
                      onPointerDown={(e) => handleAdjustResizeStart(e, 'top')}
                      onPointerMove={handleAdjustMove}
                      onPointerUp={handleAdjustResizeEnd}
                    />

                    {/* Bottom Edge */}
                    <line x1={minX} y1={maxY} x2={maxX} y2={maxY} stroke="#38bdf8" strokeWidth="0.5" className="pointer-events-none" />
                    <line 
                      x1={minX} y1={maxY} x2={maxX} y2={maxY} 
                      stroke="transparent" strokeWidth="4" 
                      className="cursor-ns-resize pointer-events-auto"
                      onPointerDown={(e) => handleAdjustResizeStart(e, 'bottom')}
                      onPointerMove={handleAdjustMove}
                      onPointerUp={handleAdjustResizeEnd}
                    />
                    <circle 
                      cx={midX} cy={maxY} r="1.1" 
                      fill="#ffffff" stroke="#0284c7" strokeWidth="0.35" 
                      className="cursor-ns-resize pointer-events-auto shadow hover:scale-125 transition-transform"
                      onPointerDown={(e) => handleAdjustResizeStart(e, 'bottom')}
                      onPointerMove={handleAdjustMove}
                      onPointerUp={handleAdjustResizeEnd}
                    />

                    {/* Left Edge */}
                    <line x1={minX} y1={minY} x2={minX} y2={maxY} stroke="#38bdf8" strokeWidth="0.5" className="pointer-events-none" />
                    <line 
                      x1={minX} y1={minY} x2={minX} y2={maxY} 
                      stroke="transparent" strokeWidth="4" 
                      className="cursor-ew-resize pointer-events-auto"
                      onPointerDown={(e) => handleAdjustResizeStart(e, 'left')}
                      onPointerMove={handleAdjustMove}
                      onPointerUp={handleAdjustResizeEnd}
                    />
                    <circle 
                      cx={minX} cy={midY} r="1.1" 
                      fill="#ffffff" stroke="#0284c7" strokeWidth="0.35" 
                      className="cursor-ew-resize pointer-events-auto shadow hover:scale-125 transition-transform"
                      onPointerDown={(e) => handleAdjustResizeStart(e, 'left')}
                      onPointerMove={handleAdjustMove}
                      onPointerUp={handleAdjustResizeEnd}
                    />

                    {/* Right Edge */}
                    <line x1={maxX} y1={minY} x2={maxX} y2={maxY} stroke="#38bdf8" strokeWidth="0.5" className="pointer-events-none" />
                    <line 
                      x1={maxX} y1={minY} x2={maxX} y2={maxY} 
                      stroke="transparent" strokeWidth="4" 
                      className="cursor-ew-resize pointer-events-auto"
                      onPointerDown={(e) => handleAdjustResizeStart(e, 'right')}
                      onPointerMove={handleAdjustMove}
                      onPointerUp={handleAdjustResizeEnd}
                    />
                    <circle 
                      cx={maxX} cy={midY} r="1.1" 
                      fill="#ffffff" stroke="#0284c7" strokeWidth="0.35" 
                      className="cursor-ew-resize pointer-events-auto shadow hover:scale-125 transition-transform"
                      onPointerDown={(e) => handleAdjustResizeStart(e, 'right')}
                      onPointerMove={handleAdjustMove}
                      onPointerUp={handleAdjustResizeEnd}
                    />

                    {/* 4 Corners */}
                    <rect 
                      x={minX - 1.4} y={minY - 1.4} width="2.8" height="2.8" rx="0.5"
                      fill="#ffffff" stroke="#0284c7" strokeWidth="0.4"
                      className="cursor-nwse-resize pointer-events-auto hover:fill-sky-300 transition-colors shadow"
                      onPointerDown={(e) => handleAdjustResizeStart(e, 'tl')}
                      onPointerMove={handleAdjustMove}
                      onPointerUp={handleAdjustResizeEnd}
                    />
                    <rect 
                      x={maxX - 1.4} y={minY - 1.4} width="2.8" height="2.8" rx="0.5"
                      fill="#ffffff" stroke="#0284c7" strokeWidth="0.4"
                      className="cursor-nesw-resize pointer-events-auto hover:fill-sky-300 transition-colors shadow"
                      onPointerDown={(e) => handleAdjustResizeStart(e, 'tr')}
                      onPointerMove={handleAdjustMove}
                      onPointerUp={handleAdjustResizeEnd}
                    />
                    <rect 
                      x={maxX - 1.4} y={maxY - 1.4} width="2.8" height="2.8" rx="0.5"
                      fill="#ffffff" stroke="#0284c7" strokeWidth="0.4"
                      className="cursor-nwse-resize pointer-events-auto hover:fill-sky-300 transition-colors shadow"
                      onPointerDown={(e) => handleAdjustResizeStart(e, 'br')}
                      onPointerMove={handleAdjustMove}
                      onPointerUp={handleAdjustResizeEnd}
                    />
                    <rect 
                      x={minX - 1.4} y={maxY - 1.4} width="2.8" height="2.8" rx="0.5"
                      fill="#ffffff" stroke="#0284c7" strokeWidth="0.4"
                      className="cursor-nesw-resize pointer-events-auto hover:fill-sky-300 transition-colors shadow"
                      onPointerDown={(e) => handleAdjustResizeStart(e, 'bl')}
                      onPointerMove={handleAdjustMove}
                      onPointerUp={handleAdjustResizeEnd}
                    />
                  </g>
                );
              })()}
            </>
          )}

          {/* Existing Hotspots (when not in adjust mode) */}
          {drawMode !== 'adjust' && hotspots.map((hs) => {
            const isHovered = hoveredHotspotId === hs.id;
            const isHighlighted = highlightedHotspotId === hs.id;
            const isReshaping = reshapingHotspot?.id === hs.id;
            const isClickable = !isReshaping && (isDeleteMode || isEditMode || !isEditing);
            const isArrow = isArrowShape(hs.shape_points);
            
            if (isReshaping) {
              return (
                <polygon
                  key={hs.id}
                  points={hs.shape_points.map((p) => `${p.x * 100},${p.y * 100}`).join(" ")}
                  fill={isArrow ? "rgba(234, 179, 8, 0.25)" : "rgba(56, 189, 248, 0.15)"}
                  stroke={isArrow ? "#eab308" : "#38bdf8"}
                  strokeWidth="0.5"
                  strokeDasharray="3,3"
                  className="pointer-events-none"
                >
                  <title>Current outline of &quot;{hs.label}&quot; (Redraw new boundary)</title>
                </polygon>
              );
            }

            return (
              <polygon
                key={hs.id}
                points={hs.shape_points.map((p) => `${p.x * 100},${p.y * 100}`).join(" ")}
                fill={
                  isDeleteMode
                    ? (isHovered ? "rgba(239, 68, 68, 0.55)" : "rgba(239, 68, 68, 0.22)")
                    : isEditMode
                      ? (isHovered 
                          ? (isArrow ? "rgba(250, 204, 21, 0.65)" : !hs.child_photo_id ? "rgba(245, 158, 11, 0.45)" : "rgba(100, 100, 100, 0.25)")
                          : (isArrow ? "rgba(234, 179, 8, 0.40)" : !hs.child_photo_id ? "rgba(245, 158, 11, 0.22)" : "rgba(255, 255, 255, 0.15)"))
                      : isHovered 
                        ? (isArrow ? "rgba(250, 204, 21, 0.70)" : "rgba(224, 242, 254, 0.25)") 
                        : isHighlighted 
                          ? (isArrow ? "rgba(234, 179, 8, 0.65)" : "rgba(239, 68, 68, 0.2)") 
                          : (isArrow ? "rgba(234, 179, 8, 0.45)" : "rgba(255, 255, 255, 0.25)")
                }
                stroke={
                  isDeleteMode
                    ? (isHovered ? "#ff2222" : "rgba(239, 68, 68, 0.85)")
                    : isEditMode
                      ? (isHovered 
                          ? (isArrow ? "#facc15" : !hs.child_photo_id ? "#f59e0b" : "rgba(156, 163, 175, 0.6)")
                          : (isArrow ? "#eab308" : !hs.child_photo_id ? "rgba(245, 158, 11, 0.75)" : "rgba(156, 163, 175, 0.4)"))
                      : isHighlighted 
                        ? (isArrow ? "#facc15" : "#ef4444")
                        : isHovered
                          ? (isArrow ? "#facc15" : "#bae6fd")
                          : (isArrow ? "#eab308" : "rgba(224, 242, 254, 0.85)")
                }
                strokeWidth={
                  isArrow 
                    ? (isHovered || isHighlighted ? "0.8" : "0.5") 
                    : (isDeleteMode || isEditMode ? (isHovered ? "0.8" : "0.5") : (isHovered || isHighlighted ? "0.55" : "0.38"))
                }
                strokeDasharray={isDeleteMode ? (isHovered ? "none" : "2,2") : isEditMode ? (isHovered ? "none" : "3,3") : "none"}
                style={
                  isArrow 
                    ? { filter: isHovered ? 'drop-shadow(0 0 6px rgba(234,179,8,0.75))' : 'drop-shadow(0 0 3px rgba(234,179,8,0.35))' } 
                    : { filter: isHovered ? 'drop-shadow(0 0 4px rgba(186,230,253,0.5))' : 'drop-shadow(0 0 1.5px rgba(224,242,254,0.3))' }
                }
                className={`transition-all duration-200 ${isHighlighted ? 'animate-pulse' : ''} ${
                  isClickable ? "cursor-pointer pointer-events-auto" : "pointer-events-none"
                }`}
                onMouseEnter={(e) => {
                  if (isClickable) {
                    setHoveredHotspotId(hs.id);
                    if (containerRef.current) {
                      const rect = containerRef.current.getBoundingClientRect();
                      const x = ((e.clientX - rect.left) / rect.width) * 100;
                      const y = ((e.clientY - rect.top) / rect.height) * 100;
                      setHoverPos({ x, y });
                    }
                  }
                }}
                onMouseMove={(e) => {
                  if (isClickable && containerRef.current) {
                    const rect = containerRef.current.getBoundingClientRect();
                    const x = ((e.clientX - rect.left) / rect.width) * 100;
                    const y = ((e.clientY - rect.top) / rect.height) * 100;
                    setHoverPos({ x, y });
                  }
                }}
                onMouseLeave={() => {
                  setHoveredHotspotId(null);
                  setHoverPos(null);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isDeleteMode) {
                    onHotspotDelete?.(hs);
                  } else if (isEditMode) {
                    if (!hs.child_photo_id) {
                      onHotspotEdit?.(hs);
                    }
                  } else if (!isEditing) {
                    onHotspotClick(hs);
                  }
                }}
              >
                <title>{hs.label} ({hs.is_leaf ? "Storage Location" : "Opens into Storage"})</title>
              </polygon>
            );
          })}

          {/* Current Polygon or Freehand Drawing */}
          {drawMode !== 'rectangle' && drawMode !== 'arrow' && isDrawing && currentPoints.length > 0 && (
            <polyline 
              points={toPolygonString(drawMode === 'polygon' && polygonMousePos ? [...currentPoints, polygonMousePos] : currentPoints)} 
              className="fill-transparent stroke-brand-accent stroke-[0.3] border-dashed"
            />
          )}

          {/* Closed shape preview when finished drawing but modal is open (Polygon & Freehand) */}
          {drawMode !== 'rectangle' && drawMode !== 'arrow' && !isDrawing && currentPoints.length > 0 && (
            <polygon 
              points={toPolygonString(currentPoints)} 
              className="fill-brand-accent/20 stroke-brand-accent stroke-[0.3]"
            />
          )}

          {/* Dynamic Arrow Preview during drawing */}
          {drawMode === 'arrow' && arrowStage === 'drawing' && arrowStart && arrowEnd && currentPoints.length > 0 && (
            <g className="arrow-preview-group pointer-events-none">
              <polygon
                points={toPolygonString(currentPoints)}
                className="fill-yellow-400/40 stroke-yellow-400 stroke-[0.5]"
                strokeDasharray="2,2"
              />
              <line
                x1={arrowStart.x * 100}
                y1={arrowStart.y * 100}
                x2={arrowEnd.x * 100}
                y2={arrowEnd.y * 100}
                stroke="#facc15"
                strokeWidth="0.4"
                strokeDasharray="1.5,1.5"
              />
            </g>
          )}

          {/* Arrow in Adjusting Stage: Draggable Body + Tail/Tip Handles + Wing Width Handles */}
          {drawMode === 'arrow' && arrowStage === 'adjusting' && arrowStart && arrowEnd && currentPoints.length > 0 && (
            <g className="arrow-editor-group pointer-events-auto">
              {/* Draggable body for moving the whole arrow */}
              <polygon
                points={toPolygonString(currentPoints)}
                className="fill-yellow-400/45 stroke-yellow-400 stroke-[0.6] cursor-move pointer-events-auto filter drop-shadow-[0_0_5px_rgba(234,179,8,0.4)]"
                onPointerDown={(e) => handleArrowResizeStart(e, 'body')}
                onPointerMove={handleArrowResizeMove}
                onPointerUp={handleArrowResizeEnd}
              />
              {/* Direction line from tail to tip */}
              <line
                x1={arrowStart.x * 100}
                y1={arrowStart.y * 100}
                x2={arrowEnd.x * 100}
                y2={arrowEnd.y * 100}
                stroke="#fde047"
                strokeWidth="0.35"
                strokeDasharray="1,1"
                className="pointer-events-none opacity-80"
              />
              {/* Tail handle */}
              <circle
                cx={arrowStart.x * 100}
                cy={arrowStart.y * 100}
                r={1.8}
                className="fill-amber-300 stroke-amber-900 stroke-[0.4] cursor-grab pointer-events-auto hover:scale-125 transition-transform"
                onPointerDown={(e) => handleArrowResizeStart(e, 'tail')}
                onPointerMove={handleArrowResizeMove}
                onPointerUp={handleArrowResizeEnd}
              >
                <title>Drag tail to adjust position or angle</title>
              </circle>
              {/* Tip handle */}
              <circle
                cx={arrowEnd.x * 100}
                cy={arrowEnd.y * 100}
                r={2.2}
                className="fill-yellow-300 stroke-yellow-900 stroke-[0.4] cursor-grab pointer-events-auto hover:scale-125 transition-transform"
                onPointerDown={(e) => handleArrowResizeStart(e, 'tip')}
                onPointerMove={handleArrowResizeMove}
                onPointerUp={handleArrowResizeEnd}
              >
                <title>Drag tip to re-aim or change length</title>
              </circle>
              {/* Wing Handles for Adjusting Arrow Width (P2 & P4) */}
              {currentPoints.length >= 7 && (
                <>
                  <circle
                    cx={currentPoints[2].x * 100}
                    cy={currentPoints[2].y * 100}
                    r={1.6}
                    className="fill-amber-400 stroke-amber-950 stroke-[0.4] cursor-ew-resize pointer-events-auto hover:scale-135 transition-transform"
                    onPointerDown={(e) => handleArrowResizeStart(e, 'width1')}
                    onPointerMove={handleArrowResizeMove}
                    onPointerUp={handleArrowResizeEnd}
                  >
                    <title>Drag wing to adjust arrow width / thickness</title>
                  </circle>
                  <circle
                    cx={currentPoints[4].x * 100}
                    cy={currentPoints[4].y * 100}
                    r={1.6}
                    className="fill-amber-400 stroke-amber-950 stroke-[0.4] cursor-ew-resize pointer-events-auto hover:scale-135 transition-transform"
                    onPointerDown={(e) => handleArrowResizeStart(e, 'width2')}
                    onPointerMove={handleArrowResizeMove}
                    onPointerUp={handleArrowResizeEnd}
                  >
                    <title>Drag wing to adjust arrow width / thickness</title>
                  </circle>
                </>
              )}
            </g>
          )}

          {/* Dynamic Rectangle Preview during drawing */}
          {drawMode === 'rectangle' && rectStage === 'drawing' && rectStart && rectCurrent && (() => {
            const minX = Math.min(rectStart.x, rectCurrent.x) * 100;
            const minY = Math.min(rectStart.y, rectCurrent.y) * 100;
            const w = Math.abs(rectCurrent.x - rectStart.x) * 100;
            const h = Math.abs(rectCurrent.y - rectStart.y) * 100;
            return (
              <rect 
                x={minX} 
                y={minY} 
                width={w} 
                height={h} 
                className="fill-amber-500/20 stroke-amber-400 stroke-[0.4]"
                strokeDasharray="2,2"
              />
            );
          })()}

          {/* Rectangle in Resizing Stage: Shape Body + Interactive Edge Lines + Corner Handles */}
          {drawMode === 'rectangle' && rectStage === 'resizing' && rectBounds && (() => {
            const minX = rectBounds.minX * 100;
            const maxX = rectBounds.maxX * 100;
            const minY = rectBounds.minY * 100;
            const maxY = rectBounds.maxY * 100;
            const w = maxX - minX;
            const h = maxY - minY;
            const midX = (minX + maxX) / 2;
            const midY = (minY + maxY) / 2;

            return (
              <g className="rectangle-editor-group">
                {/* Draggable body for moving the whole rectangle */}
                <rect 
                  x={minX} 
                  y={minY} 
                  width={w} 
                  height={h} 
                  className="fill-brand-accent/25 stroke-brand-accent stroke-[0.4] cursor-move pointer-events-auto"
                  onPointerDown={(e) => handleResizeStart(e, 'move')}
                  onPointerMove={handleResizeMove}
                  onPointerUp={handleResizeEnd}
                />

                {/* Top Edge */}
                <line x1={minX} y1={minY} x2={maxX} y2={minY} stroke="#f59e0b" strokeWidth="0.4" strokeDasharray="1.5,1.5" className="pointer-events-none" />
                <line 
                  x1={minX} y1={minY} x2={maxX} y2={minY} 
                  stroke="transparent" strokeWidth="3" 
                  className="cursor-ns-resize pointer-events-auto"
                  onPointerDown={(e) => handleResizeStart(e, 'top')}
                  onPointerMove={handleResizeMove}
                  onPointerUp={handleResizeEnd}
                />
                <circle 
                  cx={midX} cy={minY} r="0.9" 
                  fill="#ffffff" stroke="#f59e0b" strokeWidth="0.3" 
                  className="cursor-ns-resize pointer-events-auto shadow hover:scale-125 transition-transform"
                  onPointerDown={(e) => handleResizeStart(e, 'top')}
                  onPointerMove={handleResizeMove}
                  onPointerUp={handleResizeEnd}
                />

                {/* Bottom Edge */}
                <line x1={minX} y1={maxY} x2={maxX} y2={maxY} stroke="#f59e0b" strokeWidth="0.4" strokeDasharray="1.5,1.5" className="pointer-events-none" />
                <line 
                  x1={minX} y1={maxY} x2={maxX} y2={maxY} 
                  stroke="transparent" strokeWidth="3" 
                  className="cursor-ns-resize pointer-events-auto"
                  onPointerDown={(e) => handleResizeStart(e, 'bottom')}
                  onPointerMove={handleResizeMove}
                  onPointerUp={handleResizeEnd}
                />
                <circle 
                  cx={midX} cy={maxY} r="0.9" 
                  fill="#ffffff" stroke="#f59e0b" strokeWidth="0.3" 
                  className="cursor-ns-resize pointer-events-auto shadow hover:scale-125 transition-transform"
                  onPointerDown={(e) => handleResizeStart(e, 'bottom')}
                  onPointerMove={handleResizeMove}
                  onPointerUp={handleResizeEnd}
                />

                {/* Left Edge */}
                <line x1={minX} y1={minY} x2={minX} y2={maxY} stroke="#f59e0b" strokeWidth="0.4" strokeDasharray="1.5,1.5" className="pointer-events-none" />
                <line 
                  x1={minX} y1={minY} x2={minX} y2={maxY} 
                  stroke="transparent" strokeWidth="3" 
                  className="cursor-ew-resize pointer-events-auto"
                  onPointerDown={(e) => handleResizeStart(e, 'left')}
                  onPointerMove={handleResizeMove}
                  onPointerUp={handleResizeEnd}
                />
                <circle 
                  cx={minX} cy={midY} r="0.9" 
                  fill="#ffffff" stroke="#f59e0b" strokeWidth="0.3" 
                  className="cursor-ew-resize pointer-events-auto shadow hover:scale-125 transition-transform"
                  onPointerDown={(e) => handleResizeStart(e, 'left')}
                  onPointerMove={handleResizeMove}
                  onPointerUp={handleResizeEnd}
                />

                {/* Right Edge */}
                <line x1={maxX} y1={minY} x2={maxX} y2={maxY} stroke="#f59e0b" strokeWidth="0.4" strokeDasharray="1.5,1.5" className="pointer-events-none" />
                <line 
                  x1={maxX} y1={minY} x2={maxX} y2={maxY} 
                  stroke="transparent" strokeWidth="3" 
                  className="cursor-ew-resize pointer-events-auto"
                  onPointerDown={(e) => handleResizeStart(e, 'right')}
                  onPointerMove={handleResizeMove}
                  onPointerUp={handleResizeEnd}
                />
                <circle 
                  cx={maxX} cy={midY} r="0.9" 
                  fill="#ffffff" stroke="#f59e0b" strokeWidth="0.3" 
                  className="cursor-ew-resize pointer-events-auto shadow hover:scale-125 transition-transform"
                  onPointerDown={(e) => handleResizeStart(e, 'right')}
                  onPointerMove={handleResizeMove}
                  onPointerUp={handleResizeEnd}
                />

                {/* 4 Corner Handles */}
                <rect 
                  x={minX - 1.2} y={minY - 1.2} width="2.4" height="2.4" rx="0.4"
                  fill="#ffffff" stroke="#bc7353" strokeWidth="0.35"
                  className="cursor-nwse-resize pointer-events-auto hover:fill-amber-300 transition-colors shadow"
                  onPointerDown={(e) => handleResizeStart(e, 'tl')}
                  onPointerMove={handleResizeMove}
                  onPointerUp={handleResizeEnd}
                />
                <rect 
                  x={maxX - 1.2} y={minY - 1.2} width="2.4" height="2.4" rx="0.4"
                  fill="#ffffff" stroke="#bc7353" strokeWidth="0.35"
                  className="cursor-nesw-resize pointer-events-auto hover:fill-amber-300 transition-colors shadow"
                  onPointerDown={(e) => handleResizeStart(e, 'tr')}
                  onPointerMove={handleResizeMove}
                  onPointerUp={handleResizeEnd}
                />
                <rect 
                  x={maxX - 1.2} y={maxY - 1.2} width="2.4" height="2.4" rx="0.4"
                  fill="#ffffff" stroke="#bc7353" strokeWidth="0.35"
                  className="cursor-nwse-resize pointer-events-auto hover:fill-amber-300 transition-colors shadow"
                  onPointerDown={(e) => handleResizeStart(e, 'br')}
                  onPointerMove={handleResizeMove}
                  onPointerUp={handleResizeEnd}
                />
                <rect 
                  x={minX - 1.2} y={maxY - 1.2} width="2.4" height="2.4" rx="0.4"
                  fill="#ffffff" stroke="#bc7353" strokeWidth="0.35"
                  className="cursor-nesw-resize pointer-events-auto hover:fill-amber-300 transition-colors shadow"
                  onPointerDown={(e) => handleResizeStart(e, 'bl')}
                  onPointerMove={handleResizeMove}
                  onPointerUp={handleResizeEnd}
                />
              </g>
            );
          })()}
        </svg>

        {/* Floating Confirm / Redraw Action Bar for Rectangle Mode */}
        {drawMode === 'rectangle' && rectStage === 'resizing' && rectBounds && (() => {
          const centerX = ((rectBounds.minX + rectBounds.maxX) / 2) * 100;
          const topY = rectBounds.minY * 100;
          const isNearTop = topY < 12;
          const posY = isNearTop ? rectBounds.maxY * 100 : topY;

          return (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              onPointerMove={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              style={{
                left: `${Math.max(12, Math.min(88, centerX))}%`,
                top: `${Math.max(4, Math.min(96, posY))}%`
              }}
              className={`absolute -translate-x-1/2 z-30 flex items-center gap-2 bg-[#1a1816]/95 border border-[#4a443c] px-2 py-1.5 rounded-lg shadow-2xl backdrop-blur-md animate-fadeIn select-none ${
                isNearTop ? "mt-3" : "-translate-y-full -mt-3"
              }`}
            >
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  if (rectBounds) {
                    const pts = [
                      { x: rectBounds.minX, y: rectBounds.minY },
                      { x: rectBounds.maxX, y: rectBounds.minY },
                      { x: rectBounds.maxX, y: rectBounds.maxY },
                      { x: rectBounds.minX, y: rectBounds.maxY }
                    ];
                    if (reshapingHotspot) {
                      onConfirmReshape?.(reshapingHotspot.id, pts);
                      resetRectangleState();
                      setCurrentPoints([]);
                    } else {
                      setCurrentPoints(pts);
                      setShowConfig(true);
                    }
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded shadow transition-colors"
                title="Confirm rectangle hotspot (Enter)"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Confirm Hotspot</span>
              </button>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  resetRectangleState();
                  setCurrentPoints([]);
                  setIsDrawing(false);
                }}
                className="flex items-center gap-1 px-2.5 py-1 bg-[#2a2724] hover:bg-[#383430] text-brand-text-muted hover:text-white text-xs font-medium rounded transition-colors"
                title="Cancel and redraw (Esc)"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Redraw</span>
              </button>
            </div>
          );
        })()}

        {/* Floating Confirm / Redraw Action Bar for Arrow Mode */}
        {drawMode === 'arrow' && arrowStage === 'adjusting' && arrowEnd && currentPoints.length > 0 && (() => {
          const centerX = ((arrowStart ? (arrowStart.x + arrowEnd.x) / 2 : arrowEnd.x)) * 100;
          const minY = Math.min(arrowStart?.y ?? arrowEnd.y, arrowEnd.y) * 100;
          const isNearTop = minY < 12;
          const posY = isNearTop ? Math.max(arrowStart?.y ?? arrowEnd.y, arrowEnd.y) * 100 : minY;

          return (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              onPointerMove={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              style={{
                left: `${Math.max(12, Math.min(88, centerX))}%`,
                top: `${Math.max(4, Math.min(96, posY))}%`
              }}
              className={`absolute -translate-x-1/2 z-30 flex items-center gap-2 bg-[#1a1816]/95 border border-[#4a443c] px-2 py-1.5 rounded-lg shadow-2xl backdrop-blur-md animate-fadeIn select-none ${
                isNearTop ? "mt-3" : "-translate-y-full -mt-3"
              }`}
            >
              {/* Quick Width Buttons */}
              <div className="flex items-center gap-1 bg-[#252320] border border-[#3d3832] rounded px-1.5 py-0.5 text-xs text-amber-200">
                <span className="text-[11px] font-semibold text-amber-300/90">Width:</span>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAdjustArrowWidth(-0.25);
                  }}
                  className="w-5 h-5 flex items-center justify-center rounded bg-[#332f2a] hover:bg-[#443f38] text-white text-xs font-bold transition-colors"
                  title="Decrease arrow width (-)"
                >
                  -
                </button>
                <span className="text-[10px] font-mono px-1 font-bold text-amber-100 min-w-[28px] text-center">
                  {Math.round(arrowWidthScale * 100)}%
                </span>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAdjustArrowWidth(0.25);
                  }}
                  className="w-5 h-5 flex items-center justify-center rounded bg-[#332f2a] hover:bg-[#443f38] text-white text-xs font-bold transition-colors"
                  title="Increase arrow width (+)"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  if (currentPoints.length > 0) {
                    if (reshapingHotspot) {
                      onConfirmReshape?.(reshapingHotspot.id, currentPoints);
                      resetArrowState();
                      setCurrentPoints([]);
                    } else if (movingHotspot) {
                      onConfirmMoveHotspot?.(movingHotspot.hotspot.id, currentPoints);
                      resetArrowState();
                      setCurrentPoints([]);
                    } else {
                      setShowConfig(true);
                    }
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded shadow transition-colors"
                title="Confirm arrow hotspot (Enter)"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Confirm Arrow</span>
              </button>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  resetArrowState();
                  setCurrentPoints([]);
                  setIsDrawing(false);
                }}
                className="flex items-center gap-1 px-2.5 py-1 bg-[#2a2724] hover:bg-[#383430] text-brand-text-muted hover:text-white text-xs font-medium rounded transition-colors"
                title="Cancel and redraw (Esc)"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Redraw</span>
              </button>
            </div>
          );
        })()}

        {/* Floating Pin & Label for Highlighted Hotspot */}
        {hotspots.map((hs) => {
          if (hs.id !== highlightedHotspotId || !hs.shape_points || hs.shape_points.length === 0) return null;
          const avgX = hs.shape_points.reduce((acc, p) => acc + p.x, 0) / hs.shape_points.length;
          const avgY = hs.shape_points.reduce((acc, p) => acc + p.y, 0) / hs.shape_points.length;
          
          return (
            <div
              key={`highlight-badge-${hs.id}`}
              style={{
                left: `${avgX * 100}%`,
                top: `${avgY * 100}%`
              }}
              className="absolute -translate-x-1/2 -translate-y-full -mt-2 z-30 pointer-events-none flex flex-col items-center animate-bounce duration-1000"
            >
              <div className="bg-red-600 text-white text-[11px] font-bold px-2.5 py-1 rounded shadow-xl border border-white/30 whitespace-nowrap flex items-center gap-1.5 backdrop-blur-xs">
                <MapPin className="h-3.5 w-3.5 fill-white text-white" />
                <span>{hs.label}</span>
              </div>
              <div className="w-2 h-2 bg-red-600 rotate-45 -mt-1 shadow" />
            </div>
          );
        })}

        {/* Floating Reveal Tooltip for Hovered Hotspot */}
        {hoveredHotspot && hoveredHotspot.id !== highlightedHotspotId && hoveredHotspot.shape_points && hoveredHotspot.shape_points.length > 0 && (() => {
          const centroidX = (hoveredHotspot.shape_points.reduce((acc, p) => acc + p.x, 0) / hoveredHotspot.shape_points.length) * 100;
          const centroidY = (hoveredHotspot.shape_points.reduce((acc, p) => acc + p.y, 0) / hoveredHotspot.shape_points.length) * 100;
          const posX = hoverPos ? hoverPos.x : centroidX;
          const posY = hoverPos ? hoverPos.y : centroidY;
          const clampedX = Math.max(8, Math.min(92, posX));
          const clampedY = Math.max(6, Math.min(94, posY));
          const isNearTop = clampedY < 12;

          return (
            <div
              key={`hover-badge-${hoveredHotspot.id}`}
              style={{
                left: `${clampedX}%`,
                top: `${clampedY}%`
              }}
              className={`absolute -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center animate-fadeIn transition-opacity duration-75 ${
                isNearTop ? "mt-3" : "-translate-y-full -mt-2.5"
              }`}
            >
              {isNearTop && (
                <div className={`w-2 h-2 rotate-45 -mb-1 z-10 shadow ${
                  isDeleteMode ? 'bg-red-950 border-l border-t border-red-500/80' : 
                  isEditMode ? 'bg-amber-950 border-l border-t border-amber-500/80' : 
                  'bg-[#141211] border-l border-t border-[#4a443c]'
                }`} />
              )}
              {isDeleteMode ? (
                <div className="bg-red-950/95 text-red-200 text-xs font-bold px-3 py-1.5 rounded-md shadow-2xl border border-red-500/80 whitespace-nowrap flex items-center gap-1.5 backdrop-blur-md">
                  <Trash2 className="h-3.5 w-3.5 text-red-400 shrink-0" />
                  <span>Delete &quot;{hoveredHotspot.label}&quot;</span>
                </div>
              ) : isEditMode ? (
                <div className={`text-xs font-bold px-3 py-1.5 rounded-md shadow-2xl border whitespace-nowrap flex items-center gap-1.5 backdrop-blur-md ${
                  !hoveredHotspot.child_photo_id 
                    ? 'bg-amber-950/95 text-amber-200 border-amber-500/80' 
                    : 'bg-[#141211]/95 text-brand-text-muted border-[#4a443c]'
                }`}>
                  <Edit2 className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span>
                    {!hoveredHotspot.child_photo_id 
                      ? `Edit "${hoveredHotspot.label}"` 
                      : `"${hoveredHotspot.label}" (Image saved)`}
                  </span>
                </div>
              ) : (
                <div className="bg-[#141211]/95 text-white text-xs font-semibold px-3 py-1.5 rounded-md shadow-2xl border border-[#4a443c] whitespace-nowrap flex items-center gap-2 backdrop-blur-md">
                  {hoveredHotspot.is_leaf ? (
                    <span className="w-2 h-2 rounded-full bg-brand-accent inline-block shrink-0 shadow-[0_0_6px_rgba(188,115,83,0.8)]" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block shrink-0 shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
                  )}
                  <span className="font-bold tracking-wide">{hoveredHotspot.label}</span>
                  <span className="text-[9px] text-brand-text-muted uppercase font-mono tracking-wider bg-[#252320] px-1.5 py-0.5 rounded border border-[#332f2a]">
                    {hoveredHotspot.is_leaf ? "Storage Location" : "Opens into Storage"}
                  </span>
                </div>
              )}
              {!isNearTop && (
                <div className={`w-2 h-2 rotate-45 -mt-1 shadow ${
                  isDeleteMode ? 'bg-red-950 border-r border-b border-red-500/80' : 
                  isEditMode ? 'bg-amber-950 border-r border-b border-amber-500/80' : 
                  'bg-[#141211] border-r border-b border-[#4a443c]'
                }`} />
              )}
            </div>
          );
        })()}
      </div>
      </div>

      {showConfig && (
        <HotspotConfigModal 
          onClose={() => {
            setShowConfig(false);
            setCurrentPoints([]);
            resetRectangleState();
            resetArrowState();
          }}
          onSubmit={(label, isLeaf) => {
            const finalPoints = (currentPoints.length >= 3)
              ? currentPoints
              : (rectBounds ? [
                  { x: rectBounds.minX, y: rectBounds.minY },
                  { x: rectBounds.maxX, y: rectBounds.minY },
                  { x: rectBounds.maxX, y: rectBounds.maxY },
                  { x: rectBounds.minX, y: rectBounds.maxY }
                ] : []);
            if (finalPoints.length >= 3) {
              onHotspotCreated(finalPoints, label, isLeaf);
            }
            setShowConfig(false);
            setCurrentPoints([]);
            resetRectangleState();
            resetArrowState();
          }}
        />
      )}
    </div>
  );
}

