import React, { useRef, useEffect, useState } from 'react';
import { 
  ProjectState, ObjectNode, ToolType, BrushVariant, 
  ShapeType, StyleState, TransformState, PivotNode, BoneNode 
} from '../types';
import { 
  pointToSegmentDistance, pointToPolylineDistance, 
  inverseTransformPoint, transformPoint, calculateBoundingBox,
  project3DView, autoCorrectStroke, solveFABRIK, pointInPolygon
} from '../utils/math';

const imageCache = new Map<string, HTMLImageElement>();

export function getDistortedPoints(objPts: [number, number][], depth360?: number): [number, number][] {
  if (!depth360) return objPts;
  const theta = (depth360 * Math.PI) / 180;
  const bbox = calculateBoundingBox(objPts);
  const cx = (bbox.minX + bbox.maxX) / 2;
  return objPts.map(([px, py]) => {
    const rx = cx + (px - cx) * Math.cos(theta);
    const ry = py + Math.sin(theta) * (px - cx) * 0.15;
    return [rx, ry] as [number, number];
  });
}

interface CanvasRendererProps {
  project: ProjectState;
  activeFrameIndex: number;
  activeTool: ToolType;
  brushVariant: BrushVariant;
  strokeColor: string;
  strokeWidth: number;
  fillColor: string;
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  onUpdateObjectTransform: (objectId: string, transform: Partial<TransformState>) => void;
  onUpdateObjectStyle: (objectId: string, style: Partial<StyleState>) => void;
  onAddStroke: (points: [number, number][], type: 'stroke' | 'shape') => void;
  onAddShape: (shapeType: ShapeType, x: number, y: number, w: number, h: number) => void;
  onAddText: (txt: string, x: number, y: number) => void;
  onUpdatePivot: (objectId: string, pivotId: string, updates: Partial<PivotNode>) => void;
  onionEnabled: boolean;
  onFrameUpdateTrigger: () => void;
  alertMsg: string | null;
  setAlertMsg: (msg: string | null) => void;
  onUpdateProject: (nextProj: ProjectState) => void;
  onPushUndoSnapshot: (nextProj: ProjectState) => void;
  onKnifeCut: (objectId: string, ptsA: [number, number][], ptsB: [number, number][]) => void;
}

export default function CanvasRenderer({
  project,
  activeFrameIndex,
  activeTool,
  brushVariant,
  strokeColor,
  strokeWidth,
  fillColor,
  selectedIds,
  setSelectedIds,
  onUpdateObjectTransform,
  onUpdateObjectStyle,
  onAddStroke,
  onAddShape,
  onAddText,
  onUpdatePivot,
  onionEnabled,
  onFrameUpdateTrigger,
  alertMsg,
  setAlertMsg,
  onUpdateProject,
  onPushUndoSnapshot,
  onKnifeCut
}: CanvasRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Interaction vectors
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([]);
  const [dragMode, setDragMode] = useState<'none' | 'move' | 'scale-corner' | 'scale-side' | 'rotate' | 'pivot' | 'bone'>('none');
  const [dragStartPoint, setDragStartPoint] = useState<[number, number] | null>(null);
  const [activeHandle, setActiveHandle] = useState<string | null>(null);
  const [activePivotId, setActivePivotId] = useState<string | null>(null);
  const [activeBoneId, setActiveBoneId] = useState<string | null>(null);
  const [constraintFlash, setConstraintFlash] = useState(false);

  // Triple-tap selection lock trackers
  const [clickCount, setClickCount] = useState(0);
  const [lastClickTime, setLastClickTime] = useState(0);

  // Dimensions
  const [canvasScale, setCanvasScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  const activeObjects = Object.values(project.objects);
  const selectedObject = selectedIds.length === 1 ? project.objects[selectedIds[0]] : null;

  // Resolve world transformations for object
  const getObjectTransform = (objectId: string): TransformState => {
    const frameObj = project.frames[activeFrameIndex]?.objects[objectId];
    return frameObj?.transform || { x: 400, y: 250, rotation: 1, scaleX: 1, scaleY: 1 };
  };

  const getPivotWorldCoords = (obj: ObjectNode, p: PivotNode): [number, number] => {
    const transform = getObjectTransform(obj.id);
    return transformPoint(p.localX, p.localY, transform);
  };

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = 800 * dpr;
      canvas.height = 500 * dpr;
      canvas.style.width = '800px';
      canvas.style.height = '500px';
      ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Pre-load all image objects directly on scene load or state updates
  useEffect(() => {
    Object.values(project.objects).forEach(obj => {
      if (obj.type === 'image' && obj.baseGeometry.imgUrl) {
        const url = obj.baseGeometry.imgUrl;
        if (!imageCache.has(url)) {
          const img = new Image();
          img.src = url;
          img.onload = () => {
            imageCache.set(url, img);
            drawCanvas();
          };
          img.onerror = () => {
            console.error("Failed to preload image:", url);
          };
        }
      }
    });
  }, [project.objects]);

  // Frame redrawing pipeline
  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, 800, 500);

    // 1. Grid lines snapping helper
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    for (let x = 0; x < 800; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 500);
      ctx.stroke();
    }
    for (let y = 0; y < 500; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(800, y);
      ctx.stroke();
    }

    // 2. ONION SKIN pass (Red tints for previous frames, Blue for future)
    if (onionEnabled && activeFrameIndex > 0) {
      ctx.save();
      ctx.globalAlpha = 0.25;
      const prevFrame = project.frames[activeFrameIndex - 1];
      if (prevFrame) {
        Object.values(project.objects).forEach(obj => {
          const trans = prevFrame.objects[obj.id]?.transform || { x: 400, y: 250, rotation: 0, scaleX: 1, scaleY: 1 };
          ctx.save();
          ctx.strokeStyle = '#ef4444'; // Red tint
          ctx.fillStyle = '#fee2e2';
          ctx.lineWidth = obj.defaultStyle.strokeWidth;
          drawObjectGeometry(ctx, obj, trans);
          ctx.restore();
        });
      }
      ctx.restore();
    }

    // 3. BASE DRAWING pass
    activeObjects.forEach(obj => {
      const transform = getObjectTransform(obj.id);
      const style = obj.defaultStyle;
      const isSelected = selectedIds.includes(obj.id);

      ctx.save();
      ctx.globalAlpha = isSelected ? 1 : 0.85;
      ctx.strokeStyle = style.stroke; // Keep original chosen stroke color visible even if selected so changes apply immediately visually
      ctx.fillStyle = style.fill;
      ctx.lineWidth = style.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Advanced filters (CSS properties matching Guidelines)
      if (isSelected) {
        ctx.shadowColor = '#2196f3';
        ctx.shadowBlur = 8;
      }

      drawObjectGeometry(ctx, obj, transform);
      ctx.restore();
    });

    // 4. ACTIVE GHOST DRAWING DURING TOUCH
    if (isDrawing && drawPoints.length > 1) {
      ctx.save();
      if (activeTool === ToolType.LAS) {
        ctx.strokeStyle = '#2196f3';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
      } else {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
      }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(drawPoints[0][0], drawPoints[0][1]);
      for (let i = 1; i < drawPoints.length; i++) {
        ctx.lineTo(drawPoints[i][0], drawPoints[i][1]);
      }
      if (activeTool === ToolType.LAS) {
        ctx.closePath();
      }
      ctx.stroke();
      ctx.restore();
    }

    // 5. BOUNDING BOX & HANDLES FOR SELECTION
    if (selectedObject) {
      const transform = getObjectTransform(selectedObject.id);
      let points = selectedObject.baseGeometry.points || [];
      if (transform.depth360) {
        points = getDistortedPoints(points, transform.depth360);
      }

      // Calculate localized dimensions
      const bbox = calculateBoundingBox(points);
      const center = [(bbox.minX + bbox.maxX) / 2, (bbox.minY + bbox.maxY) / 2];

      const minPt = transformPoint(bbox.minX, bbox.minY, transform, { localX: 0, localY: 0 });
      const maxPt = transformPoint(bbox.maxX, bbox.maxY, transform, { localX: 0, localY: 0 });

      const x = transform.x + bbox.minX;
      const y = transform.y + bbox.minY;
      const w = bbox.maxX - bbox.minX;
      const h = bbox.maxY - bbox.minY;

      ctx.save();
      ctx.strokeStyle = '#2196f3';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);

      // Apply transform context to box
      ctx.translate(transform.x, transform.y);
      ctx.rotate((transform.rotation * Math.PI) / 180);
      ctx.scale(transform.scaleX, transform.scaleY);

      ctx.strokeRect(bbox.minX - 4, bbox.minY - 4, w + 8, h + 8);
      ctx.restore();

      ctx.save();
      // Render Rotation node top hook (40px above bounding box)
      ctx.fillStyle = '#2196f3';
      const rotPt = transformPoint(center[0], bbox.minY - 30, transform);
      ctx.beginPath();
      ctx.arc(rotPt[0], rotPt[1], 7, 0, Math.PI * 2);
      ctx.fill();

      // Render 8 sizing control handles
      const cornerHandles = [
        [bbox.minX, bbox.minY, 'tl'],
        [bbox.maxX, bbox.minY, 'tr'],
        [bbox.minX, bbox.maxY, 'bl'],
        [bbox.maxX, bbox.maxY, 'br'],
        [center[0], bbox.minY, 'tc'],
        [center[0], bbox.maxY, 'bc'],
        [bbox.minX, center[1], 'lc'],
        [bbox.maxX, center[1], 'rc']
      ];

      cornerHandles.forEach(([hx, hy, type]) => {
        const hp = transformPoint(Number(hx), Number(hy), transform);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#2196f3';
        ctx.lineWidth = 2;
        ctx.fillRect(hp[0] - 5, hp[1] - 5, 10, 10);
        ctx.strokeRect(hp[0] - 5, hp[1] - 5, 10, 10);
      });

      // Render red pivot pins
      selectedObject.pivots.forEach(p => {
        const pLoc = getPivotWorldCoords(selectedObject, p);
        ctx.fillStyle = p.locked ? '#fbcaad' : '#e53935';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(pLoc[0], pLoc[1], 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(pLoc[0] - 1, pLoc[1] - 4, 2, 8);
        ctx.fillRect(pLoc[0] - 4, pLoc[1] - 1, 8, 2);
      });

      ctx.restore();
    }

    // 6. SKELETAL BONES pass
    Object.values(project.bones).forEach(bone => {
      const startObj = project.objects[bone.startObjectId];
      const endObj = project.objects[bone.endObjectId];
      if (!startObj || !endObj) return;

      const transStart = getObjectTransform(startObj.id);
      const transEnd = getObjectTransform(endObj.id);

      const p1 = transformPoint(bone.startLocalX, bone.startLocalY, transStart);
      const p2 = transformPoint(bone.endLocalX, bone.endLocalY, transEnd);

      ctx.save();
      ctx.strokeStyle = bone.color || '#2196f3';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p1[0], p1[1]);
      ctx.lineTo(p2[0], p2[1]);
      ctx.stroke();

      // Render Joint joint indicators
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p1[0], p1[1], 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p2[0], p2[1], 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  };

  // Helper to draw clean geometries
  const drawObjectGeometry = (ctx: CanvasRenderingContext2D, obj: ObjectNode, transform: TransformState) => {
    let pts = obj.baseGeometry.points || [];
    if (pts.length === 0) return;

    if (transform.depth360) {
      pts = getDistortedPoints(pts, transform.depth360);
    }

    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.rotate((transform.rotation * Math.PI) / 180);
    ctx.scale(transform.scaleX, transform.scaleY);

    if (obj.type === 'image' && obj.baseGeometry.imgUrl) {
      const url = obj.baseGeometry.imgUrl;
      let img = imageCache.get(url);
      if (!img) {
        img = new Image();
        img.src = url;
        img.onload = () => {
          imageCache.set(url, img!);
          drawCanvas();
        };
      } else {
        const bbox = calculateBoundingBox(pts);
        const w = bbox.maxX - bbox.minX || 150;
        const h = bbox.maxY - bbox.minY || 150;
        ctx.drawImage(img, bbox.minX, bbox.minY, w, h);
      }
    } else {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i][0], pts[i][1]);
      }

      // Draw close and fill for closed shapes or if explicitly filled
      const isClosed = obj.baseGeometry.shapeType !== undefined || 
                       obj.defaultStyle.fill !== 'transparent' || 
                       (pts.length > 2 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 10);
      if (isClosed) {
        ctx.closePath();
        if (obj.defaultStyle.fill !== 'transparent') {
          ctx.fill();
        }
      }
      ctx.stroke();

      // Render text if type matches
      if (obj.type === 'text' && obj.baseGeometry.text) {
        ctx.font = 'bold 16px Inter';
        ctx.fillStyle = obj.defaultStyle.stroke;
        ctx.fillText(obj.baseGeometry.text, pts[0][0], pts[0][1]);
      }
    }

    ctx.restore();
  };

  useEffect(() => {
    drawCanvas();
  }, [project, activeFrameIndex, selectedIds, isDrawing, drawPoints, onionEnabled]);

  // Unified pointer handler matching Guidelines
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setDragStartPoint([x, y]);

    // Handle Selection Tools (SEL / LAS)
    if (activeTool === ToolType.SEL) {
      // 1. Check if clicked rotation handles or scale resize handles on active selection first
      if (selectedObject) {
        const trans = getObjectTransform(selectedObject.id);
        const pts = selectedObject.baseGeometry.points || [];
        const bbox = calculateBoundingBox(pts);
        const center = [(bbox.minX + bbox.maxX) / 2, (bbox.minY + bbox.maxY) / 2];

        // Check rot hook
        const rotPt = transformPoint(center[0], bbox.minY - 30, trans);
        if (Math.hypot(x - rotPt[0], y - rotPt[1]) < 15) {
          setDragMode('rotate');
          return;
        }

        // Check pivots drag
        for (const p of selectedObject.pivots) {
          const pWorld = getPivotWorldCoords(selectedObject, p);
          if (Math.hypot(x - pWorld[0], y - pWorld[1]) < 12) {
            if (p.locked) {
              setAlertMsg("Pivot is locked. Enable edit in the hierarchy index.");
              setTimeout(() => setAlertMsg(null), 3500);
              return;
            }
            setDragMode('pivot');
            setActivePivotId(p.id);
            return;
          }
        }

        // Check corner handles
        const handles = [
          [bbox.minX, bbox.minY, 'tl'],
          [bbox.maxX, bbox.minY, 'tr'],
          [bbox.minX, bbox.maxY, 'bl'],
          [bbox.maxX, bbox.maxY, 'br'],
          [center[0], bbox.minY, 'tc'],
          [center[0], bbox.maxY, 'bc'],
          [bbox.minX, center[1], 'lc'],
          [bbox.maxX, center[1], 'rc']
        ];

        for (const [hx, hy, type] of handles) {
          const hp = transformPoint(Number(hx), Number(hy), trans);
          if (Math.hypot(x - hp[0], y - hp[1]) < 12) {
            setDragMode(type.toString().endsWith('c') ? 'scale-side' : 'scale-corner');
            setActiveHandle(type.toString());
            return;
          }
        }
      }

      // 2. Perform Spatial Path Detection checks
      let hitId: string | null = null;
      let minDist = 15; // 15px touch tolerance as specified

      for (const obj of activeObjects) {
        if (obj.isHidden) continue;
        const transform = getObjectTransform(obj.id);
        let basePts = obj.baseGeometry.points || [];
        if (transform.depth360) {
          basePts = getDistortedPoints(basePts, transform.depth360);
        }

        // Project design space coordinates to screen
        const screenPts = basePts.map(([px, py]) => transformPoint(px, py, transform));
        
        let dist: number;
        const inside = screenPts.length >= 3 && pointInPolygon(x, y, screenPts);
        if (inside || obj.baseGeometry.shapeType !== undefined) {
          dist = (inside || (screenPts.length >= 3 && pointInPolygon(x, y, screenPts))) ? 0 : pointToPolylineDistance(x, y, screenPts);
        } else {
          dist = pointToPolylineDistance(x, y, screenPts);
        }

        if (dist < minDist) {
          minDist = dist;
          hitId = obj.id;
        }
      }

      if (hitId) {
        // Selection Lock check: Accidental deselect prevented
        const now = Date.now();
        if (selectedIds.includes(hitId)) {
          if (now - lastClickTime < 450) {
            const count = clickCount + 1;
            setClickCount(count);
            if (count >= 2) { // Triple-tap deselect triggered
              setSelectedIds([]);
              setClickCount(0);
            }
          } else {
            setClickCount(1);
          }
        } else {
          setSelectedIds([hitId]);
          setClickCount(1);
        }
        setLastClickTime(now);
        setDragMode('move');
      } else {
        // Did not hit any object. Ignore simple clicks on blank areas to prevent accidental drop selection.
        // It deselects only if exactly triple-clicking empty space
        const now = Date.now();
        if (now - lastClickTime < 500) {
          const count = clickCount + 1;
          setClickCount(count);
          if (count >= 3) {
            setSelectedIds([]);
            setClickCount(0);
          }
        } else {
          setClickCount(1);
        }
        setLastClickTime(now);
      }
      return;
    }

    // Handle Lasso Multi Select
    if (activeTool === ToolType.LAS) {
      setIsDrawing(true);
      setDrawPoints([[x, y]]);
      return;
    }

    // Handle Fill / Bucket Tool
    if (activeTool === ToolType.FIL) {
      let hitId: string | null = null;
      let minDist = 15; // 15px touch tolerance as specified

      for (const obj of activeObjects) {
        if (obj.isHidden) continue;
        const transform = getObjectTransform(obj.id);
        let basePts = obj.baseGeometry.points || [];
        if (transform.depth360) {
          basePts = getDistortedPoints(basePts, transform.depth360);
        }

        // Project design space coordinates to screen
        const screenPts = basePts.map(([px, py]) => transformPoint(px, py, transform));
        
        let dist: number;
        const inside = screenPts.length >= 3 && pointInPolygon(x, y, screenPts);
        if (inside || obj.baseGeometry.shapeType !== undefined || obj.defaultStyle.fill !== 'transparent') {
          dist = (inside || (screenPts.length >= 3 && pointInPolygon(x, y, screenPts))) ? 0 : pointToPolylineDistance(x, y, screenPts);
        } else {
          dist = pointToPolylineDistance(x, y, screenPts);
        }

        if (dist < minDist) {
          minDist = dist;
          hitId = obj.id;
        }
      }

      if (hitId) {
        onUpdateObjectStyle(hitId, { fill: fillColor });
      }
      return;
    }

    // Default brush draw mode
    if (
      activeTool === ToolType.BRS || 
      activeTool === ToolType.ERS || 
      activeTool === ToolType.KNF || 
      activeTool === ToolType.LIN || 
      activeTool === ToolType.REC || 
      activeTool === ToolType.CIR || 
      activeTool === ToolType.TRI
    ) {
      setIsDrawing(true);
      setDrawPoints([[x, y]]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragStartPoint) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const dx = x - dragStartPoint[0];
    const dy = y - dragStartPoint[1];

    if (activeTool === ToolType.SEL && selectedObject) {
      const transform = getObjectTransform(selectedObject.id);

      if (dragMode === 'move') {
        // Simple X/Y Translate move
        onUpdateObjectTransform(selectedObject.id, {
          x: transform.x + dx,
          y: transform.y + dy
        });
        setDragStartPoint([x, y]);
      } else if (dragMode === 'rotate') {
        // Calculate rotate angle from geom center using trigonometry
        const points = selectedObject.baseGeometry.points || [];
        const bbox = calculateBoundingBox(points);
        const center = [transform.x + (bbox.minX + bbox.maxX) / 2, transform.y + (bbox.minY + bbox.maxY) / 2];

        const oldAngle = Math.atan2(dragStartPoint[1] - center[1], dragStartPoint[0] - center[0]);
        const newAngle = Math.atan2(y - center[1], x - center[0]);
        const rotateDiff = ((newAngle - oldAngle) * 180) / Math.PI;

        onUpdateObjectTransform(selectedObject.id, {
          rotation: Math.round(transform.rotation + rotateDiff)
        });
        setDragStartPoint([x, y]);
      } else if (dragMode === 'pivot' && activePivotId) {
        // Map back to local coordinate system space to maintain alignment during translations
        const pivotLocal = inverseTransformPoint(x, y, transform);
        onUpdatePivot(selectedObject.id, activePivotId, {
          localX: Math.round(pivotLocal[0]),
          localY: Math.round(pivotLocal[1])
        });
      } else if (dragMode === 'scale-corner' && activeHandle) {
        // Scale proportionally
        const scaleFactorX = (x / dragStartPoint[0]);
        const scaleFactorY = (y / dragStartPoint[1]);
        const scale = (scaleFactorX + scaleFactorY) / 2;

        onUpdateObjectTransform(selectedObject.id, {
          scaleX: parseFloat(Math.max(0.1, transform.scaleX * scale).toFixed(2)),
          scaleY: parseFloat(Math.max(0.1, transform.scaleY * scale).toFixed(2))
        });
        setDragStartPoint([x, y]);
      } else if (dragMode === 'scale-side' && activeHandle) {
        // Left/Right stretch, top/bottom stretch
        if (activeHandle === 'lc' || activeHandle === 'rc') {
          const factor = x / dragStartPoint[0];
          onUpdateObjectTransform(selectedObject.id, {
            scaleX: parseFloat(Math.max(0.1, transform.scaleX * factor).toFixed(2))
          });
        } else {
          const factor = y / dragStartPoint[1];
          onUpdateObjectTransform(selectedObject.id, {
            scaleY: parseFloat(Math.max(0.1, transform.scaleY * factor).toFixed(2))
          });
        }
        setDragStartPoint([x, y]);
      }
      return;
    }

    if (isDrawing) {
      const ptsList = [...drawPoints, [x, y]] as [number, number][];
      setDrawPoints(ptsList);

      if (activeTool === ToolType.ERS) {
        const brushSize = 25;
        let modified = false;
        const nextProj = JSON.parse(JSON.stringify(project)) as ProjectState;

        Object.values(nextProj.objects).forEach(obj => {
          if (obj.isHidden || obj.isLocked) return;
          const transform = getObjectTransform(obj.id);
          const pts = obj.baseGeometry.points || [];
          if (pts.length === 0) return;

          const remaining: [number, number][] = pts.filter(pt => {
            const worldPt = transformPoint(pt[0], pt[1], transform);
            const dist = Math.hypot(x - worldPt[0], y - worldPt[1]);
            return dist > brushSize;
          });

          if (remaining.length !== pts.length) {
            obj.baseGeometry.points = remaining;
            modified = true;
          }
        });

        if (modified) {
          const cleanObjects: { [id: string]: ObjectNode } = {};
          Object.keys(nextProj.objects).forEach(id => {
            const obj = nextProj.objects[id];
            if (obj.baseGeometry.points && obj.baseGeometry.points.length > 1) {
              cleanObjects[id] = obj;
            } else {
              nextProj.layers.forEach(l => {
                l.objectIds = l.objectIds.filter(oid => oid !== id);
              });
              if (obj.parentId && nextProj.objects[obj.parentId]) {
                nextProj.objects[obj.parentId].childrenIds = nextProj.objects[obj.parentId].childrenIds.filter(oid => oid !== id);
              }
            }
          });
          nextProj.objects = cleanObjects;
          onUpdateProject(nextProj);
        }
      }
    }
  };

  const handlePointerUp = () => {
    if (isDrawing && drawPoints.length > 1) {
      if (activeTool === ToolType.LAS) {
        // Detect paths falling completely or partially inside Lasso and select
        const insideIds: string[] = [];
        activeObjects.forEach(obj => {
          if (obj.isHidden) return;
          const trans = getObjectTransform(obj.id);
          const pts = obj.baseGeometry.points || [];
          if (pts.length === 0) return;
          
          // If any of the object's points fall inside the lasso selection polygon, select it!
          const isContained = pts.some(pt => {
            const worldPt = transformPoint(pt[0], pt[1], trans);
            return pointInPolygon(worldPt[0], worldPt[1], drawPoints);
          });
          
          if (isContained) {
            insideIds.push(obj.id);
          }
        });
        setSelectedIds(insideIds); // Deselect when lassoing empty space
      } else if (activeTool === ToolType.BRS) {
        // Smooth freehand vector and save
        const smoothed = autoCorrectStroke(drawPoints);
        onAddStroke(smoothed, 'stroke');
      } else if (activeTool === ToolType.LIN) {
        // Straight vector segment
        onAddStroke([drawPoints[0], drawPoints[drawPoints.length - 1]], 'stroke');
      } else if (activeTool === ToolType.REC) {
        // Symmetrical quad
        const start = drawPoints[0];
        const end = drawPoints[drawPoints.length - 1];
        const pts: [number, number][] = [
          [start[0], start[1]],
          [end[0], start[1]],
          [end[0], end[1]],
          [start[0], end[1]]
        ];
        onAddStroke(pts, 'shape');
      } else if (activeTool === ToolType.CIR) {
        // Circle poly points
        const start = drawPoints[0];
        const end = drawPoints[drawPoints.length - 1];
        const r = Math.hypot(end[0] - start[0], end[1] - start[1]);
        const circlePts: [number, number][] = [];
        for (let a = 0; a < 360; a += 15) {
          const rad = (a * Math.PI) / 180;
          circlePts.push([start[0] + r * Math.cos(rad), start[1] + r * Math.sin(rad)]);
        }
        onAddStroke(circlePts, 'shape');
      } else if (activeTool === ToolType.TRI) {
        // Triangle shape
        const start = drawPoints[0];
        const end = drawPoints[drawPoints.length - 1];
        const midX = (start[0] + end[0]) / 2;
        const pts: [number, number][] = [
          [midX, start[1]],
          [end[0], end[1]],
          [start[0], end[1]]
        ];
        onAddStroke(pts, 'shape');
      } else if (activeTool === ToolType.ERS) {
        onPushUndoSnapshot(project);
      } else if (activeTool === ToolType.KNF) {
        const start = drawPoints[0];
        const end = drawPoints[drawPoints.length - 1];
        if (selectedIds.length === 0) {
          setAlertMsg("Please select a vector drawing node first to perform a Knife cut!");
          setTimeout(() => setAlertMsg(null), 3500);
        } else {
          const objectId = selectedIds[0];
          const obj = project.objects[objectId];
          if (obj && obj.baseGeometry.points) {
            const transform = getObjectTransform(objectId);
            const pts = obj.baseGeometry.points;

            const partAPoints: [number, number][] = [];
            const partBPoints: [number, number][] = [];

            pts.forEach(pt => {
              const worldPt = transformPoint(pt[0], pt[1], transform);
              const side = (end[0] - start[0]) * (worldPt[1] - start[1]) - (end[1] - start[1]) * (worldPt[0] - start[0]);
              if (side >= 0) {
                partAPoints.push(pt);
              } else {
                partBPoints.push(pt);
              }
            });

            if (partAPoints.length > 1 && partBPoints.length > 1) {
              onKnifeCut(objectId, partAPoints, partBPoints);
            } else {
              setAlertMsg("The Knife line must completely cross through the selected drawing to split it!");
              setTimeout(() => setAlertMsg(null), 3500);
            }
          }
        }
      }
    }

    setIsDrawing(false);
    setDrawPoints([]);
    setDragMode('none');
    setDragStartPoint(null);
    setActiveHandle(null);
    setActivePivotId(null);
    setActiveBoneId(null);
  };

  return (
    <div 
      ref={containerRef}
      className="flex-1 bg-white relative overflow-hidden flex items-center justify-center h-full active-selection"
      style={{ touchAction: 'none' }}
    >
      {/* Absolute floating indicators */}
      <div className="absolute top-3 left-4 flex gap-3 text-[10px] items-center text-slate-400 font-mono bg-slate-900/10 backdrop-blur rounded-full px-3 py-1 select-none pointer-events-none">
        <span className="font-bold text-slate-600 uppercase">ACTIVE TOOL: {activeTool}</span>
        <span className="h-2 w-px bg-slate-400/30" />
        <span>FRAME: #{activeFrameIndex + 1}</span>
        <span className="h-2 w-px bg-slate-400/30" />
        <span>SELECTED: {selectedIds.length} Nodes</span>
      </div>

      {/* Floating Prompt alerts as instructed in PART 13 */}
      {alertMsg && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 text-white font-medium text-xs rounded-full py-2 px-6 shadow-2xl z-50 flex items-center gap-2 select-none panel-transition animate-bounce">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span>{alertMsg}</span>
        </div>
      )}

      {/* Primary Interaction Canvas Drawing Stage */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="bg-white border rounded shadow-lg border-slate-200"
        style={{ cursor: activeTool === ToolType.PVT ? 'crosshair' : 'default' }}
      />
    </div>
  );
}
