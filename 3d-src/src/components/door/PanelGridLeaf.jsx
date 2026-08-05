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

// Bolection moulding — the proud profile that sits astride the joint between
// the leaf frame and the panel, exactly as in period London front doors.
// 30mm wide total: 15mm laps onto the frame, 15mm onto the panel, so the
// panel's bevel stays visible below it. 8mm proud of the door face.
const BOLECTION_W_MM = 30;         // total face width
const BOLECTION_LAP_MM = 15;       // how far it laps onto the frame side
const BOLECTION_PROUD_MM = 8;      // how far it projects in front of the face
const BOLECTION_N = 12;            // arc segments on the ogee curve

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

// Bolection cross-section: ogee — quarter-round rising from the frame face,
// then a hollow sweeping back down to the panel side. X = across the face
// (0 = frame edge, W = panel edge), Y = height above the door face.
function bolectionProfile() {
  const W = mm(BOLECTION_W_MM);
  const P = mm(BOLECTION_PROUD_MM);
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  // rise: quarter-round from frame face up to full height
  for (let i = 0; i <= BOLECTION_N; i++) {
    const t = i / BOLECTION_N;
    const x = W * 0.45 * t;
    const y = P * Math.sin(t * Math.PI / 2);
    s.lineTo(x, y);
  }
  // hollow: sweep back down towards the panel
  for (let i = 0; i <= BOLECTION_N; i++) {
    const t = i / BOLECTION_N;
    const x = W * 0.45 + W * 0.55 * t;
    const y = P * (1 - Math.sin(t * Math.PI / 2)) * 0.75 + P * 0.05;
    s.lineTo(x, y);
  }
  s.lineTo(W, 0);
  s.closePath();
  return s;
}

// Bolection frame around one cell: 4 mitred lengths, EXT + INT mirrored.
// L/R/B/T are the cell bounds; the moulding straddles them by LAP outward.
function BolectionFrame({ L, R, B, T, mat, mi }) {
  const geo = useMemo(() => {
    const lap = mm(BOLECTION_LAP_MM);
    // Outer edge of the moulding = cell bounds pushed out by the lap
    const oL = L - lap, oR = R + lap, oB = B - lap, oT = T + lap;
    const spanH = oR - oL;
    const spanV = oT - oB;
    if (spanH <= 0 || spanV <= 0) return null;
    const shape = bolectionProfile();
    const horiz = new THREE.ExtrudeGeometry(shape, { depth: spanH, bevelEnabled: false });
    const vert = new THREE.ExtrudeGeometry(shape, { depth: spanV, bevelEnabled: false });
    return { horiz, vert, oL, oR, oB, oT, spanH, spanV };
  }, [L, R, B, T]);

  if (!geo) return null;
  const { horiz, vert, oL, oR, oB, oT } = geo;
  const z = halfD; // sits on the door face, profile height grows outward (+Z)

  // Each length is rotated so the profile's X runs inward and Y runs +Z (proud).
  const side = (key, g, pos, rot, material) => (
    <mesh key={key} geometry={g} position={pos} rotation={rot} castShadow receiveShadow>
      <primitive object={material} attach="material" />
    </mesh>
  );

  return (
    <group>
      {/* ═══ EXT face ═══ */}
      {side('b-ext', horiz, [oL, oB, z], [-Math.PI / 2, 0, 0], mat)}
      {side('t-ext', horiz, [oL, oT, z], [Math.PI / 2, 0, 0], mat)}
      {side('l-ext', vert, [oL, oB, z], [-Math.PI / 2, 0, -Math.PI / 2], mat)}
      {side('r-ext', vert, [oR, oB, z], [-Math.PI / 2, 0, Math.PI / 2], mat)}
      {/* ═══ INT face (mirrored through Z) ═══ */}
      <group scale={[1, 1, -1]}>
        {side('b-int', horiz, [oL, oB, z], [-Math.PI / 2, 0, 0], mi)}
        {side('t-int', horiz, [oL, oT, z], [Math.PI / 2, 0, 0], mi)}
        {side('l-int', vert, [oL, oB, z], [-Math.PI / 2, 0, -Math.PI / 2], mi)}
        {side('r-int', vert, [oR, oB, z], [-Math.PI / 2, 0, Math.PI / 2], mi)}
      </group>
    </group>
  );
}

// One panel cell: raised field with 2 bevels + flat step (EXT + INT mirrored)
function PanelCell({ L, R, B, T, matPanel, miPanel }) {
  const geo = useMemo(() => {
    const B1 = mm(BEVEL1_W_MM), FS = mm(FLAT_STEP_W_MM), B2 = mm(BEVEL2_W_MM);
    const REC = mm(RECESS_DEPTH_MM), RD = mm(RAISED_DROP_MM);
    // The bolection laps BOLECTION_W - BOLECTION_LAP onto the panel, so the
    // bevel must start inside that, otherwise the moulding hides the whole slope.
    const cover = mm(BOLECTION_W_MM - BOLECTION_LAP_MM);
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
  const cellH = (areaH - div * (rows - 1)) / rows;

  const cellBounds = (r, c) => {
    const L = areaL + c * (cellW + div);
    const R = L + cellW;
    const T = areaT - r * (cellH + div);
    const B = T - cellH;
    return { L, R, B, T };
  };

  if (cellW <= 0 || cellH <= 0) return null; // too small — safety

  // Solid timber backing across the whole leaf light. Without this the leaf
  // would be see-through wherever a cell is a panel (the old single-panel /
  // glazing that used to fill this area is disabled when the grid is on).
  // Set BACK_INSET below the raised-field Z so panel geometry stays on top.
  const BACK_INSET = mm(RECESS_DEPTH_MM);   // backing core sits inside the recess depth
  const backW = innerR - innerL;
  const backH = innerT - innerB;
  const backCx = (innerL + innerR) / 2;
  const backCy = (innerB + innerT) / 2;
  const backDepth = D - BACK_INSET * 2;     // thinner than the leaf, recessed both faces
  const solidBacking = (
    <group>
      <mesh position={[backCx, backCy, 0]} castShadow receiveShadow>
        <boxGeometry args={[backW, backH, backDepth]} />
        <primitive object={mat} attach="material" />
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
            <BolectionFrame L={L} R={R} B={B} T={T} mat={mat} mi={mi} />
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
    const cy = areaT - r * (cellH + div) + div / 2;
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
