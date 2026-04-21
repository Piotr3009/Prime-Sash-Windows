// DoorSidePanel — sidelight panel attached next to main door.
// Uses DoorFrame (outer frame + threshold) + DoorPanel with hingeType='fixed'
// so the side panel gets the same leaf structure as the main door:
//   - chamfer EXT + ovolo INT on stiles and rails
//   - beading / raised-and-fielded panel support
//   - correct rebate overlap (no gaps)
//
// Style modes:
//   sideStyle='full-glass' → DoorPanel with doorStyle='full-glass'
//   sideStyle='same'       → DoorPanel mirrors main door's doorStyle

import React, { useMemo } from 'react';
import * as THREE from 'three';
import DoorFrame, { FRAME_FACE, BOTTOM_FACE, FRAME_DEPTH, EXT_DEPTH, REBATE_STEP, GASKET_T, mm } from './DoorFrame';
import DoorPanel from './DoorPanel';

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
  paneling = 'flat',
  sealColour = 'black',
  thresholdType = 'standard',
  thresholdExtension = 0,
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

  // Effective door style for the leaf
  const effectiveStyle = sideStyle === 'same' ? doorStyle : 'full-glass';

  // Inner cavity dimensions (same calculation as DoorWindow)
  const innerW = width - FRAME_FACE * 2;
  const innerH = height - FRAME_FACE - BOTTOM_FACE;

  // Leaf dimensions — extends into rebate, same as DoorWindow (line 420-422)
  const leafGap = 4;
  const leafW = innerW + REBATE_STEP * 2 - leafGap * 2;
  const leafH = innerH + REBATE_STEP * 2 - leafGap * 2;

  // Leaf Z position — sits on gasket, flush with exterior (same as DoorWindow line 424)
  const halfD = mm(FRAME_DEPTH) / 2;
  const leafZ = halfD - mm(EXT_DEPTH) + mm(GASKET_T) + mm(57) / 2;

  // Opening center Y offset — bottom face (68mm) taller than top face (57mm)
  // (same as DoorWindow line 426)
  const openingCenterY = mm(BOTTOM_FACE - FRAME_FACE) / 2;

  return (
    <group position={position}>
      {/* Outer frame + threshold — same profile as main door */}
      <DoorFrame
        width={width}
        height={height}
        material={extMaterial}
        materialInt={intMaterial}
        sealColour={sealColour}
        thresholdType={thresholdType}
        thresholdExtension={thresholdExtension}
      />

      {/* Fixed leaf — full SashFrame with chamfer/ovolo beads, beading, paneling */}
      <DoorPanel
        width={leafW}
        height={leafH}
        hingeType="fixed"
        opening={0}
        doorStyle={effectiveStyle}
        centerMullion={false}
        paneling={sideStyle === 'same' ? paneling : 'flat'}
        material={extMaterial}
        materialInt={intMaterial}
        spacerColor={spacerColor}
        glassFinish={glassFinish}
        hBars={hBars}
        vBars={vBars}
        ironmongery="brass"
        stileWidthMm={57}
        position={[0, openingCenterY, leafZ]}
      />
    </group>
  );
}