/**
 * FixFrameWindow.jsx — clean version
 * Frame + glass + spacers, no beads.
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Text, Line } from '@react-three/drei';
import CasementPanel from '../casement/CasementPanel';
import { GLASS_UNIT_DEPTH } from '../casement/CasementGlazing';

const mm = (v) => v / 1000;

const FRAME_FACE = 64;
const FRAME_DEPTH = { standard: 57, fd30: 57, fd60: 100 };
const GU = mm(GLASS_UNIT_DEPTH);

// ─── Bar dimensions (copied from CasementGlazing) ───
const BAR_W = mm(22);
const BAR_TOP = mm(2);
const BAR_H = mm(16.5);
const SPACER_BAR_W = mm(18);
const SPACER_DEPTH = mm(16);
const glassHalf = GU / 2;

/* ─── Arc helpers ─── */
function arcPoints(cx, cy, r, startAngle, endAngle, segs) {
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

/* ─── Frame shape with hole ─── */
function makeFrameGeo(outerPts, innerPts, depth) {
  const shape = new THREE.Shape();
  shape.moveTo(outerPts[0][0], outerPts[0][1]);
  for (let i = 1; i < outerPts.length; i++) shape.lineTo(outerPts[i][0], outerPts[i][1]);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(innerPts[0][0], innerPts[0][1]);
  for (let i = 1; i < innerPts.length; i++) hole.lineTo(innerPts[i][0], innerPts[i][1]);
  hole.closePath();
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geo.translate(0, 0, -depth / 2);
  geo.computeVertexNormals();
  return geo;
}

/* ─── Bar profile shapes (copied from CasementGlazing) ─── */
function useTrapV() {
  return useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-BAR_W/2, 0); s.lineTo(-BAR_TOP/2, BAR_H); s.lineTo(BAR_TOP/2, BAR_H); s.lineTo(BAR_W/2, 0);
    s.closePath(); return s;
  }, []);
}
function useTrapH() {
  return useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, -BAR_W/2); s.lineTo(BAR_H, -BAR_TOP/2); s.lineTo(BAR_H, BAR_TOP/2); s.lineTo(0, BAR_W/2);
    s.closePath(); return s;
  }, []);
}
function useOvoloV() {
  return useMemo(() => {
    const drop = mm(2), sqH = mm(2);
    const s = new THREE.Shape();
    s.moveTo(-BAR_W/2, 0);
    s.quadraticCurveTo(-BAR_W/2, BAR_H-drop-sqH, -BAR_TOP/2, BAR_H-sqH);
    s.lineTo(-BAR_TOP/2, BAR_H); s.lineTo(BAR_TOP/2, BAR_H); s.lineTo(BAR_TOP/2, BAR_H-sqH);
    s.quadraticCurveTo(BAR_W/2, BAR_H-drop-sqH, BAR_W/2, 0);
    s.closePath(); return s;
  }, []);
}
function useOvoloH() {
  return useMemo(() => {
    const drop = mm(2), sqH = mm(2);
    const s = new THREE.Shape();
    s.moveTo(0, -BAR_W/2);
    s.quadraticCurveTo(BAR_H-drop-sqH, -BAR_W/2, BAR_H-sqH, -BAR_TOP/2);
    s.lineTo(BAR_H, -BAR_TOP/2); s.lineTo(BAR_H, BAR_TOP/2); s.lineTo(BAR_H-sqH, BAR_TOP/2);
    s.quadraticCurveTo(BAR_H-drop-sqH, BAR_W/2, 0, BAR_W/2);
    s.closePath(); return s;
  }, []);
}

/* ─── Profiled bar rendering (3 parts: trap + ovolo + spacer) ─── */
function FixBars({ barItems, matExt, matInt }) {
  const trapV = useTrapV();
  const trapH = useTrapH();
  const ovoloV = useOvoloV();
  const ovoloH = useOvoloH();

  const spacerMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#a0a4a8', metalness: 0.6, roughness: 0.4
  }), []);

  // Pre-build geometries per unique length
  const geos = useMemo(() => {
    const map = {};
    barItems.forEach(b => {
      const key = `${b.type}_${b.len.toFixed(6)}`;
      if (map[key]) return;
      const len = b.len + mm(18); // overshoot like casement
      if (b.type === 'v') {
        const vExt = new THREE.ExtrudeGeometry(trapV, { depth: len, bevelEnabled: false });
        vExt.rotateX(-Math.PI/2); vExt.translate(0, -len/2, 0); vExt.computeVertexNormals();
        const vInt = new THREE.ExtrudeGeometry(ovoloV, { depth: len, bevelEnabled: false, curveSegments: 32 });
        vInt.rotateX(-Math.PI/2); vInt.translate(0, -len/2, 0); vInt.computeVertexNormals();
        map[key] = { ext: vExt, int: vInt };
      } else {
        const hExt = new THREE.ExtrudeGeometry(trapH, { depth: b.len + mm(18), bevelEnabled: false });
        hExt.rotateY(Math.PI/2); hExt.translate(-(b.len + mm(18))/2, 0, 0); hExt.computeVertexNormals();
        const hInt = new THREE.ExtrudeGeometry(ovoloH, { depth: b.len + mm(18), bevelEnabled: false, curveSegments: 32 });
        hInt.rotateY(Math.PI/2); hInt.translate(-(b.len + mm(18))/2, 0, 0); hInt.computeVertexNormals();
        map[key] = { ext: hExt, int: hInt };
      }
    });
    return map;
  }, [barItems, trapV, trapH, ovoloV, ovoloH]);

  return (
    <group>
      {barItems.map((bar, i) => {
        const key = `${bar.type}_${bar.len.toFixed(6)}`;
        const g = geos[key];
        if (!g) return null;
        return (
          <group key={i} position={[bar.x, bar.y, 0]}>
            {/* Exterior — trapezoid */}
            <mesh geometry={g.ext} position={[0, 0, glassHalf]} rotation={[Math.PI, 0, 0]} castShadow receiveShadow>
              <primitive object={matExt} attach="material" />
            </mesh>
            {/* Interior — ovolo */}
            <mesh geometry={g.int} position={[0, 0, -glassHalf]} castShadow receiveShadow>
              <primitive object={matInt} attach="material" />
            </mesh>
            {/* Spacer between panes */}
            <mesh castShadow receiveShadow>
              {bar.type === 'v'
                ? <boxGeometry args={[SPACER_BAR_W, bar.len, SPACER_DEPTH]} />
                : <boxGeometry args={[bar.len, SPACER_BAR_W, SPACER_DEPTH]} />
              }
              <primitive object={spacerMat} attach="material" />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/* ─── Curved glass ─── */
function CurvedGlass({ innerPts, glassMat, spacerColor }) {
  const spacerHex = spacerColor === 'white' ? '#E8E8E8' : spacerColor === 'black' ? '#1a1a1a' : '#C8C8C8';

  const glassGeo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(innerPts[0][0], innerPts[0][1]);
    for (let i = 1; i < innerPts.length; i++) shape.lineTo(innerPts[i][0], innerPts[i][1]);
    shape.closePath();
    return new THREE.ShapeGeometry(shape, 1);
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
      <mesh geometry={spacerGeo} position={[0, 0, GU / 2]}>
        <meshStandardMaterial color={spacerHex} metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh geometry={spacerGeo} position={[0, 0, -GU / 2]}>
        <meshStandardMaterial color={spacerHex} metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  );
}

/* ═══ CIRCLE ═══ */
function CircleFrame({ diameter, depth, mat, glassMat, spacerColor }) {
  const R = mm(diameter) / 2;
  const fw = mm(FRAME_FACE);
  const rInner = Math.max(R - fw, mm(20));
  const D = mm(depth);
  const segs = 64;

  const { frameGeo, innerPts } = useMemo(() => {
    const outer = arcPoints(0, 0, R, 0, Math.PI * 2, segs);
    const inner = arcPoints(0, 0, rInner, 0, Math.PI * 2, segs);
    return { frameGeo: makeFrameGeo(outer, inner, D), innerPts: inner };
  }, [R, rInner, D]);

  return (
    <group>
      <mesh geometry={frameGeo} castShadow receiveShadow><primitive object={mat} attach="material" /></mesh>
      <CurvedGlass innerPts={innerPts} glassMat={glassMat} spacerColor={spacerColor} />
    </group>
  );
}

/* ═══ GOTHIC ARCH ═══ */
function GothicArchFrame({ width, height, depth, mat, glassMat, spacerColor, gothicBars = 'none' }) {
  const W = mm(width); const H = mm(height); const fw = mm(FRAME_FACE);
  const D = mm(depth); const halfW = W / 2;
  const archRise = W * Math.sqrt(3) / 2;
  const straightWall = Math.max(H - archRise, mm(50));
  const springY = -H / 2 + straightWall;
  const segs = 48;
  const iHalfW = halfW - fw; const Ri = W - fw; const iBottom = -H / 2 + fw;

  function archYAtX(x) {
    if (x >= 0) { const dx = x + halfW; const sq = Ri*Ri - dx*dx; return sq > 0 ? springY + Math.sqrt(sq) : springY; }
    else { const dx = x - halfW; const sq = Ri*Ri - dx*dx; return sq > 0 ? springY + Math.sqrt(sq) : springY; }
  }

  const { frameGeo, innerPts } = useMemo(() => {
    const rightArc = arcPoints(-halfW, springY, W, 0, Math.PI / 3, segs);
    const leftArc = arcPoints(halfW, springY, W, 2 * Math.PI / 3, Math.PI, segs);
    const outer = [[-halfW, -H/2], [halfW, -H/2], [halfW, springY], ...rightArc, ...leftArc, [-halfW, springY]];
    const iRightArc = arcPoints(-halfW, springY, Ri, 0, Math.PI / 3, segs);
    const iLeftArc = arcPoints(halfW, springY, Ri, 2 * Math.PI / 3, Math.PI, segs);
    const inner = [[-iHalfW, iBottom], [iHalfW, iBottom], [iHalfW, springY], ...iRightArc, ...iLeftArc, [-iHalfW, springY]];
    return { frameGeo: makeFrameGeo(outer, inner, D), innerPts: inner };
  }, [W, H, D, halfW, springY, iHalfW, Ri, iBottom]);

  const bars = useMemo(() => {
    if (gothicBars !== 'patternA') return [];
    const result = [];
    // Horizontal bar at springing line
    result.push({ type: 'h', x: 0, y: springY, len: iHalfW * 2 });
    // 2 vertical bars at 1/3 and 2/3
    const x1 = -iHalfW + (iHalfW * 2) / 3;
    const x2 = -iHalfW + (iHalfW * 2) * 2 / 3;
    for (const x of [x1, x2]) {
      const topY = archYAtX(x) - BAR_W / 2;
      const barH = topY - iBottom;
      if (barH > 0) result.push({ type: 'v', x: x, y: iBottom + barH / 2, len: barH });
    }
    return result;
  }, [gothicBars, iHalfW, iBottom, springY]);

  return (
    <group>
      <mesh geometry={frameGeo} castShadow receiveShadow><primitive object={mat} attach="material" /></mesh>
      <CurvedGlass innerPts={innerPts} glassMat={glassMat} spacerColor={spacerColor} />
      {bars.length > 0 && <FixBars barItems={bars} matExt={mat} matInt={mat} />}
    </group>
  );
}

/* ═══ SEMI-CIRCLE ═══ */
function SemiCircleFrame({ width, height, depth, mat, glassMat, spacerColor, hBars = 0, vBars = 0 }) {
  const W = mm(width); const H = mm(height); const fw = mm(FRAME_FACE);
  const D = mm(depth); const halfW = W / 2;
  const springY = -H / 2 + Math.max(H - halfW, mm(50));
  const iHalfW = halfW - fw;
  const iBottom = -H / 2 + fw;
  const segs = 48;

  const { frameGeo, innerPts } = useMemo(() => {
    const outerArc = arcPoints(0, springY, halfW, 0, Math.PI, segs);
    const outer = [[-halfW, -H/2], [halfW, -H/2], [halfW, springY], ...outerArc, [-halfW, springY]];
    const innerArc = arcPoints(0, springY, iHalfW, 0, Math.PI, segs);
    const inner = [[-iHalfW, iBottom], [iHalfW, iBottom], [iHalfW, springY], ...innerArc, [-iHalfW, springY]];
    return { frameGeo: makeFrameGeo(outer, inner, D), innerPts: inner };
  }, [W, H, D, halfW, springY, iHalfW, iBottom]);

  const bars = useMemo(() => {
    const items = [];
    const glassW = iHalfW * 2;
    const glassH = springY - iBottom;
    for (let i = 1; i <= (hBars||0); i++) items.push({ type:'h', x:0, y: iBottom + (glassH/(hBars+1))*i, len: glassW });
    for (let i = 1; i <= (vBars||0); i++) items.push({ type:'v', x: -iHalfW + (glassW/(vBars+1))*i, y: iBottom + glassH/2, len: glassH });
    return items;
  }, [hBars, vBars, iHalfW, iBottom, springY]);

  return (
    <group>
      <mesh geometry={frameGeo} castShadow receiveShadow><primitive object={mat} attach="material" /></mesh>
      <CurvedGlass innerPts={innerPts} glassMat={glassMat} spacerColor={spacerColor} />
      {bars.length > 0 && <FixBars barItems={bars} matExt={mat} matInt={mat} />}
    </group>
  );
}

/* ═══ SEGMENTAL ═══ */
function SegmentalFrame({ width, height, depth, mat, glassMat, spacerColor, customRise = 0, hBars = 0, vBars = 0 }) {
  const W = mm(width); const H = mm(height); const fw = mm(FRAME_FACE);
  const D = mm(depth); const halfW = W / 2;
  const rise = customRise > 0 ? mm(customRise) : halfW * 0.4;
  const R = (rise*rise + halfW*halfW) / (2*rise);
  const cy = -H/2 + (H - rise) - (R - rise);
  const springY = -H/2 + (H - rise);
  const startAngle = Math.asin(Math.min(halfW / R, 1));
  const iHalfW = halfW - fw;
  const iBottom = -H/2 + fw;
  const segs = 48;

  const { frameGeo, innerPts } = useMemo(() => {
    const topArc = arcPoints(0, cy, R, Math.PI/2 - startAngle, Math.PI/2 + startAngle, segs);
    const outer = [[-halfW, -H/2], [halfW, -H/2], [halfW, springY], ...topArc, [-halfW, springY]];
    const iRise = Math.max(rise - fw, mm(10));
    const iR = (iRise*iRise + iHalfW*iHalfW) / (2*iRise);
    const iCY = springY - (iR - iRise);
    const iAngle = Math.asin(Math.min(iHalfW / iR, 1));
    const innerArc = arcPoints(0, iCY, iR, Math.PI/2 - iAngle, Math.PI/2 + iAngle, segs);
    const inner = [[-iHalfW, iBottom], [iHalfW, iBottom], [iHalfW, springY], ...innerArc, [-iHalfW, springY]];
    return { frameGeo: makeFrameGeo(outer, inner, D), innerPts: inner };
  }, [W, H, D, halfW, springY, R, cy, startAngle, rise, iHalfW, iBottom]);

  const bars = useMemo(() => {
    const items = [];
    const glassW = iHalfW * 2;
    const glassH = springY - iBottom;
    for (let i = 1; i <= (hBars||0); i++) items.push({ type:'h', x:0, y: iBottom + (glassH/(hBars+1))*i, len: glassW });
    for (let i = 1; i <= (vBars||0); i++) items.push({ type:'v', x: -iHalfW + (glassW/(vBars+1))*i, y: iBottom + glassH/2, len: glassH });
    return items;
  }, [hBars, vBars, iHalfW, iBottom, springY]);

  return (
    <group>
      <mesh geometry={frameGeo} castShadow receiveShadow><primitive object={mat} attach="material" /></mesh>
      <CurvedGlass innerPts={innerPts} glassMat={glassMat} spacerColor={spacerColor} />
      {bars.length > 0 && <FixBars barItems={bars} matExt={mat} matInt={mat} />}
    </group>
  );
}

/* ═══ ELLIPTICAL ═══ */
function EllipticalFrame({ width, height, depth, mat, glassMat, spacerColor, customRise = 0, hBars = 0, vBars = 0 }) {
  const W = mm(width); const H = mm(height); const fw = mm(FRAME_FACE);
  const D = mm(depth); const halfW = W / 2;
  const rise = customRise > 0 ? mm(customRise) : halfW * 0.65;
  const springY = -H/2 + Math.max(H - rise, mm(50));
  const iHalfW = halfW - fw;
  const iBottom = -H/2 + fw;
  const segs = 48;

  function ellipseArc(a, b, cY, segments) {
    const pts = [];
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI;
      pts.push([a * Math.cos(angle), cY + b * Math.sin(angle)]);
    }
    return pts;
  }

  const { frameGeo, innerPts } = useMemo(() => {
    const outerArc = ellipseArc(halfW, rise, springY, segs);
    const outer = [[-halfW, -H/2], [halfW, -H/2], [halfW, springY], ...outerArc, [-halfW, springY]];
    const iRise = Math.max(rise - fw, mm(10));
    const innerArc = ellipseArc(iHalfW, iRise, springY, segs);
    const inner = [[-iHalfW, iBottom], [iHalfW, iBottom], [iHalfW, springY], ...innerArc, [-iHalfW, springY]];
    return { frameGeo: makeFrameGeo(outer, inner, D), innerPts: inner };
  }, [W, H, D, halfW, rise, springY, iHalfW, iBottom]);

  const bars = useMemo(() => {
    const items = [];
    const glassW = iHalfW * 2;
    const glassH = springY - iBottom;
    for (let i = 1; i <= (hBars||0); i++) items.push({ type:'h', x:0, y: iBottom + (glassH/(hBars+1))*i, len: glassW });
    for (let i = 1; i <= (vBars||0); i++) items.push({ type:'v', x: -iHalfW + (glassW/(vBars+1))*i, y: iBottom + glassH/2, len: glassH });
    return items;
  }, [hBars, vBars, iHalfW, iBottom, springY]);

  return (
    <group>
      <mesh geometry={frameGeo} castShadow receiveShadow><primitive object={mat} attach="material" /></mesh>
      <CurvedGlass innerPts={innerPts} glassMat={glassMat} spacerColor={spacerColor} />
      {bars.length > 0 && <FixBars barItems={bars} matExt={mat} matInt={mat} />}
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
  if (fixShape === 'circle') shapeNode = <CircleFrame diameter={width} depth={depth} mat={extMat} glassMat={glassMat} spacerColor={spacerColor} />;
  else if (fixShape === 'gothic-arch') shapeNode = <GothicArchFrame width={width} height={effectiveH} depth={depth} mat={extMat} glassMat={glassMat} spacerColor={spacerColor} gothicBars={fixGothicBars} />;
  else if (fixShape === 'semi-circle') shapeNode = <SemiCircleFrame width={width} height={effectiveH} depth={depth} mat={extMat} glassMat={glassMat} spacerColor={spacerColor} hBars={hBars} vBars={vBars} />;
  else if (fixShape === 'segmental-arch') shapeNode = <SegmentalFrame width={width} height={effectiveH} depth={depth} mat={extMat} glassMat={glassMat} spacerColor={spacerColor} customRise={fixArchRise} hBars={hBars} vBars={vBars} />;
  else if (fixShape === 'elliptical-arch') shapeNode = <EllipticalFrame width={width} height={effectiveH} depth={depth} mat={extMat} glassMat={glassMat} spacerColor={spacerColor} customRise={fixArchRise} hBars={hBars} vBars={vBars} />;
  else shapeNode = <CasementPanel width={width} height={height} hingeType="fixed" opening={0} material={extMat} materialInt={intMat} spacerColor={spacerColor} glassFinish={glassFinish} hBars={hBars} vBars={vBars} ironmongery="brass" position={[0,0,0]} />;

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