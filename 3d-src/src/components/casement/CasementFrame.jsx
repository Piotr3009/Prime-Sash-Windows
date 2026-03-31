/**
 * CasementFrame.jsx
 * 
 * World coords: X=left/right, Y=up/down, Z=ext(+)/int(-)
 * Frame centered at origin. Ext face at Z=+halfDepth, Int face at Z=-halfDepth.
 *
 * Cross-section profile (all members except bottom rail):
 *   EXT block: 36mm face × 62mm depth (street side)
 *   INT block: 57mm face × 31mm depth (room side)
 *   Rebate: 21mm step, Total: 93mm
 *
 * Bottom rail: 68mm face with slope on ext (36mm→47mm)
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';

const mm = (v) => v / 1000;

// Constants (mm)
const FRAME_FACE = 57;
const EXT_FACE = 36;
const EXT_DEPTH = 62;
const INT_DEPTH = 31;
const FRAME_DEPTH = 93;
const REBATE_STEP = 21;
const MULLION_W = 50;

const BOTTOM_FACE = 68;
const BOTTOM_EXT_OUTER = 36;
const BOTTOM_INNER_FACE = BOTTOM_FACE - REBATE_STEP; // 47

const halfDepth = mm(FRAME_DEPTH) / 2; // 0.0465

// ═══ Bottom Rail (horizontal, along X) ═══
// Shape XY: X=depth(ext→int), Y=height(bottom→top)
// Rotation [0, PI/2, 0]: shapeX→world-Z, shapeY→worldY, extrude→world+X
function BottomRail({ width, mat, debugColors }) {
  const len = mm(width);

  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(0, mm(BOTTOM_EXT_OUTER));
    s.lineTo(mm(EXT_DEPTH), mm(BOTTOM_INNER_FACE));
    s.lineTo(mm(EXT_DEPTH), mm(BOTTOM_FACE));
    s.lineTo(mm(FRAME_DEPTH), mm(BOTTOM_FACE));
    s.lineTo(mm(FRAME_DEPTH), 0);
    s.closePath();
    return s;
  }, []);

  const settings = useMemo(() => ({ depth: len, bevelEnabled: false }), [len]);

  const debugMat = useMemo(() => debugColors
    ? new THREE.MeshStandardMaterial({ color: '#e74c3c', opacity: 0.85, transparent: true })
    : null, [debugColors]);

  return (
    <mesh castShadow receiveShadow
      rotation={[0, Math.PI / 2, 0]}
      position={[-len / 2, -mm(width > 0 ? 0 : 0), halfDepth]}
    >
      <extrudeGeometry args={[shape, settings]} />
      {debugColors ? <primitive object={debugMat} attach="material" /> : <primitive object={mat} attach="material" />}
    </mesh>
  );
}

// ═══ Right Stile (vertical, along Y) ═══
// Shape XY: X=face(inner→outer, 0=inner 57=outer), Y=depth(ext→int, 0=ext 93=int)
// Rotation [-PI/2, 0, 0]: shapeX→worldX, shapeY→world-Z, extrude→world+Y
// Right stile: rebate faces LEFT (toward opening)
//   Ext block: X from 21→57 (=36mm face, at outer edge), Y: 0→62
//   Int block: X from 0→57 (=57mm face, full width), Y: 62→93
function RightStile({ stileHeight, mat, debugColors }) {
  const len = mm(stileHeight);

  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(mm(REBATE_STEP), 0);           // rebate-ext corner
    s.lineTo(mm(FRAME_FACE), 0);            // outer-ext corner
    s.lineTo(mm(FRAME_FACE), mm(FRAME_DEPTH)); // outer-int corner
    s.lineTo(0, mm(FRAME_DEPTH));            // inner-int corner
    s.lineTo(0, mm(EXT_DEPTH));              // inner at junction
    s.lineTo(mm(REBATE_STEP), mm(EXT_DEPTH)); // rebate at junction
    s.closePath();
    return s;
  }, []);

  const settings = useMemo(() => ({ depth: len, bevelEnabled: false }), [len]);

  const debugMat = useMemo(() => debugColors
    ? new THREE.MeshStandardMaterial({ color: '#2980b9', opacity: 0.85, transparent: true })
    : null, [debugColors]);

  return (
    <mesh castShadow receiveShadow
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, halfDepth]}
    >
      <extrudeGeometry args={[shape, settings]} />
      {debugColors ? <primitive object={debugMat} attach="material" /> : <primitive object={mat} attach="material" />}
    </mesh>
  );
}

// ═══ Left Stile (vertical, along Y) — mirror of right ═══
// Rebate faces RIGHT (toward opening)
//   Ext block: X from 0→36 (=36mm face, at outer edge), Y: 0→62
//   Int block: X from 0→57 (=57mm face, full width), Y: 62→93
function LeftStile({ stileHeight, mat, debugColors }) {
  const len = mm(stileHeight);

  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);                           // outer-ext corner
    s.lineTo(mm(EXT_FACE), 0);               // rebate-ext corner (36mm from outer)
    s.lineTo(mm(EXT_FACE), mm(EXT_DEPTH));   // rebate at junction
    s.lineTo(mm(FRAME_FACE), mm(EXT_DEPTH)); // inner at junction
    s.lineTo(mm(FRAME_FACE), mm(FRAME_DEPTH)); // inner-int corner
    s.lineTo(0, mm(FRAME_DEPTH));             // outer-int corner
    s.closePath();
    return s;
  }, []);

  const settings = useMemo(() => ({ depth: len, bevelEnabled: false }), [len]);

  const debugMat = useMemo(() => debugColors
    ? new THREE.MeshStandardMaterial({ color: '#27ae60', opacity: 0.85, transparent: true })
    : null, [debugColors]);

  return (
    <mesh castShadow receiveShadow
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, halfDepth]}
    >
      <extrudeGeometry args={[shape, settings]} />
      {debugColors ? <primitive object={debugMat} attach="material" /> : <primitive object={mat} attach="material" />}
    </mesh>
  );
}

// ═══ Main CasementFrame ═══
export default function CasementFrame({
  width = 800,
  height = 1200,
  material,
  materialInt,
  mullions = [],
  transoms = [],
  debugColors = false,
}) {
  const W = mm(width);
  const H = mm(height);

  // Stiles run full height from bottom to top rail
  const stileLen = height - FRAME_FACE; // only top rail subtracted, stiles go into bottom rail area

  // Bottom rail: spans between stiles (no overlap)
  const bottomRailWidth = width - FRAME_FACE * 2;

  // Right stile: outer edge at X = W/2
  const rightStileX = W / 2 - mm(FRAME_FACE);
  
  // Left stile: outer edge at X = -W/2
  const leftStileX = -W / 2;

  // Stile bottom Y: bottom of frame
  const stileBottomY = -H / 2;

  return (
    <group>
      {/* Bottom rail — between stiles */}
      <group position={[0, -H / 2, 0]}>
        <BottomRail width={bottomRailWidth} mat={material} debugColors={debugColors} />
      </group>

      {/* Right stile — full height */}
      <group position={[rightStileX, stileBottomY, 0]}>
        <RightStile stileHeight={stileLen} mat={material} debugColors={debugColors} />
      </group>

      {/* Left stile — full height */}
      <group position={[leftStileX, stileBottomY, 0]}>
        <LeftStile stileHeight={stileLen} mat={material} debugColors={debugColors} />
      </group>

      {/* Top rail — TODO: next */}
    </group>
  );
}

export { FRAME_FACE, EXT_FACE, FRAME_DEPTH, EXT_DEPTH, INT_DEPTH, REBATE_STEP, MULLION_W, BOTTOM_FACE, BOTTOM_EXT_OUTER, BOTTOM_INNER_FACE, mm };