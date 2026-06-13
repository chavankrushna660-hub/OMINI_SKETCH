import React, { useState } from 'react';
import { ProjectState, ObjectNode, ToolType, BrushVariant } from '../types';
import { 
  MousePointer, Scissors, Brush, Eraser, Move, ShieldAlert,
  Type, Palette, Disc, Hammer, ChevronLeft, ChevronRight, PenTool,
  Settings, Maximize, Play, Sliders, RefreshCw, Layers, ZoomIn, 
  Eye, EyeOff, Anchor, Sparkles, Trash2, ShoppingCart, Image as ImageIcon, Text as TextIcon
} from 'lucide-react';

interface ToolbarProps {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  brushVariant: BrushVariant;
  setBrushVariant: (v: BrushVariant) => void;
  isCollapsed: boolean;
  setIsCollapsed: (c: boolean) => void;
  setAlert: (msg: string | null) => void;
  selectedId: string | null;
  strokeColor: string;
  setStrokeColor: (color: string) => void;
  strokeWidth: number;
  setStrokeWidth: (width: number) => void;
  fillColor: string;
  setFillColor: (color: string) => void;
  
  // New props for detailed left panel functionality
  project: ProjectState;
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  activeToolbarTools: ToolType[];
  onOpenMarketplace: () => void;
  onDeleteObject: (id: string) => void;
  onUpdateObjectNode: (id: string, updates: Partial<ObjectNode>) => void;
}

export default function Toolbar({
  activeTool,
  setActiveTool,
  brushVariant,
  setBrushVariant,
  isCollapsed,
  setIsCollapsed,
  setAlert,
  selectedId,
  strokeColor,
  setStrokeColor,
  strokeWidth,
  setStrokeWidth,
  fillColor,
  setFillColor,
  project,
  selectedIds,
  setSelectedIds,
  activeToolbarTools,
  onOpenMarketplace,
  onDeleteObject,
  onUpdateObjectNode
}: ToolbarProps) {
  
  const [layersSearch, setLayersSearch] = useState('');

  // Comprehensive static tools mapping
  const allTools = [
    { type: ToolType.SEL, label: 'SEL', desc: 'Select Object', icon: MousePointer },
    { type: ToolType.LAS, label: 'LAS', desc: 'Lasso Selection', icon: Sparkles },
    { type: ToolType.BRS, label: 'BRS', desc: 'Free Brush Paint', icon: Brush },
    { type: ToolType.ERS, label: 'ERS', desc: 'True Vector Eraser', icon: Eraser },
    { type: ToolType.KNF, label: 'KNF', desc: 'Knife / Stroke Vector Cut', icon: Scissors },
    { type: ToolType.LIN, label: 'LIN', desc: 'Straight Line Maker', icon: PenTool },
    { type: ToolType.REC, label: 'REC', desc: 'Quadrilateral Square', icon: Sliders },
    { type: ToolType.CIR, label: 'CIR', desc: 'Circle Shape Tool', icon: Disc },
    { type: ToolType.TRI, label: 'TRI', desc: 'Triangle Builder', icon: Hammer },
    { type: ToolType.TXT, label: 'TXT', desc: 'Editable Vector Text', icon: Type },
    { type: ToolType.FIL, label: 'FIL', desc: 'Vector Path Color Fill', icon: Palette },
    { type: ToolType.PVT, label: 'PVT', desc: 'Pivot Rigging Anchor', icon: Anchor },
    { type: ToolType.BON, label: 'BON', desc: 'Inverse Kinematics Bone', icon: Move },
    { type: ToolType.CON, label: 'CON', desc: 'Draggable Constraint Guides', icon: ShieldAlert },
    { type: ToolType.VLP, label: 'VLP', desc: 'Variable Automation Loops', icon: RefreshCw },
    { type: ToolType.PAN, label: 'PAN', desc: 'Canvas Pan Mode', icon: Maximize },
    { type: ToolType.ZOM, label: 'ZOM', desc: 'Canvas Zoom Mode', icon: ZoomIn },
  ];

  // Filters tools based on currently active/unlocked tools from Marketplace
  const visibleTools = allTools.filter(t => activeToolbarTools.includes(t.type));

  const handleToolSelect = (tool: ToolType) => {
    // Selection Gatekeeper Rule
    if (selectedId && tool === ToolType.BRS) {
      setAlert("Please unselect drawing first to activate brush paint mode.");
      setTimeout(() => setAlert(null), 3500);
      return;
    }
    // Pivot gatekeeper rule
    if (!selectedId && tool === ToolType.PVT) {
      setAlert("Please select a drawing first to add pivot anchors.");
      setTimeout(() => setAlert(null), 3500);
      return;
    }
    setActiveTool(tool);
  };

  // Get specific SVG icons per drawing type
  const getDrawingIcon = (type: string) => {
    switch (type) {
      case 'image': return <ImageIcon size={13} className="text-pink-500" />;
      case 'text': return <TextIcon size={13} className="text-sky-500" />;
      case 'shape': return <Disc size={13} className="text-emerald-500" />;
      default: return <Brush size={13} className="text-indigo-500" />;
    }
  };

  // Filter project drawings based on search query
  const rawObjects = Object.values(project.objects);
  const filteredDrawings = rawObjects.filter(obj => 
    obj.name.toLowerCase().includes(layersSearch.toLowerCase())
  );

  return (
    <div className={`relative bg-slate-50 border-r border-slate-200 h-full flex flex-col flex-shrink-0 panel-transition ${isCollapsed ? 'w-0 overflow-hidden' : 'w-72'}`}>
      
      {/* Collapse Trigger Button (Pinned to Panel boundary) */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute top-1/2 -right-4 -translate-y-1/2 bg-slate-100 hover:bg-slate-200 border border-slate-300 w-4 h-12 rounded-r-md flex items-center justify-center text-slate-500 shadow-sm z-50 cursor-pointer"
        title={isCollapsed ? "Expand Left Panel" : "Collapse Left Panel"}
      >
        {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {!isCollapsed && (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          
          {/* Main Scroller Area wrapping Toolbar + Drawings tree + Colors */}
          <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-4 text-xs">
            
            {/* Header branding */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-1">
              <span className="font-display font-bold text-slate-700 uppercase tracking-widest text-xs">CREATIVE TOOLS</span>
              <button 
                onClick={onOpenMarketplace}
                className="flex items-center gap-1 px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px] font-bold shadow-sm cursor-pointer transition-all hover:scale-105"
                title="Open Tools & Features Marketplace"
              >
                <ShoppingCart size={11} />
                <span>Marketplace</span>
              </button>
            </div>

            {/* SECTION 1: Active Tools Grid */}
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 select-none flex justify-between">
                <span>Active Toolbar</span>
                <span className="text-indigo-500 lowercase">{visibleTools.length}/8 filled</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 bg-slate-100 p-1.5 rounded-lg border border-slate-200">
                {visibleTools.map((t) => {
                  const Icon = t.icon;
                  const isActive = activeTool === t.type;
                  return (
                    <button
                      key={t.type}
                      id={`tool-${t.type.toLowerCase()}`}
                      onClick={() => handleToolSelect(t.type)}
                      className={`group relative flex flex-col items-center justify-center p-1.5 rounded transition-all text-center cursor-pointer ${
                        isActive 
                          ? 'bg-indigo-600 text-white shadow' 
                          : 'hover:bg-slate-200 text-slate-600'
                      }`}
                      title={t.desc}
                    >
                      <Icon size={14} className="mb-0.5 group-hover:scale-110 transition-transform" />
                      <span className="text-[9px] font-mono font-bold block tracking-tight">{t.label}</span>
                      
                      {/* Hover floating guide */}
                      <div className="hidden group-hover:block absolute left-full ml-2 bg-slate-900 text-white text-[10px] rounded py-0.5 px-2 whitespace-nowrap shadow-lg z-50 pointer-events-none transition-opacity font-normal">
                        {t.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SECTION 2: Drawings & Layers Directory (Direct Selection) */}
            <div className="flex-1 flex flex-col min-h-[160px] max-h-[300px] border border-slate-200 rounded-lg p-2 bg-white mt-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 select-none flex justify-between items-center px-1">
                <span>Drawings Directory</span>
                <span className="font-mono text-[9px] text-slate-500">{filteredDrawings.length} items</span>
              </div>

              {/* Drawing Filter search */}
              <input 
                type="text"
                placeholder="Search drawings..."
                value={layersSearch}
                onChange={(e) => setLayersSearch(e.target.value)}
                className="w-full bg-slate-100 border border-slate-200 rounded px-2 py-1 text-[11px] text-slate-700 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500 mb-2 font-medium"
              />

              {/* Scrollable nodes tree */}
              <div className="flex-1 overflow-y-auto flex flex-col gap-1 pr-1">
                {filteredDrawings.length === 0 ? (
                  <span className="text-[10px] text-slate-400 font-medium italic text-center py-4 block">No drawings found.</span>
                ) : (
                  filteredDrawings.map((obj) => {
                    const isSelected = selectedIds.includes(obj.id);
                    return (
                      <div 
                        key={obj.id}
                        id={`drawing-node-${obj.id}`}
                        onClick={() => setSelectedIds([obj.id])}
                        className={`flex items-center justify-between p-1.5 rounded transition border cursor-pointer ${
                          isSelected 
                            ? 'bg-indigo-50 border-indigo-200 shadow-sm' 
                            : 'hover:bg-slate-50 border-transparent'
                        }`}
                      >
                        {/* Left: Input rename field + icon */}
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <span className="flex-shrink-0">{getDrawingIcon(obj.type)}</span>
                          <input 
                            type="text" 
                            value={obj.name}
                            onClick={(e) => e.stopPropagation()} // retain focus inside input
                            onChange={(e) => onUpdateObjectNode(obj.id, { name: e.target.value })}
                            className={`bg-transparent border-none text-[11px] font-semibold text-slate-700 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded px-1 py-0.5 w-full truncate cursor-pointer focus:cursor-text ${isSelected ? 'text-indigo-900 font-bold' : ''}`}
                            title="Click to select, double click or select input to rename instantly"
                          />
                        </div>

                        {/* Right Actions: Pin, Hide, Delete */}
                        <div className="flex items-center gap-1 flex-shrink-0 pl-1">
                          
                          {/* Pin to Smart Controls indicator */}
                          <button 
                            onClick={(e) => { e.stopPropagation(); onUpdateObjectNode(obj.id, { pinSC: !obj.pinSC }); }}
                            className={`p-0.5 rounded transition ${obj.pinSC ? 'text-amber-500 hover:text-amber-600' : 'text-slate-300 hover:text-slate-400'}`}
                            title={obj.pinSC ? "Pinned to Smart Controls" : "Pin to Smart Controls"}
                          >
                            <Sparkles size={11} />
                          </button>

                          {/* Visibility Eye indicator */}
                          <button 
                            onClick={(e) => { e.stopPropagation(); onUpdateObjectNode(obj.id, { isHidden: !obj.isHidden }); }}
                            className={`p-0.5 rounded transition ${obj.isHidden ? 'text-red-500 hover:text-red-600' : 'text-slate-400 hover:text-slate-500'}`}
                            title={obj.isHidden ? "Show Drawing" : "Hide Drawing"}
                          >
                            {obj.isHidden ? <EyeOff size={11} /> : <Eye size={11} />}
                          </button>

                          {/* Delete drawing object */}
                          <button 
                            onClick={(e) => { e.stopPropagation(); onDeleteObject(obj.id); }}
                            className="p-0.5 text-slate-300 hover:text-red-500 rounded transition"
                            title="Delete Drawing node"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* SECTION 3: Fine Styles Selector & Active Colors */}
            <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50 flex flex-col gap-3">
              
              {/* Brush Preset list if on BRS tool */}
              {activeTool === ToolType.BRS && (
                <div className="flex flex-col gap-1 w-full">
                  <span className="text-[9px] font-bold text-slate-400 tracking-wider">BRUSH VARIANT</span>
                  <select
                    value={brushVariant}
                    onChange={(e) => setBrushVariant(e.target.value as BrushVariant)}
                    className="w-full text-[10px] font-medium bg-white border border-slate-200 rounded py-1 px-1.5 text-slate-700 focus:outline-none focus:border-indigo-500 font-sans cursor-pointer"
                  >
                    {Object.values(BrushVariant).map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Palette settings */}
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Palette Colors</span>
                <div className="flex items-center gap-4 justify-around">
                  {/* Stroke Color */}
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[8px] text-slate-500 font-semibold uppercase">Stroke</span>
                    <div className="relative w-8 h-8 rounded-full border border-slate-300 overflow-hidden shadow-inner hover:scale-105 transition-transform">
                      <input 
                        type="color" 
                        value={strokeColor} 
                        onChange={(e) => setStrokeColor(e.target.value)}
                        className="absolute inset-0 w-12 h-12 -translate-x-2 -translate-y-2 cursor-pointer border-none p-0 bg-transparent"
                        title="Choose active stroke/brush color"
                      />
                    </div>
                  </div>

                  {/* Fill Color */}
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[8px] text-slate-500 font-semibold uppercase">Fill</span>
                    <div className="flex flex-col items-center gap-1">
                      <div 
                        className="relative w-8 h-8 rounded-full border border-slate-300 overflow-hidden shadow-inner hover:scale-105 transition-transform" 
                        style={{ background: fillColor === 'transparent' ? 'repeating-conic-gradient(#cbd5e1 0% 25%, #fff 0% 50%) 50% / 8px 8px' : fillColor }}
                      >
                        <input 
                          type="color" 
                          value={fillColor === 'transparent' ? '#ffffff' : fillColor} 
                          onChange={(e) => setFillColor(e.target.value)}
                          className="absolute inset-0 w-12 h-12 -translate-x-2 -translate-y-2 cursor-pointer border-none p-0 bg-transparent"
                          title="Choose active fill color"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setFillColor(fillColor === 'transparent' ? '#3b82f6' : 'transparent')}
                        className={`text-[8px] scale-90 font-mono px-1 py-0.5 rounded border leading-none font-bold uppercase transition ${
                          fillColor === 'transparent' 
                            ? 'bg-blue-50 text-blue-600 border-blue-200' 
                            : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                        }`}
                        title="Toggle Transparent Fill"
                      >
                        {fillColor === 'transparent' ? 'No Fill' : 'Filled'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stroke Size */}
              <div className="flex flex-col gap-1 w-full pt-1.5 border-t border-slate-200">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Stroke Brush size: {strokeWidth}px</span>
                <input 
                  type="range" 
                  min="1" 
                  max="24" 
                  value={strokeWidth} 
                  onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
                  className="w-full accent-indigo-600 h-1 cursor-pointer bg-slate-200 rounded"
                  title="Brush thickness"
                />
              </div>

            </div>

          </div>

        </div>
      )}
    </div>
  );
}
