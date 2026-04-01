/**
 * CasementGlazing.jsx
 * Glass pane for casement windows.
 * 
 * Props:
 *   width    – glass pane width in mm
 *   height   – glass pane height in mm
 *   glassType – 'double' | 'triple' | 'passive'
 *   spacerColor – 'silver' | 'black' | 'white'
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';

const mm = (v) => v / 1000;

const GLASS_UNIT_DEPTH = 24; // 4/16/4 double glazed unit depth in mm
const GLASS_BEAD = 8;         // glazing bead around glass

const spacerHexMap = {
  silver: '#C8C8C8',
  black: '#1a1a1a',
  white: '#E8E8E8',
};

export default function CasementGlazing({
  width = 600,
  height = 900,
  glassType = 'double',
  spacerColor = 'silver',
  hBars = 0,
  vBars = 0,
  barMaterial,
  barMaterialInt,
  position = [0, 0, 0],
}) {
  const W = mm(width);
  const H = mm(height);
  const D = mm(GLASS_UNIT_DEPTH);
  const glassHalf = D / 2;
  const spacerHex = spacerHexMap[spacerColor] || '#C8C8C8';

  // ─── Bar dimensions (identical to sash) ───
  const barW = mm(22);     // base width
  const barH = mm(16.5);   // profile height
  const barTop = mm(2);    // top width
  const spacerBarW = mm(18);
  const spacerDepth = mm(16);
  const spacerMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: spacerColor === 'silver' ? '#a0a4a8' : spacerColor === 'white' ? '#f8f8f8' : '#1a1a1a',
    metalness: 0.6, roughness: 0.4
  }), [spacerColor]);

  // ─── Exterior trapezoid profile (same as sash) ───
  const trapV = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-barW/2, 0); s.lineTo(-barTop/2, barH); s.lineTo(barTop/2, barH); s.lineTo(barW/2, 0);
    s.closePath();
    return s;
  }, []);
  const trapH = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, -barW/2); s.lineTo(barH, -barTop/2); s.lineTo(barH, barTop/2); s.lineTo(0, barW/2);
    s.closePath();
    return s;
  }, []);

  // ─── Interior ovolo profile (same as sash) ───
  const ovoloV = useMemo(() => {
    const drop = mm(2), sqH = mm(2);
    const s = new THREE.Shape();
    s.moveTo(-barW/2, 0);
    s.quadraticCurveTo(-barW/2, barH-drop-sqH, -barTop/2, barH-sqH);
    s.lineTo(-barTop/2, barH); s.lineTo(barTop/2, barH); s.lineTo(barTop/2, barH-sqH);
    s.quadraticCurveTo(barW/2, barH-drop-sqH, barW/2, 0);
    s.closePath();
    return s;
  }, []);
  const ovoloH = useMemo(() => {
    const drop = mm(2), sqH = mm(2);
    const s = new THREE.Shape();
    s.moveTo(0, -barW/2);
    s.quadraticCurveTo(barH-drop-sqH, -barW/2, barH-sqH, -barTop/2);
    s.lineTo(barH, -barTop/2); s.lineTo(barH, barTop/2); s.lineTo(barH-sqH, barTop/2);
    s.quadraticCurveTo(barH-drop-sqH, barW/2, 0, barW/2);
    s.closePath();
    return s;
  }, []);

  // ─── Extruded geometries ───
  const vExtGeom = useMemo(() => { const g = new THREE.ExtrudeGeometry(trapV, { depth: H+mm(18), bevelEnabled:false }); g.rotateX(-Math.PI/2); g.translate(0, -(H+mm(18))/2, 0); g.computeVertexNormals(); return g; }, [H, trapV]);
  const hExtGeom = useMemo(() => { const g = new THREE.ExtrudeGeometry(trapH, { depth: W+mm(18), bevelEnabled:false }); g.rotateY(Math.PI/2); g.translate(-(W+mm(18))/2, 0, 0); g.computeVertexNormals(); return g; }, [W, trapH]);
  const vIntGeom = useMemo(() => { const g = new THREE.ExtrudeGeometry(ovoloV, { depth: H+mm(18), bevelEnabled:false, curveSegments:32 }); g.rotateX(-Math.PI/2); g.translate(0, -(H+mm(18))/2, 0); g.computeVertexNormals(); return g; }, [H, ovoloV]);
  const hIntGeom = useMemo(() => { const g = new THREE.ExtrudeGeometry(ovoloH, { depth: W+mm(18), bevelEnabled:false, curveSegments:32 }); g.rotateY(Math.PI/2); g.translate(-(W+mm(18))/2, 0, 0); g.computeVertexNormals(); return g; }, [W, ovoloH]);

  // ─── Bar positions ───
  const barItems = useMemo(() => {
    const items = [];
    for (let i = 1; i <= (vBars||0); i++) items.push({ type:'v', x: -W/2 + (W/(vBars+1))*i, y: 0 });
    for (let i = 1; i <= (hBars||0); i++) items.push({ type:'h', x: 0, y: -H/2 + (H/(hBars+1))*i });
    return items;
  }, [hBars, vBars, W, H]);

  const glassMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#d4e8f0', metalness: 0.05, roughness: 0.05,
    transmission: 0.92, transparent: true, opacity: 0.35,
    ior: 1.5, thickness: D, side: THREE.DoubleSide,
  }), [D]);

  const defaultBarMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#F6F6F6', roughness: 0.72, metalness: 0.02,
  }), []);

  const matExt = barMaterial || defaultBarMat;
  const matInt = barMaterialInt || barMaterial || defaultBarMat;

  return (
    <group position={position}>
      {/* Glass pane */}
      <mesh castShadow={false} receiveShadow>
        <boxGeometry args={[W, H, D]} />
        <primitive object={glassMat} attach="material" />
      </mesh>

      {/* Edge spacers */}
      <mesh position={[0, H/2-mm(2), 0]}><boxGeometry args={[W, mm(4), D+mm(1)]} /><meshStandardMaterial color={spacerHex} metalness={0.6} roughness={0.4} /></mesh>
      <mesh position={[0, -H/2+mm(2), 0]}><boxGeometry args={[W, mm(4), D+mm(1)]} /><meshStandardMaterial color={spacerHex} metalness={0.6} roughness={0.4} /></mesh>
      <mesh position={[-W/2+mm(2), 0, 0]}><boxGeometry args={[mm(4), H, D+mm(1)]} /><meshStandardMaterial color={spacerHex} metalness={0.6} roughness={0.4} /></mesh>
      <mesh position={[W/2-mm(2), 0, 0]}><boxGeometry args={[mm(4), H, D+mm(1)]} /><meshStandardMaterial color={spacerHex} metalness={0.6} roughness={0.4} /></mesh>

      {/* ─── Glazing bars ─── */}
      {barItems.map((bar, i) => {
        const geomExt = bar.type === 'v' ? vExtGeom : hExtGeom;
        const geomInt = bar.type === 'v' ? vIntGeom : hIntGeom;
        const sLen = bar.type === 'v' ? H : W;
        return (
          <group key={i} position={[bar.x, bar.y, 0]}>
            {/* Exterior — trapezoid */}
            <mesh geometry={geomInt} position={[0, 0, -glassHalf]} castShadow receiveShadow>
              <primitive object={matInt} attach="material" />
            </mesh>
            {/* Interior — ovolo */}
            <mesh geometry={geomExt} position={[0, 0, glassHalf]} rotation={[Math.PI, 0, 0]} castShadow receiveShadow>
              <primitive object={matExt} attach="material" />
            </mesh>
            {/* Spacer bar between glass panes */}
            <mesh position={[0, 0, 0]} castShadow receiveShadow>
              {bar.type === 'v'
                ? <boxGeometry args={[spacerBarW, sLen, spacerDepth]} />
                : <boxGeometry args={[sLen, spacerBarW, spacerDepth]} />
              }
              <primitive object={spacerMat} attach="material" />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

export { GLASS_UNIT_DEPTH };