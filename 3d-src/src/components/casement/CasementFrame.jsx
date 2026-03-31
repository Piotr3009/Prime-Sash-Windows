/**
 * CasementFrame.jsx
 * 
 * Bottom rail: full width, passes through. Has slope on ext block.
 * Stiles: split into 2 parts each:
 *   - EXT block: ExtrudeGeometry with slope cutout at bottom (matches bottom rail slope)
 *   - INT block: box starting ABOVE bottom rail (no overlap)
 * Top rail: TODO next
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';

const mm = (v) => v / 1000;

// Side/Top constants (mm)
const FRAME_FACE = 57;
const EXT_FACE = 36;
const EXT_DEPTH = 62;
const INT_DEPTH = 31;
const FRAME_DEPTH = 93;
const REBATE_STEP = 21;
const MULLION_W = 50;

// Bottom rail (mm)
const BOTTOM_FACE = 68;
const BOTTOM_EXT_OUTER = 36;
const BOTTOM_INNER_FACE = BOTTOM_FACE - REBATE_STEP; // 47

const halfD = mm(FRAME_DEPTH) / 2; // 0.0465

// ═══ Bottom Rail — full width, slope on ext ═══
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

  // rotation [0, PI/2, 0]: shapeX → -worldZ, shapeY → worldY, extrudeZ → worldX
  // position: center rail along X, ext front at +halfD
  return (
    <mesh castShadow receiveShadow
      rotation={[0, Math.PI / 2, 0]}
      position={[-len / 2, 0, halfD]}
    >
      <extrudeGeometry args={[shape, settings]} />
      {debugColors ? <primitive object={debugMat} attach="material" /> : <primitive object={mat} attach="material" />}
    </mesh>
  );
}

// ═══ Stile — EXT block with slope + INT block above bottom rail ═══
function Stile({ stileHeight, side, mat, debugColors }) {
  const h = mm(stileHeight);

  // EXT block shape: depth(X) vs height(Y)
  // Bottom follows bottom rail slope: Y=36mm at depth=0, Y=47mm at depth=62
  const extShape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, mm(BOTTOM_EXT_OUTER));
    s.lineTo(mm(EXT_DEPTH), mm(BOTTOM_INNER_FACE));
    s.lineTo(mm(EXT_DEPTH), h);
    s.lineTo(0, h);
    s.closePath();
    return s;
  }, [h]);

  const extSettings = useMemo(() => ({ depth: mm(EXT_FACE), bevelEnabled: false }), []);

  // INT block: simple box, starts above bottom rail
  const intH = mm(stileHeight - BOTTOM_FACE);

  // EXT block X offset:
  //   Left stile: extruded from X=0 (outer edge) toward center → extX = 0
  //   Right stile: ext block on outer side, rebate toward center → extX = REBATE_STEP
  const extX = side === 'left' ? 0 : mm(REBATE_STEP);

  // INT block center X: always FRAME_FACE/2 (covers full 57mm face width)
  const intCenterX = mm(FRAME_FACE) / 2;
  // INT block center Y: above bottom rail
  const intCenterY = mm(BOTTOM_FACE) + intH / 2;
  // INT block center Z: behind ext block
  const intCenterZ = halfD - mm(EXT_DEPTH) - mm(INT_DEPTH) / 2;

  const debugMatExt = useMemo(() => debugColors
    ? new THREE.MeshStandardMaterial({
        color: side === 'left' ? '#27ae60' : '#2980b9',
        opacity: 0.85, transparent: true,
      }) : null, [debugColors, side]);

  const debugMatInt = useMemo(() => debugColors
    ? new THREE.MeshStandardMaterial({
        color: side === 'left' ? '#1d8348' : '#1a5276',
        opacity: 0.85, transparent: true,
      }) : null, [debugColors, side]);

  return (
    <group>
      {/* EXT block — with slope cutout at bottom */}
      <mesh castShadow receiveShadow
        rotation={[0, Math.PI / 2, 0]}
        position={[extX, 0, halfD]}
      >
        <extrudeGeometry args={[extShape, extSettings]} />
        {debugColors
          ? <primitive object={debugMatExt} attach="material" />
          : <primitive object={mat} attach="material" />
        }
      </mesh>

      {/* INT block — box above bottom rail */}
      <mesh castShadow receiveShadow
        position={[intCenterX, intCenterY, intCenterZ]}
      >
        <boxGeometry args={[mm(FRAME_FACE), intH, mm(INT_DEPTH)]} />
        {debugColors
          ? <primitive object={debugMatInt} attach="material" />
          : <primitive object={mat} attach="material" />
        }
      </mesh>
    </group>
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

  // Stile runs from frame bottom to bottom of top rail
  const stileLen = height - FRAME_FACE;

  return (
    <group>
      {/* Bottom rail — full width, at frame bottom */}
      <group position={[0, -H / 2, 0]}>
        <BottomRail width={width} mat={material} debugColors={debugColors} />
      </group>

      {/* Left stile — outer edge at -W/2 */}
      <group position={[-W / 2, -H / 2, 0]}>
        <Stile stileHeight={stileLen} side="left" mat={material} debugColors={debugColors} />
      </group>

      {/* Right stile — outer edge at W/2, shape origin at inner edge */}
      <group position={[W / 2 - mm(FRAME_FACE), -H / 2, 0]}>
        <Stile stileHeight={stileLen} side="right" mat={material} debugColors={debugColors} />
      </group>

      {/* Top rail — TODO: next step */}
    </group>
  );
}

export { FRAME_FACE, EXT_FACE, FRAME_DEPTH, EXT_DEPTH, INT_DEPTH, REBATE_STEP, MULLION_W, BOTTOM_FACE, BOTTOM_EXT_OUTER, BOTTOM_INNER_FACE, mm };