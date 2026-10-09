/**
 * SquareBayWindow.jsx — square (90°) bay of standard box sash units (owner, 02.10.2026).
 * Revised 05.10.2026 (owner): timber corner posts only (masonry piers removed), post size set
 * by the owner (default 164 × 164 = the box depth), cover strips at the posts as on the joins,
 * front run of 1–6 units, dimensions on BOTH sides with labels that always face the camera.
 *
 *   · FRONT: a straight run of 1–6 units (MultiPartSashRun — cover strips on the joins,
 *     one continuous cill), facing the exterior (world −z, see MultiPartSashRun notes).
 *   · SIDES: one standard unit each, turned 90°, running from the back of the corner post to
 *     the wall (+z). Side width = the side window's frame width; the bay's projection from
 *     the wall = post depth + side width.
 *   · CORNER POSTS: timber, `bayPostWidth` (along the front) × `bayPostDepth` (front to back).
 *     Their OUTSIDE faces are always flush with the front and the side frames, so the cover
 *     strips lie flat; a post larger than the box depth takes the extra on the room side.
 *     164 × 164 is flush inside too: the two frames then meet in the inside corner.
 *   · COVER STRIPS AT THE POSTS (100 × 17, as on the joins, following `multiCovers`):
 *     outside — one over each post/window joint (front face and side face);
 *     inside — the same strip, but only the part that has a flat face under it: 50 mm on the
 *     window lining (it butts into the corner) plus up to 50 mm on the post where the post is
 *     flush with that frame and showing.
 *
 * Widths. `multiUnits` = the front units AS ENTERED (sum = the entered front width,
 * `extWidth` = its frame width). Overall front = extWidth + 2 × post width.
 * Geometry constants come from ParametricSashWindow / MultiPartSashRun (not re-derived).
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Billboard, Line, Text } from '@react-three/drei';
import ParametricSashWindow, { TraditionalSill } from '../ParametricSashWindow';
import MultiPartSashRun, { MULTI_GEO, unitFrameWidths } from './MultiPartSashRun';

const mm = (v) => v / 1000;

export const BAY_GEO = Object.freeze({
  boxDepth: 164,                 // box frame depth: exterior face at −82 (world), interior at +82
  postDefault: 164,              // corner post, default = the box depth (flush with both frames)
  postMin: 164,                  // smaller than the box depth: the two boxes would run into each other
  postMax: 400,
  coverW: MULTI_GEO.coverW,      // 100
  coverT: MULTI_GEO.coverT,      // 17
  headExtra: MULTI_GEO.headExtra,
  sillVisibleHeight: MULTI_GEO.sillVisibleHeight,
});

/** Post size as used everywhere (3D, price, drawing): whole mm, 164…400, default 164. */
export function bayPostSize(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n <= 0) return BAY_GEO.postDefault;
  return Math.min(BAY_GEO.postMax, Math.max(BAY_GEO.postMin, n));
}

// Dimension line with a label that always faces the camera (readable from inside AND outside)
function DimensionGuide({ from, to, label, offset = [0, 0, 0] }) {
  const mid = [(from[0] + to[0]) / 2 + offset[0], (from[1] + to[1]) / 2 + offset[1], (from[2] + to[2]) / 2 + offset[2]];
  const points = [from, to].map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  return (
    <group name="dim-guide">
      <Line points={points} color="#22324a" lineWidth={1.25} transparent opacity={0.9} />
      <Billboard position={mid}>
        <Text fontSize={0.06} color="#22324a" anchorX="center" anchorY="middle" outlineColor="#f5f2ec" outlineWidth={0.008}>
          {label}
        </Text>
      </Billboard>
    </group>
  );
}

export default function SquareBayWindow(props) {
  const {
    extWidth = 3000,             // frame width of the FRONT run (entered front width, + 150 for brick-to-brick)
    extHeight = 1500,
    multiUnits = null,
    multiCovers = 'both',        // 'both' | 'outside' | 'inside' — joins AND posts
    multiSillExt = 0,
    baySideWidth = 700,          // frame width of each side window
    bayPostWidth = BAY_GEO.postDefault,   // corner post: along the front
    bayPostDepth = BAY_GEO.postDefault,   // corner post: front to back
    woodColor = '#F6F6F6',
    woodColorExt = null,
    woodColorInt = null,
    showGuides = true,
  } = props;

  const G = BAY_GEO;
  const W = bayPostSize(bayPostWidth);
  const D = bayPostSize(bayPostDepth);
  const S = Math.max(200, Number(baySideWidth) || 700);
  const unitHeight = extHeight - G.headExtra;
  const h = mm(unitHeight);
  const half = mm(G.boxDepth / 2);

  // Front run sits BETWEEN the posts
  const frontRun = extWidth;
  const frontOverall = extWidth + 2 * W;
  const xCorner = mm(frontOverall / 2);          // outer corner of the bay (|x|)
  const xJoint = xCorner - mm(W);                // front run ↔ post (|x|)
  const postBackZ = -half + mm(D);               // back face of the post = post ↔ side window

  // Side windows: turned 90°, exterior face flush with the outer corner, from the back of the
  // post to the wall
  const sideCentreX = xCorner - half;
  const sideCentreZ = postBackZ + mm(S) / 2;
  const wallZ = postBackZ + mm(S);
  const insideX = xCorner - mm(G.boxDepth);      // interior face of a side window (|x|)

  const cExt = woodColorExt || woodColor;
  const cInt = woodColorInt || woodColor;
  const extMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: cExt, roughness: 0.48, metalness: 0.02, clearcoat: 0.2, clearcoatRoughness: 0.14 }), [cExt]);
  const intMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: cInt, roughness: 0.5, metalness: 0.0, clearcoat: 0.12, clearcoatRoughness: 0.3 }), [cInt]);
  // Post faces (box order +x, −x, +y, −y, +z, −z): outside faces in the exterior colour, the
  // faces a larger post shows to the room (toward the centre, toward the wall) in the interior one
  const postMatRight = useMemo(() => [extMat, intMat, extMat, extMat, intMat, extMat], [extMat, intMat]);
  const postMatLeft = useMemo(() => [intMat, extMat, extMat, extMat, intMat, extMat], [extMat, intMat]);

  // Corner post: from the cill bottom to the head top
  const bottomY = -h / 2;
  const topY = h / 2 + mm(G.headExtra);
  const memberH = topY - bottomY;
  const memberY = (bottomY + topY) / 2;

  // Cover strips at the posts: cill top → head top, like the strips on the joins
  const showOut = multiCovers === 'both' || multiCovers === 'outside';
  const showIn = multiCovers === 'both' || multiCovers === 'inside';
  const cw = mm(G.coverW);
  const ct = mm(G.coverT);
  const sillTopY = bottomY + mm(G.sillVisibleHeight);
  const coverH = topY - sillTopY;
  const coverY = (sillTopY + topY) / 2;
  // Inside: the half over the post exists only where the post is flush with that frame and showing
  const postHalfFront = (D === G.boxDepth) ? mm(Math.min(G.coverW / 2, Math.max(0, W - G.boxDepth))) : 0;
  const postHalfSide = (W === G.boxDepth) ? mm(Math.min(G.coverW / 2, Math.max(0, D - G.boxDepth))) : 0;
  const inFrontW = cw / 2 + postHalfFront;       // along x
  const inSideW = cw / 2 + postHalfSide;         // along z

  // Side-window props: a plain single unit (no run keys)
  const sideProps = { ...props, multiUnits: null, multiCovers: null, multiSillExt: 0, width: S - 104, height: unitHeight, extWidth: S, showGuides: false };
  // Front cill: one piece under the front run and on through under both posts. With no extension
  // it stops 1 mm inside the post's outer side face, so its end grain (exterior + interior colour)
  // is never seen on that face; with an extension it projects past the corner by that much.
  const sillExtMm = Number(multiSillExt) || 0;
  const sillThrough = sillExtMm > 0 ? W + sillExtMm : W - 1;
  const frontProps = { ...props, extWidth: frontRun, multiUnits, multiCovers, multiSillExt: sillThrough, showGuides: false };
  const frontUnits = (Array.isArray(multiUnits) && multiUnits.length >= 1) ? multiUnits.map((v) => Number(v) || 0) : [extWidth];
  // Frame widths of the front units — the same shares MultiPartSashRun builds the run from
  const frontFrames = frontUnits.length >= 2 ? unitFrameWidths(frontUnits, frontRun) : [frontRun];

  const guideY = bottomY - 0.16;
  const chainY = topY + 0.12;
  const sideGuideX = xCorner + 0.16;

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
              width={frontRun - 104 + 2 * sillThrough}
              position={[0, -h / 2 + mm(G.sillVisibleHeight) / 2, 0]}
              material={extMat}
              materialInt={intMat}
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

      {/* Extended cill: the horn past each corner is wholly outside, so the strip of the cill that
          is interior-coloured inside the room (the back 43 mm of its section) is cased in the
          exterior colour there — otherwise a two-colour bay shows a light block at the corner */}
      {sillExtMm > 0 && [-1, 1].map((s) => (
        <mesh key={`horn-${s}`} name="bay-cill-horn" position={[s * (xCorner + mm(sillExtMm) / 2), bottomY + mm(G.sillVisibleHeight) / 2, half - mm(43.006) / 2]} material={extMat}>
          <boxGeometry args={[mm(sillExtMm) + 0.0006, mm(G.sillVisibleHeight) + 0.0006, mm(43.006) + 0.0006]} />
        </mesh>
      ))}

      {/* CORNER POSTS + their cover strips */}
      {[-1, 1].map((s) => (
        <group key={`corner-${s}`}>
          <mesh name="bay-post" position={[s * (xCorner - mm(W) / 2), memberY, -half + mm(D) / 2]} material={s > 0 ? postMatRight : postMatLeft} castShadow receiveShadow>
            <boxGeometry args={[mm(W), memberH, mm(D)]} />
          </mesh>

          {showOut && (
            <>
              {/* outside, front face: over the front run ↔ post joint */}
              <mesh name="bay-cover-out-front" position={[s * xJoint, coverY, -half - ct / 2]} material={extMat} castShadow receiveShadow>
                <boxGeometry args={[cw, coverH, ct]} />
              </mesh>
              {/* outside, side face: over the post ↔ side window joint */}
              <mesh name="bay-cover-out-side" position={[s * (xCorner + ct / 2), coverY, postBackZ]} material={extMat} castShadow receiveShadow>
                <boxGeometry args={[ct, coverH, cw]} />
              </mesh>
            </>
          )}

          {showIn && (
            <>
              {/* inside, on the front run's lining (and on the post where it is flush) */}
              <mesh name="bay-cover-in-front" position={[s * (xJoint - cw / 2 + inFrontW / 2), coverY, half + ct / 2]} material={intMat} castShadow receiveShadow>
                <boxGeometry args={[inFrontW, coverH, ct]} />
              </mesh>
              {/* inside, on the side window's lining (and on the post where it is flush) */}
              <mesh name="bay-cover-in-side" position={[s * (insideX - ct / 2), coverY, postBackZ + cw / 2 - inSideW / 2]} material={intMat} castShadow receiveShadow>
                <boxGeometry args={[ct, coverH, inSideW]} />
              </mesh>
            </>
          )}
        </group>
      ))}

      {showGuides && (
        <group>
          {/* overall front (posts included) */}
          <DimensionGuide from={[-xCorner, guideY, -half]} to={[xCorner, guideY, -half]} label={`${Math.round(frontOverall)} mm front`} offset={[0, -0.07, 0]} />
          {/* height */}
          <DimensionGuide from={[sideGuideX, bottomY, -half]} to={[sideGuideX, topY, -half]} label={`${Math.round(extHeight)} mm`} offset={[0.12, 0, 0]} />
          {/* BOTH sides: post depth + side window (owner 05.10.2026: was on one side only) */}
          {[-1, 1].map((s) => (
            <group key={`side-guides-${s}`}>
              <DimensionGuide from={[s * sideGuideX, guideY, -half]} to={[s * sideGuideX, guideY, postBackZ]} label={`${Math.round(D)}`} offset={[s * 0.12, 0.06, 0]} />
              <DimensionGuide from={[s * sideGuideX, guideY, postBackZ]} to={[s * sideGuideX, guideY, wallZ]} label={`${Math.round(S)} side`} offset={[s * 0.14, -0.07, 0]} />
            </group>
          ))}
          {/* along the head: post · front units · post */}
          <DimensionGuide from={[-xCorner, chainY, -half]} to={[-xJoint, chainY, -half]} label={`${Math.round(W)}`} offset={[0, 0.06, 0]} />
          {(() => {
            let acc = -mm(frontRun) / 2;
            return frontFrames.map((u, i) => {
              const from = [acc, chainY, -half];
              acc += mm(u);
              return <DimensionGuide key={`fu-${i}`} from={from} to={[acc, chainY, -half]} label={`${Math.round(u)}`} offset={[0, 0.06, 0]} />;
            });
          })()}
          <DimensionGuide from={[xJoint, chainY, -half]} to={[xCorner, chainY, -half]} label={`${Math.round(W)}`} offset={[0, 0.06, 0]} />
        </group>
      )}
    </group>
  );
}
