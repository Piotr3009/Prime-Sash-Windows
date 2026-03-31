/**
 * CasementFrame.jsx
 * Casement window frame — each member as ExtrudeGeometry.
 * 
 * Profile (cross-section from exterior):
 *   EXT block: 36mm face × 62mm depth (street side, bigger depth)
 *   INT block: 57mm face × 31mm depth (room side, smaller depth)
 *   Rebate: 21mm step (57-36), where sash sits
 *   Total depth: 62+31 = 93mm
 *
 * Bottom rail: 68mm face (vs 57mm sides/top), with slope on ext block
 *   Ext: trapezoid 36mm→47mm, 62mm deep
 *   Int: 47mm × 31mm
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';

const mm = (v) => v / 1000;

// ═══ Frame constants (mm) ═══
const FRAME_FACE = 57;        // standard face width (interior = biggest visible face)
const EXT_FACE = 36;          // exterior face width (smaller)
const EXT_DEPTH = 62;         // exterior block depth
const INT_DEPTH = 31;         // interior block depth
const FRAME_DEPTH = 93;       // total = 62 + 31
const REBATE_STEP = 21;       // 57 - 36
const MULLION_W = 50;

// Bottom rail (special)
const BOTTOM_FACE = 68;
const BOTTOM_EXT_OUTER = 36;                    // slope: 36mm at exterior edge
const BOTTOM_INNER_FACE = BOTTOM_FACE - REBATE_STEP; // 47mm at junction

// ═══ Bottom rail — ExtrudeGeometry with slope ═══
function BottomRailL({ width, extMat, intMat, debugColors = false }) {
  const railLen = mm(width);

  // Shape XY: X = depth (0=ext front → 93=int back), Y = height (0=bottom → 68=top)
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(0, mm(BOTTOM_EXT_OUTER));                              // ext top (36mm)
    s.lineTo(mm(EXT_DEPTH), mm(BOTTOM_INNER_FACE));                 // slope → junction (47mm)
    s.lineTo(mm(EXT_DEPTH), mm(BOTTOM_FACE));                       // rebate step up (68mm)
    s.lineTo(mm(EXT_DEPTH + INT_DEPTH), mm(BOTTOM_FACE));           // room face top
    s.lineTo(mm(EXT_DEPTH + INT_DEPTH), 0);                         // room face bottom
    s.closePath();
    return s;
  }, []);

  const settings = useMemo(() => ({ depth: railLen, bevelEnabled: false }), [railLen]);

  const debugMat = useMemo(() => {
    if (!debugColors) return null;
    return new THREE.MeshStandardMaterial({ color: '#e74c3c', opacity: 0.85, transparent: true });
  }, [debugColors]);

  // Rotation [0, -PI/2, 0]: shapeX→+worldZ, shapeY→worldY, extrudeZ→-worldX
  // Position: shift so ext front aligns, and center length along X
  return (
    <mesh
      castShadow receiveShadow
      rotation={[0, -Math.PI / 2, 0]}
      position={[-railLen / 2, 0, mm(EXT_DEPTH) / 2]}
    >
      <extrudeGeometry args={[shape, settings]} />
      {debugColors
        ? <primitive object={debugMat} attach="material" />
        : <primitive object={extMat} attach="material" />
      }
    </mesh>
  );
}

// ═══ Side stile — ExtrudeGeometry, L-shape (no slope) ═══
function SideStile({ stileHeight, side = 'right', extMat, intMat, debugColors = false }) {
  const len = mm(stileHeight);

  // L-profile: X=depth (0=ext front, 93=int back), Y=face (0=outer edge, 57=inner edge)
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(0, mm(EXT_FACE));                         // ext face (36mm)
    s.lineTo(mm(EXT_DEPTH), mm(EXT_FACE));              // junction
    s.lineTo(mm(EXT_DEPTH), mm(FRAME_FACE));            // rebate step (57mm)
    s.lineTo(mm(EXT_DEPTH + INT_DEPTH), mm(FRAME_FACE));// int face
    s.lineTo(mm(EXT_DEPTH + INT_DEPTH), 0);             // int outer
    s.closePath();
    return s;
  }, []);

  const settings = useMemo(() => ({ depth: len, bevelEnabled: false }), [len]);

  const debugMat = useMemo(() => {
    if (!debugColors) return null;
    return new THREE.MeshStandardMaterial({
      color: side === 'right' ? '#2980b9' : '#27ae60',
      opacity: 0.85, transparent: true,
    });
  }, [debugColors, side]);

  // Inner mesh: rotation [0, -PI/2, 0] → length along -X, face along +Y, depth along +Z
  // Outer group rotation turns horizontal to vertical:
  //   Right stile [0, 0, PI/2]: face → -X (toward center), length → -Y (downward)
  //   Left stile  [0, 0, -PI/2]: face → +X (toward center), length → +Y (upward)
  const groupRotZ = side === 'right' ? Math.PI / 2 : -Math.PI / 2;

  return (
    <group rotation={[0, 0, groupRotZ]}>
      <mesh
        castShadow receiveShadow
        rotation={[0, -Math.PI / 2, 0]}
        position={[-len / 2, 0, mm(EXT_DEPTH) / 2]}
      >
        <extrudeGeometry args={[shape, settings]} />
        {debugColors
          ? <primitive object={debugMat} attach="material" />
          : <primitive object={extMat} attach="material" />
        }
      </mesh>
    </group>
  );
}

// ═══ Main frame component ═══
export default function CasementFrame({
  width = 800,
  height = 1200,
  material,
  materialInt,
  mullions = [],
  transoms = [],
  debugColors = false,
}) {
  const extMat = material;
  const intMat = materialInt || material;

  const W = mm(width);
  const H = mm(height);
  const fW = mm(FRAME_FACE);
  const bfW = mm(BOTTOM_FACE);
  const halfDepth = mm(FRAME_DEPTH) / 2;
  const zCenter = -halfDepth;

  // Stile height: between top rail and bottom rail
  const stileLength = height - FRAME_FACE - BOTTOM_FACE;

  // Stile center Y (offset because top=57mm, bottom=68mm)
  const stileCenterY = (mm(FRAME_FACE) - mm(BOTTOM_FACE)) / 2;

  return (
    <group position={[0, 0, zCenter]}>
      {/* Bottom rail — slope profile */}
      <group position={[0, -H / 2, 0]}>
        <BottomRailL
          width={width}
          extMat={extMat}
          intMat={intMat}
          debugColors={debugColors}
        />
      </group>

      {/* Right stile */}
      <group position={[W / 2, stileCenterY, 0]}>
        <SideStile
          stileHeight={stileLength}
          side="right"
          extMat={extMat}
          intMat={intMat}
          debugColors={debugColors}
        />
      </group>

      {/* Left stile */}
      <group position={[-W / 2, stileCenterY, 0]}>
        <SideStile
          stileHeight={stileLength}
          side="left"
          extMat={extMat}
          intMat={intMat}
          debugColors={debugColors}
        />
      </group>

      {/* Top rail — TODO: next step, confirm profile with Piotr */}
    </group>
  );
}

export { FRAME_FACE, EXT_FACE, FRAME_DEPTH, EXT_DEPTH, INT_DEPTH, REBATE_STEP, MULLION_W, BOTTOM_FACE, BOTTOM_EXT_OUTER, BOTTOM_INNER_FACE, mm };