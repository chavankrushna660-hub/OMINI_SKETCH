import { ProjectState, ObjectNode, FrameState, LayerNode, BoneNode, ShapeType, ToolType } from '../types';

export function createEmptyProject(): ProjectState {
  return {
    id: `project_${Math.random().toString(36).substr(2, 9)}`,
    name: "Interactive Animation",
    canvasWidth: 800,
    canvasHeight: 500,
    fps: 12,
    layers: [
      {
        id: "layer_default",
        name: "Main Canvas Layer",
        visible: true,
        locked: false,
        opacity: 1,
        blendMode: "normal",
        objectIds: []
      }
    ],
    objects: {},
    frames: {
      "0": {
        index: 0,
        objects: {}
      }
    },
    bones: {}
  };
}

// Generate a pre-built Character template to demonstrate IK, matrix hierarchies, and pivots
export function generateCharacterTemplate(project: ProjectState): ProjectState {
  const objects: { [id: string]: ObjectNode } = {};
  const frame0: FrameState = { index: 0, objects: {} };
  const bones: { [id: string]: BoneNode } = {};

  // Clean slate previous content
  const newProj = { ...project, objects, frames: { "0": frame0 }, bones };
  const layer = newProj.layers[0];
  layer.objectIds = [];

  // Helper to add nodes easily
  const addNode = (id: string, name: string, pts: [number, number][], tx: number, ty: number, parentId: string | null = null, fill = '#e0e0e0', stroke = '#111827') => {
    const node: ObjectNode = {
      id,
      name,
      type: 'shape',
      layerId: "layer_default",
      parentId,
      childrenIds: [],
      baseGeometry: {
        type: 'shape',
        points: pts
      },
      defaultStyle: {
        stroke,
        strokeWidth: 3,
        strokeOpacity: 1,
        fill,
        fillOpacity: 1,
        blendMode: 'normal'
      },
      pivots: [
        {
          id: `pvt_${id}`,
          name: `${name}_Joint`,
          localX: 0,
          localY: 0,
          locked: false,
          isActive: true
        }
      ],
      constraints: { type: 'none' },
      isLocked: false,
      isHidden: false,
      pinSC: true
    };

    if (parentId && objects[parentId]) {
      objects[parentId].childrenIds.push(id);
    }

    objects[id] = node;
    layer.objectIds.push(id);

    // Initial transform State
    frame0.objects[id] = {
      transform: {
        x: tx,
        y: ty,
        rotation: 0,
        scaleX: 1,
        scaleY: 1
      }
    };
  };

  // 1. Torso (Parent anchor)
  addNode("obj_torso", "Torso", [
    [-30, -50], [30, -50], [25, 55], [-25, 55]
  ], 400, 240, null, '#475569');
  objects["obj_torso"].pivots[0].localY = 50; // Hip pivot

  // 2. Head (Nested under Torso)
  addNode("obj_head", "Head", [
    [-25, -25], [25, -25], [25, 25], [-25, 25]
  ], 400, 150, "obj_torso", '#f87171');
  objects["obj_head"].pivots[0].localY = 20; // Neck pivot

  // 3. Left Upper Arm
  addNode("obj_l_up_arm", "Left Upper Arm", [
    [-8, -10], [8, -10], [6, 40], [-6, 40]
  ], 350, 210, "obj_torso", '#60a5fa');
  objects["obj_l_up_arm"].pivots[0].localY = -10; // Shoulder joint

  // 4. Left Forearm
  addNode("obj_l_forearm", "Left Forearm", [
    [-6, 0], [6, 0], [5, 45], [-5, 45]
  ], 350, 250, "obj_l_up_arm", '#3b82f6');
  objects["obj_l_forearm"].pivots[0].localY = 0; // Elbow joint

  // 5. Right Upper Arm
  addNode("obj_r_up_arm", "Right Upper Arm", [
    [-8, -10], [8, -10], [6, 40], [-6, 40]
  ], 450, 210, "obj_torso", '#60a5fa');
  objects["obj_r_up_arm"].pivots[0].localY = -10; // Shoulder joint

  // 6. Right Forearm
  addNode("obj_r_forearm", "Right Forearm", [
    [-6, 0], [6, 0], [5, 45], [-5, 45]
  ], 450, 250, "obj_r_up_arm", '#3b82f6');
  objects["obj_r_forearm"].pivots[0].localY = 0; // Elbow joint

  // 7. Left Leg
  addNode("obj_l_leg", "Left Leg", [
    [-10, 0], [10, 0], [8, 50], [-8, 50]
  ], 375, 290, "obj_torso", '#facc15');
  objects["obj_l_leg"].pivots[0].localY = 0; // Hip joint

  // 8. Right Leg
  addNode("obj_r_leg", "Right Leg", [
    [-10, 0], [10, 0], [8, 50], [-8, 50]
  ], 425, 290, "obj_torso", '#facc15');
  objects["obj_r_leg"].pivots[0].localY = 0; // Hip joint

  // Connect Bones hierarchy (FK/IK)
  const addBone = (id: string, name: string, startObj: string, endObj: string, startL: [number, number], endL: [number, number], parent: string | null = null) => {
    bones[id] = {
      id,
      name,
      startObjectId: startObj,
      endObjectId: endObj,
      startLocalX: startL[0],
      startLocalY: startL[1],
      endLocalX: endL[0],
      endLocalY: endL[1],
      restAngle: -90,
      currentAngle: -85,
      length: 60,
      minAngle: -180,
      maxAngle: 180,
      stiffness: 0.8,
      parentId: parent,
      childrenIds: []
    };
    if (parent && bones[parent]) {
      bones[parent].childrenIds.push(id);
    }
  };

  addBone("bone_spine", "Spine Bone", "obj_torso", "obj_head", [0, -40], [0, 20]);
  addBone("bone_l_shoulder", "L Shoulder", "obj_torso", "obj_l_up_arm", [-30, -30], [0, -10]);
  addBone("bone_l_elbow", "L Elbow", "obj_l_up_arm", "obj_l_forearm", [0, 40], [0, 0], "bone_l_shoulder");

  addBone("bone_r_shoulder", "R Shoulder", "obj_torso", "obj_r_up_arm", [30, -30], [0, -10]);
  addBone("bone_r_elbow", "R Elbow", "obj_r_up_arm", "obj_r_forearm", [0, 40], [0, 0], "bone_r_shoulder");

  return newProj;
}

// Generate Mechanical Clock variable loop example
export function generateClockTemplate(project: ProjectState): ProjectState {
  const objects: { [id: string]: ObjectNode } = {};
  const frame0: FrameState = { index: 0, objects: {} };

  const newProj = { ...project, objects, frames: { "0": frame0 }, bones: {} };
  const layer = newProj.layers[0];
  layer.objectIds = [];

  // 1. Dial Body
  const circlePoints: [number, number][] = [];
  const radius = 120;
  const cx = 400;
  const cy = 250;
  for (let a = 0; a < 360; a += 15) {
    const rad = (a * Math.PI) / 180;
    circlePoints.push([radius * Math.cos(rad), radius * Math.sin(rad)]);
  }

  const dialId = "obj_clock_dial";
  const dialNode: ObjectNode = {
    id: dialId,
    name: "Clock Dial",
    type: 'shape',
    layerId: "layer_default",
    parentId: null,
    childrenIds: [],
    baseGeometry: {
      type: 'shape',
      points: circlePoints
    },
    defaultStyle: {
      stroke: '#0f172a',
      strokeWidth: 6,
      strokeOpacity: 1,
      fill: '#f8fafc',
      fillOpacity: 1,
      blendMode: 'normal'
    },
    pivots: [{ id: "pvt_dial", name: "Dial Center", localX: 0, localY: 0, locked: true, isActive: true }],
    constraints: { type: 'none' },
    isLocked: true,
    isHidden: false,
    pinSC: false
  };
  objects[dialId] = dialNode;
  layer.objectIds.push(dialId);
  frame0.objects[dialId] = {
    transform: { x: cx, y: cy, rotation: 0, scaleX: 1, scaleY: 1 }
  };

  // 2. Hour markings (12, 3, 6, 9)
  const addMark = (id: string, val: string, xPos: number, yPos: number) => {
    const node: ObjectNode = {
      id,
      name: `Mark_${val}`,
      type: 'text',
      layerId: "layer_default",
      parentId: dialId,
      childrenIds: [],
      baseGeometry: {
        type: 'text',
        text: val,
        width: 30,
        height: 20
      },
      defaultStyle: {
        stroke: '#475569',
        strokeWidth: 1,
        strokeOpacity: 1,
        fill: '#475569',
        fillOpacity: 1,
        blendMode: 'normal'
      },
      pivots: [{ id: `pvt_${id}`, name: "Center", localX: 0, localY: 0, locked: false, isActive: false }],
      constraints: { type: 'none' },
      isLocked: true,
      isHidden: false,
      pinSC: false
    };
    objects[dialId].childrenIds.push(id);
    objects[id] = node;
    layer.objectIds.push(id);
    frame0.objects[id] = {
      transform: { x: xPos, y: yPos, rotation: 0, scaleX: 1, scaleY: 1 }
    };
  };

  addMark("mark_12", "12", cx - 8, cy - 90);
  addMark("mark_3", "3", cx + 80, cy - 10);
  addMark("mark_6", "6", cx - 4, cy + 80);
  addMark("mark_9", "9", cx - 90, cy - 10);

  // 3. Hands (Seconds, Minutes, Hours)
  const addHand = (id: string, name: string, length: number, thickness: number, color: string) => {
    const handNode: ObjectNode = {
      id,
      name,
      type: 'shape',
      layerId: "layer_default",
      parentId: dialId,
      childrenIds: [],
      baseGeometry: {
        type: 'shape',
        points: [[0, 0], [0, -length]]
      },
      defaultStyle: {
        stroke: color,
        strokeWidth: thickness,
        strokeOpacity: 1,
        fill: 'transparent',
        fillOpacity: 0,
        blendMode: 'normal'
      },
      pivots: [{ id: `pvt_${id}`, name: "Anchor", localX: 0, localY: 0, locked: true, isActive: true }],
      constraints: { type: 'none' },
      isLocked: false,
      isHidden: false,
      pinSC: true
    };
    objects[dialId].childrenIds.push(id);
    objects[id] = handNode;
    layer.objectIds.push(id);
    frame0.objects[id] = {
      transform: { x: cx, y: cy, rotation: 0, scaleX: 1, scaleY: 1 }
    };
  };

  addHand("Hand_Hours", "Hour Hand", 50, 6, "#1e293b");
  addHand("Hand_Minutes", "Minute Hand", 80, 4, "#475569");
  addHand("Hand_Seconds", "Second Hand", 95, 2, "#ef4444");

  return newProj;
}
