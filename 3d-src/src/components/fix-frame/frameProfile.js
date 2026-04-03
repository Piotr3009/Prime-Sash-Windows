/**
 * frameProfile.js
 * Shared constants + robust 2D helpers for curved glazing beads.
 */
import * as THREE from 'three';
export const mm = (v) => v / 1000;
// Frame member dimensions
export const SASH_RAIL = 64;
export const SASH_DEPTH = 57;
// Bead dimensions copied from CasementPanel logic
export const EBW = mm(9);     // ext chamfer face width
export const EBD = mm(15);    // ext chamfer depth
export const IBW = mm(18);    // int ovolo face width
export const IBD = mm(14);    // int ovolo depth
export const IBR = mm(11);    // int ovolo radius
export const OVOLO_N = 8;     // stepped layers for curved approximation
export function shapeFromPts(pts) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  return s;
}
export function polygonSignedArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}
function normalize(x, y) {
  const len = Math.hypot(x, y) || 1;
  return [x / len, y / len];
}
/**
 * Positive offset = inward offset for a closed contour.
 * Works much better than radial shrink for gothic / segmental shapes.
 */
export function offsetClosedPtsInward(pts, offset) {
  if (!pts || pts.length < 3) return pts;
  const area = polygonSignedArea(pts);
  const ccw = area > 0;
  const result = [];
  for (let i = 0; i < pts.length; i++) {
    const pPrev = pts[(i - 1 + pts.length) % pts.length];
    const p = pts[i];
    const pNext = pts[(i + 1) % pts.length];
    const e1 = normalize(p[0] - pPrev[0], p[1] - pPrev[1]);
    const e2 = normalize(pNext[0] - p[0], pNext[1] - p[1]);
    // left normals
    const n1Left = [-e1[1], e1[0]];
    const n2Left = [-e2[1], e2[0]];
    // inward normal depends on winding
    const n1 = ccw ? n1Left : [-n1Left[0], -n1Left[1]];
    const n2 = ccw ? n2Left : [-n2Left[0], -n2Left[1]];
    let mx = n1[0] + n2[0];
    let my = n1[1] + n2[1];
    const mLen = Math.hypot(mx, my);
    if (mLen < 1e-6) {
      result.push([p[0] + n1[0] * offset, p[1] + n1[1] * offset]);
      continue;
    }
    mx /= mLen;
    my /= mLen;
    const dot = mx * n1[0] + my * n1[1];
    const safeDot = Math.abs(dot) < 0.2 ? (dot < 0 ? -0.2 : 0.2) : dot;
    const miter = offset / safeDot;
    result.push([p[0] + mx * miter, p[1] + my * miter]);
  }
  return result;
}
export function makeRingShape(outerPts, innerPts) {
  const shape = shapeFromPts(outerPts);
  const hole = new THREE.Path();
  hole.moveTo(innerPts[0][0], innerPts[0][1]);
  for (let i = 1; i < innerPts.length; i++) hole.lineTo(innerPts[i][0], innerPts[i][1]);
  hole.closePath();
  shape.holes.push(hole);
  return shape;
}
export function makeRingGeo(outerPts, innerPts, depth) {
  const shape = makeRingShape(outerPts, innerPts);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
  });
  geo.translate(0, 0, -depth / 2);
  geo.computeVertexNormals();
  return geo;
}