/**
 * ArchedDoorWindow.jsx
 * Arched door = outer frame (arch shape, DoorFrame dims) + leaf (FixFrameWindow).
 * Leaf sits in rebate with 4mm gap, pivots left/right.
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Text, Line } from '@react-three/drei';
import { FRAME_FACE, FRAME_DEPTH, EXT_DEPTH, INT_DEPTH, REBATE_STEP, BOTTOM_FACE, GASKET_W, GASKET_T, mm } from './DoorFrame';
import { SASH_RAIL } from './DoorPanel';
import WindowDoorHandle from './WindowDoorHandle';
import FixFrameWindow from '../fix-frame/FixFrameWindow';

const LEAF_GAP = 4; // mm gap between leaf and frame
const MAX_ANGLE = 70; // degrees max opening
const SEGS = 48;

// ── Arc point helpers (same as FixFrameWindow) ──
function arcPoints(cx, cy, r, startAngle, endAngle, segs) {
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const a = startAngle + t * (endAngle - startAngle);
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

// ── Frame geometry with REBATE (2 layers like DoorFrame) ──
// EXT layer: outer → inner (FRAME_FACE offset), depth = EXT_DEPTH
// INT layer: outer → innerRebated (EXT_FACE offset = less inset = larger opening), depth = INT_DEPTH
// This creates the rebate step where leaf sits
const EXT_FACE_W = FRAME_FACE - REBATE_STEP; // 36mm
const BOTTOM_INNER = BOTTOM_FACE - REBATE_STEP; // 47mm

function makeShapeWithHole(outerPts, innerPts) {
  const shape = new THREE.Shape();
  shape.moveTo(outerPts[0][0], outerPts[0][1]);
  for (let i = 1; i < outerPts.length; i++) shape.lineTo(outerPts[i][0], outerPts[i][1]);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(innerPts[0][0], innerPts[0][1]);
  for (let i = 1; i < innerPts.length; i++) hole.lineTo(innerPts[i][0], innerPts[i][1]);
  hole.closePath();
  shape.holes.push(hole);
  return shape;
}

function makeFrameGeo(outerPts, innerPts, innerRebatedPts) {
  const halfD = mm(FRAME_DEPTH) / 2;
  const extD = mm(EXT_DEPTH);
  const intD = mm(INT_DEPTH);

  // EXT layer (front): outer → innerRebated (36mm face = wider opening)
  const extShape = makeShapeWithHole(outerPts, innerRebatedPts);
  const ext = new THREE.ExtrudeGeometry(extShape, { depth: extD, bevelEnabled: false });
  ext.translate(0, 0, halfD - extD);
  ext.computeVertexNormals();

  // INT layer (back): outer → inner (57mm face = narrower opening = rebate ledge)
  const intShape = makeShapeWithHole(outerPts, innerPts);
  const intGeo = new THREE.ExtrudeGeometry(intShape, { depth: intD, bevelEnabled: false });
  intGeo.translate(0, 0, -halfD);
  intGeo.computeVertexNormals();

  return { ext, int: intGeo };
}

// ── Arch shape point generators for OUTER FRAME ──
// Copied from FixFrameWindow shape logic, using DoorFrame dims (FRAME_FACE=57, BOTTOM_FACE=68)
function semiCirclePoints(width, height) {
  const W = mm(width), H = mm(height), fw = mm(FRAME_FACE), bw = mm(BOTTOM_FACE);
  const fwr = mm(EXT_FACE_W), bwr = mm(BOTTOM_INNER);
  const halfW = W / 2;
  const springY = -H / 2 + Math.max(H - halfW, mm(50));
  // EXT inner (FRAME_FACE offset)
  const iHalfW = halfW - fw;
  const iBottom = -H / 2 + bw;
  // INT inner (EXT_FACE offset = less inset = larger opening for rebate)
  const rHalfW = halfW - fwr;
  const rBottom = -H / 2 + bwr;

  const outerArc = arcPoints(0, springY, halfW, 0, Math.PI, SEGS);
  const outer = [[-halfW, -H/2], [halfW, -H/2], [halfW, springY], ...outerArc, [-halfW, springY]];
  const innerArc = arcPoints(0, springY, iHalfW, 0, Math.PI, SEGS);
  const inner = [[-iHalfW, iBottom], [iHalfW, iBottom], [iHalfW, springY], ...innerArc, [-iHalfW, springY]];
  const rebatedArc = arcPoints(0, springY, rHalfW, 0, Math.PI, SEGS);
  const innerRebated = [[-rHalfW, rBottom], [rHalfW, rBottom], [rHalfW, springY], ...rebatedArc, [-rHalfW, springY]];
  return { outer, inner, innerRebated };
}

function gothicPoints(width, height) {
  const W = mm(width), H = mm(height), fw = mm(FRAME_FACE), bw = mm(BOTTOM_FACE);
  const fwr = mm(EXT_FACE_W), bwr = mm(BOTTOM_INNER);
  const halfW = W / 2;
  const archRise = W * Math.sqrt(3) / 2;
  const effectiveH = Math.max(H, mm(Math.round(width * Math.sqrt(3) / 2)) + mm(50));
  const straightWall = Math.max(effectiveH - archRise, mm(50));
  const springY = -effectiveH / 2 + straightWall;

  const rightArc = arcPoints(-halfW, springY, W, 0, Math.PI / 3, SEGS);
  const leftArc = arcPoints(halfW, springY, W, 2 * Math.PI / 3, Math.PI, SEGS);
  const outer = [[-halfW, -effectiveH/2], [halfW, -effectiveH/2], [halfW, springY], ...rightArc, ...leftArc, [-halfW, springY]];

  // EXT inner
  const iHalfW = halfW - fw;
  const Ri = W - fw;
  const iBottom = -effectiveH / 2 + bw;
  const iRightArc = arcPoints(-halfW, springY, Ri, 0, Math.PI / 3, SEGS);
  const iLeftArc = arcPoints(halfW, springY, Ri, 2 * Math.PI / 3, Math.PI, SEGS);
  const inner = [[-iHalfW, iBottom], [iHalfW, iBottom], [iHalfW, springY], ...iRightArc, ...iLeftArc, [-iHalfW, springY]];

  // INT innerRebated (larger opening)
  const rHalfW = halfW - fwr;
  const Rr = W - fwr;
  const rBottom = -effectiveH / 2 + bwr;
  const rRightArc = arcPoints(-halfW, springY, Rr, 0, Math.PI / 3, SEGS);
  const rLeftArc = arcPoints(halfW, springY, Rr, 2 * Math.PI / 3, Math.PI, SEGS);
  const innerRebated = [[-rHalfW, rBottom], [rHalfW, rBottom], [rHalfW, springY], ...rRightArc, ...rLeftArc, [-rHalfW, springY]];

  return { outer, inner, innerRebated };
}

function segmentalPoints(width, height) {
  const W = mm(width), H = mm(height), fw = mm(FRAME_FACE), bw = mm(BOTTOM_FACE);
  const fwr = mm(EXT_FACE_W), bwr = mm(BOTTOM_INNER);
  const halfW = W / 2;
  const rise = halfW * 0.4;
  const R = (rise * rise + halfW * halfW) / (2 * rise);
  const cy = -H / 2 + (H - rise) - (R - rise);
  const springY = -H / 2 + (H - rise);
  const startAngle = Math.asin(Math.min(halfW / R, 1));

  const topArc = arcPoints(0, cy, R, Math.PI / 2 - startAngle, Math.PI / 2 + startAngle, SEGS);
  const outer = [[-halfW, -H/2], [halfW, -H/2], [halfW, springY], ...topArc, [-halfW, springY]];

  // EXT inner
  const iHalfW = halfW - fw;
  const iBottom = -H / 2 + bw;
  const iRise = Math.max(rise - fw, mm(10));
  const iR = (iRise * iRise + iHalfW * iHalfW) / (2 * iRise);
  const iCY = springY - (iR - iRise);
  const iAngle = Math.asin(Math.min(iHalfW / iR, 1));
  const innerArc = arcPoints(0, iCY, iR, Math.PI / 2 - iAngle, Math.PI / 2 + iAngle, SEGS);
  const inner = [[-iHalfW, iBottom], [iHalfW, iBottom], [iHalfW, springY], ...innerArc, [-iHalfW, springY]];

  // INT innerRebated
  const rHalfW = halfW - fwr;
  const rBottom = -H / 2 + bwr;
  const rRise = Math.max(rise - fwr, mm(10));
  const rR = (rRise * rRise + rHalfW * rHalfW) / (2 * rRise);
  const rCY = springY - (rR - rRise);
  const rAngle = Math.asin(Math.min(rHalfW / rR, 1));
  const rebatedArc = arcPoints(0, rCY, rR, Math.PI / 2 - rAngle, Math.PI / 2 + rAngle, SEGS);
  const innerRebated = [[-rHalfW, rBottom], [rHalfW, rBottom], [rHalfW, springY], ...rebatedArc, [-rHalfW, springY]];

  return { outer, inner, innerRebated };
}

function ellipticalPoints(width, height) {
  const W = mm(width), H = mm(height), fw = mm(FRAME_FACE), bw = mm(BOTTOM_FACE);
  const fwr = mm(EXT_FACE_W), bwr = mm(BOTTOM_INNER);
  const halfW = W / 2;
  const rise = halfW * 0.65;
  const springY = -H / 2 + Math.max(H - rise, mm(50));

  function ellipseArc(a, b, cY, segments) {
    const pts = [];
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI;
      pts.push([a * Math.cos(angle), cY + b * Math.sin(angle)]);
    }
    return pts;
  }

  const outerArc = ellipseArc(halfW, rise, springY, SEGS);
  const outer = [[-halfW, -H/2], [halfW, -H/2], [halfW, springY], ...outerArc, [-halfW, springY]];

  // EXT inner
  const iHalfW = halfW - fw;
  const iBottom = -H / 2 + bw;
  const iRise = Math.max(rise - fw, mm(10));
  const innerArc = ellipseArc(iHalfW, iRise, springY, SEGS);
  const inner = [[-iHalfW, iBottom], [iHalfW, iBottom], [iHalfW, springY], ...innerArc, [-iHalfW, springY]];

  // INT innerRebated
  const rHalfW = halfW - fwr;
  const rBottom = -H / 2 + bwr;
  const rRise = Math.max(rise - fwr, mm(10));
  const rebatedArc = ellipseArc(rHalfW, rRise, springY, SEGS);
  const innerRebated = [[-rHalfW, rBottom], [rHalfW, rBottom], [rHalfW, springY], ...rebatedArc, [-rHalfW, springY]];

  return { outer, inner, innerRebated };
}

// ── Main component ──
export default function ArchedDoorWindow({
  width = 1000,
  height = 1500,
  archShape = 'semi-circle',
  hingeDirection = 'left',
  opening = 0.3,
  woodColor = '#F6F6F6',
  woodColorExt = '#F6F6F6',
  woodColorInt = '#F6F6F6',
  sameColor = true,
  spacerColor = 'silver',
  glassFinish = 'clear',
  hBars = 0,
  vBars = 0,
  showGuides = true,
  brightness = 1.0,
  ironmongery = 'brass',
  sealColour = 'black',
  sillExtension = 0,
  sillWider = false,
  fixSemiBarPattern = 'none',
  fixGothicBars = 'none',
}) {
  const colorE = sameColor ? woodColor : woodColorExt;
  const colorI = sameColor ? woodColor : woodColorInt;

  const extMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: colorE, roughness: 0.72, metalness: 0.02, clearcoat: 0.06, clearcoatRoughness: 0.4,
  }), [colorE]);

  const intMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: colorI, roughness: 0.72, metalness: 0.02, clearcoat: 0.06, clearcoatRoughness: 0.4,
  }), [colorI]);

  // Gasket material
  const gasketMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: sealColour === 'white' ? '#E8E8E8' : '#1a1a1a', roughness: 0.9, metalness: 0,
  }), [sealColour]);

  // Handle colors (same as DoorPanel)
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

  const D = mm(FRAME_DEPTH);
  const halfD = D / 2;

  // ── Outer frame geometry ──
  const frameData = useMemo(() => {
    let pts;
    if (archShape === 'gothic-arch') pts = gothicPoints(width, height);
    else if (archShape === 'semi-circle') pts = semiCirclePoints(width, height);
    else if (archShape === 'segmental-arch') pts = segmentalPoints(width, height);
    else if (archShape === 'elliptical-arch') pts = ellipticalPoints(width, height);
    else return null;
    if (!pts) return null;
    const frameGeo = makeFrameGeo(pts.outer, pts.inner, pts.innerRebated);

    // Gasket: strip ON rebate step surface (same as DoorFrame)
    // Outer edge = innerRebated (36mm offset = rebate boundary)
    // Inner edge = inward by GASKET_W (19mm)
    const gOuter = pts.innerRebated;
    let cx = 0, cy = 0;
    for (const p of gOuter) { cx += p[0]; cy += p[1]; }
    cx /= gOuter.length; cy /= gOuter.length;
    const gw = mm(GASKET_W);
    const gasketInnerPts = gOuter.map(p => {
      const dx = p[0] - cx, dy = p[1] - cy;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      return [p[0] - dx / len * gw, p[1] - dy / len * gw];
    });
    const gasketShape = makeShapeWithHole(gOuter, gasketInnerPts);
    const gt = mm(GASKET_T);
    const gasketGeo = new THREE.ExtrudeGeometry(gasketShape, { depth: gt, bevelEnabled: false });
    // Z: sits on rebate face, projects toward exterior (same as DoorFrame gZ)
    const gZ = mm(FRAME_DEPTH) / 2 - mm(EXT_DEPTH) - gt / 2;
    gasketGeo.translate(0, 0, gZ);
    gasketGeo.computeVertexNormals();

    return { frameGeo, gasketGeo };
  }, [archShape, width, height]);

  // ── Leaf dimensions ──
  // Leaf = inner opening + rebate overlap - gap
  const leafW = width - FRAME_FACE * 2 + REBATE_STEP * 2 - LEAF_GAP * 2;
  const leafH = height - FRAME_FACE - BOTTOM_FACE + REBATE_STEP * 2 - LEAF_GAP * 2;

  // ── Leaf Z position (sits on gasket, flush with exterior) ──
  const leafZ = halfD - mm(EXT_DEPTH) + mm(GASKET_T) + mm(57) / 2;

  // ── Opening angle ──
  const clampedOpening = Math.max(0, Math.min(1, opening));
  const angleRad = THREE.MathUtils.degToRad(clampedOpening * MAX_ANGLE);

  // ── Leaf pivot dimensions ──
  const leafWm = mm(leafW);

  // ── Leaf arch rise: must match outer frame's rebated inner arch ──
  let leafArchRise = 0;
  if (archShape === 'segmental-arch') {
    leafArchRise = Math.round(width * 0.2 - EXT_FACE_W - LEAF_GAP);
  } else if (archShape === 'elliptical-arch') {
    leafArchRise = Math.round(width * 0.325 - EXT_FACE_W - LEAF_GAP);
  }

  // ── Leaf effective height (same logic as FixFrameWindow) ──
  let leafEffH = leafH;
  if (archShape === 'gothic-arch') leafEffH = Math.max(leafH, Math.round(leafW * Math.sqrt(3) / 2) + 50);
  else if (archShape === 'semi-circle') leafEffH = Math.max(leafH, Math.round(leafW / 2) + 50);

  // ── Leaf Y offset: align leaf bottom with outer frame rebated inner bottom + gap ──
  // Outer rebated inner bottom = -height/2 + BOTTOM_INNER (47mm)
  // Leaf bottom = -leafEffH/2 + Y_offset
  // Gap = LEAF_GAP (4mm): leafBottom = outerRebatedBottom + gap
  const leafYOffset = -mm(height) / 2 + mm(BOTTOM_INNER + LEAF_GAP) + mm(leafEffH) / 2;

  // ── Handle positioning (same logic as DoorPanel) ──
  const handleDeg = clampedOpening * MAX_ANGLE;
  const handleScale = 0.001;
  const REBATE_HIDDEN = 21;
  const stileCenter = mm(REBATE_HIDDEN + (SASH_RAIL - REBATE_HIDDEN) / 2);
  const leafD = mm(57); // leaf depth
  const intZ = -leafD / 2 - 0.001;
  const handleY = leafH >= 800 ? (-mm(leafEffH) / 2 + mm(500)) : 0;
  const handlePos = hingeDirection === 'left'
    ? [leafWm / 2 - stileCenter, handleY, intZ]
    : [-leafWm / 2 + stileCenter, handleY, intZ];
  const handleRot = [0, -Math.PI / 2, 0];

  // ── Leaf content (FixFrameWindow + handle) ──
  const leafContent = (
    <group position={[0, leafYOffset, leafZ]}>
      <FixFrameWindow
        width={leafW}
        height={leafH}
        fixShape={archShape}
        fixType="standard"
        woodColor={woodColor}
        woodColorExt={woodColorExt}
        woodColorInt={woodColorInt}
        sameColor={sameColor}
        spacerColor={spacerColor}
        glassFinish={glassFinish}
        hBars={hBars}
        vBars={vBars}
        showGuides={false}
        fixSemiBarPattern={fixSemiBarPattern}
        fixGothicBars={fixGothicBars}
        fixArchRise={leafArchRise}
      />
      {/* Handle on opposite stile, interior face */}
      <group position={handlePos} rotation={handleRot} scale={[handleScale, handleScale, handleScale]}>
        <WindowDoorHandle
          rotationDeg={hingeDirection === 'left' ? -handleDeg : handleDeg}
          metalColor={handleColors.metalColor}
          lockColor={handleColors.lockColor}
        />
      </group>
    </group>
  );

  // ── Leaf with pivot rotation ──
  let leafNode;
  if (clampedOpening === 0) {
    leafNode = leafContent;
  } else if (hingeDirection === 'left') {
    leafNode = (
      <group position={[-leafWm / 2, 0, 0]}>
        <group rotation={[0, -angleRad, 0]}>
          <group position={[leafWm / 2, 0, 0]}>
            {leafContent}
          </group>
        </group>
      </group>
    );
  } else {
    leafNode = (
      <group position={[leafWm / 2, 0, 0]}>
        <group rotation={[0, angleRad, 0]}>
          <group position={[-leafWm / 2, 0, 0]}>
            {leafContent}
          </group>
        </group>
      </group>
    );
  }

  // ── Sill dimensions (same as DoorWindow) ──
  // ── Dimensions for guides ──
  const W = mm(width);
  let outerEffH = height;
  let archRiseMm = 0;
  if (archShape === 'gothic-arch') { archRiseMm = Math.round(width * Math.sqrt(3) / 2); outerEffH = Math.max(height, archRiseMm + 50); }
  else if (archShape === 'semi-circle') { archRiseMm = Math.round(width / 2); outerEffH = Math.max(height, archRiseMm + 50); }
  else if (archShape === 'segmental-arch') { archRiseMm = Math.round(width * 0.2); }
  else if (archShape === 'elliptical-arch') { archRiseMm = Math.round(width * 0.325); }
  const H = mm(outerEffH);
  const springY = archRiseMm > 0 ? -H / 2 + (H - mm(archRiseMm)) : H / 2;

  const sillProj = mm(sillExtension);
  const sillExtra = sillWider ? mm(50) : 0;
  const sillW = W + sillExtra * 2;
  const sillH_size = mm(25);

  return (
    <group>
      {/* Outer frame */}
      {frameData && (
        <group>
          <mesh geometry={frameData.frameGeo.ext} castShadow receiveShadow>
            <primitive object={extMat} attach="material" />
          </mesh>
          <mesh geometry={frameData.frameGeo.int} castShadow receiveShadow>
            <primitive object={intMat} attach="material" />
          </mesh>
        </group>
      )}

      {/* Gasket on rebate face */}
      {frameData && frameData.gasketGeo && (
        <mesh geometry={frameData.gasketGeo} castShadow receiveShadow>
          <primitive object={gasketMat} attach="material" />
        </mesh>
      )}

      {/* Sill extension */}
      {sillExtension > 0 && (
        <mesh position={[0, -H / 2 + sillH_size / 2, halfD + sillProj / 2]} castShadow receiveShadow>
          <boxGeometry args={[sillW, sillH_size, sillProj]} />
          <primitive object={extMat} attach="material" />
        </mesh>
      )}

      {/* Leaf with pivot */}
      {leafNode}

      {/* Dimension guides */}
      {showGuides && (
        <group>
          <DimensionGuide from={[-W/2, H/2 + mm(80), 0]} to={[W/2, H/2 + mm(80), 0]} label={`${width} mm`} offset={[0, 0.05, 0]} />
          <DimensionGuide from={[W/2 + mm(130), -H/2, 0]} to={[W/2 + mm(130), H/2, 0]} label={`${outerEffH} mm`} offset={[0.07, 0, 0]} />
          {archRiseMm > 0 && <DimensionGuide from={[-W/2 - mm(130), springY, 0]} to={[-W/2 - mm(130), H/2, 0]} label={`↑ ${archRiseMm} mm`} offset={[-0.07, 0, 0]} />}
        </group>
      )}
    </group>
  );
}

// ── Dimension guide (same as DoorWindow / FixFrameWindow) ──
function DimensionGuide({ from, to, label, offset = [0, 0, 0] }) {
  const mid = [
    (from[0] + to[0]) / 2 + offset[0],
    (from[1] + to[1]) / 2 + offset[1],
    (from[2] + to[2]) / 2 + offset[2],
  ];
  const points = [from, to].map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  return (
    <group>
      <Line points={points} color="#22324a" lineWidth={1.25} transparent opacity={0.9} />
      <Text position={mid} fontSize={0.06} color="#22324a" anchorX="center" anchorY="middle"
        outlineColor="#f5f2ec" outlineWidth={0.008}>
        {label}
      </Text>
    </group>
  );
}