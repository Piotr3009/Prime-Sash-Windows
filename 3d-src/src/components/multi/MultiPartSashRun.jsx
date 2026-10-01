/**
 * MultiPartSashRun.jsx — several box sash units in ONE straight run (owner, 01.10.2026).
 *
 * The run is an ASSEMBLY of standard units, not a new window:
 *   · every unit is a full <ParametricSashWindow> (same options as a single sash),
 *   · the boxes touch (100 mm outer lining + 100 mm outer lining at every joint),
 *   · a cover strip 150 × 17 mm sits over every joint, inside and/or outside, so the
 *     joint is not seen (owner's spec: "box 100 + 100 + nakładka 150 × 17"),
 *   · ONE continuous cill runs under all units (units draw none), with an optional
 *     extension at each end.
 *
 * Widths. `multiUnits` holds the unit widths AS ENTERED by the customer (they sum to the
 * entered overall width). `extWidth` is the FRAME width of the run (brick-to-brick adds
 * 150 to the entered width, exactly as for a single sash), so the difference between
 * extWidth and the sum of the units is split equally between them first. A single sash's
 * ext width includes the two 52 mm cill horns (App: width = extWidth − 104), so each
 * unit's BOX is its frame share minus 104/N — the horns belong to the one continuous
 * cill, not to the units. Sum of boxes = extWidth − 104, the same as a single window.
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
  coverW: 150,           // cover strip width (owner, 01.10.2026)
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

/** Frame unit widths → box widths for the 3D (share minus the run's horn allowance). */
export function unitBoxWidths(units) {
  const n = units.length;
  const hornShare = (2 * MULTI_GEO.sillHorn) / n;
  return units.map((v) => Math.max(200, v - hornShare));
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
  const sumBox = boxes.reduce((a, b) => a + b, 0);

  // Unit centres and joint positions (mm, run centred on x = 0)
  const centres = [];
  const joints = [];
  let acc = -sumBox / 2;
  boxes.forEach((b, i) => {
    centres.push(acc + b / 2);
    acc += b;
    if (i < boxes.length - 1) joints.push(acc);
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
  const coverZOut = mm(G.boxDepth / 2 + G.coverT / 2);
  const coverZIn = -coverZOut;
  const showOut = multiCovers === 'both' || multiCovers === 'outside';
  const showIn = multiCovers === 'both' || multiCovers === 'inside';

  // Continuous cill: TraditionalSill adds 52 at each end itself
  const sillWidth = sumBox + 2 * (Number(multiSillExt) || 0);
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

      {/* ONE continuous cill under the whole run */}
      <TraditionalSill
        width={sillWidth}
        position={[0, -h / 2 + mm(G.sillVisibleHeight) / 2, 0]}
        material={sillMaterial}
        materialInt={sillIntMaterial}
      />

      {/* Cover strips over every joint — 150 wide, 17 thick */}
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
              from={[mm(centres[i] - boxes[i] / 2), headTopY + 0.12, 0]}
              to={[mm(centres[i] + boxes[i] / 2), headTopY + 0.12, 0]}
              label={`${Math.round(v)}`} offset={[0, 0.06, 0]} />
          ))}
        </group>
      )}
    </group>
  );
}
