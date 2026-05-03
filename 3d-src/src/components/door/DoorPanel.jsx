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
import DoorHandleChrome from './DoorHandleChrome';

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
function SashFrame({ width, height, mat, matInt, spacerColor, glassFinish, hBars, vBars, doorStyle = 'full-glass', centerMullion = false, paneling = 'flat', stileWidthMm = LEAF_STILE }) {
  const W = mm(width);
  const H = mm(height);
  const fS = mm(stileWidthMm);  // stile face width (default 93mm door, 57mm for side panels)

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
  const glassW = width - stileWidthMm * 2;
  const glassH = height - LEAF_TOP_RAIL - bottomRailMm;

  const lStile = useMemo(() => buildLeftStileShape(fS), [fS]);
  const rStile = useMemo(() => buildRightStileShape(fS), [fS]);
  const bRail = useMemo(() => buildBottomRailShape(fBot), [fBot]);
  const tRail = useMemo(() => buildTopRailShape(F_TOP), []);

  const stileSettings = useMemo(() => ({ depth: H, bevelEnabled: false }), [H]);
  const railSettings = useMemo(() => ({ depth: W, bevelEnabled: false }), [W]);

  // Split shapes at depth midpoint for dual colour
  const halfDepth = D / 2;

  // EXT halves (stiles use F_STILE, top rail F_TOP, bottom rail F_BOTTOM)
  const lStileExt = useMemo(() => {
    const pts = [[0,0],[fS-EBW,0],[fS,EBD],[fS,halfDepth],[0,halfDepth]];
    return shapeFromPts(pts);
  }, [fS]);
  const rStileExt = useMemo(() => {
    const pts = [[fS,0],[EBW,0],[0,EBD],[0,halfDepth],[fS,halfDepth]];
    return shapeFromPts(pts);
  }, [fS]);
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
    const pts = [[0,halfDepth],[fS,halfDepth],[fS,D-IBR]];
    const arc = ovoloArc(fS-IBR, D-IBR, IBR, 0, Math.PI/2, OVOLO_N);
    pts.push(...arc);
    pts.push([0,D]);
    return shapeFromPts(pts);
  }, [fS]);
  const rStileInt = useMemo(() => {
    const pts = [[fS,halfDepth],[0,halfDepth],[0,D-IBR]];
    const arc = ovoloArc(IBR, D-IBR, IBR, Math.PI, Math.PI/2, OVOLO_N);
    pts.push(...arc);
    pts.push([fS,D]);
    return shapeFromPts(pts);
  }, [fS]);
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

  // ── Panel materials: DoubleSide clones so bevel quads render regardless of normal direction ──
  const matPanel = useMemo(() => {
    const m = mat.clone();
    m.side = THREE.DoubleSide;
    return m;
  }, [mat]);
  const miPanel = useMemo(() => {
    const m = mi.clone();
    m.side = THREE.DoubleSide;
    return m;
  }, [mi]);

  // ── Center mullion geometry (only used when centerMullion=true) ──
  const cmExt = useMemo(() => buildCenterMullionExt(fS, halfDepth), [fS]);
  const cmInt = useMemo(() => buildCenterMullionInt(fS, halfDepth), [fS]);
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
  // Panel renders only when door has non-full-glass style AND paneling is 'panel'
  // 'flat' / 'beading' / 'bespoke' → render solid bottom rail (no recessed panel)
  const hasPanel = doorStyle !== 'full-glass' && paneling === 'panel';

  // Panel params (mm → meters)
  const PANEL_MARGIN_X_MM = 0;          // from stiles (panel touches stiles directly)
  const PANEL_MARGIN_TOP_MM = 100;      // from glass edge (top of bottom rail)
  const PANEL_MARGIN_BOTTOM_MM = 150;   // from door bottom
  const BEVEL1_W_MM = 30;               // outer bevel width
  const FLAT_STEP_W_MM = 20;            // flat step width
  const BEVEL2_W_MM = 30;               // inner bevel width
  const RECESS_DEPTH_MM = 8;            // full recess depth (flat step Z)
  const RAISED_DROP_MM = 3;             // raised field depth below frame face
  const PM_X = mm(PANEL_MARGIN_X_MM);
  const PM_TOP = mm(PANEL_MARGIN_TOP_MM);
  const PM_BOT = mm(PANEL_MARGIN_BOTTOM_MM);
  const B1 = mm(BEVEL1_W_MM);
  const FS = mm(FLAT_STEP_W_MM);
  const B2 = mm(BEVEL2_W_MM);
  const REC = mm(RECESS_DEPTH_MM);
  const RD = mm(RAISED_DROP_MM);

  // Rail (bottom rail) XY bounds in 3D coords
  const railLeftX   = -W/2 + fS;
  const railRightX  =  W/2 - fS;
  const railWidth   = railRightX - railLeftX;
  const railBottomY = -H/2;
  const railTopY    = -H/2 + fBot;
  const railHeight  = fBot;

  // Panel outer bounds (0mm from stiles, 100mm from glass, 150mm from door bottom)
  const panelL = railLeftX + PM_X;
  const panelR = railRightX - PM_X;
  const panelB = railBottomY + PM_BOT;
  const panelT = railTopY - PM_TOP;
  const panelW = panelR - panelL;

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

  // ═══ Beading params and geometry ═══
  // Beading = 4 ogee mouldings nailed on top of flat bottom rail (EXT + INT mirrored)
  // Margins identical to panel: 150mm bot, 100mm top, 100mm L/R (but using PM_X=0 would make it touch stile)
  // For beading we override L/R margin to 100mm (unlike panel which is 0)
  const BEADING_MARGIN_X_MM = 0;
  const BEADING_MARGIN_TOP_MM = 100;
  const BEADING_MARGIN_BOTTOM_MM = 150;
  const BEADING_W_MM = 20;   // moulding width (lying flat on rail)
  const BEADING_H_MM = 15;   // moulding height (protruding above rail)
  const BM_X = mm(BEADING_MARGIN_X_MM);
  const BM_TOP = mm(BEADING_MARGIN_TOP_MM);
  const BM_BOT = mm(BEADING_MARGIN_BOTTOM_MM);
  const BW = mm(BEADING_W_MM);
  const BH = mm(BEADING_H_MM);

  const hasBeading = doorStyle !== 'full-glass' && paneling === 'beading';

  // Beading frame outer bounds (inner edge of the rectangular beading ring on EXT face, Z=halfD)
  const bdL = railLeftX + BM_X;
  const bdR = railRightX - BM_X;
  const bdB = railBottomY + BM_BOT;
  const bdT = railTopY - BM_TOP;
  const bdFrameW = bdR - bdL;
  const bdFrameH = bdT - bdB;
  const beadingValid = hasBeading && bdFrameW > 2 * BW && bdFrameH > 2 * BW;

  // ═══ Ogee profile — cross-section of the moulding ═══
  // Shape in local 2D:
  //   X: 0 = OUTER edge of frame (apex side)
  //   X: BW = INNER edge of frame (cove-to-rail)
  //   Y: 0 = rail surface (base)
  //   Y: BH = apex top
  //
  // Shape sequence (counter-clockwise, closed):
  //   (0,0) → (0,BH-R) → arc to (R,BH) → flat top → (ST_X, ST_Y) → cove bezier to (BW,0) → back to (0,0)
  //   R     = apex bullnose radius (5mm)
  //   ST_X  = step after apex (~R, ~8mm)
  //   ST_Y  = step height where cove begins (~BH-R, ~10mm)
  const ogeeProfile = useMemo(() => {
    const R = mm(5);              // apex bullnose radius
    const stepX = mm(8);          // cove starts at this X (just past apex)
    const stepY = mm(10);         // cove top Y (just below apex)
    const shape = new THREE.Shape();
    // Outer edge: straight up from base to just below apex
    shape.moveTo(0, 0);
    shape.lineTo(0, BH - R);
    // Apex bullnose: quarter arc convex outward
    shape.quadraticCurveTo(0, BH, R, BH);
    // Flat top segment (apex plateau)
    shape.lineTo(stepX, BH);
    // Step down to cove top
    shape.lineTo(stepX, stepY);
    // Cove (concave) bezier sweep from step down to inner-base corner
    shape.bezierCurveTo(
      mm(14), stepY,    // control 1: pulls horizontally toward inner edge
      BW, mm(4),        // control 2: pulls down toward base
      BW, 0             // end at inner-bottom corner
    );
    // Close along rail surface back to start
    shape.lineTo(0, 0);
    return shape;
  }, [BW, BH]);

  // ═══ Build one ogee-bar geometry via Matrix4 basis ═══
  // profile: Shape defined above (profile X = width apex→cove, profile Y = height base→apex)
  // length: extrusion depth (along shape-local Z)
  // xAxis, yAxis, zAxis: world-space unit vectors defining orientation
  //   xAxis = world direction for profile X (apex-to-cove direction)
  //   yAxis = world direction for profile Y (base-to-apex direction = perpendicular to door surface)
  //   zAxis = world direction for extrusion (length direction)
  // pos: world position of the profile's origin corner (outer-base corner of the bar)
  // REQUIREMENT: xAxis × yAxis must equal zAxis (right-handed basis) — verified per bar below
  const makeOgeeBar = (profile, length, xAxis, yAxis, zAxis, pos) => {
    const geo = new THREE.ExtrudeGeometry(profile, { depth: length, bevelEnabled: false });
    const m = new THREE.Matrix4();
    m.makeBasis(xAxis, yAxis, zAxis);
    geo.applyMatrix4(m);
    geo.translate(pos.x, pos.y, pos.z);
    return geo;
  };

  // ═══ Build 8 bar geometries (4 EXT + 4 INT) ═══
  // bdFrameW = frame width (bdR - bdL), runs along X world
  // bdFrameH = frame height (bdT - bdB), runs along Y world
  // EXT bars protrude in +Z (height direction = (0,0,1)), INT bars protrude in -Z
  //
  // Convention: pos = outer-base corner of the bar (where profile origin lands)
  //   "outer" = the world edge where APEX sits (away from frame center)
  //   "base" = the door surface side (Z = halfD for EXT, -halfD for INT)
  //
  // Handedness check for each bar: xAxis × yAxis must equal zAxis.
  //   ax × ay = az (right-handed Cartesian)

  const beadingBarsExt = useMemo(() => {
    if (!beadingValid) return null;
    const vX = new THREE.Vector3(1, 0, 0);
    const vY = new THREE.Vector3(0, 1, 0);
    const vZ = new THREE.Vector3(0, 0, 1);
    const nvX = new THREE.Vector3(-1, 0, 0);
    const nvY = new THREE.Vector3(0, -1, 0);

    // TOP EXT: apex at world Y=bdT (top edge of frame), cove pointing down to bdT-BW
    //   profile X (apex→cove) = world -Y → xAxis = -Y
    //   profile Y (base→apex) = world +Z → yAxis = +Z
    //   extrusion (length) along +X → zAxis = +X
    //   check: (-Y) × (+Z) = -(Y×Z) = -X ≠ +X ❌ left-handed
    //   fix: flip zAxis to -X, start pos at bdR instead of bdL (extrude runs bdR → bdL)
    //   check: (-Y) × (+Z) = -X = zAxis ✓ right-handed
    // pos = (bdR, bdT, halfD) because bar extrudes in -X from bdR down to bdL
    const topExt = makeOgeeBar(ogeeProfile, bdFrameW, nvY.clone(), vZ.clone(), nvX.clone(),
      new THREE.Vector3(bdR, bdT, halfD));

    // BOTTOM EXT: apex at world Y=bdB (bottom edge), cove pointing up to bdB+BW
    //   xAxis = +Y (apex→cove)
    //   yAxis = +Z (base→apex = out of door)
    //   zAxis wants +X (bdL→bdR)
    //   check: (+Y) × (+Z) = +X = zAxis ✓ right-handed
    // pos = (bdL, bdB, halfD)
    const botExt = makeOgeeBar(ogeeProfile, bdFrameW, vY.clone(), vZ.clone(), vX.clone(),
      new THREE.Vector3(bdL, bdB, halfD));

    // LEFT EXT: apex at world X=bdL (left edge), cove pointing right to bdL+BW
    //   xAxis = +X (apex→cove)
    //   yAxis = +Z (base→apex)
    //   zAxis wants +Y (bdB→bdT)
    //   check: (+X) × (+Z) = -Y ≠ +Y ❌ left-handed
    //   fix: flip zAxis to -Y, pos at bdB+bdFrameH = bdT
    //   check: (+X) × (+Z) = -Y = zAxis ✓ right-handed
    // pos = (bdL, bdT, halfD) extrudes in -Y down to bdB
    const leftExt = makeOgeeBar(ogeeProfile, bdFrameH, vX.clone(), vZ.clone(), nvY.clone(),
      new THREE.Vector3(bdL, bdT, halfD));

    // RIGHT EXT: apex at world X=bdR (right edge), cove pointing left to bdR-BW
    //   xAxis = -X (apex→cove)
    //   yAxis = +Z (base→apex)
    //   zAxis wants +Y
    //   check: (-X) × (+Z) = +Y = zAxis ✓ right-handed
    // pos = (bdR, bdB, halfD)
    const rightExt = makeOgeeBar(ogeeProfile, bdFrameH, nvX.clone(), vZ.clone(), vY.clone(),
      new THREE.Vector3(bdR, bdB, halfD));

    return { topExt, botExt, leftExt, rightExt };
  }, [beadingValid, ogeeProfile, bdFrameW, bdFrameH, bdL, bdR, bdT, bdB, halfD]);

  const beadingBarsInt = useMemo(() => {
    if (!beadingValid) return null;
    const vX = new THREE.Vector3(1, 0, 0);
    const vY = new THREE.Vector3(0, 1, 0);
    const nvX = new THREE.Vector3(-1, 0, 0);
    const nvY = new THREE.Vector3(0, -1, 0);
    const nvZ = new THREE.Vector3(0, 0, -1);
    const zINT = -halfD;

    // INT mirror of EXT — base-to-apex direction flips to -Z instead of +Z
    // Re-verify handedness for each with new yAxis = -Z

    // TOP INT: xAxis = -Y, yAxis = -Z, zAxis = ?
    //   (-Y) × (-Z) = +X → zAxis = +X (right-handed)
    //   pos = (bdL, bdT, zINT) extrudes in +X
    const topInt = makeOgeeBar(ogeeProfile, bdFrameW, nvY.clone(), nvZ.clone(), vX.clone(),
      new THREE.Vector3(bdL, bdT, zINT));

    // BOTTOM INT: xAxis = +Y, yAxis = -Z, zAxis = ?
    //   (+Y) × (-Z) = -X → zAxis = -X
    //   pos = (bdR, bdB, zINT) extrudes in -X
    const botInt = makeOgeeBar(ogeeProfile, bdFrameW, vY.clone(), nvZ.clone(), nvX.clone(),
      new THREE.Vector3(bdR, bdB, zINT));

    // LEFT INT: xAxis = +X, yAxis = -Z, zAxis = ?
    //   (+X) × (-Z) = +Y → zAxis = +Y
    //   pos = (bdL, bdB, zINT) extrudes in +Y
    const leftInt = makeOgeeBar(ogeeProfile, bdFrameH, vX.clone(), nvZ.clone(), vY.clone(),
      new THREE.Vector3(bdL, bdB, zINT));

    // RIGHT INT: xAxis = -X, yAxis = -Z, zAxis = ?
    //   (-X) × (-Z) = -Y → zAxis = -Y
    //   pos = (bdR, bdT, zINT) extrudes in -Y
    const rightInt = makeOgeeBar(ogeeProfile, bdFrameH, nvX.clone(), nvZ.clone(), nvY.clone(),
      new THREE.Vector3(bdR, bdT, zINT));

    return { topInt, botInt, leftInt, rightInt };
  }, [beadingValid, ogeeProfile, bdFrameW, bdFrameH, bdL, bdR, bdT, bdB, halfD]);

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

  // ── Flat step ring INT (same XY coords, inverted winding → normals point -Z) ──
  const flatStepRingGeoInt = useMemo(() => {
    if (!flatStepRingGeo) return null;
    const geo = flatStepRingGeo.clone();
    // Reverse index order to flip normals from +Z to -Z
    const idx = geo.index;
    if (idx) {
      const arr = idx.array;
      const reversed = new arr.constructor(arr.length);
      for (let i = 0; i < arr.length; i += 3) {
        reversed[i] = arr[i];
        reversed[i + 1] = arr[i + 2];
        reversed[i + 2] = arr[i + 1];
      }
      geo.setIndex(new THREE.BufferAttribute(reversed, 1));
    }
    geo.computeVertexNormals();
    return geo;
  }, [flatStepRingGeo]);

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
      <mesh castShadow receiveShadow rotation={[-Math.PI/2,0,0]} position={[W/2-fS,-H/2,halfD]}>
        <extrudeGeometry args={[rStileExt, stileSettings]} />
        <primitive object={mat} attach="material" />
      </mesh>
      {/* ─── Right stile INT ─── */}
      <mesh castShadow receiveShadow rotation={[-Math.PI/2,0,0]} position={[W/2-fS,-H/2,halfD]}>
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

      {/* ─── Bottom rail split into 2 rim strips (top + bottom) around recessed panel ─── */}
      {/* Each strip is split into EXT half (z=+halfD/2, mat) and INT half (z=-halfD/2, mi) for dual colour */}
      {panelValid && (
        <group>
          {/* Top strip EXT half */}
          <mesh castShadow receiveShadow position={[0, (panelT + railTopY) / 2, halfD / 2]}>
            <boxGeometry args={[railWidth, railTopY - panelT, halfD]} />
            <primitive object={mat} attach="material" />
          </mesh>
          {/* Top strip INT half */}
          <mesh castShadow receiveShadow position={[0, (panelT + railTopY) / 2, -halfD / 2]}>
            <boxGeometry args={[railWidth, railTopY - panelT, halfD]} />
            <primitive object={mi} attach="material" />
          </mesh>
          {/* Bottom strip EXT half */}
          <mesh castShadow receiveShadow position={[0, (railBottomY + panelB) / 2, halfD / 2]}>
            <boxGeometry args={[railWidth, panelB - railBottomY, halfD]} />
            <primitive object={mat} attach="material" />
          </mesh>
          {/* Bottom strip INT half */}
          <mesh castShadow receiveShadow position={[0, (railBottomY + panelB) / 2, -halfD / 2]}>
            <boxGeometry args={[railWidth, panelB - railBottomY, halfD]} />
            <primitive object={mi} attach="material" />
          </mesh>
        </group>
      )}

      {/* ─── Recessed panel layers (EXT + INT symmetric, wood material, DoubleSide) ─── */}
      {panelValid && panelGeo && panelGeoInt && (
        <group>
          {/* EXT side — Bevel 1 (4 slanted strips) */}
          <mesh geometry={panelGeo.b1Top}   castShadow receiveShadow><primitive object={matPanel} attach="material" /></mesh>
          <mesh geometry={panelGeo.b1Bot}   castShadow receiveShadow><primitive object={matPanel} attach="material" /></mesh>
          <mesh geometry={panelGeo.b1Left}  castShadow receiveShadow><primitive object={matPanel} attach="material" /></mesh>
          <mesh geometry={panelGeo.b1Right} castShadow receiveShadow><primitive object={matPanel} attach="material" /></mesh>

          {/* EXT side — Flat step ring (single ShapeGeometry at Z=halfD-REC) */}
          {flatStepRingGeo && (
            <mesh geometry={flatStepRingGeo} position={[0, 0, halfD - REC]} castShadow receiveShadow>
              <primitive object={matPanel} attach="material" />
            </mesh>
          )}

          {/* EXT side — Bevel 2 (4 slanted strips) */}
          <mesh geometry={panelGeo.b2Top}   castShadow receiveShadow><primitive object={matPanel} attach="material" /></mesh>
          <mesh geometry={panelGeo.b2Bot}   castShadow receiveShadow><primitive object={matPanel} attach="material" /></mesh>
          <mesh geometry={panelGeo.b2Left}  castShadow receiveShadow><primitive object={matPanel} attach="material" /></mesh>
          <mesh geometry={panelGeo.b2Right} castShadow receiveShadow><primitive object={matPanel} attach="material" /></mesh>

          {/* EXT side — Raised field centre */}
          <mesh position={[0, (raisedB + raisedT) / 2, halfD - RD]} castShadow receiveShadow>
            <planeGeometry args={[raisedR - raisedL, raisedT - raisedB]} />
            <primitive object={matPanel} attach="material" />
          </mesh>

          {/* INT side — Bevel 1 (mirrored) */}
          <mesh geometry={panelGeoInt.b1Top}   castShadow receiveShadow><primitive object={miPanel} attach="material" /></mesh>
          <mesh geometry={panelGeoInt.b1Bot}   castShadow receiveShadow><primitive object={miPanel} attach="material" /></mesh>
          <mesh geometry={panelGeoInt.b1Left}  castShadow receiveShadow><primitive object={miPanel} attach="material" /></mesh>
          <mesh geometry={panelGeoInt.b1Right} castShadow receiveShadow><primitive object={miPanel} attach="material" /></mesh>

          {/* INT side — Flat step ring at Z=-halfD+REC (inverted winding, no rotation needed) */}
          {flatStepRingGeoInt && (
            <mesh geometry={flatStepRingGeoInt} position={[0, 0, -halfD + REC]} castShadow receiveShadow>
              <primitive object={miPanel} attach="material" />
            </mesh>
          )}

          {/* INT side — Bevel 2 (mirrored) */}
          <mesh geometry={panelGeoInt.b2Top}   castShadow receiveShadow><primitive object={miPanel} attach="material" /></mesh>
          <mesh geometry={panelGeoInt.b2Bot}   castShadow receiveShadow><primitive object={miPanel} attach="material" /></mesh>
          <mesh geometry={panelGeoInt.b2Left}  castShadow receiveShadow><primitive object={miPanel} attach="material" /></mesh>
          <mesh geometry={panelGeoInt.b2Right} castShadow receiveShadow><primitive object={miPanel} attach="material" /></mesh>

          {/* INT side — Raised field centre (facing -Z) */}
          <mesh position={[0, (raisedB + raisedT) / 2, -halfD + RD]} rotation={[Math.PI, 0, 0]} castShadow receiveShadow>
            <planeGeometry args={[raisedR - raisedL, raisedT - raisedB]} />
            <primitive object={miPanel} attach="material" />
          </mesh>
        </group>
      )}

      {/* ─── Beading frame (4 ogee mouldings EXT + 4 INT) ─── */}
      {beadingValid && beadingBarsExt && beadingBarsInt && (
        <group>
          {/* ═══ EXT side ═══ */}
          <mesh geometry={beadingBarsExt.topExt}   castShadow receiveShadow><primitive object={mat} attach="material" /></mesh>
          <mesh geometry={beadingBarsExt.botExt}   castShadow receiveShadow><primitive object={mat} attach="material" /></mesh>
          <mesh geometry={beadingBarsExt.leftExt}  castShadow receiveShadow><primitive object={mat} attach="material" /></mesh>
          <mesh geometry={beadingBarsExt.rightExt} castShadow receiveShadow><primitive object={mat} attach="material" /></mesh>

          {/* ═══ INT side ═══ */}
          <mesh geometry={beadingBarsInt.topInt}   castShadow receiveShadow><primitive object={mi} attach="material" /></mesh>
          <mesh geometry={beadingBarsInt.botInt}   castShadow receiveShadow><primitive object={mi} attach="material" /></mesh>
          <mesh geometry={beadingBarsInt.leftInt}  castShadow receiveShadow><primitive object={mi} attach="material" /></mesh>
          <mesh geometry={beadingBarsInt.rightInt} castShadow receiveShadow><primitive object={mi} attach="material" /></mesh>
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
          <mesh castShadow receiveShadow rotation={[-Math.PI/2,0,0]} position={[-fS/2, -H/2 + fBot, halfD]}>
            <extrudeGeometry args={[cmExt, mullionSettings]} />
            <primitive object={mat} attach="material" />
          </mesh>
          <mesh castShadow receiveShadow rotation={[-Math.PI/2,0,0]} position={[-fS/2, -H/2 + fBot, halfD]}>
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
        // Split glass into 2 panels with stileWidthMm-wide mullion between them
        const halfGlassW = (glassW - stileWidthMm) / 2;
        if (halfGlassW <= 0) return null;
        const yOffset = mm((bottomRailMm - LEAF_TOP_RAIL) / 2);
        const xOff = mm(halfGlassW / 2 + stileWidthMm / 2);
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
  openDirection = 'outward',
  slideDist = 0,
  isSliding = false,
  showHandle,
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
  paneling = 'flat',
  stileWidthMm,
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
  const dirSign = openDirection === 'inward' ? -1 : 1;
  const angleRad = THREE.MathUtils.degToRad(clampedOpening * MAX_ANGLE) * dirSign;
  const handleDeg = clampedOpening * MAX_ANGLE;

  // Handle position: opposite stile from hinges
  const REBATE = 21; // mm hidden behind frame
  const effectiveStile = stileWidthMm || LEAF_STILE;
  const stileCenter = mm(REBATE + (effectiveStile - REBATE) / 2); // visible center of stile (X offset from leaf edge)
  const extZ = D / 2;   // exterior face of leaf (positive Z)
  const intZ = -D / 2;  // interior face of leaf (negative Z)

  // Handle Y: 1000mm from bottom of door, constant regardless of door height
  const handleY = -H / 2 + mm(1000);

  // Horizontal position (X) and side mapping for DoorHandleChrome
  // hingeType='left' → hinge at left stile → handle on RIGHT stile → side='right'
  // hingeType='right' → hinge at right stile → handle on LEFT stile → side='left'
  let handleX = null;
  let handleSide = 'right';
  if (hingeType === 'left') {
    handleX = W / 2 - stileCenter;
    handleSide = 'right';
  } else if (hingeType === 'right') {
    handleX = -W / 2 + stileCenter;
    handleSide = 'left';
  } else if (isSliding) {
    // Sliding panels: handle on meeting edge
    // Slide right (slideDist>0) → handle on LEFT (meeting stile)
    // Slide left (slideDist<0) → handle on RIGHT (meeting stile)
    if (slideDist >= 0) {
      handleX = -W / 2 + stileCenter;
      handleSide = 'left';
    } else {
      handleX = W / 2 - stileCenter;
      handleSide = 'right';
    }
  }
  // hingeType === 'top' → no handle

  // ─── Weather bar — quarter-round drip bar on exterior bottom ───
  const weatherBarShape = useMemo(() => {
    const bH = mm(40);  // height (upward curve)
    const bD = mm(30);  // depth (outward projection)
    const k = 0.5523;   // bezier approximation for quarter ellipse
    const s = new THREE.Shape();
    s.moveTo(0, 0);      // bottom-back (flat bottom, against door)
    s.lineTo(bD, 0);     // bottom-front (projects outward)
    s.bezierCurveTo(bD, bH * k, bD * k, bH, 0, bH); // quarter curve UP
    s.closePath();
    return s;
  }, []);

  const content = (
    <group>
      <SashFrame width={width} height={height} mat={mat} matInt={materialInt} spacerColor={spacerColor} glassFinish={glassFinish} hBars={hBars} vBars={vBars} doorStyle={doorStyle} centerMullion={centerMullion} paneling={paneling} stileWidthMm={stileWidthMm} />
      {handleX !== null && (isSliding ? showHandle : hingeType !== 'fixed') && (
        <>
          {/* EXT handle — opposite side (was wrong in v1, flip side to fix) */}
          <DoorHandleChrome
            position={[handleX, handleY, extZ]}
            rotation={[0, 0, 0]}
            scale={1}
            side={handleSide === 'right' ? 'left' : 'right'}
          />
          {/* INT handle — rotated 180° around Y so lever protrudes outward from INT side (-Z) */}
          <DoorHandleChrome
            position={[handleX, handleY, intZ]}
            rotation={[0, Math.PI, 0]}
            scale={1}
            side={handleSide}
          />
        </>
      )}
      {/* Weather bar — quarter-round drip bar, exterior bottom (not for sliding) */}
      {!isSliding && (
      <mesh castShadow receiveShadow position={[W / 2 - mm(10), -H / 2 + mm(40), halfD]} rotation={[0, -Math.PI / 2, 0]}>
        <extrudeGeometry args={[weatherBarShape, { depth: W - mm(20), bevelEnabled: false }]} />
        <primitive object={mat} attach="material" />
      </mesh>
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

  if (hingeType === 'slide') {
    // Linear slide: translate X by opening * slideDist (signed distance)
    const slideX = clampedOpening * slideDist;
    return (
      <group position={position}>
        <group position={[slideX, 0, 0]}>
          {content}
        </group>
      </group>
    );
  }

  // Fallback
  return <group position={position}>{content}</group>;
}

export { SASH_RAIL, SASH_DEPTH, MAX_ANGLE };