/**
 * FixFrameWindow.jsx
 * Fixed frame only — no outer frame, no handles, no opening.
 * Just a leaf/panel with glass and optional bars.
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import CasementPanel from '../casement/CasementPanel';

const mm = (v) => v / 1000;

export default function FixFrameWindow({
  width = 600,
  height = 800,
  woodColor = '#F6F6F6',
  woodColorExt = '#F6F6F6',
  woodColorInt = '#F6F6F6',
  sameColor = true,
  spacerColor = 'silver',
  glassFinish = 'clear',
  hBars = 0,
  vBars = 0,
  showGuides = true,
}) {
  const cExt = sameColor ? woodColor : woodColorExt;
  const cInt = sameColor ? woodColor : woodColorInt;

  const extMaterial = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: cExt, roughness: 0.72, metalness: 0.02, clearcoat: 0.06, clearcoatRoughness: 0.4 }),
    [cExt]
  );
  const intMaterial = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: cInt, roughness: 0.72, metalness: 0.02, clearcoat: 0.06, clearcoatRoughness: 0.4 }),
    [cInt]
  );

  const W = mm(width);
  const H = mm(height);

  return (
    <group>
      <CasementPanel
        width={width}
        height={height}
        hingeType="fixed"
        opening={0}
        material={extMaterial}
        materialInt={intMaterial}
        spacerColor={spacerColor}
        glassFinish={glassFinish}
        hBars={hBars}
        vBars={vBars}
        ironmongery="brass"
        position={[0, 0, 0]}
      />

      {/* Dimension labels */}
      {showGuides && (
        <group>
          {/* Width line above */}
          <group position={[0, H / 2 + 0.08, 0]}>
            <mesh><boxGeometry args={[W, 0.002, 0.002]} /><meshBasicMaterial color="#22324a" /></mesh>
          </group>
          {/* Height line right */}
          <group position={[W / 2 + 0.08, 0, 0]}>
            <mesh><boxGeometry args={[0.002, H, 0.002]} /><meshBasicMaterial color="#22324a" /></mesh>
          </group>
        </group>
      )}
    </group>
  );
}
