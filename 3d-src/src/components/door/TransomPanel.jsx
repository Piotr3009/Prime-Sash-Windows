// TransomPanel — fanlight/transom unit stacked ABOVE the door frame or a side panel.
// Separate coupled frame (as manufactured — ref. drawing G-D02): DoorFrame with
// thresholdType='none' (no sill) + fixed DoorPanel pane(s).
//
// panes=2 (over french doors): central frame mullion at x=0, one fixed pane per
// half, stileWidthMm=93 so vertical bars line up with the leaf glazing bars below.
// panes=1 (over a side panel): single fixed pane, stileWidthMm=57 — same stile the
// side panel leaf uses, so 'match' bars align with sideVBars below.
//
// transomOpening=true → decorative top-hung hardware (2 hinge barrels on the top
// rail + a stay arm hint). Geometry stays closed; animation can come later.

import React, { useMemo } from 'react';
import * as THREE from 'three';
import DoorFrame, { FRAME_FACE, BOTTOM_FACE, FRAME_DEPTH, EXT_DEPTH, REBATE_STEP, GASKET_T, MULLION_W, mm } from './DoorFrame';
import DoorPanel from './DoorPanel';

export default function TransomPanel({
  width = 1400,
  height = 450,
  panes = 1,
  woodColor = '#F6F6F6',
  woodColorExt = '#F6F6F6',
  woodColorInt = '#F6F6F6',
  sameColor = true,
  spacerColor = 'silver',
  glassFinish = 'clear',
  glassType = 'double',
  vBars = 0,
  stileWidthMm = 57,
  transomOpening = false,
  ironmongery = 'brass',
  sealColour = 'black',
  position = [0, 0, 0],
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

  // Inner cavity — same maths as DoorSidePanel/DoorWindow
  const innerW = width - FRAME_FACE * 2;
  const innerH = height - FRAME_FACE - BOTTOM_FACE;

  const leafGap = 4;
  const halfD = mm(FRAME_DEPTH) / 2;
  const leafZ = halfD - mm(EXT_DEPTH) + mm(GASKET_T) + mm(57) / 2;
  const openingCenterY = mm(BOTTOM_FACE - FRAME_FACE) / 2;

  // Central mullion (2-pane) sits at unit centre: x measured from LEFT edge
  const mullions = panes === 2 ? [width / 2] : [];

  // Pane widths
  const paneInnerW = panes === 2 ? (innerW - MULLION_W) / 2 : innerW;
  const leafW = paneInnerW + REBATE_STEP * 2 - leafGap * 2;
  const leafH = innerH + REBATE_STEP * 2 - leafGap * 2;
  const paneOffsetX = panes === 2 ? mm((paneInnerW + MULLION_W) / 2) : 0;

  // Top-hung hardware colours (mirror DoorWindow hinge palette)
  const hingeColors = {
    brass: '#d4af37', chrome: '#e8eaec', stainless: '#c8c8c8',
    antique_brass: '#9c7722', black: '#1a1a1a', white: '#f0f0f0',
  };
  const hingeColor = hingeColors[ironmongery] || '#c8c8c8';
  const hingeR = mm(5);
  const hingeLen = mm(80);

  const paneXs = panes === 2 ? [-paneOffsetX, paneOffsetX] : [0];

  return (
    <group position={position}>
      {/* Coupled outer frame — no threshold up here */}
      <DoorFrame
        width={width}
        height={height}
        material={extMaterial}
        materialInt={intMaterial}
        sealColour={sealColour}
        mullions={mullions}
        thresholdType="none"
      />

      {/* Fixed glazed pane(s) */}
      {paneXs.map((px, i) => (
        <DoorPanel
          key={`transom-pane-${i}`}
          width={leafW}
          height={leafH}
          hingeType="fixed"
          opening={0}
          doorStyle="full-glass"
          centerMullion={false}
          paneling="flat"
          material={extMaterial}
          materialInt={intMaterial}
          spacerColor={spacerColor}
          glassFinish={glassFinish}
          hBars={0}
          vBars={vBars}
          ironmongery={ironmongery}
          stileWidthMm={stileWidthMm}
          position={[px, openingCenterY, leafZ]}
        />
      ))}

      {/* Top-hung opening hardware (decorative) */}
      {transomOpening && (
        <group>
          {paneXs.map((px, i) => (
            <group key={`transom-hinge-${i}`}>
              <mesh position={[px - mm(paneInnerW) / 2 + mm(120), mm(height) / 2 - mm(FRAME_FACE) / 2, halfD]} rotation={[0, 0, Math.PI / 2]} castShadow>
                <cylinderGeometry args={[hingeR, hingeR, hingeLen, 16]} />
                <meshStandardMaterial color={hingeColor} metalness={0.7} roughness={0.3} />
              </mesh>
              <mesh position={[px + mm(paneInnerW) / 2 - mm(120), mm(height) / 2 - mm(FRAME_FACE) / 2, halfD]} rotation={[0, 0, Math.PI / 2]} castShadow>
                <cylinderGeometry args={[hingeR, hingeR, hingeLen, 16]} />
                <meshStandardMaterial color={hingeColor} metalness={0.7} roughness={0.3} />
              </mesh>
              {/* Stay arm hint — bottom centre of the pane */}
              <mesh position={[px, -mm(height) / 2 + mm(BOTTOM_FACE) + mm(30), halfD - mm(6)]} rotation={[0, 0, 0.5]} castShadow>
                <boxGeometry args={[mm(90), mm(8), mm(4)]} />
                <meshStandardMaterial color={hingeColor} metalness={0.7} roughness={0.3} />
              </mesh>
            </group>
          ))}
        </group>
      )}
    </group>
  );
}
