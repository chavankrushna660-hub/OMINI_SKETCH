import React, { useState } from 'react';
import { 
  ProjectState, ObjectNode, ToolType, LoopRule, LoopVariable, StyleState,
  TransformState, PivotNode, BoneNode, ShapeType
} from '../types';
import { 
  Sliders, Settings, Plus, Minus, RotateCcw, Link2, 
  Trash2, ShieldAlert, Cpu, Palette, RefreshCw, Eye, EyeOff, Lock, Unlock, HelpCircle,
  Sparkles, Check, ChevronLeft, ChevronRight, ArrowLeftRight, ArrowUpDown
} from 'lucide-react';
import { project3DView } from '../utils/math';

interface PropertiesPanelProps {
  project: ProjectState;
  selectedIds: string[];
  activeFrameIndex: number;
  onUpdateObjectTransform: (objectId: string, transform: Partial<TransformState>) => void;
  onUpdateObjectStyle: (objectId: string, style: Partial<StyleState>) => void;
  onUpdateObjectNesting: (objectId: string, parentId: string | null) => void;
  onAddPivot: (objectId: string, name: string) => void;
  onUpdatePivot: (objectId: string, pivotId: string, updates: Partial<PivotNode>) => void;
  onUpdateBone: (boneId: string, updates: Partial<BoneNode>) => void;
  onJoinSelected: () => void;
  onApply3DView: (view: 'front' | 'left' | 'right' | 'top' | 'bottom') => void;
  isCollapsed: boolean;
  setIsCollapsed: (c: boolean) => void;
  loopVariables: LoopVariable[];
  setLoopVariables: React.Dispatch<React.SetStateAction<LoopVariable[]>>;
  loopRules: LoopRule[];
  setLoopRules: React.Dispatch<React.SetStateAction<LoopRule[]>>;
  onGenerateLoops: () => void;

  // Added parent state handlers
  onUpdateObjectNode: (objectId: string, updates: Partial<ObjectNode>) => void;
  setSelectedIds: (ids: string[]) => void;
}

export default function PropertiesPanel({
  project,
  selectedIds,
  activeFrameIndex,
  onUpdateObjectTransform,
  onUpdateObjectStyle,
  onUpdateObjectNesting,
  onAddPivot,
  onUpdatePivot,
  onUpdateBone,
  onJoinSelected,
  onApply3DView,
  isCollapsed,
  setIsCollapsed,
  loopVariables,
  setLoopVariables,
  loopRules,
  setLoopRules,
  onGenerateLoops,
  onUpdateObjectNode,
  setSelectedIds
}: PropertiesPanelProps) {
  
  const [activeTab, setActiveTab] = useState<'transform' | 'smart' | 'rig' | 'loops'>('transform');
  const [pivotSize, setPivotSize] = useState<number>(20);
  const [smartSearch, setSmartSearch] = useState<string>('');

  // Local rule editor state
  const [newVarName, setNewVarName] = useState('');
  const [newVarObj, setNewVarObj] = useState('');
  const [newVarProp, setNewVarProp] = useState<'rotation' | 'x' | 'y'>('rotation');

  const selectedObject = selectedIds.length === 1 ? project.objects[selectedIds[0]] : null;

  // Resolve world coordinates for selected objects
  const getObjectTransform = (objectId: string): TransformState => {
    return project.frames[activeFrameIndex]?.objects[objectId]?.transform || { x: 400, y: 250, rotation: 0, scaleX: 1, scaleY: 1 };
  };

  const currentTransform = selectedObject ? getObjectTransform(selectedObject.id) : { x: 400, y: 250, rotation: 0, scaleX: 1, scaleY: 1 };

  // Nudge / fine coordinate offsets helper
  const handleNudge = (property: 'x' | 'y' | 'rotation' | 'scaleX' | 'scaleY' | 'depth360', direction: 'up' | 'down') => {
    if (!selectedObject) return;
    const currentVal = currentTransform[property] || 0;
    
    let step = 1;
    if (property.startsWith('scale')) step = 0.05;
    else if (property === 'rotation') step = 5;
    else if (property === 'depth360') step = 15;

    const delta = direction === 'up' ? step : -step;
    onUpdateObjectTransform(selectedObject.id, {
      [property]: Math.round((currentVal + delta) * 100) / 100
    });
  };

  const handleFlipHorizontal = (id?: string) => {
    const targetId = id || selectedObject?.id;
    if (!targetId) return;
    const trans = getObjectTransform(targetId);
    onUpdateObjectTransform(targetId, {
      scaleX: (trans.scaleX || 1) * -1
    });
  };

  const handleFlipVertical = (id?: string) => {
    const targetId = id || selectedObject?.id;
    if (!targetId) return;
    const trans = getObjectTransform(targetId);
    onUpdateObjectTransform(targetId, {
      scaleY: (trans.scaleY || 1) * -1
    });
  };

  const handleInvertAngle = (id?: string) => {
    const targetId = id || selectedObject?.id;
    if (!targetId) return;
    const trans = getObjectTransform(targetId);
    onUpdateObjectTransform(targetId, {
      rotation: (trans.rotation || 0) * -1
    });
  };

  const addVariable = () => {
    if (!newVarName || !newVarObj) return;
    setLoopVariables([...loopVariables, {
      name: newVarName.trim(),
      linkedObjectId: newVarObj,
      property: newVarProp,
      currentValue: 0
    }]);
    setNewVarName('');
  };

  const addRule = () => {
    const freshId = `rule_${Math.random().toString(36).substr(2, 9)}`;
    const newRule: LoopRule = {
      id: freshId,
      name: `Loop_${loopRules.length + 1}`,
      targetVariable: loopVariables[0]?.name || '',
      action: 'add',
      amountPerStep: 6,
      oscillate: false,
      delayBeforeStart: 0,
      framesPerStep: 1,
      stopCondition: {
        type: 'after_n_steps',
        steps: 60
      }
    };
    setLoopRules([...loopRules, newRule]);
  };

  const updateRule = (id: string, updates: Partial<LoopRule>) => {
    setLoopRules(loopRules.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const removeRule = (id: string) => {
    setLoopRules(loopRules.filter(r => r.id !== id));
  };

  // Filter smart objects list
  const smartObjects = Object.values(project.objects).filter(obj => 
    obj.pinSC && obj.name.toLowerCase().includes(smartSearch.toLowerCase())
  );

  return (
    <div className={`relative border-l border-slate-200 bg-slate-50 h-full flex flex-col flex-shrink-0 panel-transition ${isCollapsed ? 'w-0' : 'w-80'}`}>
      
      {/* Collapse Trigger Button for Right Panel */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute top-1/2 -left-4 -translate-y-1/2 bg-slate-100 hover:bg-slate-200 border border-slate-300 w-4 h-12 rounded-l-md flex items-center justify-center text-slate-500 shadow-sm z-50 cursor-pointer"
        title={isCollapsed ? "Expand Properties" : "Collapse Properties"}
      >
        {isCollapsed ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
      </button>

      {!isCollapsed && (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          
          {/* Header Tab Layout */}
          <div className="p-3 bg-slate-100 border-b border-slate-200 select-none">
            <div className="flex bg-slate-200 p-0.5 rounded-lg border border-slate-300">
              {(['transform', 'smart', 'rig', 'loops'] as const).map(tab => (
                <button 
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-1 text-[11px] text-center font-bold font-display rounded-md transition-all cursor-pointer ${
                    activeTab === tab 
                      ? 'bg-indigo-600 text-white shadow' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab === 'transform' ? 'Transform' : tab === 'smart' ? 'Smart Controls' : tab === 'rig' ? 'Rig' : 'Loops'}
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable Container */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-xs">
            
            {/* TAB 1: Transform & Styling */}
            {activeTab === 'transform' && (
              <div className="flex flex-col gap-4">
                {selectedObject ? (
                  <>
                    <div className="border border-slate-200 rounded-lg p-3 bg-white shadow-sm">
                      <span className="font-display font-bold text-slate-800 block text-xs uppercase tracking-wider mb-2">{selectedObject.name} Properties</span>
                      <span className="text-[9px] font-mono text-slate-400 block mb-3 border-b pb-1.5">ID_VAL: {selectedObject.id}</span>

                      {/* Coordinate slider widgets */}
                      <div className="flex flex-col gap-3">
                        {/* Position X */}
                        <div>
                          <div className="flex justify-between font-bold text-slate-500 mb-1">
                            <span>Position X</span>
                            <span className="font-mono text-indigo-600">{currentTransform.x}px</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => handleNudge('x', 'down')} className="p-1 border border-slate-250 bg-slate-100 rounded hover:bg-slate-200 flex-shrink-0 cursor-pointer"><Minus size={11}/></button>
                            <input 
                              type="range" min="0" max="800" step="1" value={currentTransform.x} 
                              onChange={(e) => onUpdateObjectTransform(selectedObject.id, { x: parseInt(e.target.value) })}
                              className="flex-1 h-1 bg-slate-250 rounded appearance-none cursor-pointer accent-indigo-600"
                            />
                            <button onClick={() => handleNudge('x', 'up')} className="p-1 border border-slate-250 bg-slate-100 rounded hover:bg-slate-200 flex-shrink-0 cursor-pointer"><Plus size={11}/></button>
                          </div>
                        </div>

                        {/* Position Y */}
                        <div>
                          <div className="flex justify-between font-bold text-slate-500 mb-1">
                            <span>Position Y</span>
                            <span className="font-mono text-indigo-600">{currentTransform.y}px</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => handleNudge('y', 'down')} className="p-1 border border-slate-250 bg-slate-100 rounded hover:bg-slate-200 flex-shrink-0 cursor-pointer"><Minus size={11}/></button>
                            <input 
                              type="range" min="0" max="500" step="1" value={currentTransform.y} 
                              onChange={(e) => onUpdateObjectTransform(selectedObject.id, { y: parseInt(e.target.value) })}
                              className="flex-1 h-1 bg-slate-250 rounded appearance-none cursor-pointer accent-indigo-600"
                            />
                            <button onClick={() => handleNudge('y', 'up')} className="p-1 border border-slate-250 bg-slate-100 rounded hover:bg-slate-200 flex-shrink-0 cursor-pointer"><Plus size={11}/></button>
                          </div>
                        </div>

                        {/* Rotation Angle */}
                        <div>
                          <div className="flex justify-between font-bold text-slate-500 mb-1">
                            <span>Rotation Angle</span>
                            <span className="font-mono text-indigo-600">{currentTransform.rotation}°</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => handleNudge('rotation', 'down')} className="p-1 border border-slate-250 bg-slate-100 rounded hover:bg-slate-200 flex-shrink-0 cursor-pointer"><Minus size={11}/></button>
                            <input 
                              type="range" min="-180" max="180" step="1" value={currentTransform.rotation} 
                              onChange={(e) => onUpdateObjectTransform(selectedObject.id, { rotation: parseInt(e.target.value) })}
                              className="flex-1 h-1 bg-slate-250 rounded appearance-none cursor-pointer accent-indigo-600"
                            />
                            <button onClick={() => handleNudge('rotation', 'up')} className="p-1 border border-slate-250 bg-slate-100 rounded hover:bg-slate-200 flex-shrink-0 cursor-pointer"><Plus size={11}/></button>
                          </div>
                        </div>

                        {/* Scale X representation */}
                        <div>
                          <div className="flex justify-between font-bold text-slate-500 mb-1">
                            <span>Scale X (Stretch)</span>
                            <span className="font-mono text-indigo-600">{currentTransform.scaleX}x</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => handleNudge('scaleX', 'down')} className="p-1 border border-slate-250 bg-slate-100 rounded hover:bg-slate-200 flex-shrink-0 cursor-pointer"><Minus size={11}/></button>
                            <input 
                              type="range" min="-3" max="3" step="0.05" value={currentTransform.scaleX} 
                              onChange={(e) => onUpdateObjectTransform(selectedObject.id, { scaleX: parseFloat(e.target.value) })}
                              className="flex-1 h-1 bg-slate-250 rounded appearance-none cursor-pointer accent-indigo-600"
                            />
                            <button onClick={() => handleNudge('scaleX', 'up')} className="p-1 border border-slate-250 bg-slate-100 rounded hover:bg-slate-200 flex-shrink-0 cursor-pointer"><Plus size={11}/></button>
                          </div>
                        </div>

                        {/* Scale Y representation */}
                        <div>
                          <div className="flex justify-between font-bold text-slate-500 mb-1">
                            <span>Scale Y (Stretch)</span>
                            <span className="font-mono text-indigo-600">{currentTransform.scaleY}x</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => handleNudge('scaleY', 'down')} className="p-1 border border-slate-250 bg-slate-100 rounded hover:bg-slate-200 flex-shrink-0 cursor-pointer"><Minus size={11}/></button>
                            <input 
                              type="range" min="-3" max="3" step="0.05" value={currentTransform.scaleY} 
                              onChange={(e) => onUpdateObjectTransform(selectedObject.id, { scaleY: parseFloat(e.target.value) })}
                              className="flex-1 h-1 bg-slate-250 rounded appearance-none cursor-pointer accent-indigo-600"
                            />
                            <button onClick={() => handleNudge('scaleY', 'up')} className="p-1 border border-slate-250 bg-slate-100 rounded hover:bg-slate-200 flex-shrink-0 cursor-pointer"><Plus size={11}/></button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* NEW SECTION: OPPOSITE FEATURES (Mirror / Flips) */}
                    <div className="border border-slate-200 rounded-lg p-3 bg-white shadow-sm flex flex-col gap-2">
                      <span className="font-display font-semibold text-slate-700 block text-[11px] uppercase tracking-wider mb-1">Opposite & Mirror Tools</span>
                      <span className="text-slate-400 text-[9px] block mb-2">Instantly flip geometry scales or swap orientation paths.</span>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button 
                          onClick={() => handleFlipHorizontal()}
                          className="flex flex-col items-center justify-center p-2 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-650 border border-slate-200 hover:border-indigo-200 rounded select-none cursor-pointer transition-colors"
                          title="Flip Horizontal (Opposite Facing)"
                        >
                          <ArrowLeftRight size={14} className="mb-0.5" />
                          <span className="text-[9px] font-bold">Flip X</span>
                        </button>
                        <button 
                          onClick={() => handleFlipVertical()}
                          className="flex flex-col items-center justify-center p-2 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-650 border border-slate-200 hover:border-indigo-200 rounded select-none cursor-pointer transition-colors"
                          title="Flip Vertical (Upside Down)"
                        >
                          <ArrowUpDown size={14} className="mb-0.5" />
                          <span className="text-[9px] font-bold">Flip Y</span>
                        </button>
                        <button 
                          onClick={() => handleInvertAngle()}
                          className="flex flex-col items-center justify-center p-2 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-650 border border-slate-200 hover:border-indigo-200 rounded select-none cursor-pointer transition-colors"
                          title="Invert Angle (Opposite pose angle)"
                        >
                          <RotateCcw size={14} className="mb-0.5" />
                          <span className="text-[9px] font-bold">Invert Rot</span>
                        </button>
                      </div>
                    </div>

                    {/* 2D to 3D view projection panel */}
                    <div className="border border-slate-200 rounded-lg p-3 bg-white shadow-sm flex flex-col gap-3">
                      <div>
                        <span className="font-display font-semibold text-slate-700 block text-xs uppercase tracking-wider mb-1">🌀 360° Horizontal Turnaround</span>
                        <span className="text-slate-400 text-[10px] block mb-2">Simulate real circular turn horizontally. Drag to spin!</span>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => handleNudge('depth360', 'down')} className="p-1 border border-slate-250 bg-slate-100 rounded hover:bg-slate-200 flex-shrink-0 cursor-pointer"><Minus size={11}/></button>
                          <input 
                            type="range" min="-180" max="180" step="5" value={currentTransform.depth360 || 0} 
                            onChange={(e) => onUpdateObjectTransform(selectedObject.id, { depth360: parseInt(e.target.value) })}
                            className="flex-1 accent-indigo-600 h-1.5 rounded-lg bg-slate-100 cursor-pointer"
                          />
                          <button onClick={() => handleNudge('depth360', 'up')} className="p-1 border border-slate-250 bg-slate-100 rounded hover:bg-slate-200 flex-shrink-0 cursor-pointer"><Plus size={11}/></button>
                          <span className="font-mono text-xs font-bold text-indigo-600 w-10 text-right">{(currentTransform.depth360 || 0)}°</span>
                        </div>
                      </div>

                      <div className="border-t border-slate-100 pt-2">
                        <span className="font-display font-semibold text-slate-500 block mb-1.5 text-[9px] uppercase tracking-wider">Snap Orthographic View Planes</span>
                        <div className="grid grid-cols-5 gap-1 text-center font-semibold">
                          {(['front', 'left', 'right', 'top', 'bottom'] as const).map(v => (
                            <button
                              key={v}
                              onClick={() => {
                                onApply3DView(v);
                                if (v === 'left') onUpdateObjectTransform(selectedObject.id, { depth360: -90 });
                                else if (v === 'right') onUpdateObjectTransform(selectedObject.id, { depth360: 90 });
                                else if (v === 'front') onUpdateObjectTransform(selectedObject.id, { depth360: 0 });
                                else onUpdateObjectTransform(selectedObject.id, { depth360: 0 });
                              }}
                              className="bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-250 rounded p-1 text-[9px] uppercase tracking-wider cursor-pointer font-bold"
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-white border rounded-xl p-8 text-center text-slate-400 font-medium">
                    <p className="mb-2">Select a drawing object on canvas to adjust individual transforms and styling variables.</p>
                    <span className="text-[10px] bg-slate-100 p-1 rounded inline-block text-slate-500">Left Panel Lists all drawing nodes for easy selection on double click!</span>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Smart Controls Panel (NEW! Extremely powerful!) */}
            {activeTab === 'smart' && (
              <div className="flex flex-col gap-3">
                <div className="border border-slate-200 rounded-lg p-3 bg-white shadow-sm">
                  <span className="font-display font-bold text-slate-800 block text-xs uppercase tracking-wider mb-1">SMART CONTROLS CENTRAL</span>
                  <span className="text-slate-400 text-[10px] block mb-2">Quickly rotate and shift drawing objects marked with the stars!</span>
                  
                  <input 
                    type="text" 
                    placeholder="Filter smart widgets..."
                    value={smartSearch}
                    onChange={(e) => setSmartSearch(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 p-1.5 rounded text-[11px] focus:outline-none focus:bg-white mb-2"
                  />

                  {smartObjects.length === 0 ? (
                    <div className="text-center p-6 text-slate-400 italic">
                      No drawing objects pinned to smart controls. Star any drawing in the Left Panel to make its custom control card appear here!
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {smartObjects.map((obj) => {
                        const isSelected = selectedIds.includes(obj.id);
                        const trans = getObjectTransform(obj.id);
                        return (
                          <div 
                            key={obj.id}
                            onClick={() => setSelectedIds([obj.id])}
                            className={`p-2.5 rounded-lg border transition ${
                              isSelected 
                                ? 'bg-indigo-50/50 border-indigo-200' 
                                : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="font-bold text-slate-700">{obj.name}</span>
                              <div className="flex gap-1">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); onUpdateObjectNode(obj.id, { pinSC: false }); }}
                                  className="text-[9px] font-bold text-amber-500 hover:text-slate-400 border border-slate-200 bg-white rounded px-1.5"
                                  title="Unpin from Smart Controls"
                                >
                                  Unstar
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); onUpdateObjectNode(obj.id, { isHidden: !obj.isHidden }); }}
                                  className="p-0.5 hover:bg-slate-200 rounded"
                                >
                                  {obj.isHidden ? <EyeOff size={11} className="text-red-500" /> : <Eye size={11} className="text-slate-500" />}
                                </button>
                              </div>
                            </div>

                            {/* Control sliders inside smart card */}
                            <div className="flex flex-col gap-1.5 mt-2 bg-white rounded border border-slate-100 p-2">
                              {/* Smart rotation slider */}
                              <div>
                                <div className="flex justify-between text-[9px] font-semibold text-slate-400">
                                  <span>Spin Rotation</span>
                                  <span className="text-indigo-600 font-bold">{trans.rotation}°</span>
                                </div>
                                <input 
                                  type="range" min="-180" max="180" step="5" value={trans.rotation} 
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => onUpdateObjectTransform(obj.id, { rotation: parseInt(e.target.value) })}
                                  className="w-full accent-indigo-600 h-1 cursor-pointer"
                                />
                              </div>

                              {/* Smart 360 spin helper if applicable */}
                              <div>
                                <div className="flex justify-between text-[9px] font-semibold text-slate-400">
                                  <span>360° Horizontal Turn</span>
                                  <span className="text-indigo-600 font-bold">{(trans.depth360 || 0)}°</span>
                                </div>
                                <input 
                                  type="range" min="-180" max="180" step="10" value={trans.depth360 || 0} 
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => onUpdateObjectTransform(obj.id, { depth360: parseInt(e.target.value) })}
                                  className="w-full accent-indigo-600 h-1 cursor-pointer"
                                />
                              </div>

                              {/* Smart Nudge controls and Flips */}
                              <div className="flex justify-between items-center gap-1.5 pt-1.5 border-t border-slate-100 mt-1">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleFlipHorizontal(obj.id); }}
                                  className="flex-1 py-0.5 text-[8px] font-bold border rounded bg-slate-50 text-slate-600 hover:bg-slate-100"
                                >
                                  Mirror X
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleFlipVertical(obj.id); }}
                                  className="flex-1 py-0.5 text-[8px] font-bold border rounded bg-slate-50 text-slate-600 hover:bg-slate-100"
                                >
                                  Invert Y
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleInvertAngle(obj.id); }}
                                  className="flex-1 py-0.5 text-[8px] font-bold border rounded bg-slate-50 text-slate-600 hover:bg-slate-100"
                                >
                                  Reverse Rot
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: Rig & Skeletal */}
            {activeTab === 'rig' && (
              <div className="flex flex-col gap-4">
                {selectedObject ? (
                  <div className="border border-slate-200 rounded-lg p-3 bg-white shadow-sm">
                    <span className="font-display font-semibold text-slate-700 block mb-2 text-xs uppercase tracking-wider">Joint Rigging Offsets (Pivot)</span>
                    <p className="text-[10px] text-slate-400 mb-3">Pivots define the rotational origin axes for this skeleton joint.</p>

                    {selectedObject.pivots.map((p, pIdx) => (
                      <div key={p.id} className="border p-2 rounded-lg bg-slate-50 mb-3 text-slate-700">
                        <div className="font-bold flex justify-between items-center mb-2">
                          <span>{p.name}</span>
                          <span className="text-[9px] text-slate-400">Idx: {pIdx}</span>
                        </div>

                        <div className="flex flex-col gap-2">
                          <div>
                            <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                              <span>Anchor Offset X</span>
                              <span className="font-mono">{p.localX}px</span>
                            </div>
                            <input 
                              type="range" min="-180" max="180" step="1" value={p.localX} 
                              onChange={(e) => onUpdatePivot(selectedObject.id, p.id, { localX: parseInt(e.target.value) })}
                              className="w-full accent-blue-600 h-1 bg-slate-200 rounded cursor-pointer"
                            />
                          </div>

                          <div>
                            <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                              <span>Anchor Offset Y</span>
                              <span className="font-mono">{p.localY}px</span>
                            </div>
                            <input 
                              type="range" min="-180" max="180" step="1" value={p.localY} 
                              onChange={(e) => onUpdatePivot(selectedObject.id, p.id, { localY: parseInt(e.target.value) })}
                              className="w-full accent-blue-600 h-1 bg-slate-200 rounded cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className="border-t pt-3 flex flex-col gap-2">
                      <span className="font-display font-semibold text-slate-500 block mb-0.5 uppercase text-[9px] tracking-wider">Hierarchy Skeletal Joins</span>
                      <button 
                        onClick={onJoinSelected}
                        className="w-full bg-indigo-650 hover:bg-indigo-700 text-white font-bold py-1.5 rounded transition text-[11px] cursor-pointer"
                        title="Link selected nodes into pivot dependencies"
                      >
                        🔗 Joint-Rig Selected Nodes
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border rounded-xl p-8 text-center text-slate-400">
                    Rig overrides are active when a single object is selected.
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: Variable Loops */}
            {activeTab === 'loops' && (
              <div className="flex flex-col gap-4">
                {/* Variable registry */}
                <div className="border border-slate-200 rounded-lg p-3 bg-white shadow-sm flex flex-col gap-3">
                  <span className="font-display font-semibold text-slate-700 text-xs uppercase tracking-wider">1. Linked Loop Variables</span>
                  <div className="flex flex-col gap-2">
                    <input 
                      type="text" placeholder="Variable Name (e.g., walk_cycle)" value={newVarName} 
                      onChange={(e) => setNewVarName(e.target.value)}
                      className="bg-slate-50 border p-1 rounded font-mono text-[10px] focus:outline-none focus:bg-white"
                    />
                    <select
                      value={newVarObj}
                      onChange={(e) => setNewVarObj(e.target.value)}
                      className="bg-slate-50 border p-1 rounded text-[10px] focus:outline-none"
                    >
                      <option value="">-- Choose Object --</option>
                      {Object.values(project.objects).map(o => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </select>

                    <button 
                      onClick={addVariable}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 rounded text-[10px] cursor-pointer"
                    >
                      + Register Variable
                    </button>
                  </div>

                  {/* Registered Variables */}
                  {loopVariables.length > 0 && (
                    <div className="mt-2 border-t pt-2 max-h-32 overflow-y-auto flex flex-col gap-1.5">
                      {loopVariables.map((v, i) => (
                        <div key={i} className="flex justify-between items-center text-[10px] bg-slate-50 border p-1 rounded font-mono text-slate-500">
                          <span>{v.name} → {project.objects[v.linkedObjectId]?.name || 'Unknown'}.{v.property}</span>
                          <button 
                            onClick={() => setLoopVariables(loopVariables.filter(x => x.name !== v.name))}
                            className="text-red-500 hover:bg-red-50 p-0.5 rounded cursor-pointer"
                          >
                            <Trash2 size={11}/>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Automation Rules */}
                <div className="border border-slate-200 rounded-lg p-3 bg-white shadow-sm flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <span className="font-display font-semibold text-slate-700 text-xs uppercase tracking-wider">2. Loop Rules Block</span>
                    <button 
                      onClick={addRule}
                      className="bg-slate-100 hover:bg-slate-200 border rounded py-0.5 px-2 text-[10px] font-bold text-slate-600 cursor-pointer"
                    >
                      + Add Rule
                    </button>
                  </div>

                  {loopRules.length > 0 ? (
                    <div className="flex flex-col gap-4">
                      {loopRules.map((rule) => (
                        <div key={rule.id} className="bg-slate-100 p-2.5 rounded-lg border border-slate-200 flex flex-col gap-2 relative">
                          <button 
                            onClick={() => removeRule(rule.id)}
                            className="absolute right-2 top-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded p-0.5 cursor-pointer"
                          >
                            <Trash2 size={12}/>
                          </button>

                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-slate-400">Rule Name</label>
                            <input 
                              type="text" value={rule.name} 
                              onChange={(e) => updateRule(rule.id, { name: e.target.value })}
                              className="bg-white border rounded p-0.5 px-1.5 focus:outline-none font-medium"
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-slate-400 font-display">Target Variable</label>
                            <select
                              value={rule.targetVariable}
                              onChange={(e) => updateRule(rule.id, { targetVariable: e.target.value })}
                              className="bg-white border rounded p-0.5 focus:outline-none"
                            >
                              <option value="">-- Choose Var --</option>
                              {loopVariables.map(v => (
                                <option key={v.name} value={v.name}>{v.name}</option>
                              ))}
                            </select>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-slate-400">Step Angle</label>
                              <input 
                                type="number" value={rule.amountPerStep}
                                onChange={(e) => updateRule(rule.id, { amountPerStep: parseFloat(e.target.value) || 0 })}
                                className="bg-white border rounded p-0.5 w-full text-center"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-slate-400">Total Steps</label>
                              <input 
                                type="number" value={rule.stopCondition.steps || 60}
                                onChange={(e) => updateRule(rule.id, { stopCondition: { type: 'after_n_steps', steps: parseInt(e.target.value) || 60 } })}
                                className="bg-white border rounded p-0.5 w-full text-center"
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-2 mt-1">
                            <input 
                              type="checkbox" checked={rule.oscillate} 
                              onChange={(e) => updateRule(rule.id, { oscillate: e.target.checked })}
                              id={`os-${rule.id}`}
                              className="cursor-pointer"
                            />
                            <label htmlFor={`os-${rule.id}`} className="font-semibold text-slate-600 select-none cursor-pointer">Oscillate (Aage Peeche Swing)</label>
                          </div>
                        </div>
                      ))}

                      <button
                        onClick={onGenerateLoops}
                        disabled={loopVariables.length === 0}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded shadow mt-2 flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <RefreshCw size={12}/> Generate Loop Animation
                      </button>
                    </div>
                  ) : (
                    <p className="text-slate-400 text-center py-4">No rules created. Press Add Rule to create automated clock sweeps or walk cycles.</p>
                  )}
                </div>
              </div>
            )}

          </div>

        </div>
      )}
    </div>
  );
}
