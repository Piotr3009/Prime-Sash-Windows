/**
 * DoorFrame.jsx
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

// ─── Threshold (used in standard DoorFrame, NOT in ArchedDoorWindow) ───
const THRESHOLD_HEIGHT = 40;
const THRESHOLD_FLAT_DEPTH = 68;
const THRESHOLD_SLOPE_DEPTH = FRAME_DEPTH - THRESHOLD_FLAT_DEPTH; // 25mm exterior slope
const THRESHOLD_SLOPE_ANGLE = 7 * Math.PI / 180;
const THRESHOLD_OUTER_HEIGHT = THRESHOLD_HEIGHT - THRESHOLD_SLOPE_DEPTH * Math.tan(THRESHOLD_SLOPE_ANGLE); // ~36.93mm

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

// ═══ Threshold ═══
// Three types:
//   'standard'    — hardwood, 40mm height, 93mm depth, 7° exterior slope + optional extension
//   'aluminium'   — aluminium strip, FRAME_DEPTH wide (93mm) × 5mm height
//   'low-profile' — low strip 40mm wide × 3mm height, behind door leaf (visible when open)
function Threshold({ width, mat, matInt, thresholdType = 'standard', extension = 0 }) {
  const len = mm(width);

  // ── Standard Hardwood — split into EXT (slope) + INT (flat) for dual colour ──
  const extShape = useMemo(() => {
    if (thresholdType !== 'standard') return null;
    const ext = Math.max(0, Math.min(100, extension));
    const totalSlopeDepth = THRESHOLD_SLOPE_DEPTH + ext;
    const outerHeight = THRESHOLD_HEIGHT - totalSlopeDepth * Math.tan(THRESHOLD_SLOPE_ANGLE);
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(0, mm(Math.max(outerHeight, 0)));
    s.lineTo(mm(totalSlopeDepth), mm(THRESHOLD_HEIGHT));
    s.lineTo(mm(totalSlopeDepth), 0);
    s.closePath();
    return s;
  }, [thresholdType, extension]);

  const intShape = useMemo(() => {
    if (thresholdType !== 'standard') return null;
    const ext = Math.max(0, Math.min(100, extension));
    const totalSlopeDepth = THRESHOLD_SLOPE_DEPTH + ext;
    const s = new THREE.Shape();
    s.moveTo(mm(totalSlopeDepth), 0);
    s.lineTo(mm(totalSlopeDepth), mm(THRESHOLD_HEIGHT));
    s.lineTo(mm(totalSlopeDepth + THRESHOLD_FLAT_DEPTH), mm(THRESHOLD_HEIGHT));
    s.lineTo(mm(totalSlopeDepth + THRESHOLD_FLAT_DEPTH), 0);
    s.closePath();
    return s;
  }, [thresholdType, extension]);

  const standardSettings = useMemo(() => ({ depth: len, bevelEnabled: false }), [len]);

  // Standard: offset Z so interior edge aligns with frame interior (-halfD)
  // Total depth of shape = extension + FRAME_DEPTH
  // Shape X=0 maps to world Z = halfD + mm(extension) (further exterior)
  // Using same rotation [0, PI/2, 0]: shape X → world +Z
  // Position Z: halfD + mm(extension) so X=0 sits at exterior + extension
  const extMm = Math.max(0, Math.min(100, extension));
  const standardZOffset = halfD + mm(extMm);

  // ── Aluminium ──
  const aluMat = useMemo(() => {
    if (thresholdType !== 'aluminium') return null;
    return new THREE.MeshStandardMaterial({
      color: '#a8aaac', roughness: 0.3, metalness: 0.7
    });
  }, [thresholdType]);

  // ── Low Profile ──
  const lowMat = useMemo(() => {
    if (thresholdType !== 'low-profile') return null;
    return new THREE.MeshStandardMaterial({
      color: '#a8aaac', roughness: 0.3, metalness: 0.7
    });
  }, [thresholdType]);

  if (thresholdType === 'standard') {
    return (
      <group>
        {/* EXT — slope portion */}
        <mesh castShadow receiveShadow rotation={[0, Math.PI / 2, 0]} position={[-len / 2, 0, standardZOffset]}>
          <extrudeGeometry args={[extShape, standardSettings]} />
          <primitive object={mat} attach="material" />
        </mesh>
        {/* INT — flat portion */}
        <mesh castShadow receiveShadow rotation={[0, Math.PI / 2, 0]} position={[-len / 2, 0, standardZOffset]}>
          <extrudeGeometry args={[intShape, standardSettings]} />
          <primitive object={matInt || mat} attach="material" />
        </mesh>
      </group>
    );
  }

  if (thresholdType === 'aluminium') {
    // 93mm depth (FRAME_DEPTH) × 5mm height, top aligned with standard threshold top
    return (
      <mesh castShadow receiveShadow position={[0, mm(THRESHOLD_HEIGHT) - mm(5) / 2, 0]}>
        <boxGeometry args={[len, mm(5), mm(FRAME_DEPTH)]} />
        <primitive object={aluMat} attach="material" />
      </mesh>
    );
  }

  if (thresholdType === 'low-profile') {
    // 40mm wide × 3mm height, top aligned with standard threshold top
    // Sits at rebate Z (where door leaf sits)
    const leafZ = halfD - mm(EXT_DEPTH) + mm(GASKET_T) + mm(57) / 2;
    return (
      <mesh castShadow receiveShadow position={[0, mm(THRESHOLD_HEIGHT) - mm(3) / 2, leafZ]}>
        <boxGeometry args={[len, mm(3), mm(40)]} />
        <primitive object={lowMat} attach="material" />
      </mesh>
    );
  }

  return null;
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
    s.moveTo(0, mm(THRESHOLD_OUTER_HEIGHT));
    s.lineTo(mm(THRESHOLD_SLOPE_DEPTH), mm(THRESHOLD_HEIGHT));
    s.lineTo(mm(EXT_DEPTH), mm(THRESHOLD_HEIGHT));
    s.lineTo(mm(EXT_DEPTH), extTopCut); s.lineTo(0, extTopCut); s.closePath();
    return s;
  }, [extTopCut]);
  const extSettings = useMemo(() => ({ depth: mm(EXT_FACE), bevelEnabled: false }), []);
  const extX = side === 'left' ? 0 : mm(REBATE_STEP);

  // INT segmented
  const intStartY = mm(THRESHOLD_HEIGHT);
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
      s.moveTo(0, mm(THRESHOLD_OUTER_HEIGHT));
      s.lineTo(mm(THRESHOLD_SLOPE_DEPTH), mm(THRESHOLD_HEIGHT));
      s.lineTo(mm(EXT_DEPTH), mm(THRESHOLD_HEIGHT));
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

  const intStartYLocal = touchesBottom ? mm(THRESHOLD_HEIGHT) : -extendBottom;
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

// ═══ Main DoorFrame — computes cuts for each member ═══
export default function DoorFrame({
  width = 800, height = 1200, material, materialInt, sealColour = 'black',
  mullions = [], transoms = [], debugColors = false,
  thresholdType = 'standard', thresholdExtension = 0,
  openDirection = 'outward',
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
  // Stile INT runs from THRESHOLD_HEIGHT to height-FRAME_FACE. Flat where transoms cross.
  const stileIntLen = mm(height - FRAME_FACE - THRESHOLD_HEIGHT);
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
        const cutStart = mm(t.y - MULLION_W / 2 - THRESHOLD_HEIGHT);
        const cutEnd = mm(t.y + MULLION_W / 2 - THRESHOLD_HEIGHT);
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
        const cutStart = mm(t.y - MULLION_W / 2 - THRESHOLD_HEIGHT);
        const cutEnd = mm(t.y + MULLION_W / 2 - THRESHOLD_HEIGHT);
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
        const mullIntStartMm = mObj.touchesBottom !== false ? THRESHOLD_HEIGHT : (mObj.startY - REBATE_STEP);
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
      {/* Threshold — counter-mirror when inward (parent has Z=-1, so -1×-1=1 = stays in place) */}
      {/* Materials also counter-swapped: parent DoorFrame gets swapped mats for inward, threshold needs original */}
      <group position={[0, -H / 2, 0]} scale={[1, 1, openDirection === 'inward' ? -1 : 1]}>
        <Threshold width={width} mat={openDirection === 'inward' ? materialInt : material} matInt={openDirection === 'inward' ? material : materialInt} thresholdType={thresholdType} extension={thresholdExtension} />
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
        const openBottom = -H / 2 + mm(THRESHOLD_HEIGHT);
        const openTop = H / 2 - mm(FRAME_FACE) + mm(REBATE_STEP);
        const openW = openRight - openLeft;
        const openH = openTop - openBottom;
        const openCenterX = (openLeft + openRight) / 2;
        const openCenterY = (openBottom + openTop) / 2;

        return (
          <group>
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
              const mullBottom = -H / 2 + mm(mObj.startY) + (mObj.touchesBottom !== false ? mm(THRESHOLD_HEIGHT) : 0);
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