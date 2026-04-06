/**
 * ArchedCasementWindow.jsx
 * Arched casement = outer frame (arch shape, CasementFrame dims) + leaf (FixFrameWindow).
 * Leaf sits in rebate with 4mm gap, pivots left/right.
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { FRAME_FACE, FRAME_DEPTH, EXT_DEPTH, INT_DEPTH, REBATE_STEP, BOTTOM_FACE, GASKET_T, mm } from './CasementFrame';
import FixFrameWindow from '../fix-frame/FixFrameWindow';

const LEAF_GAP = 4; // mm gap between leaf and frame
const MAX_ANGLE = 70; // degrees max opening
const SEGS = 48;

// ── Arc point helpers (same as FixFrameWindow) ──
function arcPoints(cx, cy, r, startAngle, endAngle, segs) {
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const a = startAngle + t * (endAngle - startAngle);
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

// ── Frame geometry with REBATE (2 layers like CasementFrame) ──
// EXT layer: outer → inner (FRAME_FACE offset), depth = EXT_DEPTH
// INT layer: outer → innerRebated (EXT_FACE offset = less inset = larger opening), depth = INT_DEPTH
// This creates the rebate step where leaf sits
const EXT_FACE_W = FRAME_FACE - REBATE_STEP; // 36mm
const BOTTOM_INNER = BOTTOM_FACE - REBATE_STEP; // 47mm

function makeShapeWithHole(outerPts, innerPts) {
  const shape = new THREE.Shape();
  shape.moveTo(outerPts[0][0], outerPts[0][1]);
  for (let i = 1; i < outerPts.length; i++) shape.lineTo(outerPts[i][0], outerPts[i][1]);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(innerPts[0][0], innerPts[0][1]);
  for (let i = 1; i < innerPts.length; i++) hole.lineTo(innerPts[i][0], innerPts[i][1]);
  hole.closePath();
  shape.holes.push(hole);
  return shape;
}

function makeFrameGeo(outerPts, innerPts, innerRebatedPts) {
  const halfD = mm(FRAME_DEPTH) / 2;
  const extD = mm(EXT_DEPTH);
  const intD = mm(INT_DEPTH);

  // EXT layer (front): outer → innerRebated (36mm face = wider opening)
  const extShape = makeShapeWithHole(outerPts, innerRebatedPts);
  const ext = new THREE.ExtrudeGeometry(extShape, { depth: extD, bevelEnabled: false });
  ext.translate(0, 0, halfD - extD);
  ext.computeVertexNormals();

  // INT layer (back): outer → inner (57mm face = narrower opening = rebate ledge)
  const intShape = makeShapeWithHole(outerPts, innerPts);
  const intGeo = new THREE.ExtrudeGeometry(intShape, { depth: intD, bevelEnabled: false });
  intGeo.translate(0, 0, -halfD);
  intGeo.computeVertexNormals();

  return { ext, int: intGeo };
}

// ── Arch shape point generators for OUTER FRAME ──
// Copied from FixFrameWindow shape logic, using CasementFrame dims (FRAME_FACE=57, BOTTOM_FACE=68)
function semiCirclePoints(width, height) {
  const W = mm(width), H = mm(height), fw = mm(FRAME_FACE), bw = mm(BOTTOM_FACE);
  const fwr = mm(EXT_FACE_W), bwr = mm(BOTTOM_INNER);
  const halfW = W / 2;
  const springY = -H / 2 + Math.max(H - halfW, mm(50));
  // EXT inner (FRAME_FACE offset)
  const iHalfW = halfW - fw;
  const iBottom = -H / 2 + bw;
  // INT inner (EXT_FACE offset = less inset = larger opening for rebate)
  const rHalfW = halfW - fwr;
  const rBottom = -H / 2 + bwr;

  const outerArc = arcPoints(0, springY, halfW, 0, Math.PI, SEGS);
  const outer = [[-halfW, -H/2], [halfW, -H/2], [halfW, springY], ...outerArc, [-halfW, springY]];
  const innerArc = arcPoints(0, springY, iHalfW, 0, Math.PI, SEGS);
  const inner = [[-iHalfW, iBottom], [iHalfW, iBottom], [iHalfW, springY], ...innerArc, [-iHalfW, springY]];
  const rebatedArc = arcPoints(0, springY, rHalfW, 0, Math.PI, SEGS);
  const innerRebated = [[-rHalfW, rBottom], [rHalfW, rBottom], [rHalfW, springY], ...rebatedArc, [-rHalfW, springY]];
  return { outer, inner, innerRebated };
}

function gothicPoints(width, height) {
  const W = mm(width), H = mm(height), fw = mm(FRAME_FACE), bw = mm(BOTTOM_FACE);
  const fwr = mm(EXT_FACE_W), bwr = mm(BOTTOM_INNER);
  const halfW = W / 2;
  const archRise = W * Math.sqrt(3) / 2;
  const effectiveH = Math.max(H, mm(Math.round(width * Math.sqrt(3) / 2)) + mm(50));
  const straightWall = Math.max(effectiveH - archRise, mm(50));
  const springY = -effectiveH / 2 + straightWall;

  const rightArc = arcPoints(-halfW, springY, W, 0, Math.PI / 3, SEGS);
  const leftArc = arcPoints(halfW, springY, W, 2 * Math.PI / 3, Math.PI, SEGS);
  const outer = [[-halfW, -effectiveH/2], [halfW, -effectiveH/2], [halfW, springY], ...rightArc, ...leftArc, [-halfW, springY]];

  // EXT inner
  const iHalfW = halfW - fw;
  const Ri = W - fw;
  const iBottom = -effectiveH / 2 + bw;
  const iRightArc = arcPoints(-halfW, springY, Ri, 0, Math.PI / 3, SEGS);
  const iLeftArc = arcPoints(halfW, springY, Ri, 2 * Math.PI / 3, Math.PI, SEGS);
  const inner = [[-iHalfW, iBottom], [iHalfW, iBottom], [iHalfW, springY], ...iRightArc, ...iLeftArc, [-iHalfW, springY]];

  // INT innerRebated (larger opening)
  const rHalfW = halfW - fwr;
  const Rr = W - fwr;
  const rBottom = -effectiveH / 2 + bwr;
  const rRightArc = arcPoints(-halfW, springY, Rr, 0, Math.PI / 3, SEGS);
  const rLeftArc = arcPoints(halfW, springY, Rr, 2 * Math.PI / 3, Math.PI, SEGS);
  const innerRebated = [[-rHalfW, rBottom], [rHalfW, rBottom], [rHalfW, springY], ...rRightArc, ...rLeftArc, [-rHalfW, springY]];

  return { outer, inner, innerRebated };
}

function segmentalPoints(width, height) {
  const W = mm(width), H = mm(height), fw = mm(FRAME_FACE), bw = mm(BOTTOM_FACE);
  const fwr = mm(EXT_FACE_W), bwr = mm(BOTTOM_INNER);
  const halfW = W / 2;
  const rise = halfW * 0.4;
  const R = (rise * rise + halfW * halfW) / (2 * rise);
  const cy = -H / 2 + (H - rise) - (R - rise);
  const springY = -H / 2 + (H - rise);
  const startAngle = Math.asin(Math.min(halfW / R, 1));

  const topArc = arcPoints(0, cy, R, Math.PI / 2 - startAngle, Math.PI / 2 + startAngle, SEGS);
  const outer = [[-halfW, -H/2], [halfW, -H/2], [halfW, springY], ...topArc, [-halfW, springY]];

  // EXT inner
  const iHalfW = halfW - fw;
  const iBottom = -H / 2 + bw;
  const iRise = Math.max(rise - fw, mm(10));
  const iR = (iRise * iRise + iHalfW * iHalfW) / (2 * iRise);
  const iCY = springY - (iR - iRise);
  const iAngle = Math.asin(Math.min(iHalfW / iR, 1));
  const innerArc = arcPoints(0, iCY, iR, Math.PI / 2 - iAngle, Math.PI / 2 + iAngle, SEGS);
  const inner = [[-iHalfW, iBottom], [iHalfW, iBottom], [iHalfW, springY], ...innerArc, [-iHalfW, springY]];

  // INT innerRebated
  const rHalfW = halfW - fwr;
  const rBottom = -H / 2 + bwr;
  const rRise = Math.max(rise - fwr, mm(10));
  const rR = (rRise * rRise + rHalfW * rHalfW) / (2 * rRise);
  const rCY = springY - (rR - rRise);
  const rAngle = Math.asin(Math.min(rHalfW / rR, 1));
  const rebatedArc = arcPoints(0, rCY, rR, Math.PI / 2 - rAngle, Math.PI / 2 + rAngle, SEGS);
  const innerRebated = [[-rHalfW, rBottom], [rHalfW, rBottom], [rHalfW, springY], ...rebatedArc, [-rHalfW, springY]];

  return { outer, inner, innerRebated };
}

function ellipticalPoints(width, height) {
  const W = mm(width), H = mm(height), fw = mm(FRAME_FACE), bw = mm(BOTTOM_FACE);
  const fwr = mm(EXT_FACE_W), bwr = mm(BOTTOM_INNER);
  const halfW = W / 2;
  const rise = halfW * 0.65;
  const springY = -H / 2 + Math.max(H - rise, mm(50));

  function ellipseArc(a, b, cY, segments) {
    const pts = [];
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI;
      pts.push([a * Math.cos(angle), cY + b * Math.sin(angle)]);
    }
    return pts;
  }

  const outerArc = ellipseArc(halfW, rise, springY, SEGS);
  const outer = [[-halfW, -H/2], [halfW, -H/2], [halfW, springY], ...outerArc, [-halfW, springY]];

  // EXT inner
  const iHalfW = halfW - fw;
  const iBottom = -H / 2 + bw;
  const iRise = Math.max(rise - fw, mm(10));
  const innerArc = ellipseArc(iHalfW, iRise, springY, SEGS);
  const inner = [[-iHalfW, iBottom], [iHalfW, iBottom], [iHalfW, springY], ...innerArc, [-iHalfW, springY]];

  // INT innerRebated
  const rHalfW = halfW - fwr;
  const rBottom = -H / 2 + bwr;
  const rRise = Math.max(rise - fwr, mm(10));
  const rebatedArc = ellipseArc(rHalfW, rRise, springY, SEGS);
  const innerRebated = [[-rHalfW, rBottom], [rHalfW, rBottom], [rHalfW, springY], ...rebatedArc, [-rHalfW, springY]];

  return { outer, inner, innerRebated };
}

// ── Main component ──
export default function ArchedCasementWindow({
  width = 1000,
  height = 1500,
  archShape = 'semi-circle', // gothic-arch, semi-circle, segmental-arch, elliptical-arch
  hingeDirection = 'left',   // left, right
  opening = 0.3,
  woodColor = '#F6F6F6',
  woodColorExt = '#F6F6F6',
  woodColorInt = '#F6F6F6',
  sameColor = true,
  spacerColor = 'silver',
  glassFinish = 'clear',
  hBars = 0,
  vBars = 0,
  showGuides = true,
  brightness = 1.0,
  ironmongery = 'brass',
  sealColour = 'black',
  // Semi-circle hub pattern
  fixSemiBarPattern = 'none',
  fixGothicBars = 'none',
}) {
  const colorE = sameColor ? woodColor : woodColorExt;
  const colorI = sameColor ? woodColor : woodColorInt;

  const extMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: colorE, roughness: 0.72, metalness: 0.02, clearcoat: 0.06, clearcoatRoughness: 0.4,
  }), [colorE]);

  const intMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: colorI, roughness: 0.72, metalness: 0.02, clearcoat: 0.06, clearcoatRoughness: 0.4,
  }), [colorI]);

  const D = mm(FRAME_DEPTH);
  const halfD = D / 2;

  // ── Outer frame geometry ──
  const outerFrameGeo = useMemo(() => {
    let pts;
    if (archShape === 'gothic-arch') pts = gothicPoints(width, height);
    else if (archShape === 'semi-circle') pts = semiCirclePoints(width, height);
    else if (archShape === 'segmental-arch') pts = segmentalPoints(width, height);
    else if (archShape === 'elliptical-arch') pts = ellipticalPoints(width, height);
    else return null;
    if (!pts) return null;
    return makeFrameGeo(pts.outer, pts.inner, pts.innerRebated);
  }, [archShape, width, height]);

  // ── Leaf dimensions ──
  // Leaf = inner opening + rebate overlap - gap
  const leafW = width - FRAME_FACE * 2 + REBATE_STEP * 2 - LEAF_GAP * 2;
  const leafH = height - FRAME_FACE - BOTTOM_FACE + REBATE_STEP * 2 - LEAF_GAP * 2;

  // ── Leaf Z position (sits on gasket, flush with exterior) ──
  const leafZ = halfD - mm(EXT_DEPTH) + mm(GASKET_T) + mm(57) / 2;

  // ── Opening angle ──
  const clampedOpening = Math.max(0, Math.min(1, opening));
  const angleRad = THREE.MathUtils.degToRad(clampedOpening * MAX_ANGLE);

  // ── Leaf pivot dimensions ──
  const leafWm = mm(leafW); // leaf width in meters

  // Effective height (arch shapes may override)
  let effectiveH = height;
  if (archShape === 'gothic-arch') effectiveH = Math.max(height, Math.round(width * Math.sqrt(3) / 2) + 50);
  else if (archShape === 'semi-circle') effectiveH = Math.max(height, Math.round(width / 2) + 50);
  const W = mm(width), H = mm(effectiveH);

  // ── Leaf arch rise: must match outer frame's rebated inner arch ──
  let leafArchRise = 0;
  if (archShape === 'segmental-arch') {
    leafArchRise = Math.round(width * 0.2 - EXT_FACE_W - LEAF_GAP);
  } else if (archShape === 'elliptical-arch') {
    leafArchRise = Math.round(width * 0.325 - EXT_FACE_W - LEAF_GAP);
  }

  // ── Leaf effective height (same logic as FixFrameWindow) ──
  let leafEffH = leafH;
  if (archShape === 'gothic-arch') leafEffH = Math.max(leafH, Math.round(leafW * Math.sqrt(3) / 2) + 50);
  else if (archShape === 'semi-circle') leafEffH = Math.max(leafH, Math.round(leafW / 2) + 50);

  // ── Leaf Y offset: align leaf bottom with outer frame rebated inner bottom + gap ──
  // Outer rebated inner bottom = -height/2 + BOTTOM_INNER (47mm)
  // Leaf bottom = -leafEffH/2 + Y_offset
  // Gap = LEAF_GAP (4mm): leafBottom = outerRebatedBottom + gap
  const leafYOffset = -mm(height) / 2 + mm(BOTTOM_INNER + LEAF_GAP) + mm(leafEffH) / 2;

  // ── Leaf content (FixFrameWindow used directly as leaf) ──
  const leafContent = (
    <group position={[0, leafYOffset, leafZ]}>
      <FixFrameWindow
        width={leafW}
        height={leafH}
        fixShape={archShape}
        fixType="standard"
        woodColor={woodColor}
        woodColorExt={woodColorExt}
        woodColorInt={woodColorInt}
        sameColor={sameColor}
        spacerColor={spacerColor}
        glassFinish={glassFinish}
        hBars={hBars}
        vBars={vBars}
        showGuides={false}
        fixSemiBarPattern={fixSemiBarPattern}
        fixGothicBars={fixGothicBars}
        fixArchRise={leafArchRise}
      />
    </group>
  );

  // ── Leaf with pivot rotation ──
  let leafNode;
  if (clampedOpening === 0) {
    leafNode = leafContent;
  } else if (hingeDirection === 'left') {
    leafNode = (
      <group position={[-leafWm / 2, 0, 0]}>
        <group rotation={[0, -angleRad, 0]}>
          <group position={[leafWm / 2, 0, 0]}>
            {leafContent}
          </group>
        </group>
      </group>
    );
  } else {
    // right hinge
    leafNode = (
      <group position={[leafWm / 2, 0, 0]}>
        <group rotation={[0, angleRad, 0]}>
          <group position={[-leafWm / 2, 0, 0]}>
            {leafContent}
          </group>
        </group>
      </group>
    );
  }

  return (
    <group>
      {/* Outer frame */}
      {outerFrameGeo && (
        <group>
          <mesh geometry={outerFrameGeo.ext} castShadow receiveShadow>
            <primitive object={extMat} attach="material" />
          </mesh>
          <mesh geometry={outerFrameGeo.int} castShadow receiveShadow>
            <primitive object={intMat} attach="material" />
          </mesh>
        </group>
      )}

      {/* Leaf (fix-frame shape) in rebate with pivot */}
      {leafNode}
    </group>
  );
}