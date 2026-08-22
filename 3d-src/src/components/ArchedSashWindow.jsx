/**
 * ArchedSashWindow.jsx — arched sash window (sashType = 'arched').
 *
 * Variant B (spec D1): the UPPER sash is itself arched — there is no transom and
 * no separate fanlight. Upper sash including the arch is exactly as tall as the
 * lower sash (Piotr, 21.08), so the meeting rail sits at mid inner height.
 *
 * Construction, all reused rather than copied:
 *   - box:        straight jambs (JambWithPartingBead, with pulleys/cords/weights),
 *                 sill, box boards and staff beads from ParametricSashWindow, all
 *                 stopped at the arch start; the arched head is one contour ring
 *                 built with makeFrameGeo from FixFrameWindow.
 *   - upper sash: contour frame (makeFrameGeo) + ContourBeads (ring method — never
 *                 sweep/extrudePath) + CurvedGlass, all from FixFrameWindow.
 *   - lower sash: the existing rectangular <Sash>, untouched.
 *
 * Mechanism is weights + cords + pulleys like every other sash in this repo; the
 * pulleys sit at the top of the STRAIGHT jambs and the arched head carries no
 * mechanism. The line where the arch starts is called `straightHeight` / "arch
 * start" throughout — never the s-word (Piotr's correction, 21.08).
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import {
  mm,
  arcPoints,
  makeFrameGeo,
  CurvedGlass,
  ContourBeads,
  FixBars,
  useGlassMat,
  BAR_W,
} from './fix-frame/FixFrameWindow';
import {
  Sash,
  JambWithPartingBead,
  ExternalBoxElement,
  InternalBoxElement,
  StaffBead,
  StaffBeadHorizontal,
  TraditionalSill,
  HornMesh,
  HandleMesh,
  FingerLift,
  FitchFastenerBody,
  FitchFastenerKeep,
  DimensionGuide,
} from './ParametricSashWindow';

const SEGS = 48;

/* ═══════════════════════════════════════════════════════════════════════════
   Shape table + derived metrics.

   Mirrors window.ArchedSash in js/price-calculator.js, which is the canonical
   copy for the HTML/pricing/renderer side. The bundle cannot import from js/,
   so the four ratios live in both places — keep them in step.
   ═══════════════════════════════════════════════════════════════════════════ */

// rise as a fraction of the EXTERNAL frame width (spec §5)
export const ARCH_RISE_RATIO = {
  'segmental-arch': 0.20,
  'elliptical-arch': 0.325,
  'semi-circle': 0.50,
  'gothic-arch': Math.sqrt(3) / 2, // 0.8660254…
};

export function archRiseFor(shape, extWidth) {
  const r = ARCH_RISE_RATIO[shape];
  return (r === undefined ? ARCH_RISE_RATIO['semi-circle'] : r) * (extWidth || 0);
}

// Box/sash constants — same numbers ParametricSashWindow uses for the flat box.
const JAMB_THICKNESS = 28;
const SILL_VISIBLE_HEIGHT = 58.414;
const JAMB_EMBED_INTO_SILL = 23;
const BOX_SIDE_OVERHANG = 52;   // outer box edge beyond the frame width
const SIDE_GAP = 3;
const TOP_GAP = 3;
const BOTTOM_GAP = 3;
const STILE_WIDTH = 57;
const UPPER_MEETING_RAIL = 43;
const LOWER_MEETING_RAIL = 43;
const LOWER_BOTTOM_RAIL = 90;
const INTER_SASH_GAP = 11.5;
const GLASS_UNIT_THICKNESS = 24;

// Head face of the arched box: jamb liner (28) + box overhang (52). Lands the
// inner opening exactly on the straight jambs' inner faces, so the arch reads
// as one piece with the box.
const HEAD_FACE = JAMB_THICKNESS + BOX_SIDE_OVERHANG; // 80 mm

// Frame face of the ARCHED upper sash. Deliberately 64 mm rather than the 57 mm
// of a straight sash stile: below 64 mm the arch contour folds in on itself
// (known issue carried over from the front-door work, spec §5 "Ryzyko").
const SASH_ARCH_FACE = 64;

/**
 * Every derived number the arched product needs, from the external size + shape.
 * Pure — used by the component, by App's config, and (mirrored) by the HTML.
 */
export function archedSashMetrics(extWidth, extHeight, archShape) {
  const W = extWidth || 0;
  const H = extHeight || 0;
  const rise = archRiseFor(archShape, W);
  const straightHeight = H - rise;
  // Clear opening height: total minus sill/head structure and the 3 mm gaps.
  const innerHeight = H - 144;
  const upperMaxDrop = Math.max(0, Math.min(300, 0.25 * straightHeight));
  return {
    rise,
    riseMm: Math.round(rise),
    straightHeight,
    straightHeightMm: Math.round(straightHeight),
    innerHeight,
    upperSashHeight: innerHeight / 2,
    lowerSashHeight: innerHeight / 2,
    upperMaxDrop: Math.round(upperMaxDrop),
  };
}

/* ─── Arc point builders. `inset` is a true inward offset: for the circular
   shapes the centre is kept and the radius reduced, which is what makes the
   box head, the opening and the sash nest concentrically. ─── */
function archArcPoints(shape, halfW, rise, springY, inset, segs = SEGS) {
  const hw = Math.max(halfW - inset, mm(10));

  if (shape === 'gothic-arch') {
    // Two arcs of radius = full width, centred on the opposite bottom corners.
    const R = Math.max(2 * halfW - inset, mm(20));
    // Meet the two arcs exactly on the centre line instead of at a fixed 60°,
    // otherwise the offset arcs cross each other just below the apex.
    const cosT = Math.min(1, Math.max(-1, halfW / R));
    const t = Math.acos(cosT);
    const right = arcPoints(-halfW, springY, R, 0, t, segs);
    const left = arcPoints(halfW, springY, R, Math.PI - t, Math.PI, segs);
    return [...right, ...left];
  }

  if (shape === 'semi-circle') {
    return arcPoints(0, springY, hw, 0, Math.PI, segs);
  }

  if (shape === 'segmental-arch') {
    const r = Math.max(rise - inset, mm(10));
    const R = (r * r + hw * hw) / (2 * r);
    const cy = springY - (R - r);
    const a = Math.asin(Math.min(hw / R, 1));
    return arcPoints(0, cy, R, Math.PI / 2 - a, Math.PI / 2 + a, segs);
  }

  // elliptical-arch
  const b = Math.max(rise - inset, mm(10));
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI;
    pts.push([hw * Math.cos(a), springY + b * Math.sin(a)]);
  }
  return pts;
}

/** Drop consecutive duplicates — they make degenerate triangles that show up as
 *  a row of speckles along the arch start once ContourBeads offsets the contour. */
function dedupe(pts) {
  const out = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (last && Math.abs(last[0] - p[0]) < 1e-9 && Math.abs(last[1] - p[1]) < 1e-9) continue;
    out.push(p);
  }
  return out;
}

/** Closed contour: straight sides up to the arch start, then the arch.
 *  The arc already starts and ends exactly on (±hw, springY), so the corner
 *  points are not repeated. */
function shapeContour(shape, halfW, rise, springY, bottomY, insetSide, insetBottom) {
  const hw = Math.max(halfW - insetSide, mm(10));
  const by = bottomY + insetBottom;
  const arc = archArcPoints(shape, halfW, rise, springY, insetSide);
  return dedupe([[-hw, by], [hw, by], ...arc]);
}

/**
 * Arched box head as a CRESCENT — one simple polygon, not a shape-with-hole.
 *
 * A THREE.Shape hole has to sit strictly inside its outer boundary. The head's
 * opening reaches all the way down to the arch start, i.e. its bottom edge lies
 * ON the outer bottom edge, and the triangulator then spits out overlapping
 * slivers in a visible scalloped row right along the arch start. Tracing the
 * outer arc up and the inner arc back down avoids the hole entirely.
 *
 * Split into an EXT half (z 0…d/2) and an INT half (z -d/2…0) so dual colour
 * works exactly as it does for every other frame in the app.
 */
function makeCrescentGeo(outerArc, innerArc, depth) {
  const shape = new THREE.Shape();
  shape.moveTo(outerArc[0][0], outerArc[0][1]);
  for (let i = 1; i < outerArc.length; i++) shape.lineTo(outerArc[i][0], outerArc[i][1]);
  for (let i = innerArc.length - 1; i >= 0; i--) shape.lineTo(innerArc[i][0], innerArc[i][1]);
  shape.closePath();
  const halfD = depth / 2;
  const ext = new THREE.ExtrudeGeometry(shape, { depth: halfD, bevelEnabled: false });
  ext.computeVertexNormals();
  const int = new THREE.ExtrudeGeometry(shape, { depth: halfD, bevelEnabled: false });
  int.translate(0, 0, -halfD);
  int.computeVertexNormals();
  return { ext, int };
}

/** Height of the arch above the arch-start line for a contour inset by `inset`. */
function apexRise(shape, halfW, rise, inset) {
  if (shape === 'gothic-arch') {
    const R = Math.max(2 * halfW - inset, mm(20));
    const sq = R * R - halfW * halfW;
    return sq > 0 ? Math.sqrt(sq) : mm(10);
  }
  if (shape === 'semi-circle') return Math.max(halfW - inset, mm(10));
  return Math.max(rise - inset, mm(10));
}

/* ═══════════════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════════════ */
export default function ArchedSashWindow({
  width = 1000,          // inner frame width  (extWidth - 104)
  height = 1500,         // inner frame height (extHeight - 87)
  extWidth = null,
  extHeight = null,
  boxDepth = 164,
  boxDepthLabel = null,
  sashDepth = 57,
  archShape = 'semi-circle',
  opening = 0,
  upperOpening = 0,
  upperMaxDrop = 0,
  showGuides = true,
  showHorns = true,
  hornType = 'A',
  woodColor = '#f0e6d3',
  woodColorExt = null,
  woodColorInt = null,
  upperGlass = 'clear',
  lowerGlass = 'clear',
  doubleGlazing = false,
  spacerColor = 'silver',
  ironmongery = 'brass',
  openingType = 'both',
  lowerBars = 'none',
  lowerCustomBars = [],
  archBarPattern = 'none',
  archHBars = 0,
  archVBars = 0,
}) {
  const cExt = woodColorExt || woodColor;
  const cInt = woodColorInt || woodColor;

  const extW = extWidth || width + 104;
  const extH = extHeight || height + 87;

  /* ─── Materials (same recipes as ParametricSashWindow / FixFrameWindow) ─── */
  const jambMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({ color: cExt, roughness: 0.72, metalness: 0.02, clearcoat: 0.06, clearcoatRoughness: 0.4 }), [cExt]);
  const jambIntMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({ color: cInt, roughness: 0.72, metalness: 0.02, clearcoat: 0.06, clearcoatRoughness: 0.4 }), [cInt]);
  const beadMaterial = jambMaterial;
  const beadIntMaterial = jambIntMaterial;
  const sillMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({ color: cExt, roughness: 0.42, metalness: 0.02, clearcoat: 0.22, clearcoatRoughness: 0.12, side: THREE.DoubleSide }), [cExt]);
  const sillIntMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({ color: cInt, roughness: 0.42, metalness: 0.02, clearcoat: 0.22, clearcoatRoughness: 0.12, side: THREE.DoubleSide }), [cInt]);

  const ironmongeryMats = useMemo(() => {
    const defs = {
      brass: { main: { color: '#d4af37', metalness: 0.92, roughness: 0.18 }, dark: { color: '#b38728', metalness: 0.92, roughness: 0.26 }, screw: { color: '#7a5a16', metalness: 0.7, roughness: 0.38 } },
      chrome: { main: { color: '#e8eaec', metalness: 1.0, roughness: 0.04 }, dark: { color: '#c8cacc', metalness: 1.0, roughness: 0.08 }, screw: { color: '#a8aaac', metalness: 0.95, roughness: 0.12 } },
      stainless: { main: { color: '#c8c8c8', metalness: 0.9, roughness: 0.25 }, dark: { color: '#a8a8a8', metalness: 0.9, roughness: 0.32 }, screw: { color: '#888888', metalness: 0.85, roughness: 0.38 } },
      antique_brass: { main: { color: '#9c7722', metalness: 0.75, roughness: 0.42 }, dark: { color: '#7a5810', metalness: 0.72, roughness: 0.52 }, screw: { color: '#5c3e08', metalness: 0.65, roughness: 0.58 } },
      black: { main: { color: '#1a1a1a', metalness: 0.85, roughness: 0.30 }, dark: { color: '#111111', metalness: 0.80, roughness: 0.38 }, screw: { color: '#0a0a0a', metalness: 0.75, roughness: 0.42 } },
      white: { main: { color: '#f0f0f0', metalness: 0.30, roughness: 0.50 }, dark: { color: '#d8d8d8', metalness: 0.28, roughness: 0.55 }, screw: { color: '#c0c0c0', metalness: 0.35, roughness: 0.45 } },
    };
    const d = defs[ironmongery] || defs.brass;
    return { main: new THREE.MeshStandardMaterial(d.main), dark: new THREE.MeshStandardMaterial(d.dark), screw: new THREE.MeshStandardMaterial(d.screw) };
  }, [ironmongery]);

  const pulleyPlateMaterial = useMemo(() => {
    const defs = {
      brass: { color: '#c9a227', roughness: 0.34, metalness: 0.82 },
      chrome: { color: '#e0e2e4', roughness: 0.05, metalness: 1.0 },
      stainless: { color: '#c0c0c0', roughness: 0.28, metalness: 0.9 },
      antique_brass: { color: '#8b6914', roughness: 0.48, metalness: 0.75 },
      black: { color: '#1a1a1a', roughness: 0.30, metalness: 0.85 },
      white: { color: '#f0f0f0', roughness: 0.50, metalness: 0.30 },
    };
    return new THREE.MeshPhysicalMaterial({
      ...(defs[ironmongery] || defs.brass),
      clearcoat: 0.18, clearcoatRoughness: 0.14,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
  }, [ironmongery]);

  const upperGlassMat = useGlassMat(upperGlass === 'frosted' ? 'frosted' : 'clear');

  /* ─── Box geometry (same skeleton as the double, arch on top) ─── */
  const w = mm(width);
  const h = mm(height);
  const bd = mm(boxDepth);

  const jambThickness = mm(JAMB_THICKNESS);
  const sillVisibleHeight = mm(SILL_VISIBLE_HEIGHT);
  const jambEmbedIntoSill = mm(JAMB_EMBED_INTO_SILL);
  const jambOriginY = sillVisibleHeight - jambEmbedIntoSill;

  const sillTopY = -h / 2 + sillVisibleHeight;
  const innerW = Math.max(w - jambThickness * 2, mm(200));
  const sashWidth = innerW * 1000 - SIDE_GAP * 2;

  const outerHalfW = w / 2 + mm(BOX_SIDE_OVERHANG);
  const yBoxTop = jambOriginY + h / 2 + mm(BOX_SIDE_OVERHANG);

  // Sash opening top is 80 mm below the outer apex — identical to the flat box,
  // where head jamb (28) + box top (52) eat the same 80 mm.
  const upperVisibleTopY = yBoxTop - mm(HEAD_FACE) - mm(TOP_GAP);
  const lowerVisibleBottomY = sillTopY + mm(BOTTOM_GAP);

  const availableHeight = upperVisibleTopY - lowerVisibleBottomY;
  const meetingY = lowerVisibleBottomY + availableHeight / 2;

  const upperSashHeight = (upperVisibleTopY - meetingY) * 1000 + UPPER_MEETING_RAIL / 2;
  const lowerSashHeight = (meetingY - lowerVisibleBottomY) * 1000 + LOWER_MEETING_RAIL / 2;
  const upperSashBottomY = meetingY - mm(UPPER_MEETING_RAIL / 2);

  // Rise from the EXTERNAL width (spec §5). Clamped so a bad config can never
  // fold the arch into the meeting rail — the UI validation normally prevents
  // ever reaching the clamp.
  const riseNominal = mm(archRiseFor(archShape, extW));
  const riseMax = Math.max(yBoxTop - upperSashBottomY - mm(20), mm(20));
  const riseM = Math.min(riseNominal, riseMax);
  const ySpring = yBoxTop - riseM;

  const straightHeightMm = Math.round((ySpring - (-h / 2)) * 1000);

  /* ─── Contours ─── */
  const headGeo = useMemo(() => {
    const outerArc = dedupe(archArcPoints(archShape, outerHalfW, riseM, ySpring, 0));
    const innerArc = dedupe(archArcPoints(archShape, outerHalfW, riseM, ySpring, mm(HEAD_FACE)));
    return makeCrescentGeo(outerArc, innerArc, bd);
  }, [archShape, outerHalfW, riseM, ySpring, bd]);

  // Upper sash: outer contour = opening inset by the 3 mm running gap.
  const sashInset = mm(HEAD_FACE + SIDE_GAP);
  const sashOuterPts = useMemo(
    () => shapeContour(archShape, outerHalfW, riseM, ySpring, upperSashBottomY, sashInset, 0),
    [archShape, outerHalfW, riseM, ySpring, upperSashBottomY, sashInset]
  );
  const sashInnerPts = useMemo(
    () => shapeContour(
      archShape, outerHalfW, riseM, ySpring, upperSashBottomY,
      sashInset + mm(SASH_ARCH_FACE), mm(UPPER_MEETING_RAIL)
    ),
    [archShape, outerHalfW, riseM, ySpring, upperSashBottomY, sashInset]
  );
  const sashFrameGeo = useMemo(
    () => makeFrameGeo(sashOuterPts, sashInnerPts, mm(sashDepth)),
    [sashOuterPts, sashInnerPts, sashDepth]
  );

  const sashExtMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: cExt, roughness: 0.72, metalness: 0.02, clearcoat: 0.06, clearcoatRoughness: 0.4 }), [cExt]);
  const sashIntMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: cInt, roughness: 0.72, metalness: 0.02, clearcoat: 0.06, clearcoatRoughness: 0.4 }), [cInt]);

  /* ─── Bars in the arched upper sash (phase 3) ─── */
  const sashHalfW = Math.max(outerHalfW - sashInset - mm(SASH_ARCH_FACE), mm(10));
  const sashGlassBottom = upperSashBottomY + mm(UPPER_MEETING_RAIL);
  const sashApexRise = apexRise(archShape, outerHalfW, riseM, sashInset + mm(SASH_ARCH_FACE));
  const upperBarData = useArchedSashBars({
    shape: archShape,
    halfW: sashHalfW,
    bottomY: sashGlassBottom,
    springY: ySpring,
    apexRise: sashApexRise,
    pattern: archBarPattern,
    hBars: archHBars,
    vBars: archVBars,
  });

  /* ─── Openings ─── */
  const maxLift = Math.max(0, (meetingY - lowerVisibleBottomY) * 1000 - 120);
  const lowerOpeningLift = openingType === 'fixed' ? 0 : Math.min(opening, maxLift);
  // Separate clamp from maxLift (spec O1): min(300, 25% of the straight height).
  const autoMaxDrop = Math.max(0, Math.min(300, 0.25 * (extH - archRiseFor(archShape, extW))));
  const effMaxDrop = Math.min(
    upperMaxDrop > 0 ? upperMaxDrop : autoMaxDrop,
    autoMaxDrop,
    Math.max(0, (ySpring - upperSashBottomY) * 1000 - 40)
  );
  const upperOpeningDrop = (openingType === 'fixed' || openingType === 'bottom')
    ? 0 : Math.min(upperOpening, effMaxDrop);

  /* ─── Straight jamb run (pulleys live at its top) ─── */
  const jambBottomY = jambOriginY - h / 2;
  const jambLen = Math.max(ySpring - jambBottomY, mm(100));
  const jambCenterY = jambBottomY + jambLen / 2;

  const sashCenterOffset = mm((sashDepth + INTER_SASH_GAP) / 2);
  const trackFrontZ = -sashCenterOffset;
  const trackRearZ = sashCenterOffset;

  const pulleyCutoutZCenter = 130 / 2 - (130 - 17) / 4;
  const pulleyLocalY = jambLen / 2 - mm(100) - mm(64);
  const cordDropY = (meetingY - jambCenterY) - pulleyLocalY;

  const boxSideH = Math.max(ySpring - jambBottomY, mm(50));
  const boxIntH = Math.max(ySpring - (jambBottomY + jambEmbedIntoSill), mm(50));
  const staffH = Math.max(ySpring - (jambBottomY + jambEmbedIntoSill), mm(50));

  const W = mm(extW);

  return (
    <group rotation={[0, Math.PI, 0]}>
      {/* ═══ STRAIGHT JAMBS — stop at the arch start, pulleys at their top ═══ */}
      <JambWithPartingBead
        length={jambLen}
        position={[-w / 2 + jambThickness / 2, jambCenterY, 0]}
        material={jambMaterial}
        materialInt={jambIntMaterial}
        beadMaterial={beadMaterial}
        beadMaterialInt={beadIntMaterial}
        side="left"
        beadLength={jambLen - jambThickness}
        beadYOffset={jambThickness / 2}
        showPulleyTestCutout={true}
        pulleyCutoutYFromTop={100}
        pulleyCutoutZCenter={pulleyCutoutZCenter}
        pulleyMaterial={pulleyPlateMaterial}
        pulleyUpperTravel={upperOpeningDrop}
        pulleyLowerTravel={-lowerOpeningLift}
        weightStartY={cordDropY}
        sashDropY={cordDropY}
      />
      <JambWithPartingBead
        length={jambLen}
        position={[w / 2 - jambThickness / 2, jambCenterY, 0]}
        material={jambMaterial}
        materialInt={jambIntMaterial}
        beadMaterial={beadMaterial}
        beadMaterialInt={beadIntMaterial}
        side="right"
        beadLength={jambLen - jambThickness}
        beadYOffset={jambThickness / 2}
        showPulleyTestCutout={true}
        pulleyCutoutYFromTop={100}
        pulleyCutoutZCenter={pulleyCutoutZCenter}
        pulleyMaterial={pulleyPlateMaterial}
        pulleyUpperTravel={upperOpeningDrop}
        pulleyLowerTravel={-lowerOpeningLift}
        weightStartY={cordDropY}
        sashDropY={cordDropY}
      />

      {/* ═══ ARCHED BOX HEAD — contour ring, no mechanism inside it ═══ */}
      <group>
        <mesh geometry={headGeo.ext} castShadow receiveShadow>
          <primitive object={jambMaterial} attach="material" />
        </mesh>
        <mesh geometry={headGeo.int} castShadow receiveShadow>
          <primitive object={jambIntMaterial} attach="material" />
        </mesh>
      </group>

      {/* ═══ SILL ═══ */}
      <TraditionalSill
        width={width}
        position={[0, -h / 2 + sillVisibleHeight / 2, 0]}
        material={sillMaterial}
        materialInt={sillIntMaterial}
      />

      {/* ═══ BOX BOARDS + STAFF BEADS — straight run only ═══ */}
      <ExternalBoxElement height={boxSideH} side="right" position={[w / 2 - mm(100) + mm(52), jambBottomY, bd / 2 - mm(17)]} color={cExt} />
      <ExternalBoxElement height={boxSideH} side="left" position={[-w / 2 + mm(100) - mm(52), jambBottomY, bd / 2 - mm(17)]} color={cExt} />

      <StaffBeadHorizontal
        width={w + mm(104) - mm(160)}
        position={[0, jambBottomY + jambEmbedIntoSill, -bd / 2 + mm(80) - mm(65) - mm(17) - mm(17) + mm(34)]}
        flipZ={false}
        color={cInt}
      />
      <StaffBead height={staffH} side="right" position={[w / 2 + mm(52) - mm(80), jambBottomY + jambEmbedIntoSill, -bd / 2 + mm(80) - mm(65) - mm(17)]} color={cExt} colorInt={cInt} />
      <StaffBead height={staffH} side="left" position={[-w / 2 - mm(52) + mm(80), jambBottomY + jambEmbedIntoSill, -bd / 2 + mm(80) - mm(65) - mm(17)]} color={cExt} colorInt={cInt} />
      <InternalBoxElement height={boxIntH} side="right" position={[w / 2 + mm(52) - mm(80), jambBottomY + jambEmbedIntoSill, -bd / 2]} color={cInt} />
      <InternalBoxElement height={boxIntH} side="left" position={[-w / 2 - mm(52) + mm(80), jambBottomY + jambEmbedIntoSill, -bd / 2]} color={cInt} />

      {/* ═══ UPPER SASH — arched, slides DOWN by min(upperOpening, upperMaxDrop) ═══ */}
      <group position={[0, -mm(upperOpeningDrop), trackRearZ]}>
        <mesh geometry={sashFrameGeo.ext} castShadow receiveShadow>
          <primitive object={sashExtMat} attach="material" />
        </mesh>
        <mesh geometry={sashFrameGeo.int} castShadow receiveShadow>
          <primitive object={sashIntMat} attach="material" />
        </mesh>
        <ContourBeads innerPts={sashInnerPts} D={mm(sashDepth)} matExt={sashExtMat} matInt={sashIntMat} />
        <CurvedGlass innerPts={sashInnerPts} glassMat={upperGlassMat} spacerColor={spacerColor} />
        {upperBarData.straight.length > 0 && (
          <FixBars barItems={upperBarData.straight} matExt={sashExtMat} matInt={sashIntMat} spacerColor={spacerColor} />
        )}
        {upperBarData.curves.map((curve, ci) => (
          <group key={'abc' + ci}>
            {curve.extLayers.map((g, i) => (
              <mesh key={'e' + i} geometry={g} castShadow receiveShadow><primitive object={sashExtMat} attach="material" /></mesh>
            ))}
            {curve.intLayers.map((g, i) => (
              <mesh key={'i' + i} geometry={g} castShadow receiveShadow><primitive object={sashIntMat} attach="material" /></mesh>
            ))}
            {curve.spacerGeo && (
              <mesh geometry={curve.spacerGeo} castShadow receiveShadow>
                <primitive object={upperBarData.spacerMat} attach="material" />
              </mesh>
            )}
          </group>
        ))}
      </group>

      {/* ═══ LOWER SASH — unchanged rectangular sash ═══ */}
      <Sash
        width={sashWidth}
        height={lowerSashHeight}
        depth={sashDepth}
        stileWidth={STILE_WIDTH}
        topRail={LOWER_MEETING_RAIL}
        bottomRail={LOWER_BOTTOM_RAIL}
        zOffset={trackFrontZ}
        yOffset={(lowerVisibleBottomY + mm(lowerSashHeight) / 2) + mm(lowerOpeningLift)}
        color={cExt}
        profiledBottom={true}
        glassThickness={GLASS_UNIT_THICKNESS}
        flipChamfer={false}
        barPattern={lowerBars}
        customBars={lowerCustomBars}
        colorExt={cExt}
        colorInt={cInt}
        frosted={lowerGlass === 'frosted'}
        doubleGlazing={doubleGlazing}
        spacerColor={spacerColor}
      />

      {/* ═══ IRONMONGERY — same pieces and rules as the double ═══ */}
      {(() => {
        const twoFasteners = width > 1200 || archBarPattern !== 'none' || (archVBars || 0) > 0;
        const xPositions = twoFasteners
          ? [-mm(sashWidth / 2 - 250), mm(sashWidth / 2 - 250)]
          : [0];
        const lowerSashTop = (lowerVisibleBottomY + mm(lowerSashHeight) / 2) + mm(lowerOpeningLift) + mm(lowerSashHeight) / 2;
        const bodyZ = trackFrontZ - mm(sashDepth / 2) + mm(65);
        const keepY = upperSashBottomY - mm(upperOpeningDrop) + mm(UPPER_MEETING_RAIL);
        const keepZ = trackRearZ - mm(sashDepth / 2);
        return xPositions.map((x, i) => (
          <group key={'ff' + i}>
            <group position={[x, lowerSashTop, bodyZ]} rotation={[Math.PI / 2, Math.PI, Math.PI]} scale={0.001}>
              <FitchFastenerBody mat={ironmongeryMats} />
            </group>
            <group position={[x, keepY, keepZ]} rotation={[Math.PI / 2, Math.PI, Math.PI]} scale={0.001}>
              <FitchFastenerKeep mat={ironmongeryMats} />
            </group>
          </group>
        ));
      })()}

      {/* Horns on the upper sash (reference photo 1 has them) */}
      {showHorns && (() => {
        const bottomY = upperSashBottomY - mm(upperOpeningDrop);
        const hornY = bottomY - mm(80);
        const hornZLeft = trackRearZ + mm(sashDepth / 2) - mm(57);
        const hornZRight = trackRearZ + mm(sashDepth / 2);
        const hornMat = new THREE.MeshStandardMaterial({ color: cExt, roughness: 0.46, metalness: 0.02 });
        return [
          <group key={`horn-left-${hornType}`} position={[-mm(sashWidth / 2), hornY, hornZLeft]} scale={0.001}><HornMesh material={hornMat} depth={sashDepth} type={hornType} /></group>,
          <group key={`horn-right-${hornType}`} position={[mm(sashWidth / 2), hornY, hornZRight]} rotation={[0, Math.PI, 0]} scale={0.001}><HornMesh material={hornMat} depth={sashDepth} type={hornType} /></group>,
        ];
      })()}

      {/* Sash stoppers on the upper sash stiles */}
      {(() => {
        const bottomY = upperSashBottomY - mm(upperOpeningDrop);
        const stopperY = bottomY + mm(UPPER_MEETING_RAIL) + mm(100);
        const stopperZ = trackRearZ - mm(sashDepth / 2);
        const halfSash = mm(sashWidth / 2);
        return [-halfSash + mm(STILE_WIDTH / 2), halfSash - mm(STILE_WIDTH / 2)].map((x, i) => (
          <mesh key={'st' + i} position={[x, stopperY, stopperZ]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[mm(8), mm(8), mm(40), 32]} />
            <primitive object={ironmongeryMats.main} attach="material" />
          </mesh>
        ));
      })()}

      {/* Finger lifts on the lower sash bottom rail */}
      {(() => {
        const lowerBottom = (lowerVisibleBottomY + mm(lowerSashHeight) / 2) + mm(lowerOpeningLift) - mm(lowerSashHeight) / 2;
        const liftY = lowerBottom + mm(45);
        const liftZ = trackFrontZ - mm(sashDepth / 2) - mm(1);
        return [-mm(sashWidth / 2 - 200), mm(sashWidth / 2 - 200)].map((x, i) => (
          <group key={'fl' + i} position={[x, liftY, liftZ]} rotation={[0, Math.PI, 0]} scale={0.022}>
            <FingerLift mat={ironmongeryMats} />
          </group>
        ));
      })()}

      {/* Pull handle under the upper meeting rail */}
      {(() => {
        const handleY = upperSashBottomY - mm(upperOpeningDrop);
        const handleZ = trackRearZ + mm(sashDepth / 2) - mm(28);
        return (
          <group position={[0, handleY, handleZ]} rotation={[Math.PI / 2, 0, 0]}>
            <HandleMesh mat={ironmongeryMats} />
          </group>
        );
      })()}

      {/* ═══ DIMENSION GUIDES ═══ */}
      {showGuides && (
        <group rotation={[0, Math.PI, 0]}>
          <DimensionGuide
            from={[-outerHalfW, yBoxTop + mm(80), 0]}
            to={[outerHalfW, yBoxTop + mm(80), 0]}
            label={`${Math.round(extW)} mm`}
            offset={[0, 0.07, 0]}
          />
          <DimensionGuide
            from={[outerHalfW + mm(180), -h / 2, 0]}
            to={[outerHalfW + mm(180), yBoxTop, 0]}
            label={`${Math.round(extH)} mm`}
            offset={[0.09, 0, 0]}
          />
          <DimensionGuide
            from={[-outerHalfW - mm(130), ySpring, 0]}
            to={[-outerHalfW - mm(130), yBoxTop, 0]}
            label={`↑ ${Math.round(riseM * 1000)} mm`}
            offset={[-0.07, 0, 0]}
          />
          <DimensionGuide
            from={[-outerHalfW - mm(300), -h / 2, 0]}
            to={[-outerHalfW - mm(300), ySpring, 0]}
            label={`${straightHeightMm} mm`}
            offset={[-0.11, 0, 0]}
          />
          <DimensionGuide
            from={[-W / 2 - 0.22, 0, -bd / 2]}
            to={[-W / 2 - 0.22, 0, bd / 2]}
            label={`${Math.round(boxDepthLabel ?? boxDepth)} mm`}
            offset={[-0.1, 0, 0]}
          />
        </group>
      )}
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Bars for the arched upper sash (phase 3).

   Straight H/V grid + the arch patterns. Hub geometry follows SemiCircleFrame
   (radii 0.3/0.6/0.8 × halfW, 4/6/8 spokes); `intersecting` for gothic follows
   GothicArchFrame but takes its mullions from the V-bar columns (spec O10);
   `intersecting` for semicircular is new geometry (spec O9).
   ═══════════════════════════════════════════════════════════════════════════ */
function ptsToStrip(pts, hw) {
  if (!pts || pts.length < 3) return null;
  const leftEdge = [], rightEdge = [];
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    const dx = next[0] - prev[0], dy = next[1] - prev[1];
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len * hw, ny = dx / len * hw;
    leftEdge.push([pts[i][0] + nx, pts[i][1] + ny]);
    rightEdge.push([pts[i][0] - nx, pts[i][1] - ny]);
  }
  const shape = new THREE.Shape();
  shape.moveTo(leftEdge[0][0], leftEdge[0][1]);
  for (let i = 1; i < leftEdge.length; i++) shape.lineTo(leftEdge[i][0], leftEdge[i][1]);
  for (let i = rightEdge.length - 1; i >= 0; i--) shape.lineTo(rightEdge[i][0], rightEdge[i][1]);
  shape.closePath();
  return shape;
}

const BAR_TOP_W = mm(2);
const BAR_PROFILE_H = mm(16.5);
const SPACER_W = mm(18);
const SPACER_D = mm(16);
const GLASS_HALF = mm(24) / 2;
const CURVE_STEPS = 64;

/** Trapezoid EXT + ovolo INT + spacer along an arbitrary centreline. */
function buildCurve(pts) {
  const layerD = BAR_PROFILE_H / CURVE_STEPS;
  const extLayers = [];
  for (let i = 0; i < CURVE_STEPS; i++) {
    const t = i / (CURVE_STEPS - 1);
    const hw = (BAR_W / 2) * (1 - t) + (BAR_TOP_W / 2) * t;
    const s = ptsToStrip(pts, hw);
    if (!s) continue;
    const g = new THREE.ExtrudeGeometry(s, { depth: layerD, bevelEnabled: false });
    g.translate(0, 0, GLASS_HALF + i * layerD);
    g.computeVertexNormals();
    extLayers.push(g);
  }
  const intLayers = [];
  for (let i = 0; i < CURVE_STEPS; i++) {
    const t = (i + 1) / CURVE_STEPS;
    const hw = Math.max((BAR_W / 2) * Math.cos(t * Math.PI / 2), BAR_TOP_W / 2);
    const s = ptsToStrip(pts, hw);
    if (!s) continue;
    const g = new THREE.ExtrudeGeometry(s, { depth: layerD, bevelEnabled: false });
    g.translate(0, 0, -(GLASS_HALF + (i + 1) * layerD));
    g.computeVertexNormals();
    intLayers.push(g);
  }
  const ss = ptsToStrip(pts, SPACER_W / 2);
  let spacerGeo = null;
  if (ss) {
    spacerGeo = new THREE.ExtrudeGeometry(ss, { depth: SPACER_D, bevelEnabled: false });
    spacerGeo.translate(0, 0, -SPACER_D / 2);
    spacerGeo.computeVertexNormals();
  }
  return { extLayers, intLayers, spacerGeo };
}

export function useArchedSashBars({ shape, halfW, bottomY, springY, apexRise: rise, pattern, hBars, vBars }) {
  const spacerMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#a0a4a8', metalness: 0.6, roughness: 0.4 }), []);

  return useMemo(() => {
    const straight = [];
    const curves = [];
    const H = Math.max(hBars || 0, 0);
    const V = Math.max(vBars || 0, 0);
    const glassW = halfW * 2;
    const belowH = springY - bottomY;
    const pat = pattern || 'none';

    // Which shapes accept which patterns (spec §5 / O9)
    const hubOk = shape === 'semi-circle';
    const isHub = hubOk && (pat === 'half-hub' || pat === 'hub-spoke' || pat === 'double-hub-spoke' || pat === 'triple-hub-spoke');
    const isIntersecting = pat === 'intersecting' && (shape === 'semi-circle' || shape === 'gothic-arch');

    // Height of the arch profile above springY at x (for clipping V bars)
    function archYAt(x) {
      const t = Math.min(1, Math.abs(x) / (halfW || 1));
      if (shape === 'semi-circle') {
        const sq = halfW * halfW - x * x;
        return springY + (sq > 0 ? Math.sqrt(sq) : 0);
      }
      if (shape === 'gothic-arch') {
        // two arcs radius R centred at ∓halfW, apex height = rise
        const R = Math.sqrt(rise * rise + halfW * halfW);
        const cx = x >= 0 ? -halfW : halfW;
        const sq = R * R - (x - cx) * (x - cx);
        return springY + (sq > 0 ? Math.sqrt(sq) : 0);
      }
      if (shape === 'elliptical-arch') {
        const sq = 1 - t * t;
        return springY + (sq > 0 ? rise * Math.sqrt(sq) : 0);
      }
      // segmental
      const R = (rise * rise + halfW * halfW) / (2 * rise);
      const cy = springY - (R - rise);
      const sq = R * R - x * x;
      return sq > 0 ? cy + Math.sqrt(sq) : springY;
    }

    // Vertical bar columns — also the mullion positions for the arch patterns (O10)
    const columns = [];
    for (let i = 1; i <= V; i++) columns.push(-halfW + (glassW / (V + 1)) * i);

    if (isHub || isIntersecting) {
      // Horizontal bar at the arch start separates the arch zone from the grid
      // (measured on reference photo 1; hub patterns already had it).
      straight.push({ type: 'h', x: 0, y: springY, len: glassW });
    }

    const isHalf = pat === 'half-hub';
    // Half hub has no spokes reaching the arch start, so the user's own vertical
    // bars still run underneath it (reference photo 2: half hub over 3 columns).
    // The spoke patterns DO define their own columns, so they replace them.
    const spokeHub = isHub && !isHalf;

    if (isHub) {
      const isDouble = pat === 'double-hub-spoke';
      const isTriple = pat === 'triple-hub-spoke';
      const spokeCount = isTriple ? 8 : isDouble ? 6 : 4;
      const hubR1 = halfW * 0.3;
      const hubR2 = (isDouble || isTriple) ? halfW * 0.6 : null;
      const hubR3 = isTriple ? halfW * 0.8 : null;

      // Ring feet carry on down as mullions — spoke patterns only. Half hub
      // stops at the arch start, which is what leaves room for the user's own
      // columns underneath it (reference photo 2).
      if (!isHalf && belowH > 0) {
        for (const r of [hubR1, hubR2, hubR3].filter((v) => v)) {
          straight.push({ type: 'v', x: -r, y: bottomY + belowH / 2, len: belowH });
          straight.push({ type: 'v', x: r, y: bottomY + belowH / 2, len: belowH });
        }
      }

      // Rings + spokes — every hub pattern, half hub included (it is a single
      // ring with four spokes out to the frame, exactly as SemiCircleFrame).
      for (const r of [hubR1, hubR2, hubR3].filter((v) => v)) {
        const pts = [];
        for (let i = 0; i <= 48; i++) {
          const a = (i / 48) * Math.PI;
          pts.push([r * Math.cos(a), springY + r * Math.sin(a)]);
        }
        curves.push(buildCurve(pts));
      }
      const spans = [[hubR1, hubR2 || halfW]];
      if (hubR2) spans.push([hubR2, hubR3 || halfW]);
      if (hubR3) spans.push([hubR3, halfW]);
      for (const [r0, r1] of spans) {
        for (let i = 0; i < spokeCount; i++) {
          const a = (i / (spokeCount - 1)) * Math.PI;
          const start = r0 + BAR_W * 0.6;
          const end = r1 - BAR_W * 0.4;
          if (end - start < mm(20)) continue;
          curves.push(buildCurve([
            [start * Math.cos(a), springY + start * Math.sin(a)],
            [end * Math.cos(a), springY + end * Math.sin(a)],
          ]));
        }
      }
    }

    if (isIntersecting) {
      // Mullions carry on through the arch as tracery: arcs springing from each
      // V-bar column, crossing one another, clipped to the arch profile.
      const mullions = columns.length ? columns : [-halfW / 2, halfW / 2];
      const R = shape === 'gothic-arch'
        ? Math.sqrt(rise * rise + halfW * halfW)   // gothic: two-centre arcs
        : halfW;                                    // semicircular: same radius as the head
      for (const mx of mullions) {
        for (const dir of [1, -1]) {
          // Arc centred on the opposite side, springing from this mullion's base.
          const cx = mx - dir * R;
          if (Math.abs(cx) > halfW * 3) continue;
          const pts = [];
          for (let i = 0; i <= 64; i++) {
            const t = i / 64;
            const a0 = dir > 0 ? 0 : Math.PI;
            const a = a0 + dir * t * (Math.PI / 2);
            const px = cx + R * Math.cos(a);
            const py = springY + R * Math.sin(a);
            if (py < springY) continue;
            if (Math.abs(px) > halfW) break;
            if (py > archYAt(px) - BAR_W / 2) break;
            pts.push([px, py]);
          }
          if (pts.length >= 3) curves.push(buildCurve(pts));
        }
      }
    }

    // Straight grid. With an arch pattern the grid stays under the arch start.
    const gridTop = (isHub || isIntersecting) ? springY : archYAt(0);
    const gridH = gridTop - bottomY;
    for (let i = 1; i <= H; i++) {
      const y = bottomY + (gridH / (H + 1)) * i;
      let len = glassW;
      if (y > springY) {
        // clip to the arch profile at this height
        let lo = 0, hi = halfW;
        for (let s = 0; s < 24; s++) {
          const mid = (lo + hi) / 2;
          if (archYAt(mid) > y) lo = mid; else hi = mid;
        }
        len = 2 * lo;
        if (len < mm(20)) continue;
      }
      straight.push({ type: 'h', x: 0, y, len });
    }
    if (!spokeHub) {
      for (const x of columns) {
        const top = (isHub || isIntersecting) ? springY : (archYAt(x) - BAR_W / 2);
        const barH = top - bottomY;
        if (barH > mm(20)) straight.push({ type: 'v', x, y: bottomY + barH / 2, len: barH });
      }
    }

    return { straight, curves, spacerMat, columns, belowH };
  }, [shape, halfW, bottomY, springY, rise, pattern, hBars, vBars, spacerMat]);
}
