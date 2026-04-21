// DoorSidePanel — sidelight panel attached next to main door.
// Reuses DoorFrame (frame + bottom sill) + DoorGlazing (glass + bars with chamfer/ovolo).
// For sideStyle='same' with non-full-glass doors: adds a simple bottom rail + panel area
// that mirrors the door's bottom rail height (not a full DoorPanel leaf, side panel has no leaf).
//
// Style modes:
//   sideStyle='full-glass' → full glass, no bottom rail
//   sideStyle='same' → matches main door bottom rail height (full/3/4/half)

import React, { useMemo } from 'react';
import * as THREE from 'three';
import DoorFrame, { FRAME_FACE, BOTTOM_FACE, FRAME_DEPTH, EXT_DEPTH, INT_DEPTH, REBATE_STEP, mm } from './DoorFrame';
import DoorGlazing from './DoorGlazing';

// Bottom rail heights mirror DoorPanel's logic (effectiveStyle 'three-quarter' / 'half-glazed').
// For full-glass there is no bottom rail added — DoorFrame's sill is the only wood at bottom.
function bottomRailHeightMm(doorStyle, totalHeight) {
  if (doorStyle === 'three-quarter') return Math.round(totalHeight / 3);
  if (doorStyle === 'half-glazed') return Math.round(totalHeight / 2);
  return 0; // full-glass
}

export default function DoorSidePanel({
  width = 400,
  height = 2100,
  woodColor = '#F6F6F6',
  woodColorExt = '#F6F6F6',
  woodColorInt = '#F6F6F6',
  sameColor = true,
  spacerColor = 'silver',
  glassFinish = 'clear',
  glassType = 'double',
  hBars = 0,
  vBars = 0,
  position = [0, 0, 0],
  sideStyle = 'full-glass',  // 'full-glass' | 'same'
  doorStyle = 'full-glass',  // used when sideStyle === 'same'
  paneling = 'flat',         // reserved — not yet wired to side panel (simple bottom rail for now)
  sealColour = 'black',
}) {
  const colorE = sameColor ? woodColor : woodColorExt;
  const colorI = sameColor ? woodColor : woodColorInt;

  const extMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: colorE, roughness: 0.72, metalness: 0.02,
    clearcoat: 0.06, clearcoatRoughness: 0.4,
  }), [colorE]);

  const intMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: colorI, roughness: 0.72, metalness: 0.02,
    clearcoat: 0.06, clearcoatRoughness: 0.4,
  }), [colorI]);

  // Effective style for this panel
  const effectiveStyle = sideStyle === 'same' ? doorStyle : 'full-glass';
  const bottomRailMm = bottomRailHeightMm(effectiveStyle, height);  // 0 for full-glass

  // Frame (DoorFrame) exposes inner cavity of:
  //   width: FRAME_FACE left + innerW + FRAME_FACE right  →  innerW = width - 2*FRAME_FACE
  //   height: FRAME_FACE top + innerH + BOTTOM_FACE bottom → innerH = height - FRAME_FACE - BOTTOM_FACE
  const innerW = width - FRAME_FACE * 2;
  const innerH = height - FRAME_FACE - BOTTOM_FACE;

  // World Y coordinates for inner cavity edges (DoorFrame sits centered with full-height frame)
  const H = mm(height);
  const innerBottomY = -H / 2 + mm(BOTTOM_FACE);  // top of bottom sill
  const innerTopY = H / 2 - mm(FRAME_FACE);       // bottom of top rail

  // Bottom rail (for 3/4 or half glazed styles)
  // The rail fills the space between the frame sill top and (innerBottomY + bottomRail height).
  // Rail sits flush with the frame on left and right (innerW width), depth matches frame depth.
  const railHeightM = mm(bottomRailMm);
  const railBottomY = innerBottomY;
  const railTopY = innerBottomY + railHeightM;

  // Glass area after rail is placed
  const glassBottomY = railTopY;
  const glassTopY = innerTopY;
  const glassHeightM = glassTopY - glassBottomY;

  // DoorGlazing is positioned by its CENTER
  const glassCenterY = (glassBottomY + glassTopY) / 2;
  const glassWidthM = mm(innerW);

  // Full-glass mode: glass fills entire inner cavity
  const fullGlassCenterY = (innerBottomY + innerTopY) / 2;
  const fullGlassHeightM = innerTopY - innerBottomY;

  return (
    <group position={position}>
      {/* Outer frame + bottom sill — same profile as main door */}
      <DoorFrame
        width={width}
        height={height}
        material={extMaterial}
        materialInt={intMaterial}
        sealColour={sealColour}
      />

      {/* Bottom rail (only for 3/4 or half glazed 'same' mode).
          Simple box spanning the inner cavity width. Depth matches frame. */}
      {bottomRailMm > 0 && (
        <mesh
          castShadow
          receiveShadow
          position={[0, (railBottomY + railTopY) / 2, 0]}
        >
          <boxGeometry args={[glassWidthM, railHeightM, mm(FRAME_DEPTH)]} />
          <primitive object={extMaterial} attach="material" />
        </mesh>
      )}

      {/* Glass + bars (DoorGlazing) — reuses chamfer EXT + ovolo INT bar geometry */}
      {effectiveStyle === 'full-glass' ? (
        <DoorGlazing
          width={innerW}
          height={innerH}
          glassType={glassType}
          spacerColor={spacerColor}
          hBars={hBars}
          vBars={vBars}
          barMaterial={extMaterial}
          barMaterialInt={intMaterial}
          glassFinish={glassFinish}
          position={[0, fullGlassCenterY, 0]}
        />
      ) : (
        <DoorGlazing
          width={innerW}
          height={Math.round(glassHeightM * 1000)}
          glassType={glassType}
          spacerColor={spacerColor}
          hBars={hBars}
          vBars={vBars}
          barMaterial={extMaterial}
          barMaterialInt={intMaterial}
          glassFinish={glassFinish}
          position={[0, glassCenterY, 0]}
        />
      )}
    </group>
  );
}
