/**
 * CasementFrame.jsx
 * Outer fixed frame for casement windows.
 * 
 * Sides + Top: L-shape, 57mm face, 93mm depth (57ext + 36int), 21mm rebate
 * Bottom rail: L-shape with SLOPE, 68mm face, 93mm depth (62ext + 31int)
 *   Ext block = trapezoid: 36mm at exterior → 47mm at junction, 62mm deep
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';

const mm = (v) => v / 1000;

// Side/Top frame constants (mm)
const FRAME_FACE = 57;
const FRAME_DEPTH = 93;
const EXT_DEPTH = 57;
const INT_DEPTH = 36;
const REBATE_STEP = 21;
const MULLION_W = 50;

// Bottom rail constants (mm)
const BOTTOM_FACE = 68;
const BOTTOM_EXT_DEPTH = 62;
const BOTTOM_INT_DEPTH = 31;
const BOTTOM_EXT_OUTER = 36;
const BOTTOM_INNER_FACE = BOTTOM_FACE - REBATE_STEP; // 47mm

// Debug colors
const FACE_COLORS = {
  1: '#e74c3c', 2: '#2980b9', 3: '#27ae60', 4: '#f39c12',
  5: '#9b59b6', 6: '#e67e22', 7: '#1abc9c', 8: '#c0392b',
};

// ═══ Standard L-shape member (top rail, stiles, mullions, transoms) ═══
function FrameMemberL({ length, position, rotation, extMat, intMat, debugColors = false }) {
  const fW = mm(FRAME_FACE);
  const extD = mm(EXT_DEPTH);
  const intD = mm(INT_DEPTH);
  const rebate = mm(REBATE_STEP);
  const len = mm(length);
  const intFaceW = fW - rebate;

  const extFaceMats = useMemo(() => {
    if (!debugColors) return null;
    return [
      new THREE.MeshStandardMaterial({ color: '#888' }),
      new THREE.MeshStandardMaterial({ color: '#888' }),
      new THREE.MeshStandardMaterial({ color: FACE_COLORS[3] }),
      new THREE.MeshStandardMaterial({ color: FACE_COLORS[2] }),
      new THREE.MeshStandardMaterial({ color: FACE_COLORS[1] }),
      new THREE.MeshStandardMaterial({ color: FACE_COLORS[5] }),
    ];
  }, [debugColors]);

  const intFaceMats = useMemo(() => {
    if (!debugColors) return null;
    return [
      new THREE.MeshStandardMaterial({ color: '#888' }),
      new THREE.MeshStandardMaterial({ color: '#888' }),
      new THREE.MeshStandardMaterial({ color: FACE_COLORS[7] }),
      new THREE.MeshStandardMaterial({ color: FACE_COLORS[4] }),
      new THREE.MeshStandardMaterial({ color: FACE_COLORS[5] }),
      new THREE.MeshStandardMaterial({ color: FACE_COLORS[6] }),
    ];
  }, [debugColors]);

  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow receiveShadow material={debugColors ? extFaceMats : undefined}>
        <boxGeometry args={[len, fW, extD]} />
        {!debugColors && <primitive object={extMat} attach="material" />}
      </mesh>
      <mesh castShadow receiveShadow
        position={[0, -rebate / 2, -(extD / 2 + intD / 2)]}
        material={debugColors ? intFaceMats : undefined}
      >
        <boxGeometry args={[len, intFaceW, intD]} />
        {!debugColors && <primitive object={intMat || extMat} attach="material" />}
      </mesh>
      {debugColors && (
        <mesh position={[0, -fW / 2 + intFaceW / 2, -(extD / 2)]}>
          <boxGeometry args={[len, rebate, mm(2)]} />
          <meshStandardMaterial color={FACE_COLORS[8]} />
        </mesh>
      )}
    </group>
  );
}

// ═══ Bottom rail with slope (ExtrudeGeometry) ═══
function BottomRailL({ width, extMat, intMat, debugColors = false }) {
  const railLen = mm(width);

  // L-shape cross-section with slope on ext part
  // Shape XY: X = depth (ext→int), Y = height (bottom→top)
  // Origin at exterior-bottom corner
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(0, mm(BOTTOM_EXT_OUTER));
    s.lineTo(mm(BOTTOM_EXT_DEPTH), mm(BOTTOM_INNER_FACE));
    s.lineTo(mm(BOTTOM_EXT_DEPTH), mm(BOTTOM_FACE));
    s.lineTo(mm(BOTTOM_EXT_DEPTH + BOTTOM_INT_DEPTH), mm(BOTTOM_FACE));
    s.lineTo(mm(BOTTOM_EXT_DEPTH + BOTTOM_INT_DEPTH), 0);
    s.closePath();
    return s;
  }, []);

  const extSettings = useMemo(() => ({
    depth: railLen,
    bevelEnabled: false,
  }), [railLen]);

  // After rotation [0, -π/2, 0]:
  //   shape X (depth) → world -Z (ext at +Z, int at -Z)
  //   shape Y (height) → world +Y (bottom at 0, top at 68mm)
  //   extrude Z (length) → world +X
  // Align ext front face with side stile ext front face
  const extFrontZ = mm(EXT_DEPTH) / 2;

  const debugMat = useMemo(() => {
    if (!debugColors) return null;
    return new THREE.MeshStandardMaterial({ color: '#e74c3c', opacity: 0.85, transparent: true });
  }, [debugColors]);

  return (
    <mesh
      castShadow
      receiveShadow
      rotation={[0, -Math.PI / 2, 0]}
      position={[-railLen / 2, 0, extFrontZ]}
    >
      <extrudeGeometry args={[shape, extSettings]} />
      {debugColors
        ? <primitive object={debugMat} attach="material" />
        : <primitive object={extMat} attach="material" />
      }
    </mesh>
  );
}

// ═══ Main frame component ═══
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
  const bfW = mm(BOTTOM_FACE);
  const halfDepth = mm(FRAME_DEPTH) / 2;
  const zCenter = -halfDepth;

  // Stiles: between top rail (57mm) and bottom rail (68mm)
  const stileLength = height - FRAME_FACE - BOTTOM_FACE;
  // Stile center Y offset (top smaller, bottom bigger)
  const stileCenterY = (mm(FRAME_FACE) - mm(BOTTOM_FACE)) / 2;

  return (
    <group position={[0, 0, zCenter]}>
      {/* Bottom rail — slope profile */}
      <group position={[0, -H / 2, 0]}>
        <BottomRailL
          width={width}
          extMat={extMat}
          intMat={intMat}
          debugColors={debugColors}
        />
      </group>

      {/* Top rail — standard L-shape */}
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
        length={stileLength}
        position={[-W / 2 + fW / 2, stileCenterY, 0]}
        rotation={[0, 0, -Math.PI / 2]}
        extMat={extMat}
        intMat={intMat}
        debugColors={debugColors}
      />

      {/* Right stile */}
      <FrameMemberL
        length={stileLength}
        position={[W / 2 - fW / 2, stileCenterY, 0]}
        rotation={[0, 0, Math.PI / 2]}
        extMat={extMat}
        intMat={intMat}
        debugColors={debugColors}
      />

      {/* Mullions */}
      {mullions.map((xPos, i) => {
        const x = -W / 2 + mm(xPos);
        return (
          <FrameMemberL
            key={`mull-${i}`}
            length={stileLength}
            position={[x, stileCenterY, 0]}
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

export { FRAME_FACE, FRAME_DEPTH, EXT_DEPTH, INT_DEPTH, REBATE_STEP, MULLION_W, BOTTOM_FACE, BOTTOM_EXT_DEPTH, BOTTOM_INT_DEPTH, BOTTOM_EXT_OUTER, BOTTOM_INNER_FACE, mm };