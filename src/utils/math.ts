import { ObjectNode, TransformState, PivotNode, BoneNode } from '../types';

// Distance from point (px, py) to line segment (x1, y1) to (x2, y2)
export function pointToSegmentDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) {
    return Math.hypot(px - x1, py - y1);
  }

  // Projection ratio
  let t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));

  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;

  return Math.hypot(px - closestX, py - closestY);
}

// Distance from point (px, py) to a polyline points list
export function pointToPolylineDistance(px: number, py: number, points: [number, number][]): number {
  if (points.length === 0) return Infinity;
  if (points.length === 1) return Math.hypot(px - points[0][0], py - points[0][1]);

  let minDist = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const d = pointToSegmentDistance(px, py, points[i][0], points[i][1], points[i + 1][0], points[i + 1][1]);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

// Check if a point is inside a polygon (ray-casting algorithm)
export function pointInPolygon(px: number, py: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];

    const intersect = ((yi > py) !== (yj > py)) &&
      (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Calculate bounding box of raw geometry points
export function calculateBoundingBox(points: [number, number][]): { minX: number; maxX: number; minY: number; maxY: number } {
  if (points.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  return { minX, maxX, minY, maxY };
}

// Transform matrix replication for single coordinate
export function transformPoint(
  x: number,
  y: number,
  transform: TransformState,
  pivot: { localX: number; localY: number } = { localX: 0, localY: 0 }
): [number, number] {
  // Translate pivot back to origin, scale, rotate, translate back with transform location
  let lx = x - pivot.localX;
  let ly = y - pivot.localY;

  // Apply scales
  lx *= transform.scaleX;
  ly *= transform.scaleY;

  // Rotate
  const rad = (transform.rotation * Math.PI) / 180;
  const sin = Math.sin(rad);
  const cos = Math.cos(rad);

  const rx = lx * cos - ly * sin;
  const ry = lx * sin + ly * cos;

  // Render position
  return [rx + transform.x + pivot.localX, ry + transform.y + pivot.localY];
}

// Inverse coordinate mapping (from world canvas coordinate back to base local mesh coordinate)
export function inverseTransformPoint(
  worldX: number,
  worldY: number,
  transform: TransformState,
  pivot: { localX: number; localY: number } = { localX: 0, localY: 0 }
): [number, number] {
  // Subtract origin transforms and pivot translate
  let tx = worldX - transform.x - pivot.localX;
  let ty = worldY - transform.y - pivot.localY;

  // Rotate opposite direction
  const rad = (-transform.rotation * Math.PI) / 180;
  const sin = Math.sin(rad);
  const cos = Math.cos(rad);

  let lx = tx * cos - ty * sin;
  let ly = tx * sin + ty * cos;

  // Un-scale
  lx /= transform.scaleX || 1;
  ly /= transform.scaleY || 1;

  // Return to non-pivot offset space
  return [lx + pivot.localX, ly + pivot.localY];
}

// 2D to 3D view projection compressing around object geometric center
export function project3DView(
  points: [number, number][],
  viewType: 'front' | 'left' | 'right' | 'top' | 'bottom',
  angle: number
): [number, number][] {
  const { minX, maxX, minY, maxY } = calculateBoundingBox(points);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  const rad = (angle * Math.PI) / 180;
  const scale = Math.cos(rad);

  return points.map(([x, y]) => {
    let px = x;
    let py = y;

    if (viewType === 'left') {
      // Compress horizontally
      px = cx + (x - cx) * scale;
    } else if (viewType === 'right') {
      // Rotate mirror compression
      px = cx - (x - cx) * scale;
    } else if (viewType === 'top') {
      // Compress vertically
      py = cy + (y - cy) * scale;
    } else if (viewType === 'bottom') {
      py = cy - (y - cy) * scale;
    }

    return [px, py];
  });
}

// Simplifies canvas vectors with an auto-correct/straightening algorithm
export function autoCorrectStroke(points: [number, number][]): [number, number][] {
  if (points.length < 3) return points;
  const start = points[0];
  const end = points[points.length - 1];

  // Calculate if the squiggle is flat enough to draw as a straight line directly
  let totalDeviation = 0;
  for (const p of points) {
    const dev = pointToSegmentDistance(p[0], p[1], start[0], start[1], end[0], end[1]);
    totalDeviation += dev;
  }

  const avgDeviation = totalDeviation / points.length;
  // If highly aligned (e.g. deviation <= 15px), snap it to a perfect straight line!
  if (avgDeviation < 15) {
    return [start, end];
  }

  // Smooth drawing using a standard weighted moving window
  const smoothed: [number, number][] = [start];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    const sx = (prev[0] + curr[0] * 2 + next[0]) / 4;
    const sy = (prev[1] + curr[1] * 2 + next[1]) / 4;
    smoothed.push([sx, sy]);
  }
  smoothed.push(end);
  return smoothed;
}

// Sutherland-Hodgman polygon clipping (cuts a path using a polygon Clipper)
export function clipPolygon(subjectPoly: [number, number][], clipPoly: [number, number][]): [number, number][][] {
  // Simple intersection checks and splitting shapes into inside vs outside.
  // For highly scalable vector cutting, we can approximate by splitting any point intersected.
  // We return inside parts and outside parts of the path.
  const inside: [number, number][] = [];
  const outside: [number, number][] = [];

  for (const pt of subjectPoly) {
    if (pointInPolygon(pt[0], pt[1], clipPoly)) {
      inside.push(pt);
    } else {
      outside.push(pt);
    }
  }

  return [inside, outside];
}

// Inverse Kinematics via the FABRIK (Forward And Backward Reaching Inverse Kinematics) algorithm
// It modifies the current angle of bones in a joint chains.
export function solveFABRIK(
  chain: BoneNode[],
  targetX: number,
  targetY: number,
  rootX: number,
  rootY: number
): { [boneId: string]: number } {
  const resultAngles: { [id: string]: number } = {};
  if (chain.length === 0) return resultAngles;

  // Store starting joints coords
  const joints: [number, number][] = [[rootX, rootY]];
  let currentX = rootX;
  let currentY = rootY;

  for (const bone of chain) {
    const rad = (bone.currentAngle * Math.PI) / 180;
    currentX += bone.length * Math.cos(rad);
    currentY += bone.length * Math.sin(rad);
    joints.push([currentX, currentY]);
  }

  const lengths = chain.map(b => b.length);
  const totalLength = lengths.reduce((a, b) => a + b, 0);
  const dx = targetX - rootX;
  const dy = targetY - rootY;
  const dist = Math.hypot(dx, dy);

  // Unreachable check
  if (dist > totalLength) {
    // Extend directly to target
    const angle = Math.atan2(dy, dx);
    let curX = rootX;
    let curY = rootY;
    for (let i = 0; i < chain.length; i++) {
      resultAngles[chain[i].id] = (angle * 180) / Math.PI;
      curX += lengths[i] * Math.cos(angle);
      curY += lengths[i] * Math.sin(angle);
    }
    return resultAngles;
  }

  // Reachable: Run FABRIK iterations
  const maxIterations = 15;
  const tolerance = 0.5;

  for (let iter = 0; iter < maxIterations; iter++) {
    // Check if target is close enough
    const endJoint = joints[joints.length - 1];
    if (Math.hypot(endJoint[0] - targetX, endJoint[1] - targetY) < tolerance) {
      break;
    }

    // Step 1: Forward Pass (align to target backwards)
    joints[joints.length - 1] = [targetX, targetY];
    for (let i = joints.length - 2; i >= 0; i--) {
      const next = joints[i + 1];
      const cur = joints[i];
      const distance = Math.hypot(next[0] - cur[0], next[1] - cur[1]) || 1;
      const t = lengths[i] / distance;
      joints[i] = [
        next[0] + (cur[0] - next[0]) * t,
        next[1] + (cur[1] - next[1]) * t
      ];
    }

    // Step 2: Backward Pass (re-anchor root)
    joints[0] = [rootX, rootY];
    for (let i = 0; i < joints.length - 1; i++) {
      const cur = joints[i];
      const next = joints[i + 1];
      const distance = Math.hypot(next[0] - cur[0], next[1] - cur[1]) || 1;
      const t = lengths[i] / distance;
      joints[i + 1] = [
        cur[0] + (next[0] - cur[0]) * t,
        cur[1] + (next[1] - cur[1]) * t
      ];
    }
  }

  // Convert joint coordinates back to angles with min/max clamps
  for (let i = 0; i < chain.length; i++) {
    const cur = joints[i];
    const next = joints[i + 1];
    let angle = (Math.atan2(next[1] - cur[1], next[0] - cur[0]) * 180) / Math.PI;

    // Apply constraints
    const bone = chain[i];
    if (angle < bone.minAngle) angle = bone.minAngle;
    if (angle > bone.maxAngle) angle = bone.maxAngle;

    resultAngles[bone.id] = angle;
  }

  return resultAngles;
}
