/**
 * FixFrameWindow.jsx
 * Fixed frame only — no outer frame, no handles, no opening.
 * Shapes: rectangle, circle, gothic-arch, semi-circle, segmental-arch, elliptical-arch
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import CasementPanel from '../casement/CasementPanel';

const mm = (v) => v / 1000;

const FRAME_FACE = { standard: 64, fd30: 64, fd60: 100 };
const FRAME_DEPTH = 57;

/* ─── Glass material ─── */
function useGlassMaterial(finish) {
  return useMemo(() => {
    if (finish === 'frosted')
      return new THREE.MeshPhysicalMaterial({ color: '#c8dce8', roughness: 0.85, metalness: 0, transmission: 0.15, transparent: true, opacity: 0.96, thickness: 0.028, ior: 1.52, side: THREE.DoubleSide });
    if (finish === 'obscure')
      return new THREE.MeshPhysicalMaterial({ color: '#b8ccd8', roughness: 0.7, metalness: 0.02, transmission: 0.4, transparent: true, opacity: 0.85, thickness: 0.028, ior: 1.5, side: THREE.DoubleSide });
    return new THREE.MeshPhysicalMaterial({ color: '#d4e8f0', metalness: 0.05, roughness: 0.05, transmission: 0.92, transparent: true, opacity: 0.35, ior: 1.5, thickness: 0.028, side: THREE.DoubleSide });
  }, [finish]);
}

/* ─── Circle shape helper ─── */
function makeCirclePath(cx, cy, r, segs = 64) {
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

/* ─── Circular frame ─── */
function CircleFrame({ diameter, frameFace, mat, glassMat }) {
  const R = mm(diameter) / 2;
  const fw = mm(frameFace);
  const rInner = Math.max(R - fw, mm(20));
  const D = mm(FRAME_DEPTH);

  const frameGeo = useMemo(() => {
    const shape = new THREE.Shape();
    const outer = makeCirclePath(0, 0, R);
    shape.moveTo(outer[0][0], outer[0][1]);
    for (let i = 1; i < outer.length; i++) shape.lineTo(outer[i][0], outer[i][1]);

    const hole = new THREE.Path();
    const inner = makeCirclePath(0, 0, rInner);
    hole.moveTo(inner[0][0], inner[0][1]);
    for (let i = 1; i < inner.length; i++) hole.lineTo(inner[i][0], inner[i][1]);
    shape.holes.push(hole);

    const geo = new THREE.ExtrudeGeometry(shape, { depth: D, bevelEnabled: false });
    geo.translate(0, 0, -D / 2);
    geo.computeVertexNormals();
    return geo;
  }, [R, rInner, D]);

  const glassGeo = useMemo(() => new THREE.CircleGeometry(rInner - mm(2), 64), [rInner]);

  return (
    <group>
      <mesh geometry={frameGeo} castShadow receiveShadow>
        <primitive object={mat} attach="material" />
      </mesh>
      <mesh geometry={glassGeo} castShadow={false} receiveShadow>
        <primitive object={glassMat} attach="material" />
      </mesh>
    </group>
  );
}

/* ─── Arch contour builder ─── */
function archTopY(x, halfW, wallH, archRise, type) {
  const nx = halfW > 0 ? x / halfW : 0; // -1..1
  switch (type) {
    case 'gothic-arch':
      return wallH + archRise * Math.pow(1 - Math.abs(nx), 0.6);
    case 'semi-circle': {
      const t = 1 - nx * nx;
      return wallH + archRise * Math.sqrt(Math.max(0, t));
    }
    case 'segmental-arch':
      return wallH + archRise * (1 - nx * nx) * 0.7;
    case 'elliptical-arch':
      return wallH + archRise * Math.sqrt(Math.max(0, 1 - nx * nx));
    default:
      return wallH + archRise;
  }
}

/* ─── Arched frame ─── */
function ArchFrame({ width, height, archType, frameFace, mat, glassMat }) {
  const W = mm(width);
  const H = mm(height);
  const fw = mm(frameFace);
  const D = mm(FRAME_DEPTH);
  const halfW = W / 2;
  const segs = 48;
  const wallH = H * 0.55;
  const archRise = H - wallH;

  const frameGeo = useMemo(() => {
    // Outer contour: bottom-left → bottom-right → arch top (right to left)
    const shape = new THREE.Shape();
    shape.moveTo(-halfW, -H / 2);
    shape.lineTo(halfW, -H / 2);
    shape.lineTo(halfW, -H / 2 + wallH);
    for (let i = 0; i <= segs; i++) {
      const x = halfW - (i / segs) * W;
      const y = archTopY(x, halfW, wallH, archRise, archType) - H / 2;
      shape.lineTo(x, y);
    }
    shape.lineTo(-halfW, -H / 2 + wallH);
    shape.closePath();

    // Inner hole
    const iHW = halfW - fw;
    const iWallH = wallH - fw;
    const iRise = archRise - fw * 0.5;
    const hole = new THREE.Path();
    hole.moveTo(-iHW, -H / 2 + fw);
    hole.lineTo(iHW, -H / 2 + fw);
    hole.lineTo(iHW, -H / 2 + fw + iWallH);
    for (let i = 0; i <= segs; i++) {
      const xi = iHW - (i / segs) * (iHW * 2);
      const xOuter = xi * (halfW / Math.max(iHW, 0.001));
      const y = archTopY(xOuter, halfW, wallH, archRise, archType) - H / 2 - fw;
      hole.lineTo(xi, Math.max(y, -H / 2 + fw));
    }
    hole.lineTo(-iHW, -H / 2 + fw + iWallH);
    hole.closePath();
    shape.holes.push(hole);

    const geo = new THREE.ExtrudeGeometry(shape, { depth: D, bevelEnabled: false });
    geo.translate(0, 0, -D / 2);
    geo.computeVertexNormals();
    return geo;
  }, [W, H, fw, D, halfW, wallH, archRise, segs, archType]);

  // Glass — inner contour as flat shape
  const glassGeo = useMemo(() => {
    const iHW = halfW - fw;
    const iWallH = wallH - fw;
    const iRise = archRise - fw * 0.5;
    const shape = new THREE.Shape();
    shape.moveTo(-iHW, -H / 2 + fw);
    shape.lineTo(iHW, -H / 2 + fw);
    shape.lineTo(iHW, -H / 2 + fw + iWallH);
    for (let i = 0; i <= segs; i++) {
      const xi = iHW - (i / segs) * (iHW * 2);
      const xOuter = xi * (halfW / Math.max(iHW, 0.001));
      const y = archTopY(xOuter, halfW, wallH, archRise, archType) - H / 2 - fw;
      shape.lineTo(xi, Math.max(y, -H / 2 + fw));
    }
    shape.lineTo(-iHW, -H / 2 + fw + iWallH);
    shape.closePath();
    const geo = new THREE.ShapeGeometry(shape, 1);
    geo.computeVertexNormals();
    return geo;
  }, [W, H, fw, halfW, wallH, archRise, segs, archType]);

  return (
    <group>
      <mesh geometry={frameGeo} castShadow receiveShadow>
        <primitive object={mat} attach="material" />
      </mesh>
      <mesh geometry={glassGeo} castShadow={false} receiveShadow>
        <primitive object={glassMat} attach="material" />
      </mesh>
    </group>
  );
}

/* ─── Main component ─── */
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
  fixShape = 'rectangle',
  fixType = 'standard',
}) {
  const cExt = sameColor ? woodColor : woodColorExt;
  const cInt = sameColor ? woodColor : woodColorInt;
  const frameFace = FRAME_FACE[fixType] || 64;

  const extMaterial = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: cExt, roughness: 0.72, metalness: 0.02, clearcoat: 0.06, clearcoatRoughness: 0.4 }),
    [cExt]
  );
  const intMaterial = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: cInt, roughness: 0.72, metalness: 0.02, clearcoat: 0.06, clearcoatRoughness: 0.4 }),
    [cInt]
  );
  const glassMat = useGlassMaterial(glassFinish);

  if (fixShape === 'circle') {
    return (
      <CircleFrame diameter={width} frameFace={frameFace} mat={extMaterial} matInt={intMaterial} glassMat={glassMat} />
    );
  }

  if (['gothic-arch', 'semi-circle', 'segmental-arch', 'elliptical-arch'].includes(fixShape)) {
    return (
      <ArchFrame width={width} height={height} archType={fixShape} frameFace={frameFace} mat={extMaterial} matInt={intMaterial} glassMat={glassMat} />
    );
  }

  // Rectangle — reuse CasementPanel fixed
  return (
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
  );
}