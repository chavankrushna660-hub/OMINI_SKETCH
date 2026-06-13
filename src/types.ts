export enum ToolType {
  SEL = 'SEL', // Selection Tool
  LAS = 'LAS', // Lasso Select
  BRS = 'BRS', // Brush Tool
  ERS = 'ERS', // Eraser Tool
  LIN = 'LIN', // Line Tool
  REC = 'REC', // Rectangle Shape
  CIR = 'CIR', // Circle Shape
  TRI = 'TRI', // Triangle Shape
  POL = 'POL', // Polygon Shape
  TXT = 'TXT', // Text Tool
  FIL = 'FIL', // Fill / Bucket
  CLR = 'CLR', // Picker / Color
  PVT = 'PVT', // Pivot Tool
  BON = 'BON', // Bone Tool
  CON = 'CON', // Constraint Lines
  MOT = 'MOT', // Motion Path
  KNF = 'KNF', // Knife / Dot-based Cut
  VLP = 'VLP', // Variable Loop
  LAY = 'LAY', // Layers
  PAN = 'PAN', // Pan
  ZOM = 'ZOM', // Zoom
}

export enum BrushVariant {
  PEN = 'Pen',
  BRUSH = 'Brush',
  PAINT_BRUSH = 'Paint Brush',
  PENCIL = 'Pencil',
  CHARCOAL = 'Charcoal',
  MARKER = 'Marker',
  AIRBRUSH = 'Airbrush',
  CALLIGRAPHY = 'Calligraphy',
  INK = 'Ink',
  PIXEL = 'Pixel',
  TEXTURE = 'Texture',
  WET = 'Wet Brush',
  DRY = 'Dry Brush',
  GLOW = 'Glow Brush',
  NEON = 'Neon Brush',
}

export enum ShapeType {
  TRIANGLE_EQUILATERAL = 'Equilateral Triangle',
  TRIANGLE_ISOSCELES = 'Isceles Triangle',
  TRIANGLE_RIGHT = 'Right Triangle',
  TRIANGLE_SCALENE = 'Scalene Triangle',
  QUAD_SQUARE = 'Square',
  QUAD_RECTANGLE = 'Rectangle',
  QUAD_RHOMBUS = 'Rhombus',
  QUAD_PARALLELOGRAM = 'Parallelogram',
  QUAD_TRAPEZOID = 'Trapezoid',
  QUAD_KITE = 'Kite',
  POLYGON_PENTAGON = 'Pentagon',
  POLYGON_HEXAGON = 'Hexagon',
  POLYGON_HEPTAGON = 'Heptagon',
  POLYGON_OCTAGON = 'Octagon',
  CURVED_CIRCLE = 'Circle',
  CURVED_ELLIPSE = 'Ellipse',
  CURVED_SEMICIRCLE = 'Semicircle',
  CURVED_CRESCENT = 'Crescent',
  SYMBOL_STAR = 'Star',
  SYMBOL_HEART = 'Heart',
  SYMBOL_ARROW = 'Arrow',
  SYMBOL_TEARDROP = 'Teardrop'
}

export interface TransformState {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  depth360?: number; // 360 degree depth turnaround slider
}

export interface Geometry {
  type: 'stroke' | 'shape' | 'text' | 'image';
  points?: [number, number][]; // Vector path points
  shapeType?: ShapeType;
  width?: number; // width for rects/text
  height?: number; // height for rects/text
  radius?: number; // circle/polygon radius
  sides?: number; // polygon side count
  text?: string;
  imgUrl?: string; // transparent upload PNG
}

export interface StyleState {
  stroke: string;
  strokeWidth: number;
  strokeOpacity: number;
  fill: string;
  fillOpacity: number;
  blendMode: 'normal' | 'multiply' | 'screen' | 'overlay' | 'soft-light' | 'hard-light' | 'color-dodge' | 'color-burn' | 'difference';
  filter?: string; // CSS Filter effects (brightness, contrast, blur, etc.)
  strokeDashArray?: string;
}

export interface PivotNode {
  id: string;
  name: string;
  localX: number; // local coordinate offsets from object center
  localY: number;
  locked: boolean;
  isActive: boolean;
}

export interface ConstraintState {
  type: 'none' | 'horizontal' | 'vertical' | 'circle';
  minY?: number;
  maxY?: number;
  minX?: number;
  maxX?: number;
  radius?: number;
  centerX?: number;
  centerY?: number;
}

export interface ObjectNode {
  id: string;
  name: string;
  type: 'stroke' | 'shape' | 'text' | 'image';
  layerId: string;
  parentId: string | null;
  childrenIds: string[];
  baseGeometry: Geometry;
  defaultStyle: StyleState;
  pivots: PivotNode[];
  constraints: ConstraintState;
  isLocked: boolean;
  isHidden: boolean;
  pinSC: boolean; // Pinned to Smart Controls
}

export interface FrameState {
  index: number;
  // Overrides per frame
  objects: {
    [objectId: string]: {
      transform?: TransformState;
      stroke?: string;
      fill?: string;
      opacity?: number;
      strokeWidth?: number;
    }
  };
  bones?: {
    [boneId: string]: {
      currentAngle: number;
    }
  };
}

export interface LayerNode {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode: string;
  objectIds: string[]; // Order of drawing
}

export interface BoneNode {
  id: string;
  name: string;
  startObjectId: string; // Associated parent object id
  endObjectId: string; // Associated child object id
  startLocalX: number; // offsets inside startObject
  startLocalY: number;
  endLocalX: number; // offsets inside endObject
  endLocalY: number;
  restAngle: number;
  currentAngle: number;
  length: number;
  minAngle: number; // angle constraints
  maxAngle: number;
  stiffness: number; // 0 to 1
  parentId: string | null; // connected parent bone
  childrenIds: string[];
  color?: string;
}

// Variable Loop system models
export interface LoopVariable {
  name: string;
  linkedObjectId: string;
  property: 'rotation' | 'x' | 'y' | 'scaleX' | 'scaleY' | 'opacity' | 'strokeWidth';
  currentValue: number;
}

export interface LoopRule {
  id: string;
  name: string;
  targetVariable: string;
  action: 'add' | 'multiply';
  amountPerStep: number;
  oscillate: boolean;
  limitMin?: number;
  limitMax?: number;
  delayBeforeStart: number; // in steps
  framesPerStep: number; // duration multiplier
  stopCondition: {
    type: 'after_n_steps' | 'when_loop_completes';
    steps?: number;
    triggerLoopId?: string;
    triggerCount?: number;
  };
}

export interface ProjectState {
  id: string;
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  fps: number;
  layers: LayerNode[];
  objects: { [id: string]: ObjectNode };
  frames: { [index: string]: FrameState };
  bones: { [id: string]: BoneNode };
}
