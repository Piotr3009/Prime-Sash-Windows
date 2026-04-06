/**
 * ArchedCasementWindow.jsx
 * Arched casement = outer frame (arch shape, CasementFrame dims) + leaf (FixFrameWindow).
 * Leaf sits in rebate with 4mm gap, pivots left/right.
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { FRAME_FACE, FRAME_DEPTH, EXT_DEPTH, REBATE_STEP, BOTTOM_FACE, GASKET_T, mm } from './CasementFrame';
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

// ── Frame geometry from outer + inner point arrays ──
function makeFrameGeo(outerPts, innerPts, depth) {
  const shape = new THREE.Shape();
  shape.moveTo(outerPts[0][0], outerPts[0][1]);
  for (let i = 1; i < outerPts.length; i++) shape.lineTo(outerPts[i][0], outerPts[i][1]);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(innerPts[0][0], innerPts[0][1]);
  for (let i = 1; i < innerPts.length; i++) hole.lineTo(innerPts[i][0], innerPts[i][1]);
  hole.closePath();
  shape.holes.push(hole);

  // Two half-depth geometries for dual color
  const halfD = depth / 2;
  const ext = new THREE.ExtrudeGeometry(shape, { depth: halfD, bevelEnabled: false });
  ext.translate(0, 0, 0);
  ext.computeVertexNormals();
  const int = new THREE.ExtrudeGeometry(shape, { depth: halfD, bevelEnabled: false });
  int.translate(0, 0, -halfD);
  int.computeVertexNormals();
  return { ext, int };
}

// ── Arch shape point generators for OUTER FRAME ──
// Returns { outer, inner, effectiveH, archRiseMm }
function semiCirclePoints(width, height) {
  const W = mm(width), H = mm(height), fw = mm(FRAME_FACE), bw = mm(BOTTOM_FACE);
  const halfW = W / 2;
  const springY = -H / 2 + Math.max(H - halfW, mm(50));
  const iHalfW = halfW - fw;
  const iBottom = -H / 2 + bw;
  const outerArc = arcPoints(0, springY, halfW, 0, Math.PI, SEGS);
  const outer = [[-halfW, -H/2], [halfW, -H/2], [halfW, springY], ...outerArc, [-halfW, springY]];
  const innerArc = arcPoints(0, springY, iHalfW, 0, Math.PI, SEGS);
  const inner = [[-iHalfW, iBottom], [iHalfW, iBottom], [iHalfW, springY], ...innerArc, [-iHalfW, springY]];
  return { outer, inner };
}

function gothicPoints(width, height) {
  const W = mm(width), H = mm(height), fw = mm(FRAME_FACE), bw = mm(BOTTOM_FACE);
  const halfW = W / 2;
  const archR = W; // gothic radius = full width
  const archRiseMm = Math.round(width * Math.sqrt(3) / 2);
  const effectiveH = Math.max(height, archRiseMm + 50);
  const He = mm(effectiveH);
  const springY = -He / 2 + (He - mm(archRiseMm));
  // Outer
  const outerArcPts = [];
  for (let i = 0; i <= SEGS; i++) {
    const t = i / SEGS;
    const aL = Math.asin(t * mm(archRiseMm) / archR * 2);
    // Left arc center at (halfW, springY), right arc at (-halfW, springY)
  }
  // Simplified: use same approach as FixFrameWindow gothic
  // Gothic outer: two arcs meeting at top
  const cLX = -halfW, cRX = halfW;
  const outerPtsR = [], outerPtsL = [];
  for (let i = 0; i <= SEGS / 2; i++) {
    const t = i / (SEGS / 2);
    const angle = Math.asin(t);
    const px = cLX + archR * Math.cos(angle);
    const py = springY + archR * Math.sin(angle);
    if (px >= -halfW && px <= halfW && py >= springY) outerPtsR.push([px, py]);
  }
  for (let i = SEGS / 2; i >= 0; i--) {
    const t = i / (SEGS / 2);
    const angle = Math.PI - Math.asin(t);
    const px = cRX + archR * Math.cos(angle);
    const py = springY + archR * Math.sin(angle);
    if (px >= -halfW && px <= halfW && py >= springY) outerPtsL.push([px, py]);
  }
  const outerArch = [...outerPtsR, ...outerPtsL];
  const outer = [[-halfW, -He/2], [halfW, -He/2], [halfW, springY], ...outerArch, [-halfW, springY]];

  // Inner
  const iHalfW = halfW - fw;
  const iBottom = -He / 2 + bw;
  const iArchR = archR - fw;
  const iCLX = -iHalfW, iCRX = iHalfW;
  // Use inner width's arch
  const archRInner = mm(width - FRAME_FACE * 2); // inner gothic radius
  const innerPtsR = [], innerPtsL = [];
  for (let i = 0; i <= SEGS / 2; i++) {
    const t = i / (SEGS / 2);
    const angle = Math.asin(Math.min(t, 1));
    const px = -iHalfW + archRInner * Math.cos(angle);
    const py = springY + archRInner * Math.sin(angle);
    if (px >= -iHalfW && px <= iHalfW && py >= springY) innerPtsR.push([px, py]);
  }
  for (let i = SEGS / 2; i >= 0; i--) {
    const t = i / (SEGS / 2);
    const angle = Math.PI - Math.asin(Math.min(t, 1));
    const px = iHalfW + archRInner * Math.cos(angle);
    const py = springY + archRInner * Math.sin(angle);
    if (px >= -iHalfW && px <= iHalfW && py >= springY) innerPtsL.push([px, py]);
  }
  const innerArch = [...innerPtsR, ...innerPtsL];
  const inner = [[-iHalfW, iBottom], [iHalfW, iBottom], [iHalfW, springY], ...innerArch, [-iHalfW, springY]];

  return { outer, inner, effectiveH };
}

function segmentalPoints(width, height) {
  const W = mm(width), H = mm(height), fw = mm(FRAME_FACE), bw = mm(BOTTOM_FACE);
  const halfW = W / 2;
  const riseMm = Math.round(width * 0.2);
  const rise = mm(riseMm);
  const springY = -H / 2 + (H - rise);
  // Segmental arc: radius from chord + rise
  const chord = W;
  const R = (chord * chord / 4 + rise * rise) / (2 * rise);
  const cy = springY - (R - rise);
  const startA = Math.acos(-halfW / R);
  const endA = Math.acos(halfW / R);
  const outerArc = [];
  for (let i = 0; i <= SEGS; i++) {
    const a = startA + (endA - startA) * (i / SEGS);
    outerArc.push([cy > springY ? R * Math.cos(a) : R * Math.cos(a), cy + R * Math.sin(a)]);
  }
  const outer = [[-halfW, -H/2], [halfW, -H/2], [halfW, springY], ...outerArc, [-halfW, springY]];

  const iHalfW = halfW - fw;
  const iBottom = -H / 2 + bw;
  const iRise = rise - fw;
  if (iRise > 0) {
    const iChord = iHalfW * 2;
    const iR = (iChord * iChord / 4 + iRise * iRise) / (2 * iRise);
    const iCy = springY - (iR - iRise);
    const iStartA = Math.acos(Math.max(-1, Math.min(1, -iHalfW / iR)));
    const iEndA = Math.acos(Math.max(-1, Math.min(1, iHalfW / iR)));
    const innerArc = [];
    for (let i = 0; i <= SEGS; i++) {
      const a = iStartA + (iEndA - iStartA) * (i / SEGS);
      innerArc.push([iR * Math.cos(a), iCy + iR * Math.sin(a)]);
    }
    const inner = [[-iHalfW, iBottom], [iHalfW, iBottom], [iHalfW, springY], ...innerArc, [-iHalfW, springY]];
    return { outer, inner };
  }
  // Fallback: flat top inner
  const inner = [[-iHalfW, iBottom], [iHalfW, iBottom], [iHalfW, springY], [-iHalfW, springY]];
  return { outer, inner };
}

function ellipticalPoints(width, height) {
  const W = mm(width), H = mm(height), fw = mm(FRAME_FACE), bw = mm(BOTTOM_FACE);
  const halfW = W / 2;
  const riseMm = Math.round(width * 0.325);
  const rise = mm(riseMm);
  const springY = -H / 2 + (H - rise);
  // Ellipse: semi-axes a=halfW, b=rise
  const outerArc = [];
  for (let i = 0; i <= SEGS; i++) {
    const a = Math.PI - (i / SEGS) * Math.PI;
    outerArc.push([halfW * Math.cos(a), springY + rise * Math.sin(a)]);
  }
  const outer = [[-halfW, -H/2], [halfW, -H/2], [halfW, springY], ...outerArc, [-halfW, springY]];

  const iHalfW = halfW - fw;
  const iBottom = -H / 2 + bw;
  const iRise = rise - fw;
  const innerArc = [];
  for (let i = 0; i <= SEGS; i++) {
    const a = Math.PI - (i / SEGS) * Math.PI;
    innerArc.push([iHalfW * Math.cos(a), springY + Math.max(iRise, mm(10)) * Math.sin(a)]);
  }
  const inner = [[-iHalfW, iBottom], [iHalfW, iBottom], [iHalfW, springY], ...innerArc, [-iHalfW, springY]];
  return { outer, inner };
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
    return makeFrameGeo(pts.outer, pts.inner, D);
  }, [archShape, width, height, D]);

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

  // ── Leaf content (FixFrameWindow used directly as leaf) ──
  const leafContent = (
    <group position={[0, 0, leafZ]}>
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
