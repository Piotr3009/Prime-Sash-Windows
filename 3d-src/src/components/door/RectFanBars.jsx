// ═══════════════════════════════════════════════════════════════════
// RectFanBars — sunburst glazing bars inside a RECTANGULAR fanlight
// (drawing "Type 05"): half-hub rings on the bottom edge and spokes
// running out to the rectangle edges. Geometry method ported 1:1 from
// FixFrameWindow's SemiCircleFrame (stepped ring layers, baked-rotation
// spoke geometries, segmented spokes between rings). Constants mirror
// FixFrameWindow so the bars match the arched fanlight visually.
// ═══════════════════════════════════════════════════════════════════
import React, { useMemo } from 'react';
import * as THREE from 'three';

const mm = (v) => v / 1000;

// Same values as FixFrameWindow module constants
const GLASS_UNIT_DEPTH = 24;
const GU = mm(GLASS_UNIT_DEPTH);
const glassHalf = GU / 2;
const BAR_W = mm(22);
const BAR_TOP = mm(2);
const BAR_H = mm(16.5);
const SPACER_BAR_W = mm(18);
const SPACER_DEPTH = mm(16);

export default function RectFanBars({
  innerW,        // glass opening width (mm)
  innerH,        // glass opening height (mm)
  pattern = 'none',   // 'hub-spoke' | 'double-hub-spoke' | 'triple-hub-spoke'
  mat, mi, spacerMat,
}) {
  const iHalfW = mm(innerW) / 2;
  const iH = mm(innerH);
  const iBottom = -iH / 2;   // local coords: glass centre at (0,0)
  const iTop = iH / 2;

  const isDouble = pattern === 'double-hub-spoke';
  const isTriple = pattern === 'triple-hub-spoke';
  const active = pattern === 'hub-spoke' || isDouble || isTriple;
  const spokeCount = isTriple ? 8 : isDouble ? 6 : 4;

  const data = useMemo(() => {
    if (!active) return null;

    // Ring radii follow the semi-circle recipe, clamped to the rectangle
    const maxR = Math.min(iHalfW, iH) - BAR_W;
    const wanted = [iHalfW * 0.3];
    if (isDouble || isTriple) wanted.push(iHalfW * 0.6);
    if (isTriple) wanted.push(iHalfW * 0.8);
    const ringRadii = wanted.filter(r => r > BAR_W && r <= maxR);
    if (ringRadii.length === 0) ringRadii.push(Math.min(iHalfW * 0.3, maxR));

    const spokeAngles = [];
    for (let i = 0; i < spokeCount; i++) spokeAngles.push((i / (spokeCount - 1)) * Math.PI);

    // ── Rings: stepped layers along the half-circle centreline ──
    function semiArcPts(radius, nPts) {
      const pts = [];
      for (let i = 0; i <= nPts; i++) {
        const angle = (i / nPts) * Math.PI;
        pts.push([radius * Math.cos(angle), iBottom + radius * Math.sin(angle)]);
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

    const ringGeos = ringRadii.map(r => buildRingLayers(r));

    // ── Spokes: baked-rotation geometry, exactly as SemiCircleFrame ──
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

    // Distance from hub centre (0, iBottom) to the rectangle boundary at angle a
    function rayToRect(a) {
      const cx = Math.cos(a), sy = Math.sin(a);
      let t = Infinity;
      if (Math.abs(cx) > 1e-6) t = Math.min(t, iHalfW / Math.abs(cx));
      if (sy > 1e-6) t = Math.min(t, (iTop - iBottom) / sy);
      return t;
    }

    // One radial segment between two radii; outerR may be per-angle (function)
    function buildSegment(innerR, outerROrFn) {
      return spokeAngles.map(angle => {
        const outerR = typeof outerROrFn === 'function' ? outerROrFn(angle) : outerROrFn;
        const startR = innerR + BAR_W * 0.6;
        const endR = outerR - BAR_W * 0.4;
        const spokeLen = endR - startR;
        if (spokeLen < mm(20)) return null;
        const midR = (startR + endR) / 2;
        const cx = midR * Math.cos(angle);
        const cy = iBottom + midR * Math.sin(angle);
        const extG = new THREE.ExtrudeGeometry(trapV, { depth: spokeLen + mm(10), bevelEnabled: false });
        extG.rotateZ(Math.PI / 2); extG.rotateX(-Math.PI / 2); extG.translate(0, -(spokeLen + mm(10)) / 2, 0); extG.computeVertexNormals();
        const intG = new THREE.ExtrudeGeometry(ovoloV, { depth: spokeLen + mm(10), bevelEnabled: false, curveSegments: 16 });
        intG.rotateZ(Math.PI / 2); intG.rotateX(-Math.PI / 2); intG.translate(0, -(spokeLen + mm(10)) / 2, 0); intG.computeVertexNormals();
        return { extG, intG, len: spokeLen, cx, cy, angle };
      }).filter(Boolean);
    }

    // Segments between consecutive rings, then last ring → rectangle edge
    const segments = [];
    for (let i = 0; i < ringRadii.length; i++) {
      const innerR = ringRadii[i];
      const outer = (i + 1 < ringRadii.length) ? ringRadii[i + 1] : ((a) => rayToRect(a));
      segments.push(...buildSegment(innerR, outer));
    }

    return { ringGeos, segments };
  }, [active, iHalfW, iH, iBottom, iTop, isDouble, isTriple, spokeCount]);

  if (!data) return null;
  const { ringGeos, segments } = data;

  return (
    <group>
      {ringGeos.map((ring, ri) => (
        <group key={`ring-${ri}`}>
          {ring.extLayers.map((g, i) => (
            <mesh key={`re${i}`} geometry={g} castShadow receiveShadow>
              <primitive object={mat} attach="material" />
            </mesh>
          ))}
          {ring.intLayers.map((g, i) => (
            <mesh key={`ri${i}`} geometry={g} castShadow receiveShadow>
              <primitive object={mi} attach="material" />
            </mesh>
          ))}
          {ring.spacerGeo && (
            <mesh geometry={ring.spacerGeo} castShadow receiveShadow>
              <primitive object={spacerMat} attach="material" />
            </mesh>
          )}
        </group>
      ))}

      {segments.map((s, i) => (
        <group key={`sp-${i}`} position={[s.cx, s.cy, 0]} rotation={[0, 0, s.angle - Math.PI / 2]}>
          <mesh geometry={s.extG} position={[0, 0, glassHalf]} rotation={[Math.PI, 0, 0]} castShadow receiveShadow>
            <primitive object={mat} attach="material" />
          </mesh>
          <mesh geometry={s.intG} position={[0, 0, -glassHalf]} castShadow receiveShadow>
            <primitive object={mi} attach="material" />
          </mesh>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[SPACER_BAR_W, s.len, SPACER_DEPTH]} />
            <primitive object={spacerMat} attach="material" />
          </mesh>
        </group>
      ))}
    </group>
  );
}
