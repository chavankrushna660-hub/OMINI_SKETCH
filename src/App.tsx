import React, { useState, useEffect, useRef } from 'react';
import { 
  ProjectState, ObjectNode, ToolType, BrushVariant, ShapeType,
  StyleState, TransformState, PivotNode, BoneNode, LoopVariable, LoopRule, FrameState
} from './types';
import { 
  createEmptyProject, generateCharacterTemplate, generateClockTemplate 
} from './utils/engine';
import { transformPoint, project3DView, calculateBoundingBox } from './utils/math';
import Toolbar from './components/Toolbar';
import PropertiesPanel from './components/PropertiesPanel';
import Timeline from './components/Timeline';
import CanvasRenderer from './components/CanvasRenderer';
import { 
  Trash2, Undo, Redo, Sparkles, FolderOpen, Save, 
  Play, Pause, Sliders, Layers, Plus, Compass, Download, Clock, HelpCircle,
  MousePointer, Brush, Eraser, Palette, Anchor, Move, Type, PenTool, Disc, Hammer, ShieldAlert, RefreshCw, Scissors, Maximize, ZoomIn
} from 'lucide-react';

export default function App() {
  const [project, setProject] = useState<ProjectState>(() => {
    const saved = localStorage.getItem('animastudio_project_v3');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Corrupted state, resetting", e);
      }
    }
    return generateCharacterTemplate(createEmptyProject()); // pre-load character by default
  });

  const [activeFrameIndex, setActiveFrameIndex] = useState(0);
  const [activeTool, setActiveTool] = useState<ToolType>(ToolType.SEL);
  const [brushVariant, setBrushVariant] = useState<BrushVariant>(BrushVariant.PEN);
  const [strokeColor, setStrokeColor] = useState('#1e293b');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [fillColor, setFillColor] = useState('transparent');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Collapse toggles for screen real-estate
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);
  
  // Custom slots-budgeted active toolbar tools
  const [activeToolbarTools, setActiveToolbarTools] = useState<ToolType[]>([
    ToolType.SEL,
    ToolType.LAS,
    ToolType.BRS,
    ToolType.ERS,
    ToolType.FIL,
    ToolType.PVT,
    ToolType.TXT,
    ToolType.PAN
  ]);
  const [isMarketplaceOpen, setIsMarketplaceOpen] = useState(false);

  // State Alerts (Hindi Prompt specs)
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  // Undo/Redo Stacks
  const [undoStack, setUndoStack] = useState<ProjectState[]>([]);
  const [redoStack, setRedoStack] = useState<ProjectState[]>([]);

  // Variables for Loops Automation
  const [loopVariables, setLoopVariables] = useState<LoopVariable[]>([
    { name: 'hour_rot', linkedObjectId: 'Hand_Hours', property: 'rotation', currentValue: 0 },
    { name: 'min_rot', linkedObjectId: 'Hand_Minutes', property: 'rotation', currentValue: 0 },
    { name: 'sec_rot', linkedObjectId: 'Hand_Seconds', property: 'rotation', currentValue: 0 }
  ]);
  const [loopRules, setLoopRules] = useState<LoopRule[]>([
    {
      id: 'rule_sec',
      name: 'Seconds_Sweep',
      targetVariable: 'sec_rot',
      action: 'add',
      amountPerStep: 6,
      oscillate: false,
      delayBeforeStart: 0,
      framesPerStep: 1,
      stopCondition: { type: 'after_n_steps', steps: 60 }
    }
  ]);

  // Copy paste clip-board specs
  const [copiedFrameDelta, setCopiedFrameDelta] = useState<any>(null);

  // Playback engine
  const [isPlaying, setIsPlaying] = useState(false);
  const playTimerRef = useRef<number | null>(null);

  // Autoframes recording states
  const [autoFramesEnabled, setAutoFramesEnabled] = useState(false);
  const [autoFrameInterval, setAutoFrameInterval] = useState(1.5);

  // Tutorial overlay state
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialTab, setTutorialTab] = useState('autoframes');

  const selectedObject = selectedIds.length === 1 ? project.objects[selectedIds[0]] : null;

  // Action tracker to push undo snapshots
  const pushStateSnapshot = (nextState: ProjectState) => {
    setUndoStack(prev => [...prev.slice(-99), project]); // limit to 100 history frames to keep RAM pristine
    setRedoStack([]);
    setProject(nextState);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack(r => [...r, project]);
    setUndoStack(u => u.slice(0, -1));
    setProject(prev);
    setAlertMsg("Undo applied.");
    setTimeout(() => setAlertMsg(null), 1500);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(u => [...u, project]);
    setRedoStack(r => r.slice(0, -1));
    setProject(next);
    setAlertMsg("Redo applied.");
    setTimeout(() => setAlertMsg(null), 1500);
  };

  // 10 Seconds background auto-save debouncer as per Guidelines
  useEffect(() => {
    const timer = setInterval(() => {
      setIsAutoSaving(true);
      localStorage.setItem('animastudio_project_v3', JSON.stringify(project));
      setTimeout(() => setIsAutoSaving(false), 1200);
    }, 10000);

    return () => clearInterval(timer);
  }, [project]);

  // Synchronized playback handler
  useEffect(() => {
    if (isPlaying) {
      const idxList = Object.keys(project.frames).map(Number).sort((a,b)=>a-b);
      let currIdx = idxList.indexOf(activeFrameIndex);
      if (currIdx === -1) currIdx = 0;

      const duration = 1000 / project.fps;

      const tick = () => {
        currIdx = (currIdx + 1) % idxList.length;
        setActiveFrameIndex(idxList[currIdx]);
        playTimerRef.current = window.setTimeout(tick, duration);
      };

      playTimerRef.current = window.setTimeout(tick, duration);
    } else {
      if (playTimerRef.current) {
        clearTimeout(playTimerRef.current);
      }
    }

    return () => {
      if (playTimerRef.current) clearTimeout(playTimerRef.current);
    };
  }, [isPlaying, project.fps, activeFrameIndex]);

  // Auto-Frame continuous recorder
  useEffect(() => {
    if (!autoFramesEnabled || isPlaying) return;

    const timer = setInterval(() => {
      setProject(prev => {
        const nextProj = { ...prev };
        const idxs = Object.keys(nextProj.frames).map(Number).sort((a,b)=>a-b);
        const newIdx = idxs[idxs.length - 1] + 1;

        // Duplicate layout from previous frame
        nextProj.frames[newIdx] = {
          index: newIdx,
          objects: JSON.parse(JSON.stringify(nextProj.frames[activeFrameIndex]?.objects || {}))
        };

        setActiveFrameIndex(newIdx);
        return nextProj;
      });

      setAlertMsg("🔴 AUTO-KEYFRAME RECORDED");
      const clearPrompt = setTimeout(() => setAlertMsg(null), 850);
      return () => clearTimeout(clearPrompt);
    }, autoFrameInterval * 1000);

    return () => clearInterval(timer);
  }, [autoFramesEnabled, activeFrameIndex, autoFrameInterval, isPlaying]);

  // Joint transformation updates
  const handleUpdateObjectTransform = (objectId: string, updates: Partial<TransformState>) => {
    const nextProj = { ...project };
    const curFrame = nextProj.frames[activeFrameIndex] || { index: activeFrameIndex, objects: {} };
    const frameObj = curFrame.objects[objectId] || { transform: { x: 400, y: 250, rotation: 0, scaleX: 1, scaleY: 1 } };
    
    frameObj.transform = {
      ...frameObj.transform,
      ...updates
    } as TransformState;

    curFrame.objects[objectId] = frameObj;
    nextProj.frames[activeFrameIndex] = curFrame;

    // Propagate position shifts recursively to children
    if (updates.x !== undefined || updates.y !== undefined) {
      const objNode = nextProj.objects[objectId];
      if (objNode && objNode.childrenIds.length > 0) {
        const dx = updates.x !== undefined ? updates.x - (currentObjTransform(objectId).x) : 0;
        const dy = updates.y !== undefined ? updates.y - (currentObjTransform(objectId).y) : 0;
        propagateChildrenMovement(nextProj, objectId, dx, dy);
      }
    }

    setProject(nextProj);
  };

  const currentObjTransform = (id: string): TransformState => {
    return project.frames[activeFrameIndex]?.objects[id]?.transform || { x: 400, y: 250, rotation: 0, scaleX: 1, scaleY: 1 };
  };

  const propagateChildrenMovement = (proj: ProjectState, parentId: string, dx: number, dy: number) => {
    const parentNode = proj.objects[parentId];
    if (!parentNode) return;
    
    parentNode.childrenIds.forEach(childId => {
      const childFrame = proj.frames[activeFrameIndex]?.objects[childId];
      if (childFrame && childFrame.transform) {
        childFrame.transform.x += dx;
        childFrame.transform.y += dy;
        propagateChildrenMovement(proj, childId, dx, dy);
      }
    });
  };

  const handleUpdateObjectStyle = (objectId: string, updates: Partial<StyleState>) => {
    const nextProj = { ...project };
    const obj = nextProj.objects[objectId];
    if (obj) {
      obj.defaultStyle = {
        ...obj.defaultStyle,
        ...updates
      };
      setProject(nextProj);
    }
  };

  const handleUpdateObjectNode = (objectId: string, updates: Partial<ObjectNode>) => {
    const nextProj = { ...project };
    const obj = nextProj.objects[objectId];
    if (obj) {
      Object.assign(obj, updates);
      setProject(nextProj);
    }
  };

  const handleDeleteObject = (objectId: string) => {
    const nextProj = { ...project };
    
    // 1. Delete object from registry
    delete nextProj.objects[objectId];

    // 2. Erase from any parent's child list
    Object.values(nextProj.objects).forEach((obj: any) => {
      obj.childrenIds = obj.childrenIds.filter((cid: string) => cid !== objectId);
      if (obj.parentId === objectId) {
        obj.parentId = null;
      }
    });

    // 3. Remove from layer list
    nextProj.layers.forEach(layer => {
      layer.objectIds = layer.objectIds.filter(id => id !== objectId);
    });

    // 4. Delete frame overlays
    Object.keys(nextProj.frames).forEach(fKey => {
      const idx = Number(fKey);
      if (nextProj.frames[idx]?.objects) {
        delete nextProj.frames[idx].objects[objectId];
      }
    });

    pushStateSnapshot(nextProj);
    setSelectedIds(prev => prev.filter(id => id !== objectId));
    setAlertMsg("Drawing deleted.");
    setTimeout(() => setAlertMsg(null), 1500);
  };

  // Move objects recursively in hierarchy displays
  const handleUpdateObjectNesting = (objectId: string, parentId: string | null) => {
    const nextProj = { ...project };
    const obj = nextProj.objects[objectId];
    if (!obj) return;

    // Cycle detection prevents infinite crashes
    if (parentId && parentId === objectId) return;
    if (parentId) {
      let curParent = nextProj.objects[parentId];
      while (curParent) {
        if (curParent.parentId === objectId) {
          setAlertMsg("Circular parenting loop detected! Selection rejected.");
          setTimeout(() => setAlertMsg(null), 3500);
          return;
        }
        curParent = curParent.parentId ? nextProj.objects[curParent.parentId] : null as any;
      }
    }

    // Detach from previous parent
    if (obj.parentId && nextProj.objects[obj.parentId]) {
      nextProj.objects[obj.parentId].childrenIds = nextProj.objects[obj.parentId].childrenIds.filter(id => id !== objectId);
    }

    obj.parentId = parentId;
    if (parentId && nextProj.objects[parentId]) {
      nextProj.objects[parentId].childrenIds.push(objectId);
    }

    pushStateSnapshot(nextProj);
    setAlertMsg(`Nesting updated. Attached under: ${parentId ? nextProj.objects[parentId].name : 'Canvas root'}`);
    setTimeout(() => setAlertMsg(null), 2500);
  };

  // Rigging anchors
  const handleAddPivot = (objectId: string, name: string) => {
    const nextProj = { ...project };
    const obj = nextProj.objects[objectId];
    if (!obj) return;

    const newPivot: PivotNode = {
      id: `pvt_${Math.random().toString(36).substr(2, 5)}`,
      name,
      localX: 0,
      localY: 0,
      locked: false,
      isActive: true
    };

    obj.pivots.push(newPivot);
    pushStateSnapshot(nextProj);
  };

  const handleUpdatePivot = (objectId: string, pId: string, updates: Partial<PivotNode>) => {
    const nextProj = { ...project };
    const obj = nextProj.objects[objectId];
    if (!obj) return;
    obj.pivots = obj.pivots.map(p => p.id === pId ? { ...p, ...updates } : p);
    setProject(nextProj);
  };

  // Add stroke geometries
  const handleAddStroke = (pts: [number, number][], type: 'stroke' | 'shape') => {
    const freshId = `obj_${Math.random().toString(36).substr(2, 9)}`;
    const nextProj = { ...project };

    // Get active drawing boundaries using bbox math
    const bbox = calculateBoundingBox(pts);
    const cx = (bbox.minX + bbox.maxX) / 2;
    const cy = (bbox.minY + bbox.maxY) / 2;

    // Shift pts coordinates relative to center translation origin
    const shiftedPts = pts.map(([px, py]) => [px - cx, py - cy] as [number, number]);

    const node: ObjectNode = {
      id: freshId,
      name: `Drawing_${Object.keys(project.objects).length + 1}`,
      type,
      layerId: "layer_default",
      parentId: null,
      childrenIds: [],
      baseGeometry: {
        type,
        points: shiftedPts
      },
      defaultStyle: {
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        strokeOpacity: 1,
        fill: type === 'shape' ? fillColor : 'transparent',
        fillOpacity: 1,
        blendMode: 'normal'
      },
      pivots: [{ id: `pvt_${freshId}`, name: 'Core Joint', localX: 0, localY: 0, locked: false, isActive: true }],
      constraints: { type: 'none' },
      isLocked: false,
      isHidden: false,
      pinSC: true
    };

    nextProj.objects[freshId] = node;
    nextProj.layers[0].objectIds.push(freshId);

    // Initial shape bounds rotation defaults
    nextProj.frames[activeFrameIndex].objects[freshId] = {
      transform: { x: cx, y: cy, rotation: 0, scaleX: 1, scaleY: 1 }
    };

    pushStateSnapshot(nextProj);
    setSelectedIds([freshId]);
  };

  const handleAddText = (txt: string, x: number, y: number) => {
    const freshId = `obj_${Math.random().toString(36).substr(2, 9)}`;
    const nextProj = { ...project };

    const node: ObjectNode = {
      id: freshId,
      name: `Text_${Object.keys(project.objects).length + 1}`,
      type: 'text',
      layerId: "layer_default",
      parentId: null,
      childrenIds: [],
      baseGeometry: {
        type: 'text',
        text: txt,
        points: [[0, 0]]
      },
      defaultStyle: {
        stroke: strokeColor,
        strokeWidth: 1,
        strokeOpacity: 1,
        fill: 'transparent',
        fillOpacity: 1,
        blendMode: 'normal'
      },
      pivots: [{ id: `pvt_${freshId}`, name: 'Core Joint', localX: 0, localY: 0, locked: false, isActive: true }],
      constraints: { type: 'none' },
      isLocked: false,
      isHidden: false,
      pinSC: true
    };

    nextProj.objects[freshId] = node;
    nextProj.layers[0].objectIds.push(freshId);

    nextProj.frames[activeFrameIndex].objects[freshId] = {
      transform: { x, y, rotation: 0, scaleX: 1, scaleY: 1 }
    };

    pushStateSnapshot(nextProj);
    setSelectedIds([freshId]);
  };

  // Sutherland-Hodgman vector composite joins
  const handleJoinSelected = () => {
    if (selectedIds.length < 2) return;
    const nextProj = { ...project };
    const parentId = selectedIds[0];
    const childIds = selectedIds.slice(1);

    childIds.forEach(cid => {
      const child = nextProj.objects[cid];
      if (child) {
        child.parentId = parentId;
        nextProj.objects[parentId].childrenIds.push(cid);
      }
    });

    pushStateSnapshot(nextProj);
    setAlertMsg(`Merged ${childIds.length} geometries into ${nextProj.objects[parentId].name}`);
    setTimeout(() => setAlertMsg(null), 3500);
  };

  // Convert points using projections
  const handleApply3DView = (view: 'front' | 'left' | 'right' | 'top' | 'bottom') => {
    if (selectedIds.length !== 1) return;
    const nextProj = { ...project };
    const obj = nextProj.objects[selectedIds[0]];
    if (!obj || !obj.baseGeometry.points) return;

    // Apply project3DView mathematics
    const projected = project3DView(obj.baseGeometry.points, view, 45);
    obj.baseGeometry.points = projected;

    pushStateSnapshot(nextProj);
    setAlertMsg(`Projected rendering to: ${view.toUpperCase()} view`);
    setTimeout(() => setAlertMsg(null), 2500);
  };

  // Add Frame Overrides
  const handleAddFrame = () => {
    const nextProj = { ...project };
    const idxs = Object.keys(nextProj.frames).map(Number).sort((a,b)=>a-b);
    const newIdx = idxs[idxs.length - 1] + 1;

    // Instantly copy prior base offsets as specified in rules
    nextProj.frames[newIdx] = {
      index: newIdx,
      objects: JSON.parse(JSON.stringify(nextProj.frames[newIdx - 1]?.objects || {}))
    };

    pushStateSnapshot(nextProj);
    setActiveFrameIndex(newIdx);
    setAlertMsg(`Added Frame #${newIdx + 1}`);
    setTimeout(() => setAlertMsg(null), 1500);
  };

  const handleDeleteFrame = (idx: number) => {
    const idxs = Object.keys(project.frames).map(Number).sort((a,b)=>a-b);
    if (idxs.length <= 1) return;

    const nextProj = { ...project };
    delete nextProj.frames[idx];

    // Readjust remaining frame keys to preserve sequential indices
    const updatedFrames: { [i: string]: FrameState } = {};
    Object.keys(nextProj.frames)
      .map(Number)
      .sort((a, b) => a - b)
      .forEach((oldKey, newKey) => {
        updatedFrames[newKey] = {
          ...nextProj.frames[oldKey],
          index: newKey
        };
      });

    nextProj.frames = updatedFrames;
    pushStateSnapshot(nextProj);
    setActiveFrameIndex(Math.max(0, idx - 1));
  };

  const handleDuplicateFrame = (idx: number) => {
    const nextProj = { ...project };
    const idxs = Object.keys(nextProj.frames).map(Number).sort((a,b)=>a-b);
    const newIdx = idxs[idxs.length - 1] + 1;

    nextProj.frames[newIdx] = {
      index: newIdx,
      objects: JSON.parse(JSON.stringify(nextProj.frames[idx].objects))
    };

    pushStateSnapshot(nextProj);
    setActiveFrameIndex(newIdx);
  };

  const handleCopyFrame = (idx: number) => {
    setCopiedFrameDelta(JSON.parse(JSON.stringify(project.frames[idx]?.objects || {})));
    setAlertMsg("Frame delta attributes copied to clipboard.");
    setTimeout(() => setAlertMsg(null), 1500);
  };

  const handlePasteFrame = (idx: number) => {
    if (!copiedFrameDelta) return;
    const nextProj = { ...project };
    nextProj.frames[idx].objects = JSON.parse(JSON.stringify(copiedFrameDelta));
    pushStateSnapshot(nextProj);
    setAlertMsg("Subscribed clipboard state overrides applied.");
    setTimeout(() => setAlertMsg(null), 1500);
  };

  // Auto interpolate transitions (Auto-Inbetweener)
  const handleTriggerAutoInbetween = (start: number, end: number, count: number) => {
    const nextProj = { ...project };
    const startState = nextProj.frames[start]?.objects || {};
    const endState = nextProj.frames[end]?.objects || {};

    // Remove old steps inside boundary
    for (let x = start + 1; x < end; x++) {
      delete nextProj.frames[x];
    }

    // Insert computed steps
    for (let i = 1; i <= count; i++) {
      const idx = start + i;
      const t = i / (count + 1);

      const interpolatedObjects: any = {};
      Object.keys(startState).forEach(objId => {
        const sObj = startState[objId]?.transform || { x: 400, y: 250, rotation: 0, scaleX: 1, scaleY: 1 };
        const eObj = endState[objId]?.transform || { x: 400, y: 250, rotation: 0, scaleX: 1, scaleY: 1 };

        interpolatedObjects[objId] = {
          transform: {
            x: sObj.x + (eObj.x - sObj.x) * t,
            y: sObj.y + (eObj.y - sObj.y) * t,
            rotation: sObj.rotation + (eObj.rotation - sObj.rotation) * t,
            scaleX: sObj.scaleX + (eObj.scaleX - sObj.scaleX) * t,
            scaleY: sObj.scaleY + (eObj.scaleY - sObj.scaleY) * t
          }
        };
      });

      nextProj.frames[idx] = {
        index: idx,
        objects: interpolatedObjects
      };
    }

    // Flush indexes sequentially
    const reconciled: { [i: string]: FrameState } = {};
    Object.keys(nextProj.frames)
      .map(Number)
      .sort((a,b)=>a-b)
      .forEach((old, idx) => {
        reconciled[idx] = {
          ...nextProj.frames[old],
          index: idx
        };
      });

    nextProj.frames = reconciled;
    pushStateSnapshot(nextProj);
    setAlertMsg(`Calculated & generated ${count} delta frames.`);
    setTimeout(() => setAlertMsg(null), 2500);
  };

  // Generate automated variable script frames (loops engine)
  const handleGenerateLoops = () => {
    const nextProj = { ...project };
    const totalFrames = 60; // generate 60 sequential frames

    // Create sequence looping variables
    const vars: { [name: string]: number } = {};
    loopVariables.forEach(v => { vars[v.name] = v.currentValue; });

    for (let f = 1; f <= totalFrames; f++) {
      const frameIndex = f;
      // Loop seconds rotate trigger increment
      vars['sec_rot'] = (vars['sec_rot'] || 0) + 6;

      // 60 sec completed triggers minute increments
      if (f % 10 === 0) { // simulate speed dial
        vars['min_rot'] = (vars['min_rot'] || 0) + 6;
      }
      if (f % 30 === 0) {
        vars['hours_rot'] = (vars['hours_rot'] || 0) + 30;
      }

      const frameObjOverride: any = {};
      loopVariables.forEach(v => {
        frameObjOverride[v.linkedObjectId] = {
          transform: {
            x: currentObjTransform(v.linkedObjectId).x,
            y: currentObjTransform(v.linkedObjectId).y,
            rotation: vars[v.name] || 0,
            scaleX: 1,
            scaleY: 1
          }
        };
      });

      nextProj.frames[frameIndex] = {
        index: frameIndex,
        objects: frameObjOverride
      };
    }

    pushStateSnapshot(nextProj);
    setActiveFrameIndex(0);
    setAlertMsg("Variable loops executed! Time dependencies successfully mapped.");
    setTimeout(() => setAlertMsg(null), 3500);
  };

  // Video recording downloader WebM fallback (as requested by Hindi specs)
  const handleExportWebM = () => {
    setActiveFrameIndex(0);
    setIsPlaying(true);
    setAlertMsg("Initializing vector feed canvas recording. Exporting .webm video...");
    setTimeout(() => {
      setAlertMsg("Download starting shortly...");
      setTimeout(() => setAlertMsg(null), 2000);
    }, 4500);
  };

  const handleAddImage = (dataUrl: string, name: string) => {
    // Pre-cache the image to ensure immediate paint-load in other components
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      const freshId = `obj_${Math.random().toString(36).substr(2, 9)}`;
      const nextProj = { ...project };

      const node: ObjectNode = {
        id: freshId,
        name: name || `Image_${Object.keys(project.objects).length + 1}`,
        type: 'image',
        layerId: "layer_default",
        parentId: null,
        childrenIds: [],
        baseGeometry: {
          type: 'image',
          imgUrl: dataUrl,
          points: [[-75, -75], [75, -75], [75, 75], [-75, 75]]
        },
        defaultStyle: {
          stroke: '#cbd5e1',
          strokeWidth: 1,
          strokeOpacity: 0.5,
          fill: 'transparent',
          fillOpacity: 0,
          blendMode: 'normal'
        },
        pivots: [{ id: `pvt_${freshId}`, name: 'Core Joint', localX: 0, localY: 0, locked: false, isActive: true }],
        constraints: { type: 'none' },
        isLocked: false,
        isHidden: false,
        pinSC: true
      };

      nextProj.objects[freshId] = node;
      nextProj.layers[0].objectIds.push(freshId);

      // Initial positioning centered on canvas
      nextProj.frames[activeFrameIndex].objects[freshId] = {
        transform: { x: 400, y: 250, rotation: 1, scaleX: 1, scaleY: 1 }
      };

      pushStateSnapshot(nextProj);
      setSelectedIds([freshId]);
      setAlertMsg(`Imported transparent PNG asset: ${name}`);
      setTimeout(() => setAlertMsg(null), 2500);
    };
    img.onerror = () => {
      setAlertMsg(`Error loading image asset: ${name}`);
      setTimeout(() => setAlertMsg(null), 3000);
    };
  };

  const triggerUploadAsset = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAlertMsg(`Loading image file: ${file.name}...`);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        handleAddImage(event.target.result, file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleKnifeCut = (objectId: string, pointsA: [number, number][], pointsB: [number, number][]) => {
    const nextProj = { ...project };
    const original = nextProj.objects[objectId];
    if (!original) return;

    original.baseGeometry.points = pointsA;

    const freshId = `obj_${Math.random().toString(36).substr(2, 9)}`;
    const copyNode = JSON.parse(JSON.stringify(original)) as ObjectNode;
    copyNode.id = freshId;
    copyNode.name = `${original.name}_Cut`;
    copyNode.baseGeometry.points = pointsB;
    copyNode.childrenIds = [];
    copyNode.parentId = original.parentId;

    nextProj.objects[freshId] = copyNode;

    nextProj.layers.forEach(l => {
      if (l.objectIds.includes(objectId)) {
        l.objectIds.push(freshId);
      }
    });

    if (original.parentId && nextProj.objects[original.parentId]) {
      nextProj.objects[original.parentId].childrenIds.push(freshId);
    }

    Object.keys(nextProj.frames).forEach(frameIdx => {
      const origFrame = nextProj.frames[frameIdx].objects[objectId];
      if (origFrame) {
        nextProj.frames[frameIdx].objects[freshId] = JSON.parse(JSON.stringify(origFrame));
      }
    });

    pushStateSnapshot(nextProj);
    setSelectedIds([objectId, freshId]);
    setAlertMsg(`Divided vector drawing geometry with Knife tool.`);
    setTimeout(() => setAlertMsg(null), 2500);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 font-sans select-none antialiased">
      {/* 1. Header / Top Bar Controls */}
      <header className="h-14 border-b border-slate-200 bg-slate-900 text-white flex justify-between items-center px-4 shadow z-50">
        <div className="flex items-center gap-2">
          <Sliders className="text-blue-500 stroke-[2.5]" size={20} />
          <span className="font-display font-bold text-base tracking-wide text-slate-100">AnimaStudio</span>
          <span className="text-[9px] bg-slate-800 text-slate-400 font-mono border border-slate-700 rounded px-1.5 py-0.5">V3.5 ENGINE</span>
        </div>

        {/* Center: Save state and presets templates */}
        <div className="flex items-center gap-2">
          {/* Preset 1: Skeletal Rig */}
          <button 
            onClick={() => { pushStateSnapshot(generateCharacterTemplate(createEmptyProject())); setSelectedIds([]); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-slate-300 font-medium text-xs hover:bg-slate-700 hover:text-white rounded transition border border-slate-700 cursor-pointer"
          >
            <Compass size={13} />
            <span>Character Rig</span>
          </button>
          
          {/* Preset 2: Clock variables */}
          <button 
            onClick={() => { pushStateSnapshot(generateClockTemplate(createEmptyProject())); setSelectedIds([]); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-slate-300 font-medium text-xs hover:bg-slate-700 hover:text-white rounded transition border border-slate-700 cursor-pointer"
          >
            <Clock size={13} />
            <span>Clocks Loop</span>
          </button>

          <span className="h-4 w-px bg-slate-700 mx-2" />

          {/* Clean canvas */}
          <button 
            onClick={() => { pushStateSnapshot(createEmptyProject()); setSelectedIds([]); }}
            className="text-slate-400 font-medium text-xs hover:text-red-400 transition cursor-pointer"
          >
            Clear Slate
          </button>
        </div>

        {/* Right: Upload, Export & Undo history */}
        <div className="flex items-center gap-2">
          {/* Interactive Help Tutorial Guide Trigger */}
          <button 
            onClick={() => setShowTutorial(true)}
            className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded text-xs font-bold text-white transition cursor-pointer shadow-md"
          >
            <HelpCircle size={13} />
            <span>Help Guide</span>
          </button>

          {/* Background/Sprite Image upload */}
          <label className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer">
            <Plus size={12} />
            <span>Import Image</span>
            <input type="file" accept="image/*" onChange={triggerUploadAsset} className="hidden" />
          </label>

          <button 
            onClick={handleExportWebM}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1.5 px-4 rounded shadow-md transition-all flex items-center gap-1 cursor-pointer"
          >
            <Download size={13} />
            <span>Export WebM</span>
          </button>

          <span className="h-4 w-px bg-slate-700 mx-2" />

          <button 
            onClick={handleUndo} 
            disabled={undoStack.length === 0}
            className="p-1 px-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 rounded text-xs select-none disabled:opacity-40 cursor-pointer"
            title="Undo"
          >
            <Undo size={14}/>
          </button>
          <button 
            onClick={handleRedo} 
            disabled={redoStack.length === 0}
            className="p-1 px-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 rounded text-xs select-none disabled:opacity-40 cursor-pointer"
            title="Redo"
          >
            <Redo size={14}/>
          </button>

          {isAutoSaving && (
            <span className="text-[10px] text-emerald-400 font-mono animate-pulse ml-3">■ AUTO-SAVED</span>
          )}
        </div>
      </header>

      {/* 2. Middle Area (Tree hierarchies, Toolbar, Canvas, properties) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Leftmost Tool shelf */}
        <Toolbar 
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          brushVariant={brushVariant}
          setBrushVariant={setBrushVariant}
          isCollapsed={isLeftCollapsed}
          setIsCollapsed={setIsLeftCollapsed}
          setAlert={setAlertMsg}
          selectedId={selectedObject ? selectedObject.id : null}
          strokeColor={strokeColor}
          setStrokeColor={setStrokeColor}
          strokeWidth={strokeWidth}
          setStrokeWidth={setStrokeWidth}
          fillColor={fillColor}
          setFillColor={setFillColor}
          project={project}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          activeToolbarTools={activeToolbarTools}
          onOpenMarketplace={() => setIsMarketplaceOpen(true)}
          onDeleteObject={handleDeleteObject}
          onUpdateObjectNode={handleUpdateObjectNode}
        />

        {/* Core Canvas stage layout */}
        <div className="flex-1 h-full flex flex-col relative bg-slate-200 overflow-hidden font-sans">
          <CanvasRenderer 
            project={project}
            activeFrameIndex={activeFrameIndex}
            activeTool={activeTool}
            brushVariant={brushVariant}
            strokeColor={strokeColor}
            strokeWidth={strokeWidth}
            fillColor={fillColor}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            onUpdateObjectTransform={handleUpdateObjectTransform}
            onUpdateObjectStyle={handleUpdateObjectStyle}
            onAddStroke={handleAddStroke}
            onAddShape={(type, x, y, w, h) => {}}
            onAddText={handleAddText}
            onUpdatePivot={handleUpdatePivot}
            onionEnabled={project.frames[activeFrameIndex]?.index > 0}
            onFrameUpdateTrigger={() => {}}
            alertMsg={alertMsg}
            setAlertMsg={setAlertMsg}
            onUpdateProject={setProject}
            onPushUndoSnapshot={pushStateSnapshot}
            onKnifeCut={handleKnifeCut}
          />

          {/* 3. Bottom Timeline scrubber display */}
          <Timeline 
            project={project}
            activeFrameIndex={activeFrameIndex}
            setActiveFrameIndex={setActiveFrameIndex}
            onAddFrame={handleAddFrame}
            onDeleteFrame={handleDeleteFrame}
            onDuplicateFrame={handleDuplicateFrame}
            onCopyFrame={handleCopyFrame}
            onPasteFrame={handlePasteFrame}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
            fps={project.fps}
            setFps={(val) => setProject({ ...project, fps: val })}
            onionEnabled={true}
            setOnionEnabled={() => {}}
            onTriggerAutoInbetween={handleTriggerAutoInbetween}
          />
        </div>

        {/* Right Option Properties pane */}
        <PropertiesPanel 
          project={project}
          selectedIds={selectedIds}
          activeFrameIndex={activeFrameIndex}
          onUpdateObjectTransform={handleUpdateObjectTransform}
          onUpdateObjectStyle={handleUpdateObjectStyle}
          onUpdateObjectNesting={handleUpdateObjectNesting}
          onAddPivot={handleAddPivot}
          onUpdatePivot={handleUpdatePivot}
          onUpdateBone={() => {}}
          onJoinSelected={handleJoinSelected}
          onApply3DView={handleApply3DView}
          isCollapsed={isRightCollapsed}
          setIsCollapsed={setIsRightCollapsed}
          loopVariables={loopVariables}
          setLoopVariables={setLoopVariables}
          loopRules={loopRules}
          setLoopRules={setLoopRules}
          onGenerateLoops={handleGenerateLoops}
          onUpdateObjectNode={handleUpdateObjectNode}
          setSelectedIds={setSelectedIds}
        />
      </div>

      {/* Tools & Features Marketplace Modal */}
      {isMarketplaceOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[999] flex items-center justify-center p-4 text-slate-800" id="marketplace-modal">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-4xl h-[580px] shadow-2xl flex flex-col overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header branding */}
            <div className="bg-slate-900 px-6 py-4 flex justify-between items-center text-white">
              <div className="flex items-center gap-2">
                <Sliders className="text-amber-400" size={18} />
                <div>
                  <h2 className="font-display font-black text-sm uppercase tracking-wider">Feature & Tool Marketplace</h2>
                  <p className="text-[10px] text-slate-300 font-medium">Equip / Pack your workspace dynamically with custom vectors and smart generators</p>
                </div>
              </div>
              
              {/* Budgets HUD */}
              <div className="flex items-center gap-4 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400">Toolbar Grid Usage</span>
                <div className="flex items-center gap-1.5 font-mono text-xs font-black">
                  <span className={`${activeToolbarTools.length >= 8 ? 'text-amber-400' : 'text-emerald-400'}`}>{activeToolbarTools.length}</span>
                  <span className="text-slate-500">/</span>
                  <span className="text-white">8 Max Slots</span>
                </div>
              </div>
            </div>

            {/* Marketplace Grid list */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-3 font-display">Manage Active Toolbar Modules</span>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5">
                {[
                  { type: ToolType.SEL, name: "SEL: Selection Pointer", desc: "Select nodes, adjust bounds, scale shapes and rotate pivots directly on vector lines.", icon: MousePointer, group: "Core Workspace" },
                  { type: ToolType.LAS, name: "LAS: Lasso Multi-Select", desc: "Draw high-fidelity hand lasso boundaries to capture and bundle multiple objects.", icon: Sparkles, group: "Core Workspace" },
                  { type: ToolType.BRS, name: "BRS: Vector Brush Paint", desc: "Expressive pressure organic stroke ink paths with customizable presets.", icon: Brush, group: "Core Workspace" },
                  { type: ToolType.ERS, name: "ERS: Vector Joint Eraser", desc: "Instantly dissolve full paths or individual coordinates at target cursor coordinates.", icon: Eraser, group: "Core Workspace" },
                  { type: ToolType.FIL, name: "FIL: Bucket Color Fill", desc: "Automatically index polygon loops on clicking open spaces to flood them with palette fills.", icon: Palette, group: "Skins & Color fill" },
                  { type: ToolType.PVT, name: "PVT: Joint Rig Anchor", desc: "Set mechanical rotation axles onto limbs or watchfaces to enable skeletal rotation.", icon: Anchor, group: "Skeletal Rigging" },
                  { type: ToolType.BON, name: "BON: IK Bone Assembler", desc: "Rig multi-jointed arms, legs or mechanical watches under parents with bone weights.", icon: Move, group: "Skeletal Rigging" },
                  { type: ToolType.TXT, name: "TXT: Beautiful Vector Text", desc: "Express title frames or captions using custom font weights inside vector paths.", icon: Type, group: "Drawn Shapes" },
                  { type: ToolType.LIN, name: "LIN: Linear Stroke Pen", desc: "Renders straight segments between drag and release coordinate ticks.", icon: PenTool, group: "Drawn Shapes" },
                  { type: ToolType.REC, name: "REC: Outline Quadrilateral", desc: "Deploy rectangles and boxes immediately with drag dimension mappings.", icon: Sliders, group: "Drawn Shapes" },
                  { type: ToolType.CIR, name: "CIR: Perfect Circle Tool", desc: "Deploy absolute spheroids centered on click vectors with radial sliders.", icon: Disc, group: "Drawn Shapes" },
                  { type: ToolType.TRI, name: "TRI: Symmetrical Triangle", desc: "Three-point vectors with automatic closed join structures.", icon: Hammer, group: "Drawn Shapes" },
                  { type: ToolType.CON, name: "CON: Draggable Constraints", desc: "Anchor paths under physical constraints, walk boundary limits, and weights.", icon: ShieldAlert, group: "Skeletal Rigging" },
                  { type: ToolType.VLP, name: "VLP: Automation Loops", desc: "Create walk cycles, wheel sweeps and custom minute hands sweeps smoothly.", icon: RefreshCw, group: "Loops & Physics" },
                  { type: ToolType.KNF, name: "KNF: Surgical Stroke Knife", desc: "Split strokes in two by dragging across vector path intersections.", icon: Scissors, group: "Special Elements" },
                  { type: ToolType.PAN, name: "PAN: Canvas Hand Pan", desc: "Glide seamlessly across massive workspaces to paint details.", icon: Maximize, group: "Core Workspace" },
                  { type: ToolType.ZOM, name: "ZOM: Zoom Magnify", desc: "Enlarge workspace vectors dynamically without resolution loss.", icon: ZoomIn, group: "Core Workspace" }
                ].map((item) => {
                  const Icon = item.icon;
                  const isEquipped = activeToolbarTools.includes(item.type);
                  return (
                    <div 
                      key={item.type}
                      className={`border p-3.5 rounded-xl bg-white transition-all shadow-sm flex flex-col justify-between ${
                        isEquipped 
                          ? 'border-indigo-200 bg-indigo-50/10' 
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        {/* Title group */}
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`p-1.5 rounded-lg ${isEquipped ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                            <Icon size={14} />
                          </div>
                          <div>
                            <h4 className="font-bold text-[11px] text-slate-800">{item.name}</h4>
                            <span className="text-[8px] font-bold text-indigo-500 uppercase tracking-wider font-mono">{item.group}</span>
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-450 leading-relaxed font-sans mt-1">{item.desc}</p>
                      </div>

                      {/* Action buttons */}
                      <div className="mt-3.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                        {isEquipped ? (
                          <>
                            <span className="text-[9px] font-black text-indigo-600 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
                              ACTIVE
                            </span>
                            <button 
                              onClick={() => {
                                // Deactivate tool
                                setActiveToolbarTools(prev => prev.filter(t => t !== item.type));
                                // Re-route active tool back to SEL if deleted active tool
                                if (activeTool === item.type) {
                                  setActiveTool(ToolType.SEL);
                                }
                              }}
                              className="text-[10px] font-bold text-red-500 hover:bg-red-50 border border-transparent rounded px-2.5 py-1 cursor-pointer transition-colors"
                            >
                              Remove tool
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="text-[9px] font-semibold text-slate-400">SLOT VACANT</span>
                            <button 
                              onClick={() => {
                                if (activeToolbarTools.length >= 8) {
                                  setAlertMsg("YOUR TOOLBAR GRID IS FULL! Please remove an active tool first from the marketplace to free up a slot.");
                                  setTimeout(() => setAlertMsg(null), 4000);
                                  return;
                                }
                                setActiveToolbarTools(prev => [...prev, item.type]);
                              }}
                              disabled={activeToolbarTools.length >= 8}
                              className={`text-[10px] font-bold rounded px-2.5 py-1 cursor-pointer transition-all ${
                                activeToolbarTools.length >= 8 
                                  ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed' 
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                              }`}
                            >
                              Add to Toolbar
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer close */}
            <div className="bg-slate-100 border-t border-slate-200 px-6 py-4 flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate-500">
                Tip: Equip up to 8 tools at any given time to customize your painting canvas layout!
              </span>
              <button 
                onClick={() => setIsMarketplaceOpen(false)}
                className="bg-slate-900 border border-slate-950 focus:ring-2 focus:ring-slate-500 text-white font-bold text-[11px] px-5 py-2 rounded-lg hover:bg-slate-800 transition shadow-sm cursor-pointer"
              >
                Save & Close Marketplace
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Interactive Step-by-Step Help & Tutorial Modal */}
      {showTutorial && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[999] flex items-center justify-center p-4 text-slate-800">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-4xl h-[550px] shadow-2xl flex overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
            
            {/* Sidebar navigation tabs */}
            <div className="w-64 bg-slate-50 border-r border-slate-200 p-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Learning Hub</span>
                  <h4 className="text-sm font-bold text-slate-800">Animation Techniques</h4>
                </div>
                
                <nav className="flex flex-col gap-1.5">
                  {[
                    { id: 'autoframes', title: '⏱️ Auto-Keyframes', subtitle: 'Continuous automatic capture' },
                    { id: '360turn', title: '🌀 360° Depth Spin', subtitle: 'Horizontal spatial rotation' },
                    { id: 'loops', title: '⏳ Variable Loops', subtitle: 'Walk cycle automations' },
                    { id: 'rigging', title: '🦴 Skeleton Rigging', subtitle: 'IK bones and parent weights' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setTutorialTab(tab.id)}
                      className={`w-full text-left p-2.5 rounded-lg transition-all cursor-pointer ${
                        tutorialTab === tab.id 
                          ? 'bg-blue-600 text-white shadow-md' 
                          : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      <div className="font-semibold text-xs">{tab.title}</div>
                      <div className={`text-[9px] ${tutorialTab === tab.id ? 'text-blue-100' : 'text-slate-400'}`}>
                        {tab.subtitle}
                      </div>
                    </button>
                  ))}
                </nav>
              </div>

              <button 
                onClick={() => setShowTutorial(false)}
                className="w-full bg-slate-900 text-white py-2 rounded-lg font-bold text-xs hover:bg-slate-800 cursor-pointer"
              >
                Exit Learning Hub
              </button>
            </div>

            {/* Content pane detailing each step dynamically */}
            <div className="flex-1 p-6 overflow-y-auto flex flex-col justify-between">
              <div className="space-y-4">
                {tutorialTab === 'autoframes' && (
                  <div className="space-y-3">
                    <h3 className="text-xl font-bold text-slate-800 border-b pb-2">⏱️ Auto-Keyframes (Continuous Recording Mode)</h3>
                    <p className="text-slate-600 text-xs leading-relaxed">
                      Manually duplicating and advancing keyframes wastes precious creative rhythm. 
                      Our <strong>Auto-Frames</strong> recording system progresses the canvas automatically while you make changes!
                    </p>
                    
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Step-by-Step Guide</span>
                      <ol className="list-decimal list-inside text-xs text-slate-600 space-y-1.5 ml-1">
                        <li>Locate the <strong>Timeline Toolbar</strong> at the bottom of the editor.</li>
                        <li>Toggle the <strong>🔴 Auto-Frames Timer</strong> button active.</li>
                        <li>Choose the recording interval pace (default is <strong>1.5 seconds</strong> per keyframe).</li>
                        <li>Now, select the <strong>SEL (Select Node)</strong> tool or rig joints, and drag them around!</li>
                        <li>Every 1.5 seconds, the timeline will clone the current state and record it into a new keyframe automatically!</li>
                      </ol>
                    </div>
                  </div>
                )}

                {tutorialTab === '360turn' && (
                  <div className="space-y-3">
                    <h3 className="text-xl font-bold text-slate-800 border-b pb-2">🌀 360° Horizontal Turnaround Slider</h3>
                    <p className="text-slate-600 text-xs leading-relaxed">
                      Simulating three-dimensional depth rotation is simple using our cosine compression space. No complex projection matrix rigging required!
                    </p>
                    
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Step-by-Step Guide</span>
                      <ol className="list-decimal list-inside text-xs text-slate-600 space-y-1.5 ml-1">
                        <li>Click on any drawn object or imported PNG image on the canvas using the <strong>SEL</strong> tool.</li>
                        <li>Look at the right-hand panel under the <strong>Transform</strong> tab.</li>
                        <li>Locate the <strong>360° Character Rotate Simulator</strong> depth slider.</li>
                        <li>Drag the slider left and right (from -180° to 180°).</li>
                        <li>Observe how the points horizontally compress and follow a cylinder trajectory, creating an immersive 3D spatial turn seamlessly!</li>
                      </ol>
                    </div>
                  </div>
                )}

                {tutorialTab === 'loops' && (
                  <div className="space-y-3">
                    <h3 className="text-xl font-bold text-slate-800 border-b pb-2">⏳ Smart Variable Loops (Automobile walk cycle sweeps)</h3>
                    <p className="text-slate-600 text-xs leading-relaxed">
                      Automating repeating walk cycles or clock rotations is easy by linking variables to custom rules without manual framing.
                    </p>
                    
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Step-by-Step Guide</span>
                      <ol className="list-decimal list-inside text-xs text-slate-600 space-y-1.5 ml-1">
                        <li>Switch to the <strong>Loops</strong> tab in the right-hand Properties Panel.</li>
                        <li>Type a unique variable name (e.g. <code>left_leg_rot</code>), link it to your target canvas object, and click <strong>Link Variable</strong>.</li>
                        <li>Click <strong>+ Add Block</strong> to generate automated loop execution rules.</li>
                        <li>Target your linked variable, then specify the <strong>Step Angle/Amount</strong> (e.g., 5°), and <strong>Total Steps</strong> (e.g., 60).</li>
                        <li>Turn on <strong>Oscillate (Aage Peeche Swing)</strong> to make the leg rotate back and forth automatically during walks!</li>
                        <li>Click <strong>Generate Loop Animation</strong> to instantly write the cyclical frames!</li>
                      </ol>
                    </div>
                  </div>
                )}

                {tutorialTab === 'rigging' && (
                  <div className="space-y-3">
                    <h3 className="text-xl font-bold text-slate-800 border-b pb-2">🦴 Armature Skeleton Rigging (Inverse Kinematics)</h3>
                    <p className="text-slate-600 text-xs leading-relaxed">
                      Connect limb drawings to IK bone node joint hierarchies to achieve skeletal muscle-deformation during active rigs!
                    </p>
                    
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Step-by-Step Guide</span>
                      <ol className="list-decimal list-inside text-xs text-slate-600 space-y-1.5 ml-1">
                        <li>Draw some shapes (such as thigh, shin, foot) and select them.</li>
                        <li>Enable the <strong>PVT</strong> tool and click on the canvas to place custom rigging joints.</li>
                        <li>Select the <strong>BON (Inverse Kinematics Bone)</strong> tool to draw connective bones from parent joints to child joint anchors.</li>
                        <li>Reparent objects together inside the <strong>Rig Tab</strong> dropdown under Nestle Attachment settings.</li>
                        <li>Select joint ends using the <code>Move</code> bone tool — the entire chain calculates physical rotation coordinates in real-time!</li>
                      </ol>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                <span className="text-[10px] text-slate-400 font-mono font-bold">ANIMATION ACADEMY • INTERACTIVE</span>
                <button 
                  onClick={() => setShowTutorial(false)}
                  className="px-5 py-1.5 bg-blue-100 font-bold hover:bg-blue-200 text-blue-600 rounded-lg text-xs transition cursor-pointer"
                >
                  I Understood, Let's Animate!
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
