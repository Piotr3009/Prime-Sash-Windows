/**
 * SquareBayWindow.jsx — square (90°) bay of standard box sash units (owner, 02.10.2026).
 *
 *   · FRONT: a straight run of 1–4 units (MultiPartSashRun — cover strips on the joins,
 *     one continuous cill), facing the exterior (world −z, see MultiPartSashRun notes).
 *   · SIDES: one standard unit each, turned 90°, running from the front corner back to
 *     the wall (+z). Side width = the side window's frame width; the bay's projection
 *     from the wall = side width + box depth (164).
 *   · CORNERS: timber corner posts (120 wide, box-deep, flush with both frames — the front
 *     run sits BETWEEN them) or masonry piers (owner's width, default 150: they stand in
 *     FRONT of the windows, the front run passes behind them, L-shaped trims inside).
 *
 * Widths. `multiUnits` = the front units AS ENTERED (sum = the entered front width,
 * `extWidth` = its frame width). With posts the overall front = extWidth + 2 × post.
 * Geometry constants come from ParametricSashWindow / MultiPartSashRun (not re-derived).
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Line, Text } from '@react-three/drei';
import ParametricSashWindow, { TraditionalSill } from '../ParametricSashWindow';
import MultiPartSashRun, { MULTI_GEO } from './MultiPartSashRun';

const mm = (v) => v / 1000;

export const BAY_GEO = Object.freeze({
  boxDepth: 164,         // box frame depth: exterior face at −82 (world), interior at +82
  postW: 120,            // timber corner post width (plan); depth = boxDepth (flush)
  pierProjection: 110,   // masonry pier stands this far in front of the window face
  trimW: 40, trimT: 17,  // L-shaped trim inside, at the piers
  headExtra: MULTI_GEO.headExtra,
  sillVisibleHeight: MULTI_GEO.sillVisibleHeight,
});

function DimensionGuide({ from, to, label, offset = [0, 0, 0] }) {
  const mid = [(from[0] + to[0]) / 2 + offset[0], (from[1] + to[1]) / 2 + offset[1], (from[2] + to[2]) / 2 + offset[2]];
  const points = [from, to].map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  return (
    <group name="dim-guide">
      <Line points={points} color="#22324a" lineWidth={1.25} transparent opacity={0.9} />
      <Text position={mid} fontSize={0.06} color="#22324a" anchorX="center" anchorY="middle" outlineColor="#f5f2ec" outlineWidth={0.008}>
        {label}
      </Text>
    </group>
  );
}

export default function SquareBayWindow(props) {
  const {
    extWidth = 3000,             // frame width of the FRONT run (entered front width, + 150 for brick-to-brick)
    extHeight = 1500,
    multiUnits = null,
    multiCovers = 'both',
    multiSillExt = 0,
    baySideWidth = 700,          // frame width of each side window
    bayCorners = 'posts',        // 'posts' | 'piers'
    bayPierWidth = 150,
    bayLTrims = true,
    woodColor = '#F6F6F6',
    woodColorExt = null,
    woodColorInt = null,
    showGuides = true,
  } = props;

  const G = BAY_GEO;
  const piers = bayCorners === 'piers';
  const cornerW = piers ? Math.max(100, Number(bayPierWidth) || 150) : G.postW;
  const S = Math.max(200, Number(baySideWidth) || 700);
  const unitHeight = extHeight - G.headExtra;
  const h = mm(unitHeight);
  const half = mm(G.boxDepth / 2);

  // Front run: between the posts (posts), or the full entered width (piers: the run passes behind them)
  const frontRun = extWidth;
  const frontOverall = piers ? extWidth : extWidth + 2 * cornerW;
  const xCorner = mm(frontOverall / 2);          // outer corner of the bay (|x|)

  // Side windows: turned 90°, exterior face flush with the outer corner, running from the
  // back face of the corner member (z = +82) to the wall (z = +82 + S)
  const sideCentreX = xCorner - half;
  const sideCentreZ = half + mm(S) / 2;
  const wallZ = half + mm(S);

  const cExt = woodColorExt || woodColor;
  const cInt = woodColorInt || woodColor;
  const postMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: cExt, roughness: 0.48, metalness: 0.02, clearcoat: 0.2, clearcoatRoughness: 0.14 }), [cExt]);
  const trimMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: cInt, roughness: 0.5, metalness: 0.0, clearcoat: 0.12, clearcoatRoughness: 0.3 }), [cInt]);
  const brickMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#9c6b52', roughness: 0.95, metalness: 0.0 }), []);

  // Corner member: from the cill bottom to the head top, box-deep; piers also project in front
  const bottomY = -h / 2;
  const topY = h / 2 + mm(G.headExtra);
  const memberH = topY - bottomY;
  const memberY = (bottomY + topY) / 2;
  const memberDepth = piers ? mm(G.boxDepth + G.pierProjection) : mm(G.boxDepth);
  const memberZ = piers ? -mm(G.pierProjection) / 2 : 0;   // piers: extra depth toward the exterior (−z)

  // Side-window props: a plain single unit (no run keys)
  const sideProps = { ...props, multiUnits: null, multiCovers: null, multiSillExt: 0, width: S - 104, height: unitHeight, extWidth: S, showGuides: false };
  // Front-run props: its own cill reaches the outer corners (ext = post width) so the cill is continuous under the posts
  const frontProps = { ...props, extWidth: frontRun, multiUnits, multiCovers, multiSillExt: piers ? (Number(multiSillExt) || 0) : cornerW + (Number(multiSillExt) || 0), showGuides: false };
  const frontUnits = (Array.isArray(multiUnits) && multiUnits.length >= 1) ? multiUnits : [extWidth];

  const guideY = bottomY - 0.16;

  return (
    <group>
      {/* FRONT: a run of 2+ units, or one unit with the same continuous cill (through the posts) */}
      {frontUnits.length >= 2 ? (
        <MultiPartSashRun {...frontProps} />
      ) : (
        <>
          <ParametricSashWindow {...sideProps} width={frontRun - 104} height={unitHeight} extWidth={frontRun} hideSill />
          <group rotation={[0, Math.PI, 0]}>
            <TraditionalSill
              width={frontRun - 104 + 2 * (piers ? 0 : cornerW) + 2 * (Number(multiSillExt) || 0)}
              position={[0, -h / 2 + mm(G.sillVisibleHeight) / 2, 0]}
              material={postMat}
              materialInt={trimMat}
            />
          </group>
        </>
      )}

      {/* SIDES — left faces −x, right faces +x (the unit's exterior is world −z before the turn) */}
      <group position={[-sideCentreX, 0, sideCentreZ]} rotation={[0, Math.PI / 2, 0]}>
        <ParametricSashWindow {...sideProps} />
      </group>
      <group position={[sideCentreX, 0, sideCentreZ]} rotation={[0, -Math.PI / 2, 0]}>
        <ParametricSashWindow {...sideProps} />
      </group>

      {/* CORNER MEMBERS */}
      {[-1, 1].map((s) => (
        <mesh key={`corner-${s}`} position={[s * (xCorner - mm(cornerW) / 2), memberY, memberZ]} castShadow receiveShadow>
          <boxGeometry args={[mm(cornerW), memberH, memberDepth]} />
          <primitive object={piers ? brickMat : postMat} attach="material" />
        </mesh>
      ))}

      {/* L-shaped trims inside at the piers: two thin boards in the interior corner */}
      {piers && bayLTrims && [-1, 1].map((s) => (
        <group key={`trim-${s}`} position={[s * (xCorner - mm(G.boxDepth)), memberY, half]}>
          <mesh position={[s * -mm(G.trimT) / 2, 0, mm(G.trimW) / 2]} castShadow>
            <boxGeometry args={[mm(G.trimT), memberH, mm(G.trimW)]} />
            <primitive object={trimMat} attach="material" />
          </mesh>
          <mesh position={[s * -mm(G.trimW) / 2, 0, mm(G.trimT) / 2]} castShadow>
            <boxGeometry args={[mm(G.trimW), memberH, mm(G.trimT)]} />
            <primitive object={trimMat} attach="material" />
          </mesh>
        </group>
      ))}

      {showGuides && (
        <group>
          <DimensionGuide from={[-xCorner, guideY, -half]} to={[xCorner, guideY, -half]} label={`${Math.round(frontOverall)} mm front`} offset={[0, -0.07, 0]} />
          <DimensionGuide from={[xCorner + 0.16, bottomY, -half]} to={[xCorner + 0.16, topY, -half]} label={`${Math.round(extHeight)} mm`} offset={[0.12, 0, 0]} />
          <DimensionGuide from={[xCorner + 0.16, guideY, half]} to={[xCorner + 0.16, guideY, wallZ]} label={`${Math.round(S)} side`} offset={[0.14, -0.07, 0]} />
          {frontUnits.length >= 2 && (() => {
            const sum = frontUnits.reduce((a, b) => a + (Number(b) || 0), 0);
            const scale = sum > 0 ? frontRun / sum : 1;
            let acc = -mm(frontRun) / 2;
            return frontUnits.map((u, i) => {
              const w = mm((Number(u) || 0) * scale);
              const from = [acc, topY + 0.12, -half];
              acc += w;
              return <DimensionGuide key={`fu-${i}`} from={from} to={[acc, topY + 0.12, -half]} label={`${Math.round(u)}`} offset={[0, 0.06, 0]} />;
            });
          })()}
        </group>
      )}
    </group>
  );
}
