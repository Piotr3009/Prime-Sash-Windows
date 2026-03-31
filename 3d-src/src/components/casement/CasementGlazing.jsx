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
  position = [0, 0, 0],
}) {
  const W = mm(width);
  const H = mm(height);
  const D = mm(GLASS_UNIT_DEPTH);
  const spacerHex = spacerHexMap[spacerColor] || '#C8C8C8';

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
    </group>
  );
}

export { GLASS_UNIT_DEPTH };
