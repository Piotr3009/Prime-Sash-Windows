/**
 * CurvedProfileBeads.jsx
 * Renders chamfer (EXT) and ovolo (INT) beads along a curved inner contour.
 * Uses ExtrudeGeometry with extrudePath to sweep profile cross-sections.
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { EBW, EBD, IBW, IBD, IBR, OVOLO_N } from './frameProfile';

const mm = (v) => v / 1000;

/**
 * Build a closed CatmullRomCurve3 from 2D points at given Z
 */
function makeCurve(pts2d, z) {
  // Filter out duplicate consecutive points
  const filtered = [pts2d[0]];
  for (let i = 1; i < pts2d.length; i++) {
    const dx = pts2d[i][0] - filtered[filtered.length - 1][0];
    const dy = pts2d[i][1] - filtered[filtered.length - 1][1];
    if (Math.sqrt(dx * dx + dy * dy) > 0.0001) {
      filtered.push(pts2d[i]);
    }
  }
  const v = filtered.map(p => new THREE.Vector3(p[0], p[1], z));
  return new THREE.CatmullRomCurve3(v, true, 'centripetal', 0.001);
}

/**
 * Chamfer profile (exterior glazing edge)
 * Small triangle: extends inward from glass edge
 */
function chamferShape() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(-EBW, 0);       // inward along frame face
  s.lineTo(0, -EBD);       // down toward glass
  s.closePath();
  return s;
}

/**
 * Ovolo profile (interior glazing edge)
 * Quarter circle: extends inward from glass edge
 */
function ovoloShape() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  // Quarter circle
  for (let i = 0; i <= OVOLO_N; i++) {
    const t = i / OVOLO_N;
    const a = t * (Math.PI / 2);
    s.lineTo(-IBW * Math.sin(a), IBD * Math.cos(a));
  }
  s.lineTo(0, 0);
  s.closePath();
  return s;
}

export default function CurvedProfileBeads({ innerPts, frameDepth, frameMat }) {
  const halfD = mm(frameDepth) / 2;

  // Chamfer bead on exterior face
  const chamferGeo = useMemo(() => {
    try {
      const curve = makeCurve(innerPts, halfD);
      const profile = chamferShape();
      const steps = Math.max(innerPts.length * 3, 100);
      const geo = new THREE.ExtrudeGeometry(profile, {
        steps,
        bevelEnabled: false,
        extrudePath: curve,
      });
      geo.computeVertexNormals();
      return geo;
    } catch (e) {
      console.warn('Chamfer bead failed:', e);
      return null;
    }
  }, [innerPts, halfD]);

  // Ovolo bead on interior face
  const ovoloGeo = useMemo(() => {
    try {
      const curve = makeCurve(innerPts, -halfD);
      const profile = ovoloShape();
      const steps = Math.max(innerPts.length * 3, 100);
      const geo = new THREE.ExtrudeGeometry(profile, {
        steps,
        bevelEnabled: false,
        extrudePath: curve,
      });
      geo.computeVertexNormals();
      return geo;
    } catch (e) {
      console.warn('Ovolo bead failed:', e);
      return null;
    }
  }, [innerPts, halfD]);

  return (
    <group>
      {chamferGeo && (
        <mesh geometry={chamferGeo} castShadow receiveShadow>
          <primitive object={frameMat} attach="material" />
        </mesh>
      )}
      {ovoloGeo && (
        <mesh geometry={ovoloGeo} castShadow receiveShadow>
          <primitive object={frameMat} attach="material" />
        </mesh>
      )}
    </group>
  );
}
