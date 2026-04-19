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

// ═══ SashFrame ═══
function SashFrame({ width, height, mat, matInt, spacerColor, glassFinish, hBars, vBars, doorStyle = 'full-glass' }) {
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

      {/* ─── Bottom rail EXT ─── */}
      <mesh castShadow receiveShadow rotation={[0,Math.PI/2,0]} position={[-W/2,-H/2,halfD]}>
        <extrudeGeometry args={[bRailExt, railSettings]} />
        <primitive object={mat} attach="material" />
      </mesh>
      {/* ─── Bottom rail INT ─── */}
      <mesh castShadow receiveShadow rotation={[0,Math.PI/2,0]} position={[-W/2,-H/2,halfD]}>
        <extrudeGeometry args={[bRailInt, railSettings]} />
        <primitive object={mi} attach="material" />
      </mesh>

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

      {/* ─── Glazing ─── */}
      {glassW > 0 && glassH > 0 && (
        <DoorGlazing width={glassW} height={glassH} hBars={hBars} vBars={vBars} barMaterial={mat} barMaterialInt={mi} spacerColor={spacerColor} glassFinish={glassFinish} position={[0, mm((bottomRailMm - LEAF_TOP_RAIL) / 2), 0]} />
      )}
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
      <SashFrame width={width} height={height} mat={mat} matInt={materialInt} spacerColor={spacerColor} glassFinish={glassFinish} hBars={hBars} vBars={vBars} doorStyle={doorStyle} />
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