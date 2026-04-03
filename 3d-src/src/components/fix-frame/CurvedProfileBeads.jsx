/**
 * CurvedProfileBeads.jsx
 * Robust curved beads without extrudePath twisting.
 * - EXT chamfer = one ring band
 * - INT ovolo = stepped ring layers approximating quarter-round
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import {
  mm,
  EBW,
  EBD,
  IBW,
  IBD,
  OVOLO_N,
  offsetClosedPtsInward,
  makeRingGeo,
} from './frameProfile';
export default function CurvedProfileBeads({
  innerPts,
  frameDepth,
  frameMatExt,
  frameMatInt,
}) {
  const halfD = mm(frameDepth) / 2;
  const matInt = frameMatInt || frameMatExt;
  // ── EXT CHAMFER ──
  // Ring from glass edge inward by 9mm, placed on exterior face region
  const chamferGeo = useMemo(() => {
    try {
      const innerOffset = offsetClosedPtsInward(innerPts, EBW);
      return makeRingGeo(innerPts, innerOffset, EBD);
    } catch (e) {
      console.warn('Chamfer bead build failed:', e);
      return null;
    }
  }, [innerPts]);
  // ── INT OVOLO ──
  // Approximated as stepped ring layers across 14mm depth and 18mm face
  const ovoloLayers = useMemo(() => {
    try {
      const layers = [];
      let prevInset = 0;
      for (let i = 0; i < OVOLO_N; i++) {
        const t0 = i / OVOLO_N;
        const t1 = (i + 1) / OVOLO_N;
        // quarter-round approximation
        const a0 = t0 * (Math.PI / 2);
        const a1 = t1 * (Math.PI / 2);
        const inset0 = IBW * Math.sin(a0);
        const inset1 = IBW * Math.sin(a1);
        const bandOuter = offsetClosedPtsInward(innerPts, prevInset);
        const bandInner = offsetClosedPtsInward(innerPts, inset1);
        const layerDepth = IBD / OVOLO_N;
        const geo = makeRingGeo(bandOuter, bandInner, layerDepth);
        const z = -halfD + (i + 0.5) * layerDepth;
        layers.push({ geo, z });
        prevInset = inset1;
      }
      return layers;
    } catch (e) {
      console.warn('Ovolo bead build failed:', e);
      return [];
    }
  }, [innerPts, halfD]);
  return (
    <group>
      {chamferGeo && (
        <mesh
          geometry={chamferGeo}
          position={[0, 0, halfD - EBD / 2]}
          castShadow
          receiveShadow
        >
          <primitive object={frameMatExt} attach="material" />
        </mesh>
      )}
      {ovoloLayers.map((layer, i) => (
        <mesh
          key={i}
          geometry={layer.geo}
          position={[0, 0, layer.z]}
          castShadow
          receiveShadow
        >
          <primitive object={matInt} attach="material" />
        </mesh>
      ))}
    </group>
  );
}