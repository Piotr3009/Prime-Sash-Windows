/**
 * CasementFrame.jsx
 * 
 * Bottom rail: full width, slope on ext block
 * Top rail: full width, flat L-shape (same profile as stiles)
 * Stiles: full height with cutouts:
 *   - Bottom: EXT follows slope, INT starts above bottom rail
 *   - Top: EXT stops below top rail EXT, INT stops below top rail INT
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
const MULLION_EXT_FACE = FRAME_FACE - REBATE_STEP * 2; // 57-21-21 = 15mm

// Bottom rail (mm)
const BOTTOM_FACE = 68;
const BOTTOM_EXT_OUTER = 36;
const BOTTOM_INNER_FACE = BOTTOM_FACE - REBATE_STEP; // 47

const halfD = mm(FRAME_DEPTH) / 2;

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

// ═══ Top Rail — full width, flat L-shape ═══
function TopRail({ width, mat, debugColors }) {
  const len = mm(width);

  // Shape XY: X=depth (0=ext, 93=int), Y=face (0=inner/opening, 57=outer/top)
  // EXT: Y from REBATE_STEP→FRAME_FACE (36mm face), depth 0→62
  // INT: Y from 0→FRAME_FACE (57mm face), depth 62→93
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, mm(REBATE_STEP));
    s.lineTo(0, mm(FRAME_FACE));
    s.lineTo(mm(FRAME_DEPTH), mm(FRAME_FACE));
    s.lineTo(mm(FRAME_DEPTH), 0);
    s.lineTo(mm(EXT_DEPTH), 0);
    s.lineTo(mm(EXT_DEPTH), mm(REBATE_STEP));
    s.closePath();
    return s;
  }, []);

  const settings = useMemo(() => ({ depth: len, bevelEnabled: false }), [len]);
  const debugMat = useMemo(() => debugColors
    ? new THREE.MeshStandardMaterial({ color: '#9b59b6', opacity: 0.85, transparent: true })
    : null, [debugColors]);

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

// ═══ Stile — with bottom slope cutout + top rail cutout ═══
function Stile({ frameHeight, side, mat, debugColors }) {
  const h = mm(frameHeight);

  // EXT block shape (X=depth 0→62, Y=height 0→frameHeight)
  // Bottom: slope matching bottom rail (Y=36 at depth=0, Y=47 at depth=62)
  // Top: flat cut where top rail EXT starts
  //   Top rail EXT fills: Y from (frameHeight - FRAME_FACE + REBATE_STEP) to frameHeight
  //   So stile EXT goes up to Y = frameHeight - FRAME_FACE + REBATE_STEP = frameHeight - 36
  const extTopCut = mm(frameHeight - FRAME_FACE + REBATE_STEP); // = mm(frameHeight - 36)

  const extShape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, mm(BOTTOM_EXT_OUTER));                // bottom-ext (slope start, 36mm)
    s.lineTo(mm(EXT_DEPTH), mm(BOTTOM_INNER_FACE));   // bottom-junction (slope end, 47mm)
    s.lineTo(mm(EXT_DEPTH), extTopCut);                // top-junction (cut)
    s.lineTo(0, extTopCut);                            // top-ext (cut)
    s.closePath();
    return s;
  }, [extTopCut]);

  const extSettings = useMemo(() => ({ depth: mm(EXT_FACE), bevelEnabled: false }), []);

  // INT block: box from top of bottom rail to bottom of top rail
  // Bottom: BOTTOM_FACE (68mm)
  // Top: frameHeight - FRAME_FACE
  const intBottom = mm(BOTTOM_FACE);
  const intTop = mm(frameHeight - FRAME_FACE);
  const intH = intTop - intBottom;

  // EXT block X: left stile starts at 0, right stile offset by rebate
  const extX = side === 'left' ? 0 : mm(REBATE_STEP);

  // INT block positions
  const intCenterX = mm(FRAME_FACE) / 2;
  const intCenterY = intBottom + intH / 2;
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
      {/* EXT block — slope at bottom, flat cut at top */}
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

      {/* INT block — above bottom rail, below top rail */}
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

// ═══ Mullion — vertical divider, rebate both sides ═══
// EXT block: 15mm face (centered), 62mm depth
// INT block: 57mm face, 31mm depth
// Same top/bottom cutouts as stiles
function Mullion({ frameHeight, mat, debugColors }) {
  const h = mm(frameHeight);
  const extTopCut = mm(frameHeight - FRAME_FACE + REBATE_STEP);

  // EXT block shape — same height profile as stile (slope bottom, flat top cut)
  const extShape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, mm(BOTTOM_EXT_OUTER));
    s.lineTo(mm(EXT_DEPTH), mm(BOTTOM_INNER_FACE));
    s.lineTo(mm(EXT_DEPTH), extTopCut);
    s.lineTo(0, extTopCut);
    s.closePath();
    return s;
  }, [extTopCut]);

  // EXT extrude depth = 15mm (centered in 57mm face)
  const extSettings = useMemo(() => ({ depth: mm(MULLION_EXT_FACE), bevelEnabled: false }), []);

  // INT block: same as stile
  const intBottom = mm(BOTTOM_FACE);
  const intTop = mm(frameHeight - FRAME_FACE);
  const intH = intTop - intBottom;

  // EXT block X offset: centered = REBATE_STEP from left edge
  const extX = mm(REBATE_STEP);

  // INT block
  const intCenterX = mm(FRAME_FACE) / 2;
  const intCenterY = intBottom + intH / 2;
  const intCenterZ = halfD - mm(EXT_DEPTH) - mm(INT_DEPTH) / 2;

  const debugMatExt = useMemo(() => debugColors
    ? new THREE.MeshStandardMaterial({ color: '#f39c12', opacity: 0.85, transparent: true })
    : null, [debugColors]);

  const debugMatInt = useMemo(() => debugColors
    ? new THREE.MeshStandardMaterial({ color: '#d68910', opacity: 0.85, transparent: true })
    : null, [debugColors]);

  return (
    <group>
      {/* EXT block — 15mm wide, centered */}
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

      {/* INT block — full 57mm, above bottom rail, below top rail */}
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

  return (
    <group>
      {/* Bottom rail — full width */}
      <group position={[0, -H / 2, 0]}>
        <BottomRail width={width} mat={material} debugColors={debugColors} />
      </group>

      {/* Top rail — full width */}
      <group position={[0, H / 2 - mm(FRAME_FACE), 0]}>
        <TopRail width={width} mat={material} debugColors={debugColors} />
      </group>

      {/* Left stile — outer edge at -W/2 */}
      <group position={[-W / 2, -H / 2, 0]}>
        <Stile frameHeight={height} side="left" mat={material} debugColors={debugColors} />
      </group>

      {/* Right stile — outer edge at W/2 */}
      <group position={[W / 2 - mm(FRAME_FACE), -H / 2, 0]}>
        <Stile frameHeight={height} side="right" mat={material} debugColors={debugColors} />
      </group>

      {/* Mullions — vertical dividers */}
      {mullions.map((xPosMm, i) => {
        // xPosMm = mm from left edge of frame to center of mullion
        const x = -W / 2 + mm(xPosMm) - mm(FRAME_FACE) / 2;
        return (
          <group key={`mull-${i}`} position={[x, -H / 2, 0]}>
            <Mullion frameHeight={height} mat={material} debugColors={debugColors} />
          </group>
        );
      })}
    </group>
  );
}

export { FRAME_FACE, EXT_FACE, FRAME_DEPTH, EXT_DEPTH, INT_DEPTH, REBATE_STEP, MULLION_W, MULLION_EXT_FACE, BOTTOM_FACE, BOTTOM_EXT_OUTER, BOTTOM_INNER_FACE, mm };