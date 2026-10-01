/**
 * MultiPartSashRun.jsx — several box sash units in ONE straight run (owner, 01.10.2026).
 *
 * The run is an ASSEMBLY of standard units, not a new window:
 *   · every unit is a full <ParametricSashWindow> (same options as a single sash),
 *   · the boxes touch (100 mm outer lining + 100 mm outer lining at every joint),
 *   · a cover strip 100 × 17 mm sits over every joint, inside and/or outside, so the
 *     joint is not seen (owner's spec: "box 100 + 100 + nakładka"; width 100, 01.10.2026),
 *   · ONE continuous cill runs under all units (units draw none), with an optional
 *     extension at each end.
 *
 * Widths. `multiUnits` holds the unit widths AS ENTERED by the customer (they sum to the
 * entered overall width). `extWidth` is the FRAME width of the run (brick-to-brick adds
 * 150 to the entered width, exactly as for a single sash), so the difference between
 * extWidth and the sum of the units is split equally between them first ("slots").
 *
 * A single sash's `width` prop is extWidth − 104 (App.jsx): its outer linings
 * (ExternalBoxElement, 100 wide) sit 52 mm OUTSIDE ±width/2, so the unit's real outer
 * extent is the full extWidth. In a run every unit therefore gets width = slot − 104 and
 * is centred in its slot: the linings of neighbours then TOUCH (100 + 100) instead of
 * overlapping (owner 01.10.2026: "2 × 100 nachodzą na siebie" — fixed). The run's outer
 * extent is Σslots = extWidth, the same as a single window of that width.
 *
 * Geometry taken from ParametricSashWindow (do not re-derive): box depth 164 (exterior
 * face at +82), outer lining face width 100 (ExternalBoxElement), cill visible height
 * 58.414, head above h: 87 (height = extHeight − 87), cill horn 52 each end.
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Line, Text } from '@react-three/drei';
import ParametricSashWindow, { TraditionalSill } from '../ParametricSashWindow';

const mm = (v) => v / 1000;

export const MULTI_GEO = Object.freeze({
  sillHorn: 52,          // cill extends 52 beyond the box at each END of the run
  headExtra: 87,         // ext height − 87 = unit height (App.jsx)
  sillVisibleHeight: 58.414,
  boxDepth: 164,         // exterior face at +82, interior face at −82
  coverW: 100,           // cover strip width (owner, 01.10.2026: 100, was 150)
  coverT: 17,            // cover strip thickness
  liningW: 100,          // outer lining face width — "box 100"
});

/** Entered unit widths → FRAME unit widths (the frame allowance, e.g. +150 for
 *  brick-to-brick, is shared equally; 0 for frame dimensions). */
export function unitFrameWidths(units, extWidth) {
  const n = units.length;
  const sum = units.reduce((a, b) => a + b, 0);
  const extra = (n > 0 && sum > 0 && Number.isFinite(extWidth)) ? (extWidth - sum) / n : 0;
  return units.map((v) => v + extra);
}

/** Slot (frame) widths → the `width` prop of each unit (its outer linings add 52 each side). */
export function unitBoxWidths(units) {
  return units.map((v) => Math.max(200, v - 2 * MULTI_GEO.sillHorn));
}

function DimensionGuide({ from, to, label, offset = [0, 0, 0] }) {
  const mid = [
    (from[0] + to[0]) / 2 + offset[0],
    (from[1] + to[1]) / 2 + offset[1],
    (from[2] + to[2]) / 2 + offset[2],
  ];
  const points = [from, to].map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  return (
    <group name="dim-guide">
      <Line points={points} color="#22324a" lineWidth={1.25} transparent opacity={0.9} />
      <Text position={mid} fontSize={0.06} color="#22324a" anchorX="center" anchorY="middle"
        outlineColor="#f5f2ec" outlineWidth={0.008}>
        {label}
      </Text>
    </group>
  );
}

export default function MultiPartSashRun(props) {
  const {
    extWidth = 3000,
    extHeight = 1500,
    multiUnits = null,
    multiCovers = 'both',        // 'inside' | 'outside' | 'both' | 'none'
    multiSillExt = 0,            // mm, each end
    woodColor = '#F6F6F6',
    woodColorExt = null,
    woodColorInt = null,
    showGuides = true,
  } = props;

  const G = MULTI_GEO;
  const units = useMemo(() => {
    const entered = (Array.isArray(multiUnits) && multiUnits.length >= 2)
      ? multiUnits.map((v) => Number(v) || 0)
      : [extWidth / 2, extWidth / 2];
    return unitFrameWidths(entered, extWidth);     // frame shares, sum = extWidth
  }, [multiUnits, extWidth]);
  const boxes = useMemo(() => unitBoxWidths(units), [units]);

  const unitHeight = extHeight - G.headExtra;
  const h = mm(unitHeight);
  const sumSlots = units.reduce((a, b) => a + b, 0);   // = extWidth (frame width of the run)

  // Unit centres and joint positions from the SLOTS (mm, run centred on x = 0):
  // neighbours' outer linings meet exactly at every joint.
  const centres = [];
  const joints = [];
  let acc = -sumSlots / 2;
  units.forEach((u, i) => {
    centres.push(acc + u / 2);
    acc += u;
    if (i < units.length - 1) joints.push(acc);
  });

  const cExt = woodColorExt || woodColor;
  const cInt = woodColorInt || woodColor;
  const sillMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({ color: cExt, roughness: 0.42, metalness: 0.02, clearcoat: 0.22, clearcoatRoughness: 0.12, side: THREE.DoubleSide }), [cExt]);
  const sillIntMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({ color: cInt, roughness: 0.42, metalness: 0.02, clearcoat: 0.22, clearcoatRoughness: 0.12, side: THREE.DoubleSide }), [cInt]);
  const coverExtMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({ color: cExt, roughness: 0.5, metalness: 0.0, clearcoat: 0.12, clearcoatRoughness: 0.3 }), [cExt]);
  const coverIntMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({ color: cInt, roughness: 0.5, metalness: 0.0, clearcoat: 0.12, clearcoatRoughness: 0.3 }), [cInt]);

  // Cover strip: from the cill top to the top of the head, on the lining face
  const sillTopY = -h / 2 + mm(G.sillVisibleHeight);
  const headTopY = h / 2 + mm(G.headExtra);
  const coverH = headTopY - sillTopY;
  const coverY = (sillTopY + headTopY) / 2;
  // ParametricSashWindow rotates its whole content by 180° (root <group rotation-y={π}>), so in
  // WORLD space the exterior face is at −z (linings −82…−65) and the interior at +z. Everything
  // drawn here sits outside that rotation: the cill is wrapped in the same rotation (its profile
  // nose must face out), the covers use world signs directly (01.10.2026 fix: both were mirrored).
  const coverZOut = -mm(G.boxDepth / 2 + G.coverT / 2);   // exterior = −z in world space
  const coverZIn = -coverZOut;
  const showOut = multiCovers === 'both' || multiCovers === 'outside';
  const showIn = multiCovers === 'both' || multiCovers === 'inside';

  // Continuous cill: TraditionalSill adds 52 at each end itself → total = extWidth + 2 × ext
  const sillWidth = sumSlots - 2 * G.sillHorn + 2 * (Number(multiSillExt) || 0);
  const sillTotal = sillWidth + 2 * G.sillHorn;

  const guideY = -h / 2 - 0.16;
  const guideX = mm(sillTotal / 2) + 0.16;

  return (
    <group>
      {boxes.map((b, i) => (
        <group key={`unit-${i}`} position={[mm(centres[i]), 0, 0]}>
          <ParametricSashWindow {...props} width={b} height={unitHeight} showGuides={false} hideSill />
        </group>
      ))}

      {/* ONE continuous cill under the whole run — same 180° orientation as inside a unit */}
      <group rotation={[0, Math.PI, 0]}>
        <TraditionalSill
          width={sillWidth}
          position={[0, -h / 2 + mm(G.sillVisibleHeight) / 2, 0]}
          material={sillMaterial}
          materialInt={sillIntMaterial}
        />
      </group>

      {/* Cover strips over every joint — 100 wide, 17 thick */}
      {joints.map((jx, i) => (
        <group key={`joint-${i}`} position={[mm(jx), coverY, 0]}>
          {showOut && (
            <mesh position={[0, 0, coverZOut]} castShadow receiveShadow>
              <boxGeometry args={[mm(G.coverW), coverH, mm(G.coverT)]} />
              <primitive object={coverExtMaterial} attach="material" />
            </mesh>
          )}
          {showIn && (
            <mesh position={[0, 0, coverZIn]} castShadow receiveShadow>
              <boxGeometry args={[mm(G.coverW), coverH, mm(G.coverT)]} />
              <primitive object={coverIntMaterial} attach="material" />
            </mesh>
          )}
        </group>
      ))}

      {showGuides && (
        <group>
          <DimensionGuide from={[-mm(sillTotal / 2), guideY, 0]} to={[mm(sillTotal / 2), guideY, 0]} label={`${Math.round(sillTotal)} mm`} offset={[0, -0.07, 0]} />
          <DimensionGuide from={[guideX, -h / 2, 0]} to={[guideX, headTopY, 0]} label={`${Math.round(extHeight)} mm`} offset={[0.12, 0, 0]} />
          {units.map((v, i) => (
            <DimensionGuide key={`u-${i}`}
              from={[mm(centres[i] - v / 2), headTopY + 0.12, 0]}
              to={[mm(centres[i] + v / 2), headTopY + 0.12, 0]}
              label={`${Math.round(v)}`} offset={[0, 0.06, 0]} />
          ))}
        </group>
      )}
    </group>
  );
}
