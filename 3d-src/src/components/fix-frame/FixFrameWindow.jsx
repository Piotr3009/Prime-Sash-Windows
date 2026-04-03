/**
 * FixFrameWindow.jsx
 * Fixed frame only — no outer frame, no handles, no opening.
 * Shapes: rectangle, circle, gothic-arch, semi-circle, segmental-arch, elliptical-arch
 * 
 * Gothic arch: TRUE equilateral pointed arch — two circular arcs, radius = span,
 * centers at opposite springing points. Rise = span × √3/2 ≈ 0.866 × span.
 * Frame is constant 57mm (FRAME_FACE) everywhere.
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Text, Line } from '@react-three/drei';
import CasementPanel from '../casement/CasementPanel';

const mm = (v) => v / 1000;

const FRAME_FACE = 64;   // frame face width mm (constant for all types)
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

/* ─── Arc point generators ─── */
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
      <mesh geometry={frameGeo} castShadow receiveShadow>
        <primitive object={mat} attach="material" />
      </mesh>
      <mesh geometry={glassGeo} castShadow={false} receiveShadow>
        <primitive object={glassMat} attach="material" />
      </mesh>
    </group>
  );
}

/* ═══════════════════════════════════════════════════════
   GOTHIC ARCH — true equilateral pointed arch
   Two circular arcs, radius = span, centers at opposite
   springing points. Constant frame width everywhere.
   ═══════════════════════════════════════════════════════ */
function GothicArchFrame({ width, height, depth, mat, glassMat, customRise = 0 }) {
  const W = mm(width);   // outer width
  const H = mm(height);  // outer total height
  const fw = mm(FRAME_FACE);
  const D = mm(depth);
  const halfW = W / 2;

  // Arch rise: custom or equilateral default
  const archRise = customRise > 0 ? mm(customRise) : W * Math.sqrt(3) / 2;
  // Two-center pointed arch: center offset d from midpoint
  const d = (archRise * archRise - halfW * halfW) / (2 * halfW);
  const R = halfW + d; // arc radius
  const straightWall = Math.max(H - archRise, mm(50));
  const springY = -H / 2 + straightWall;

  const segs = 48;

  const frameGeo = useMemo(() => {
    // Peak angle from right center (-d, springY): atan2(archRise, d) 
    const peakAngle = Math.atan2(archRise, d);
    // Right arc: center at (-d, springY), radius R, from 0 to peakAngle
    const rightArc = arcPoints(-d, springY, R, 0, peakAngle, segs);
    // Left arc: center at (d, springY), radius R, from (π - peakAngle) to π
    const leftArc = arcPoints(d, springY, R, Math.PI - peakAngle, Math.PI, segs);

    const shape = new THREE.Shape();
    shape.moveTo(-halfW, -H / 2);
    shape.lineTo(halfW, -H / 2);
    shape.lineTo(halfW, springY);
    for (let i = 0; i < rightArc.length; i++) shape.lineTo(rightArc[i][0], rightArc[i][1]);
    for (let i = 0; i < leftArc.length; i++) shape.lineTo(leftArc[i][0], leftArc[i][1]);
    shape.lineTo(-halfW, springY);
    shape.closePath();

    // Inner contour — same centers, radius R - fw
    const iHalfW = halfW - fw;
    const Ri = R - fw;
    const iPeakAngle = Math.atan2(archRise - fw * 0.5, d);
    const iRightArc = arcPoints(-d, springY, Ri, 0, iPeakAngle, segs);
    const iLeftArc = arcPoints(d, springY, Ri, Math.PI - iPeakAngle, Math.PI, segs);

    const hole = new THREE.Path();
    hole.moveTo(-iHalfW, -H / 2 + fw);
    hole.lineTo(iHalfW, -H / 2 + fw);
    hole.lineTo(iHalfW, springY);
    for (let i = 0; i < iRightArc.length; i++) hole.lineTo(iRightArc[i][0], iRightArc[i][1]);
    for (let i = 0; i < iLeftArc.length; i++) hole.lineTo(iLeftArc[i][0], iLeftArc[i][1]);
    hole.lineTo(-iHalfW, springY);
    hole.closePath();
    shape.holes.push(hole);

    const geo = new THREE.ExtrudeGeometry(shape, { depth: D, bevelEnabled: false });
    geo.translate(0, 0, -D / 2);
    geo.computeVertexNormals();
    return geo;
  }, [W, H, fw, D, halfW, springY, archRise, d, R, segs]);

  // Glass — inner contour
  const glassGeo = useMemo(() => {
    const iHalfW = halfW - fw;
    const Ri = R - fw;
    const iPeakAngle = Math.atan2(archRise - fw * 0.5, d);
    const iRightArc = arcPoints(-d, springY, Ri, 0, iPeakAngle, segs);
    const iLeftArc = arcPoints(d, springY, Ri, Math.PI - iPeakAngle, Math.PI, segs);

    const shape = new THREE.Shape();
    shape.moveTo(-iHalfW, -H / 2 + fw);
    shape.lineTo(iHalfW, -H / 2 + fw);
    shape.lineTo(iHalfW, springY);
    for (let i = 0; i < iRightArc.length; i++) shape.lineTo(iRightArc[i][0], iRightArc[i][1]);
    for (let i = 0; i < iLeftArc.length; i++) shape.lineTo(iLeftArc[i][0], iLeftArc[i][1]);
    shape.lineTo(-iHalfW, springY);
    shape.closePath();

    const geo = new THREE.ShapeGeometry(shape, 1);
    geo.computeVertexNormals();
    return geo;
  }, [W, H, fw, halfW, springY, d, R, archRise, segs]);

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

/* ═══════════════════════════════════════════════════════
   SEMI-CIRCLE ARCH — half circle on top of straight walls
   ═══════════════════════════════════════════════════════ */
function SemiCircleFrame({ width, height, depth, mat, glassMat, customRise = 0 }) {
  const W = mm(width);
  const H = mm(height);
  const fw = mm(FRAME_FACE);
  const D = mm(depth);
  const halfW = W / 2;
  const archRise = customRise > 0 ? mm(customRise) : halfW;
  const straightWall = Math.max(H - archRise, mm(50));
  const springY = -H / 2 + straightWall;
  const segs = 48;

  // Generalized circular arc: R = (rise² + halfW²) / (2·rise)
  const arcR = (archRise * archRise + halfW * halfW) / (2 * archRise);
  const arcCY = springY + archRise - arcR;
  const arcTheta = Math.asin(Math.min(halfW / arcR, 1));

  const frameGeo = useMemo(() => {
    const outerArc = arcPoints(0, arcCY, arcR, Math.PI / 2 - arcTheta, Math.PI / 2 + arcTheta, segs);
    const shape = new THREE.Shape();
    shape.moveTo(-halfW, -H / 2);
    shape.lineTo(halfW, -H / 2);
    shape.lineTo(halfW, springY);
    for (const p of outerArc) shape.lineTo(p[0], p[1]);
    shape.lineTo(-halfW, springY);
    shape.closePath();

    const iHalfW = halfW - fw;
    const iRise = Math.max(archRise - fw, mm(10));
    const iR = (iRise * iRise + iHalfW * iHalfW) / (2 * iRise);
    const iCY = springY + iRise - iR;
    const iTheta = Math.asin(Math.min(iHalfW / iR, 1));
    const innerArc = arcPoints(0, iCY, iR, Math.PI / 2 - iTheta, Math.PI / 2 + iTheta, segs);
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
  }, [W, H, fw, D, halfW, springY, arcR, arcCY, arcTheta, segs]);

  const glassGeo = useMemo(() => {
    const iHalfW = halfW - fw;
    const iRise = Math.max(archRise - fw, mm(10));
    const iR = (iRise * iRise + iHalfW * iHalfW) / (2 * iRise);
    const iCY = springY + iRise - iR;
    const iTheta = Math.asin(Math.min(iHalfW / iR, 1));
    const innerArc = arcPoints(0, iCY, iR, Math.PI / 2 - iTheta, Math.PI / 2 + iTheta, segs);
    const shape = new THREE.Shape();
    shape.moveTo(-iHalfW, -H / 2 + fw);
    shape.lineTo(iHalfW, -H / 2 + fw);
    shape.lineTo(iHalfW, springY);
    for (const p of innerArc) shape.lineTo(p[0], p[1]);
    shape.lineTo(-iHalfW, springY);
    shape.closePath();
    return new THREE.ShapeGeometry(shape, 1);
  }, [W, H, fw, halfW, springY, archRise, segs]);

  return (
    <group>
      <mesh geometry={frameGeo} castShadow receiveShadow><primitive object={mat} attach="material" /></mesh>
      <mesh geometry={glassGeo} castShadow={false} receiveShadow><primitive object={glassMat} attach="material" /></mesh>
    </group>
  );
}

/* ═══════════════════════════════════════════════════════
   SEGMENTAL ARCH — flatter circular arc (rise ≈ W/4)
   ═══════════════════════════════════════════════════════ */
function SegmentalFrame({ width, height, depth, mat, glassMat, customRise = 0 }) {
  const W = mm(width);
  const H = mm(height);
  const fw = mm(FRAME_FACE);
  const D = mm(depth);
  const halfW = W / 2;
  const rise = customRise > 0 ? mm(customRise) : halfW * 0.4;
  // Compute radius from chord and rise: R = (rise² + halfW²) / (2 * rise)
  const R = (rise * rise + halfW * halfW) / (2 * rise);
  const cy = -H / 2 + (H - rise) - (R - rise); // center Y
  const springY = -H / 2 + (H - rise);
  // Start/end angles
  const startAngle = Math.asin(halfW / R);
  const segs = 48;

  const frameGeo = useMemo(() => {
    const outerArc = arcPoints(0, cy, R, Math.PI / 2 + startAngle, Math.PI / 2 - startAngle, segs);
    // flip to go left-to-right at top
    const shape = new THREE.Shape();
    shape.moveTo(-halfW, -H / 2);
    shape.lineTo(halfW, -H / 2);
    shape.lineTo(halfW, springY);
    // Arc from right to left across the top
    const topArc = arcPoints(0, cy, R, Math.PI / 2 - startAngle, Math.PI / 2 + startAngle, segs);
    for (const p of topArc) shape.lineTo(p[0], p[1]);
    shape.lineTo(-halfW, springY);
    shape.closePath();

    const iHalfW = halfW - fw;
    const Ri = R - fw;
    const iStartAngle = Math.asin(Math.min(iHalfW / Ri, 1));
    const innerArc = arcPoints(0, cy, Ri, Math.PI / 2 - iStartAngle, Math.PI / 2 + iStartAngle, segs);
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
  }, [W, H, fw, D, halfW, springY, R, cy, startAngle, segs]);

  const glassGeo = useMemo(() => {
    const iHalfW = halfW - fw;
    const Ri = R - fw;
    const iStartAngle = Math.asin(Math.min(iHalfW / Ri, 1));
    const innerArc = arcPoints(0, cy, Ri, Math.PI / 2 - iStartAngle, Math.PI / 2 + iStartAngle, segs);
    const shape = new THREE.Shape();
    shape.moveTo(-iHalfW, -H / 2 + fw);
    shape.lineTo(iHalfW, -H / 2 + fw);
    shape.lineTo(iHalfW, springY);
    for (const p of innerArc) shape.lineTo(p[0], p[1]);
    shape.lineTo(-iHalfW, springY);
    shape.closePath();
    return new THREE.ShapeGeometry(shape, 1);
  }, [W, H, fw, halfW, springY, R, cy, segs]);

  return (
    <group>
      <mesh geometry={frameGeo} castShadow receiveShadow><primitive object={mat} attach="material" /></mesh>
      <mesh geometry={glassGeo} castShadow={false} receiveShadow><primitive object={glassMat} attach="material" /></mesh>
    </group>
  );
}

/* ═══════════════════════════════════════════════════════
   ELLIPTICAL ARCH — ellipse top
   ═══════════════════════════════════════════════════════ */
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

  function ellipseArc(a, b, cY, segments, invert) {
    const pts = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const angle = invert ? Math.PI - t * Math.PI : t * Math.PI;
      pts.push([a * Math.cos(angle), cY + b * Math.sin(angle)]);
    }
    return pts;
  }

  const frameGeo = useMemo(() => {
    const outerArc = ellipseArc(halfW, rise, springY, segs, false);
    const shape = new THREE.Shape();
    shape.moveTo(-halfW, -H / 2);
    shape.lineTo(halfW, -H / 2);
    shape.lineTo(halfW, springY);
    for (const p of outerArc) shape.lineTo(p[0], p[1]);
    shape.lineTo(-halfW, springY);
    shape.closePath();

    const iHalfW = halfW - fw;
    const iRise = Math.max(rise - fw, mm(10));
    const innerArc = ellipseArc(iHalfW, iRise, springY, segs, false);
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
    const innerArc = ellipseArc(iHalfW, iRise, springY, segs, false);
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

/* ─── Dimension guide (same style as sash/casement) ─── */
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

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════ */
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

  // Calculate effective height and arch rise per shape
  let effectiveH = height;
  let archRiseMm = 0;
  let springYFrac = 1;

  if (fixShape === 'gothic-arch') {
    archRiseMm = fixArchRise > 0 ? fixArchRise : Math.round(width * Math.sqrt(3) / 2);
    const minH = archRiseMm + 50;
    effectiveH = Math.max(height, minH);
    springYFrac = (effectiveH - archRiseMm) / effectiveH;
  } else if (fixShape === 'semi-circle') {
    archRiseMm = fixArchRise > 0 ? fixArchRise : Math.round(width / 2);
    const minH = archRiseMm + 50;
    effectiveH = Math.max(height, minH);
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
  const springY = -H / 2 + H * springYFrac; // Y coordinate of springing line

  // Shape component
  let shapeNode = null;
  if (fixShape === 'circle') {
    shapeNode = <CircleFrame diameter={width} depth={depth} mat={extMaterial} glassMat={glassMat} />;
  } else if (fixShape === 'gothic-arch') {
    shapeNode = <GothicArchFrame width={width} height={effectiveH} depth={depth} mat={extMaterial} glassMat={glassMat} customRise={fixArchRise} />;
  } else if (fixShape === 'semi-circle') {
    shapeNode = <SemiCircleFrame width={width} height={effectiveH} depth={depth} mat={extMaterial} glassMat={glassMat} customRise={fixArchRise} />;
  } else if (fixShape === 'segmental-arch') {
    shapeNode = <SegmentalFrame width={width} height={effectiveH} depth={depth} mat={extMaterial} glassMat={glassMat} customRise={fixArchRise} />;
  } else if (fixShape === 'elliptical-arch') {
    shapeNode = <EllipticalFrame width={width} height={effectiveH} depth={depth} mat={extMaterial} glassMat={glassMat} customRise={fixArchRise} />;
  } else {
    // Rectangle
    shapeNode = (
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

  return (
    <group>
      {shapeNode}

      {showGuides && (
        <group>
          {/* Width — top */}
          <DimensionGuide
            from={[-W / 2, H / 2 + mm(80), 0]}
            to={[W / 2, H / 2 + mm(80), 0]}
            label={`${width} mm`}
            offset={[0, 0.05, 0]}
          />
          {/* Total height — right */}
          <DimensionGuide
            from={[W / 2 + mm(130), -H / 2, 0]}
            to={[W / 2 + mm(130), H / 2, 0]}
            label={`${effectiveH} mm`}
            offset={[0.07, 0, 0]}
          />
          {/* Arch rise — left side (only for arched shapes) */}
          {archRiseMm > 0 && (
            <DimensionGuide
              from={[-W / 2 - mm(130), springY, 0]}
              to={[-W / 2 - mm(130), H / 2, 0]}
              label={`↑ ${archRiseMm} mm`}
              offset={[-0.07, 0, 0]}
            />
          )}
        </group>
      )}
    </group>
  );
}