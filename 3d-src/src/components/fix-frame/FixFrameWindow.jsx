/**
 * FixFrameWindow.jsx — v5
 * Hybrid approach: straight members (stiles + bottom rail) with CasementPanel-style
 * ovolo/chamfer profiles + simple extrusion for curved arch top.
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Text, Line } from '@react-three/drei';
import CasementPanel from '../casement/CasementPanel';
import CasementGlazing, { GLASS_UNIT_DEPTH } from '../casement/CasementGlazing';

const mm = (v) => v / 1000;

const FRAME_FACE = 64;
const FRAME_DEPTH = { standard: 57, fd30: 57, fd60: 100 };
const GU = mm(GLASS_UNIT_DEPTH);

// ─── Profile constants (copied from CasementPanel) ───
const EBW = mm(9);
const EBD = mm(15);
const IBR = mm(11);
const OVOLO_N = 16;

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

/* ─── Arc helpers ─── */
function arcPts(cx, cy, r, startAngle, endAngle, segs) {
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const a = startAngle + t * (endAngle - startAngle);
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

/* ─── Glass material (identical to CasementGlazing) ─── */
function useGlassMat(finish) {
  return useMemo(() => {
    if (finish === 'frosted') {
      const size = 256, c = document.createElement('canvas'); c.width = size; c.height = size;
      const ctx = c.getContext('2d'); ctx.fillStyle = '#d0e4f0'; ctx.fillRect(0,0,size,size);
      for (let i = 0; i < 40000; i++) { const x = Math.random()*size, y = Math.random()*size; ctx.beginPath(); ctx.arc(x,y,Math.random()*2,0,Math.PI*2); ctx.fillStyle = `rgba(255,255,255,${Math.random()*0.35})`; ctx.fill(); }
      const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      return new THREE.MeshPhysicalMaterial({ color:'#c8dce8', roughness:1, metalness:0, transmission:0.15, transparent:true, opacity:0.96, thickness:GU, ior:1.52, side:THREE.DoubleSide, map:tex, roughnessMap:tex });
    }
    if (finish === 'obscure') {
      const size = 256, c = document.createElement('canvas'); c.width = size; c.height = size;
      const ctx = c.getContext('2d'); ctx.fillStyle = '#c8dce8'; ctx.fillRect(0,0,size,size);
      for (let i = 0; i < 8000; i++) { const x = Math.random()*size, y = Math.random()*size; ctx.beginPath(); ctx.arc(x,y,Math.random()*5+1,0,Math.PI*2); ctx.fillStyle = `rgba(200,220,240,${Math.random()*0.5})`; ctx.fill(); }
      const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      return new THREE.MeshPhysicalMaterial({ color:'#b8ccd8', roughness:0.7, metalness:0.02, transmission:0.4, transparent:true, opacity:0.85, thickness:GU, ior:1.5, side:THREE.DoubleSide, map:tex });
    }
    return new THREE.MeshPhysicalMaterial({ color:'#d4e8f0', metalness:0.05, roughness:0.05, transmission:0.92, transparent:true, opacity:0.35, ior:1.5, thickness:GU, side:THREE.DoubleSide });
  }, [finish]);
}

/* ═══ STRAIGHT MEMBERS ═══
 * Renders left stile, right stile, bottom rail with ovolo/chamfer profiles.
 * Identical to CasementPanel SashFrame but WITHOUT top rail.
 * stileHeight = height of straight wall (mm)
 * totalWidth = full frame width (mm)
 */
function StraightMembers({ totalWidth, stileHeight, frameDepth, matExt, matInt }) {
  const W = mm(totalWidth);
  const SH = mm(stileHeight);  // stile height (straight portion)
  const F = mm(FRAME_FACE);
  const D = mm(frameDepth);
  const halfD = D / 2;

  // Stile settings: extrude along stile height
  const stileSettings = useMemo(() => ({ depth: SH, bevelEnabled: false }), [SH]);
  // Rail settings: extrude along full width
  const railSettings = useMemo(() => ({ depth: W, bevelEnabled: false }), [W]);

  // EXT halves
  const lStileExt = useMemo(() => shapeFromPts([[0,0],[F-EBW,0],[F,EBD],[F,halfD],[0,halfD]]), [halfD]);
  const rStileExt = useMemo(() => shapeFromPts([[F,0],[EBW,0],[0,EBD],[0,halfD],[F,halfD]]), [halfD]);
  const bRailExt = useMemo(() => shapeFromPts([[0,0],[0,F-EBW],[EBD,F],[halfD,F],[halfD,0]]), [halfD]);

  // INT halves
  const lStileInt = useMemo(() => {
    const pts = [[0,halfD],[F,halfD],[F,D-IBR]];
    pts.push(...ovoloArc(F-IBR, D-IBR, IBR, 0, Math.PI/2, OVOLO_N));
    pts.push([0,D]);
    return shapeFromPts(pts);
  }, [halfD, D]);
  const rStileInt = useMemo(() => {
    const pts = [[F,halfD],[0,halfD],[0,D-IBR]];
    pts.push(...ovoloArc(IBR, D-IBR, IBR, Math.PI, Math.PI/2, OVOLO_N));
    pts.push([F,D]);
    return shapeFromPts(pts);
  }, [halfD, D]);
  const bRailInt = useMemo(() => {
    const pts = [[halfD,0],[halfD,F],[D-IBR,F]];
    pts.push(...ovoloArc(D-IBR, F-IBR, IBR, Math.PI/2, 0, OVOLO_N));
    pts.push([D,0]);
    return shapeFromPts(pts);
  }, [halfD, D]);

  const mi = matInt || matExt;

  // Bottom-left corner of the frame
  const bx = -W / 2;
  const by = -SH / 2;   // stiles centered vertically around their own center

  return (
    <group>
      {/* Left stile EXT */}
      <mesh castShadow receiveShadow rotation={[-Math.PI/2,0,0]} position={[bx, by, halfD]}>
        <extrudeGeometry args={[lStileExt, stileSettings]} />
        <primitive object={matExt} attach="material" />
      </mesh>
      {/* Left stile INT */}
      <mesh castShadow receiveShadow rotation={[-Math.PI/2,0,0]} position={[bx, by, halfD]}>
        <extrudeGeometry args={[lStileInt, stileSettings]} />
        <primitive object={mi} attach="material" />
      </mesh>

      {/* Right stile EXT */}
      <mesh castShadow receiveShadow rotation={[-Math.PI/2,0,0]} position={[W/2 - F, by, halfD]}>
        <extrudeGeometry args={[rStileExt, stileSettings]} />
        <primitive object={matExt} attach="material" />
      </mesh>
      {/* Right stile INT */}
      <mesh castShadow receiveShadow rotation={[-Math.PI/2,0,0]} position={[W/2 - F, by, halfD]}>
        <extrudeGeometry args={[rStileInt, stileSettings]} />
        <primitive object={mi} attach="material" />
      </mesh>

      {/* Bottom rail EXT */}
      <mesh castShadow receiveShadow rotation={[0,Math.PI/2,0]} position={[bx, by, halfD]}>
        <extrudeGeometry args={[bRailExt, railSettings]} />
        <primitive object={matExt} attach="material" />
      </mesh>
      {/* Bottom rail INT */}
      <mesh castShadow receiveShadow rotation={[0,Math.PI/2,0]} position={[bx, by, halfD]}>
        <extrudeGeometry args={[bRailInt, railSettings]} />
        <primitive object={mi} attach="material" />
      </mesh>
    </group>
  );
}

/* ─── Arch-only geometry (curved top between stile tops) ─── */
function makeArchGeo(outerArcPts, innerArcPts, halfW, iHalfW, springY, depth) {
  const shape = new THREE.Shape();
  // Outer: right stile top → arch → left stile top → bottom close
  shape.moveTo(halfW, springY);
  for (const p of outerArcPts) shape.lineTo(p[0], p[1]);
  shape.lineTo(-halfW, springY);
  shape.closePath();
  // Inner hole
  const hole = new THREE.Path();
  hole.moveTo(iHalfW, springY);
  for (const p of innerArcPts) hole.lineTo(p[0], p[1]);
  hole.lineTo(-iHalfW, springY);
  hole.closePath();
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geo.translate(0, 0, -depth / 2);
  geo.computeVertexNormals();
  return geo;
}

/* ─── Glass shape from inner contour (full shape) ─── */
function CurvedGlass({ innerPts, glassMat, spacerColor }) {
  const spacerHex = spacerColor === 'white' ? '#E8E8E8' : spacerColor === 'black' ? '#1a1a1a' : '#C8C8C8';
  const glassGeo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(innerPts[0][0], innerPts[0][1]);
    for (let i = 1; i < innerPts.length; i++) shape.lineTo(innerPts[i][0], innerPts[i][1]);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: GU, bevelEnabled: false });
    g.translate(0, 0, -GU / 2);
    g.computeVertexNormals();
    return g;
  }, [innerPts]);

  const spacerGeo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(innerPts[0][0], innerPts[0][1]);
    for (let i = 1; i < innerPts.length; i++) shape.lineTo(innerPts[i][0], innerPts[i][1]);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: mm(1), bevelEnabled: false });
    g.translate(0, 0, -mm(0.5));
    g.computeVertexNormals();
    return g;
  }, [innerPts]);

  return (
    <group>
      <mesh geometry={glassGeo} castShadow={false} receiveShadow>
        <primitive object={glassMat} attach="material" />
      </mesh>
      <mesh geometry={spacerGeo} position={[0, 0, GU/2]}>
        <meshStandardMaterial color={spacerHex} metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh geometry={spacerGeo} position={[0, 0, -GU/2]}>
        <meshStandardMaterial color={spacerHex} metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  );
}

/* ═══ GOTHIC ARCH ═══ */
function GothicArchShape({ width, height, depth, matExt, matInt, glassMat, spacerColor, gothicBars = 'none' }) {
  const W = mm(width); const H = mm(height); const fw = mm(FRAME_FACE);
  const D = mm(depth); const halfW = W / 2;
  const archRise = W * Math.sqrt(3) / 2;
  const straightWall = Math.max(H - archRise, mm(50));
  const springY = -H / 2 + straightWall;
  const segs = 48;
  const iHalfW = halfW - fw; const Ri = W - fw; const iBottom = -H / 2 + fw;
  const BAR_W = mm(22); const BAR_D = mm(16);

  function archYAtX(x) {
    if (x >= 0) { const dx = x + halfW; const sq = Ri*Ri - dx*dx; return sq > 0 ? springY + Math.sqrt(sq) : springY; }
    else { const dx = x - halfW; const sq = Ri*Ri - dx*dx; return sq > 0 ? springY + Math.sqrt(sq) : springY; }
  }

  const archGeo = useMemo(() => {
    const outerRight = arcPts(-halfW, springY, W, 0, Math.PI/3, segs);
    const outerLeft = arcPts(halfW, springY, W, 2*Math.PI/3, Math.PI, segs);
    const outerArc = [...outerRight, ...outerLeft];
    const innerRight = arcPts(-halfW, springY, Ri, 0, Math.PI/3, segs);
    const innerLeft = arcPts(halfW, springY, Ri, 2*Math.PI/3, Math.PI, segs);
    const innerArc = [...innerRight, ...innerLeft];
    return makeArchGeo(outerArc, innerArc, halfW, iHalfW, springY, D);
  }, [W, H, fw, D, halfW, springY, iHalfW, Ri, segs]);

  const innerPts = useMemo(() => {
    const iRight = arcPts(-halfW, springY, Ri, 0, Math.PI/3, segs);
    const iLeft = arcPts(halfW, springY, Ri, 2*Math.PI/3, Math.PI, segs);
    return [[-iHalfW, iBottom], [iHalfW, iBottom], [iHalfW, springY], ...iRight, ...iLeft, [-iHalfW, springY]];
  }, [iHalfW, iBottom, springY, Ri, halfW, segs]);

  const bars = useMemo(() => {
    if (gothicBars !== 'patternA') return [];
    const result = [];
    result.push({ args: [iHalfW*2, BAR_W, BAR_D], pos: [0, springY, 0] });
    const x1 = -iHalfW + (iHalfW*2)/3, x2 = -iHalfW + (iHalfW*2)*2/3;
    for (const x of [x1, x2]) {
      const topY = archYAtX(x) - BAR_W/2;
      const barH = topY - iBottom;
      if (barH > 0) result.push({ args: [BAR_W, barH, BAR_D], pos: [x, iBottom+barH/2, 0] });
    }
    return result;
  }, [gothicBars, iHalfW, iBottom, springY, BAR_W, BAR_D]);

  // Stile height = straight wall (bottom to springing in mm)
  const stileH = Math.round(straightWall * 1000);

  return (
    <group>
      {/* Straight members: stiles + bottom rail with ovolo/chamfer */}
      <StraightMembers totalWidth={width} stileHeight={stileH} frameDepth={depth} matExt={matExt} matInt={matInt} />
      {/* Curved arch top: simple extrusion */}
      <mesh geometry={archGeo} castShadow receiveShadow><primitive object={matExt} attach="material" /></mesh>
      {/* Glass */}
      <CurvedGlass innerPts={innerPts} glassMat={glassMat} spacerColor={spacerColor} />
      {/* Gothic bars */}
      {bars.map((b, i) => (<mesh key={i} position={b.pos} castShadow receiveShadow><boxGeometry args={b.args} /><primitive object={matExt} attach="material" /></mesh>))}
    </group>
  );
}

/* ═══ SEMI-CIRCLE ═══ */
function SemiCircleShape({ width, height, depth, matExt, matInt, glassMat, spacerColor }) {
  const W = mm(width); const H = mm(height); const fw = mm(FRAME_FACE);
  const D = mm(depth); const halfW = W / 2;
  const archRise = halfW;
  const straightWall = Math.max(H - archRise, mm(50));
  const springY = -H / 2 + straightWall;
  const iHalfW = halfW - fw;
  const segs = 48;

  const archGeo = useMemo(() => {
    const outerArc = arcPts(0, springY, halfW, 0, Math.PI, segs);
    const innerArc = arcPts(0, springY, iHalfW, 0, Math.PI, segs);
    return makeArchGeo(outerArc, innerArc, halfW, iHalfW, springY, D);
  }, [halfW, iHalfW, springY, D, segs]);

  const innerPts = useMemo(() => {
    const innerArc = arcPts(0, springY, iHalfW, 0, Math.PI, segs);
    return [[-iHalfW, -H/2+fw], [iHalfW, -H/2+fw], [iHalfW, springY], ...innerArc, [-iHalfW, springY]];
  }, [iHalfW, H, fw, springY, segs]);

  const stileH = Math.round(straightWall * 1000);

  return (
    <group>
      <StraightMembers totalWidth={width} stileHeight={stileH} frameDepth={depth} matExt={matExt} matInt={matInt} />
      <mesh geometry={archGeo} castShadow receiveShadow><primitive object={matExt} attach="material" /></mesh>
      <CurvedGlass innerPts={innerPts} glassMat={glassMat} spacerColor={spacerColor} />
    </group>
  );
}

/* ═══ SEGMENTAL ═══ */
function SegmentalShape({ width, height, depth, matExt, matInt, glassMat, spacerColor, customRise = 0 }) {
  const W = mm(width); const H = mm(height); const fw = mm(FRAME_FACE);
  const D = mm(depth); const halfW = W / 2;
  const rise = customRise > 0 ? mm(customRise) : halfW * 0.4;
  const R = (rise*rise + halfW*halfW) / (2*rise);
  const cy = -H/2 + (H - rise) - (R - rise);
  const springY = -H/2 + (H - rise);
  const startAngle = Math.asin(Math.min(halfW / R, 1));
  const iHalfW = halfW - fw;
  const segs = 48;

  const archGeo = useMemo(() => {
    const outerArc = arcPts(0, cy, R, Math.PI/2 - startAngle, Math.PI/2 + startAngle, segs);
    const iRise = Math.max(rise - fw, mm(10));
    const iR = (iRise*iRise + iHalfW*iHalfW) / (2*iRise);
    const iCY = springY - (iR - iRise);
    const iAngle = Math.asin(Math.min(iHalfW / iR, 1));
    const innerArc = arcPts(0, iCY, iR, Math.PI/2 - iAngle, Math.PI/2 + iAngle, segs);
    return makeArchGeo(outerArc, innerArc, halfW, iHalfW, springY, D);
  }, [halfW, iHalfW, springY, D, R, cy, startAngle, rise, fw, segs]);

  const innerPts = useMemo(() => {
    const iRise = Math.max(rise - fw, mm(10));
    const iR = (iRise*iRise + iHalfW*iHalfW) / (2*iRise);
    const iCY = springY - (iR - iRise);
    const iAngle = Math.asin(Math.min(iHalfW / iR, 1));
    const innerArc = arcPts(0, iCY, iR, Math.PI/2 - iAngle, Math.PI/2 + iAngle, segs);
    return [[-iHalfW, -H/2+fw], [iHalfW, -H/2+fw], [iHalfW, springY], ...innerArc, [-iHalfW, springY]];
  }, [iHalfW, H, fw, springY, rise, segs]);

  const straightWall = H - rise;
  const stileH = Math.round(Math.max(straightWall, mm(50)) * 1000);

  return (
    <group>
      <StraightMembers totalWidth={width} stileHeight={stileH} frameDepth={depth} matExt={matExt} matInt={matInt} />
      <mesh geometry={archGeo} castShadow receiveShadow><primitive object={matExt} attach="material" /></mesh>
      <CurvedGlass innerPts={innerPts} glassMat={glassMat} spacerColor={spacerColor} />
    </group>
  );
}

/* ═══ ELLIPTICAL ═══ */
function EllipticalShape({ width, height, depth, matExt, matInt, glassMat, spacerColor, customRise = 0 }) {
  const W = mm(width); const H = mm(height); const fw = mm(FRAME_FACE);
  const D = mm(depth); const halfW = W / 2;
  const rise = customRise > 0 ? mm(customRise) : halfW * 0.65;
  const straightWall = Math.max(H - rise, mm(50));
  const springY = -H/2 + straightWall;
  const iHalfW = halfW - fw;
  const segs = 48;

  function ellipseArc(a, b, cY, segments) {
    const pts = [];
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI;
      pts.push([a * Math.cos(angle), cY + b * Math.sin(angle)]);
    }
    return pts;
  }

  const archGeo = useMemo(() => {
    const outerArc = ellipseArc(halfW, rise, springY, segs);
    const iRise = Math.max(rise - fw, mm(10));
    const innerArc = ellipseArc(iHalfW, iRise, springY, segs);
    return makeArchGeo(outerArc, innerArc, halfW, iHalfW, springY, D);
  }, [halfW, iHalfW, springY, D, rise, fw, segs]);

  const innerPts = useMemo(() => {
    const iRise = Math.max(rise - fw, mm(10));
    const innerArc = ellipseArc(iHalfW, iRise, springY, segs);
    return [[-iHalfW, -H/2+fw], [iHalfW, -H/2+fw], [iHalfW, springY], ...innerArc, [-iHalfW, springY]];
  }, [iHalfW, H, fw, rise, springY, segs]);

  const stileH = Math.round(straightWall * 1000);

  return (
    <group>
      <StraightMembers totalWidth={width} stileHeight={stileH} frameDepth={depth} matExt={matExt} matInt={matInt} />
      <mesh geometry={archGeo} castShadow receiveShadow><primitive object={matExt} attach="material" /></mesh>
      <CurvedGlass innerPts={innerPts} glassMat={glassMat} spacerColor={spacerColor} />
    </group>
  );
}

/* ═══ CIRCLE ═══ */
function CircleShape({ diameter, depth, matExt, glassMat, spacerColor }) {
  const R = mm(diameter) / 2; const fw = mm(FRAME_FACE);
  const rInner = Math.max(R - fw, mm(20));
  const D = mm(depth); const segs = 64;

  const frameGeo = useMemo(() => {
    const outer = arcPts(0, 0, R, 0, Math.PI*2, segs);
    const inner = arcPts(0, 0, rInner, 0, Math.PI*2, segs);
    const shape = new THREE.Shape();
    shape.moveTo(outer[0][0], outer[0][1]);
    for (let i = 1; i < outer.length; i++) shape.lineTo(outer[i][0], outer[i][1]);
    shape.closePath();
    const hole = new THREE.Path();
    hole.moveTo(inner[0][0], inner[0][1]);
    for (let i = 1; i < inner.length; i++) hole.lineTo(inner[i][0], inner[i][1]);
    hole.closePath();
    shape.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: D, bevelEnabled: false });
    geo.translate(0, 0, -D/2); geo.computeVertexNormals(); return geo;
  }, [R, rInner, D]);

  const innerPts = useMemo(() => arcPts(0, 0, rInner, 0, Math.PI*2, segs), [rInner]);

  return (
    <group>
      <mesh geometry={frameGeo} castShadow receiveShadow><primitive object={matExt} attach="material" /></mesh>
      <CurvedGlass innerPts={innerPts} glassMat={glassMat} spacerColor={spacerColor} />
    </group>
  );
}

/* ─── Dimension guide ─── */
function DimensionGuide({ from, to, label, offset = [0,0,0] }) {
  const mid = [(from[0]+to[0])/2+offset[0],(from[1]+to[1])/2+offset[1],(from[2]+to[2])/2+offset[2]];
  const points = [from, to].map(p => new THREE.Vector3(p[0],p[1],p[2]));
  return (<group><Line points={points} color="#22324a" lineWidth={1.25} transparent opacity={0.9} /><Text position={mid} fontSize={0.06} color="#22324a" anchorX="center" anchorY="middle" outlineColor="#f5f2ec" outlineWidth={0.008}>{label}</Text></group>);
}

/* ═══ MAIN ═══ */
export default function FixFrameWindow({
  width = 1000, height = 1500,
  woodColor = '#F6F6F6', woodColorExt = '#F6F6F6', woodColorInt = '#F6F6F6', sameColor = true,
  spacerColor = 'silver', glassFinish = 'clear',
  hBars = 0, vBars = 0, showGuides = true,
  fixShape = 'rectangle', fixType = 'standard',
  fixArchRise = 0, fixGothicBars = 'none',
}) {
  const cExt = sameColor ? woodColor : woodColorExt;
  const cInt = sameColor ? woodColor : woodColorInt;
  const depth = FRAME_DEPTH[fixType] || 57;

  const extMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: cExt, roughness: 0.72, metalness: 0.02, clearcoat: 0.06, clearcoatRoughness: 0.4 }), [cExt]);
  const intMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: cInt, roughness: 0.72, metalness: 0.02, clearcoat: 0.06, clearcoatRoughness: 0.4 }), [cInt]);
  const glassMat = useGlassMat(glassFinish);

  let effectiveH = height, archRiseMm = 0, springYFrac = 1;
  if (fixShape === 'gothic-arch') { archRiseMm = Math.round(width*Math.sqrt(3)/2); effectiveH = Math.max(height, archRiseMm+50); springYFrac = (effectiveH-archRiseMm)/effectiveH; }
  else if (fixShape === 'semi-circle') { archRiseMm = Math.round(width/2); effectiveH = Math.max(height, archRiseMm+50); springYFrac = (effectiveH-archRiseMm)/effectiveH; }
  else if (fixShape === 'segmental-arch') { archRiseMm = fixArchRise > 0 ? fixArchRise : Math.round(width*0.2); springYFrac = (effectiveH-archRiseMm)/effectiveH; }
  else if (fixShape === 'elliptical-arch') { archRiseMm = fixArchRise > 0 ? fixArchRise : Math.round(width*0.325); springYFrac = (effectiveH-archRiseMm)/effectiveH; }
  else if (fixShape === 'circle') { effectiveH = width; }

  const W = mm(width), H = mm(effectiveH);
  const springY = -H/2 + H * springYFrac;

  let shapeNode = null;
  if (fixShape === 'circle')
    shapeNode = <CircleShape diameter={width} depth={depth} matExt={extMat} glassMat={glassMat} spacerColor={spacerColor} />;
  else if (fixShape === 'gothic-arch')
    shapeNode = <GothicArchShape width={width} height={effectiveH} depth={depth} matExt={extMat} matInt={intMat} glassMat={glassMat} spacerColor={spacerColor} gothicBars={fixGothicBars} />;
  else if (fixShape === 'semi-circle')
    shapeNode = <SemiCircleShape width={width} height={effectiveH} depth={depth} matExt={extMat} matInt={intMat} glassMat={glassMat} spacerColor={spacerColor} />;
  else if (fixShape === 'segmental-arch')
    shapeNode = <SegmentalShape width={width} height={effectiveH} depth={depth} matExt={extMat} matInt={intMat} glassMat={glassMat} spacerColor={spacerColor} customRise={fixArchRise} />;
  else if (fixShape === 'elliptical-arch')
    shapeNode = <EllipticalShape width={width} height={effectiveH} depth={depth} matExt={extMat} matInt={intMat} glassMat={glassMat} spacerColor={spacerColor} customRise={fixArchRise} />;
  else
    shapeNode = <CasementPanel width={width} height={height} hingeType="fixed" opening={0} material={extMat} materialInt={intMat} spacerColor={spacerColor} glassFinish={glassFinish} hBars={hBars} vBars={vBars} ironmongery="brass" position={[0,0,0]} />;

  return (
    <group>
      {shapeNode}
      {showGuides && (<group>
        <DimensionGuide from={[-W/2, H/2+mm(80), 0]} to={[W/2, H/2+mm(80), 0]} label={`${width} mm`} offset={[0,0.05,0]} />
        <DimensionGuide from={[W/2+mm(130), -H/2, 0]} to={[W/2+mm(130), H/2, 0]} label={`${effectiveH} mm`} offset={[0.07,0,0]} />
        {archRiseMm > 0 && <DimensionGuide from={[-W/2-mm(130), springY, 0]} to={[-W/2-mm(130), H/2, 0]} label={`↑ ${archRiseMm} mm`} offset={[-0.07,0,0]} />}
      </group>)}
    </group>
  );
}