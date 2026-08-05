// ═══════════════════════════════════════════════════════════════════
// DoorFurniture — front-door ironmongery mounted on the leaf face:
// letterplate, knocker, centre pull knob and house numerals.
// All pieces share one finish (taken from the ironmongery selection),
// exactly as they would be specified on a real entrance door.
// ═══════════════════════════════════════════════════════════════════
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Text } from '@react-three/drei';

const mm = (v) => v / 1000;

const FINISHES = {
  brass:         { color: '#d4af37', metalness: 0.85, roughness: 0.28 },
  chrome:        { color: '#e8eaec', metalness: 0.95, roughness: 0.12 },
  stainless:     { color: '#c8c8c8', metalness: 0.85, roughness: 0.30 },
  antique_brass: { color: '#9c7722', metalness: 0.75, roughness: 0.45 },
  black:         { color: '#1a1a1a', metalness: 0.55, roughness: 0.50 },
  white:         { color: '#f0f0f0', metalness: 0.30, roughness: 0.55 },
};

export default function DoorFurniture({
  leafW, leafH,            // leaf size in mm
  faceZ,                   // Z of the exterior leaf face (metres)
  finish = 'brass',
  letterplate = false,
  knocker = false,
  pullKnob = false,
  houseNumber = false,
  numberText = '29',
  midRailY = 0,            // Y of the mid rail centre (metres, leaf-local)
  topRailY = 0,            // Y of the top rail centre (metres, leaf-local)
}) {
  const f = FINISHES[finish] || FINISHES.brass;
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: f.color, metalness: f.metalness, roughness: f.roughness }),
    [f.color, f.metalness, f.roughness]
  );

  const W = mm(leafW);
  const z = faceZ;

  return (
    <group>
      {/* ─── Letterplate: horizontal plate with a recessed slot, on the mid rail ─── */}
      {letterplate && (
        <group position={[0, midRailY, z]}>
          <mesh castShadow>
            <boxGeometry args={[mm(305), mm(78), mm(9)]} />
            <primitive object={mat} attach="material" />
          </mesh>
          {/* slot shadow */}
          <mesh position={[0, 0, mm(5)]}>
            <boxGeometry args={[mm(255), mm(30), mm(2)]} />
            <meshStandardMaterial color="#0d0d0d" roughness={0.95} />
          </mesh>
        </group>
      )}

      {/* ─── Knocker: back plate + ring, above the letterplate ─── */}
      {knocker && (
        <group position={[0, midRailY + mm(300), z]}>
          <mesh castShadow>
            <cylinderGeometry args={[mm(38), mm(38), mm(10), 28]} />
            <primitive object={mat} attach="material" />
          </mesh>
          <mesh position={[0, mm(-42), mm(10)]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <torusGeometry args={[mm(46), mm(7), 14, 36]} />
            <primitive object={mat} attach="material" />
          </mesh>
        </group>
      )}

      {/* ─── Centre pull knob: domed knob on the centre line ─── */}
      {pullKnob && (
        <group position={[0, midRailY - mm(230), z]}>
          <mesh castShadow>
            <cylinderGeometry args={[mm(30), mm(34), mm(12), 28]} />
            <primitive object={mat} attach="material" />
          </mesh>
          <mesh position={[0, 0, mm(20)]} castShadow>
            <sphereGeometry args={[mm(32), 24, 18]} />
            <primitive object={mat} attach="material" />
          </mesh>
        </group>
      )}

      {/* ─── House numerals on the top rail ─── */}
      {houseNumber && String(numberText || '').trim() !== '' && (
        <Text
          position={[0, topRailY, z + mm(4)]}
          fontSize={mm(85)}
          letterSpacing={0.12}
          color={f.color}
          anchorX="center"
          anchorY="middle"
          outlineWidth={mm(1.5)}
          outlineColor="#00000022"
        >
          {String(numberText).trim()}
        </Text>
      )}
    </group>
  );
}
