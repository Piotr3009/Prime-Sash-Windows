// ═══════════════════════════════════════════════════════════════════
// PanelGridLeaf — front-door leaf divided into a grid of cells.
// Each cell is independently 'glass' or 'panel' (raised field).
// Layer 2, commit 2a: builds the grid geometry (dividers + cell bounds)
// and renders every cell as a raised panel for now. Glass-per-cell and
// beading arrive in commit 2b. Backward compat: this component is ONLY
// used when a panelGrid prop is present; single/french doors are untouched.
// ═══════════════════════════════════════════════════════════════════
import React, { useMemo } from 'react';
import * as THREE from 'three';
import DoorGlazing from './DoorGlazing';

const mm = (v) => v / 1000;

// Front-door leaf frame — 94mm stiles/top rail, 180mm bottom rail.
// These ARE Piotr's 94/94/180: the leaf frame itself provides the border
// around the panels, so the grid adds no extra inset (margins = 0).
const LEAF_STILE = 94;
const LEAF_TOP_RAIL = 94;
const LEAF_BOTTOM_RAIL = 180;
const SASH_DEPTH = 57;
const D = mm(SASH_DEPTH);
const halfD = D / 2;

// Grid geometry:
const DIVIDER_MM = 94;        // timber divider between cells (muntin / cross rail)
const CELL_MARGIN_X_MM = 0;   // cells fill the full leaf light — leaf stiles are the border
const CELL_MARGIN_Y_MM = 0;   // cells fill the full leaf light — leaf rails are the border

// Raised-field params inside each panel cell (reuse DoorPanel look)
const BEVEL1_W_MM = 30;
const FLAT_STEP_W_MM = 20;
const BEVEL2_W_MM = 30;
const RECESS_DEPTH_MM = 8;
const RAISED_DROP_MM = 3;

// Beading around each panel — the SAME ogee moulding already used on the
// existing doors (DoorPanel), just applied per grid cell instead of once
// per leaf. Proven profile: bullnose apex + cove sweeping back to the base.
const BEADING_W_MM = 20;   // moulding width (lying flat on the panel field)
const BEADING_H_MM = 15;   // moulding height (protruding above the face)

// Build a slanted ring (4 strips) for a bevel between two rectangles at
// different Z. Returns a BufferGeometry with the 4 slanted quads.
function bevelRing(outerL, outerR, outerB, outerT, innerL, innerR, innerB, innerT, zOuter, zInner) {
  const positions = [];
  const quad = (ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz) => {
    positions.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    positions.push(ax, ay, az, cx, cy, cz, dx, dy, dz);
  };
  // top strip
  quad(outerL, outerT, zOuter, outerR, outerT, zOuter, innerR, innerT, zInner, innerL, innerT, zInner);
  // bottom strip
  quad(innerL, innerB, zInner, innerR, innerB, zInner, outerR, outerB, zOuter, outerL, outerB, zOuter);
  // left strip
  quad(outerL, outerB, zOuter, outerL, outerT, zOuter, innerL, innerT, zInner, innerL, innerB, zInner);
  // right strip
  quad(innerR, innerB, zInner, innerR, innerT, zInner, outerR, outerT, zOuter, outerR, outerB, zOuter);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  return g;
}

// Ogee beading profile — ported 1:1 from DoorPanel (proven geometry).
// profile X = width apex→cove, profile Y = height base→apex.
function makeOgeeProfile() {
  const BW = mm(BEADING_W_MM);
  const BH = mm(BEADING_H_MM);
  const R = mm(5);        // apex bullnose radius
  const stepX = mm(8);    // cove starts just past apex
  const stepY = mm(10);   // cove top Y
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0, BH - R);
  shape.quadraticCurveTo(0, BH, R, BH);
  shape.lineTo(stepX, BH);
  shape.lineTo(stepX, stepY);
  shape.bezierCurveTo(mm(14), stepY, BW, mm(4), BW, 0);
  shape.lineTo(0, 0);
  return shape;
}

// Extrude one bar along a right-handed basis — same helper as DoorPanel.
function makeOgeeBar(profile, length, xAxis, yAxis, zAxis, pos) {
  const geo = new THREE.ExtrudeGeometry(profile, { depth: length, bevelEnabled: false });
  const m = new THREE.Matrix4();
  m.makeBasis(xAxis, yAxis, zAxis);
  geo.applyMatrix4(m);
  geo.translate(pos.x, pos.y, pos.z);
  return geo;
}

// Beading frame around one cell: 4 bars EXT + 4 INT, apex on the outer edge.
// Axis/handedness conventions copied verbatim from DoorPanel.
function BeadingFrame({ L, R, B, T, mat, mi }) {
  const bars = useMemo(() => {
    const bdL = L, bdR = R, bdB = B, bdT = T;
    const w = bdR - bdL, h = bdT - bdB;
    const BW = mm(BEADING_W_MM);
    if (w <= 2 * BW || h <= 2 * BW) return null;
    const prof = makeOgeeProfile();
    const vX = new THREE.Vector3(1, 0, 0);
    const vY = new THREE.Vector3(0, 1, 0);
    const vZ = new THREE.Vector3(0, 0, 1);
    const nvX = new THREE.Vector3(-1, 0, 0);
    const nvY = new THREE.Vector3(0, -1, 0);
    const nvZ = new THREE.Vector3(0, 0, -1);
    const zINT = -halfD;
    return {
      topExt: makeOgeeBar(prof, w, nvY.clone(), vZ.clone(), nvX.clone(), new THREE.Vector3(bdR, bdT, halfD)),
      botExt: makeOgeeBar(prof, w, vY.clone(), vZ.clone(), vX.clone(), new THREE.Vector3(bdL, bdB, halfD)),
      leftExt: makeOgeeBar(prof, h, vX.clone(), vZ.clone(), nvY.clone(), new THREE.Vector3(bdL, bdT, halfD)),
      rightExt: makeOgeeBar(prof, h, nvX.clone(), vZ.clone(), vY.clone(), new THREE.Vector3(bdR, bdB, halfD)),
      topInt: makeOgeeBar(prof, w, nvY.clone(), nvZ.clone(), vX.clone(), new THREE.Vector3(bdL, bdT, zINT)),
      botInt: makeOgeeBar(prof, w, vY.clone(), nvZ.clone(), nvX.clone(), new THREE.Vector3(bdR, bdB, zINT)),
      leftInt: makeOgeeBar(prof, h, vX.clone(), nvZ.clone(), vY.clone(), new THREE.Vector3(bdL, bdB, zINT)),
      rightInt: makeOgeeBar(prof, h, nvX.clone(), nvZ.clone(), nvY.clone(), new THREE.Vector3(bdR, bdT, zINT)),
    };
  }, [L, R, B, T]);

  if (!bars) return null;
  return (
    <group>
      <mesh geometry={bars.topExt} castShadow receiveShadow><primitive object={mat} attach="material" /></mesh>
      <mesh geometry={bars.botExt} castShadow receiveShadow><primitive object={mat} attach="material" /></mesh>
      <mesh geometry={bars.leftExt} castShadow receiveShadow><primitive object={mat} attach="material" /></mesh>
      <mesh geometry={bars.rightExt} castShadow receiveShadow><primitive object={mat} attach="material" /></mesh>
      <mesh geometry={bars.topInt} castShadow receiveShadow><primitive object={mi} attach="material" /></mesh>
      <mesh geometry={bars.botInt} castShadow receiveShadow><primitive object={mi} attach="material" /></mesh>
      <mesh geometry={bars.leftInt} castShadow receiveShadow><primitive object={mi} attach="material" /></mesh>
      <mesh geometry={bars.rightInt} castShadow receiveShadow><primitive object={mi} attach="material" /></mesh>
    </group>
  );
}

// One panel cell: raised field with 2 bevels + flat step (EXT + INT mirrored)
function PanelCell({ L, R, B, T, matPanel, miPanel }) {
  const geo = useMemo(() => {
    const B1 = mm(BEVEL1_W_MM), FS = mm(FLAT_STEP_W_MM), B2 = mm(BEVEL2_W_MM);
    const REC = mm(RECESS_DEPTH_MM), RD = mm(RAISED_DROP_MM);
    // The beading sits on the panel edge, so the bevel starts inside it.
    const cover = mm(BEADING_W_MM);
    const pL = L + cover, pR = R - cover, pB = B + cover, pT = T - cover;
    const iL = pL + B1, iR = pR - B1, iB = pB + B1, iT = pT - B1;           // after bevel1
    const sL = iL + FS, sR = iR - FS, sB = iB + FS, sT = iT - FS;           // after flat step
    const rL = sL + B2, rR = sR - B2, rB = sB + B2, rT = sT - B2;           // raised field
    if (rR <= rL || rT <= rB) return null;
    const zFace = halfD, zStep = halfD - REC, zRaise = halfD - RD;
    return {
      // EXT
      b1: bevelRing(pL, pR, pB, pT, iL, iR, iB, iT, zFace, zStep),
      step: buildFlatStepRing(iL, iR, iB, iT, sL, sR, sB, sT, zStep),
      b2: bevelRing(sL, sR, sB, sT, rL, rR, rB, rT, zStep, zRaise),
      rL, rR, rB, rT, zRaise,
      // INT (mirror Z)
      b1i: bevelRing(pL, pR, pB, pT, iL, iR, iB, iT, -zFace, -zStep),
      stepi: buildFlatStepRing(iL, iR, iB, iT, sL, sR, sB, sT, -zStep),
      b2i: bevelRing(sL, sR, sB, sT, rL, rR, rB, rT, -zStep, -zRaise),
    };
  }, [L, R, B, T]);

  if (!geo) return null;
  return (
    <group>
      {/* EXT */}
      <mesh geometry={geo.b1} castShadow receiveShadow><primitive object={matPanel} attach="material" /></mesh>
      <mesh geometry={geo.step} castShadow receiveShadow><primitive object={matPanel} attach="material" /></mesh>
      <mesh geometry={geo.b2} castShadow receiveShadow><primitive object={matPanel} attach="material" /></mesh>
      <mesh position={[(geo.rL + geo.rR) / 2, (geo.rB + geo.rT) / 2, geo.zRaise]} castShadow receiveShadow>
        <planeGeometry args={[geo.rR - geo.rL, geo.rT - geo.rB]} />
        <primitive object={matPanel} attach="material" />
      </mesh>
      {/* INT */}
      <mesh geometry={geo.b1i} castShadow receiveShadow><primitive object={miPanel} attach="material" /></mesh>
      <mesh geometry={geo.stepi} castShadow receiveShadow><primitive object={miPanel} attach="material" /></mesh>
      <mesh geometry={geo.b2i} castShadow receiveShadow><primitive object={miPanel} attach="material" /></mesh>
      <mesh position={[(geo.rL + geo.rR) / 2, (geo.rB + geo.rT) / 2, -geo.zRaise]} rotation={[Math.PI, 0, 0]} castShadow receiveShadow>
        <planeGeometry args={[geo.rR - geo.rL, geo.rT - geo.rB]} />
        <primitive object={miPanel} attach="material" />
      </mesh>
    </group>
  );
}

// Flat step ring (frame between bevel1 inner and bevel2 outer, at fixed Z)
function buildFlatStepRing(oL, oR, oB, oT, iL, iR, iB, iT, z) {
  const positions = [];
  const quad = (ax, ay, bx, by, cx, cy, dx, dy) => {
    positions.push(ax, ay, z, bx, by, z, cx, cy, z);
    positions.push(ax, ay, z, cx, cy, z, dx, dy, z);
  };
  quad(oL, oT, oR, oT, iR, iT, iL, iT); // top
  quad(iL, iB, iR, iB, oR, oB, oL, oB); // bottom
  quad(oL, oB, oL, oT, iL, iT, iL, iB); // left
  quad(iR, iB, iR, iT, oR, oT, oR, oB); // right
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  return g;
}

// Divider bar (timber) between cells — simple box, dual-colour EXT/INT halves
function Divider({ cx, cy, w, h, mat, mi }) {
  return (
    <group>
      <mesh position={[cx, cy, halfD / 2]} castShadow receiveShadow>
        <boxGeometry args={[w, h, halfD]} />
        <primitive object={mat} attach="material" />
      </mesh>
      <mesh position={[cx, cy, -halfD / 2]} castShadow receiveShadow>
        <boxGeometry args={[w, h, halfD]} />
        <primitive object={mi} attach="material" />
      </mesh>
    </group>
  );
}

export default function PanelGridLeaf({
  width, height, panelGrid, mat, mi, matPanel, miPanel,
  spacerColor = 'silver', glassFinish = 'clear',
}) {
  const W = mm(width), H = mm(height);
  const fS = mm(LEAF_STILE), fTop = mm(LEAF_TOP_RAIL), fBot = mm(LEAF_BOTTOM_RAIL);

  const rows = Math.max(1, panelGrid?.rows || 1);
  const cols = Math.max(1, panelGrid?.cols || 1);
  const cells = panelGrid?.cells || [];

  // Inner light area (inside outer stiles/rails)
  const innerL = -W / 2 + fS;
  const innerR = W / 2 - fS;
  const innerB = -H / 2 + fBot;
  const innerT = H / 2 - fTop;

  // Cell area inset by margins
  const areaL = innerL + mm(CELL_MARGIN_X_MM);
  const areaR = innerR - mm(CELL_MARGIN_X_MM);
  const areaB = innerB + mm(CELL_MARGIN_Y_MM);
  const areaT = innerT - mm(CELL_MARGIN_Y_MM);
  const areaW = areaR - areaL;
  const areaH = areaT - areaB;

  const div = mm(DIVIDER_MM);
  // Cell size = (area - dividers) / count
  const cellW = (areaW - div * (cols - 1)) / cols;

  // Row heights are proportional, not equal. Classic London front doors put
  // the taller panels on top: 60/40 for a two-row leaf. panelGrid.rowWeights
  // can override; anything else falls back to equal rows.
  const defaultWeights = rows === 2 ? [60, 40] : Array(rows).fill(1);
  const weights = (panelGrid?.rowWeights && panelGrid.rowWeights.length === rows)
    ? panelGrid.rowWeights
    : defaultWeights;
  const weightSum = weights.reduce((a, b) => a + b, 0) || 1;
  const usableH = areaH - div * (rows - 1);          // height left for panels only
  const rowH = weights.map(w => usableH * (w / weightSum));

  // Top edge of each row (cumulative from the top of the panel area)
  const rowTop = [];
  let runY = areaT;
  for (let r = 0; r < rows; r++) {
    rowTop.push(runY);
    runY -= rowH[r] + div;
  }

  const cellBounds = (r, c) => {
    const L = areaL + c * (cellW + div);
    const R = L + cellW;
    const T = rowTop[r];
    const B = T - rowH[r];
    return { L, R, B, T };
  };

  if (cellW <= 0 || usableH <= 0 || rowH.some(h => h <= 0)) return null; // too small — safety

  // Solid timber backing across the whole leaf light. Without this the leaf
  // would be see-through wherever a cell is a panel (the old single-panel /
  // glazing that used to fill this area is disabled when the grid is on).
  // Set BACK_INSET below the raised-field Z so panel geometry stays on top.
  // Sit the backing 2mm BEHIND the panel's deepest surface, otherwise the two
  // are coplanar and z-fight (that was the flicker on dual-colour doors).
  // Split at z=0 into EXT/INT halves so each face takes its own colour.
  const backFace = halfD - mm(RECESS_DEPTH_MM) - mm(2);
  const backW = innerR - innerL;
  const backH = innerT - innerB;
  const backCx = (innerL + innerR) / 2;
  const backCy = (innerB + innerT) / 2;
  const solidBacking = (
    <group>
      <mesh position={[backCx, backCy, backFace / 2]} castShadow receiveShadow>
        <boxGeometry args={[backW, backH, backFace]} />
        <primitive object={mat} attach="material" />
      </mesh>
      <mesh position={[backCx, backCy, -backFace / 2]} castShadow receiveShadow>
        <boxGeometry args={[backW, backH, backFace]} />
        <primitive object={mi} attach="material" />
      </mesh>
    </group>
  );

  const gridItems = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const cell = cells[idx] || { type: 'panel' };
      const { L, R, B, T } = cellBounds(r, c);
      if (cell.type === 'glass') {
        const gw = (R - L) / mm(1);
        const gh = (T - B) / mm(1);
        gridItems.push(
          <group key={`cell-${idx}`} position={[(L + R) / 2, (B + T) / 2, 0]}>
            <DoorGlazing width={gw} height={gh} hBars={cell.hBars || 0} vBars={cell.vBars || 0}
              barMaterial={mat} barMaterialInt={mi} spacerColor={spacerColor} glassFinish={glassFinish} />
          </group>
        );
      } else {
        gridItems.push(
          <group key={`cell-${idx}`}>
            <PanelCell L={L} R={R} B={B} T={T} matPanel={matPanel} miPanel={miPanel} />
            <BeadingFrame L={L} R={R} B={B} T={T} mat={mat} mi={mi} />
          </group>
        );
      }
    }
  }

  // Vertical dividers (between columns), full area height
  const vDividers = [];
  for (let c = 1; c < cols; c++) {
    const cx = areaL + c * (cellW + div) - div / 2;
    vDividers.push(<Divider key={`vd-${c}`} cx={cx} cy={(areaB + areaT) / 2} w={div} h={areaH} mat={mat} mi={mi} />);
  }
  // Horizontal dividers (between rows), full area width
  const hDividers = [];
  for (let r = 1; r < rows; r++) {
    const cy = rowTop[r] + div / 2;
    hDividers.push(<Divider key={`hd-${r}`} cx={(areaL + areaR) / 2} cy={cy} w={areaW} h={div} mat={mat} mi={mi} />);
  }

  const anyGlass = [];
  for (let i = 0; i < rows * cols; i++) {
    if ((cells[i] || { type: 'panel' }).type === 'glass') anyGlass.push(i);
  }

  return (
    <group>
      {anyGlass.length === 0 && solidBacking}
      {gridItems}
      {vDividers}
      {hDividers}
    </group>
  );
}
