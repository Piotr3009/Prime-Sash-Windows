/**
 * CasementFrame.jsx
 * Segmented R12 rounding: inner-room edge is rounded (R12=12mm) where free,
 * flat where another member crosses (joint).
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';

const mm = (v) => v / 1000;
const R = mm(12);

const FRAME_FACE = 57;
const EXT_FACE = 36;
const EXT_DEPTH = 62;
const INT_DEPTH = 31;
const FRAME_DEPTH = 93;
const REBATE_STEP = 21;
const MULLION_W = 68;
const MULLION_EXT_FACE = MULLION_W - REBATE_STEP * 2;

const BOTTOM_FACE = 68;
const BOTTOM_EXT_OUTER = 36;
const BOTTOM_INNER_FACE = BOTTOM_FACE - REBATE_STEP;

const halfD = mm(FRAME_DEPTH) / 2;

// Gasket (seal) on rebate surface
const GASKET_W = 19; // mm, width on rebate surface (depth direction)
const GASKET_T = 5;  // mm, thickness projecting into opening

// ─── Helper: compute segments from cuts ───
// totalLen in meters, cuts = [{start,end}] in meters (flat zones)
// Returns [{start, end, rounded}]
function computeSegments(totalLen, cuts) {
  const sorted = [...cuts].filter(c => c.end > 0 && c.start < totalLen)
    .map(c => ({ start: Math.max(0, c.start), end: Math.min(totalLen, c.end) }))
    .sort((a, b) => a.start - b.start);
  const segs = [];
  let pos = 0;
  for (const c of sorted) {
    if (c.start > pos + 0.0001) segs.push({ start: pos, end: c.start, rounded: true });
    segs.push({ start: Math.max(pos, c.start), end: c.end, rounded: false });
    pos = c.end;
  }
  if (pos < totalLen - 0.0001) segs.push({ start: pos, end: totalLen, rounded: true });
  return segs.filter(s => (s.end - s.start) > 0.0001);
}

// ─── Helper: render segmented extrude ───
function SegmentedExtrude({ shapeFlat, shapeRounded, totalLen, cuts, rotation, position, mat, debugMat, debugColors }) {
  const segments = useMemo(() => computeSegments(totalLen, cuts), [totalLen, cuts]);
  return (
    <group rotation={rotation} position={position}>
      {segments.map((seg, i) => {
        const shape = seg.rounded ? shapeRounded : shapeFlat;
        const len = seg.end - seg.start;
        return (
          <mesh key={i} position={[0, 0, seg.start]} castShadow receiveShadow>
            <extrudeGeometry args={[shape, { depth: len, bevelEnabled: false }]} />
            {debugColors ? <primitive object={debugMat} attach="material" /> : <primitive object={mat} attach="material" />}
          </mesh>
        );
      })}
    </group>
  );
}

// ═══ Bottom Rail ═══
function BottomRail({ width, cuts, mat, matInt, debugColors }) {
  const len = mm(width);
  // EXT part: slope (0 to EXT_DEPTH)
  const extShape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(0, mm(BOTTOM_EXT_OUTER));
    s.lineTo(mm(EXT_DEPTH), mm(BOTTOM_INNER_FACE));
    s.lineTo(mm(EXT_DEPTH), 0); s.closePath();
    return s;
  }, []);
  const extSettings = useMemo(() => ({ depth: len, bevelEnabled: false }), [len]);
  // INT part: flat rectangle (EXT_DEPTH to FRAME_DEPTH)
  const intFlat = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(mm(EXT_DEPTH), 0); s.lineTo(mm(EXT_DEPTH), mm(BOTTOM_FACE));
    s.lineTo(mm(FRAME_DEPTH), mm(BOTTOM_FACE)); s.lineTo(mm(FRAME_DEPTH), 0); s.closePath();
    return s;
  }, []);
  const intRounded = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(mm(EXT_DEPTH), 0); s.lineTo(mm(EXT_DEPTH), mm(BOTTOM_FACE));
    s.lineTo(mm(FRAME_DEPTH) - R, mm(BOTTOM_FACE));
    s.quadraticCurveTo(mm(FRAME_DEPTH), mm(BOTTOM_FACE), mm(FRAME_DEPTH), mm(BOTTOM_FACE) - R);
    s.lineTo(mm(FRAME_DEPTH), 0); s.closePath();
    return s;
  }, []);
  const debugMatExt = useMemo(() => debugColors
    ? new THREE.MeshStandardMaterial({ color: '#e74c3c', opacity: 0.85, transparent: true }) : null, [debugColors]);
  const debugMatInt = useMemo(() => debugColors
    ? new THREE.MeshStandardMaterial({ color: '#c0392b', opacity: 0.85, transparent: true }) : null, [debugColors]);
  return (
    <group>
      <mesh castShadow receiveShadow rotation={[0, Math.PI / 2, 0]} position={[-len / 2, 0, halfD]}>
        <extrudeGeometry args={[extShape, extSettings]} />
        {debugColors ? <primitive object={debugMatExt} attach="material" /> : <primitive object={mat} attach="material" />}
      </mesh>
      <SegmentedExtrude shapeFlat={intFlat} shapeRounded={intRounded}
        totalLen={len} cuts={cuts} rotation={[0, Math.PI / 2, 0]}
        position={[-len / 2, 0, halfD]} mat={matInt || mat} debugMat={debugMatInt} debugColors={debugColors} />
    </group>
  );
}

// ═══ Top Rail ═══
function TopRail({ width, cuts, mat, matInt, debugColors }) {
  const len = mm(width);
  // EXT part: upper area (0 to EXT_DEPTH, above rebate)
  const extShape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, mm(REBATE_STEP)); s.lineTo(0, mm(FRAME_FACE));
    s.lineTo(mm(EXT_DEPTH), mm(FRAME_FACE)); s.lineTo(mm(EXT_DEPTH), mm(REBATE_STEP)); s.closePath();
    return s;
  }, []);
  const extSettings = useMemo(() => ({ depth: len, bevelEnabled: false }), [len]);
  // INT part: full-height rectangle (EXT_DEPTH to FRAME_DEPTH)
  const intFlat = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(mm(EXT_DEPTH), 0); s.lineTo(mm(EXT_DEPTH), mm(FRAME_FACE));
    s.lineTo(mm(FRAME_DEPTH), mm(FRAME_FACE)); s.lineTo(mm(FRAME_DEPTH), 0); s.closePath();
    return s;
  }, []);
  const intRounded = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(mm(EXT_DEPTH), 0); s.lineTo(mm(EXT_DEPTH), mm(FRAME_FACE));
    s.lineTo(mm(FRAME_DEPTH), mm(FRAME_FACE));
    s.lineTo(mm(FRAME_DEPTH), R);
    s.quadraticCurveTo(mm(FRAME_DEPTH), 0, mm(FRAME_DEPTH) - R, 0); s.closePath();
    return s;
  }, []);
  const debugMatExt = useMemo(() => debugColors
    ? new THREE.MeshStandardMaterial({ color: '#9b59b6', opacity: 0.85, transparent: true }) : null, [debugColors]);
  const debugMatInt = useMemo(() => debugColors
    ? new THREE.MeshStandardMaterial({ color: '#7d3c98', opacity: 0.85, transparent: true }) : null, [debugColors]);
  return (
    <group>
      <mesh castShadow receiveShadow rotation={[0, Math.PI / 2, 0]} position={[-len / 2, 0, halfD]}>
        <extrudeGeometry args={[extShape, extSettings]} />
        {debugColors ? <primitive object={debugMatExt} attach="material" /> : <primitive object={mat} attach="material" />}
      </mesh>
      <SegmentedExtrude shapeFlat={intFlat} shapeRounded={intRounded}
        totalLen={len} cuts={cuts} rotation={[0, Math.PI / 2, 0]}
        position={[-len / 2, 0, halfD]} mat={matInt || mat} debugMat={debugMatInt} debugColors={debugColors} />
    </group>
  );
}

// ═══ Stile ═══
function Stile({ frameHeight, side, intCuts, mat, matInt, debugColors }) {
  const extTopCut = mm(frameHeight - FRAME_FACE + REBATE_STEP);
  const extShape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, mm(BOTTOM_EXT_OUTER)); s.lineTo(mm(EXT_DEPTH), mm(BOTTOM_INNER_FACE));
    s.lineTo(mm(EXT_DEPTH), extTopCut); s.lineTo(0, extTopCut); s.closePath();
    return s;
  }, [extTopCut]);
  const extSettings = useMemo(() => ({ depth: mm(EXT_FACE), bevelEnabled: false }), []);
  const extX = side === 'left' ? 0 : mm(REBATE_STEP);

  // INT segmented
  const intStartY = mm(BOTTOM_FACE);
  const intH = mm(frameHeight - FRAME_FACE) - intStartY;
  const fw = mm(FRAME_FACE);
  const d = mm(INT_DEPTH);

  const intFlat = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(fw, 0); s.lineTo(fw, d); s.lineTo(0, d); s.closePath();
    return s;
  }, [fw, d]);

  const intRounded = useMemo(() => {
    const s = new THREE.Shape();
    if (side === 'left') {
      s.moveTo(0, 0); s.lineTo(fw, 0);
      s.lineTo(fw, d - R); s.quadraticCurveTo(fw, d, fw - R, d);
      s.lineTo(0, d); s.closePath();
    } else {
      s.moveTo(0, 0); s.lineTo(fw, 0); s.lineTo(fw, d);
      s.lineTo(R, d); s.quadraticCurveTo(0, d, 0, d - R); s.closePath();
    }
    return s;
  }, [side, fw, d]);

  const debugMatExt = useMemo(() => debugColors
    ? new THREE.MeshStandardMaterial({ color: side === 'left' ? '#27ae60' : '#2980b9', opacity: 0.85, transparent: true }) : null, [debugColors, side]);
  const debugMatInt = useMemo(() => debugColors
    ? new THREE.MeshStandardMaterial({ color: side === 'left' ? '#1d8348' : '#1a5276', opacity: 0.85, transparent: true }) : null, [debugColors, side]);

  return (
    <group>
      <mesh castShadow receiveShadow rotation={[0, Math.PI / 2, 0]} position={[extX, 0, halfD]}>
        <extrudeGeometry args={[extShape, extSettings]} />
        {debugColors ? <primitive object={debugMatExt} attach="material" /> : <primitive object={mat} attach="material" />}
      </mesh>
      <SegmentedExtrude shapeFlat={intFlat} shapeRounded={intRounded}
        totalLen={intH} cuts={intCuts} rotation={[-Math.PI / 2, 0, 0]}
        position={[0, intStartY, halfD - mm(EXT_DEPTH)]}
        mat={matInt || mat} debugMat={debugMatInt} debugColors={debugColors} />
    </group>
  );
}

// ═══ Mullion ═══
function Mullion({ startY = 0, endY = 1200, touchesBottom = true, touchesTop = true, intCuts, mat, matInt, debugColors }) {
  const hMm = endY - startY;
  const h = mm(hMm);
  const extendBottom = (!touchesBottom) ? mm(REBATE_STEP) : 0;
  const extendTop = (!touchesTop) ? mm(REBATE_STEP) : 0;

  const extShape = useMemo(() => {
    const s = new THREE.Shape();
    if (touchesBottom) {
      s.moveTo(0, mm(BOTTOM_EXT_OUTER)); s.lineTo(mm(EXT_DEPTH), mm(BOTTOM_INNER_FACE));
    } else {
      s.moveTo(0, -extendBottom); s.lineTo(mm(EXT_DEPTH), -extendBottom);
    }
    if (touchesTop) {
      const topCut = mm(hMm - FRAME_FACE + REBATE_STEP);
      s.lineTo(mm(EXT_DEPTH), topCut); s.lineTo(0, topCut);
    } else {
      s.lineTo(mm(EXT_DEPTH), h + extendTop); s.lineTo(0, h + extendTop);
    }
    s.closePath();
    return s;
  }, [hMm, touchesBottom, touchesTop, extendBottom, extendTop]);
  const extSettings = useMemo(() => ({ depth: mm(MULLION_EXT_FACE), bevelEnabled: false }), []);

  const intStartYLocal = touchesBottom ? mm(BOTTOM_FACE) : -extendBottom;
  const intEndYLocal = touchesTop ? mm(hMm - FRAME_FACE) : h + extendTop;
  const intH = Math.max(intEndYLocal - intStartYLocal, 0.001);

  // Forced flat zones: where mullion extends into transom rebate
  const allCuts = useMemo(() => {
    const cuts = [...(intCuts || [])];
    if (!touchesBottom) cuts.push({ start: 0, end: extendBottom });
    if (!touchesTop) cuts.push({ start: intH - extendTop, end: intH });
    return cuts;
  }, [intCuts, touchesBottom, touchesTop, extendBottom, extendTop, intH]);

  const w = mm(MULLION_W);
  const d = mm(INT_DEPTH);
  const intFlat = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(w, 0); s.lineTo(w, d); s.lineTo(0, d); s.closePath();
    return s;
  }, [w, d]);
  const intRounded = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(w, 0);
    s.lineTo(w, d - R); s.quadraticCurveTo(w, d, w - R, d);
    s.lineTo(R, d); s.quadraticCurveTo(0, d, 0, d - R); s.closePath();
    return s;
  }, [w, d]);

  const extX = mm(REBATE_STEP);
  const debugMatExt = useMemo(() => debugColors
    ? new THREE.MeshStandardMaterial({ color: '#f39c12', opacity: 0.85, transparent: true }) : null, [debugColors]);
  const debugMatInt = useMemo(() => debugColors
    ? new THREE.MeshStandardMaterial({ color: '#d68910', opacity: 0.85, transparent: true }) : null, [debugColors]);

  return (
    <group>
      <mesh castShadow receiveShadow rotation={[0, Math.PI / 2, 0]} position={[extX, 0, halfD]}>
        <extrudeGeometry args={[extShape, extSettings]} />
        {debugColors ? <primitive object={debugMatExt} attach="material" /> : <primitive object={mat} attach="material" />}
      </mesh>
      <SegmentedExtrude shapeFlat={intFlat} shapeRounded={intRounded}
        totalLen={intH} cuts={allCuts} rotation={[-Math.PI / 2, 0, 0]}
        position={[0, intStartYLocal, halfD - mm(EXT_DEPTH)]}
        mat={matInt || mat} debugMat={debugMatInt} debugColors={debugColors} />
    </group>
  );
}

// ═══ Transom ═══
function Transom({ transomWidth, intCuts, mat, matInt, debugColors }) {
  const intLen = mm(transomWidth);
  const extLen = mm(transomWidth + REBATE_STEP * 2);

  const extShape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, mm(REBATE_STEP)); s.lineTo(0, mm(MULLION_W - REBATE_STEP));
    s.lineTo(mm(EXT_DEPTH), mm(MULLION_W - REBATE_STEP));
    s.lineTo(mm(EXT_DEPTH), mm(REBATE_STEP)); s.closePath();
    return s;
  }, []);
  const extSettings = useMemo(() => ({ depth: extLen, bevelEnabled: false }), [extLen]);

  const w = mm(MULLION_W);
  const d0 = mm(EXT_DEPTH);
  const d1 = mm(FRAME_DEPTH);
  const intFlat = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(d0, 0); s.lineTo(d0, w); s.lineTo(d1, w); s.lineTo(d1, 0); s.closePath();
    return s;
  }, [d0, d1, w]);
  const intRounded = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(d0, 0); s.lineTo(d0, w);
    s.lineTo(d1 - R, w); s.quadraticCurveTo(d1, w, d1, w - R);
    s.lineTo(d1, R); s.quadraticCurveTo(d1, 0, d1 - R, 0); s.closePath();
    return s;
  }, [d0, d1, w]);

  const debugMatExt = useMemo(() => debugColors
    ? new THREE.MeshStandardMaterial({ color: '#e91e9b', opacity: 0.85, transparent: true }) : null, [debugColors]);
  const debugMatInt = useMemo(() => debugColors
    ? new THREE.MeshStandardMaterial({ color: '#a8145e', opacity: 0.85, transparent: true }) : null, [debugColors]);

  return (
    <group>
      <mesh castShadow receiveShadow rotation={[0, Math.PI / 2, 0]} position={[-extLen / 2, 0, halfD]}>
        <extrudeGeometry args={[extShape, extSettings]} />
        {debugColors ? <primitive object={debugMatExt} attach="material" /> : <primitive object={mat} attach="material" />}
      </mesh>
      <SegmentedExtrude shapeFlat={intFlat} shapeRounded={intRounded}
        totalLen={intLen} cuts={intCuts || []} rotation={[0, Math.PI / 2, 0]}
        position={[-intLen / 2, 0, halfD]}
        mat={matInt || mat} debugMat={debugMatInt} debugColors={debugColors} />
    </group>
  );
}

// ═══ Main CasementFrame — computes cuts for each member ═══
export default function CasementFrame({
  width = 800, height = 1200, material, materialInt, sealColour = 'black',
  mullions = [], transoms = [], debugColors = false,
}) {
  const W = mm(width);
  const H = mm(height);

  // Gasket colour
  const gasketColor = sealColour === 'white' ? '#E8E8E8' : '#1a1a1a';
  const gW = mm(GASKET_W);  // 19mm - covers rebate face
  const gT = mm(GASKET_T);  // 5mm - projects toward opening
  // Gasket Z: sits on rebate face (junction), projects toward exterior
  const gZ = halfD - mm(EXT_DEPTH) + gT / 2;

  // Parse mullion/transom objects
  const mullObjs = mullions.map(m => typeof m === 'number'
    ? { x: m, startY: 0, endY: height, touchesBottom: true, touchesTop: true } : m);
  const transObjs = transoms.map(t => typeof t === 'number'
    ? { y: t, width: width - FRAME_FACE * 2, offsetX: 0 } :
    { y: t.y, width: t.width || (width - FRAME_FACE * 2), offsetX: t.offsetX || 0 });

  // ─── Cuts for horizontal members (rails) ───
  // Rails run full width. Flat where stiles and mullions cross.
  const railCuts = useMemo(() => {
    const cuts = [
      { start: 0, end: mm(FRAME_FACE) },                         // left stile
      { start: mm(width - FRAME_FACE), end: mm(width) },         // right stile
    ];
    mullObjs.forEach(m => {
      cuts.push({ start: mm(m.x - MULLION_W / 2), end: mm(m.x + MULLION_W / 2) });
    });
    return cuts;
  }, [width, mullObjs]);

  // ─── Cuts for left stile INT ───
  // Stile INT runs from BOTTOM_FACE to height-FRAME_FACE. Flat where transoms cross.
  const stileIntLen = mm(height - FRAME_FACE - BOTTOM_FACE);
  const leftStileCuts = useMemo(() => {
    const cuts = [];
    transObjs.forEach(t => {
      // Check if transom crosses left stile (left stile X = 0 to FRAME_FACE)
      // Transom INT center X = offsetX, width = t.width, spans from offsetX - t.width/2 to offsetX + t.width/2
      // In frame coords, left stile inner edge at FRAME_FACE
      const tLeft = t.offsetX - t.width / 2 + (width / 2 - FRAME_FACE);
      const tRight = t.offsetX + t.width / 2 + (width / 2 - FRAME_FACE);
      // Transom spans frame X from (width/2 + offsetX - transomWidth/2) to (width/2 + offsetX + transomWidth/2)
      // Actually simpler: transom INT is centered at offsetX=0 by default, width between stiles
      // It always crosses stiles. For partial transoms with offsetX, check overlap.
      const transomLeftX = (width - t.width) / 2 + t.offsetX - FRAME_FACE;
      const transomRightX = transomLeftX + t.width;
      // Left stile inner edge is at X=FRAME_FACE from frame left. Transom must overlap this.
      if (transomLeftX <= 0 && transomRightX >= 0) {
        // Transom crosses left stile. Cut in stile INT coords (Y from bottom):
        const cutStart = mm(t.y - MULLION_W / 2 - BOTTOM_FACE);
        const cutEnd = mm(t.y + MULLION_W / 2 - BOTTOM_FACE);
        cuts.push({ start: cutStart, end: cutEnd });
      }
    });
    return cuts;
  }, [transObjs, width]);

  const rightStileCuts = useMemo(() => {
    const cuts = [];
    transObjs.forEach(t => {
      const transomLeftX = (width - t.width) / 2 + t.offsetX - FRAME_FACE;
      const transomRightX = transomLeftX + t.width;
      const stileInnerFromLeft = width - FRAME_FACE * 2;
      if (transomLeftX <= stileInnerFromLeft && transomRightX >= stileInnerFromLeft) {
        const cutStart = mm(t.y - MULLION_W / 2 - BOTTOM_FACE);
        const cutEnd = mm(t.y + MULLION_W / 2 - BOTTOM_FACE);
        cuts.push({ start: cutStart, end: cutEnd });
      }
    });
    return cuts;
  }, [transObjs, width]);

  // ─── Cuts for mullion INT ───
  function getMullionCuts(mObj) {
    const cuts = [];
    transObjs.forEach(t => {
      // Transom X range in frame coords
      const transomLeftX = (width - t.width) / 2 + t.offsetX;
      const transomRightX = transomLeftX + t.width;
      const mullLeftX = mObj.x - MULLION_W / 2;
      const mullRightX = mObj.x + MULLION_W / 2;
      // Check ANY overlap (not full containment)
      if (transomRightX > mullLeftX && transomLeftX < mullRightX) {
        // Mullion INT local Y starts at intStartYLocal
        const mullIntStartMm = mObj.touchesBottom !== false ? BOTTOM_FACE : (mObj.startY - REBATE_STEP);
        const cutStart = mm(t.y - MULLION_W / 2 - mullIntStartMm);
        const cutEnd = mm(t.y + MULLION_W / 2 - mullIntStartMm);
        cuts.push({ start: cutStart, end: cutEnd });
      }
    });
    return cuts;
  }

  // ─── Cuts for transom INT ───
  function getTransomCuts(tObj) {
    const cuts = [];
    const transomLen = tObj.width;
    mullObjs.forEach(m => {
      // Mullion X in frame coords, transom start X in frame coords
      const transomStartX = (width - transomLen) / 2 + tObj.offsetX;
      // Mullion cut position in transom local coords
      const mullLocalStart = m.x - MULLION_W / 2 - transomStartX;
      const mullLocalEnd = mullLocalStart + MULLION_W;
      if (mullLocalEnd > 0 && mullLocalStart < transomLen) {
        cuts.push({ start: mm(Math.max(0, mullLocalStart)), end: mm(Math.min(transomLen, mullLocalEnd)) });
      }
    });
    return cuts;
  }

  return (
    <group>
      <group position={[0, -H / 2, 0]}>
        <BottomRail width={width} cuts={railCuts} mat={material} matInt={materialInt} debugColors={debugColors} />
      </group>
      <group position={[0, H / 2 - mm(FRAME_FACE), 0]}>
        <TopRail width={width} cuts={railCuts} mat={material} matInt={materialInt} debugColors={debugColors} />
      </group>
      <group position={[-W / 2, -H / 2, 0]}>
        <Stile frameHeight={height} side="left" intCuts={leftStileCuts} mat={material} matInt={materialInt} debugColors={debugColors} />
      </group>
      <group position={[W / 2 - mm(FRAME_FACE), -H / 2, 0]}>
        <Stile frameHeight={height} side="right" intCuts={rightStileCuts} mat={material} matInt={materialInt} debugColors={debugColors} />
      </group>

      {mullObjs.map((mObj, i) => {
        const x = -W / 2 + mm(mObj.x) - mm(MULLION_W) / 2;
        const y = mm(mObj.startY);
        return (
          <group key={`mull-${i}`} position={[x, -H / 2 + y, 0]}>
            <Mullion startY={mObj.startY} endY={mObj.endY}
              touchesBottom={mObj.touchesBottom !== false}
              touchesTop={mObj.touchesTop !== false}
              intCuts={getMullionCuts(mObj)}
              mat={material} matInt={materialInt} debugColors={debugColors} />
          </group>
        );
      })}

      {transObjs.map((tObj, i) => {
        const y = -H / 2 + mm(tObj.y) - mm(MULLION_W) / 2;
        const offsetX = mm(tObj.offsetX);
        return (
          <group key={`transom-${i}`} position={[offsetX, y, 0]}>
            <Transom transomWidth={tObj.width}
              intCuts={getTransomCuts(tObj)}
              mat={material} matInt={materialInt} debugColors={debugColors} />
          </group>
        );
      })}

      {/* ═══ Gasket strips on rebate surfaces ═══ */}
      {(() => {
        // Opening bounds (inner edges of rebates)
        const openLeft = -W / 2 + mm(EXT_FACE);
        const openRight = W / 2 - mm(EXT_FACE);
        const openBottom = -H / 2 + mm(BOTTOM_INNER_FACE);
        const openTop = H / 2 - mm(FRAME_FACE) + mm(REBATE_STEP);
        const openW = openRight - openLeft;
        const openH = openTop - openBottom;
        const openCenterX = (openLeft + openRight) / 2;
        const openCenterY = (openBottom + openTop) / 2;

        return (
          <group>
            {/* Bottom rail gasket — between stiles */}
            <mesh position={[openCenterX, openBottom + gW / 2, gZ]}>
              <boxGeometry args={[openW, gW, gT]} />
              <meshStandardMaterial color={gasketColor} roughness={0.9} />
            </mesh>

            {/* Top rail gasket — between stiles */}
            <mesh position={[openCenterX, openTop - gW / 2, gZ]}>
              <boxGeometry args={[openW, gW, gT]} />
              <meshStandardMaterial color={gasketColor} roughness={0.9} />
            </mesh>

            {/* Left stile gasket — between rails */}
            <mesh position={[openLeft + gW / 2, openCenterY, gZ]}>
              <boxGeometry args={[gW, openH, gT]} />
              <meshStandardMaterial color={gasketColor} roughness={0.9} />
            </mesh>

            {/* Right stile gasket — between rails */}
            <mesh position={[openRight - gW / 2, openCenterY, gZ]}>
              <boxGeometry args={[gW, openH, gT]} />
              <meshStandardMaterial color={gasketColor} roughness={0.9} />
            </mesh>

            {/* Mullion gaskets — between rails, both sides */}
            {mullObjs.map((mObj, i) => {
              const mullCenterX = -W / 2 + mm(mObj.x);
              const mullBottom = -H / 2 + mm(mObj.startY) + (mObj.touchesBottom !== false ? mm(BOTTOM_INNER_FACE) : 0);
              const mullTop = -H / 2 + mm(mObj.endY) - (mObj.touchesTop !== false ? mm(FRAME_FACE - REBATE_STEP) : 0);
              const mullGH = mullTop - mullBottom;
              const mullGCY = (mullBottom + mullTop) / 2;
              return (
                <group key={`mull-gasket-${i}`}>
                  <mesh position={[mullCenterX - mm(MULLION_W) / 2 + gW / 2, mullGCY, gZ]}>
                    <boxGeometry args={[gW, mullGH, gT]} />
                    <meshStandardMaterial color={gasketColor} roughness={0.9} />
                  </mesh>
                  <mesh position={[mullCenterX + mm(MULLION_W) / 2 - gW / 2, mullGCY, gZ]}>
                    <boxGeometry args={[gW, mullGH, gT]} />
                    <meshStandardMaterial color={gasketColor} roughness={0.9} />
                  </mesh>
                </group>
              );
            })}

            {/* Transom gaskets — between stiles, top and bottom */}
            {transObjs.map((tObj, i) => {
              const tY = -H / 2 + mm(tObj.y);
              const tCenterX = mm(tObj.offsetX);
              const tLen = mm(tObj.width);
              return (
                <group key={`trans-gasket-${i}`}>
                  <mesh position={[tCenterX, tY - mm(MULLION_W) / 2 + gW / 2, gZ]}>
                    <boxGeometry args={[tLen, gW, gT]} />
                    <meshStandardMaterial color={gasketColor} roughness={0.9} />
                  </mesh>
                  <mesh position={[tCenterX, tY + mm(MULLION_W) / 2 - gW / 2, gZ]}>
                    <boxGeometry args={[tLen, gW, gT]} />
                    <meshStandardMaterial color={gasketColor} roughness={0.9} />
                  </mesh>
                </group>
              );
            })}
          </group>
        );
      })()}
    </group>
  );
}

export { FRAME_FACE, EXT_FACE, FRAME_DEPTH, EXT_DEPTH, INT_DEPTH, REBATE_STEP, MULLION_W, MULLION_EXT_FACE, BOTTOM_FACE, BOTTOM_EXT_OUTER, BOTTOM_INNER_FACE, GASKET_W, GASKET_T, mm };