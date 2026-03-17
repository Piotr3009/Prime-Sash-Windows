import React, { useMemo, useRef, useState } from 'react';
import { Line, Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const mm = (value) => value / 1000;


const EXT_BEAD_W = mm(9);
const EXT_BEAD_D = mm(15);
const INT_BEAD_W = mm(18);
const INT_BEAD_D = mm(14);
const INT_BEAD_R = mm(11);

function signedArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

function shapeFromPoints(points) {
  const ordered = signedArea(points) < 0 ? [...points].reverse() : points;
  const shape = new THREE.Shape();
  shape.moveTo(ordered[0][0], ordered[0][1]);
  for (let i = 1; i < ordered.length; i += 1) {
    shape.lineTo(ordered[i][0], ordered[i][1]);
  }
  shape.closePath();
  return shape;
}

function buildCoreLocalProfile(memberSize, memberDepth) {
  return [
    [0, 0],
    [memberSize - EXT_BEAD_W, 0],
    [memberSize, EXT_BEAD_D],
    [memberSize, memberDepth - INT_BEAD_D],
    [memberSize - INT_BEAD_W, memberDepth - INT_BEAD_D],
    [memberSize - INT_BEAD_W, memberDepth],
    [0, memberDepth],
  ];
}

function buildExtCoreProfile(memberSize, memberDepth) {
  const mid = memberDepth / 2;
  return [
    [0, 0],
    [memberSize - EXT_BEAD_W, 0],
    [memberSize, EXT_BEAD_D],
    [memberSize, mid],
    [0, mid],
  ];
}

function buildIntCoreProfile(memberSize, memberDepth) {
  const mid = memberDepth / 2;
  return [
    [0, mid],
    [memberSize, mid],
    [memberSize, memberDepth - INT_BEAD_D],
    [memberSize - INT_BEAD_W, memberDepth - INT_BEAD_D],
    [memberSize - INT_BEAD_W, memberDepth],
    [0, memberDepth],
  ];
}

function buildOvoloSolidLocalPoints(samples = 20) {
  const points = [];
  const topFlat = INT_BEAD_W - INT_BEAD_R;
  const centerX = topFlat;
  const centerY = INT_BEAD_D - INT_BEAD_R;

  points.push([0, 0]);
  points.push([0, INT_BEAD_D]);
  points.push([topFlat, INT_BEAD_D]);

  for (let i = 1; i <= samples; i += 1) {
    const t = i / samples;
    const angle = Math.PI / 2 - t * (Math.PI / 2);
    points.push([
      centerX + Math.cos(angle) * INT_BEAD_R,
      centerY + Math.sin(angle) * INT_BEAD_R,
    ]);
  }

  points.push([INT_BEAD_W, 0]);
  return points;
}

function mapStileUVToShape(u, v, memberWidth, memberDepth, openingSide, flip) {
  const x = openingSide === 'right'
    ? -memberWidth / 2 + u
    : memberWidth / 2 - u;

  const z = flip
    ? -memberDepth / 2 + v
    : memberDepth / 2 - v;

  return [x, -z];
}

function mapRailUVToShape(u, v, memberHeight, memberDepth, openingSide, flip) {
  const y = openingSide === 'bottom'
    ? memberHeight / 2 - u
    : -memberHeight / 2 + u;

  const z = flip
    ? -memberDepth / 2 + v
    : memberDepth / 2 - v;

  return [-z, y];
}

function FramePiece({ size, position, material, castShadow = true }) {
  return (
    <mesh position={position} castShadow={castShadow} receiveShadow>
      <boxGeometry args={size} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function GlassReflections({ width, height, z = 0.008 }) {
  return (
    <group position={[0, 0, z]}>
      <mesh position={[-width * 0.22, height * 0.1, 0]} rotation={[0, 0, -0.08]}>
        <planeGeometry args={[width * 0.12, height * 0.9]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.08} depthWrite={false} />
      </mesh>

      <mesh position={[width * 0.18, 0, 0]} rotation={[0, 0, 0.04]}>
        <planeGeometry args={[width * 0.06, height * 0.82]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.06} depthWrite={false} />
      </mesh>

      <mesh position={[0, height * 0.28, 0]}>
        <planeGeometry args={[width * 0.7, height * 0.05]} />
        <meshBasicMaterial color="#dfefff" transparent opacity={0.035} depthWrite={false} />
      </mesh>
    </group>
  );
}

function createFrostedTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#d0e4f0';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 40000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 2;
    const alpha = Math.random() * 0.35;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fill();
  }
  for (let i = 0; i < 8000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 1.2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(140,180,210,${Math.random() * 0.25})`;
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return texture;
}

function GlassPane({ size, position, frosted = false, doubleGlazing = false, spacerColor = 'silver' }) {
  const [w, h, d] = size;
  const frostedTexture = useMemo(() => frosted ? createFrostedTexture() : null, [frosted]);

  // Double glazing: 4mm + 16mm spacer + 4mm = 24mm total
  const paneThickness = mm(4);
  const gapThickness  = mm(16);
  const spacerWidth   = mm(1);  // widoczna szerokość spacera na krawędzi
  const pane1Z =  (gapThickness / 2 + paneThickness / 2);
  const pane2Z = -(gapThickness / 2 + paneThickness / 2);

  const spacerColorHex = spacerColor === 'silver' ? '#a0a4a8' : spacerColor === 'white' ? '#f8f8f8' : '#1a1a1a';

  const glassMat = frosted ? (
    <meshPhysicalMaterial
      color="#c8dce8" roughness={1.0} metalness={0}
      transmission={0.15} transparent opacity={0.96}
      thickness={0.028} ior={1.52}
      map={frostedTexture} roughnessMap={frostedTexture}
    />
  ) : (
    <meshPhysicalMaterial
      color="#cfe3f5" roughness={0.12} metalness={0}
      transmission={0.92} transparent opacity={0.38}
      thickness={0.028} ior={1.1} clearcoat={0.03}
      clearcoatRoughness={0.08} reflectivity={0.05}
    />
  );

  if (!doubleGlazing) {
    return (
      <group position={position}>
        <mesh castShadow={false} receiveShadow>
          <boxGeometry args={[w, h, d]} />
          {glassMat}
        </mesh>
        <GlassReflections width={w} height={h} z={d / 2 + 0.001} />
      </group>
    );
  }

  return (
    <group position={position}>
      {/* Szyba przednia */}
      <mesh castShadow={false} receiveShadow position={[0, 0, pane1Z]}>
        <boxGeometry args={[w, h, paneThickness]} />
        {glassMat}
      </mesh>
      {/* Szyba tylna */}
      <mesh castShadow={false} receiveShadow position={[0, 0, pane2Z]}>
        <boxGeometry args={[w, h, paneThickness]} />
        {glassMat}
      </mesh>
      {/* Spacery — 4 krawędzie */}
      {/* Góra */}
      <mesh position={[0,  h / 2 - spacerWidth / 2, 0]}>
        <boxGeometry args={[w, spacerWidth, gapThickness]} />
        <meshStandardMaterial color={spacerColorHex} metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Dół */}
      <mesh position={[0, -h / 2 + spacerWidth / 2, 0]}>
        <boxGeometry args={[w, spacerWidth, gapThickness]} />
        <meshStandardMaterial color={spacerColorHex} metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Lewo */}
      <mesh position={[-w / 2 + spacerWidth / 2, 0, 0]}>
        <boxGeometry args={[spacerWidth, h - spacerWidth * 2, gapThickness]} />
        <meshStandardMaterial color={spacerColorHex} metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Prawo */}
      <mesh position={[w / 2 - spacerWidth / 2, 0, 0]}>
        <boxGeometry args={[spacerWidth, h - spacerWidth * 2, gapThickness]} />
        <meshStandardMaterial color={spacerColorHex} metalness={0.6} roughness={0.4} />
      </mesh>
      <GlassReflections width={w} height={h} z={pane1Z + paneThickness / 2 + 0.001} />
    </group>
  );
}

function DimensionGuide({ from, to, label, offset = [0, 0, 0] }) {
  const mid = [
    (from[0] + to[0]) / 2 + offset[0],
    (from[1] + to[1]) / 2 + offset[1],
    (from[2] + to[2]) / 2 + offset[2],
  ];

  const points = [from, to].map((point) => new THREE.Vector3(point[0], point[1], point[2]));

  return (
    <group>
      <Line points={points} color="#22324a" lineWidth={1.25} transparent opacity={0.9} />
      <Text
        position={mid}
        fontSize={0.06}
        color="#22324a"
        anchorX="center"
        anchorY="middle"
        outlineColor="#f5f2ec"
        outlineWidth={0.008}
      >
        {label}
      </Text>
    </group>
  );
}

function SashStileCore({
  width,
  height,
  depth,
  openingSide = 'right',
  flip = false,
  position = [0, 0, 0],
  material,
  half = 'full',
}) {
  const geometry = useMemo(() => {
    const mw = mm(width);
    const mh = mm(height);
    const md = mm(depth);

    const profile = half === 'ext'
      ? buildExtCoreProfile(mw, md)
      : half === 'int'
      ? buildIntCoreProfile(mw, md)
      : buildCoreLocalProfile(mw, md);

    const points = profile.map(([u, v]) =>
      mapStileUVToShape(u, v, mw, md, openingSide, flip)
    );

    const shape = shapeFromPoints(points);

    const g = new THREE.ExtrudeGeometry(shape, {
      depth: mh,
      bevelEnabled: false,
      steps: 1,
      curveSegments: 24,
    });

    g.rotateX(-Math.PI / 2);
    g.translate(0, -mh / 2, 0);
    g.computeVertexNormals();
    return g;
  }, [width, height, depth, openingSide, flip, half]);

  return (
    <mesh geometry={geometry} position={position} castShadow receiveShadow>
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function SashRailCore({
  width,
  height,
  depth,
  openingSide = 'bottom',
  flip = false,
  position = [0, 0, 0],
  material,
  half = 'full',
}) {
  const geometry = useMemo(() => {
    const ml = mm(width);
    const mh = mm(height);
    const md = mm(depth);

    const profile = half === 'ext'
      ? buildExtCoreProfile(mh, md)
      : half === 'int'
      ? buildIntCoreProfile(mh, md)
      : buildCoreLocalProfile(mh, md);

    const points = profile.map(([u, v]) =>
      mapRailUVToShape(u, v, mh, md, openingSide, flip)
    );

    const shape = shapeFromPoints(points);

    const g = new THREE.ExtrudeGeometry(shape, {
      depth: ml,
      bevelEnabled: false,
      steps: 1,
      curveSegments: 24,
    });

    g.rotateY(Math.PI / 2);
    g.translate(-ml / 2, 0, 0);
    g.computeVertexNormals();
    return g;
  }, [width, height, depth, openingSide, flip, half]);

  return (
    <mesh geometry={geometry} position={position} castShadow receiveShadow>
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function ExternalStileBead({
  width,
  height,
  depth,
  openingSide = 'right',
  flip = false,
  position = [0, 0, 0],
  material,
}) {
  const geometry = useMemo(() => {
    const mw = mm(width);
    const mh = mm(height);
    const md = mm(depth);

    const extV = flip ? md : 0;
    const stepV = flip ? -EXT_BEAD_D : EXT_BEAD_D;

    const local = [
      [mw - EXT_BEAD_W, extV],
      [mw, extV],
      [mw, extV + stepV],
    ];

    const points = local.map(([u, v]) =>
      mapStileUVToShape(u, v, mw, md, openingSide, flip)
    );

    const shape = shapeFromPoints(points);

    const g = new THREE.ExtrudeGeometry(shape, {
      depth: mh,
      bevelEnabled: false,
      steps: 1,
      curveSegments: 12,
    });

    g.rotateX(-Math.PI / 2);
    g.translate(0, -mh / 2, 0);
    g.computeVertexNormals();
    return g;
  }, [width, height, depth, openingSide, flip]);

  return (
    <mesh geometry={geometry} position={position} castShadow receiveShadow>
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function ExternalRailBead({
  width,
  height,
  depth,
  openingSide = 'bottom',
  flip = false,
  position = [0, 0, 0],
  material,
}) {
  const geometry = useMemo(() => {
    const ml = mm(width);
    const mh = mm(height);
    const md = mm(depth);

    const extV = flip ? md : 0;
    const stepV = flip ? -EXT_BEAD_D : EXT_BEAD_D;

    const local = [
      [mh - EXT_BEAD_W, extV],
      [mh, extV],
      [mh, extV + stepV],
    ];

    const points = local.map(([u, v]) =>
      mapRailUVToShape(u, v, mh, md, openingSide, flip)
    );

    const shape = shapeFromPoints(points);

    const g = new THREE.ExtrudeGeometry(shape, {
      depth: ml,
      bevelEnabled: false,
      steps: 1,
      curveSegments: 12,
    });

    g.rotateY(Math.PI / 2);
    g.translate(-ml / 2, 0, 0);
    g.computeVertexNormals();
    return g;
  }, [width, height, depth, openingSide, flip]);

  return (
    <mesh geometry={geometry} position={position} castShadow receiveShadow>
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function InternalOvoloStileBead({
  width,
  height,
  depth,
  openingSide = 'right',
  flip = false,
  position = [0, 0, 0],
  material,
}) {
  const geometry = useMemo(() => {
    const mw = mm(width);
    const mh = mm(height);
    const md = mm(depth);

    const local = buildOvoloSolidLocalPoints().map(([u, v]) => [
      mw - INT_BEAD_W + u,
      md - INT_BEAD_D + v,
    ]);

    const points = local.map(([u, v]) =>
      mapStileUVToShape(u, v, mw, md, openingSide, flip)
    );

    const shape = shapeFromPoints(points);

    const g = new THREE.ExtrudeGeometry(shape, {
      depth: mh,
      bevelEnabled: false,
      steps: 1,
      curveSegments: 28,
    });

    g.rotateX(-Math.PI / 2);
    g.translate(0, -mh / 2, 0);
    g.computeVertexNormals();
    return g;
  }, [width, height, depth, openingSide, flip]);

  return (
    <mesh geometry={geometry} position={position} castShadow receiveShadow>
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function InternalOvoloRailBead({
  width,
  height,
  depth,
  openingSide = 'bottom',
  flip = false,
  position = [0, 0, 0],
  material,
}) {
  const geometry = useMemo(() => {
    const ml = mm(width);
    const mh = mm(height);
    const md = mm(depth);

    const local = buildOvoloSolidLocalPoints().map(([u, v]) => [
      mh - INT_BEAD_W + u,
      md - INT_BEAD_D + v,
    ]);

    const points = local.map(([u, v]) =>
      mapRailUVToShape(u, v, mh, md, openingSide, flip)
    );

    const shape = shapeFromPoints(points);

    const g = new THREE.ExtrudeGeometry(shape, {
      depth: ml,
      bevelEnabled: false,
      steps: 1,
      curveSegments: 28,
    });

    g.rotateY(Math.PI / 2);
    g.translate(-ml / 2, 0, 0);
    g.computeVertexNormals();
    return g;
  }, [width, height, depth, openingSide, flip]);

  return (
    <mesh geometry={geometry} position={position} castShadow receiveShadow>
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function BottomRailLowerProfile({ width, height, depth, material }) {
  const geometry = useMemo(() => {
    const w = mm(width);
    const h = mm(height);
    const d = mm(depth);
    const rebateDepth = Math.min(mm(18), d * 0.32);
    const rebateRise = Math.min(mm(14), h * 0.22);

    const g = new THREE.BufferGeometry();
    const positions = new Float32Array([
      -w / 2, -h / 2, d / 2,
       w / 2, -h / 2, d / 2,
       w / 2, -h / 2 + rebateRise, d / 2 - rebateDepth,

      -w / 2, -h / 2, d / 2,
       w / 2, -h / 2 + rebateRise, d / 2 - rebateDepth,
      -w / 2, -h / 2 + rebateRise, d / 2 - rebateDepth,

      -w / 2, -h / 2, -d / 2,
       w / 2, -h / 2 + rebateRise, -d / 2,
       w / 2, -h / 2, -d / 2,

      -w / 2, -h / 2, -d / 2,
      -w / 2, -h / 2 + rebateRise, -d / 2,
       w / 2, -h / 2 + rebateRise, -d / 2,

      -w / 2, -h / 2 + rebateRise, d / 2 - rebateDepth,
       w / 2, -h / 2 + rebateRise, d / 2 - rebateDepth,
       w / 2, -h / 2 + rebateRise, -d / 2,

      -w / 2, -h / 2 + rebateRise, d / 2 - rebateDepth,
       w / 2, -h / 2 + rebateRise, -d / 2,
      -w / 2, -h / 2 + rebateRise, -d / 2,

      -w / 2, -h / 2, d / 2,
      -w / 2, -h / 2, -d / 2,
      -w / 2, -h / 2 + rebateRise, -d / 2,

      -w / 2, -h / 2, d / 2,
      -w / 2, -h / 2 + rebateRise, -d / 2,
      -w / 2, -h / 2 + rebateRise, d / 2 - rebateDepth,

       w / 2, -h / 2, d / 2,
       w / 2, -h / 2 + rebateRise, -d / 2,
       w / 2, -h / 2, -d / 2,

       w / 2, -h / 2, d / 2,
       w / 2, -h / 2 + rebateRise, d / 2 - rebateDepth,
       w / 2, -h / 2 + rebateRise, -d / 2,
    ]);
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.computeVertexNormals();
    return g;
  }, [width, height, depth]);

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function LowerBottomRail({ width, height, depth, yCenter, stileWidth, coreMaterial, intCoreMaterial, extBeadMaterial, intBeadMaterial, flip = false }) {
  const intMat = intCoreMaterial || coreMaterial;
  const intBeadWidth = width - stileWidth * 2 + 18 * 2;
  return (
    <group position={[0, yCenter, 0]}>
      <SashRailCore width={width} height={height} depth={depth} openingSide="top" flip={flip} position={[0, 0, 0]} material={coreMaterial} half="ext" />
      <SashRailCore width={width} height={height} depth={depth} openingSide="top" flip={flip} position={[0, 0, 0]} material={intMat} half="int" />
      <BottomRailLowerProfile width={width} height={height} depth={depth} material={coreMaterial} />
      <InternalOvoloRailBead width={intBeadWidth} height={height} depth={depth} openingSide="top" flip={flip} position={[0, 0, 0]} material={intMat} />
    </group>
  );
}

const BAR_PATTERNS = {
  'none':   { h: 0, v: 0 },
  '2x2':   { h: 0, v: 1 },
  '3x3':   { h: 0, v: 2 },
  '4x4':   { h: 1, v: 1 },
  '6x6':   { h: 1, v: 2 },
  '9x9':   { h: 2, v: 2 },
  'custom': null,
};

function GlazingBars({ clearWidth, clearHeight, glassDepth, barPattern = 'none', customBars = [], material, materialInt, doubleGlazing = false, spacerColor = 'silver' }) {
  const pattern = BAR_PATTERNS[barPattern];
  const barW = mm(22);
  const barH = mm(16.5);
  const barTop = mm(2);
  const glassHalf = glassDepth / 2;
  const matInt = materialInt || material;

  const spacerBarW = mm(18);
  const spacerDepth = mm(16);
  const spacerColorHex = spacerColor === 'silver' ? '#a0a4a8' : spacerColor === 'white' ? '#f8f8f8' : '#1a1a1a';
  const spacerMat = useMemo(() => new THREE.MeshStandardMaterial({ color: spacerColorHex, metalness: 0.6, roughness: 0.4 }), [spacerColorHex]);

  const trapezoidGeom = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-barW / 2, 0);
    shape.lineTo(-barTop / 2, barH);
    shape.lineTo(barTop / 2, barH);
    shape.lineTo(barW / 2, 0);
    shape.closePath();
    return shape;
  }, []);

  const trapezoidHGeom = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, -barW / 2);
    shape.lineTo(barH, -barTop / 2);
    shape.lineTo(barH, barTop / 2);
    shape.lineTo(0, barW / 2);
    shape.closePath();
    return shape;
  }, []);

  const vGeom = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(trapezoidGeom, {
      depth: clearHeight + mm(18),
      bevelEnabled: false,
      steps: 1,
    });
    g.rotateX(-Math.PI / 2);
    g.translate(0, -(clearHeight + mm(18)) / 2, 0);
    g.computeVertexNormals();
    return g;
  }, [clearHeight, trapezoidGeom]);

  const hGeom = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(trapezoidHGeom, {
      depth: clearWidth + mm(18),
      bevelEnabled: false,
      steps: 1,
    });
    g.rotateY(Math.PI / 2);
    g.translate(-(clearWidth + mm(18)) / 2, 0, 0);
    g.computeVertexNormals();
    return g;
  }, [clearWidth, trapezoidHGeom]);

  const ovoloIntShape = useMemo(() => {
    const drop = mm(2);
    const sqH = mm(2);
    const shape = new THREE.Shape();
    shape.moveTo(-barW / 2, 0);
    shape.quadraticCurveTo(-barW / 2, barH - drop - sqH, -barTop / 2, barH - sqH);
    shape.lineTo(-barTop / 2, barH);
    shape.lineTo(barTop / 2, barH);
    shape.lineTo(barTop / 2, barH - sqH);
    shape.quadraticCurveTo(barW / 2, barH - drop - sqH, barW / 2, 0);
    shape.closePath();
    return shape;
  }, []);

  const ovoloIntHShape = useMemo(() => {
    const drop = mm(2);
    const sqH = mm(2);
    const shape = new THREE.Shape();
    shape.moveTo(0, -barW / 2);
    shape.quadraticCurveTo(barH - drop - sqH, -barW / 2, barH - sqH, -barTop / 2);
    shape.lineTo(barH, -barTop / 2);
    shape.lineTo(barH, barTop / 2);
    shape.lineTo(barH - sqH, barTop / 2);
    shape.quadraticCurveTo(barH - drop - sqH, barW / 2, 0, barW / 2);
    shape.closePath();
    return shape;
  }, []);

  const vGeomInt = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(ovoloIntShape, {
      depth: clearHeight + mm(18),
      bevelEnabled: false,
      steps: 1,
      curveSegments: 32,
    });
    g.rotateX(-Math.PI / 2);
    g.translate(0, -(clearHeight + mm(18)) / 2, 0);
    g.computeVertexNormals();
    return g;
  }, [clearHeight, ovoloIntShape]);

  const hGeomInt = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(ovoloIntHShape, {
      depth: clearWidth + mm(18),
      bevelEnabled: false,
      steps: 1,
      curveSegments: 32,
    });
    g.rotateY(Math.PI / 2);
    g.translate(-(clearWidth + mm(18)) / 2, 0, 0);
    g.computeVertexNormals();
    return g;
  }, [clearWidth, ovoloIntHShape]);

  const bars = useMemo(() => {
    if (barPattern === 'custom') {
      const vBars = customBars.filter(b => b.type === 'v');
      const hBars = customBars.filter(b => b.type === 'h');
      const result = [];
      customBars.forEach(b => {
        if (b.type === 'v') {
          const idx = vBars.indexOf(b);
          const x = idx === 0
            ? -clearWidth / 2 + mm(b.mm)   // 1. od lewej
            : clearWidth / 2 - mm(b.mm);    // 2. od prawej
          result.push({ type: 'v', x, y: 0 });
        } else {
          const idx = hBars.indexOf(b);
          const y = idx === 0
            ? -clearHeight / 2 + mm(b.mm)  // 1. od dołu
            : clearHeight / 2 - mm(b.mm);  // 2. od góry
          result.push({ type: 'h', x: 0, y });
        }
      });
      return result;
    }
    if (!pattern) return [];
    const items = [];
    const { h, v } = pattern;
    for (let i = 1; i <= v; i++) {
      const x = -clearWidth / 2 + (clearWidth / (v + 1)) * i;
      items.push({ type: 'v', x, y: 0 });
    }
    for (let i = 1; i <= h; i++) {
      const y = -clearHeight / 2 + (clearHeight / (h + 1)) * i;
      items.push({ type: 'h', x: 0, y });
    }
    return items;
  }, [clearWidth, clearHeight, barPattern, customBars, pattern]);

  if (bars.length === 0) return null;

  return (
    <group>
      {bars.map((bar, i) => {
        const geom = bar.type === 'v' ? vGeom : hGeom;
        const geomInt = bar.type === 'v' ? vGeomInt : hGeomInt;
        const sLen = bar.type === 'v' ? clearHeight : clearWidth;
        return (
          <group key={i} position={[bar.x, bar.y, 0]}>
            {/* exterior side - trapez */}
            <mesh geometry={geomInt} position={[0, 0, -glassHalf]} rotation={[0, 0, 0]} castShadow receiveShadow>
              <primitive object={matInt} attach="material" />
            </mesh>
            {/* interior side - ovolo */}
            <mesh geometry={geom} position={[0, 0, glassHalf]} rotation={[Math.PI, 0, 0]} castShadow receiveShadow>
              <primitive object={material} attach="material" />
            </mesh>
            {/* DG spacer bar między szybami */}
            {doubleGlazing && (
              <mesh position={[0, 0, 0]} castShadow receiveShadow>
                {bar.type === 'v'
                  ? <boxGeometry args={[spacerBarW, sLen, spacerDepth]} />
                  : <boxGeometry args={[sLen, spacerBarW, spacerDepth]} />
                }
                <primitive object={spacerMat} attach="material" />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

function Sash({
  width,
  height,
  depth,
  stileWidth,
  topRail,
  bottomRail,
  zOffset,
  yOffset,
  color = '#f6f4ef',
  profiledBottom = false,
  glassThickness = 24,
  flipChamfer = false,
  barPattern = 'none',
  customBars = [],
  colorExt = null,
  colorInt = null,
  frosted = false,
  doubleGlazing = false,
  spacerColor = 'silver',
}) {
  const colorE = colorExt || color;
  const colorI = colorInt || color;

  const coreMaterial    = useMemo(() => new THREE.MeshPhysicalMaterial({ color: colorE, roughness: 0.72, metalness: 0.02, clearcoat: 0.06, clearcoatRoughness: 0.4 }), [colorE]);
  const extCoreMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({ color: colorE, roughness: 0.72, metalness: 0.02, clearcoat: 0.06, clearcoatRoughness: 0.4 }), [colorE]);
  const intCoreMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({ color: colorI, roughness: 0.72, metalness: 0.02, clearcoat: 0.06, clearcoatRoughness: 0.4 }), [colorI]);

  const externalBeadMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.38,
        metalness: 0.04,
        clearcoat: 0.25,
        clearcoatRoughness: 0.1,
      }),
    [color]
  );

  const internalBeadMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.38,
        metalness: 0.04,
        clearcoat: 0.25,
        clearcoatRoughness: 0.1,
      }),
    [color]
  );

  const w = mm(width);
  const h = mm(height);
  const d = mm(depth);
  const stile = mm(stileWidth);
  const top = mm(topRail);
  const bottom = mm(bottomRail);

  const clearWidth = Math.max(w - stile * 2, mm(80));
  const clearHeight = Math.max(h - top - bottom, mm(140));
  const glazingLineInsetFromGlass = mm(9);
  const glazingEdgeLineWidth = clearWidth + glazingLineInsetFromGlass * 2;
  const glazingEdgeLineHeight = clearHeight + glazingLineInsetFromGlass * 2;
  const glassD = mm(glassThickness);
  const glassCenterZ = 0;

  const topRailY = h / 2 - top / 2;
  const bottomRailY = -h / 2 + bottom / 2;
  const glassY = -h / 2 + bottom + clearHeight / 2;
  const glazingLineZ = flipChamfer ? -d / 2 - mm(0.3) : d / 2 + mm(0.3);

  return (
    <group position={[0, yOffset, zOffset]}>
      {/* left stile */}
      <SashStileCore width={stileWidth} height={height} depth={depth} openingSide="right" flip={flipChamfer} position={[-w/2+stile/2, 0, 0]} material={extCoreMaterial} half="ext" />
      <SashStileCore width={stileWidth} height={height} depth={depth} openingSide="right" flip={flipChamfer} position={[-w/2+stile/2, 0, 0]} material={intCoreMaterial} half="int" />
      <InternalOvoloStileBead width={stileWidth} height={height - topRail - bottomRail + 18 * 2} depth={depth} openingSide="right" flip={flipChamfer} position={[-w/2+stile/2, glassY, 0]} material={intCoreMaterial} />

      {/* right stile */}
      <SashStileCore width={stileWidth} height={height} depth={depth} openingSide="left" flip={flipChamfer} position={[w/2-stile/2, 0, 0]} material={extCoreMaterial} half="ext" />
      <SashStileCore width={stileWidth} height={height} depth={depth} openingSide="left" flip={flipChamfer} position={[w/2-stile/2, 0, 0]} material={intCoreMaterial} half="int" />
      <InternalOvoloStileBead width={stileWidth} height={height - topRail - bottomRail + 18 * 2} depth={depth} openingSide="left" flip={flipChamfer} position={[w/2-stile/2, glassY, 0]} material={intCoreMaterial} />

      {/* top rail */}
      <SashRailCore width={width} height={topRail} depth={depth} openingSide="bottom" flip={flipChamfer} position={[0, topRailY, 0]} material={extCoreMaterial} half="ext" />
      <SashRailCore width={width} height={topRail} depth={depth} openingSide="bottom" flip={flipChamfer} position={[0, topRailY, 0]} material={intCoreMaterial} half="int" />
      <InternalOvoloRailBead width={width - stileWidth * 2 + 18 * 2} height={topRail} depth={depth} openingSide="bottom" flip={flipChamfer} position={[0, topRailY, 0]} material={intCoreMaterial} />

      {/* bottom rail */}
      {profiledBottom ? (
        <LowerBottomRail width={width} height={bottomRail} depth={depth} yCenter={bottomRailY} stileWidth={stileWidth} coreMaterial={extCoreMaterial} intCoreMaterial={intCoreMaterial} extBeadMaterial={extCoreMaterial} intBeadMaterial={intCoreMaterial} flip={flipChamfer} />
      ) : (
        <>
          <SashRailCore width={width} height={bottomRail} depth={depth} openingSide="top" flip={flipChamfer} position={[0, bottomRailY, 0]} material={extCoreMaterial} half="ext" />
          <SashRailCore width={width} height={bottomRail} depth={depth} openingSide="top" flip={flipChamfer} position={[0, bottomRailY, 0]} material={intCoreMaterial} half="int" />
          <InternalOvoloRailBead width={width - stileWidth * 2 + 18 * 2} height={bottomRail} depth={depth} openingSide="top" flip={flipChamfer} position={[0, bottomRailY, 0]} material={intCoreMaterial} />
        </>
      )}

      <GlassPane size={[clearWidth, clearHeight, glassD]} position={[0, glassY, glassCenterZ]} frosted={frosted} doubleGlazing={doubleGlazing} spacerColor={spacerColor} />
      <group position={[0, glassY, glassCenterZ]}>
        <GlazingBars clearWidth={clearWidth} clearHeight={clearHeight} glassDepth={glassD} barPattern={barPattern} customBars={customBars} material={extCoreMaterial} materialInt={intCoreMaterial} doubleGlazing={doubleGlazing} spacerColor={spacerColor} />
      </group>
    </group>
  );
}

function RoundedPartingBead({ length, orientation = 'vertical', material, materialInt }) {
  const beadWidth = mm(8);
  const beadProjection = mm(17);
  const beadRadius = beadWidth / 2;
  const straightProjection = beadProjection - beadRadius;
  const matInt = materialInt || material;
  const halfW = beadWidth / 2;

  if (orientation === 'horizontal') {
    return (
      <group>
        <mesh castShadow receiveShadow position={[0, -straightProjection / 2, halfW / 2]}>
          <boxGeometry args={[length, straightProjection, halfW]} />
          <primitive object={material} attach="material" />
        </mesh>
        <mesh castShadow receiveShadow position={[0, -straightProjection / 2, -halfW / 2]}>
          <boxGeometry args={[length, straightProjection, halfW]} />
          <primitive object={matInt} attach="material" />
        </mesh>
      </group>
    );
  }

  return (
    <group>
      {/* ext half */}
      <mesh castShadow receiveShadow position={[straightProjection / 2, 0, halfW / 2]}>
        <boxGeometry args={[straightProjection, length, halfW]} />
        <primitive object={material} attach="material" />
      </mesh>
      {/* int half */}
      <mesh castShadow receiveShadow position={[straightProjection / 2, 0, -halfW / 2]}>
        <boxGeometry args={[straightProjection, length, halfW]} />
        <primitive object={matInt} attach="material" />
      </mesh>
      {/* rounded top - ext half */}
      <mesh castShadow receiveShadow position={[straightProjection, 0, halfW / 2]}>
        <cylinderGeometry args={[beadRadius, beadRadius, length, 24, 1, false, 0, Math.PI]} />
        <primitive object={material} attach="material" />
      </mesh>
      {/* rounded top - int half */}
      <mesh castShadow receiveShadow position={[straightProjection, 0, -halfW / 2]} rotation={[0, Math.PI, 0]}>
        <cylinderGeometry args={[beadRadius, beadRadius, length, 24, 1, false, 0, Math.PI]} />
        <primitive object={matInt} attach="material" />
      </mesh>
    </group>
  );
}

function addRoundedRectPath(path, cx, cy, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  path.moveTo(cx - width / 2 + r, cy - height / 2);
  path.lineTo(cx + width / 2 - r, cy - height / 2);
  path.absarc(cx + width / 2 - r, cy - height / 2 + r, r, -Math.PI / 2, 0, false);
  path.lineTo(cx + width / 2, cy + height / 2 - r);
  path.absarc(cx + width / 2 - r, cy + height / 2 - r, r, 0, Math.PI / 2, false);
  path.lineTo(cx - width / 2 + r, cy + height / 2);
  path.absarc(cx - width / 2 + r, cy + height / 2 - r, r, Math.PI / 2, Math.PI, false);
  path.lineTo(cx - width / 2, cy - height / 2 + r);
  path.absarc(cx - width / 2 + r, cy - height / 2 + r, r, Math.PI, Math.PI * 1.5, false);
  path.closePath();
}

function addRectPath(path, cx, cy, width, height) {
  path.moveTo(cx - width / 2, cy - height / 2);
  path.lineTo(cx + width / 2, cy - height / 2);
  path.lineTo(cx + width / 2, cy + height / 2);
  path.lineTo(cx - width / 2, cy + height / 2);
  path.closePath();
}

function JambPulleyTestCutout({
  length,
  material,
  materialInt,
  side = 'left',
  jambThickness = 28,
  jambDepth = 130,
  plateWidth = 25,
  plateHeight = 128,
  platePocketDepth = 3,
  wheelOpeningWidth = 9,
  wheelOpeningHeight = 44,
  yFromTop = 100,
  zCenter = 8.5,
}) {
  const halfDepth = jambDepth / 2;
  const matInt = materialInt || material;

  function buildFrontGeom(zFrom, zTo) {
    const fw = mm(zTo - zFrom);
    const fh = mm(length);
    const fd = mm(platePocketDepth);
    const hcx = side === 'left' ? -mm(zCenter - zFrom) : mm(zCenter - zFrom);
    const hcy = mm(length) / 2 - mm(yFromTop) - mm(plateHeight / 2);
    const shape = new THREE.Shape();
    addRectPath(shape, 0, 0, fw, fh);
    // only add hole if plate center falls within this half
    const zCenterInRange = zCenter >= zFrom && zCenter <= zTo;
    if (zCenterInRange) {
      const hole = new THREE.Path();
      addRoundedRectPath(hole, hcx, hcy, mm(plateWidth), mm(plateHeight), mm(plateWidth / 2));
      shape.holes.push(hole);
    }
    const g = new THREE.ExtrudeGeometry(shape, { depth: fd, bevelEnabled: false, steps: 1, curveSegments: 32 });
    g.translate(0, 0, -fd / 2);
    g.rotateY(side === 'left' ? Math.PI / 2 : -Math.PI / 2);
    g.computeVertexNormals();
    return g;
  }

  function buildBackGeom(zFrom, zTo) {
    const fw = mm(zTo - zFrom);
    const fh = mm(length);
    const bd = mm(jambThickness - platePocketDepth);
    const hcx = side === 'left' ? -mm(zCenter - zFrom) : mm(zCenter - zFrom);
    const hcy = mm(length) / 2 - mm(yFromTop) - mm(plateHeight / 2);
    const shape = new THREE.Shape();
    addRectPath(shape, 0, 0, fw, fh);
    const zCenterInRange = zCenter >= zFrom && zCenter <= zTo;
    if (zCenterInRange) {
      const hole = new THREE.Path();
      addRectPath(hole, hcx, hcy, mm(wheelOpeningWidth), mm(wheelOpeningHeight));
      shape.holes.push(hole);
    }
    const g = new THREE.ExtrudeGeometry(shape, { depth: bd, bevelEnabled: false, steps: 1, curveSegments: 16 });
    g.translate(0, 0, -bd / 2);
    g.rotateY(side === 'left' ? Math.PI / 2 : -Math.PI / 2);
    g.computeVertexNormals();
    return g;
  }

  const frontGeomExt = useMemo(() => buildFrontGeom(0, halfDepth), [length, side, halfDepth, platePocketDepth, zCenter, yFromTop, plateWidth, plateHeight]);
  const backGeomExt  = useMemo(() => buildBackGeom(0, halfDepth),  [length, side, halfDepth, jambThickness, platePocketDepth, zCenter, yFromTop, plateHeight, wheelOpeningWidth, wheelOpeningHeight]);
  const frontGeomInt = useMemo(() => buildFrontGeom(halfDepth, jambDepth), [length, side, halfDepth, jambDepth, platePocketDepth, zCenter, yFromTop, plateWidth, plateHeight]);
  const backGeomInt  = useMemo(() => buildBackGeom(halfDepth, jambDepth),  [length, side, halfDepth, jambDepth, jambThickness, platePocketDepth, zCenter, yFromTop, plateHeight, wheelOpeningWidth, wheelOpeningHeight]);

  const frontCenterX = side === 'left' ? mm(jambThickness / 2 - platePocketDepth / 2) : mm(-jambThickness / 2 + platePocketDepth / 2);
  const backCenterX  = side === 'left' ? mm(-platePocketDepth / 2) : mm(platePocketDepth / 2);

  // ext half: Z offset = +halfDepth/2 (exterior side)
  // int half: Z offset = -halfDepth/2 (interior side)
  const extZ = mm(halfDepth / 2);
  const intZ = -mm(halfDepth / 2);

  return (
    <group>
      <mesh geometry={frontGeomExt} position={[frontCenterX, 0, extZ]} castShadow receiveShadow>
        <primitive object={material} attach="material" />
      </mesh>
      <mesh geometry={backGeomExt} position={[backCenterX, 0, extZ]} castShadow receiveShadow>
        <primitive object={material} attach="material" />
      </mesh>
      <mesh geometry={frontGeomInt} position={[frontCenterX, 0, intZ]} castShadow receiveShadow>
        <primitive object={matInt} attach="material" />
      </mesh>
      <mesh geometry={backGeomInt} position={[backCenterX, 0, intZ]} castShadow receiveShadow>
        <primitive object={matInt} attach="material" />
      </mesh>
    </group>
  );
}

function PulleyPlatePreview({ position = [0, 0, 0], width = 25, height = 128, thickness = 3, material, cornerRadius = 12.5, rotation = [0, 0, 0] }) {
  const geometry = useMemo(() => {
    const w = mm(width);
    const h = mm(height);
    const d = mm(thickness);
    const holeW = mm(10);
    const holeH = mm(46);
    const r = Math.min(mm(cornerRadius), w / 2, h / 2);

    const shape = new THREE.Shape();
    shape.moveTo(-w / 2 + r, -h / 2);
    shape.lineTo(w / 2 - r, -h / 2);
    shape.absarc(w / 2 - r, -h / 2 + r, r, -Math.PI / 2, 0, false);
    shape.lineTo(w / 2, h / 2 - r);
    shape.absarc(w / 2 - r, h / 2 - r, r, 0, Math.PI / 2, false);
    shape.lineTo(-w / 2 + r, h / 2);
    shape.absarc(-w / 2 + r, h / 2 - r, r, Math.PI / 2, Math.PI, false);
    shape.lineTo(-w / 2, -h / 2 + r);
    shape.absarc(-w / 2 + r, -h / 2 + r, r, Math.PI, Math.PI * 1.5, false);
    shape.closePath();

    const hole = new THREE.Path();
    hole.moveTo(-holeW / 2, -holeH / 2);
    hole.lineTo(holeW / 2, -holeH / 2);
    hole.lineTo(holeW / 2, holeH / 2);
    hole.lineTo(-holeW / 2, holeH / 2);
    hole.closePath();
    shape.holes.push(hole);

    const g = new THREE.ExtrudeGeometry(shape, {
      depth: d,
      bevelEnabled: false,
      steps: 1,
      curveSegments: 32,
    });

    g.translate(0, 0, -d / 2);
    g.computeVertexNormals();
    return g;
  }, [width, height, thickness, cornerRadius]);

  return (
    <mesh geometry={geometry} position={position} rotation={rotation} castShadow receiveShadow>
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function FrontFaceMarker() {
  return null;
}

function AxesGizmo({ origin = [0, 0, 0], size = 80 }) {
  const s = mm(size);
  return (
    <group>
      <Line points={[origin, [origin[0] + s, origin[1], origin[2]]]} color="#d32f2f" lineWidth={2} />
      <Text position={[origin[0] + s + mm(8), origin[1], origin[2]]} fontSize={0.03} color="#d32f2f" anchorX="center" anchorY="middle">X</Text>

      <Line points={[origin, [origin[0], origin[1] + s, origin[2]]]} color="#00c853" lineWidth={2} />
      <Text position={[origin[0], origin[1] + s + mm(8), origin[2]]} fontSize={0.03} color="#00c853" anchorX="center" anchorY="middle">Y</Text>

      <Line points={[origin, [origin[0], origin[1], origin[2] + s]]} color="#2962ff" lineWidth={2} />
      <Text position={[origin[0], origin[1], origin[2] + s + mm(8)]} fontSize={0.03} color="#2962ff" anchorX="center" anchorY="middle">Z</Text>
    </group>
  );
}

function PulleyWheelPreview({
  position = [0, 0, 0],
  diameter = 42,
  thickness = 7,
  material,
  orientation = [0, 0, 0],
  spin = 0,
  grooveWidth = 6,
  axleDiameter = 8,
}) {
  const capMaterial = useMemo(() => {
    const m = material.clone();
    m.side = THREE.DoubleSide;
    return m;
  }, [material]);

  const tyreGeometry = useMemo(() => {
    const radius = mm(diameter / 2);
    const halfT = mm(thickness / 2);
    const grooveHalf = mm(grooveWidth / 2);
    const grooveDepth = Math.min(mm(2.2), radius * 0.18);
    const hubRadius = mm(axleDiameter / 2 + 2);

    const points = [
      new THREE.Vector2(radius, -halfT),
      new THREE.Vector2(radius, -grooveHalf),
      new THREE.Vector2(radius - grooveDepth, 0),
      new THREE.Vector2(radius, grooveHalf),
      new THREE.Vector2(radius, halfT),
      new THREE.Vector2(hubRadius, halfT),
      new THREE.Vector2(hubRadius, -halfT),
    ];

    const g = new THREE.LatheGeometry(points, 64);
    g.computeVertexNormals();
    return g;
  }, [diameter, thickness, grooveWidth, axleDiameter]);

  const capGeometry = useMemo(() => {
    const radius = mm(diameter / 2);
    const grooveDepth = Math.min(mm(2.2), radius * 0.18);
    const capRadius = radius - grooveDepth;
    const g = new THREE.CircleGeometry(capRadius, 48);
    g.computeVertexNormals();
    return g;
  }, [diameter]);

  const halfT = mm(thickness / 2);

  return (
    <group position={position} rotation={orientation}>
      <group rotation={[0, spin, 0]}>
        <mesh geometry={tyreGeometry} castShadow receiveShadow>
          <primitive object={material} attach="material" />
        </mesh>

        <mesh geometry={capGeometry} position={[0, -halfT, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <primitive object={capMaterial} attach="material" />
        </mesh>

        <mesh geometry={capGeometry} position={[0, halfT, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <primitive object={capMaterial} attach="material" />
        </mesh>

        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[mm(axleDiameter / 2), mm(axleDiameter / 2), mm(thickness + 1), 32]} />
          <primitive object={material} attach="material" />
        </mesh>
      </group>
    </group>
  );
}

function CordPreview({ points, ropeRadius = 2.2, stripeOffset = 0 }) {
  const curve = useMemo(() => {
    const vectors = points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    return new THREE.CatmullRomCurve3(vectors, false, 'catmullrom', 0.01);
  }, [points]);

  const ropeGeometry = useMemo(() => {
    const g = new THREE.TubeGeometry(curve, 140, mm(ropeRadius), 16, false);
    g.computeVertexNormals();
    return g;
  }, [curve, ropeRadius]);

  const stripePositions = useMemo(() => {
    const count = 14;
    return Array.from({ length: count }, (_, i) => {
      const raw = ((i + 1) / (count + 1) + stripeOffset) % 1;
      return raw < 0 ? raw + 1 : raw;
    });
  }, [stripeOffset]);

  return (
    <group>
      <mesh geometry={ropeGeometry} castShadow receiveShadow>
        <meshPhysicalMaterial color="#f3f1eb" roughness={0.88} metalness={0} clearcoat={0.02} />
      </mesh>

      {stripePositions.map((t, index) => {
        const pos = curve.getPointAt(t);
        const tangent = curve.getTangentAt(t).normalize();
        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);

        return (
          <mesh key={index} position={[pos.x, pos.y, pos.z]} quaternion={quat} castShadow={false} receiveShadow>
            <torusGeometry args={[mm(ropeRadius * 1.05), mm(0.45), 8, 20]} />
            <meshPhysicalMaterial color="#8a8f96" roughness={0.9} metalness={0} />
          </mesh>
        );
      })}
    </group>
  );
}

function buildPulleyCordPoints({ center, radius, leftDropY, rightDropY, z, arcSteps = 16 }) {
  const [cx, cy] = center;
  const points = [];

  points.push([cx + radius, rightDropY, z]);
  points.push([cx + radius, cy, z]);

  for (let i = 0; i <= arcSteps; i += 1) {
    const t = i / arcSteps;
    const angle = t * Math.PI;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    points.push([x, y, z]);
  }

  points.push([cx - radius, cy, z]);
  points.push([cx - radius, leftDropY, z]);

  return points;
}

function WeightPreview({ position = [0, 0, 0], size = 45, height = 180 }) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={[mm(size), mm(height), mm(size)]} />
      <meshPhysicalMaterial color="#77746d" roughness={0.82} metalness={0.18} clearcoat={0.04} />
    </mesh>
  );
}

function PulleySet({
  x = 0,
  y = 0,
  z = mm(-13.5),
  travel = 0,
  material,
  showMarker = true,
  showAxes = true,
  plateOffsetX = mm(-10),
  mirrorX = false,
  weightStartY = -mm(646),
  sashDropY = -mm(556),
}) {
  const pulleyCordRadius = mm(18.8);
  const pulleyTravel = mm(travel);

  const cordPoints = buildPulleyCordPoints({
    center: [0, 0],
    radius: pulleyCordRadius,
    leftDropY: sashDropY - pulleyTravel,
    rightDropY: weightStartY + pulleyTravel,
    z: 0,
  });

  const pulleyRotation = -pulleyTravel / pulleyCordRadius;
  const stripeOffset = travel / 180;

  return (
    <group position={[x, y, z]} scale={[mirrorX ? -1 : 1, 1, 1]}>
      <PulleyPlatePreview
        position={[plateOffsetX - mm(0.25), 0, 0]}
        width={25}
        height={128}
        thickness={3}
        material={material}
        rotation={[0, -Math.PI / 2, 0]}
      />

      {showMarker && (
        <FrontFaceMarker
          position={[plateOffsetX, 0, 0]}
          width={25}
          height={128}
          thickness={3}
          rotation={[0, -Math.PI / 2, 0]}
        />
      )}

      {showAxes && <AxesGizmo origin={[mm(40), -mm(40), 0]} size={70} />}

      <PulleyWheelPreview
        position={[0, 0, 0]}
        diameter={42}
        thickness={7}
        material={material}
        orientation={[Math.PI / 2, 0, 0]}
        spin={pulleyRotation}
      />

      <CordPreview points={cordPoints} stripeOffset={stripeOffset} />

      <WeightPreview position={[pulleyCordRadius, weightStartY + pulleyTravel, 0]} size={45} height={180} />
    </group>
  );
}

function JambWithPartingBead({
  length,
  position,
  material,
  materialInt,
  beadMaterial,
  beadMaterialInt,
  orientation = 'vertical',
  side = 'left',
  showBead = true,
  beadLength = null,
  beadYOffset = 0,
  showPulleyTestCutout = false,
  pulleyCutoutYFromTop = 100,
  pulleyCutoutZCenter = 8.5,
  pulleyMaterial = null,
  pulleyUpperTravel = 0,
  pulleyLowerTravel = 0,
  weightStartY = -mm(646),
  sashDropY = -mm(556),
}) {
  const jambDepth = mm(130);
  const jambHalf = mm(65);
  const jambThickness = mm(28);
  const matInt = materialInt || material;
  const beadMatInt = beadMaterialInt || beadMaterial;

  if (orientation === 'horizontal') {
    return (
      <group position={position}>
        <FramePiece size={[length, jambThickness, jambHalf]} position={[0, 0, jambHalf / 2]} material={material} />
        <FramePiece size={[length, jambThickness, jambHalf]} position={[0, 0, -jambHalf / 2]} material={matInt} />
        {showBead && (
          <group position={[0, -jambThickness / 2, 0]}>
            <RoundedPartingBead length={length} orientation="horizontal" material={beadMaterial} materialInt={beadMatInt} />
          </group>
        )}
      </group>
    );
  }

  const beadX = side === 'left' ? jambThickness / 2 : -jambThickness / 2;
  const actualBeadLength = beadLength ?? length;
  const pulleyLocalY = length / 2 - mm(pulleyCutoutYFromTop) - mm(128 / 2);
  const pulleyLocalX = side === 'left' ? mm(2.5) : mm(-2.5);
  const pulleyMirrorX = side === 'left';

  return (
    <group position={position}>
      {showPulleyTestCutout ? (
        <>
          <JambPulleyTestCutout length={length * 1000} material={material} materialInt={matInt} side={side} jambThickness={28} jambDepth={130} plateWidth={25} plateHeight={128} platePocketDepth={3} wheelOpeningWidth={9} wheelOpeningHeight={44} yFromTop={pulleyCutoutYFromTop} zCenter={pulleyCutoutZCenter} />
          <JambPulleyTestCutout length={length * 1000} material={material} materialInt={matInt} side={side} jambThickness={28} jambDepth={130} plateWidth={25} plateHeight={128} platePocketDepth={3} wheelOpeningWidth={9} wheelOpeningHeight={44} yFromTop={pulleyCutoutYFromTop} zCenter={-pulleyCutoutZCenter} />
        </>
      ) : (
        <>
          <FramePiece size={[jambThickness, length, jambHalf]} position={[0, 0, jambHalf / 2]} material={material} />
          <FramePiece size={[jambThickness, length, jambHalf]} position={[0, 0, -jambHalf / 2]} material={matInt} />
        </>
      )}

      {showPulleyTestCutout && pulleyMaterial && (
        <>
          <PulleySet x={pulleyLocalX} y={pulleyLocalY} z={mm(pulleyCutoutZCenter)} travel={pulleyUpperTravel} material={pulleyMaterial} showMarker={false} showAxes={false} plateOffsetX={mm(-10)} mirrorX={pulleyMirrorX} weightStartY={weightStartY} sashDropY={sashDropY} />
          <PulleySet x={pulleyLocalX} y={pulleyLocalY} z={-mm(pulleyCutoutZCenter)} travel={pulleyLowerTravel} material={pulleyMaterial} showMarker={false} showAxes={false} plateOffsetX={mm(-10)} mirrorX={pulleyMirrorX} weightStartY={weightStartY} sashDropY={sashDropY} />
        </>
      )}

      {showBead && (
        <group position={[beadX, beadYOffset, 0]} rotation={[0, 0, side === 'left' ? 0 : Math.PI]}>
          <RoundedPartingBead length={actualBeadLength} orientation="vertical" material={beadMaterial} materialInt={beadMatInt} />
        </group>
      )}
    </group>
  );
}

function ExternalBoxElement({ height, side = 'right', position, color = '#f0e6d3' }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(mm(20), 0);
    shape.lineTo(mm(20), mm(60));
    shape.absarc(mm(0), mm(60), mm(20), 0, Math.PI / 2, false);
    shape.lineTo(0, height);
    shape.lineTo(mm(100), height);
    shape.lineTo(mm(100), 0);
    shape.closePath();

    const g = new THREE.ExtrudeGeometry(shape, {
      depth: mm(17),
      bevelEnabled: false,
      steps: 1,
      curveSegments: 24,
    });

    g.computeVertexNormals();
    return g;
  }, [height]);

  const extMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.5,
    metalness: 0.0,
    clearcoat: 0.2,
    clearcoatRoughness: 0.12,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  }), [color]);

  return (
    <group
      position={position}
      scale={[side === 'left' ? -1 : 1, 1, 1]}
    >
      <mesh geometry={geometry} castShadow receiveShadow>
        <primitive object={extMaterial} attach="material" />
      </mesh>
    </group>
  );
}

function InternalBoxElement({ height, side = 'right', position, color = '#f0e6d3' }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0, height);
    shape.lineTo(mm(80), height);
    shape.lineTo(mm(80), 0);
    shape.closePath();

    const g = new THREE.ExtrudeGeometry(shape, {
      depth: mm(17),
      bevelEnabled: false,
      steps: 1,
    });

    g.computeVertexNormals();
    return g;
  }, [height]);

  const intMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.5,
    metalness: 0.0,
    clearcoat: 0.2,
    clearcoatRoughness: 0.12,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  }), [color]);

  return (
    <group position={position} scale={[side === 'left' ? -1 : 1, 1, 1]}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <primitive object={intMaterial} attach="material" />
      </mesh>
    </group>
  );
}

function StaffBeadHorizontal({ width, position, flipZ = false, color = '#f0e6d3' }) {
  const geometry = useMemo(() => {
    const r = mm(8.5);
    const bw = mm(17);
    const bh = mm(17);
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0, bh);
    shape.lineTo(bw - r, bh);
    shape.absarc(bw - r, bh / 2, r, Math.PI / 2, -Math.PI / 2, true);
    shape.lineTo(0, 0);
    shape.closePath();

    const g = new THREE.ExtrudeGeometry(shape, {
      depth: width,
      bevelEnabled: false,
      steps: 1,
      curveSegments: 24,
    });

    g.rotateY(Math.PI / 2);
    g.translate(-width / 2, 0, 0);
    g.computeVertexNormals();
    return g;
  }, [width]);

  const staffMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.4,
    metalness: 0.0,
    clearcoat: 0.3,
    clearcoatRoughness: 0.1,
  }), [color]);

  return (
    <group position={position} scale={[1, 1, flipZ ? -1 : 1]}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <primitive object={staffMaterial} attach="material" />
      </mesh>
    </group>
  );
}

function StaffBead({ height, position, side = 'right', color = '#f0e6d3', colorInt = null }) {
  const geometry = useMemo(() => {
    const r = mm(8.5);
    const w = mm(17);
    const h = mm(17);
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0, h);
    shape.lineTo(w - r, h);
    shape.absarc(w - r, h / 2, r, Math.PI / 2, -Math.PI / 2, true);
    shape.lineTo(0, 0);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, steps: 1, curveSegments: 24 });
    g.rotateX(-Math.PI / 2);
    g.computeVertexNormals();
    return g;
  }, [height]);

  const staffMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({ color, roughness: 0.72, metalness: 0.0, clearcoat: 0.06, clearcoatRoughness: 0.4 }), [color]);
  const staffIntMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({ color: colorInt || color, roughness: 0.72, metalness: 0.0, clearcoat: 0.06, clearcoatRoughness: 0.4 }), [colorInt, color]);

  return (
    <group position={position} rotation={[0, Math.PI, 0]} scale={[side === 'left' ? -1 : 1, 1, 1]}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <primitive object={staffIntMaterial} attach="material" />
      </mesh>
    </group>
  );
}

function TraditionalSill({ width, position, material, materialInt }) {
  const sillExtension = 52;
  const totalWidth = width + sillExtension * 2;
  const matInt = materialInt || material;

  // External part: x=120.997 → 164.003 (only the nose/slope)
  const extGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(mm(120.997), mm(0));
    shape.lineTo(mm(164.003), mm(0));
    shape.lineTo(mm(164.003), mm(58.414));
    shape.lineTo(mm(120.997), mm(58.414));
    shape.closePath();

    const g = new THREE.ExtrudeGeometry(shape, { depth: mm(totalWidth), bevelEnabled: false, steps: 1 });
    g.rotateY(Math.PI / 2);
    g.scale(1, -1, 1);
    g.translate(mm(-totalWidth / 2), mm(29.207), mm(164 / 2));
    g.computeVertexNormals();
    return g;
  }, [totalWidth]);

  // Internal part: x=0 → 120.997 (tall face + vertical wall + top)
  const intGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(mm(0), mm(29.143));
    shape.lineTo(mm(0), mm(58.414));
    shape.lineTo(mm(120.997), mm(58.414));
    shape.lineTo(mm(120.997), mm(0));
    shape.lineTo(mm(118.013), mm(3.005));
    shape.lineTo(mm(118.013), mm(12.0));
    shape.lineTo(mm(2.646), mm(26.18));
    shape.absarc(mm(3.016), mm(29.133), mm(2.995), THREE.MathUtils.degToRad(263.002), THREE.MathUtils.degToRad(180.0), true);
    shape.closePath();

    const g = new THREE.ExtrudeGeometry(shape, { depth: mm(totalWidth), bevelEnabled: false, steps: 1, curveSegments: 24 });
    g.rotateY(Math.PI / 2);
    g.scale(1, -1, 1);
    g.translate(mm(-totalWidth / 2), mm(29.207), mm(164 / 2));
    g.computeVertexNormals();
    return g;
  }, [totalWidth]);

  return (
    <group position={position}>
      <mesh geometry={extGeometry} castShadow receiveShadow>
        <primitive object={matInt} attach="material" />
      </mesh>
      <mesh geometry={intGeometry} castShadow receiveShadow>
        <primitive object={material} attach="material" />
      </mesh>
    </group>
  );
}

export default function ParametricSashWindow({
  width = 1200,
  height = 1800,
  boxDepth = 164,
  sashDepth = 57,
  opening = 0,
  upperOpening = 0,
  showGuides = true,
  upperBars = 'none',
  lowerBars = 'none',
  upperCustomBars = [],
  lowerCustomBars = [],
  pulleyDemoTravel = 0,
  woodColor = '#f0e6d3',
  woodColorExt = null,
  woodColorInt = null,
  showHorns = true,
  hornType = 'A',
  upperGlass = 'clear',
  lowerGlass = 'clear',
  doubleGlazing = false,
  spacerColor = 'silver',
  ironmongery = 'brass',
}) {
  const cExt = woodColorExt || woodColor;
  const cInt = woodColorInt || woodColor;

  const ironmongeryMats = useMemo(() => {
    const defs = {
      brass: {
        main:  { color: '#d4af37', metalness: 0.92, roughness: 0.18 },
        dark:  { color: '#b38728', metalness: 0.92, roughness: 0.26 },
        screw: { color: '#7a5a16', metalness: 0.7,  roughness: 0.38 },
      },
      chrome: {
        main:  { color: '#e8eaec', metalness: 1.0,  roughness: 0.04 },
        dark:  { color: '#c8cacc', metalness: 1.0,  roughness: 0.08 },
        screw: { color: '#a8aaac', metalness: 0.95, roughness: 0.12 },
      },
      stainless: {
        main:  { color: '#c8c8c8', metalness: 0.9,  roughness: 0.25 },
        dark:  { color: '#a8a8a8', metalness: 0.9,  roughness: 0.32 },
        screw: { color: '#888888', metalness: 0.85, roughness: 0.38 },
      },
      antique_brass: {
        main:  { color: '#9c7722', metalness: 0.75, roughness: 0.42 },
        dark:  { color: '#7a5810', metalness: 0.72, roughness: 0.52 },
        screw: { color: '#5c3e08', metalness: 0.65, roughness: 0.58 },
      },
    };
    const d = defs[ironmongery] || defs.brass;
    return {
      main:  new THREE.MeshStandardMaterial(d.main),
      dark:  new THREE.MeshStandardMaterial(d.dark),
      screw: new THREE.MeshStandardMaterial(d.screw),
    };
  }, [ironmongery]);

  const jambMaterial    = useMemo(() => new THREE.MeshPhysicalMaterial({ color: cExt, roughness: 0.72, metalness: 0.02, clearcoat: 0.06, clearcoatRoughness: 0.4 }), [cExt]);
  const jambIntMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({ color: cInt, roughness: 0.72, metalness: 0.02, clearcoat: 0.06, clearcoatRoughness: 0.4 }), [cInt]);
  const beadMaterial    = useMemo(() => new THREE.MeshPhysicalMaterial({ color: cExt, roughness: 0.72, metalness: 0.02, clearcoat: 0.06, clearcoatRoughness: 0.4 }), [cExt]);
  const beadIntMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({ color: cInt, roughness: 0.72, metalness: 0.02, clearcoat: 0.06, clearcoatRoughness: 0.4 }), [cInt]);
  const sillMaterial    = useMemo(() => new THREE.MeshPhysicalMaterial({ color: cExt, roughness: 0.42, metalness: 0.02, clearcoat: 0.22, clearcoatRoughness: 0.12, side: THREE.DoubleSide }), [cExt]);
  const sillIntMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({ color: cInt, roughness: 0.42, metalness: 0.02, clearcoat: 0.22, clearcoatRoughness: 0.12, side: THREE.DoubleSide }), [cInt]);

  const pulleyPlateMaterial = useMemo(
    () => new THREE.MeshPhysicalMaterial({
        ...(() => {
          const defs = {
            brass:         { color: '#c9a227', roughness: 0.34, metalness: 0.82 },
            chrome:        { color: '#e0e2e4', roughness: 0.05, metalness: 1.0  },
            stainless:     { color: '#c0c0c0', roughness: 0.28, metalness: 0.9  },
            antique_brass: { color: '#8b6914', roughness: 0.48, metalness: 0.75 },
          };
          return defs[ironmongery] || defs.brass;
        })(),
        clearcoat: 0.18,
        clearcoatRoughness: 0.14,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    [ironmongery]
  );

  const config = {
    jambDepth: 130,
    jambThickness: 28,
    partingBeadWidth: 8,
    partingBeadProjection: 17,
    sideGap: 3,
    topGap: 3,
    bottomGap: 3,
    stileWidth: 57,
    upperTopRail: 57,
    upperMeetingRail: 43,
    lowerMeetingRail: 43,
    lowerBottomRail: 90,
    interSashGap: 11.5,
    glassUnitThickness: 24,
    sillVisibleHeight: 58.414,
  };

  const w = mm(width);
  const h = mm(height);
  const bd = mm(boxDepth);

  const jambThickness = mm(config.jambThickness);
  const sillVisibleHeight = mm(config.sillVisibleHeight);
  const jambEmbedIntoSill = mm(23);

  const innerTopY = h / 2 + sillVisibleHeight - jambEmbedIntoSill - jambThickness;
  const sillTopY = -h / 2 + sillVisibleHeight;
  const innerW = Math.max(w - jambThickness * 2, mm(200));

  const sashWidth = innerW * 1000 - config.sideGap * 2;

  const upperVisibleTopY = innerTopY - mm(config.topGap);
  const lowerVisibleBottomY = sillTopY + mm(config.bottomGap);

  const availableHeight = upperVisibleTopY - lowerVisibleBottomY;
  const meetingY = lowerVisibleBottomY + availableHeight / 2;

  const upperSashHeight = (upperVisibleTopY - meetingY) * 1000 + config.upperMeetingRail / 2;
  const lowerSashHeight = (meetingY - lowerVisibleBottomY) * 1000 + config.lowerMeetingRail / 2;

  const upperH = mm(upperSashHeight);
  const lowerH = mm(lowerSashHeight);

  const yTopClosed = upperVisibleTopY - upperH / 2;
  const yBottomClosed = lowerVisibleBottomY + lowerH / 2;

  const maxLift = Math.max(0, (meetingY - lowerVisibleBottomY) * 1000 - 120);
  const lowerOpeningLift = Math.min(opening, maxLift);
  const upperOpeningDrop = Math.min(upperOpening, maxLift);

  const sashCenterOffset = mm((sashDepth + config.interSashGap) / 2);
  const trackFrontZ = -sashCenterOffset;
  const trackRearZ = sashCenterOffset;

  const pulleyCutoutZCenter = config.jambDepth / 2 - (config.jambDepth - config.partingBeadProjection) / 4;
  const upperPulleyTravel = upperOpeningDrop;
  const lowerPulleyTravel = -lowerOpeningLift;

  const jambOriginY = sillVisibleHeight - jambEmbedIntoSill;
  const meetingY_inJamb = meetingY - jambOriginY;
  const pulleyLocalY_calc = h / 2 - mm(100) - mm(64);
  const weightStartY = meetingY_inJamb - pulleyLocalY_calc;
  // linka do sashki: od pulley (y=0 w lokalnych) do meeting railu
  const sashDropY = meetingY_inJamb - pulleyLocalY_calc;

  return (
    <group rotation={[0, Math.PI, 0]}>
      <JambWithPartingBead
        length={h}
        position={[-w / 2 + jambThickness / 2, sillVisibleHeight - jambEmbedIntoSill, 0]}
        material={jambMaterial}
        materialInt={jambIntMaterial}
        beadMaterial={beadMaterial}
        beadMaterialInt={beadIntMaterial}
        side="left"
        beadLength={h - jambThickness}
        beadYOffset={jambThickness / 2}
        showPulleyTestCutout={true}
        pulleyCutoutYFromTop={100}
        pulleyCutoutZCenter={pulleyCutoutZCenter}
        pulleyMaterial={pulleyPlateMaterial}
        pulleyUpperTravel={upperPulleyTravel}
        pulleyLowerTravel={lowerPulleyTravel}
        weightStartY={weightStartY}
        sashDropY={sashDropY}
      />

      <JambWithPartingBead
        length={h}
        position={[w / 2 - jambThickness / 2, sillVisibleHeight - jambEmbedIntoSill, 0]}
        material={jambMaterial}
        materialInt={jambIntMaterial}
        beadMaterial={beadMaterial}
        beadMaterialInt={beadIntMaterial}
        side="right"
        beadLength={h - jambThickness}
        beadYOffset={jambThickness / 2}
        showPulleyTestCutout={true}
        pulleyCutoutYFromTop={100}
        pulleyCutoutZCenter={pulleyCutoutZCenter}
        pulleyMaterial={pulleyPlateMaterial}
        pulleyUpperTravel={upperPulleyTravel}
        pulleyLowerTravel={lowerPulleyTravel}
        weightStartY={weightStartY}
        sashDropY={sashDropY}
      />

      <JambWithPartingBead
        length={w + mm(104)}
        position={[0, h / 2 - jambThickness / 2 + sillVisibleHeight - jambEmbedIntoSill, 0]}
        material={jambMaterial}
        materialInt={jambIntMaterial}
        beadMaterial={beadMaterial}
        beadMaterialInt={beadIntMaterial}
        orientation="horizontal"
        showBead={true}
      />

      <TraditionalSill
        width={width}
        position={[0, -h / 2 + sillVisibleHeight / 2, 0]}
        material={sillMaterial}
        materialInt={sillIntMaterial}
      />

      <ExternalBoxElement
        height={h + mm(52)}
        side="right"
        position={[w / 2 - mm(100) + mm(52), jambOriginY - h / 2, bd / 2 - mm(17)]}
        color={cExt}
      />
      <ExternalBoxElement
        height={h + mm(52)}
        side="left"
        position={[-w / 2 + mm(100) - mm(52), jambOriginY - h / 2, bd / 2 - mm(17)]}
        color={cExt}
      />

      <StaffBeadHorizontal
        width={w + mm(104) - mm(160)}
        position={[0, jambOriginY - h / 2 + jambEmbedIntoSill, -bd / 2 + mm(80) - mm(65) - mm(17) - mm(17) + mm(34)]}
        flipZ={false}
        color={cInt}
      />
      <StaffBeadHorizontal
        width={w + mm(104) - mm(160)}
        position={[0, jambOriginY + h / 2 + mm(52) - mm(80) - mm(17), -bd / 2 + mm(80) - mm(65) - mm(17)]}
        flipZ={true}
        color={cInt}
      />

      <StaffBead
        height={h + mm(52) - jambEmbedIntoSill - mm(80)}
        side="right"
        position={[w / 2 + mm(52) - mm(80), jambOriginY - h / 2 + jambEmbedIntoSill, -bd / 2 + mm(80) - mm(65) - mm(17)]}
        color={cExt}
        colorInt={cInt}
      />
      <StaffBead
        height={h + mm(52) - jambEmbedIntoSill - mm(80)}
        side="left"
        position={[-w / 2 - mm(52) + mm(80), jambOriginY - h / 2 + jambEmbedIntoSill, -bd / 2 + mm(80) - mm(65) - mm(17)]}
        color={cExt}
        colorInt={cInt}
      />
      <InternalBoxElement
        height={h + mm(52) - jambEmbedIntoSill}
        side="right"
        position={[w / 2 + mm(52) - mm(80), jambOriginY - h / 2 + jambEmbedIntoSill, -bd / 2]}
        color={cInt}
      />
      <InternalBoxElement
        height={h + mm(52) - jambEmbedIntoSill}
        side="left"
        position={[-w / 2 - mm(52) + mm(80), jambOriginY - h / 2 + jambEmbedIntoSill, -bd / 2]}
        color={cInt}
      />
      <mesh position={[0, jambOriginY + h / 2 + mm(52) - mm(40), -bd / 2 + mm(8.5)]} castShadow receiveShadow>
        <boxGeometry args={[w + mm(104) - mm(160), mm(80), mm(17)]} />
        <meshPhysicalMaterial color={cInt} roughness={0.5} metalness={0.0} clearcoat={0.2} clearcoatRoughness={0.12} polygonOffset={true} polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
      </mesh>

      <mesh position={[0, jambOriginY + h / 2 + mm(50) - mm(48), bd / 2 - mm(8.5)]} castShadow receiveShadow>
        <boxGeometry args={[w - mm(96), mm(100), mm(17)]} />
        <meshPhysicalMaterial color={cExt} roughness={0.5} metalness={0.0} clearcoat={0.2} clearcoatRoughness={0.12} polygonOffset={true} polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
      </mesh>

      <Sash
        width={sashWidth}
        height={upperSashHeight}
        depth={sashDepth}
        stileWidth={config.stileWidth}
        topRail={config.upperTopRail}
        bottomRail={config.upperMeetingRail}
        zOffset={trackRearZ}
        yOffset={yTopClosed - mm(upperOpeningDrop)}
        color={cExt}
        glassThickness={config.glassUnitThickness}
        flipChamfer={false}
        barPattern={upperBars}
        customBars={upperCustomBars}
        colorExt={cExt}
        colorInt={cInt}
        frosted={upperGlass === 'frosted'}
        doubleGlazing={doubleGlazing}
        spacerColor={spacerColor}
      />

      <Sash
        width={sashWidth}
        height={lowerSashHeight}
        depth={sashDepth}
        stileWidth={config.stileWidth}
        topRail={config.lowerMeetingRail}
        bottomRail={config.lowerBottomRail}
        zOffset={trackFrontZ}
        yOffset={yBottomClosed + mm(lowerOpeningLift)}
        color={cExt}
        profiledBottom={true}
        glassThickness={config.glassUnitThickness}
        flipChamfer={false}
        barPattern={lowerBars}
        customBars={lowerCustomBars}
        colorExt={cExt}
        colorInt={cInt}
        frosted={lowerGlass === 'frosted'}
        doubleGlazing={doubleGlazing}
        spacerColor={spacerColor}
      />

      {showGuides && (
        <group rotation={[0, Math.PI, 0]}>
          <DimensionGuide
            from={[-(w / 2 + mm(52)), jambOriginY + h / 2 + mm(52) + mm(80), 0]}
            to={[  w / 2 + mm(52),  jambOriginY + h / 2 + mm(52) + mm(80), 0]}
            label={`${Math.round(width + 104)} mm`}
            offset={[0, 0.07, 0]}
          />
          <DimensionGuide
            from={[w / 2 + mm(52) + mm(180), -h / 2, 0]}
            to={[  w / 2 + mm(52) + mm(180), jambOriginY + h / 2 + mm(52), 0]}
            label={`${Math.round(height + 87)} mm`}
            offset={[0.09, 0, 0]}
          />
          <DimensionGuide
            from={[-w / 2 - 0.22, 0, -bd / 2]}
            to={[-w / 2 - 0.22, 0, bd / 2]}
            label={`${Math.round(boxDepth)} mm`}
            offset={[-0.1, 0, 0]}
          />
        </group>
      )}

      {/* Fitch Fasteners — na meeting railach, od wewnątrz */}
      {(() => {
        const twoFasteneres = width > 1200 || upperBars !== 'none';
        const xPositions = twoFasteneres
          ? [-mm(sashWidth / 2 - 250), mm(sashWidth / 2 - 250)]
          : [0];

        // Body: na dolnym railu górnej sashki — interior face (od środka pokoju)
        const upperSashBottom = (yTopClosed - mm(upperOpeningDrop)) - mm(upperSashHeight) / 2;
        const bodyZ = trackRearZ - mm(sashDepth / 2); // interior face górnej sashki

        // Keep: na górnym railu dolnej sashki — interior face
        const lowerSashTop = (yBottomClosed + mm(lowerOpeningLift)) + mm(lowerSashHeight) / 2;
        const keepY = lowerSashTop; // na górnej powierzchni meeting railu dolnej sashki
        const bodyY = upperSashBottom + mm(43); // górna powierzchnia meeting railu górnej sashki
        const keepZ = trackFrontZ - mm(sashDepth / 2) + mm(85); // interior face dolnej sashki +85mm

        return xPositions.map((x, i) => (
          <group key={i}>
            <group position={[x, bodyY, bodyZ]} rotation={[Math.PI / 2, Math.PI, Math.PI]} scale={0.001}>
              <FitchFastenerBody mat={ironmongeryMats} />
            </group>
            <group position={[x, keepY, keepZ]} rotation={[Math.PI / 2, Math.PI, Math.PI]} scale={0.001}>
              <FitchFastenerKeep mat={ironmongeryMats} />
            </group>
          </group>
        ));
      })()}

      {/* Sash Horns — dolne rogi górnej sashki, exterior face */}
      {showHorns && (() => {
        const upperSashBottom = (yTopClosed - mm(upperOpeningDrop)) - mm(upperSashHeight) / 2;
        const hornY = upperSashBottom - mm(80);
        const hornZLeft  = trackRearZ + mm(sashDepth / 2) - mm(57);
        const hornZRight = trackRearZ + mm(sashDepth / 2);
        const leftX  = -mm(sashWidth / 2);
        const rightX =  mm(sashWidth / 2);
        const hornMat = new THREE.MeshStandardMaterial({ color: cExt, roughness: 0.46, metalness: 0.02 });
        return [
          <group key={`horn-left-${hornType}`}  position={[leftX,  hornY, hornZLeft]}  rotation={[0, 0, 0]}       scale={0.001}><HornMesh material={hornMat} depth={sashDepth} type={hornType} /></group>,
          <group key={`horn-right-${hornType}`} position={[rightX, hornY, hornZRight]} rotation={[0, Math.PI, 0]} scale={0.001}><HornMesh material={hornMat} depth={sashDepth} type={hornType} /></group>,
        ];
      })()}

      {/* Sash Stoppers — cylindry na stilach górnej sashki, 100mm powyżej meeting railu */}
      {(() => {
        const upperSashBottom = (yTopClosed - mm(upperOpeningDrop)) - mm(upperSashHeight) / 2;
        const stopperY = upperSashBottom + mm(43) + mm(100);
        const stopperZ = trackRearZ - mm(sashDepth / 2);
        const leftX  = -mm(sashWidth / 2) + mm(config.stileWidth / 2);
        const rightX =  mm(sashWidth / 2) - mm(config.stileWidth / 2);
        const stopperMaterial = ironmongeryMats.main;
        return [leftX, rightX].map((x, i) => (
          <mesh key={i} position={[x, stopperY, stopperZ]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[mm(8), mm(8), mm(40), 32]} />
            <primitive object={stopperMaterial} attach="material" />
          </mesh>
        ));
      })()}
      {(() => {
        const lowerSashBottom = (yBottomClosed + mm(lowerOpeningLift)) - mm(lowerSashHeight) / 2;
        const liftY = lowerSashBottom + mm(45); // centrum bottom rail (90mm/2)
        const liftZ = trackFrontZ - mm(sashDepth / 2) - mm(1); // interior face
        const xLeft  = -mm(sashWidth / 2 - 200);
        const xRight =  mm(sashWidth / 2 - 200);
        return [xLeft, xRight].map((x, i) => (
          <group key={i} position={[x, liftY, liftZ]} rotation={[0, Math.PI, 0]} scale={0.022}>
            <FingerLift mat={ironmongeryMats} />
          </group>
        ));
      })()}

      {/* Handle — od spodu meeting railu górnej sashki, exterior face */}
      {(() => {
        const upperSashBottom = (yTopClosed - mm(upperOpeningDrop)) - mm(upperSashHeight) / 2;
        const handleY = upperSashBottom; // dolna powierzchnia meeting railu
        const handleZ = trackRearZ + mm(sashDepth / 2) - mm(28); // exterior face górnej sashki -28mm
        return (
          <group position={[0, handleY, handleZ]} rotation={[Math.PI / 2, 0, 0]}>
            <HandleMesh mat={ironmongeryMats} />
          </group>
        );
      })()}

    </group>
  );
}


function FitchFastenerBody({ mat }) {
  const [isLocked, setIsLocked] = useState(true);
  const leverGroupRef = useRef();
  const brassMaterial = mat?.main || useMemo(() => new THREE.MeshStandardMaterial({ color: '#d4af37', metalness: 0.92, roughness: 0.18 }), []);
  const brassDarkMaterial = mat?.dark || useMemo(() => new THREE.MeshStandardMaterial({ color: '#b38728', metalness: 0.92, roughness: 0.26 }), []);
  const steelShadowMaterial = mat?.screw || useMemo(() => new THREE.MeshStandardMaterial({ color: '#7a5a16', metalness: 0.7, roughness: 0.38 }), []);
  const mainBaseShape = useMemo(() => {
    const s = new THREE.Shape();
    const halfW = 37.5, bottomY = 0, shoulderY = 18, neckY = 28, topY = 36;
    s.moveTo(-halfW + 5, bottomY); s.lineTo(halfW - 5, bottomY);
    s.quadraticCurveTo(halfW, bottomY, halfW, 5);
    s.lineTo(halfW, shoulderY - 2);
    s.bezierCurveTo(halfW, shoulderY + 3, 18, neckY - 2, 12, neckY);
    s.bezierCurveTo(10, 33, 7, topY, 0, topY);
    s.bezierCurveTo(-7, topY, -10, 33, -12, neckY);
    s.bezierCurveTo(-18, neckY - 2, -halfW, shoulderY + 3, -halfW, shoulderY - 2);
    s.lineTo(-halfW, 5); s.quadraticCurveTo(-halfW, bottomY, -halfW + 5, bottomY);
    s.closePath();
    const hole1 = new THREE.Path(); hole1.absarc(-29, 8.5, 2.2, 0, Math.PI*2, true);
    const hole2 = new THREE.Path(); hole2.absarc( 29, 8.5, 2.2, 0, Math.PI*2, true);
    s.holes.push(hole1, hole2);
    return s;
  }, []);
  const mainBaseConfig = useMemo(() => ({ depth: 3.2, bevelEnabled: true, bevelThickness: 0.8, bevelSize: 0.8, bevelSegments: 4, curveSegments: 40, steps: 1 }), []);
  const leverShape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-3.2, -2.4); s.lineTo(11.5, -2.6);
    s.bezierCurveTo(15.5, -2.6, 18.5, -1.9, 21.5, -0.7);
    s.quadraticCurveTo(24.2, 0, 21.5, 0.7);
    s.bezierCurveTo(18.5, 1.9, 15.5, 2.6, 11.5, 2.6);
    s.lineTo(-3.2, 2.4); s.quadraticCurveTo(-5.3, 2.1, -6.1, 0); s.quadraticCurveTo(-5.3, -2.1, -3.2, -2.4);
    s.closePath(); return s;
  }, []);
  const leverConfig = useMemo(() => ({ depth: 2.6, bevelEnabled: true, bevelThickness: 0.45, bevelSize: 0.45, bevelSegments: 3, curveSegments: 28, steps: 1 }), []);
  const knobGeometry = useMemo(() => new THREE.SphereGeometry(3.6, 24, 24), []);
  const pivotGeometry = useMemo(() => { const g = new THREE.CylinderGeometry(5.4, 5.4, 3.6, 32); g.rotateX(Math.PI/2); return g; }, []);
  const collarGeometry = useMemo(() => { const g = new THREE.CylinderGeometry(3.8, 3.8, 0.8, 28); g.rotateX(Math.PI/2); return g; }, []);
  const screwHeadGeometry = useMemo(() => { const g = new THREE.CylinderGeometry(2.9, 2.9, 1.1, 28); g.rotateX(Math.PI/2); return g; }, []);
  const screwSlotGeometry = useMemo(() => new THREE.BoxGeometry(3.2, 0.45, 0.35), []);
  useFrame((_, delta) => {
    if (!leverGroupRef.current) return;
    const target = isLocked ? -0.58 : 0.18;
    leverGroupRef.current.rotation.z = THREE.MathUtils.damp(leverGroupRef.current.rotation.z, target, 8, delta);
  });
  return (
    <group>
      <mesh position={[0, 8, 0]} castShadow receiveShadow material={brassMaterial}>
        <extrudeGeometry args={[mainBaseShape, mainBaseConfig]} />
      </mesh>
      <mesh position={[0, 34, 2.2]} castShadow receiveShadow geometry={pivotGeometry} material={brassDarkMaterial} />
      <group ref={leverGroupRef} position={[0, 34, 4.2]} rotation={[0, 0, -0.58]} onClick={(e) => { e.stopPropagation(); setIsLocked(v => !v); }}>
        <mesh castShadow receiveShadow material={brassMaterial}><extrudeGeometry args={[leverShape, leverConfig]} /></mesh>
        <mesh position={[20, 0, 1]} castShadow receiveShadow geometry={knobGeometry} material={brassMaterial} />
      </group>
      <mesh position={[-29, 16.5, 3.25]} geometry={collarGeometry} castShadow receiveShadow material={brassDarkMaterial} />
      <mesh position={[ 29, 16.5, 3.25]} geometry={collarGeometry} castShadow receiveShadow material={brassDarkMaterial} />
      <mesh position={[-29, 16.5, 3.9]} geometry={screwHeadGeometry} castShadow receiveShadow material={brassMaterial} />
      <mesh position={[ 29, 16.5, 3.9]} geometry={screwHeadGeometry} castShadow receiveShadow material={brassMaterial} />
      <mesh position={[-29, 16.5, 4.45]} geometry={screwSlotGeometry} castShadow receiveShadow material={steelShadowMaterial} />
      <mesh position={[ 29, 16.5, 4.45]} geometry={screwSlotGeometry} castShadow receiveShadow material={steelShadowMaterial} />
    </group>
  );
}

function FitchFastenerKeep({ mat }) {
  const brassMaterial = mat?.main || useMemo(() => new THREE.MeshStandardMaterial({ color: '#d4af37', metalness: 0.92, roughness: 0.18 }), []);
  const brassDarkMaterial = mat?.dark || useMemo(() => new THREE.MeshStandardMaterial({ color: '#b38728', metalness: 0.92, roughness: 0.26 }), []);
  const steelShadowMaterial = mat?.screw || useMemo(() => new THREE.MeshStandardMaterial({ color: '#7a5a16', metalness: 0.7, roughness: 0.38 }), []);
  const keepBaseShape = useMemo(() => {
    const s = new THREE.Shape();
    const halfW = 37.5, h = 10;
    s.moveTo(-halfW + 4, 0); s.lineTo(halfW - 4, 0);
    s.quadraticCurveTo(halfW, 0, halfW, 4); s.lineTo(halfW, h - 4);
    s.quadraticCurveTo(halfW, h, halfW - 4, h); s.lineTo(-halfW + 4, h);
    s.quadraticCurveTo(-halfW, h, -halfW, h - 4); s.lineTo(-halfW, 4);
    s.quadraticCurveTo(-halfW, 0, -halfW + 4, 0); s.closePath();
    const hole1 = new THREE.Path(); hole1.absarc(-29, 5, 2, 0, Math.PI*2, true);
    const hole2 = new THREE.Path(); hole2.absarc( 29, 5, 2, 0, Math.PI*2, true);
    const slot = new THREE.Path();
    slot.moveTo(-9, 3); slot.lineTo(9, 3); slot.quadraticCurveTo(11, 3, 11, 5); slot.quadraticCurveTo(11, 7, 9, 7);
    slot.lineTo(-9, 7); slot.quadraticCurveTo(-11, 7, -11, 5); slot.quadraticCurveTo(-11, 3, -9, 3); slot.closePath();
    s.holes.push(hole1, hole2, slot); return s;
  }, []);
  const keepBaseConfig = useMemo(() => ({ depth: 2.8, bevelEnabled: true, bevelThickness: 0.55, bevelSize: 0.55, bevelSegments: 3, curveSegments: 32, steps: 1 }), []);
  const collarGeometry = useMemo(() => { const g = new THREE.CylinderGeometry(3.8, 3.8, 0.8, 28); g.rotateX(Math.PI/2); return g; }, []);
  const screwHeadGeometry = useMemo(() => { const g = new THREE.CylinderGeometry(2.9, 2.9, 1.1, 28); g.rotateX(Math.PI/2); return g; }, []);
  const screwSlotGeometry = useMemo(() => new THREE.BoxGeometry(3.2, 0.45, 0.35), []);
  return (
    <group>
      <mesh position={[0, 0, 0]} castShadow receiveShadow material={brassMaterial}>
        <extrudeGeometry args={[keepBaseShape, keepBaseConfig]} />
      </mesh>
      <mesh position={[-29, 5, 2.8]} geometry={collarGeometry} castShadow receiveShadow material={brassDarkMaterial} />
      <mesh position={[ 29, 5, 2.8]} geometry={collarGeometry} castShadow receiveShadow material={brassDarkMaterial} />
      <mesh position={[-29, 5, 3.35]} geometry={screwHeadGeometry} castShadow receiveShadow material={brassMaterial} />
      <mesh position={[ 29, 5, 3.35]} geometry={screwHeadGeometry} castShadow receiveShadow material={brassMaterial} />
      <mesh position={[-29, 5, 3.9]} geometry={screwSlotGeometry} castShadow receiveShadow material={steelShadowMaterial} />
      <mesh position={[ 29, 5, 3.9]} geometry={screwSlotGeometry} castShadow receiveShadow material={steelShadowMaterial} />
    </group>
  );
}

function FingerLift({ mat }) {
  const goldMaterial = mat?.main || useMemo(() => new THREE.MeshStandardMaterial({
    color: '#d4af37', metalness: 0.85, roughness: 0.22,
  }), []);

  const baseShape = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-2.2, 0);
    shape.lineTo(2.2, 0);
    shape.lineTo(2.2, 1.0);
    shape.bezierCurveTo(1.4, 1.35, 0.7, 1.45, 0, 1.45);
    shape.bezierCurveTo(-0.7, 1.45, -1.4, 1.35, -2.2, 1.0);
    shape.lineTo(-2.2, 0);
    shape.closePath();
    const hole1 = new THREE.Path(); hole1.absarc(-1.25, 0.42, 0.16, 0, Math.PI*2, true);
    const hole2 = new THREE.Path(); hole2.absarc( 1.25, 0.42, 0.16, 0, Math.PI*2, true);
    shape.holes.push(hole1, hole2);
    return shape;
  }, []);

  const baseConfig = useMemo(() => ({
    depth: 0.18, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03,
    bevelSegments: 4, curveSegments: 32, steps: 1,
  }), []);

  const hookShape = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-1.15, 0);
    shape.lineTo(1.15, 0);
    shape.lineTo(1.15, 0.2);
    shape.quadraticCurveTo(0, 0.32, -1.15, 0.2);
    shape.lineTo(-1.15, 0);
    shape.closePath();
    return shape;
  }, []);

  const curve = useMemo(() => new THREE.CubicBezierCurve3(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0.6, 0.25),
    new THREE.Vector3(0, 1.4, 0.9),
    new THREE.Vector3(0, 0.9, 1.7)
  ), []);

  const hookConfig = useMemo(() => ({
    steps: 40, extrudePath: curve, bevelEnabled: false, curveSegments: 32,
  }), [curve]);

  const collarGeometry = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.24, 0.24, 0.04, 32);
    g.rotateX(Math.PI / 2);
    return g;
  }, []);

  return (
    <group rotation={[0, 0, 0]}>
      <mesh castShadow receiveShadow>
        <extrudeGeometry args={[baseShape, baseConfig]} />
        <primitive object={goldMaterial} attach="material" />
      </mesh>
      <mesh position={[0, 0.98, 0.08]} castShadow receiveShadow>
        <extrudeGeometry args={[hookShape, hookConfig]} />
        <primitive object={goldMaterial} attach="material" />
      </mesh>
      <mesh position={[-1.25, 0.42, 0.11]} castShadow receiveShadow geometry={collarGeometry}>
        <meshStandardMaterial color="#c39a2e" metalness={0.9} roughness={0.25} />
      </mesh>
      <mesh position={[1.25, 0.42, 0.11]} castShadow receiveShadow geometry={collarGeometry}>
        <meshStandardMaterial color="#c39a2e" metalness={0.9} roughness={0.25} />
      </mesh>
    </group>
  );
}
function HandleMesh({ mat }) {
  const material = mat?.main || useMemo(() => new THREE.MeshStandardMaterial({
    color: '#b08d57', metalness: 0.85, roughness: 0.35,
  }), []);

  const tubeCurve = useMemo(() => {
    const arch = 20;
    const hw = 76;
    const pts = [];
    for (let i = 0; i <= 32; i++) {
      const x = -hw + (2 * hw * i / 32);
      const t = x / hw;
      const z = (1 - t * t) * arch;
      pts.push(new THREE.Vector3(x, 0, z));
    }
    return new THREE.CatmullRomCurve3(pts);
  }, []);

  const tubeGeom = useMemo(() =>
    new THREE.TubeGeometry(tubeCurve, 64, 3.5, 16, false),
  [tubeCurve]);

  const plateGeom = useMemo(() => {
    const g = new THREE.CylinderGeometry(7, 7, 4, 32);
    g.rotateX(Math.PI / 2);
    return g;
  }, []);

  const screwGeom = useMemo(() => {
    const g = new THREE.CylinderGeometry(2.2, 2.2, 5, 16);
    g.rotateX(Math.PI / 2);
    return g;
  }, []);

  return (
    <group scale={0.001}>
      <mesh geometry={tubeGeom} castShadow receiveShadow>
        <primitive object={material} attach="material" />
      </mesh>
      <mesh geometry={plateGeom} position={[-67, 0, 0]} castShadow receiveShadow>
        <primitive object={material} attach="material" />
      </mesh>
      <mesh geometry={plateGeom} position={[67, 0, 0]} castShadow receiveShadow>
        <primitive object={material} attach="material" />
      </mesh>
      <mesh geometry={screwGeom} position={[-67, 0, -3]} castShadow receiveShadow>
        <meshStandardMaterial color="#8a6a20" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh geometry={screwGeom} position={[67, 0, -3]} castShadow receiveShadow>
        <meshStandardMaterial color="#8a6a20" metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  );
}

function HornMesh({ material, depth = 57, type = 'A' }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();

    if (type === 'A') {
      shape.moveTo(0, 80);
      shape.lineTo(40, 80);
      shape.lineTo(40, 68);
      shape.lineTo(33, 62);
      shape.bezierCurveTo(44, 52, 43, 34, 28, 22);
      shape.bezierCurveTo(16, 12, 15, 6, 27, 0);
      shape.lineTo(22, -4);
      shape.lineTo(0, -4);
      shape.lineTo(0, 80);
    } else if (type === 'D') {
      shape.moveTo(0, 80);
      shape.lineTo(40, 80);
      shape.lineTo(40, 64);
      shape.lineTo(34, 64);
      shape.lineTo(34, 56);
      shape.bezierCurveTo(34, 42, 30, 16, 18, 0);
      shape.lineTo(0, 0);
      shape.lineTo(0, 80);
    }

    shape.closePath();

    const g = new THREE.ExtrudeGeometry(shape, {
      depth: depth,
      steps: 1,
      bevelEnabled: false,
      curveSegments: 48,
    });
    g.computeVertexNormals();
    return g;
  }, [type, depth]);

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <primitive object={material} attach="material" />
    </mesh>
  );
}