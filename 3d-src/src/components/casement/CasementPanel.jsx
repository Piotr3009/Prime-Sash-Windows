/**
 * CasementPanel.jsx
 * Opening sash/leaf for casement window.
 * Profile matches sash windows:
 *   - Chamfer 9×15mm on glazing EXT side
 *   - Ovolo R11 (18×14mm zone) on glazing INT side
 *   - Outer edge: flat (faces frame rebate)
 * Dims: 64mm face × 57mm depth
 * Bottom rail: slope matching frame's bottom rail
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import CasementGlazing from './CasementGlazing';

const mm = (v) => v / 1000;

// Leaf constants
const SASH_RAIL = 64;    // face width (mm)
const SASH_DEPTH = 57;   // depth (mm)
const MAX_ANGLE = 70;

// Bead constants (identical to sash)
const EXT_BEAD_W = 9;
const EXT_BEAD_D = 15;
const INT_BEAD_W = 18;
const INT_BEAD_D = 14;
const INT_BEAD_R = 11;
const OVOLO_SAMPLES = 16;

// ─── Build leaf member profile ───
// u = face direction (0=outer edge, SASH_RAIL=glazing edge)
// v = depth direction (0=EXT/street, SASH_DEPTH=INT/room)
// Returns Shape in mm
function buildLeafShape() {
  const f = mm(SASH_RAIL);
  const d = mm(SASH_DEPTH);
  const ebw = mm(EXT_BEAD_W);
  const ebd = mm(EXT_BEAD_D);
  const ibd = mm(INT_BEAD_D);
  const ibr = mm(INT_BEAD_R);

  // Ovolo arc center
  const arcCU = f - mm(INT_BEAD_R); // face - R
  const arcCV = d - mm(INT_BEAD_R); // depth - R
  // Short straight from core step to arc start: 3mm = INT_BEAD_D - INT_BEAD_R
  const straightEnd = d - ibd + (ibd - ibr); // = d - ibr

  const s = new THREE.Shape();
  // 1. Outer-ext corner
  s.moveTo(0, 0);
  // 2. Ext face to chamfer start
  s.lineTo(f - ebw, 0);
  // 3. Chamfer (glazing ext)
  s.lineTo(f, ebd);
  // 4. Down glazing edge to ovolo zone
  s.lineTo(f, straightEnd);
  // 5. Ovolo arc: from (f, straightEnd) to (arcCU, d)
  //    Center: (arcCU, arcCV) = (f-R, d-R), R = ibr
  //    Start angle: 0 (pointing right = +u), End angle: PI/2 (pointing down = +v)
  for (let i = 1; i <= OVOLO_SAMPLES; i++) {
    const t = i / OVOLO_SAMPLES;
    const angle = t * Math.PI / 2;
    const pu = arcCU + Math.cos(angle) * ibr;
    const pv = arcCV + Math.sin(angle) * ibr;
    s.lineTo(pu, pv);
  }
  // 6. Flat on INT face to outer edge
  s.lineTo(0, d);
  s.closePath();
  return s;
}

// ─── Mirror shape for opposite side ───
function buildLeafShapeMirrored() {
  const f = mm(SASH_RAIL);
  const d = mm(SASH_DEPTH);
  const ebw = mm(EXT_BEAD_W);
  const ebd = mm(EXT_BEAD_D);
  const ibd = mm(INT_BEAD_D);
  const ibr = mm(INT_BEAD_R);

  const arcCU = mm(INT_BEAD_R); // mirrored: R from left
  const arcCV = d - mm(INT_BEAD_R);
  const straightEnd = d - ibd + (ibd - ibr);

  const s = new THREE.Shape();
  s.moveTo(f, 0);
  s.lineTo(ebw, 0);
  s.lineTo(0, ebd);
  s.lineTo(0, straightEnd);
  for (let i = 1; i <= OVOLO_SAMPLES; i++) {
    const t = i / OVOLO_SAMPLES;
    const angle = Math.PI / 2 + t * Math.PI / 2;
    const pu = arcCU + Math.cos(angle) * ibr;
    const pv = arcCV + Math.sin(angle) * ibr;
    s.lineTo(pu, pv);
  }
  s.lineTo(f, d);
  s.closePath();
  return s;
}

// ═══ SashFrame with profiled members ═══
function SashFrame({ width, height, extMat, intMat }) {
  const W = mm(width);
  const H = mm(height);
  const f = mm(SASH_RAIL);
  const d = mm(SASH_DEPTH);
  const halfD = d / 2;

  // Stile height (between rails)
  const stileH = H - f * 2;

  // Glass opening
  const glassW = width - SASH_RAIL * 2;
  const glassH = height - SASH_RAIL * 2;

  // Shapes for stiles: left glazing=right(+X), right glazing=left(-X)
  const leftStileShape = useMemo(() => buildLeafShape(), []);
  const rightStileShape = useMemo(() => buildLeafShapeMirrored(), []);
  // Rails: bottom glazing=up(+Y), top glazing=down(-Y)
  const bottomRailShape = useMemo(() => buildLeafShape(), []);
  const topRailShape = useMemo(() => buildLeafShapeMirrored(), []);

  return (
    <group>
      {/* ─── Left stile ─── */}
      {/* Shape XY: X=face(outer→glazing), Y=depth(ext→int) */}
      {/* Rotation [-PI/2, 0, 0]: X→X, Y→-Z, extrudeZ→+Y */}
      {/* Position: outer edge at -W/2, bottom at -stileH/2, ext at +halfD */}
      <mesh castShadow receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
        position={[-W / 2, -stileH / 2, halfD]}
      >
        <extrudeGeometry args={[leftStileShape, { depth: stileH, bevelEnabled: false }]} />
        <primitive object={extMat} attach="material" />
      </mesh>

      {/* ─── Right stile ─── */}
      <mesh castShadow receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
        position={[W / 2 - f, -stileH / 2, halfD]}
      >
        <extrudeGeometry args={[rightStileShape, { depth: stileH, bevelEnabled: false }]} />
        <primitive object={extMat} attach="material" />
      </mesh>

      {/* ─── Bottom rail ─── */}
      {/* Shape XY: X=face(outer→glazing), Y=depth(ext→int) */}
      {/* Rotation [0, PI/2, 0]: X→-Z, Y→Y, extrudeZ→+X */}
      <mesh castShadow receiveShadow
        rotation={[0, Math.PI / 2, 0]}
        position={[-W / 2, -H / 2, halfD]}
      >
        <extrudeGeometry args={[bottomRailShape, { depth: W, bevelEnabled: false }]} />
        <primitive object={extMat} attach="material" />
      </mesh>

      {/* ─── Top rail ─── */}
      <mesh castShadow receiveShadow
        rotation={[0, Math.PI / 2, 0]}
        position={[-W / 2, H / 2 - f, halfD]}
      >
        <extrudeGeometry args={[topRailShape, { depth: W, bevelEnabled: false }]} />
        <primitive object={extMat} attach="material" />
      </mesh>

      {/* ─── Glazing ─── */}
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

// ═══ Main CasementPanel ═══
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

  const angle = (opening * MAX_ANGLE * Math.PI) / 180;

  let pivotPosition, pivotRotation, sashOffset;

  if (hingeType === 'left') {
    pivotPosition = [position[0] - halfW, position[1], position[2]];
    pivotRotation = [0, angle, 0];
    sashOffset = [halfW, 0, 0];
  } else if (hingeType === 'right') {
    pivotPosition = [position[0] + halfW, position[1], position[2]];
    pivotRotation = [0, -angle, 0];
    sashOffset = [-halfW, 0, 0];
  } else if (hingeType === 'top') {
    pivotPosition = [position[0], position[1] + halfH, position[2]];
    pivotRotation = [angle, 0, 0];
    sashOffset = [0, -halfH, 0];
  } else {
    // Fixed
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