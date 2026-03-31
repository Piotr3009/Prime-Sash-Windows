/**
 * CasementFrame.jsx
 * Outer fixed frame for casement windows.
 * Profile: L-shape, 93mm total depth (36mm ext / 57mm int), single piece of timber.
 * 
 * Props:
 *   width      – frame outer width in mm
 *   height     – frame outer height in mm
 *   material   – THREE material for exterior
 *   materialInt – THREE material for interior (dual color)
 *   mullions   – array of x-positions (mm from left) for vertical mullions
 *   transoms   – array of y-positions (mm from bottom) for horizontal transoms
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';

const mm = (v) => v / 1000;

// Frame profile constants (mm)
const FRAME_FACE = 65;       // visible face width of frame members
const FRAME_DEPTH = 93;      // total depth
const EXT_DEPTH = 36;        // exterior rebate depth
const INT_DEPTH = 57;        // interior depth
const REBATE_STEP = 12;      // rebate ledge width (where sash seats)
const MULLION_W = 50;        // mullion width

// Single L-shape frame member: 2 boxes
// Face colors matching numbered circles
const FACE_COLORS = {
  1: '#e74c3c', // Ext front
  2: '#2980b9', // Ext bottom
  3: '#27ae60', // Ext inner top
  4: '#f39c12', // Int bottom
  5: '#9b59b6', // Junction
  6: '#e67e22', // Int back (room)
  7: '#1abc9c', // Int inner top
  8: '#c0392b', // Rebate step
};

function FrameMemberL({ length, position, rotation, extMat, intMat, debugColors = false }) {
  const fW = mm(FRAME_FACE);
  const extD = mm(EXT_DEPTH);
  const intD = mm(INT_DEPTH);
  const rebate = mm(REBATE_STEP);
  const len = mm(length);
  const intFaceW = fW - rebate;

  // Per-face materials for ext block: [+x, -x, +y, -y, +z, -z]
  // +z=front(F1), -z=junction(F5), +y=innerTop(F3), -y=bottom(F2), ±x=endcaps
  const extFaceMats = useMemo(() => {
    if (!debugColors) return null;
    return [
      new THREE.MeshStandardMaterial({ color: '#888' }),      // +x endcap
      new THREE.MeshStandardMaterial({ color: '#888' }),      // -x endcap
      new THREE.MeshStandardMaterial({ color: FACE_COLORS[3] }), // +y inner top
      new THREE.MeshStandardMaterial({ color: FACE_COLORS[2] }), // -y bottom
      new THREE.MeshStandardMaterial({ color: FACE_COLORS[1] }), // +z ext front
      new THREE.MeshStandardMaterial({ color: FACE_COLORS[5] }), // -z junction
    ];
  }, [debugColors]);

  // Per-face materials for int block: [+x, -x, +y, -y, +z, -z]
  // +z=junction(F5), -z=room(F6), +y=innerTop(F7), -y=bottom(F4), ±x=endcaps
  const intFaceMats = useMemo(() => {
    if (!debugColors) return null;
    return [
      new THREE.MeshStandardMaterial({ color: '#888' }),      // +x endcap
      new THREE.MeshStandardMaterial({ color: '#888' }),      // -x endcap
      new THREE.MeshStandardMaterial({ color: FACE_COLORS[7] }), // +y inner top
      new THREE.MeshStandardMaterial({ color: FACE_COLORS[4] }), // -y bottom
      new THREE.MeshStandardMaterial({ color: FACE_COLORS[5] }), // +z junction
      new THREE.MeshStandardMaterial({ color: FACE_COLORS[6] }), // -z room
    ];
  }, [debugColors]);

  return (
    <group position={position} rotation={rotation}>
      {/* Exterior block */}
      <mesh castShadow receiveShadow
        material={debugColors ? extFaceMats : undefined}
      >
        <boxGeometry args={[len, fW, extD]} />
        {!debugColors && <primitive object={extMat} attach="material" />}
      </mesh>
      {/* Interior block — shifted toward interior and narrower */}
      <mesh castShadow receiveShadow
        position={[0, -rebate / 2, -(extD / 2 + intD / 2)]}
        material={debugColors ? intFaceMats : undefined}
      >
        <boxGeometry args={[len, intFaceW, intD]} />
        {!debugColors && <primitive object={intMat || extMat} attach="material" />}
      </mesh>
      {/* Rebate step — small horizontal surface between ext and int */}
      {debugColors && (
        <mesh position={[0, -fW / 2 + intFaceW / 2, -(extD / 2)]}>
          <boxGeometry args={[len, rebate, mm(2)]} />
          <meshStandardMaterial color={FACE_COLORS[8]} />
        </mesh>
      )}
    </group>
  );
}

export default function CasementFrame({
  width = 800,
  height = 1200,
  material,
  materialInt,
  mullions = [],
  transoms = [],
  debugColors = false,
}) {
  const extMat = material;
  const intMat = materialInt || material;

  const W = mm(width);
  const H = mm(height);
  const fW = mm(FRAME_FACE);
  const halfDepth = mm(FRAME_DEPTH) / 2;

  // Center of frame depth — exterior face at z=0, interior at z=-93mm
  const zCenter = -halfDepth;

  return (
    <group position={[0, 0, zCenter]}>
      {/* Bottom rail */}
      <FrameMemberL
        length={width}
        position={[0, -H / 2 + fW / 2, 0]}
        rotation={[0, 0, 0]}
        extMat={extMat}
        intMat={intMat}
        debugColors={debugColors}
      />
      {/* Top rail */}
      <FrameMemberL
        length={width}
        position={[0, H / 2 - fW / 2, 0]}
        rotation={[0, 0, Math.PI]}
        extMat={extMat}
        intMat={intMat}
        debugColors={debugColors}
      />
      {/* Left stile */}
      <FrameMemberL
        length={height - FRAME_FACE * 2}
        position={[-W / 2 + fW / 2, 0, 0]}
        rotation={[0, 0, -Math.PI / 2]}
        extMat={extMat}
        intMat={intMat}
        debugColors={debugColors}
      />
      {/* Right stile */}
      <FrameMemberL
        length={height - FRAME_FACE * 2}
        position={[W / 2 - fW / 2, 0, 0]}
        rotation={[0, 0, Math.PI / 2]}
        extMat={extMat}
        intMat={intMat}
        debugColors={debugColors}
      />

      {/* Mullions */}
      {mullions.map((xPos, i) => {
        const x = -W / 2 + mm(xPos);
        const innerH = height - FRAME_FACE * 2;
        return (
          <FrameMemberL
            key={`mull-${i}`}
            length={innerH}
            position={[x, 0, 0]}
            rotation={[0, 0, Math.PI / 2]}
            extMat={extMat}
            intMat={intMat}
            debugColors={debugColors}
          />
        );
      })}

      {/* Transoms */}
      {transoms.map((yPos, i) => {
        const y = -H / 2 + mm(yPos);
        const innerW = width - FRAME_FACE * 2;
        return (
          <FrameMemberL
            key={`transom-${i}`}
            length={innerW}
            position={[0, y, 0]}
            rotation={[0, 0, 0]}
            extMat={extMat}
            intMat={intMat}
            debugColors={debugColors}
          />
        );
      })}
    </group>
  );
}

export { FRAME_FACE, FRAME_DEPTH, EXT_DEPTH, INT_DEPTH, REBATE_STEP, MULLION_W, mm };