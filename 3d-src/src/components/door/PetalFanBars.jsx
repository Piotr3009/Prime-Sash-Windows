// ═══════════════════════════════════════════════════════════════════
// PetalFanBars — the "daisy" fanlight pattern from drawing Type 01:
// a small half-sun hub on the bottom edge and closed petal-shaped
// fields fanning out to the head. Each petal is one curved strip
// (hub → tip → hub) built with the proven stepped-layer method from
// SemiCircleFrame. tipRadius is a per-angle function, so the same
// component works inside an arch (constant radius) and a rectangle
// (ray-to-edge radius).
// ═══════════════════════════════════════════════════════════════════
import React, { useMemo } from 'react';
import * as THREE from 'three';

const mm = (v) => v / 1000;

const GLASS_UNIT_DEPTH = 24;
const GU = mm(GLASS_UNIT_DEPTH);
const glassHalf = GU / 2;
const BAR_W = mm(22);        // hub ring — matches the other fanlight patterns
const PETAL_W = mm(14);      // petal outline — finer, like the Type 01 drawing
const BAR_TOP = mm(2);
const BAR_H = mm(16.5);
const SPACER_BAR_W = mm(18);
const SPACER_DEPTH = mm(16);

export default function PetalFanBars({
  hubCenterY,          // local Y of the hub centre (metres)
  tipRadius,           // (angle) => max radius available at that angle (metres)
  hubRadiusM = null,   // hub ring radius (metres); default derived from tips
  petals = 9,
  mat, mi, spacerMat,
}) {
  const data = useMemo(() => {
    if (!tipRadius) return null;

    // Petal tip angles: spread across the half-circle, none lying flat
    const angles = [];
    for (let k = 0; k < petals; k++) angles.push(((k + 0.5) / petals) * Math.PI);

    const minTip = Math.min(...angles.map(a => tipRadius(a)));
    const hubR = hubRadiusM != null ? hubRadiusM : Math.max(mm(60), minTip * 0.28);
    // ── shared strip/stepped helpers (ported from SemiCircleFrame) ──
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

    const RING_STEPS = 48;
    function buildStepped(centerline, barW = BAR_W) {
      const layerD = BAR_H / RING_STEPS;
      const extLayers = [], intLayers = [];
      for (let i = 0; i < RING_STEPS; i++) {
        const t = i / (RING_STEPS - 1);
        const hw = (barW / 2) * (1 - t) + (BAR_TOP / 2) * t;
        const s = ptsToStrip(centerline, hw);
        if (!s) continue;
        const g = new THREE.ExtrudeGeometry(s, { depth: layerD, bevelEnabled: false });
        g.translate(0, 0, glassHalf + i * layerD);
        g.computeVertexNormals();
        extLayers.push(g);
      }
      for (let i = 0; i < RING_STEPS; i++) {
        const t = (i + 1) / RING_STEPS;
        const hw = Math.max((barW / 2) * Math.cos(t * Math.PI / 2), BAR_TOP / 2);
        const s = ptsToStrip(centerline, hw);
        if (!s) continue;
        const g = new THREE.ExtrudeGeometry(s, { depth: layerD, bevelEnabled: false });
        g.translate(0, 0, -(glassHalf + (i + 1) * layerD));
        g.computeVertexNormals();
        intLayers.push(g);
      }
      const ss = ptsToStrip(centerline, Math.min(SPACER_BAR_W, barW * 0.82) / 2);
      let spacerGeo = null;
      if (ss) {
        spacerGeo = new THREE.ExtrudeGeometry(ss, { depth: SPACER_DEPTH, bevelEnabled: false });
        spacerGeo.translate(0, 0, -SPACER_DEPTH / 2);
        spacerGeo.computeVertexNormals();
      }
      return { extLayers, intLayers, spacerGeo };
    }

    const pt = (r, a) => [r * Math.cos(a), hubCenterY + r * Math.sin(a)];

    // ── Hub ring ──
    const hubLine = [];
    for (let i = 0; i <= 40; i++) hubLine.push(pt(hubR, (i / 40) * Math.PI));
    const hubRing = buildStepped(hubLine);

    // ── Petals (approved mockup v4): a straight bar from the hub runs to
    // one end of an OPEN tip arc, the arc wraps over the top, and a straight
    // bar returns to the same hub point. One continuous centreline per petal.
    const petalGeos = [];
    const tipR = Math.max(mm(25), minTip * 0.12);   // tip arc radius (2x the first draft)
    for (const a of angles) {
      const rC = tipRadius(a) - PETAL_W * 0.7 - tipR;   // tip-circle centre radius
      if (rC - hubR < mm(40)) continue;
      const C = pt(rC, a);
      const line = [];
      line.push(pt(hubR, a));                        // start on the hub
      for (let i = 0; i <= 16; i++) {                // open arc: (a+90°) → over the top → (a−90°)
        const ta = a + Math.PI / 2 - (i / 16) * Math.PI;
        line.push([C[0] + tipR * Math.cos(ta), C[1] + tipR * Math.sin(ta)]);
      }
      line.push(pt(hubR, a));                        // back to the same hub point
      petalGeos.push(buildStepped(line, PETAL_W));
    }

    // ── Half-sun rays inside the hub ──
    const rayGeos = [];
    for (const a of angles) {
      const line = [pt(hubR * 0.3, a), pt(hubR - BAR_W * 0.4, a)];
      // ptsToStrip needs ≥3 points
      line.splice(1, 0, pt((hubR * 0.3 + hubR) / 2, a));
      rayGeos.push(buildStepped(line, PETAL_W));
    }

    return { hubRing, petalGeos, rayGeos };
  }, [hubCenterY, tipRadius, hubRadiusM, petals]);

  if (!data) return null;
  const { hubRing, petalGeos, rayGeos } = data;

  const renderSet = (set, key) => (
    <group key={key}>
      {set.extLayers.map((g, i) => (
        <mesh key={`e${i}`} geometry={g} castShadow receiveShadow>
          <primitive object={mat} attach="material" />
        </mesh>
      ))}
      {set.intLayers.map((g, i) => (
        <mesh key={`i${i}`} geometry={g} castShadow receiveShadow>
          <primitive object={mi} attach="material" />
        </mesh>
      ))}
      {set.spacerGeo && (
        <mesh geometry={set.spacerGeo} castShadow receiveShadow>
          <primitive object={spacerMat} attach="material" />
        </mesh>
      )}
    </group>
  );

  return (
    <group>
      {renderSet(hubRing, 'hub')}
      {petalGeos.map((g, i) => renderSet(g, `petal-${i}`))}
      {rayGeos.map((g, i) => renderSet(g, `ray-${i}`))}
    </group>
  );
}
