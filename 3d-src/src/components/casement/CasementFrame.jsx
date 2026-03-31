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
const MULLION_W = 68;         // mullion total face width
const MULLION_EXT_FACE = MULLION_W - REBATE_STEP * 2; // 68-21-21 = 26mm

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
function Mullion({ startY = 0, endY = 1200, touchesBottom = true, touchesTop = true, mat, debugColors }) {
  const hMm = endY - startY;
  const h = mm(hMm);
  // When meeting transom (not rail), extend REBATE_STEP into transom's rebate
  const extendBottom = (!touchesBottom) ? mm(REBATE_STEP) : 0;
  const extendTop = (!touchesTop) ? mm(REBATE_STEP) : 0;

  const extShape = useMemo(() => {
    const s = new THREE.Shape();
    if (touchesBottom) {
      // Slope matching bottom rail
      s.moveTo(0, mm(BOTTOM_EXT_OUTER));
      s.lineTo(mm(EXT_DEPTH), mm(BOTTOM_INNER_FACE));
    } else {
      // Flat, but extend into transom rebate
      s.moveTo(0, -extendBottom);
      s.lineTo(mm(EXT_DEPTH), -extendBottom);
    }
    if (touchesTop) {
      // Flat cut matching top rail
      const topCut = mm(hMm - FRAME_FACE + REBATE_STEP);
      s.lineTo(mm(EXT_DEPTH), topCut);
      s.lineTo(0, topCut);
    } else {
      // Flat, but extend into transom rebate
      s.lineTo(mm(EXT_DEPTH), h + extendTop);
      s.lineTo(0, h + extendTop);
    }
    s.closePath();
    return s;
  }, [hMm, touchesBottom, touchesTop, extendBottom, extendTop]);

  const extSettings = useMemo(() => ({ depth: mm(MULLION_EXT_FACE), bevelEnabled: false }), []);

  // INT block — also extend into transom rebate
  const intStartY = touchesBottom ? mm(BOTTOM_FACE) : -extendBottom;
  const intEndY = touchesTop ? mm(hMm - FRAME_FACE) : h + extendTop;
  const intH = Math.max(intEndY - intStartY, 0.001);

  const extX = mm(REBATE_STEP);
  const intCenterX = mm(MULLION_W) / 2;
  const intCenterY = intStartY + intH / 2;
  const intCenterZ = halfD - mm(EXT_DEPTH) - mm(INT_DEPTH) / 2;

  const debugMatExt = useMemo(() => debugColors
    ? new THREE.MeshStandardMaterial({ color: '#f39c12', opacity: 0.85, transparent: true })
    : null, [debugColors]);
  const debugMatInt = useMemo(() => debugColors
    ? new THREE.MeshStandardMaterial({ color: '#d68910', opacity: 0.85, transparent: true })
    : null, [debugColors]);

  return (
    <group>
      <mesh castShadow receiveShadow
        rotation={[0, Math.PI / 2, 0]}
        position={[extX, 0, halfD]}
      >
        <extrudeGeometry args={[extShape, extSettings]} />
        {debugColors ? <primitive object={debugMatExt} attach="material" /> : <primitive object={mat} attach="material" />}
      </mesh>
      <mesh castShadow receiveShadow position={[intCenterX, intCenterY, intCenterZ]}>
        <boxGeometry args={[mm(MULLION_W), intH, mm(INT_DEPTH)]} />
        {debugColors ? <primitive object={debugMatInt} attach="material" /> : <primitive object={mat} attach="material" />}
      </mesh>
    </group>
  );
}

// ═══ Transom — horizontal divider, rebate top and bottom ═══
// EXT block: extends into stile rebates (wider)
// INT block: between stiles (standard)
function Transom({ transomWidth, mat, debugColors }) {
  // INT runs between stiles
  const intLen = mm(transomWidth);
  // EXT runs wider — into stile rebates on both sides
  const extLen = mm(transomWidth + REBATE_STEP * 2);

  // EXT shape: just the 26mm centered part, 62mm deep
  const extShape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, mm(REBATE_STEP));                          // bottom-rebate
    s.lineTo(0, mm(MULLION_W - REBATE_STEP));              // top-rebate
    s.lineTo(mm(EXT_DEPTH), mm(MULLION_W - REBATE_STEP));  // junction top
    s.lineTo(mm(EXT_DEPTH), mm(REBATE_STEP));              // junction bottom
    s.closePath();
    return s;
  }, []);

  // INT shape: full 68mm face, 31mm deep
  const intShape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(mm(EXT_DEPTH), 0);
    s.lineTo(mm(EXT_DEPTH), mm(MULLION_W));
    s.lineTo(mm(FRAME_DEPTH), mm(MULLION_W));
    s.lineTo(mm(FRAME_DEPTH), 0);
    s.closePath();
    return s;
  }, []);

  const extSettings = useMemo(() => ({ depth: extLen, bevelEnabled: false }), [extLen]);
  const intSettings = useMemo(() => ({ depth: intLen, bevelEnabled: false }), [intLen]);

  const debugMatExt = useMemo(() => debugColors
    ? new THREE.MeshStandardMaterial({ color: '#e91e9b', opacity: 0.85, transparent: true })
    : null, [debugColors]);
  const debugMatInt = useMemo(() => debugColors
    ? new THREE.MeshStandardMaterial({ color: '#a8145e', opacity: 0.85, transparent: true })
    : null, [debugColors]);

  return (
    <group>
      {/* EXT block — wider, extends into stile rebates */}
      <mesh castShadow receiveShadow
        rotation={[0, Math.PI / 2, 0]}
        position={[-extLen / 2, 0, halfD]}
      >
        <extrudeGeometry args={[extShape, extSettings]} />
        {debugColors ? <primitive object={debugMatExt} attach="material" /> : <primitive object={mat} attach="material" />}
      </mesh>

      {/* INT block — between stiles */}
      <mesh castShadow receiveShadow
        rotation={[0, Math.PI / 2, 0]}
        position={[-intLen / 2, 0, halfD]}
      >
        <extrudeGeometry args={[intShape, intSettings]} />
        {debugColors ? <primitive object={debugMatInt} attach="material" /> : <primitive object={mat} attach="material" />}
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
      {mullions.map((m, i) => {
        const mObj = typeof m === 'number'
          ? { x: m, startY: 0, endY: height, touchesBottom: true, touchesTop: true }
          : m;
        const x = -W / 2 + mm(mObj.x) - mm(MULLION_W) / 2;
        const y = mm(mObj.startY);
        return (
          <group key={`mull-${i}`} position={[x, -H / 2 + y, 0]}>
            <Mullion
              startY={mObj.startY}
              endY={mObj.endY}
              touchesBottom={mObj.touchesBottom !== false}
              touchesTop={mObj.touchesTop !== false}
              mat={material}
              debugColors={debugColors}
            />
          </group>
        );
      })}

      {/* Transoms — horizontal dividers */}
      {transoms.map((t, i) => {
        const tY = typeof t === 'number' ? t : t.y;
        const y = -H / 2 + mm(tY) - mm(MULLION_W) / 2;
        const transomLen = typeof t === 'object' && t.width ? t.width : (width - FRAME_FACE * 2);
        const offsetX = typeof t === 'object' && t.offsetX ? mm(t.offsetX) : 0;
        return (
          <group key={`transom-${i}`} position={[offsetX, y, 0]}>
            <Transom transomWidth={transomLen} mat={material} debugColors={debugColors} />
          </group>
        );
      })}
    </group>
  );
}

export { FRAME_FACE, EXT_FACE, FRAME_DEPTH, EXT_DEPTH, INT_DEPTH, REBATE_STEP, MULLION_W, MULLION_EXT_FACE, BOTTOM_FACE, BOTTOM_EXT_OUTER, BOTTOM_INNER_FACE, mm };