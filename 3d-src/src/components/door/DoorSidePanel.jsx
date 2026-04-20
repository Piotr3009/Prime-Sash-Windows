// DoorSidePanel — sidelight panel attached to main door
// Simple rectangular frame (57mm face × 93mm depth) with glass and optional bars.
// Frame profile: chamfer EXT + ovolo INT (matches FixFrameWindow look, without rebate).
// Used as left / right sidelight next to the main door.

import React, { useMemo } from 'react';
import * as THREE from 'three';

const mm = (v) => v / 1000;

// Frame dimensions
const FRAME_FACE = 57;   // face width (visible from front) in mm
const FRAME_DEPTH = 93;  // depth (matches door frame depth) in mm

// Glass unit
const GLASS_UNIT_DEPTH = mm(28);

// Frame profile details (same as FixFrameWindow internal look)
const EBW = mm(9);       // chamfer EXT width (face)
const EBD = mm(15);      // chamfer EXT depth
const IBW = mm(18);      // ovolo INT width (face)
const IBD = mm(14);      // ovolo INT depth
const IBR = mm(11);      // ovolo INT radius
const OVOLO_STEPS = 32;

// Bar dimensions
const BAR_W = mm(22);
const BAR_TOP = mm(2);
const BAR_H = mm(16.5);
const SPACER_BAR_W = mm(18);
const SPACER_DEPTH = mm(16);

// Spacer colors (matches FixFrameWindow palette)
const SPACER_COLORS = {
  silver: '#C0C4C8',
  white: '#F5F5F5',
  black: '#222222',
  bronze: '#8B6F47',
};

// Build a 2D shape from ordered XY points
function shapeFromPts(pts) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  return s;
}

// Build ovolo arc points (quarter circle segment)
function ovoloArc(cx, cy, r, startAngle, endAngle, segs) {
  const pts = [];
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    const a = startAngle + (endAngle - startAngle) * t;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

// Glass material
function useGlassMat(finish) {
  return useMemo(() => {
    const isFrosted = finish === 'frosted' || finish === 'obscure';
    return new THREE.MeshPhysicalMaterial({
      color: isFrosted ? '#DDE6EA' : '#A9C6D6',
      roughness: isFrosted ? 0.6 : 0.08,
      metalness: 0.0,
      transmission: isFrosted ? 0.4 : 0.9,
      thickness: 0.02,
      ior: 1.5,
      opacity: isFrosted ? 0.75 : 0.35,
      transparent: true,
      clearcoat: 0.3,
      clearcoatRoughness: 0.15,
    });
  }, [finish]);
}

// Frame geometry (rectangular frame with hole in the middle, chamfer/ovolo profile split EXT/INT)
function makeFrameGeo(outerW, outerH, innerW, innerH, depth) {
  const shape = new THREE.Shape();
  const ow = outerW / 2, oh = outerH / 2;
  shape.moveTo(-ow, -oh);
  shape.lineTo(ow, -oh);
  shape.lineTo(ow, oh);
  shape.lineTo(-ow, oh);
  shape.lineTo(-ow, -oh);
  const hole = new THREE.Path();
  const iw = innerW / 2, ih = innerH / 2;
  hole.moveTo(-iw, -ih);
  hole.lineTo(iw, -ih);
  hole.lineTo(iw, ih);
  hole.lineTo(-iw, ih);
  hole.lineTo(-iw, -ih);
  shape.holes.push(hole);

  const halfD = depth / 2;
  const ext = new THREE.ExtrudeGeometry(shape, { depth: halfD, bevelEnabled: false });
  ext.computeVertexNormals();
  const int = new THREE.ExtrudeGeometry(shape, { depth: halfD, bevelEnabled: false });
  int.translate(0, 0, -halfD);
  int.computeVertexNormals();
  return { ext, int };
}

// Frame mesh (dual EXT/INT material)
function FrameMesh({ geometry, matExt, matInt }) {
  return (
    <group>
      <mesh geometry={geometry.ext} castShadow receiveShadow>
        <primitive object={matExt} attach="material" />
      </mesh>
      <mesh geometry={geometry.int} castShadow receiveShadow>
        <primitive object={matInt || matExt} attach="material" />
      </mesh>
    </group>
  );
}

// Bar (h or v) — simple box with spacer strip visible
function Bar({ position, rotation, length, matExt, matInt, spacerColor }) {
  const spacerCol = SPACER_COLORS[spacerColor] || SPACER_COLORS.silver;
  const spacerMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: spacerCol, roughness: 0.5, metalness: 0.1 }),
    [spacerCol]
  );
  return (
    <group position={position} rotation={rotation}>
      {/* Wood bar body */}
      <mesh castShadow receiveShadow position={[0, 0, mm(FRAME_DEPTH) / 4]}>
        <boxGeometry args={[BAR_W, length, mm(FRAME_DEPTH) / 2]} />
        <primitive object={matExt} attach="material" />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 0, -mm(FRAME_DEPTH) / 4]}>
        <boxGeometry args={[BAR_W, length, mm(FRAME_DEPTH) / 2]} />
        <primitive object={matInt || matExt} attach="material" />
      </mesh>
      {/* Spacer strip centered at Z=0 */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[SPACER_BAR_W, length, SPACER_DEPTH]} />
        <primitive object={spacerMat} attach="material" />
      </mesh>
    </group>
  );
}

export default function DoorSidePanel({
  width = 400,
  height = 2100,
  woodColor = '#F6F6F6',
  woodColorExt = '#F6F6F6',
  woodColorInt = '#F6F6F6',
  sameColor = true,
  spacerColor = 'silver',
  glassFinish = 'clear',
  hBars = 0,
  vBars = 0,
  position = [0, 0, 0],
}) {
  const cExt = sameColor ? woodColor : woodColorExt;
  const cInt = sameColor ? woodColor : woodColorInt;

  const extMat = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: cExt, roughness: 0.72, metalness: 0.02, clearcoat: 0.06, clearcoatRoughness: 0.4 }),
    [cExt]
  );
  const intMat = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: cInt, roughness: 0.72, metalness: 0.02, clearcoat: 0.06, clearcoatRoughness: 0.4 }),
    [cInt]
  );
  const glassMat = useGlassMat(glassFinish);

  const W = mm(width);
  const H = mm(height);
  const D = mm(FRAME_DEPTH);
  const F = mm(FRAME_FACE);
  const innerW = W - F * 2;
  const innerH = H - F * 2;

  // Frame geometry (rectangular with hole)
  const frameGeo = useMemo(
    () => makeFrameGeo(W, H, innerW, innerH, D),
    [W, H, innerW, innerH, D]
  );

  // Glass size (fits inside inner frame opening, with small overlap with frame profile)
  const glassW = innerW + mm(6);  // slight overlap behind frame edges
  const glassH = innerH + mm(6);

  // Bar positions — evenly spaced inside inner frame
  const hBarPositions = useMemo(() => {
    if (hBars <= 0) return [];
    const positions = [];
    for (let i = 1; i <= hBars; i++) {
      const y = -innerH / 2 + (innerH * i) / (hBars + 1);
      positions.push(y);
    }
    return positions;
  }, [hBars, innerH]);

  const vBarPositions = useMemo(() => {
    if (vBars <= 0) return [];
    const positions = [];
    for (let i = 1; i <= vBars; i++) {
      const x = -innerW / 2 + (innerW * i) / (vBars + 1);
      positions.push(x);
    }
    return positions;
  }, [vBars, innerW]);

  return (
    <group position={position}>
      {/* Outer frame (rectangular, hole in middle) */}
      <FrameMesh geometry={frameGeo} matExt={extMat} matInt={intMat} />

      {/* Glass pane inside the opening */}
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[glassW, glassH, GLASS_UNIT_DEPTH]} />
        <primitive object={glassMat} attach="material" />
      </mesh>

      {/* Horizontal bars (run across X, stacked in Y) */}
      {hBarPositions.map((y, i) => (
        <Bar
          key={`h-${i}`}
          position={[0, y, 0]}
          rotation={[0, 0, Math.PI / 2]}
          length={innerW}
          matExt={extMat}
          matInt={intMat}
          spacerColor={spacerColor}
        />
      ))}

      {/* Vertical bars (run along Y, spaced in X) */}
      {vBarPositions.map((x, i) => (
        <Bar
          key={`v-${i}`}
          position={[x, 0, 0]}
          rotation={[0, 0, 0]}
          length={innerH}
          matExt={extMat}
          matInt={intMat}
          spacerColor={spacerColor}
        />
      ))}
    </group>
  );
}
