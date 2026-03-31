/**
 * CasementFrame.jsx
 * R12 rounding on inner edges, room side (INT block) of all members.
 * Joints (where members meet) stay flat — covered by the crossing member.
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';

const mm = (v) => v / 1000;
const R = mm(12); // rounding radius 12mm

const FRAME_FACE = 57;
const EXT_FACE = 36;
const EXT_DEPTH = 62;
const INT_DEPTH = 31;
const FRAME_DEPTH = 93;
const REBATE_STEP = 21;
const MULLION_W = 68;
const MULLION_EXT_FACE = MULLION_W - REBATE_STEP * 2; // 26mm

const BOTTOM_FACE = 68;
const BOTTOM_EXT_OUTER = 36;
const BOTTOM_INNER_FACE = BOTTOM_FACE - REBATE_STEP; // 47

const halfD = mm(FRAME_DEPTH) / 2;

// ═══ Bottom Rail — full width, slope on ext, R12 on inner-room corner ═══
function BottomRail({ width, mat, debugColors }) {
  const len = mm(width);
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(0, mm(BOTTOM_EXT_OUTER));
    s.lineTo(mm(EXT_DEPTH), mm(BOTTOM_INNER_FACE));
    s.lineTo(mm(EXT_DEPTH), mm(BOTTOM_FACE));
    s.lineTo(mm(FRAME_DEPTH) - R, mm(BOTTOM_FACE));
    s.quadraticCurveTo(mm(FRAME_DEPTH), mm(BOTTOM_FACE), mm(FRAME_DEPTH), mm(BOTTOM_FACE) - R);
    s.lineTo(mm(FRAME_DEPTH), 0);
    s.closePath();
    return s;
  }, []);
  const settings = useMemo(() => ({ depth: len, bevelEnabled: false }), [len]);
  const debugMat = useMemo(() => debugColors
    ? new THREE.MeshStandardMaterial({ color: '#e74c3c', opacity: 0.85, transparent: true })
    : null, [debugColors]);
  return (
    <mesh castShadow receiveShadow rotation={[0, Math.PI / 2, 0]} position={[-len / 2, 0, halfD]}>
      <extrudeGeometry args={[shape, settings]} />
      {debugColors ? <primitive object={debugMat} attach="material" /> : <primitive object={mat} attach="material" />}
    </mesh>
  );
}

// ═══ Top Rail — full width, R12 on inner-room corner ═══
function TopRail({ width, mat, debugColors }) {
  const len = mm(width);
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, mm(REBATE_STEP));
    s.lineTo(0, mm(FRAME_FACE));
    s.lineTo(mm(FRAME_DEPTH), mm(FRAME_FACE));
    s.lineTo(mm(FRAME_DEPTH), R);
    s.quadraticCurveTo(mm(FRAME_DEPTH), 0, mm(FRAME_DEPTH) - R, 0);
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
    <mesh castShadow receiveShadow rotation={[0, Math.PI / 2, 0]} position={[-len / 2, 0, halfD]}>
      <extrudeGeometry args={[shape, settings]} />
      {debugColors ? <primitive object={debugMat} attach="material" /> : <primitive object={mat} attach="material" />}
    </mesh>
  );
}

// ═══ Stile — EXT with cutouts + INT with R12 on inner-room corner ═══
function Stile({ frameHeight, side, mat, debugColors }) {
  const extTopCut = mm(frameHeight - FRAME_FACE + REBATE_STEP);
  const extShape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, mm(BOTTOM_EXT_OUTER));
    s.lineTo(mm(EXT_DEPTH), mm(BOTTOM_INNER_FACE));
    s.lineTo(mm(EXT_DEPTH), extTopCut);
    s.lineTo(0, extTopCut);
    s.closePath();
    return s;
  }, [extTopCut]);
  const extSettings = useMemo(() => ({ depth: mm(EXT_FACE), bevelEnabled: false }), []);

  // INT as ExtrudeGeometry with R12
  const intStartY = mm(BOTTOM_FACE);
  const intH = mm(frameHeight - FRAME_FACE) - intStartY;

  // Shape XY: X=face width (0→FRAME_FACE), Y=depth (0=junction, INT_DEPTH=room)
  // Left: round at (FRAME_FACE, INT_DEPTH). Right: round at (0, INT_DEPTH)
  const intShape = useMemo(() => {
    const s = new THREE.Shape();
    const fw = mm(FRAME_FACE);
    const d = mm(INT_DEPTH);
    if (side === 'left') {
      s.moveTo(0, 0);
      s.lineTo(fw, 0);
      s.lineTo(fw, d - R);
      s.quadraticCurveTo(fw, d, fw - R, d);
      s.lineTo(0, d);
      s.closePath();
    } else {
      s.moveTo(0, 0);
      s.lineTo(fw, 0);
      s.lineTo(fw, d);
      s.lineTo(R, d);
      s.quadraticCurveTo(0, d, 0, d - R);
      s.closePath();
    }
    return s;
  }, [side]);
  const intSettings = useMemo(() => ({ depth: intH, bevelEnabled: false }), [intH]);

  const extX = side === 'left' ? 0 : mm(REBATE_STEP);

  const debugMatExt = useMemo(() => debugColors
    ? new THREE.MeshStandardMaterial({
        color: side === 'left' ? '#27ae60' : '#2980b9', opacity: 0.85, transparent: true,
      }) : null, [debugColors, side]);
  const debugMatInt = useMemo(() => debugColors
    ? new THREE.MeshStandardMaterial({
        color: side === 'left' ? '#1d8348' : '#1a5276', opacity: 0.85, transparent: true,
      }) : null, [debugColors, side]);

  return (
    <group>
      <mesh castShadow receiveShadow rotation={[0, Math.PI / 2, 0]} position={[extX, 0, halfD]}>
        <extrudeGeometry args={[extShape, extSettings]} />
        {debugColors ? <primitive object={debugMatExt} attach="material" /> : <primitive object={mat} attach="material" />}
      </mesh>
      <mesh castShadow receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, intStartY, halfD - mm(EXT_DEPTH)]}
      >
        <extrudeGeometry args={[intShape, intSettings]} />
        {debugColors ? <primitive object={debugMatInt} attach="material" /> : <primitive object={mat} attach="material" />}
      </mesh>
    </group>
  );
}

// ═══ Mullion — vertical divider, R12 on BOTH inner-room corners ═══
function Mullion({ startY = 0, endY = 1200, touchesBottom = true, touchesTop = true, mat, debugColors }) {
  const hMm = endY - startY;
  const h = mm(hMm);
  const extendBottom = (!touchesBottom) ? mm(REBATE_STEP) : 0;
  const extendTop = (!touchesTop) ? mm(REBATE_STEP) : 0;

  const extShape = useMemo(() => {
    const s = new THREE.Shape();
    if (touchesBottom) {
      s.moveTo(0, mm(BOTTOM_EXT_OUTER));
      s.lineTo(mm(EXT_DEPTH), mm(BOTTOM_INNER_FACE));
    } else {
      s.moveTo(0, -extendBottom);
      s.lineTo(mm(EXT_DEPTH), -extendBottom);
    }
    if (touchesTop) {
      const topCut = mm(hMm - FRAME_FACE + REBATE_STEP);
      s.lineTo(mm(EXT_DEPTH), topCut);
      s.lineTo(0, topCut);
    } else {
      s.lineTo(mm(EXT_DEPTH), h + extendTop);
      s.lineTo(0, h + extendTop);
    }
    s.closePath();
    return s;
  }, [hMm, touchesBottom, touchesTop, extendBottom, extendTop]);
  const extSettings = useMemo(() => ({ depth: mm(MULLION_EXT_FACE), bevelEnabled: false }), []);

  const intStartYLocal = touchesBottom ? mm(BOTTOM_FACE) : -extendBottom;
  const intEndYLocal = touchesTop ? mm(hMm - FRAME_FACE) : h + extendTop;
  const intH = Math.max(intEndYLocal - intStartYLocal, 0.001);

  // Shape XY: X=face (0→MULLION_W), Y=depth (0=junction, INT_DEPTH=room)
  // R12 on both (0, INT_DEPTH) and (MULLION_W, INT_DEPTH)
  const intShape = useMemo(() => {
    const s = new THREE.Shape();
    const w = mm(MULLION_W);
    const d = mm(INT_DEPTH);
    s.moveTo(0, 0);
    s.lineTo(w, 0);
    s.lineTo(w, d - R);
    s.quadraticCurveTo(w, d, w - R, d);
    s.lineTo(R, d);
    s.quadraticCurveTo(0, d, 0, d - R);
    s.closePath();
    return s;
  }, []);
  const intSettings = useMemo(() => ({ depth: intH, bevelEnabled: false }), [intH]);

  const extX = mm(REBATE_STEP);

  const debugMatExt = useMemo(() => debugColors
    ? new THREE.MeshStandardMaterial({ color: '#f39c12', opacity: 0.85, transparent: true })
    : null, [debugColors]);
  const debugMatInt = useMemo(() => debugColors
    ? new THREE.MeshStandardMaterial({ color: '#d68910', opacity: 0.85, transparent: true })
    : null, [debugColors]);

  return (
    <group>
      <mesh castShadow receiveShadow rotation={[0, Math.PI / 2, 0]} position={[extX, 0, halfD]}>
        <extrudeGeometry args={[extShape, extSettings]} />
        {debugColors ? <primitive object={debugMatExt} attach="material" /> : <primitive object={mat} attach="material" />}
      </mesh>
      <mesh castShadow receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, intStartYLocal, halfD - mm(EXT_DEPTH)]}
      >
        <extrudeGeometry args={[intShape, intSettings]} />
        {debugColors ? <primitive object={debugMatInt} attach="material" /> : <primitive object={mat} attach="material" />}
      </mesh>
    </group>
  );
}

// ═══ Transom — horizontal divider, R12 on both inner-room corners ═══
function Transom({ transomWidth, mat, debugColors }) {
  const intLen = mm(transomWidth);
  const extLen = mm(transomWidth + REBATE_STEP * 2);

  const extShape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, mm(REBATE_STEP));
    s.lineTo(0, mm(MULLION_W - REBATE_STEP));
    s.lineTo(mm(EXT_DEPTH), mm(MULLION_W - REBATE_STEP));
    s.lineTo(mm(EXT_DEPTH), mm(REBATE_STEP));
    s.closePath();
    return s;
  }, []);

  // INT: R12 at (FRAME_DEPTH, MULLION_W) and (FRAME_DEPTH, 0)
  const intShape = useMemo(() => {
    const s = new THREE.Shape();
    const d0 = mm(EXT_DEPTH);
    const d1 = mm(FRAME_DEPTH);
    const w = mm(MULLION_W);
    s.moveTo(d0, 0);
    s.lineTo(d0, w);
    s.lineTo(d1 - R, w);
    s.quadraticCurveTo(d1, w, d1, w - R);
    s.lineTo(d1, R);
    s.quadraticCurveTo(d1, 0, d1 - R, 0);
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
      <mesh castShadow receiveShadow rotation={[0, Math.PI / 2, 0]} position={[-extLen / 2, 0, halfD]}>
        <extrudeGeometry args={[extShape, extSettings]} />
        {debugColors ? <primitive object={debugMatExt} attach="material" /> : <primitive object={mat} attach="material" />}
      </mesh>
      <mesh castShadow receiveShadow rotation={[0, Math.PI / 2, 0]} position={[-intLen / 2, 0, halfD]}>
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
      <group position={[0, -H / 2, 0]}>
        <BottomRail width={width} mat={material} debugColors={debugColors} />
      </group>
      <group position={[0, H / 2 - mm(FRAME_FACE), 0]}>
        <TopRail width={width} mat={material} debugColors={debugColors} />
      </group>
      <group position={[-W / 2, -H / 2, 0]}>
        <Stile frameHeight={height} side="left" mat={material} debugColors={debugColors} />
      </group>
      <group position={[W / 2 - mm(FRAME_FACE), -H / 2, 0]}>
        <Stile frameHeight={height} side="right" mat={material} debugColors={debugColors} />
      </group>
      {mullions.map((m, i) => {
        const mObj = typeof m === 'number'
          ? { x: m, startY: 0, endY: height, touchesBottom: true, touchesTop: true }
          : m;
        const x = -W / 2 + mm(mObj.x) - mm(MULLION_W) / 2;
        const y = mm(mObj.startY);
        return (
          <group key={`mull-${i}`} position={[x, -H / 2 + y, 0]}>
            <Mullion startY={mObj.startY} endY={mObj.endY}
              touchesBottom={mObj.touchesBottom !== false}
              touchesTop={mObj.touchesTop !== false}
              mat={material} debugColors={debugColors} />
          </group>
        );
      })}
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