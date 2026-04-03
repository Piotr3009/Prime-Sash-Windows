/**
 * FixFrameWindow.jsx
 * Fixed frame only — no outer frame, no handles, no opening.
 * Shapes: rectangle, circle, gothic-arch, semi-circle, segmental-arch, elliptical-arch
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Text, Line } from '@react-three/drei';
import CasementPanel from '../casement/CasementPanel';

const mm = (v) => v / 1000;

const FRAME_FACE = 64;
const FRAME_DEPTH = { standard: 57, fd30: 57, fd60: 100 };

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

/* ─── Arc helpers ─── */
function arcPoints(cx, cy, r, startAngle, endAngle, segs) {
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const a = startAngle + t * (endAngle - startAngle);
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

/* ─── Circular frame ─── */
function CircleFrame({ diameter, depth, mat, glassMat }) {
  const R = mm(diameter) / 2;
  const fw = mm(FRAME_FACE);
  const rInner = Math.max(R - fw, mm(20));
  const D = mm(depth);

  const frameGeo = useMemo(() => {
    const segs = 64;
    const shape = new THREE.Shape();
    const outer = arcPoints(0, 0, R, 0, Math.PI * 2, segs);
    shape.moveTo(outer[0][0], outer[0][1]);
    for (let i = 1; i < outer.length; i++) shape.lineTo(outer[i][0], outer[i][1]);
    const hole = new THREE.Path();
    const inner = arcPoints(0, 0, rInner, 0, Math.PI * 2, segs);
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
      <mesh geometry={frameGeo} castShadow receiveShadow><primitive object={mat} attach="material" /></mesh>
      <mesh geometry={glassGeo} castShadow={false} receiveShadow><primitive object={glassMat} attach="material" /></mesh>
    </group>
  );
}

/* ─── Gothic arch — true equilateral pointed arch ─── */
function GothicArchFrame({ width, height, depth, mat, glassMat, gothicBars = 'none' }) {
  const W = mm(width);
  const H = mm(height);
  const fw = mm(FRAME_FACE);
  const D = mm(depth);
  const halfW = W / 2;
  const archRise = W * Math.sqrt(3) / 2;
  const straightWall = Math.max(H - archRise, mm(50));
  const springY = -H / 2 + straightWall;
  const segs = 48;
  const BAR_W = mm(22);  // bar width
  const BAR_D = mm(16);  // bar depth

  // Inner contour dimensions (glass area)
  const iHalfW = halfW - fw;
  const Ri = W - fw;
  const iBottom = -H / 2 + fw;

  // Find Y where vertical bar at x hits inner arch
  function archYAtX(x) {
    // Right arc (center -halfW, springY) active for x >= 0
    // Left arc (center halfW, springY) active for x < 0
    if (x >= 0) {
      const dx = x - (-halfW);
      const sq = Ri * Ri - dx * dx;
      return sq > 0 ? springY + Math.sqrt(sq) : springY;
    } else {
      const dx = x - halfW;
      const sq = Ri * Ri - dx * dx;
      return sq > 0 ? springY + Math.sqrt(sq) : springY;
    }
  }

  const frameGeo = useMemo(() => {
    // Right arc: center (-halfW, springY), radius W, from 0 to π/3
    const rightArc = arcPoints(-halfW, springY, W, 0, Math.PI / 3, segs);
    // Left arc: center (halfW, springY), radius W, from 2π/3 to π
    const leftArc = arcPoints(halfW, springY, W, 2 * Math.PI / 3, Math.PI, segs);

    const shape = new THREE.Shape();
    shape.moveTo(-halfW, -H / 2);
    shape.lineTo(halfW, -H / 2);
    shape.lineTo(halfW, springY);
    for (const p of rightArc) shape.lineTo(p[0], p[1]);
    for (const p of leftArc) shape.lineTo(p[0], p[1]);
    shape.lineTo(-halfW, springY);
    shape.closePath();

    // Inner hole — same centers, radius W - fw
    const iHalfW = halfW - fw;
    const Ri = W - fw;
    const iRightArc = arcPoints(-halfW, springY, Ri, 0, Math.PI / 3, segs);
    const iLeftArc = arcPoints(halfW, springY, Ri, 2 * Math.PI / 3, Math.PI, segs);

    const hole = new THREE.Path();
    hole.moveTo(-iHalfW, -H / 2 + fw);
    hole.lineTo(iHalfW, -H / 2 + fw);
    hole.lineTo(iHalfW, springY);
    for (const p of iRightArc) hole.lineTo(p[0], p[1]);
    for (const p of iLeftArc) hole.lineTo(p[0], p[1]);
    hole.lineTo(-iHalfW, springY);
    hole.closePath();
    shape.holes.push(hole);

    const geo = new THREE.ExtrudeGeometry(shape, { depth: D, bevelEnabled: false });
    geo.translate(0, 0, -D / 2);
    geo.computeVertexNormals();
    return geo;
  }, [W, H, fw, D, halfW, springY, segs]);

  const glassGeo = useMemo(() => {
    const iHalfW = halfW - fw;
    const Ri = W - fw;
    const iRightArc = arcPoints(-halfW, springY, Ri, 0, Math.PI / 3, segs);
    const iLeftArc = arcPoints(halfW, springY, Ri, 2 * Math.PI / 3, Math.PI, segs);
    const shape = new THREE.Shape();
    shape.moveTo(-iHalfW, -H / 2 + fw);
    shape.lineTo(iHalfW, -H / 2 + fw);
    shape.lineTo(iHalfW, springY);
    for (const p of iRightArc) shape.lineTo(p[0], p[1]);
    for (const p of iLeftArc) shape.lineTo(p[0], p[1]);
    shape.lineTo(-iHalfW, springY);
    shape.closePath();
    return new THREE.ShapeGeometry(shape, 1);
  }, [W, H, fw, halfW, springY, segs]);

  // Bar material
  const barMat = mat;

  // Pattern A bars: springing line + 2 verticals clipped at arch
  const bars = useMemo(() => {
    if (gothicBars !== 'patternA') return [];
    const result = [];
    // Horizontal bar at springing line
    result.push({ args: [iHalfW * 2, BAR_W, BAR_D], pos: [0, springY, 0] });
    // 2 vertical bars at 1/3 and 2/3, clipped at arch curve
    const x1 = -iHalfW + (iHalfW * 2) / 3;
    const x2 = -iHalfW + (iHalfW * 2) * 2 / 3;
    for (const x of [x1, x2]) {
      const topY = archYAtX(x) - BAR_W / 2;
      const barH = topY - iBottom;
      if (barH > 0) result.push({ args: [BAR_W, barH, BAR_D], pos: [x, iBottom + barH / 2, 0] });
    }
    return result;
  }, [gothicBars, iHalfW, iBottom, springY, BAR_W, BAR_D]);

  return (
    <group>
      <mesh geometry={frameGeo} castShadow receiveShadow><primitive object={mat} attach="material" /></mesh>
      <mesh geometry={glassGeo} castShadow={false} receiveShadow><primitive object={glassMat} attach="material" /></mesh>
      {bars.map((b, i) => (
        <mesh key={i} position={b.pos} castShadow receiveShadow>
          <boxGeometry args={b.args} />
          <primitive object={barMat} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

/* ─── Semi-circle arch ─── */
function SemiCircleFrame({ width, height, depth, mat, glassMat }) {
  const W = mm(width);
  const H = mm(height);
  const fw = mm(FRAME_FACE);
  const D = mm(depth);
  const halfW = W / 2;
  const archRise = halfW;
  const straightWall = Math.max(H - archRise, mm(50));
  const springY = -H / 2 + straightWall;
  const segs = 48;

  const frameGeo = useMemo(() => {
    const outerArc = arcPoints(0, springY, halfW, 0, Math.PI, segs);
    const shape = new THREE.Shape();
    shape.moveTo(-halfW, -H / 2);
    shape.lineTo(halfW, -H / 2);
    shape.lineTo(halfW, springY);
    for (const p of outerArc) shape.lineTo(p[0], p[1]);
    shape.lineTo(-halfW, springY);
    shape.closePath();

    const iHalfW = halfW - fw;
    const innerArc = arcPoints(0, springY, iHalfW, 0, Math.PI, segs);
    const hole = new THREE.Path();
    hole.moveTo(-iHalfW, -H / 2 + fw);
    hole.lineTo(iHalfW, -H / 2 + fw);
    hole.lineTo(iHalfW, springY);
    for (const p of innerArc) hole.lineTo(p[0], p[1]);
    hole.lineTo(-iHalfW, springY);
    hole.closePath();
    shape.holes.push(hole);

    const geo = new THREE.ExtrudeGeometry(shape, { depth: D, bevelEnabled: false });
    geo.translate(0, 0, -D / 2);
    geo.computeVertexNormals();
    return geo;
  }, [W, H, fw, D, halfW, springY, segs]);

  const glassGeo = useMemo(() => {
    const iHalfW = halfW - fw;
    const innerArc = arcPoints(0, springY, iHalfW, 0, Math.PI, segs);
    const shape = new THREE.Shape();
    shape.moveTo(-iHalfW, -H / 2 + fw);
    shape.lineTo(iHalfW, -H / 2 + fw);
    shape.lineTo(iHalfW, springY);
    for (const p of innerArc) shape.lineTo(p[0], p[1]);
    shape.lineTo(-iHalfW, springY);
    shape.closePath();
    return new THREE.ShapeGeometry(shape, 1);
  }, [W, H, fw, halfW, springY, segs]);

  return (
    <group>
      <mesh geometry={frameGeo} castShadow receiveShadow><primitive object={mat} attach="material" /></mesh>
      <mesh geometry={glassGeo} castShadow={false} receiveShadow><primitive object={glassMat} attach="material" /></mesh>
    </group>
  );
}

/* ─── Segmental arch (custom rise via slider) ─── */
function SegmentalFrame({ width, height, depth, mat, glassMat, customRise = 0 }) {
  const W = mm(width);
  const H = mm(height);
  const fw = mm(FRAME_FACE);
  const D = mm(depth);
  const halfW = W / 2;
  const rise = customRise > 0 ? mm(customRise) : halfW * 0.4;
  const R = (rise * rise + halfW * halfW) / (2 * rise);
  const cy = -H / 2 + (H - rise) - (R - rise);
  const springY = -H / 2 + (H - rise);
  const startAngle = Math.asin(Math.min(halfW / R, 1));
  const segs = 48;

  const frameGeo = useMemo(() => {
    const topArc = arcPoints(0, cy, R, Math.PI / 2 - startAngle, Math.PI / 2 + startAngle, segs);
    const shape = new THREE.Shape();
    shape.moveTo(-halfW, -H / 2);
    shape.lineTo(halfW, -H / 2);
    shape.lineTo(halfW, springY);
    for (const p of topArc) shape.lineTo(p[0], p[1]);
    shape.lineTo(-halfW, springY);
    shape.closePath();

    const iHalfW = halfW - fw;
    const iRise = Math.max(rise - fw, mm(10));
    const Ri = (iRise * iRise + iHalfW * iHalfW) / (2 * iRise);
    const iCY = springY - (Ri - iRise);
    const iAngle = Math.asin(Math.min(iHalfW / Ri, 1));
    const innerArc = arcPoints(0, iCY, Ri, Math.PI / 2 - iAngle, Math.PI / 2 + iAngle, segs);
    const hole = new THREE.Path();
    hole.moveTo(-iHalfW, -H / 2 + fw);
    hole.lineTo(iHalfW, -H / 2 + fw);
    hole.lineTo(iHalfW, springY);
    for (const p of innerArc) hole.lineTo(p[0], p[1]);
    hole.lineTo(-iHalfW, springY);
    hole.closePath();
    shape.holes.push(hole);

    const geo = new THREE.ExtrudeGeometry(shape, { depth: D, bevelEnabled: false });
    geo.translate(0, 0, -D / 2);
    geo.computeVertexNormals();
    return geo;
  }, [W, H, fw, D, halfW, springY, R, cy, startAngle, rise, segs]);

  const glassGeo = useMemo(() => {
    const iHalfW = halfW - fw;
    const iRise = Math.max(rise - fw, mm(10));
    const Ri = (iRise * iRise + iHalfW * iHalfW) / (2 * iRise);
    const iCY = springY - (Ri - iRise);
    const iAngle = Math.asin(Math.min(iHalfW / Ri, 1));
    const innerArc = arcPoints(0, iCY, Ri, Math.PI / 2 - iAngle, Math.PI / 2 + iAngle, segs);
    const shape = new THREE.Shape();
    shape.moveTo(-iHalfW, -H / 2 + fw);
    shape.lineTo(iHalfW, -H / 2 + fw);
    shape.lineTo(iHalfW, springY);
    for (const p of innerArc) shape.lineTo(p[0], p[1]);
    shape.lineTo(-iHalfW, springY);
    shape.closePath();
    return new THREE.ShapeGeometry(shape, 1);
  }, [W, H, fw, halfW, springY, rise, segs]);

  return (
    <group>
      <mesh geometry={frameGeo} castShadow receiveShadow><primitive object={mat} attach="material" /></mesh>
      <mesh geometry={glassGeo} castShadow={false} receiveShadow><primitive object={glassMat} attach="material" /></mesh>
    </group>
  );
}

/* ─── Elliptical arch (custom rise via slider) ─── */
function EllipticalFrame({ width, height, depth, mat, glassMat, customRise = 0 }) {
  const W = mm(width);
  const H = mm(height);
  const fw = mm(FRAME_FACE);
  const D = mm(depth);
  const halfW = W / 2;
  const rise = customRise > 0 ? mm(customRise) : halfW * 0.65;
  const straightWall = Math.max(H - rise, mm(50));
  const springY = -H / 2 + straightWall;
  const segs = 48;

  function ellipseArc(a, b, cY, segments) {
    const pts = [];
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI;
      pts.push([a * Math.cos(angle), cY + b * Math.sin(angle)]);
    }
    return pts;
  }

  const frameGeo = useMemo(() => {
    const outerArc = ellipseArc(halfW, rise, springY, segs);
    const shape = new THREE.Shape();
    shape.moveTo(-halfW, -H / 2);
    shape.lineTo(halfW, -H / 2);
    shape.lineTo(halfW, springY);
    for (const p of outerArc) shape.lineTo(p[0], p[1]);
    shape.lineTo(-halfW, springY);
    shape.closePath();

    const iHalfW = halfW - fw;
    const iRise = Math.max(rise - fw, mm(10));
    const innerArc = ellipseArc(iHalfW, iRise, springY, segs);
    const hole = new THREE.Path();
    hole.moveTo(-iHalfW, -H / 2 + fw);
    hole.lineTo(iHalfW, -H / 2 + fw);
    hole.lineTo(iHalfW, springY);
    for (const p of innerArc) hole.lineTo(p[0], p[1]);
    hole.lineTo(-iHalfW, springY);
    hole.closePath();
    shape.holes.push(hole);

    const geo = new THREE.ExtrudeGeometry(shape, { depth: D, bevelEnabled: false });
    geo.translate(0, 0, -D / 2);
    geo.computeVertexNormals();
    return geo;
  }, [W, H, fw, D, halfW, rise, springY, segs]);

  const glassGeo = useMemo(() => {
    const iHalfW = halfW - fw;
    const iRise = Math.max(rise - fw, mm(10));
    const innerArc = ellipseArc(iHalfW, iRise, springY, segs);
    const shape = new THREE.Shape();
    shape.moveTo(-iHalfW, -H / 2 + fw);
    shape.lineTo(iHalfW, -H / 2 + fw);
    shape.lineTo(iHalfW, springY);
    for (const p of innerArc) shape.lineTo(p[0], p[1]);
    shape.lineTo(-iHalfW, springY);
    shape.closePath();
    return new THREE.ShapeGeometry(shape, 1);
  }, [W, H, fw, halfW, rise, springY, segs]);

  return (
    <group>
      <mesh geometry={frameGeo} castShadow receiveShadow><primitive object={mat} attach="material" /></mesh>
      <mesh geometry={glassGeo} castShadow={false} receiveShadow><primitive object={glassMat} attach="material" /></mesh>
    </group>
  );
}

/* ─── Dimension guide ─── */
function DimensionGuide({ from, to, label, offset = [0, 0, 0] }) {
  const mid = [
    (from[0] + to[0]) / 2 + offset[0],
    (from[1] + to[1]) / 2 + offset[1],
    (from[2] + to[2]) / 2 + offset[2],
  ];
  const points = [from, to].map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  return (
    <group>
      <Line points={points} color="#22324a" lineWidth={1.25} transparent opacity={0.9} />
      <Text position={mid} fontSize={0.06} color="#22324a" anchorX="center" anchorY="middle"
        outlineColor="#f5f2ec" outlineWidth={0.008}>
        {label}
      </Text>
    </group>
  );
}

/* ═══════ MAIN COMPONENT ═══════ */
export default function FixFrameWindow({
  width = 1000,
  height = 1500,
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
  fixArchRise = 0,
  fixGothicBars = 'none',
}) {
  const cExt = sameColor ? woodColor : woodColorExt;
  const cInt = sameColor ? woodColor : woodColorInt;
  const depth = FRAME_DEPTH[fixType] || 57;

  const extMaterial = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: cExt, roughness: 0.72, metalness: 0.02, clearcoat: 0.06, clearcoatRoughness: 0.4 }),
    [cExt]
  );
  const intMaterial = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: cInt, roughness: 0.72, metalness: 0.02, clearcoat: 0.06, clearcoatRoughness: 0.4 }),
    [cInt]
  );
  const glassMat = useGlassMaterial(glassFinish);

  // Effective height and arch rise for dimensions
  let effectiveH = height;
  let archRiseMm = 0;
  let springYFrac = 1;

  if (fixShape === 'gothic-arch') {
    archRiseMm = Math.round(width * Math.sqrt(3) / 2);
    effectiveH = Math.max(height, archRiseMm + 50);
    springYFrac = (effectiveH - archRiseMm) / effectiveH;
  } else if (fixShape === 'semi-circle') {
    archRiseMm = Math.round(width / 2);
    effectiveH = Math.max(height, archRiseMm + 50);
    springYFrac = (effectiveH - archRiseMm) / effectiveH;
  } else if (fixShape === 'segmental-arch') {
    archRiseMm = fixArchRise > 0 ? fixArchRise : Math.round(width * 0.2);
    springYFrac = (effectiveH - archRiseMm) / effectiveH;
  } else if (fixShape === 'elliptical-arch') {
    archRiseMm = fixArchRise > 0 ? fixArchRise : Math.round(width * 0.325);
    springYFrac = (effectiveH - archRiseMm) / effectiveH;
  } else if (fixShape === 'circle') {
    effectiveH = width;
  }

  const W = mm(width);
  const H = mm(effectiveH);
  const springY = -H / 2 + H * springYFrac;

  // Shape node
  let shapeNode = null;
  if (fixShape === 'circle') {
    shapeNode = <CircleFrame diameter={width} depth={depth} mat={extMaterial} glassMat={glassMat} />;
  } else if (fixShape === 'gothic-arch') {
    shapeNode = <GothicArchFrame width={width} height={effectiveH} depth={depth} mat={extMaterial} glassMat={glassMat} gothicBars={fixGothicBars} />;
  } else if (fixShape === 'semi-circle') {
    shapeNode = <SemiCircleFrame width={width} height={effectiveH} depth={depth} mat={extMaterial} glassMat={glassMat} />;
  } else if (fixShape === 'segmental-arch') {
    shapeNode = <SegmentalFrame width={width} height={effectiveH} depth={depth} mat={extMaterial} glassMat={glassMat} customRise={fixArchRise} />;
  } else if (fixShape === 'elliptical-arch') {
    shapeNode = <EllipticalFrame width={width} height={effectiveH} depth={depth} mat={extMaterial} glassMat={glassMat} customRise={fixArchRise} />;
  } else {
    shapeNode = (
      <CasementPanel
        width={width} height={height} hingeType="fixed" opening={0}
        material={extMaterial} materialInt={intMaterial}
        spacerColor={spacerColor} glassFinish={glassFinish}
        hBars={hBars} vBars={vBars} ironmongery="brass" position={[0, 0, 0]}
      />
    );
  }

  return (
    <group>
      {shapeNode}
      {showGuides && (
        <group>
          <DimensionGuide from={[-W/2, H/2 + mm(80), 0]} to={[W/2, H/2 + mm(80), 0]} label={`${width} mm`} offset={[0, 0.05, 0]} />
          <DimensionGuide from={[W/2 + mm(130), -H/2, 0]} to={[W/2 + mm(130), H/2, 0]} label={`${effectiveH} mm`} offset={[0.07, 0, 0]} />
          {archRiseMm > 0 && (
            <DimensionGuide from={[-W/2 - mm(130), springY, 0]} to={[-W/2 - mm(130), H/2, 0]} label={`↑ ${archRiseMm} mm`} offset={[-0.07, 0, 0]} />
          )}
        </group>
      )}
    </group>
  );
}