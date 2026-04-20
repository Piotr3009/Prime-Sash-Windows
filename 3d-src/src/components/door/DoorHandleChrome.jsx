import * as THREE from "three";
import React, { useMemo } from "react";
import { ExtrudeGeometry } from "three";

// ===== Helpers =====
function roundedRectShape(width, height, radius) {
  const w = width / 2;
  const h = height / 2;
  const r = Math.min(radius, width / 2, height / 2);

  const s = new THREE.Shape();
  s.moveTo(-w + r, -h);
  s.lineTo(w - r, -h);
  s.quadraticCurveTo(w, -h, w, -h + r);
  s.lineTo(w, h - r);
  s.quadraticCurveTo(w, h, w - r, h);
  s.lineTo(-w + r, h);
  s.quadraticCurveTo(-w, h, -w, h - r);
  s.lineTo(-w, -h + r);
  s.quadraticCurveTo(-w, -h, -w + r, -h);
  return s;
}

function makePlateGeometry() {
  // dimensions based on drawing, converted to meters
  const plateWidth = 0.03;
  const plateHeight = 0.22;
  const plateDepth = 0.01;
  const plateRadius = 0.015;

  const plateShape = roundedRectShape(plateWidth, plateHeight, plateRadius);
  const plateGeo = new ExtrudeGeometry(plateShape, {
    depth: plateDepth,
    bevelEnabled: false,
    curveSegments: 48,
  });
  plateGeo.center();
  plateGeo.computeVertexNormals();
  return plateGeo;
}

function makeLeverGeometry() {
  // Approximate elegant curved handle
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.0, 0.0, 0.0),
    new THREE.Vector3(0.018, 0.002, 0.006),
    new THREE.Vector3(0.05, 0.003, 0.008),
    new THREE.Vector3(0.09, 0.002, 0.006),
    new THREE.Vector3(0.118, 0.0, 0.001),
    new THREE.Vector3(0.124, -0.0005, 0.0),
  ]);

  const handleRadius = 0.006;
  const tubeGeo = new THREE.TubeGeometry(curve, 80, handleRadius, 20, false);

  // flatten slightly to feel more like a handle
  const pos = tubeGeo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    v.y *= 0.72;
    pos.setXYZ(i, v.x, v.y, v.z);
  }

  tubeGeo.computeVertexNormals();
  return tubeGeo;
}

function makeNeckGeometry() {
  // transition from plate to handle
  const neckGeo = new THREE.SphereGeometry(0.014, 36, 24);
  neckGeo.scale(1, 0.85, 0.75);
  return neckGeo;
}

function makeRoseBaseGeometry() {
  const geo = new THREE.CylinderGeometry(0.012, 0.012, 0.006, 36);
  geo.rotateZ(Math.PI / 2);
  return geo;
}

// ===== Main component =====
// Chrome door handle with backplate + curved lever.
// Details (screw heads, euro cylinder keyhole) rendered as dark visual markers
// on top of the plate (no CSG boolean subtraction — too costly & risky at runtime).
export default function DoorHandleChrome({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  side = "right", // "right" = lever points right, "left" = mirrored
}) {
  const metal = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#bfc3c9",
        metalness: 1,
        roughness: 0.18,
        clearcoat: 0.55,
        clearcoatRoughness: 0.12,
        envMapIntensity: 1.2,
      }),
    []
  );

  const screwMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#5c6168",
        metalness: 1,
        roughness: 0.4,
      }),
    []
  );

  const keyholeMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#1a1a1a",
        metalness: 0.8,
        roughness: 0.5,
      }),
    []
  );

  const plateGeometry = useMemo(() => makePlateGeometry(), []);
  const leverGeometry = useMemo(() => makeLeverGeometry(), []);
  const neckGeometry = useMemo(() => makeNeckGeometry(), []);
  const roseBaseGeometry = useMemo(() => makeRoseBaseGeometry(), []);

  const mirror = side === "left" ? -1 : 1;

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <group scale={[mirror, 1, 1]}>
        {/* Backplate */}
        <mesh geometry={plateGeometry} material={metal} castShadow receiveShadow />

        {/* Screw heads — dark discs on front of plate (visual only, no CSG hole) */}
        <mesh position={[0, 0.078, 0.0051]} material={screwMat}>
          <cylinderGeometry args={[0.0032, 0.0032, 0.0008, 24]} />
          <meshStandardMaterial attach="material" color="#5c6168" metalness={1} roughness={0.4} />
        </mesh>
        <mesh position={[0, -0.078, 0.0051]} rotation={[Math.PI / 2, 0, 0]} material={screwMat}>
          <cylinderGeometry args={[0.0032, 0.0032, 0.0008, 24]} />
        </mesh>
        <mesh position={[0, 0.078, 0.0051]} rotation={[Math.PI / 2, 0, 0]} material={screwMat}>
          <cylinderGeometry args={[0.0032, 0.0032, 0.0008, 24]} />
        </mesh>

        {/* Euro cylinder keyhole (dark oval visual mark on plate) */}
        <mesh position={[0, -0.03, 0.0051]} material={keyholeMat}>
          <boxGeometry args={[0.008, 0.025, 0.0008]} />
        </mesh>
        <mesh position={[0, -0.042, 0.0051]} material={keyholeMat}>
          <cylinderGeometry args={[0.007, 0.007, 0.0008, 24]} rotation={[Math.PI / 2, 0, 0]} />
        </mesh>

        {/* Handle rose (cylinder base on plate) */}
        <mesh
          geometry={roseBaseGeometry}
          material={metal}
          position={[0.0, 0.06, 0.008]}
          castShadow
          receiveShadow
        />

        {/* Neck (transition blob) */}
        <mesh
          geometry={neckGeometry}
          material={metal}
          position={[0.006, 0.06, 0.008]}
          castShadow
          receiveShadow
        />

        {/* Lever (curved handle tube) */}
        <mesh
          geometry={leverGeometry}
          material={metal}
          position={[0.01, 0.06, 0.008]}
          castShadow
          receiveShadow
        />

        {/* Small spindle cap detail */}
        <mesh position={[0.001, 0.06, 0.008]} material={metal} castShadow receiveShadow>
          <cylinderGeometry args={[0.004, 0.004, 0.012, 24]} />
        </mesh>
      </group>
    </group>
  );
}
