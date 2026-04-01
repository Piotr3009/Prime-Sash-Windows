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
  position = [0, 0, 0],
}) {
  const W = mm(width);
  const H = mm(height);
  const D = mm(GLASS_UNIT_DEPTH);
  const spacerHex = spacerHexMap[spacerColor] || '#C8C8C8';
  const BAR_FACE = mm(18);
  const BAR_DEPTH = mm(28);

  const glassMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#d4e8f0',
    metalness: 0.05,
    roughness: 0.05,
    transmission: 0.92,
    transparent: true,
    opacity: 0.35,
    ior: 1.5,
    thickness: D,
    side: THREE.DoubleSide,
  }), [D]);

  // Generate bar positions
  const hBarPositions = useMemo(() => {
    if (!hBars || hBars < 1) return [];
    const positions = [];
    for (let i = 1; i <= hBars; i++) {
      positions.push(-H / 2 + (H * i) / (hBars + 1));
    }
    return positions;
  }, [hBars, H]);

  const vBarPositions = useMemo(() => {
    if (!vBars || vBars < 1) return [];
    const positions = [];
    for (let i = 1; i <= vBars; i++) {
      positions.push(-W / 2 + (W * i) / (vBars + 1));
    }
    return positions;
  }, [vBars, W]);

  return (
    <group position={position}>
      {/* Glass pane */}
      <mesh castShadow={false} receiveShadow>
        <boxGeometry args={[W, H, D]} />
        <primitive object={glassMat} attach="material" />
      </mesh>

      {/* Spacer bars around edge */}
      <mesh position={[0, H / 2 - mm(2), 0]}>
        <boxGeometry args={[W, mm(4), D + mm(1)]} />
        <meshStandardMaterial color={spacerHex} metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, -H / 2 + mm(2), 0]}>
        <boxGeometry args={[W, mm(4), D + mm(1)]} />
        <meshStandardMaterial color={spacerHex} metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[-W / 2 + mm(2), 0, 0]}>
        <boxGeometry args={[mm(4), H, D + mm(1)]} />
        <meshStandardMaterial color={spacerHex} metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[W / 2 - mm(2), 0, 0]}>
        <boxGeometry args={[mm(4), H, D + mm(1)]} />
        <meshStandardMaterial color={spacerHex} metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Horizontal glazing bars */}
      {hBarPositions.map((y, i) => (
        <mesh key={`hbar-${i}`} position={[0, y, 0]}>
          <boxGeometry args={[W, BAR_FACE, BAR_DEPTH]} />
          {barMaterial ? <primitive object={barMaterial} attach="material" /> :
            <meshStandardMaterial color="#F6F6F6" roughness={0.7} />}
        </mesh>
      ))}

      {/* Vertical glazing bars */}
      {vBarPositions.map((x, i) => (
        <mesh key={`vbar-${i}`} position={[x, 0, 0]}>
          <boxGeometry args={[BAR_FACE, H, BAR_DEPTH]} />
          {barMaterial ? <primitive object={barMaterial} attach="material" /> :
            <meshStandardMaterial color="#F6F6F6" roughness={0.7} />}
        </mesh>
      ))}
    </group>
  );
}

export { GLASS_UNIT_DEPTH };