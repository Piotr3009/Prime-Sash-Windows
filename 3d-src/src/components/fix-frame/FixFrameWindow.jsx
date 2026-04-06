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

// ─── Bead dimensions (from CasementPanel) ───
const EBW = mm(9);    // ext chamfer width (inward from glass edge)
const EBD = mm(15);   // ext chamfer depth (along Z)
const IBW = mm(18);   // int ovolo max width
const IBD = mm(14);   // int ovolo depth (along Z)
const OVOLO_STEPS = 64; // enough steps for smooth curve

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
  const halfD = depth / 2;
  // EXT half: z = 0 → halfD (front side)
  const ext = new THREE.ExtrudeGeometry(shape, { depth: halfD, bevelEnabled: false });
  ext.computeVertexNormals();
  // INT half: z = -halfD → 0 (back side)
  const int = new THREE.ExtrudeGeometry(shape, { depth: halfD, bevelEnabled: false });
  int.translate(0, 0, -halfD);
  int.computeVertexNormals();
  return { ext, int };
}

/* ─── Frame mesh with dual-color support (split geometry) ─── */
function FrameMesh({ geometry, matExt, matInt }) {
  return (
    <group>
      <mesh geometry={geometry.ext} castShadow receiveShadow><primitive object={matExt} attach="material" /></mesh>
      <mesh geometry={geometry.int} castShadow receiveShadow><primitive object={matInt || matExt} attach="material" /></mesh>
    </group>
  );
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
function FixBars({ barItems, matExt, matInt, spacerColor = 'silver' }) {
  const trapV = useTrapV();
  const trapH = useTrapH();
  const ovoloV = useOvoloV();
  const ovoloH = useOvoloH();

  const spacerMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: spacerColor === 'white' ? '#f8f8f8' : spacerColor === 'black' ? '#1a1a1a' : '#a0a4a8',
    metalness: 0.6, roughness: 0.4
  }), [spacerColor]);

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
  const STRIP = mm(1);

  const glassGeo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(innerPts[0][0], innerPts[0][1]);
    for (let i = 1; i < innerPts.length; i++) shape.lineTo(innerPts[i][0], innerPts[i][1]);
    shape.closePath();
    return new THREE.ShapeGeometry(shape, 1);
  }, [innerPts]);

  // Ring spacer: innerPts as outer, shrunk 1mm as inner hole, extruded 24mm
  const spacerGeo = useMemo(() => {
    // Centroid for simple inward offset
    let cx = 0, cy = 0;
    for (const p of innerPts) { cx += p[0]; cy += p[1]; }
    cx /= innerPts.length; cy /= innerPts.length;

    const outer = new THREE.Shape();
    outer.moveTo(innerPts[0][0], innerPts[0][1]);
    for (let i = 1; i < innerPts.length; i++) outer.lineTo(innerPts[i][0], innerPts[i][1]);
    outer.closePath();

    const hole = new THREE.Path();
    for (let i = 0; i < innerPts.length; i++) {
      const dx = innerPts[i][0] - cx, dy = innerPts[i][1] - cy;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const x = innerPts[i][0] - (dx / d) * STRIP;
      const y = innerPts[i][1] - (dy / d) * STRIP;
      if (i === 0) hole.moveTo(x, y); else hole.lineTo(x, y);
    }
    hole.closePath();
    outer.holes.push(hole);

    const g = new THREE.ExtrudeGeometry(outer, { depth: GU, bevelEnabled: false });
    g.translate(0, 0, -GU / 2);
    g.computeVertexNormals();
    return g;
  }, [innerPts]);

  const spacerMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: spacerHex, metalness: 0.6, roughness: 0.4
  }), [spacerHex]);

  return (
    <group>
      <mesh geometry={glassGeo} castShadow={false} receiveShadow>
        <primitive object={glassMat} attach="material" />
      </mesh>
      <mesh geometry={spacerGeo} castShadow receiveShadow>
        <primitive object={spacerMat} attach="material" />
      </mesh>
    </group>
  );
}

/* ═══ CONTOUR BEADS — chamfer (EXT) + ovolo (INT) for any contour shape ═══ */
function ContourBeads({ innerPts, D, matExt, matInt }) {
  const halfD = D / 2;
  const STEPS = 64;
  const CHAMFER_TOP = mm(1);

  // Centroid for inward offset direction (same approach as CurvedGlass spacer)
  const centroid = useMemo(() => {
    let cx = 0, cy = 0;
    for (const p of innerPts) { cx += p[0]; cy += p[1]; }
    return [cx / innerPts.length, cy / innerPts.length];
  }, [innerPts]);

  // Build strip shape: outer = innerPts, hole = innerPts offset inward by `width`
  const makeStrip = (width) => {
    const shape = new THREE.Shape();
    shape.moveTo(innerPts[0][0], innerPts[0][1]);
    for (let i = 1; i < innerPts.length; i++) shape.lineTo(innerPts[i][0], innerPts[i][1]);
    shape.closePath();

    const hole = new THREE.Path();
    for (let i = 0; i < innerPts.length; i++) {
      const dx = innerPts[i][0] - centroid[0], dy = innerPts[i][1] - centroid[1];
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const x = innerPts[i][0] - (dx / d) * width;
      const y = innerPts[i][1] - (dy / d) * width;
      if (i === 0) hole.moveTo(x, y); else hole.lineTo(x, y);
    }
    hole.closePath();
    shape.holes.push(hole);
    return shape;
  };

  // Chamfer layers (EXT side, z > 0)
  const chamferLayers = useMemo(() => {
    const layers = [];
    const layerD = EBD / STEPS;
    for (let i = 0; i < STEPS; i++) {
      const t = i / (STEPS - 1);
      const w = CHAMFER_TOP * (1 - t) + EBW * t;
      const s = makeStrip(w);
      const g = new THREE.ExtrudeGeometry(s, { depth: layerD, bevelEnabled: false });
      g.translate(0, 0, halfD - (i + 1) * layerD);
      g.computeVertexNormals();
      layers.push(g);
    }
    return layers;
  }, [innerPts, centroid, halfD]);

  // Ovolo layers (INT side, z < 0)
  const ovoloLayers = useMemo(() => {
    const layers = [];
    const layerD = IBD / STEPS;
    for (let i = 0; i < STEPS; i++) {
      const t = (i + 1) / STEPS;
      const w = EBW * Math.sin(t * Math.PI / 2);
      const s = makeStrip(w);
      const g = new THREE.ExtrudeGeometry(s, { depth: layerD, bevelEnabled: false });
      g.translate(0, 0, -halfD + i * layerD);
      g.computeVertexNormals();
      layers.push(g);
    }
    return layers;
  }, [innerPts, centroid, halfD]);

  return (
    <group>
      {chamferLayers.map((g, i) => (
        <mesh key={'ch' + i} geometry={g} castShadow receiveShadow>
          <primitive object={matExt} attach="material" />
        </mesh>
      ))}
      {ovoloLayers.map((g, i) => (
        <mesh key={'ov' + i} geometry={g} castShadow receiveShadow>
          <primitive object={matInt} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

/* ═══ CIRCLE ═══ */
function CircleFrame({ diameter, depth, mat, matInt, glassMat, spacerColor, circleBarPattern = 'none', circleBarOffset = 200, hBars = 0, vBars = 0 }) {
  const R = mm(diameter) / 2;
  const fw = mm(FRAME_FACE);
  const rInner = Math.max(R - fw, mm(20));
  const D = mm(depth);
  const segs = 64;
  const barR = rInner - mm(circleBarOffset);
  const showBars = circleBarPattern === 'sunburst' && barR > mm(30);
  const mi = matInt || mat;

  const { frameGeo, innerPts } = useMemo(() => {
    const outer = arcPoints(0, 0, R, 0, Math.PI * 2, segs);
    const inner = arcPoints(0, 0, rInner, 0, Math.PI * 2, segs);
    return { frameGeo: makeFrameGeo(outer, inner, D), innerPts: inner };
  }, [R, rInner, D]);

  // Helper: make annulus ring
  function makeRing(outerR, innerR, d) {
    const shape = new THREE.Shape();
    const oPts = arcPoints(0, 0, outerR, 0, Math.PI * 2, segs);
    shape.moveTo(oPts[0][0], oPts[0][1]);
    for (let i = 1; i < oPts.length; i++) shape.lineTo(oPts[i][0], oPts[i][1]);
    shape.closePath();
    const hole = new THREE.Path();
    const iPts = arcPoints(0, 0, innerR, 0, Math.PI * 2, segs);
    hole.moveTo(iPts[0][0], iPts[0][1]);
    for (let i = 1; i < iPts.length; i++) hole.lineTo(iPts[i][0], iPts[i][1]);
    hole.closePath();
    shape.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
    g.translate(0, 0, -d / 2);
    g.computeVertexNormals();
    return g;
  }

  const halfD = D / 2;

  // ── FRAME BEADS (always visible) ──
  // Chamfer: stepped trapezoid rings on EXT face — like bar trapezoid profile
  // Wide (9mm) at frame face, narrow (1mm) at glass edge
  const CHAMFER_STEPS = 64;
  const CHAMFER_TOP = mm(1); // narrow end width
  const chamferLayers = useMemo(() => {
    const layers = [];
    const layerD = EBD / CHAMFER_STEPS;
    for (let i = 0; i < CHAMFER_STEPS; i++) {
      const t = i / (CHAMFER_STEPS - 1); // 0 = at frame face, 1 = at glass edge
      const w = CHAMFER_TOP * (1 - t) + EBW * t; // 1mm at frame face → 9mm at glass edge
      layers.push({
        geo: makeRing(rInner, rInner - w, layerD),
        z: halfD - (i + 0.5) * layerD,
      });
    }
    return layers;
  }, [rInner, halfD]);

  // Ovolo: 32 stepped rings on INT face, quarter-circle curve
  const ovoloLayers = useMemo(() => {
    const layers = [];
    const layerD = IBD / OVOLO_STEPS;
    for (let i = 0; i < OVOLO_STEPS; i++) {
      const t = (i + 1) / OVOLO_STEPS;
      const w = EBW * Math.sin(t * Math.PI / 2);
      layers.push({
        geo: makeRing(rInner, rInner - w, layerD),
        z: -halfD + (i + 0.5) * layerD,
      });
    }
    return layers;
  }, [rInner, halfD]);

  // Ring bar: trapezoid EXT + ovolo INT + spacer
  const ringGeos = useMemo(() => {
    if (!showBars) return null;
    const N = 6;
    const layerD = BAR_H / N;
    // EXT trapezoid layers
    const ext = [];
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const hw = (BAR_W / 2) * (1 - t) + (BAR_TOP / 2) * t;
      ext.push({ geo: makeRing(barR + hw, barR - hw, layerD), z: glassHalf + (i + 0.5) * layerD });
    }
    // INT ovolo layers
    const int = [];
    for (let i = 0; i < N; i++) {
      const t = (i + 1) / N;
      const hw = Math.max((BAR_W / 2) * Math.cos(t * Math.PI / 2), BAR_TOP / 2);
      int.push({ geo: makeRing(barR + hw, barR - hw, layerD), z: -(glassHalf + (i + 0.5) * layerD) });
    }
    // Spacer
    const spacer = makeRing(barR + SPACER_BAR_W / 2, barR - SPACER_BAR_W / 2, SPACER_DEPTH);
    return { ext, int, spacer };
  }, [showBars, barR]);

  // Spoke profiles (reuse bar profile shapes)
  const trapV = useTrapV();
  const ovoloV = useOvoloV();

  // 6 spoke geometries
  const spokeGeos = useMemo(() => {
    if (!showBars) return null;
    const spokeLen = rInner - barR;
    const extG = new THREE.ExtrudeGeometry(trapV, { depth: spokeLen + mm(18), bevelEnabled: false });
    extG.rotateX(-Math.PI / 2); extG.translate(0, -(spokeLen + mm(18)) / 2, 0); extG.computeVertexNormals();
    const intG = new THREE.ExtrudeGeometry(ovoloV, { depth: spokeLen + mm(18), bevelEnabled: false, curveSegments: 32 });
    intG.rotateX(-Math.PI / 2); intG.translate(0, -(spokeLen + mm(18)) / 2, 0); intG.computeVertexNormals();
    return { ext: extG, int: intG, len: spokeLen };
  }, [showBars, rInner, barR, trapV, ovoloV]);

  const spacerBarMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: spacerColor === 'white' ? '#f8f8f8' : spacerColor === 'black' ? '#1a1a1a' : '#a0a4a8',
    metalness: 0.6, roughness: 0.4
  }), [spacerColor]);

  const spokeMidR = (barR + rInner) / 2;

  // Straight h/v bars (clipped to circle)
  const straightBars = useMemo(() => {
    const items = [];
    const diam = rInner * 2;
    // Horizontal bars: evenly spaced across full diameter
    for (let i = 1; i <= (hBars||0); i++) {
      const y = -rInner + (diam / (hBars + 1)) * i;
      const sq = rInner * rInner - y * y;
      if (sq > 0) items.push({ type:'h', x:0, y, len: 2 * Math.sqrt(sq) });
    }
    // Vertical bars: evenly spaced across full diameter
    for (let i = 1; i <= (vBars||0); i++) {
      const x = -rInner + (diam / (vBars + 1)) * i;
      const sq = rInner * rInner - x * x;
      if (sq > 0) {
        const halfH = Math.sqrt(sq) - BAR_W / 2;
        items.push({ type:'v', x, y: 0, len: halfH * 2 });
      }
    }
    return items;
  }, [hBars, vBars, rInner]);

  return (
    <group>
      <FrameMesh geometry={frameGeo} matExt={mat} matInt={matInt} />
      <CurvedGlass innerPts={innerPts} glassMat={glassMat} spacerColor={spacerColor} />
      {/* Frame beads — chamfer EXT + ovolo INT */}
      {chamferLayers.map((l, i) => (
        <mesh key={`ch${i}`} geometry={l.geo} position={[0, 0, l.z]} castShadow receiveShadow>
          <primitive object={mat} attach="material" />
        </mesh>
      ))}
      {ovoloLayers.map((l, i) => (
        <mesh key={`ov${i}`} geometry={l.geo} position={[0, 0, l.z]} castShadow receiveShadow>
          <primitive object={mi} attach="material" />
        </mesh>
      ))}
      {/* Sunburst bars */}
      {showBars && ringGeos && spokeGeos && (
        <group>
          {/* Ring EXT trapezoid */}
          {ringGeos.ext.map((l, i) => (
            <mesh key={`re${i}`} geometry={l.geo} position={[0, 0, l.z]} castShadow receiveShadow>
              <primitive object={mat} attach="material" />
            </mesh>
          ))}
          {/* Ring INT ovolo */}
          {ringGeos.int.map((l, i) => (
            <mesh key={`ri${i}`} geometry={l.geo} position={[0, 0, l.z]} castShadow receiveShadow>
              <primitive object={mi} attach="material" />
            </mesh>
          ))}
          {/* Ring spacer */}
          <mesh geometry={ringGeos.spacer} castShadow receiveShadow>
            <primitive object={spacerBarMat} attach="material" />
          </mesh>
          {/* 6 spokes */}
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const angle = (i / 6) * Math.PI * 2;
            return (
              <group key={`sp${i}`} position={[spokeMidR * Math.cos(angle), spokeMidR * Math.sin(angle), 0]} rotation={[0, 0, angle - Math.PI / 2]}>
                {/* EXT trapezoid */}
                <mesh geometry={spokeGeos.ext} position={[0, 0, glassHalf]} rotation={[Math.PI, 0, 0]} castShadow receiveShadow>
                  <primitive object={mat} attach="material" />
                </mesh>
                {/* INT ovolo */}
                <mesh geometry={spokeGeos.int} position={[0, 0, -glassHalf]} castShadow receiveShadow>
                  <primitive object={mi} attach="material" />
                </mesh>
                {/* Spacer */}
                <mesh castShadow receiveShadow>
                  <boxGeometry args={[SPACER_BAR_W, spokeGeos.len, SPACER_DEPTH]} />
                  <primitive object={spacerBarMat} attach="material" />
                </mesh>
              </group>
            );
          })}
        </group>
      )}
      {/* Straight h/v bars */}
      {straightBars.length > 0 && <FixBars barItems={straightBars} matExt={mat} matInt={mi} spacerColor={spacerColor} />}
    </group>
  );
}

/* ═══ GOTHIC ARCH ═══ */
function GothicArchFrame({ width, height, depth, mat, matInt, glassMat, spacerColor, gothicBars = 'none', hBars = 0, vBars = 0 }) {
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
    const result = [];
    // Pattern A bars
    if (gothicBars === 'patternA') {
      result.push({ type: 'h', x: 0, y: springY, len: iHalfW * 2 });
      const x1 = -iHalfW + (iHalfW * 2) / 3;
      const x2 = -iHalfW + (iHalfW * 2) * 2 / 3;
      for (const x of [x1, x2]) {
        const topY = archYAtX(x) - BAR_W / 2;
        const barH = topY - iBottom;
        if (barH > 0) result.push({ type: 'v', x: x, y: iBottom + barH / 2, len: barH });
      }
      const centerH = springY - iBottom;
      if (centerH > 0) result.push({ type: 'v', x: 0, y: iBottom + centerH / 2, len: centerH });
    }
    // Standard h/v bars (independent of patternA)
    if ((hBars||0) > 0 || (vBars||0) > 0) {
      const glassW = iHalfW * 2;
      const topY = archYAtX(0);
      const fullH = topY - iBottom;
      for (let i = 1; i <= (hBars||0); i++) {
        const y = iBottom + (fullH / (hBars + 1)) * i;
        let len = glassW;
        if (y > springY) {
          // Clip to gothic arch width at y
          const leftY = archYAtX(-iHalfW * 0.99);
          const rightY = archYAtX(iHalfW * 0.99);
          // Find X where arch is at Y by binary search (arch is not simple circle)
          let lo = 0, hi = iHalfW;
          for (let s = 0; s < 20; s++) {
            const mid = (lo + hi) / 2;
            if (archYAtX(mid) > y) lo = mid; else hi = mid;
          }
          len = 2 * lo;
          if (len < mm(20)) continue;
        }
        result.push({ type:'h', x:0, y, len });
      }
      for (let i = 1; i <= (vBars||0); i++) {
        const x = -iHalfW + (glassW / (vBars + 1)) * i;
        const barTop = archYAtX(x) - BAR_W / 2;
        const barH = barTop - iBottom;
        if (barH > 0) result.push({ type:'v', x, y: iBottom + barH / 2, len: barH });
      }
    }
    return result;
  }, [gothicBars, hBars, vBars, iHalfW, iBottom, springY]);

  // Curved bar: bezier from (0, springY) curving up toward peak, then to right bar top
  const curvedBarShape = useMemo(() => {
    if (gothicBars !== 'patternA') return null;
    const x2 = -iHalfW + (iHalfW * 2) * 2 / 3;
    const topY = archYAtX(x2) - BAR_W / 2;
    const peakY = archYAtX(0);
    const cpX = x2 * 0.35;
    const cpY = peakY - mm(30);
    const N = 32;
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const x = (1-t)*(1-t)*0 + 2*(1-t)*t*cpX + t*t*x2;
      const y = (1-t)*(1-t)*springY + 2*(1-t)*t*cpY + t*t*topY;
      pts.push([x, y]);
    }
    const leftEdge = [];
    const rightEdge = [];
    for (let i = 0; i < pts.length; i++) {
      const prev = pts[Math.max(0, i-1)];
      const next = pts[Math.min(pts.length-1, i+1)];
      const dx = next[0] - prev[0];
      const dy = next[1] - prev[1];
      const len = Math.sqrt(dx*dx + dy*dy) || 1;
      const nx = -dy / len * (BAR_W / 2);
      const ny = dx / len * (BAR_W / 2);
      leftEdge.push([pts[i][0] + nx, pts[i][1] + ny]);
      rightEdge.push([pts[i][0] - nx, pts[i][1] - ny]);
    }
    const shape = new THREE.Shape();
    shape.moveTo(leftEdge[0][0], leftEdge[0][1]);
    for (let i = 1; i < leftEdge.length; i++) shape.lineTo(leftEdge[i][0], leftEdge[i][1]);
    for (let i = rightEdge.length - 1; i >= 0; i--) shape.lineTo(rightEdge[i][0], rightEdge[i][1]);
    shape.closePath();
    return shape;
  }, [gothicBars, iHalfW, springY]);

  const curvedBarExt = useMemo(() => {
    if (!curvedBarShape) return null;
    const g = new THREE.ExtrudeGeometry(curvedBarShape, { depth: BAR_H, bevelEnabled: false });
    g.translate(0, 0, -BAR_H / 2); g.computeVertexNormals(); return g;
  }, [curvedBarShape]);

  const curvedBarSpacer = useMemo(() => {
    if (!curvedBarShape) return null;
    const g = new THREE.ExtrudeGeometry(curvedBarShape, { depth: SPACER_DEPTH, bevelEnabled: false });
    g.translate(0, 0, -SPACER_DEPTH / 2); g.computeVertexNormals(); return g;
  }, [curvedBarShape]);

  // ── Intersecting pattern: true gothic arcs with trap/ovolo beading ──
  const CURVE_STEPS = 64;
  const intersectingData = useMemo(() => {
    if (gothicBars !== 'intersecting') return null;

    const widthMm = iHalfW * 2 / mm(1);
    const nMullions = Math.max(2, Math.min(4, Math.round(widthMm / 450)));
    const mullionXs = [];
    for (let i = 1; i <= nMullions; i++) mullionXs.push(-iHalfW + (iHalfW * 2 / (nMullions + 1)) * i);

    // Straight mullions: bottom to springY
    const straightBars = mullionXs.map(x => ({
      type: 'v', x, y: iBottom + (springY - iBottom) / 2, len: springY - iBottom
    }));

    // Gothic arch centers
    const cRX = -halfW, cLX = halfW, cY = springY;

    // Generate arc centerline points, clipped to inner frame boundary
    function gothicArcPts(cx, mulX) {
      const r = Math.abs(mulX - cx);
      if (r < mm(30)) return [];
      const startAngle = Math.acos(Math.min(1, Math.max(-1, (mulX - cx) / r)));
      const goingRight = cx < 0;
      const pts = [];
      for (let i = 0; i <= 48; i++) {
        const t = i / 48;
        const angle = goingRight ? startAngle + t * (Math.PI / 2) : startAngle - t * (Math.PI / 2);
        const px = cx + r * Math.cos(angle);
        const py = cY + r * Math.sin(angle);
        if (py < springY - mm(2)) continue;
        // Stop at frame boundary (arch curve)
        const limit = archYAtX(Math.max(-iHalfW, Math.min(iHalfW, px)));
        if (py > limit) break;
        if (Math.abs(px) > iHalfW) break;
        pts.push([px, py]);
      }
      return pts;
    }

    // Build strip shape from centerline with given halfWidth
    function ptsToStrip(pts, hw) {
      if (pts.length < 3) return null;
      const leftEdge = [], rightEdge = [];
      for (let i = 0; i < pts.length; i++) {
        const prev = pts[Math.max(0, i-1)];
        const next = pts[Math.min(pts.length-1, i+1)];
        const dx = next[0] - prev[0], dy = next[1] - prev[1];
        const len = Math.sqrt(dx*dx + dy*dy) || 1;
        const nx = -dy / len * hw, ny = dx / len * hw;
        leftEdge.push([pts[i][0] + nx, pts[i][1] + ny]);
        rightEdge.push([pts[i][0] - nx, pts[i][1] - ny]);
      }
      const shape = new THREE.Shape();
      shape.moveTo(leftEdge[0][0], leftEdge[0][1]);
      for (let i = 1; i < leftEdge.length; i++) shape.lineTo(leftEdge[i][0], leftEdge[i][1]);
      for (let i = rightEdge.length - 1; i >= 0; i--) shape.lineTo(rightEdge[i][0], rightEdge[i][1]);
      shape.closePath();
      return shape;
    }

    // Collect all arc centerlines (only from mullions, not frame edges)
    const arcCenterlines = [];
    for (const x of mullionXs) {
      const rPts = gothicArcPts(cRX, x);
      if (rPts.length >= 3) arcCenterlines.push(rPts);
      const lPts = gothicArcPts(cLX, x);
      if (lPts.length >= 3) arcCenterlines.push(lPts);
    }

    // For each arc centerline, create 64-layer trap EXT + 64-layer ovolo INT + spacer
    const layerD_ext = BAR_H / CURVE_STEPS;
    const layerD_int = BAR_H / CURVE_STEPS;
    const curves = arcCenterlines.map(pts => {
      // EXT trapezoid layers
      const extLayers = [];
      for (let i = 0; i < CURVE_STEPS; i++) {
        const t = i / (CURVE_STEPS - 1);
        const hw = (BAR_W / 2) * (1 - t) + (BAR_TOP / 2) * t;
        const s = ptsToStrip(pts, hw);
        if (!s) continue;
        const g = new THREE.ExtrudeGeometry(s, { depth: layerD_ext, bevelEnabled: false });
        g.translate(0, 0, glassHalf + i * layerD_ext);
        g.computeVertexNormals();
        extLayers.push(g);
      }
      // INT ovolo layers
      const intLayers = [];
      for (let i = 0; i < CURVE_STEPS; i++) {
        const t = (i + 1) / CURVE_STEPS;
        const hw = Math.max((BAR_W / 2) * Math.cos(t * Math.PI / 2), BAR_TOP / 2);
        const s = ptsToStrip(pts, hw);
        if (!s) continue;
        const g = new THREE.ExtrudeGeometry(s, { depth: layerD_int, bevelEnabled: false });
        g.translate(0, 0, -(glassHalf + (i + 1) * layerD_int));
        g.computeVertexNormals();
        intLayers.push(g);
      }
      // Spacer
      const ss = ptsToStrip(pts, SPACER_BAR_W / 2);
      let spacerGeo = null;
      if (ss) {
        spacerGeo = new THREE.ExtrudeGeometry(ss, { depth: SPACER_DEPTH, bevelEnabled: false });
        spacerGeo.translate(0, 0, -SPACER_DEPTH / 2);
        spacerGeo.computeVertexNormals();
      }
      return { extLayers, intLayers, spacerGeo };
    });

    return { straightBars, curves };
  }, [gothicBars, halfW, iHalfW, iBottom, springY, Ri]);

  const spacerBarMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: spacerColor === 'white' ? '#f8f8f8' : spacerColor === 'black' ? '#1a1a1a' : '#a0a4a8',
    metalness: 0.6, roughness: 0.4
  }), [spacerColor]);

  return (
    <group>
      <FrameMesh geometry={frameGeo} matExt={mat} matInt={matInt} />
      <ContourBeads innerPts={innerPts} D={D} matExt={mat} matInt={matInt || mat} spacerColor={spacerColor} />
      <CurvedGlass innerPts={innerPts} glassMat={glassMat} spacerColor={spacerColor} />
      {bars.length > 0 && <FixBars barItems={bars} matExt={mat} matInt={matInt || mat} spacerColor={spacerColor} />}
      {curvedBarExt && (
        <group>
          {/* EXT face */}
          <mesh geometry={curvedBarExt} position={[0, 0, glassHalf + BAR_H / 2]} castShadow receiveShadow>
            <primitive object={mat} attach="material" />
          </mesh>
          {/* INT face */}
          <mesh geometry={curvedBarExt} position={[0, 0, -(glassHalf + BAR_H / 2)]} castShadow receiveShadow>
            <primitive object={mat} attach="material" />
          </mesh>
          {/* Spacer between panes */}
          <mesh geometry={curvedBarSpacer} castShadow receiveShadow>
            <primitive object={spacerBarMat} attach="material" />
          </mesh>
        </group>
      )}
      {/* Intersecting pattern */}
      {intersectingData && (
        <group>
          {intersectingData.straightBars.length > 0 && <FixBars barItems={intersectingData.straightBars} matExt={mat} matInt={matInt || mat} spacerColor={spacerColor} />}
          {intersectingData.curves.map((curve, ci) => (
            <group key={'ic' + ci}>
              {curve.extLayers.map((g, i) => (
                <mesh key={'ce' + i} geometry={g} castShadow receiveShadow><primitive object={mat} attach="material" /></mesh>
              ))}
              {curve.intLayers.map((g, i) => (
                <mesh key={'ci' + i} geometry={g} castShadow receiveShadow><primitive object={matInt || mat} attach="material" /></mesh>
              ))}
              {curve.spacerGeo && <mesh geometry={curve.spacerGeo} castShadow receiveShadow><primitive object={spacerBarMat} attach="material" /></mesh>}
            </group>
          ))}
        </group>
      )}
    </group>
  );
}

/* ═══ SEMI-CIRCLE ═══ */
function SemiCircleFrame({ width, height, depth, mat, matInt, glassMat, spacerColor, hBars = 0, vBars = 0, semiBarPattern = 'none' }) {
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

  function semiArchY(x) {
    const sq = iHalfW * iHalfW - x * x;
    return sq > 0 ? springY + Math.sqrt(sq) : springY;
  }

  const isHub = semiBarPattern === 'half-hub' || semiBarPattern === 'hub-spoke' || semiBarPattern === 'double-hub-spoke' || semiBarPattern === 'triple-hub-spoke';

  // Spoke positions: calculated once, shared by bars and hubData
  const isHalf = semiBarPattern === 'half-hub';
  const isDouble = semiBarPattern === 'double-hub-spoke';
  const isTriple = semiBarPattern === 'triple-hub-spoke';
  const spokeCount = isTriple ? 8 : isDouble ? 6 : 4;
  const spokeAngles = useMemo(() => {
    if (!isHub) return [];
    const angles = [];
    for (let i = 0; i < spokeCount; i++) angles.push((i / (spokeCount - 1)) * Math.PI);
    return angles;
  }, [isHub, spokeCount]);

  const bars = useMemo(() => {
    const items = [];
    const glassW = iHalfW * 2;
    if (isHub) {
      const belowH = springY - iBottom;
      const hubR1 = iHalfW * 0.3;
      const hubR2 = (isDouble || isTriple) ? iHalfW * 0.6 : null;
      const hubR3 = isTriple ? iHalfW * 0.8 : null;
      if (isHalf) {
        // Half Hub: H bar at springing, no V bars
        items.push({ type: 'h', x: 0, y: springY, len: iHalfW * 2 });
      } else if (belowH > 0) {
        // Ring 1 endpoints: ±hubR1
        items.push({ type: 'v', x: -hubR1, y: iBottom + belowH / 2, len: belowH });
        items.push({ type: 'v', x: hubR1, y: iBottom + belowH / 2, len: belowH });
        // Ring 2 endpoints: ±hubR2 (double + triple)
        if (hubR2) {
          items.push({ type: 'v', x: -hubR2, y: iBottom + belowH / 2, len: belowH });
          items.push({ type: 'v', x: hubR2, y: iBottom + belowH / 2, len: belowH });
        }
        // Ring 3 endpoints: ±hubR3 (triple only)
        if (hubR3) {
          items.push({ type: 'v', x: -hubR3, y: iBottom + belowH / 2, len: belowH });
          items.push({ type: 'v', x: hubR3, y: iBottom + belowH / 2, len: belowH });
        }
      }
      // H bars: user can add below springing
      for (let i = 1; i <= (hBars || 0); i++) {
        const y = iBottom + (belowH / (hBars + 1)) * i;
        if (y < springY - mm(5)) items.push({ type: 'h', x: 0, y, len: glassW });
      }
    } else {
      const topY = semiArchY(0);
      const fullH = topY - iBottom;
      for (let i = 1; i <= (hBars || 0); i++) {
        const y = iBottom + (fullH / (hBars + 1)) * i;
        let len = glassW;
        if (y > springY) {
          const sq = iHalfW * iHalfW - (y - springY) * (y - springY);
          if (sq > 0) len = 2 * Math.sqrt(sq); else continue;
        }
        items.push({ type: 'h', x: 0, y, len });
      }
      for (let i = 1; i <= (vBars || 0); i++) {
        const x = -iHalfW + (glassW / (vBars + 1)) * i;
        const barTop = semiArchY(x) - BAR_W / 2;
        const barH = barTop - iBottom;
        if (barH > 0) items.push({ type: 'v', x, y: iBottom + barH / 2, len: barH });
      }
    }
    return items;
  }, [hBars, vBars, iHalfW, iBottom, springY, isHub, semiBarPattern, spokeAngles]);

  // ── Hub & Spoke ──

  const hubData = useMemo(() => {
    if (!isHub) return null;
    const hubR1 = iHalfW * 0.3;
    const hubR2 = (isDouble || isTriple) ? iHalfW * 0.6 : null;
    const hubR3 = isTriple ? iHalfW * 0.8 : null;

    // spokeAngles from shared calculation above

    // Half-ring as STRIP along semicircle path (same approach as Gothic intersecting)
    function semiArcPts(radius, nPts) {
      const pts = [];
      for (let i = 0; i <= nPts; i++) {
        const angle = (i / nPts) * Math.PI;
        pts.push([radius * Math.cos(angle), springY + radius * Math.sin(angle)]);
      }
      return pts;
    }

    function ptsToStrip(pts, hw) {
      if (pts.length < 3) return null;
      const leftEdge = [], rightEdge = [];
      for (let i = 0; i < pts.length; i++) {
        const prev = pts[Math.max(0, i - 1)];
        const next = pts[Math.min(pts.length - 1, i + 1)];
        const dx = next[0] - prev[0], dy = next[1] - prev[1];
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = -dy / len * hw, ny = dx / len * hw;
        leftEdge.push([pts[i][0] + nx, pts[i][1] + ny]);
        rightEdge.push([pts[i][0] - nx, pts[i][1] - ny]);
      }
      const shape = new THREE.Shape();
      shape.moveTo(leftEdge[0][0], leftEdge[0][1]);
      for (let i = 1; i < leftEdge.length; i++) shape.lineTo(leftEdge[i][0], leftEdge[i][1]);
      for (let i = rightEdge.length - 1; i >= 0; i--) shape.lineTo(rightEdge[i][0], rightEdge[i][1]);
      shape.closePath();
      return shape;
    }

    const RING_STEPS = 64;
    function buildRingLayers(hubR) {
      const centerline = semiArcPts(hubR, 48);
      const layerD = BAR_H / RING_STEPS;
      const extLayers = [];
      for (let i = 0; i < RING_STEPS; i++) {
        const t = i / (RING_STEPS - 1);
        const hw = (BAR_W / 2) * (1 - t) + (BAR_TOP / 2) * t;
        const s = ptsToStrip(centerline, hw);
        if (!s) continue;
        const g = new THREE.ExtrudeGeometry(s, { depth: layerD, bevelEnabled: false });
        g.translate(0, 0, glassHalf + i * layerD);
        g.computeVertexNormals();
        extLayers.push(g);
      }
      const intLayers = [];
      for (let i = 0; i < RING_STEPS; i++) {
        const t = (i + 1) / RING_STEPS;
        const hw = Math.max((BAR_W / 2) * Math.cos(t * Math.PI / 2), BAR_TOP / 2);
        const s = ptsToStrip(centerline, hw);
        if (!s) continue;
        const g = new THREE.ExtrudeGeometry(s, { depth: layerD, bevelEnabled: false });
        g.translate(0, 0, -(glassHalf + (i + 1) * layerD));
        g.computeVertexNormals();
        intLayers.push(g);
      }
      const ss = ptsToStrip(centerline, SPACER_BAR_W / 2);
      let spacerGeo = null;
      if (ss) {
        spacerGeo = new THREE.ExtrudeGeometry(ss, { depth: SPACER_DEPTH, bevelEnabled: false });
        spacerGeo.translate(0, 0, -SPACER_DEPTH / 2);
        spacerGeo.computeVertexNormals();
      }
      return { extLayers, intLayers, spacerGeo };
    }

    const ring1 = buildRingLayers(hubR1);
    const ring2 = (isDouble || isTriple) ? buildRingLayers(hubR2) : null;
    const ring3 = isTriple ? buildRingLayers(hubR3) : null;

    // Spoke profiles
    const trapV = new THREE.Shape();
    trapV.moveTo(0, -BAR_W / 2); trapV.lineTo(BAR_H, -BAR_TOP / 2);
    trapV.lineTo(BAR_H, BAR_TOP / 2); trapV.lineTo(0, BAR_W / 2); trapV.closePath();
    const ovoloV = new THREE.Shape();
    const drop = mm(2), sqH = mm(2);
    ovoloV.moveTo(0, -BAR_W / 2);
    ovoloV.quadraticCurveTo(BAR_H - drop - sqH, -BAR_W / 2, BAR_H - sqH, -BAR_TOP / 2);
    ovoloV.lineTo(BAR_H, -BAR_TOP / 2); ovoloV.lineTo(BAR_H, BAR_TOP / 2); ovoloV.lineTo(BAR_H - sqH, BAR_TOP / 2);
    ovoloV.quadraticCurveTo(BAR_H - drop - sqH, BAR_W / 2, 0, BAR_W / 2);
    ovoloV.closePath();

    function buildSpokes(innerR, outerR) {
      return spokeAngles.map(angle => {
        const startR = innerR + BAR_W * 0.6;
        const endR = outerR - BAR_W * 0.4;
        const spokeLen = endR - startR;
        if (spokeLen < mm(20)) return null;
        const midR = (startR + endR) / 2;
        const cx = midR * Math.cos(angle);
        const cy = springY + midR * Math.sin(angle);
        const extG = new THREE.ExtrudeGeometry(trapV, { depth: spokeLen + mm(10), bevelEnabled: false });
        extG.rotateZ(Math.PI / 2); extG.rotateX(-Math.PI / 2); extG.translate(0, -(spokeLen + mm(10)) / 2, 0); extG.computeVertexNormals();
        const intG = new THREE.ExtrudeGeometry(ovoloV, { depth: spokeLen + mm(10), bevelEnabled: false, curveSegments: 16 });
        intG.rotateZ(Math.PI / 2); intG.rotateX(-Math.PI / 2); intG.translate(0, -(spokeLen + mm(10)) / 2, 0); intG.computeVertexNormals();
        return { extG, intG, len: spokeLen, cx, cy, angle };
      }).filter(Boolean);
    }

    // Inner spokes: hub1 → hub2 (or frame if single/half)
    const spokes = buildSpokes(hubR1, (isDouble || isTriple) ? hubR2 : iHalfW);
    // Outer spokes: hub2 → hub3 (or frame if double)
    const outerSpokes = (isDouble || isTriple) ? buildSpokes(hubR2, isTriple ? hubR3 : iHalfW) : [];
    // Outermost spokes: hub3 → frame (triple only)
    const outermostSpokes = isTriple ? buildSpokes(hubR3, iHalfW) : [];

    return { ring1, ring2, ring3, spokes, outerSpokes, outermostSpokes };
  }, [semiBarPattern, iHalfW, springY, isHub, isDouble, isTriple, spokeAngles]);

  const spacerBarMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: spacerColor === 'white' ? '#f8f8f8' : spacerColor === 'black' ? '#1a1a1a' : '#a0a4a8',
    metalness: 0.6, roughness: 0.4
  }), [spacerColor]);

  function renderRing(ring, key) {
    return (
      <group key={key}>
        {ring.extLayers.map((g, i) => (
          <mesh key={'re' + i} geometry={g} castShadow receiveShadow><primitive object={mat} attach="material" /></mesh>
        ))}
        {ring.intLayers.map((g, i) => (
          <mesh key={'ri' + i} geometry={g} castShadow receiveShadow><primitive object={matInt || mat} attach="material" /></mesh>
        ))}
        {ring.spacerGeo && <mesh geometry={ring.spacerGeo} castShadow receiveShadow><primitive object={spacerBarMat} attach="material" /></mesh>}
      </group>
    );
  }

  function renderSpokes(spokes, keyPrefix) {
    return spokes.map((s, i) => (
      <group key={keyPrefix + i} position={[s.cx, s.cy, 0]} rotation={[0, 0, s.angle - Math.PI / 2]}>
        <mesh geometry={s.extG} position={[0, 0, glassHalf]} rotation={[Math.PI, 0, 0]} castShadow receiveShadow>
          <primitive object={mat} attach="material" />
        </mesh>
        <mesh geometry={s.intG} position={[0, 0, -glassHalf]} castShadow receiveShadow>
          <primitive object={matInt || mat} attach="material" />
        </mesh>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[SPACER_BAR_W, s.len, SPACER_DEPTH]} />
          <primitive object={spacerBarMat} attach="material" />
        </mesh>
      </group>
    ));
  }

  return (
    <group>
      <FrameMesh geometry={frameGeo} matExt={mat} matInt={matInt} />
      <ContourBeads innerPts={innerPts} D={D} matExt={mat} matInt={matInt || mat} />
      <CurvedGlass innerPts={innerPts} glassMat={glassMat} spacerColor={spacerColor} />
      {bars.length > 0 && <FixBars barItems={bars} matExt={mat} matInt={matInt || mat} spacerColor={spacerColor} />}
      {hubData && (
        <group>
          {renderRing(hubData.ring1, 'r1')}
          {hubData.ring2 && renderRing(hubData.ring2, 'r2')}
          {hubData.ring3 && renderRing(hubData.ring3, 'r3')}
          {renderSpokes(hubData.spokes, 'sp')}
          {hubData.outerSpokes.length > 0 && renderSpokes(hubData.outerSpokes, 'osp')}
          {hubData.outermostSpokes.length > 0 && renderSpokes(hubData.outermostSpokes, 'omsp')}
        </group>
      )}
    </group>
  );
}


/* ═══ SEGMENTAL ═══ */
function SegmentalFrame({ width, height, depth, mat, matInt, glassMat, spacerColor, customRise = 0, hBars = 0, vBars = 0 }) {
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
    // Inner arc: recompute from iRise/iHalfW so endpoints land at springY
    const iRise = Math.max(rise - fw, mm(10));
    const iR = (iRise*iRise + iHalfW*iHalfW) / (2*iRise);
    const iCY = springY - (iR - iRise);
    const iAngle = Math.asin(Math.min(iHalfW / iR, 1));
    const innerArc = arcPoints(0, iCY, iR, Math.PI/2 - iAngle, Math.PI/2 + iAngle, segs);
    const inner = [[-iHalfW, iBottom], [iHalfW, iBottom], [iHalfW, springY], ...innerArc, [-iHalfW, springY]];
    return { frameGeo: makeFrameGeo(outer, inner, D), innerPts: inner };
  }, [W, H, D, halfW, springY, R, cy, startAngle, rise, iHalfW, iBottom]);

  // Inner arch params for bar clipping
  const iRise = Math.max(rise - fw, mm(10));
  const iR = (iRise * iRise + iHalfW * iHalfW) / (2 * iRise);
  const iCY = springY - (iR - iRise);

  function segArchY(x) {
    const sq = iR * iR - x * x;
    return sq > 0 ? iCY + Math.sqrt(sq) : springY;
  }

  const bars = useMemo(() => {
    const items = [];
    const glassW = iHalfW * 2;
    const topY = segArchY(0);
    const fullH = topY - iBottom;
    for (let i = 1; i <= (hBars||0); i++) {
      const y = iBottom + (fullH / (hBars + 1)) * i;
      let len = glassW;
      if (y > springY) {
        const sq = iR * iR - (y - iCY) * (y - iCY);
        if (sq > 0) len = 2 * Math.sqrt(sq); else continue;
      }
      items.push({ type:'h', x:0, y, len });
    }
    for (let i = 1; i <= (vBars||0); i++) {
      const x = -iHalfW + (glassW / (vBars + 1)) * i;
      const barTop = segArchY(x) - BAR_W / 2;
      const barH = barTop - iBottom;
      if (barH > 0) items.push({ type:'v', x, y: iBottom + barH / 2, len: barH });
    }
    return items;
  }, [hBars, vBars, iHalfW, iBottom, springY, iR, iCY]);

  return (
    <group>
      <FrameMesh geometry={frameGeo} matExt={mat} matInt={matInt} />
      <ContourBeads innerPts={innerPts} D={D} matExt={mat} matInt={matInt || mat} spacerColor={spacerColor} />
      <CurvedGlass innerPts={innerPts} glassMat={glassMat} spacerColor={spacerColor} />
      {bars.length > 0 && <FixBars barItems={bars} matExt={mat} matInt={matInt || mat} spacerColor={spacerColor} />}
    </group>
  );
}

/* ═══ ELLIPTICAL ═══ */
function EllipticalFrame({ width, height, depth, mat, matInt, glassMat, spacerColor, customRise = 0, hBars = 0, vBars = 0 }) {
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

  const iRise = Math.max(rise - fw, mm(10));

  function ellArchY(x) {
    const t = x / iHalfW;
    const sq = 1 - t * t;
    return sq > 0 ? springY + iRise * Math.sqrt(sq) : springY;
  }

  const bars = useMemo(() => {
    const items = [];
    const glassW = iHalfW * 2;
    const topY = ellArchY(0);
    const fullH = topY - iBottom;
    for (let i = 1; i <= (hBars||0); i++) {
      const y = iBottom + (fullH / (hBars + 1)) * i;
      let len = glassW;
      if (y > springY) {
        const t = (y - springY) / iRise;
        const sq = 1 - t * t;
        if (sq > 0) len = 2 * iHalfW * Math.sqrt(sq); else continue;
      }
      items.push({ type:'h', x:0, y, len });
    }
    for (let i = 1; i <= (vBars||0); i++) {
      const x = -iHalfW + (glassW / (vBars + 1)) * i;
      const barTop = ellArchY(x) - BAR_W / 2;
      const barH = barTop - iBottom;
      if (barH > 0) items.push({ type:'v', x, y: iBottom + barH / 2, len: barH });
    }
    return items;
  }, [hBars, vBars, iHalfW, iBottom, springY, iRise]);

  return (
    <group>
      <FrameMesh geometry={frameGeo} matExt={mat} matInt={matInt} />
      <ContourBeads innerPts={innerPts} D={D} matExt={mat} matInt={matInt || mat} spacerColor={spacerColor} />
      <CurvedGlass innerPts={innerPts} glassMat={glassMat} spacerColor={spacerColor} />
      {bars.length > 0 && <FixBars barItems={bars} matExt={mat} matInt={matInt || mat} spacerColor={spacerColor} />}
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
  fixCircleBarPattern = 'none', fixCircleBarOffset = 200,
  fixSemiBarPattern = 'none',
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
  if (fixShape === 'circle') shapeNode = <CircleFrame diameter={width} depth={depth} mat={extMat} matInt={intMat} glassMat={glassMat} spacerColor={spacerColor} circleBarPattern={fixCircleBarPattern} circleBarOffset={fixCircleBarOffset} hBars={hBars} vBars={vBars} />;
  else if (fixShape === 'gothic-arch') shapeNode = <GothicArchFrame width={width} height={effectiveH} depth={depth} mat={extMat} matInt={intMat} glassMat={glassMat} spacerColor={spacerColor} gothicBars={fixGothicBars} hBars={hBars} vBars={vBars} />;
  else if (fixShape === 'semi-circle') shapeNode = <SemiCircleFrame width={width} height={effectiveH} depth={depth} mat={extMat} matInt={intMat} glassMat={glassMat} spacerColor={spacerColor} hBars={hBars} vBars={vBars} semiBarPattern={fixSemiBarPattern} />;
  else if (fixShape === 'segmental-arch') shapeNode = <SegmentalFrame width={width} height={effectiveH} depth={depth} mat={extMat} matInt={intMat} glassMat={glassMat} spacerColor={spacerColor} customRise={fixArchRise} hBars={hBars} vBars={vBars} />;
  else if (fixShape === 'elliptical-arch') shapeNode = <EllipticalFrame width={width} height={effectiveH} depth={depth} mat={extMat} matInt={intMat} glassMat={glassMat} spacerColor={spacerColor} customRise={fixArchRise} hBars={hBars} vBars={vBars} />;
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