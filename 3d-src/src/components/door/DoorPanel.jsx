/**
 * DoorPanel.jsx
 * Door leaf/sash — closed only (opening added later).
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
import DoorGlazing from './DoorGlazing';
import WindowDoorHandle from './WindowDoorHandle';

const mm = (v) => v / 1000;

const LEAF_STILE = 93;         // leaf side rails width (was SASH_RAIL=64)
const LEAF_TOP_RAIL = 93;      // leaf top rail height
const LEAF_BOTTOM_RAIL = 185;  // leaf bottom rail height (fixed)
const SASH_RAIL = LEAF_STILE;  // alias — kept for compat (ArchedDoorWindow imports this)

const SASH_DEPTH = 57;
const MAX_ANGLE = 70;

// Bead constants (from sash windows)
const EBW = mm(9);   // ext chamfer face width
const EBD = mm(15);  // ext chamfer depth
const IBW = mm(18);  // int ovolo face width
const IBD = mm(14);  // int ovolo depth
const IBR = mm(11);  // int ovolo radius
const OVOLO_N = 16;  // arc segments

const F_STILE  = mm(LEAF_STILE);       // 93mm — used by stiles (left/right)
const F_TOP    = mm(LEAF_TOP_RAIL);    // 93mm — used by top rail
const F_BOTTOM = mm(LEAF_BOTTOM_RAIL); // 185mm — used by bottom rail
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

function buildLeftStileShape(F) {
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

function buildRightStileShape(F) {
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

function buildBottomRailShape(F) {
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

function buildTopRailShape(F) {
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

// ── Center Mullion shapes ── (symmetric — glazing on BOTH sides)
// Shape XY: X=face(0=left-glazing, F=right-glazing), Y=depth(0=EXT, D=INT)
// Rendered between rails, splits glass area into 2 panels.
// EXT half: chamfer on both sides (X=0 and X=F) at Y=0..halfDepth
// INT half: ovolo on both sides at Y=halfDepth..D

function buildCenterMullionExt(F, halfDepth) {
  const pts = [
    [EBW, 0],            // bottom-left (inset EBW from left glazing edge)
    [F - EBW, 0],        // bottom-right (inset EBW from right glazing edge)
    [F, EBD],            // right chamfer end (right glazing-EXT)
    [F, halfDepth],      // right side up to split line
    [0, halfDepth],      // across split line to left
    [0, EBD],            // left glazing down to chamfer start
    // closePath back to [EBW, 0]
  ];
  return shapeFromPts(pts);
}

function buildCenterMullionInt(F, halfDepth) {
  const pts = [
    [0, halfDepth],      // bottom-left (at split line)
    [F, halfDepth],      // bottom-right (at split line)
    [F, D - IBR],        // right glazing up to arc start
  ];
  // Right ovolo arc: center (F-IBR, D-IBR), from angle 0 to PI/2 → ends at (F-IBR, D)
  pts.push(...ovoloArc(F - IBR, D - IBR, IBR, 0, Math.PI / 2, OVOLO_N));
  // Flat top across INT face (between the two ovolos)
  pts.push([IBR, D]);
  // Left ovolo arc: center (IBR, D-IBR), from angle PI/2 to PI → ends at (0, D-IBR)
  pts.push(...ovoloArc(IBR, D - IBR, IBR, Math.PI / 2, Math.PI, OVOLO_N));
  // closePath back to [0, halfDepth]
  return shapeFromPts(pts);
}

// ═══ SashFrame ═══
function SashFrame({ width, height, mat, matInt, spacerColor, glassFinish, hBars, vBars, doorStyle = 'full-glass', centerMullion = false }) {
  const W = mm(width);
  const H = mm(height);

  // Bottom rail size depends on door style.
  // half-glazed: bottom rail = leaf height / 2
  // three-quarter: bottom rail = leaf height / 3
  // full-glass: bottom rail = LEAF_BOTTOM_RAIL (185mm fixed minimum)
  const bottomRailMm =
    doorStyle === 'half-glazed'  ? height / 2 :
    doorStyle === 'three-quarter' ? height / 3 :
    LEAF_BOTTOM_RAIL;
  const fBot = mm(bottomRailMm);

  // BOTH stiles and rails go full extent — overlap at corners = natural miter
  const glassW = width - LEAF_STILE * 2;
  const glassH = height - LEAF_TOP_RAIL - bottomRailMm;

  const lStile = useMemo(() => buildLeftStileShape(F_STILE), []);
  const rStile = useMemo(() => buildRightStileShape(F_STILE), []);
  const bRail = useMemo(() => buildBottomRailShape(fBot), [fBot]);
  const tRail = useMemo(() => buildTopRailShape(F_TOP), []);

  const stileSettings = useMemo(() => ({ depth: H, bevelEnabled: false }), [H]);
  const railSettings = useMemo(() => ({ depth: W, bevelEnabled: false }), [W]);

  // Split shapes at depth midpoint for dual colour
  const halfDepth = D / 2;

  // EXT halves (stiles use F_STILE, top rail F_TOP, bottom rail F_BOTTOM)
  const lStileExt = useMemo(() => {
    const pts = [[0,0],[F_STILE-EBW,0],[F_STILE,EBD],[F_STILE,halfDepth],[0,halfDepth]];
    return shapeFromPts(pts);
  }, []);
  const rStileExt = useMemo(() => {
    const pts = [[F_STILE,0],[EBW,0],[0,EBD],[0,halfDepth],[F_STILE,halfDepth]];
    return shapeFromPts(pts);
  }, []);
  const bRailExt = useMemo(() => {
    const pts = [[0,0],[0,fBot-EBW],[EBD,fBot],[halfDepth,fBot],[halfDepth,0]];
    return shapeFromPts(pts);
  }, [fBot]);
  const tRailExt = useMemo(() => {
    const pts = [[0,F_TOP],[0,EBW],[EBD,0],[halfDepth,0],[halfDepth,F_TOP]];
    return shapeFromPts(pts);
  }, []);

  // INT halves
  const lStileInt = useMemo(() => {
    const pts = [[0,halfDepth],[F_STILE,halfDepth],[F_STILE,D-IBR]];
    const arc = ovoloArc(F_STILE-IBR, D-IBR, IBR, 0, Math.PI/2, OVOLO_N);
    pts.push(...arc);
    pts.push([0,D]);
    return shapeFromPts(pts);
  }, []);
  const rStileInt = useMemo(() => {
    const pts = [[F_STILE,halfDepth],[0,halfDepth],[0,D-IBR]];
    const arc = ovoloArc(IBR, D-IBR, IBR, Math.PI, Math.PI/2, OVOLO_N);
    pts.push(...arc);
    pts.push([F_STILE,D]);
    return shapeFromPts(pts);
  }, []);
  const bRailInt = useMemo(() => {
    const pts = [[halfDepth,0],[halfDepth,fBot],[D-IBR,fBot]];
    const arc = ovoloArc(D-IBR, fBot-IBR, IBR, Math.PI/2, 0, OVOLO_N);
    pts.push(...arc);
    pts.push([D,0]);
    return shapeFromPts(pts);
  }, [fBot]);
  const tRailInt = useMemo(() => {
    const pts = [[halfDepth,F_TOP],[halfDepth,0],[D-IBR,0]];
    const arc = ovoloArc(D-IBR, IBR, IBR, -Math.PI/2, 0, OVOLO_N);
    pts.push(...arc);
    pts.push([D,F_TOP]);
    return shapeFromPts(pts);
  }, []);

  const mi = matInt || mat;

  // ── Center mullion geometry (only used when centerMullion=true) ──
  const cmExt = useMemo(() => buildCenterMullionExt(F_STILE, halfDepth), []);
  const cmInt = useMemo(() => buildCenterMullionInt(F_STILE, halfDepth), []);
  const mullionH = H - fBot - F_TOP;
  const mullionSettings = useMemo(
    () => ({ depth: Math.max(mullionH, 0.001), bevelEnabled: false }),
    [mullionH]
  );

  // ── Recessed panel geometry (for three-quarter / half-glazed doors) ──
  // Structure (EXT side, mirrored on INT):
  //   Rim (frame face level, Z=+halfD): 4 strips replacing bRail in panel area
  //   Bevel 1: slanted ring from Z=+halfD (outer edge) to Z=+halfD - RECESS (inner)
  //   Flat step: horizontal ring at Z=+halfD - RECESS
  //   Bevel 2: slanted ring from Z=+halfD - RECESS (outer) to Z=+halfD - RAISED_DROP (inner)
  //   Raised field: horizontal centre at Z=+halfD - RAISED_DROP
  const hasPanel = doorStyle !== 'full-glass';

  // Panel params (mm → meters)
  const PANEL_MARGIN_X_MM = 0;        // from stiles (panel touches stiles directly)
  const PANEL_MARGIN_Y_MM = 100;      // from glass / door bottom
  const BEVEL1_W_MM = 30;             // outer bevel width
  const FLAT_STEP_W_MM = 20;          // flat step width
  const BEVEL2_W_MM = 30;             // inner bevel width
  const RECESS_DEPTH_MM = 8;          // full recess depth (flat step Z)
  const RAISED_DROP_MM = 3;           // raised field depth below frame face
  const PM_X = mm(PANEL_MARGIN_X_MM);
  const PM_Y = mm(PANEL_MARGIN_Y_MM);
  const B1 = mm(BEVEL1_W_MM);
  const FS = mm(FLAT_STEP_W_MM);
  const B2 = mm(BEVEL2_W_MM);
  const REC = mm(RECESS_DEPTH_MM);
  const RD = mm(RAISED_DROP_MM);

  // Rail (bottom rail) XY bounds in 3D coords
  const railLeftX   = -W/2 + F_STILE;
  const railRightX  =  W/2 - F_STILE;
  const railWidth   = railRightX - railLeftX;
  const railBottomY = -H/2;
  const railTopY    = -H/2 + fBot;
  const railHeight  = fBot;

  // Panel outer bounds (0mm margin X, 100mm margin Y)
  const panelL = railLeftX + PM_X;
  const panelR = railRightX - PM_X;
  const panelB = railBottomY + PM_Y;
  const panelT = railTopY - PM_Y;
  const panelW = panelR - panelL;
  const panelH2 = panelT - panelB;

  // Inner-bounds (after bevel 1)
  const innerL = panelL + B1;
  const innerR = panelR - B1;
  const innerB = panelB + B1;
  const innerT = panelT - B1;

  // Flat-step inner bounds (after bevel 1 + flat step width)
  const stepInnerL = innerL + FS;
  const stepInnerR = innerR - FS;
  const stepInnerB = innerB + FS;
  const stepInnerT = innerT - FS;

  // Raised field bounds (after bevel 2)
  const raisedL = stepInnerL + B2;
  const raisedR = stepInnerR - B2;
  const raisedB = stepInnerB + B2;
  const raisedT = stepInnerT - B2;

  // Safety check: panel only valid if raised field has positive area
  const panelValid = hasPanel && raisedR > raisedL && raisedT > raisedB;

  // ── Debug materials (distinctive colours for each panel component) ──
  const matRim      = useMemo(() => new THREE.MeshStandardMaterial({ color: '#888888', roughness: 0.7 }), []);
  const matBevel1   = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e63946', roughness: 0.6, side: THREE.DoubleSide }), []);
  const matFlatStep = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2a9d3f', roughness: 0.6, side: THREE.DoubleSide }), []);
  const matBevel2   = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3b82f6', roughness: 0.6, side: THREE.DoubleSide }), []);
  const matRaised   = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f4c430', roughness: 0.6, side: THREE.DoubleSide }), []);

  // ── Helper: create a quad geometry from 4 3D points (for bevel strips) ──
  const makeQuadGeo = (A, B, C, D) => {
    const geo = new THREE.BufferGeometry();
    const verts = new Float32Array([
      A[0], A[1], A[2],
      B[0], B[1], B[2],
      C[0], C[1], C[2],
      D[0], D[1], D[2],
    ]);
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    geo.computeVertexNormals();
    return geo;
  };

  // ── Flat step ring geometry (single ShapeGeometry = no corner gaps) ──
  const flatStepRingGeo = useMemo(() => {
    if (!panelValid) return null;
    const shape = new THREE.Shape();
    shape.moveTo(innerL, innerB);
    shape.lineTo(innerR, innerB);
    shape.lineTo(innerR, innerT);
    shape.lineTo(innerL, innerT);
    shape.closePath();
    const hole = new THREE.Path();
    hole.moveTo(stepInnerL, stepInnerB);
    hole.lineTo(stepInnerR, stepInnerB);
    hole.lineTo(stepInnerR, stepInnerT);
    hole.lineTo(stepInnerL, stepInnerT);
    hole.closePath();
    shape.holes.push(hole);
    return new THREE.ShapeGeometry(shape);
  }, [panelValid, innerL, innerR, innerB, innerT, stepInnerL, stepInnerR, stepInnerB, stepInnerT]);

  // ── Panel geometry (memoised) ──
  // Build all bevel quads once, reuse for EXT and INT (mirrored in Z)
  const panelGeo = useMemo(() => {
    if (!panelValid) return null;
    const zFrame = halfD;
    const zFloor = halfD - REC;   // flat step Z (EXT side)
    const zRaised = halfD - RD;   // raised field Z (EXT side)

    // Bevel 1 quads (outer slant, frame → floor)
    const b1Top = makeQuadGeo(
      [panelL, panelT, zFrame],      // outer TL
      [panelR, panelT, zFrame],      // outer TR
      [innerR, innerT, zFloor],      // inner TR
      [innerL, innerT, zFloor],      // inner TL
    );
    const b1Bot = makeQuadGeo(
      [panelR, panelB, zFrame],      // outer BR
      [panelL, panelB, zFrame],      // outer BL
      [innerL, innerB, zFloor],      // inner BL
      [innerR, innerB, zFloor],      // inner BR
    );
    const b1Left = makeQuadGeo(
      [panelL, panelB, zFrame],      // outer BL
      [panelL, panelT, zFrame],      // outer TL
      [innerL, innerT, zFloor],      // inner TL
      [innerL, innerB, zFloor],      // inner BL
    );
    const b1Right = makeQuadGeo(
      [panelR, panelT, zFrame],      // outer TR
      [panelR, panelB, zFrame],      // outer BR
      [innerR, innerB, zFloor],      // inner BR
      [innerR, innerT, zFloor],      // inner TR
    );

    // Bevel 2 quads (inner slant, floor → raised)
    const b2Top = makeQuadGeo(
      [stepInnerL, stepInnerT, zFloor],
      [stepInnerR, stepInnerT, zFloor],
      [raisedR, raisedT, zRaised],
      [raisedL, raisedT, zRaised],
    );
    const b2Bot = makeQuadGeo(
      [stepInnerR, stepInnerB, zFloor],
      [stepInnerL, stepInnerB, zFloor],
      [raisedL, raisedB, zRaised],
      [raisedR, raisedB, zRaised],
    );
    const b2Left = makeQuadGeo(
      [stepInnerL, stepInnerB, zFloor],
      [stepInnerL, stepInnerT, zFloor],
      [raisedL, raisedT, zRaised],
      [raisedL, raisedB, zRaised],
    );
    const b2Right = makeQuadGeo(
      [stepInnerR, stepInnerT, zFloor],
      [stepInnerR, stepInnerB, zFloor],
      [raisedR, raisedB, zRaised],
      [raisedR, raisedT, zRaised],
    );

    return { b1Top, b1Bot, b1Left, b1Right, b2Top, b2Bot, b2Left, b2Right };
  }, [panelValid, halfD, panelL, panelR, panelB, panelT, innerL, innerR, innerB, innerT, stepInnerL, stepInnerR, stepInnerB, stepInnerT, raisedL, raisedR, raisedB, raisedT]);

  // Panel geo INT side (mirrored — negate Z)
  const panelGeoInt = useMemo(() => {
    if (!panelValid) return null;
    const zFrame = -halfD;
    const zFloor = -halfD + REC;   // flat step Z (INT side, mirrored)
    const zRaised = -halfD + RD;   // raised field Z (INT side, mirrored)

    const b1Top = makeQuadGeo(
      [panelL, panelT, zFrame],
      [innerL, innerT, zFloor],
      [innerR, innerT, zFloor],
      [panelR, panelT, zFrame],
    );
    const b1Bot = makeQuadGeo(
      [panelR, panelB, zFrame],
      [innerR, innerB, zFloor],
      [innerL, innerB, zFloor],
      [panelL, panelB, zFrame],
    );
    const b1Left = makeQuadGeo(
      [panelL, panelB, zFrame],
      [innerL, innerB, zFloor],
      [innerL, innerT, zFloor],
      [panelL, panelT, zFrame],
    );
    const b1Right = makeQuadGeo(
      [panelR, panelT, zFrame],
      [innerR, innerT, zFloor],
      [innerR, innerB, zFloor],
      [panelR, panelB, zFrame],
    );
    const b2Top = makeQuadGeo(
      [stepInnerL, stepInnerT, zFloor],
      [raisedL, raisedT, zRaised],
      [raisedR, raisedT, zRaised],
      [stepInnerR, stepInnerT, zFloor],
    );
    const b2Bot = makeQuadGeo(
      [stepInnerR, stepInnerB, zFloor],
      [raisedR, raisedB, zRaised],
      [raisedL, raisedB, zRaised],
      [stepInnerL, stepInnerB, zFloor],
    );
    const b2Left = makeQuadGeo(
      [stepInnerL, stepInnerB, zFloor],
      [raisedL, raisedB, zRaised],
      [raisedL, raisedT, zRaised],
      [stepInnerL, stepInnerT, zFloor],
    );
    const b2Right = makeQuadGeo(
      [stepInnerR, stepInnerT, zFloor],
      [raisedR, raisedT, zRaised],
      [raisedR, raisedB, zRaised],
      [stepInnerR, stepInnerB, zFloor],
    );
    return { b1Top, b1Bot, b1Left, b1Right, b2Top, b2Bot, b2Left, b2Right };
  }, [panelValid, halfD, panelL, panelR, panelB, panelT, innerL, innerR, innerB, innerT, stepInnerL, stepInnerR, stepInnerB, stepInnerT, raisedL, raisedR, raisedB, raisedT]);

  return (
    <group>
      {/* ─── Left stile EXT ─── */}
      <mesh castShadow receiveShadow rotation={[-Math.PI/2,0,0]} position={[-W/2,-H/2,halfD]}>
        <extrudeGeometry args={[lStileExt, stileSettings]} />
        <primitive object={mat} attach="material" />
      </mesh>
      {/* ─── Left stile INT ─── */}
      <mesh castShadow receiveShadow rotation={[-Math.PI/2,0,0]} position={[-W/2,-H/2,halfD]}>
        <extrudeGeometry args={[lStileInt, stileSettings]} />
        <primitive object={mi} attach="material" />
      </mesh>

      {/* ─── Right stile EXT ─── */}
      <mesh castShadow receiveShadow rotation={[-Math.PI/2,0,0]} position={[W/2-F_STILE,-H/2,halfD]}>
        <extrudeGeometry args={[rStileExt, stileSettings]} />
        <primitive object={mat} attach="material" />
      </mesh>
      {/* ─── Right stile INT ─── */}
      <mesh castShadow receiveShadow rotation={[-Math.PI/2,0,0]} position={[W/2-F_STILE,-H/2,halfD]}>
        <extrudeGeometry args={[rStileInt, stileSettings]} />
        <primitive object={mi} attach="material" />
      </mesh>

      {/* ─── Bottom rail (solid, only when no recessed panel) ─── */}
      {!hasPanel && (
        <>
          <mesh castShadow receiveShadow rotation={[0,Math.PI/2,0]} position={[-W/2,-H/2,halfD]}>
            <extrudeGeometry args={[bRailExt, railSettings]} />
            <primitive object={mat} attach="material" />
          </mesh>
          <mesh castShadow receiveShadow rotation={[0,Math.PI/2,0]} position={[-W/2,-H/2,halfD]}>
            <extrudeGeometry args={[bRailInt, railSettings]} />
            <primitive object={mi} attach="material" />
          </mesh>
        </>
      )}

      {/* ─── Bottom rail split into 4 rim strips around recessed panel ─── */}
      {panelValid && (
        <group>
          {/* Top strip: full rail width, between glass and panel top */}
          <mesh castShadow receiveShadow position={[0, (panelT + railTopY) / 2, 0]}>
            <boxGeometry args={[railWidth, railTopY - panelT, D]} />
            <primitive object={matRim} attach="material" />
          </mesh>
          {/* Bottom strip: full rail width, between door bottom and panel bottom */}
          <mesh castShadow receiveShadow position={[0, (railBottomY + panelB) / 2, 0]}>
            <boxGeometry args={[railWidth, panelB - railBottomY, D]} />
            <primitive object={matRim} attach="material" />
          </mesh>
          {/* Left strip: only if PM_X > 0 (skip when panel touches stile) */}
          {PM_X > 0 && (
            <mesh castShadow receiveShadow position={[(railLeftX + panelL) / 2, (panelB + panelT) / 2, 0]}>
              <boxGeometry args={[panelL - railLeftX, panelH2, D]} />
              <primitive object={matRim} attach="material" />
            </mesh>
          )}
          {/* Right strip: only if PM_X > 0 */}
          {PM_X > 0 && (
            <mesh castShadow receiveShadow position={[(panelR + railRightX) / 2, (panelB + panelT) / 2, 0]}>
              <boxGeometry args={[railRightX - panelR, panelH2, D]} />
              <primitive object={matRim} attach="material" />
            </mesh>
          )}
        </group>
      )}

      {/* ─── Recessed panel layers (EXT + INT symmetric) ─── */}
      {panelValid && panelGeo && panelGeoInt && (
        <group>
          {/* EXT side — Bevel 1 (4 slanted strips, red) */}
          <mesh geometry={panelGeo.b1Top}   castShadow receiveShadow><primitive object={matBevel1} attach="material" /></mesh>
          <mesh geometry={panelGeo.b1Bot}   castShadow receiveShadow><primitive object={matBevel1} attach="material" /></mesh>
          <mesh geometry={panelGeo.b1Left}  castShadow receiveShadow><primitive object={matBevel1} attach="material" /></mesh>
          <mesh geometry={panelGeo.b1Right} castShadow receiveShadow><primitive object={matBevel1} attach="material" /></mesh>

          {/* EXT side — Flat step ring (single ShapeGeometry at Z=halfD-REC, green) */}
          {flatStepRingGeo && (
            <mesh geometry={flatStepRingGeo} position={[0, 0, halfD - REC]} castShadow receiveShadow>
              <primitive object={matFlatStep} attach="material" />
            </mesh>
          )}

          {/* EXT side — Bevel 2 (4 slanted strips, blue) */}
          <mesh geometry={panelGeo.b2Top}   castShadow receiveShadow><primitive object={matBevel2} attach="material" /></mesh>
          <mesh geometry={panelGeo.b2Bot}   castShadow receiveShadow><primitive object={matBevel2} attach="material" /></mesh>
          <mesh geometry={panelGeo.b2Left}  castShadow receiveShadow><primitive object={matBevel2} attach="material" /></mesh>
          <mesh geometry={panelGeo.b2Right} castShadow receiveShadow><primitive object={matBevel2} attach="material" /></mesh>

          {/* EXT side — Raised field centre (yellow) */}
          <mesh position={[0, (raisedB + raisedT) / 2, halfD - RD]} castShadow receiveShadow>
            <planeGeometry args={[raisedR - raisedL, raisedT - raisedB]} />
            <primitive object={matRaised} attach="material" />
          </mesh>

          {/* INT side — Bevel 1 (mirrored) */}
          <mesh geometry={panelGeoInt.b1Top}   castShadow receiveShadow><primitive object={matBevel1} attach="material" /></mesh>
          <mesh geometry={panelGeoInt.b1Bot}   castShadow receiveShadow><primitive object={matBevel1} attach="material" /></mesh>
          <mesh geometry={panelGeoInt.b1Left}  castShadow receiveShadow><primitive object={matBevel1} attach="material" /></mesh>
          <mesh geometry={panelGeoInt.b1Right} castShadow receiveShadow><primitive object={matBevel1} attach="material" /></mesh>

          {/* INT side — Flat step ring at Z=-halfD+REC, rotated to face -Z */}
          {flatStepRingGeo && (
            <mesh geometry={flatStepRingGeo} position={[0, 0, -halfD + REC]} rotation={[Math.PI, 0, 0]} castShadow receiveShadow>
              <primitive object={matFlatStep} attach="material" />
            </mesh>
          )}

          {/* INT side — Bevel 2 (mirrored) */}
          <mesh geometry={panelGeoInt.b2Top}   castShadow receiveShadow><primitive object={matBevel2} attach="material" /></mesh>
          <mesh geometry={panelGeoInt.b2Bot}   castShadow receiveShadow><primitive object={matBevel2} attach="material" /></mesh>
          <mesh geometry={panelGeoInt.b2Left}  castShadow receiveShadow><primitive object={matBevel2} attach="material" /></mesh>
          <mesh geometry={panelGeoInt.b2Right} castShadow receiveShadow><primitive object={matBevel2} attach="material" /></mesh>

          {/* INT side — Raised field centre (facing -Z) */}
          <mesh position={[0, (raisedB + raisedT) / 2, -halfD + RD]} rotation={[Math.PI, 0, 0]} castShadow receiveShadow>
            <planeGeometry args={[raisedR - raisedL, raisedT - raisedB]} />
            <primitive object={matRaised} attach="material" />
          </mesh>
        </group>
      )}

      {/* ─── Top rail EXT ─── */}
      <mesh castShadow receiveShadow rotation={[0,Math.PI/2,0]} position={[-W/2,H/2-F_TOP,halfD]}>
        <extrudeGeometry args={[tRailExt, railSettings]} />
        <primitive object={mat} attach="material" />
      </mesh>
      {/* ─── Top rail INT ─── */}
      <mesh castShadow receiveShadow rotation={[0,Math.PI/2,0]} position={[-W/2,H/2-F_TOP,halfD]}>
        <extrudeGeometry args={[tRailInt, railSettings]} />
        <primitive object={mi} attach="material" />
      </mesh>

      {/* ─── Center Mullion (optional addon) ─── */}
      {centerMullion && mullionH > 0 && (
        <>
          <mesh castShadow receiveShadow rotation={[-Math.PI/2,0,0]} position={[-F_STILE/2, -H/2 + fBot, halfD]}>
            <extrudeGeometry args={[cmExt, mullionSettings]} />
            <primitive object={mat} attach="material" />
          </mesh>
          <mesh castShadow receiveShadow rotation={[-Math.PI/2,0,0]} position={[-F_STILE/2, -H/2 + fBot, halfD]}>
            <extrudeGeometry args={[cmInt, mullionSettings]} />
            <primitive object={mi} attach="material" />
          </mesh>
        </>
      )}

      {/* ─── Glazing (single when no mullion, split into 2 panels when centerMullion=true) ─── */}
      {glassW > 0 && glassH > 0 && !centerMullion && (
        <DoorGlazing width={glassW} height={glassH} hBars={hBars} vBars={vBars} barMaterial={mat} barMaterialInt={mi} spacerColor={spacerColor} glassFinish={glassFinish} position={[0, mm((bottomRailMm - LEAF_TOP_RAIL) / 2), 0]} />
      )}
      {glassW > 0 && glassH > 0 && centerMullion && (() => {
        // Split glass into 2 panels with LEAF_STILE-wide mullion between them
        const halfGlassW = (glassW - LEAF_STILE) / 2;
        if (halfGlassW <= 0) return null;
        const yOffset = mm((bottomRailMm - LEAF_TOP_RAIL) / 2);
        const xOff = mm(halfGlassW / 2 + LEAF_STILE / 2);
        return (
          <>
            <DoorGlazing width={halfGlassW} height={glassH} hBars={hBars} vBars={vBars} barMaterial={mat} barMaterialInt={mi} spacerColor={spacerColor} glassFinish={glassFinish} position={[-xOff, yOffset, 0]} />
            <DoorGlazing width={halfGlassW} height={glassH} hBars={hBars} vBars={vBars} barMaterial={mat} barMaterialInt={mi} spacerColor={spacerColor} glassFinish={glassFinish} position={[xOff, yOffset, 0]} />
          </>
        );
      })()}
    </group>
  );
}

// ═══ Main DoorPanel ═══
export default function DoorPanel({
  width = 600,
  height = 900,
  hingeType = 'left',
  opening = 0,
  material,
  materialInt,
  spacerColor = 'silver',
  glassFinish = 'clear',
  hBars = 0,
  vBars = 0,
  ironmongery = 'brass',
  position = [0, 0, 0],
  doorStyle = 'full-glass',
  centerMullion = false,
}) {
  const mat = material;
  const W = mm(width);
  const H = mm(height);

  const handleColors = useMemo(() => {
    const defs = {
      brass:         { metalColor: '#d4af37', lockColor: '#c9b07a' },
      chrome:        { metalColor: '#e8eaec', lockColor: '#c8cacc' },
      stainless:     { metalColor: '#c8c8c8', lockColor: '#a8a8a8' },
      antique_brass: { metalColor: '#9c7722', lockColor: '#7a5810' },
      black:         { metalColor: '#1a1a1a', lockColor: '#111111' },
      white:         { metalColor: '#f0f0f0', lockColor: '#d8d8d8' },
    };
    return defs[ironmongery] || defs.brass;
  }, [ironmongery]);

  // Opening angle: 0-1 mapped to 0-MAX_ANGLE degrees
  const clampedOpening = Math.max(0, Math.min(1, opening));
  const angleRad = THREE.MathUtils.degToRad(clampedOpening * MAX_ANGLE);
  const handleDeg = clampedOpening * MAX_ANGLE;

  // Handle position: opposite stile from hinges, interior face
  const handleScale = 0.001;
  const REBATE = 21; // mm hidden behind frame
  const stileCenter = mm(REBATE + (LEAF_STILE - REBATE) / 2); // visible center
  const intZ = -D / 2 - 0.001; // just outside interior face

  // Handle Y: 400mm from bottom, or center if panel < 800mm
  const handleY = height >= 800 ? (-H / 2 + mm(500)) : 0;

  let handlePos = null;
  let handleRot = null;
  if (hingeType === 'left') {
    // Handle on right stile, interior face
    handlePos = [W / 2 - stileCenter, handleY, intZ];
    handleRot = [0, -Math.PI / 2, 0];
  } else if (hingeType === 'right') {
    // Handle on left stile, interior face
    handlePos = [-W / 2 + stileCenter, handleY, intZ];
    handleRot = [0, -Math.PI / 2, 0];
  } else if (hingeType === 'top') {
    // Handle on bottom rail, interior face, horizontal
    handlePos = [0, -H / 2 + stileCenter, intZ];
    handleRot = [Math.PI / 2, 0, Math.PI / 2];
  }

  const content = (
    <group>
      <SashFrame width={width} height={height} mat={mat} matInt={materialInt} spacerColor={spacerColor} glassFinish={glassFinish} hBars={hBars} vBars={vBars} doorStyle={doorStyle} centerMullion={centerMullion} />
      {handlePos && hingeType !== 'fixed' && (
        <group position={handlePos} rotation={handleRot} scale={[handleScale, handleScale, handleScale]}>
          <WindowDoorHandle rotationDeg={hingeType === 'left' ? -handleDeg : handleDeg} metalColor={handleColors.metalColor} lockColor={handleColors.lockColor} />
        </group>
      )}
    </group>
  );

  if (hingeType === 'fixed' || clampedOpening === 0) {
    // No rotation
    return <group position={position}>{content}</group>;
  }

  // Pivot rotation: translate hinge to origin → rotate → translate back
  if (hingeType === 'left') {
    // Hinge at left edge (x = -W/2), opens outward (+Z)
    return (
      <group position={position}>
        <group position={[-W / 2, 0, 0]}>
          <group rotation={[0, -angleRad, 0]}>
            <group position={[W / 2, 0, 0]}>
              {content}
            </group>
          </group>
        </group>
      </group>
    );
  }

  if (hingeType === 'right') {
    // Hinge at right edge (x = +W/2), opens outward (+Z)
    return (
      <group position={position}>
        <group position={[W / 2, 0, 0]}>
          <group rotation={[0, angleRad, 0]}>
            <group position={[-W / 2, 0, 0]}>
              {content}
            </group>
          </group>
        </group>
      </group>
    );
  }

  if (hingeType === 'top') {
    // Hinge at top edge (y = +H/2), opens outward (+Z)
    return (
      <group position={position}>
        <group position={[0, H / 2, 0]}>
          <group rotation={[-angleRad, 0, 0]}>
            <group position={[0, -H / 2, 0]}>
              {content}
            </group>
          </group>
        </group>
      </group>
    );
  }

  // Fallback
  return <group position={position}>{content}</group>;
}

export { SASH_RAIL, SASH_DEPTH, MAX_ANGLE };