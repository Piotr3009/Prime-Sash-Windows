/**
 * CasementPanel.jsx
 * Single casement sash panel — frame + glass + opening animation.
 * Opens outward (toward exterior, +Z direction).
 *
 * Props:
 *   width      – sash opening width in mm (glass area + sash frame)
 *   height     – sash opening height in mm
 *   hingeType  – 'left' | 'right' | 'top'
 *   opening    – 0..1 (0 = closed, 1 = fully open ~70°)
 *   material   – exterior wood material
 *   materialInt – interior wood material
 *   glassType  – 'double' | 'triple'
 *   spacerColor
 *   position   – [x, y, z] center position of sash
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import CasementGlazing from './CasementGlazing';

const mm = (v) => v / 1000;

// Sash frame profile constants (mm)
const SASH_RAIL = 44;     // sash rail/stile face width
const SASH_DEPTH = 44;    // sash frame depth
const MAX_ANGLE = 70;     // max opening angle in degrees

function SashFrame({ width, height, extMat, intMat }) {
  const W = mm(width);
  const H = mm(height);
  const rW = mm(SASH_RAIL);
  const rD = mm(SASH_DEPTH);
  const halfD = rD / 2;

  // Inner glass opening
  const glassW = width - SASH_RAIL * 2;
  const glassH = height - SASH_RAIL * 2;

  return (
    <group>
      {/* Bottom rail */}
      <mesh castShadow position={[0, -H / 2 + rW / 2, 0]}>
        <boxGeometry args={[W, rW, rD]} />
        <primitive object={extMat} attach="material" />
      </mesh>
      {/* Top rail */}
      <mesh castShadow position={[0, H / 2 - rW / 2, 0]}>
        <boxGeometry args={[W, rW, rD]} />
        <primitive object={extMat} attach="material" />
      </mesh>
      {/* Left stile */}
      <mesh castShadow position={[-W / 2 + rW / 2, 0, 0]}>
        <boxGeometry args={[rW, H - SASH_RAIL * 2 > 0 ? mm(height - SASH_RAIL * 2) : 0.001, rD]} />
        <primitive object={extMat} attach="material" />
      </mesh>
      {/* Right stile */}
      <mesh castShadow position={[W / 2 - rW / 2, 0, 0]}>
        <boxGeometry args={[rW, H - SASH_RAIL * 2 > 0 ? mm(height - SASH_RAIL * 2) : 0.001, rD]} />
        <primitive object={extMat} attach="material" />
      </mesh>

      {/* Glazing */}
      {glassW > 0 && glassH > 0 && (
        <CasementGlazing
          width={glassW}
          height={glassH}
          position={[0, 0, 0]}
        />
      )}
    </group>
  );
}

export default function CasementPanel({
  width = 600,
  height = 900,
  hingeType = 'left',
  opening = 0.3,
  material,
  materialInt,
  glassType = 'double',
  spacerColor = 'silver',
  position = [0, 0, 0],
}) {
  const extMat = material;
  const intMat = materialInt || material;

  const W = mm(width);
  const H = mm(height);
  const halfW = W / 2;
  const halfH = H / 2;

  // Opening angle (outward = +Z)
  const angle = (opening * MAX_ANGLE * Math.PI) / 180;

  // Pivot point depends on hinge type
  // Sash group is centered, so we need to offset to pivot edge
  let pivotPosition, pivotRotation, sashOffset;

  if (hingeType === 'left') {
    // Pivot on left edge — rotate around Y axis
    pivotPosition = [position[0] - halfW, position[1], position[2]];
    pivotRotation = [0, angle, 0];
    sashOffset = [halfW, 0, 0];
  } else if (hingeType === 'right') {
    // Pivot on right edge — rotate around Y axis (negative)
    pivotPosition = [position[0] + halfW, position[1], position[2]];
    pivotRotation = [0, -angle, 0];
    sashOffset = [-halfW, 0, 0];
  } else if (hingeType === 'top') {
    // Pivot on top edge — rotate around X axis
    pivotPosition = [position[0], position[1] + halfH, position[2]];
    pivotRotation = [angle, 0, 0];
    sashOffset = [0, -halfH, 0];
  } else {
    // Fixed (no opening)
    pivotPosition = position;
    pivotRotation = [0, 0, 0];
    sashOffset = [0, 0, 0];
  }

  return (
    <group position={pivotPosition} rotation={pivotRotation}>
      <group position={sashOffset}>
        <SashFrame
          width={width}
          height={height}
          extMat={extMat}
          intMat={intMat}
        />
      </group>
    </group>
  );
}

export { SASH_RAIL, SASH_DEPTH, MAX_ANGLE };
