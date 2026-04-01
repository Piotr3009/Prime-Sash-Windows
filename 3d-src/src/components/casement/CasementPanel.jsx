/**
 * CasementPanel.jsx
 * Casement leaf/sash — closed only (opening added later).
 * 
 * Profile (cross-section of any member):
 *   - Outer edge (toward frame): FLAT
 *   - Glazing edge (toward glass): chamfer 9×15 on EXT, ovolo R11(18×14) on INT
 *   - Both decorations on glazing side ONLY (identical to sash windows)
 * 
 * Dims: 64mm face × 57mm depth
 * Construction: Rails full width, stiles between rails.
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import CasementGlazing from './CasementGlazing';

const mm = (v) => v / 1000;

const SASH_RAIL = 64;
const SASH_DEPTH = 57;
const MAX_ANGLE = 70;

// Bead constants (from sash windows)
const EBW = mm(9);   // ext chamfer face width
const EBD = mm(15);  // ext chamfer depth
const IBW = mm(18);  // int ovolo face width
const IBD = mm(14);  // int ovolo depth
const IBR = mm(11);  // int ovolo radius
const OVOLO_N = 16;  // arc segments

const F = mm(SASH_RAIL);  // face
const D = mm(SASH_DEPTH); // depth
const halfD = D / 2;

// ─── Shape builders ───
// All shapes: chamfer on EXT side of glazing, ovolo on INT side of glazing

// Ovolo arc points from startPt to endPt around center
function ovoloArc(cx, cy, r, startAngle, endAngle, n) {
  const pts = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const a = startAngle + t * (endAngle - startAngle);
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

function shapeFromPts(pts) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  return s;
}

// ── Stile shapes ──
// Shape XY: X=face(0=outer, F=glazing), Y=depth(0=EXT, D=INT)
// Extrude along Z → height, rotation [-PI/2,0,0]: X→worldX, Y→-worldZ, Z→worldY

function buildLeftStileShape() {
  // Glazing at X=F (right side)
  const pts = [
    [0, 0],            // outer-EXT
    [F - EBW, 0],      // EXT face before chamfer
    [F, EBD],           // chamfer end (glazing-EXT)
    [F, D - IBR],       // glazing edge to arc start
  ];
  // Ovolo arc: center (F-IBR, D-IBR), from angle 0 to PI/2
  pts.push(...ovoloArc(F - IBR, D - IBR, IBR, 0, Math.PI / 2, OVOLO_N));
  pts.push([0, D]);    // INT face to outer
  return shapeFromPts(pts);
}

function buildRightStileShape() {
  // Glazing at X=0 (left side) — mirror of left
  const pts = [
    [F, 0],             // outer-EXT
    [EBW, 0],           // EXT face before chamfer
    [0, EBD],           // chamfer (glazing-EXT)
    [0, D - IBR],       // glazing edge to arc start
  ];
  // Ovolo arc: center (IBR, D-IBR), from PI to PI/2
  pts.push(...ovoloArc(IBR, D - IBR, IBR, Math.PI, Math.PI / 2, OVOLO_N));
  pts.push([F, D]);     // INT face to outer
  return shapeFromPts(pts);
}

// ── Rail shapes ──
// Shape XY: X=depth(0=EXT, D=INT), Y=face(0=outer, F=glazing)
// Extrude along Z → width, rotation [0,PI/2,0]: X→-worldZ, Y→worldY, Z→worldX

function buildBottomRailShape() {
  // Glazing at Y=F (top)
  const pts = [
    [0, 0],             // EXT-outer
    [0, F - EBW],       // EXT face before chamfer
    [EBD, F],           // chamfer (EXT-glazing)
    [D - IBR, F],       // glazing to arc start
  ];
  // Ovolo arc: center (D-IBR, F-IBR), from PI/2 to 0
  pts.push(...ovoloArc(D - IBR, F - IBR, IBR, Math.PI / 2, 0, OVOLO_N));
  pts.push([D, 0]);     // INT-outer
  return shapeFromPts(pts);
}

function buildTopRailShape() {
  // Glazing at Y=0 (bottom) — mirror of bottom rail (flip Y)
  const pts = [
    [0, F],              // EXT-outer
    [0, EBW],            // EXT face before chamfer
    [EBD, 0],            // chamfer (EXT-glazing)
    [D - IBR, 0],        // glazing to arc start
  ];
  // Ovolo arc: center (D-IBR, IBR), from -PI/2 to 0 (=3PI/2 to 2PI)
  pts.push(...ovoloArc(D - IBR, IBR, IBR, -Math.PI / 2, 0, OVOLO_N));
  pts.push([D, F]);      // INT-outer
  return shapeFromPts(pts);
}

// ═══ SashFrame ═══
function SashFrame({ width, height, mat, hBars, vBars }) {
  const W = mm(width);
  const H = mm(height);

  // BOTH stiles and rails go full extent — overlap at corners = natural miter
  const glassW = width - SASH_RAIL * 2;
  const glassH = height - SASH_RAIL * 2;

  const lStile = useMemo(() => buildLeftStileShape(), []);
  const rStile = useMemo(() => buildRightStileShape(), []);
  const bRail = useMemo(() => buildBottomRailShape(), []);
  const tRail = useMemo(() => buildTopRailShape(), []);

  const stileSettings = useMemo(() => ({ depth: H, bevelEnabled: false }), [H]);
  const railSettings = useMemo(() => ({ depth: W, bevelEnabled: false }), [W]);

  return (
    <group>
      {/* ─── Left stile — FULL HEIGHT ─── */}
      <mesh castShadow receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
        position={[-W / 2, -H / 2, halfD]}
      >
        <extrudeGeometry args={[lStile, stileSettings]} />
        <primitive object={mat} attach="material" />
      </mesh>

      {/* ─── Right stile — FULL HEIGHT ─── */}
      <mesh castShadow receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
        position={[W / 2 - F, -H / 2, halfD]}
      >
        <extrudeGeometry args={[rStile, stileSettings]} />
        <primitive object={mat} attach="material" />
      </mesh>

      {/* ─── Bottom rail — FULL WIDTH ─── */}
      <mesh castShadow receiveShadow
        rotation={[0, Math.PI / 2, 0]}
        position={[-W / 2, -H / 2, halfD]}
      >
        <extrudeGeometry args={[bRail, railSettings]} />
        <primitive object={mat} attach="material" />
      </mesh>

      {/* ─── Top rail — FULL WIDTH ─── */}
      <mesh castShadow receiveShadow
        rotation={[0, Math.PI / 2, 0]}
        position={[-W / 2, H / 2 - F, halfD]}
      >
        <extrudeGeometry args={[tRail, railSettings]} />
        <primitive object={mat} attach="material" />
      </mesh>

      {/* ─── Glazing ─── */}
      {glassW > 0 && glassH > 0 && (
        <CasementGlazing width={glassW} height={glassH} hBars={hBars} vBars={vBars} barMaterial={mat} position={[0, 0, 0]} />
      )}
    </group>
  );
}

// ═══ Main CasementPanel ═══
export default function CasementPanel({
  width = 600,
  height = 900,
  hingeType = 'left',
  opening = 0,
  material,
  materialInt,
  hBars = 0,
  vBars = 0,
  position = [0, 0, 0],
}) {
  const mat = material;

  // For now: always closed (opening later)
  return (
    <group position={position}>
      <SashFrame width={width} height={height} mat={mat} hBars={hBars} vBars={vBars} />
    </group>
  );
}

export { SASH_RAIL, SASH_DEPTH, MAX_ANGLE };