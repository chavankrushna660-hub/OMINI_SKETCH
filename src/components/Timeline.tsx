import React, { useState } from 'react';
import { ProjectState } from '../types';
import { 
  Play, Pause, Square, Repeat, Plus, Trash2, Sliders, 
  Settings, Flame, Sparkles, AlertTriangle, FastForward
} from 'lucide-react';

interface TimelineProps {
  project: ProjectState;
  activeFrameIndex: number;
  setActiveFrameIndex: (idx: number) => void;
  onAddFrame: () => void;
  onDeleteFrame: (idx: number) => void;
  onDuplicateFrame: (idx: number) => void;
  onCopyFrame: (idx: number) => void;
  onPasteFrame: (idx: number) => void;
  isPlaying: boolean;
  setIsPlaying: (p: boolean) => void;
  fps: number;
  setFps: (fps: number) => void;
  onionEnabled: boolean;
  setOnionEnabled: (e: boolean) => void;
  onTriggerAutoInbetween: (start: number, end: number, count: number) => void;
}

export default function Timeline({
  project,
  activeFrameIndex,
  setActiveFrameIndex,
  onAddFrame,
  onDeleteFrame,
  onDuplicateFrame,
  onCopyFrame,
  onPasteFrame,
  isPlaying,
  setIsPlaying,
  fps,
  setFps,
  onionEnabled,
  setOnionEnabled,
  onTriggerAutoInbetween
}: TimelineProps) {
  const [showOnionConfig, setShowOnionConfig] = useState(false);
  const [showInbetweenModal, setShowInbetweenConfig] = useState(false);
  
  // Local Config bindings
  const [startKey, setStartKey] = useState(1);
  const [endKey, setEndKey] = useState(5);
  const [stepsInbetween, setStepsInbetween] = useState(3);

  // Auto frames recorder states
  const [autoFramesEnabled, setAutoFramesEnabled] = useState(false);
  const [autoFrameInterval, setAutoFrameInterval] = useState(1.5);

  React.useEffect(() => {
    if (!autoFramesEnabled || isPlaying) return;

    const timer = setInterval(() => {
      onAddFrame();
    }, autoFrameInterval * 1000);

    return () => clearInterval(timer);
  }, [autoFramesEnabled, isPlaying, autoFrameInterval, onAddFrame]);

  const frameIndexes = Object.keys(project.frames)
    .map(Number)
    .sort((a, b) => a - b);

  // Heatmap evaluation algorithm:
  // Evaluates transform property deviation comparing frame State updates
  const calculateFrameHeat = (idx: number): string => {
    if (idx === 0) return 'bg-slate-200 border-slate-300 text-slate-800';
    const current = project.frames[idx]?.objects || {};
    const count = Object.keys(current).length;

    if (count === 0) return 'bg-blue-50 border-blue-200 text-blue-800'; // Static
    if (count > 3) return 'bg-rose-500 border-rose-600 text-white'; // Heavy Changes (Red)
    return 'bg-amber-400 border-amber-500 text-slate-900'; // Medium Changes (Orange)
  };

  const handleApplyInbetweens = () => {
    onTriggerAutoInbetween(startKey - 1, endKey - 1, stepsInbetween);
    setShowInbetweenConfig(false);
  };

  return (
    <div className="bg-slate-100 border-t border-slate-200 p-3 h-44 flex flex-col gap-2 flex-shrink-0 select-none">
      {/* Playback Controls & Frame Helpers */}
      <div className="flex justify-between items-center bg-white px-3 py-1.5 rounded-lg shadow-sm border">
        {/* Left Side: Playback Clamps */}
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            id="play-animation-button"
            className="p-1.5 hover:bg-slate-100 rounded text-slate-700 transition hover:scale-105 cursor-pointer"
            title={isPlaying ? "Pause Playback" : "Start Playback"}
          >
            {isPlaying ? <Pause size={16} className="text-blue-600" /> : <Play size={16} className="fill-slate-700 text-slate-700" />}
          </button>
          
          <button 
            onClick={() => { setIsPlaying(false); setActiveFrameIndex(0); }}
            className="p-1.5 hover:bg-slate-100 rounded text-slate-500 transition cursor-pointer"
            title="Stop / Reset"
          >
            <Square size={14} className="fill-slate-500 text-slate-500" />
          </button>

          <span className="h-4 w-px bg-slate-200 mx-2" />

          {/* Autoframes continuous recorder */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
            <label className="flex items-center gap-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoFramesEnabled}
                onChange={(e) => setAutoFramesEnabled(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
              />
              <span className="text-[10px] font-mono font-bold text-slate-600 hover:text-slate-800">🔴 AUTO-FRAMES</span>
            </label>
            <span className="text-slate-300">|</span>
            <input
              type="number"
              min="0.5"
              max="15"
              step="0.5"
              value={autoFrameInterval}
              onChange={(e) => setAutoFrameInterval(Math.max(0.5, parseFloat(e.target.value) || 1.5))}
              className="w-8 text-[10px] font-mono font-bold bg-transparent border-none text-red-600 focus:outline-none p-0 text-center"
              title="Interval in seconds"
            />
            <span className="text-[9px] font-mono text-slate-400">s</span>
          </div>

          <span className="h-4 w-px bg-slate-200 mx-1" />

          {/* FPS Slider and Preset list */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-medium text-slate-500">SPEED (FPS)</span>
            <input 
              type="range" min="6" max="30" step="1" value={fps}
              onChange={(e) => setFps(parseInt(e.target.value))}
              className="w-24 cursor-pointer"
            />
            <span className="text-xs font-mono font-bold text-slate-700 w-8 text-center">{fps}</span>
            
            <button onClick={() => setFps(12)} className="text-[10px] border px-1.5 py-0.5 rounded hover:bg-slate-100 cursor-pointer font-mono font-semibold">12</button>
            <button onClick={() => setFps(24)} className="text-[10px] border px-1.5 py-0.5 rounded hover:bg-slate-100 cursor-pointer font-mono font-semibold">24</button>
          </div>
        </div>

        {/* Center: Onion skin trigger config popup */}
        <div className="flex gap-2 items-center">
          <button 
            onClick={() => setOnionEnabled(!onionEnabled)}
            className={`flex items-center gap-1.5 px-3 py-1 text-[11px] rounded transition cursor-pointer font-medium ${onionEnabled ? 'bg-orange-100 text-orange-700 border border-orange-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border'}`}
          >
            <Flame size={12} />
            <span>ONION SKIN</span>
          </button>
          
          <button 
            onClick={() => setShowOnionConfig(!showOnionConfig)}
            className="p-1 border hover:bg-slate-100 rounded text-slate-500 cursor-pointer"
            title="Onion Settings"
          >
            <Settings size={12} />
          </button>
        </div>

        {/* Right: Inbetween Frame triggers */}
        <div className="flex gap-1.5 items-center">
          <button 
            onClick={() => setShowInbetweenConfig(!showInbetweenModal)}
            className="bg-purple-50 border border-purple-200 hover:bg-purple-100 text-purple-700 px-3 py-1 rounded text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer"
          >
            <Sparkles size={12} />
            <span>AUTO-INBETWEEN</span>
          </button>

          <span className="h-4 w-px bg-slate-200 mx-1.5"/>

          <button 
            onClick={onAddFrame}
            id="add-frame-button"
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3.5 py-1 rounded text-[11px] transition shadow hover:scale-105 flex items-center gap-1 cursor-pointer"
          >
            <Plus size={13} />
            <span>ADD FRAME</span>
          </button>
        </div>
      </div>

      {/* Real-time Heatmap config line */}
      <div className="mt-1 flex items-center gap-1 px-1">
        <span className="text-[9px] font-bold text-slate-400 font-display flex items-center gap-0.5"><Flame size={10}/> HEATMAP:</span>
        <span className="text-[9px] bg-red-100 text-red-700 px-1 py-0.2 rounded font-medium">Red = Active edits</span>
        <span className="text-[9px] bg-blue-100 text-blue-700 px-1 py-0.2 rounded font-medium">Blue = Static frames</span>
      </div>

      {/* Frame Scrubber Container */}
      <div className="flex-1 overflow-x-auto flex gap-1 items-center pb-2 mt-1">
        {frameIndexes.map((idx, i) => {
          const isCurrent = activeFrameIndex === idx;
          const heatStyle = calculateFrameHeat(idx);
          return (
            <div 
              key={idx}
              className={`flex-shrink-0 group relative flex flex-col p-0.5 rounded border transition-all ${
                isCurrent 
                  ? 'border-blue-500 scale-105 shadow-md ring-2 ring-blue-100' 
                  : 'border-slate-300'
              }`}
            >
              <button
                id={`frame-box-${idx}`}
                onClick={() => setActiveFrameIndex(idx)}
                className={`w-14 h-12 flex flex-col items-center justify-center font-mono font-bold text-xs rounded cursor-pointer ${
                  isCurrent ? 'bg-blue-500 text-white' : heatStyle
                }`}
              >
                <span>#{idx + 1}</span>
                <span className="text-[8px] font-normal tracking-wide opacity-85">
                  {idx === 0 ? 'Base' : 'Delta'}
                </span>
              </button>

              {/* Action buttons revealed on hover */}
              <div className="absolute -top-3.5 left-0 right-0 bg-slate-900 rounded-md text-[9px] text-white flex justify-around p-0.5 opacity-0 group-hover:opacity-100 transition shadow pointer-events-auto">
                <button onClick={() => onDuplicateFrame(idx)} title="Clone Frame State" className="hover:text-blue-400 font-medium cursor-pointer">CL</button>
                <button onClick={() => onCopyFrame(idx)} title="Copy variables" className="hover:text-amber-400 font-medium cursor-pointer">CP</button>
                <button onClick={() => onPasteFrame(idx)} title="Paste copied overrides" className="hover:text-emerald-400 font-medium cursor-pointer">PS</button>
                <button onClick={() => onDeleteFrame(idx)} title="Delete Frame" className="hover:text-red-400 font-medium cursor-pointer"><Trash2 size={10}/></button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal / Options Popup 1: Onion Skins configure */}
      {showOnionConfig && (
        <div className="absolute bottom-20 left-12 bg-white border border-slate-200 rounded-lg p-3 shadow-2xl z-50 flex flex-col gap-2 w-56 active-selection">
          <span className="font-display font-semibold text-slate-800 text-xs text-center border-b pb-1 mb-1">Onion Skin Configurations</span>
          <div className="flex flex-col gap-2 text-[10px]">
            <span className="text-slate-400">Previous / Future frame overlays loaded visually as ghosts:</span>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-bold block mb-0.5 text-[10px]">Overlays Range:</span>
              <span className="font-mono text-orange-600 block">3 Frames</span>
            </div>
            <p className="text-[9px] text-slate-400 italic">Previous frames are rendered with red tints, next frames utilize blue tints during drawing passes.</p>
            <button 
              onClick={() => setShowOnionConfig(false)}
              className="bg-blue-600 text-white text-[10px] font-bold rounded py-1 cursor-pointer text-center"
            >
              Close Preferences
            </button>
          </div>
        </div>
      )}

      {/* Modal / Options Popup 2: Auto Inbetween Configure */}
      {showInbetweenModal && (
        <div className="absolute bottom-20 right-4 animate-fade-in bg-white border border-slate-200 p-4 rounded-xl shadow-2xl z-50 w-72 flex flex-col gap-3">
          <div className="flex justify-between items-center border-b pb-1.5">
            <span className="font-display font-semibold text-slate-800 text-xs">Linear Auto-Inbetween generator</span>
            <button onClick={() => setShowInbetweenConfig(false)} className="text-slate-400 font-bold hover:text-slate-700 cursor-pointer text-[10px]">X</button>
          </div>

          <p className="text-[10px] text-slate-400">Fills values linearly between two selected boundary frames by creating delta frames.</p>

          <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500">
            <div>
              <span className="block font-medium mb-0.5">Start Frame</span>
              <input 
                type="number" min="1" value={startKey} 
                onChange={(e) => setStartKey(Math.max(1, parseInt(e.target.value) || 1))}
                className="border p-1 w-full rounded focus:outline-none"
              />
            </div>
            <div>
              <span className="block font-medium mb-0.5">End Frame</span>
              <input 
                type="number" min="1" value={endKey} 
                onChange={(e) => setEndKey(Math.max(1, parseInt(e.target.value) || 1))}
                className="border p-1 w-full rounded focus:outline-none"
              />
            </div>
          </div>

          <div className="text-[10px] text-slate-500">
            <span className="block font-medium mb-0.5">Intermediate Frame Count to generate</span>
            <input 
              type="number" min="1" max="100" value={stepsInbetween} 
              onChange={(e) => setStepsInbetween(Math.max(1, parseInt(e.target.value) || 1))}
              className="border p-1 w-full rounded focus:outline-none"
            />
          </div>

          <button 
            onClick={handleApplyInbetweens}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-1.5 rounded text-xs transition cursor-pointer"
          >
            Execute Interpolations
          </button>
        </div>
      )}
    </div>
  );
}
