/**
 * CasementWindow.jsx
 * Main casement window component.
 * Takes a layout code and builds the appropriate panel arrangement.
 *
 * Layout codes:
 *   040L  – single, side-hung left
 *   040R  – single, side-hung right
 *   010   – single, side-hung left (narrow)
 *   010T  – single, top-hung
 *   120   – double, both opening (L hinges left, R hinges right)
 *   051L  – left opening + right fixed
 *   051R  – left fixed + right opening
 *   180L  – left opening + right fixed (wider fixed)
 *   180R  – left fixed + right opening (wider fixed)
 *   021   – top fanlight (top-hung) + bottom panel (side-hung)
 *   031   – top split fanlight + bottom panel
 *   130   – triple panels
 *
 * Props:
 *   width, height – overall window in mm
 *   layout        – layout code string
 *   opening       – 0..1 sash opening
 *   woodColor, woodColorExt, woodColorInt, sameColor
 *   glassType, spacerColor
 *   upperBars, lowerBars, etc.
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Text, Line } from '@react-three/drei';
import CasementFrame, { FRAME_FACE, EXT_FACE, FRAME_DEPTH, EXT_DEPTH, INT_DEPTH, REBATE_STEP, MULLION_W, BOTTOM_FACE, BOTTOM_EXT_OUTER, BOTTOM_INNER_FACE, GASKET_T, mm } from './CasementFrame';
import CasementPanel, { SASH_RAIL } from './CasementPanel';

// ─── Layout definitions ───
// Each layout = { panels: [...], mullions?: [...], transoms?: [...] }
// Panel: { x, y, w, h, hinge } — position & size relative to glass area, hinge type
function getLayout(code, innerW, innerH, height, fanlightRatio) {
  const half = innerW / 2;
  const third = innerW / 3;
  const mullW = MULLION_W;
  const FR = fanlightRatio || 0.3;

  switch (code) {
    // ─── SINGLE PANELS ───
    case '040L':
    case '010':
      return {
        panels: [{ x: 0, y: 0, w: innerW, h: innerH, hinge: 'right' }],
      };
    case '040R':
      return {
        panels: [{ x: 0, y: 0, w: innerW, h: innerH, hinge: 'left' }],
      };
    case '010T':
      return {
        panels: [{ x: 0, y: 0, w: innerW, h: innerH, hinge: 'top' }],
      };
    case '040D': {
      const panelW = (innerW - mullW) / 2;
      return {
        mullions: [FRAME_FACE + panelW + mullW / 2],
        panels: [
          { x: -(panelW + mullW) / 2, y: 0, w: panelW, h: innerH, hinge: 'left' },
          { x:  (panelW + mullW) / 2, y: 0, w: panelW, h: innerH, hinge: 'right' },
        ],
      };
    }

    // ─── DOUBLE SIDE-BY-SIDE ───
    case '120': {
      const panelW = (innerW - mullW) / 2;
      return {
        mullions: [FRAME_FACE + panelW + mullW / 2],
        panels: [
          { x: -(panelW + mullW) / 2, y: 0, w: panelW, h: innerH, hinge: 'left' },
          { x:  (panelW + mullW) / 2, y: 0, w: panelW, h: innerH, hinge: 'right' },
        ],
      };
    }
    case '051L': {
      const panelW = (innerW - mullW) / 2;
      return {
        mullions: [FRAME_FACE + panelW + mullW / 2],
        panels: [
          { x: -(panelW + mullW) / 2, y: 0, w: panelW, h: innerH, hinge: 'left' },
          { x:  (panelW + mullW) / 2, y: 0, w: panelW, h: innerH, hinge: 'fixed' },
        ],
      };
    }
    case '051R': {
      const panelW = (innerW - mullW) / 2;
      return {
        mullions: [FRAME_FACE + panelW + mullW / 2],
        panels: [
          { x: -(panelW + mullW) / 2, y: 0, w: panelW, h: innerH, hinge: 'fixed' },
          { x:  (panelW + mullW) / 2, y: 0, w: panelW, h: innerH, hinge: 'right' },
        ],
      };
    }

    // ─── 052L: Mullion full + transom LEFT only (lufcik lewy) ───
    case '052L': {
      const panelW = (innerW - mullW) / 2;
      const mullX = FRAME_FACE + panelW + mullW / 2;
      const topH = innerH * FR;
      const bottomH = innerH - MULLION_W - topH;
      const transomY = BOTTOM_FACE + bottomH + MULLION_W / 2;
      return {
        mullions: [mullX],
        transoms: [{ y: transomY, width: panelW, offsetX: -(panelW + mullW) / 2 }],
        panels: [
          { x: -(panelW + mullW) / 2, y: (bottomH + MULLION_W) / 2, w: panelW, h: topH, hinge: 'top' },
          { x: -(panelW + mullW) / 2, y: -(topH + MULLION_W) / 2, w: panelW, h: bottomH, hinge: 'left' },
          { x:  (panelW + mullW) / 2, y: 0, w: panelW, h: innerH, hinge: 'right' },
        ],
      };
    }

    // ─── 052R: Mullion full + transom RIGHT only (lufcik prawy) ───
    case '052R': {
      const panelW = (innerW - mullW) / 2;
      const mullX = FRAME_FACE + panelW + mullW / 2;
      const topH = innerH * FR;
      const bottomH = innerH - MULLION_W - topH;
      const transomY = BOTTOM_FACE + bottomH + MULLION_W / 2;
      return {
        mullions: [mullX],
        transoms: [{ y: transomY, width: panelW, offsetX: (panelW + mullW) / 2 }],
        panels: [
          { x: -(panelW + mullW) / 2, y: 0, w: panelW, h: innerH, hinge: 'left' },
          { x:  (panelW + mullW) / 2, y: (bottomH + MULLION_W) / 2, w: panelW, h: topH, hinge: 'top' },
          { x:  (panelW + mullW) / 2, y: -(topH + MULLION_W) / 2, w: panelW, h: bottomH, hinge: 'right' },
        ],
      };
    }
    case '180L': {
      const openW = innerW * 0.4;
      const fixedW = innerW - mullW - openW;
      return {
        mullions: [FRAME_FACE + openW + mullW / 2],
        panels: [
          { x: -(fixedW + mullW) / 2, y: 0, w: openW, h: innerH, hinge: 'left' },
          { x:  (openW + mullW) / 2, y: 0, w: fixedW, h: innerH, hinge: 'fixed' },
        ],
      };
    }
    case '180R': {
      const openW = innerW * 0.4;
      const fixedW = innerW - mullW - openW;
      return {
        mullions: [FRAME_FACE + fixedW + mullW / 2],
        panels: [
          { x: -(openW + mullW) / 2, y: 0, w: fixedW, h: innerH, hinge: 'fixed' },
          { x:  (fixedW + mullW) / 2, y: 0, w: openW, h: innerH, hinge: 'right' },
        ],
      };
    }

    // ─── WITH FANLIGHT (top-hung top + side-hung bottom) ───
    case '021': {
      const fanlightH = innerH * FR;
      const mainH = innerH - MULLION_W - fanlightH;
      const transomY = BOTTOM_FACE + mainH + MULLION_W / 2;
      return {
        transoms: [transomY],
        panels: [
          { x: 0, y: (mainH + MULLION_W) / 2, w: innerW, h: fanlightH, hinge: 'top' },
          { x: 0, y: -(fanlightH + MULLION_W) / 2, w: innerW, h: mainH, hinge: 'fixed' },
        ],
      };
    }
    case '021L': {
      const fanlightH = innerH * FR;
      const mainH = innerH - MULLION_W - fanlightH;
      const transomY = BOTTOM_FACE + mainH + MULLION_W / 2;
      return {
        transoms: [transomY],
        panels: [
          { x: 0, y: (mainH + MULLION_W) / 2, w: innerW, h: fanlightH, hinge: 'top' },
          { x: 0, y: -(fanlightH + MULLION_W) / 2, w: innerW, h: mainH, hinge: 'right' },
        ],
      };
    }
    case '021R': {
      const fanlightH = innerH * FR;
      const mainH = innerH - MULLION_W - fanlightH;
      const transomY = BOTTOM_FACE + mainH + MULLION_W / 2;
      return {
        transoms: [transomY],
        panels: [
          { x: 0, y: (mainH + MULLION_W) / 2, w: innerW, h: fanlightH, hinge: 'top' },
          { x: 0, y: -(fanlightH + MULLION_W) / 2, w: innerW, h: mainH, hinge: 'left' },
        ],
      };
    }
    case '031': {
      const fanlightH = innerH * FR;
      const mainH = innerH - MULLION_W - fanlightH;
      const transomY = BOTTOM_FACE + mainH + MULLION_W / 2;
      const topPanelW = (innerW - mullW) / 2;
      const mullX = FRAME_FACE + topPanelW + mullW / 2;
      const mullStartY = transomY + MULLION_W / 2;
      const mullEndY = height;
      return {
        transoms: [transomY],
        mullions: [{ x: mullX, startY: mullStartY, endY: mullEndY, touchesBottom: false, touchesTop: true }],
        panels: [
          { x: -(topPanelW + mullW) / 2, y: (mainH + MULLION_W) / 2, w: topPanelW, h: fanlightH, hinge: 'top' },
          { x:  (topPanelW + mullW) / 2, y: (mainH + MULLION_W) / 2, w: topPanelW, h: fanlightH, hinge: 'top' },
          { x: 0, y: -(fanlightH + MULLION_W) / 2, w: innerW, h: mainH, hinge: 'fixed' },
        ],
      };
    }
    case '031L': {
      const fanlightH = innerH * FR;
      const mainH = innerH - MULLION_W - fanlightH;
      const transomY = BOTTOM_FACE + mainH + MULLION_W / 2;
      const topPanelW = (innerW - mullW) / 2;
      const mullX = FRAME_FACE + topPanelW + mullW / 2;
      const mullStartY = transomY + MULLION_W / 2;
      const mullEndY = height;
      return {
        transoms: [transomY],
        mullions: [{ x: mullX, startY: mullStartY, endY: mullEndY, touchesBottom: false, touchesTop: true }],
        panels: [
          { x: -(topPanelW + mullW) / 2, y: (mainH + MULLION_W) / 2, w: topPanelW, h: fanlightH, hinge: 'top' },
          { x:  (topPanelW + mullW) / 2, y: (mainH + MULLION_W) / 2, w: topPanelW, h: fanlightH, hinge: 'top' },
          { x: 0, y: -(fanlightH + MULLION_W) / 2, w: innerW, h: mainH, hinge: 'right' },
        ],
      };
    }
    case '031R': {
      const fanlightH = innerH * FR;
      const mainH = innerH - MULLION_W - fanlightH;
      const transomY = BOTTOM_FACE + mainH + MULLION_W / 2;
      const topPanelW = (innerW - mullW) / 2;
      const mullX = FRAME_FACE + topPanelW + mullW / 2;
      const mullStartY = transomY + MULLION_W / 2;
      const mullEndY = height;
      return {
        transoms: [transomY],
        mullions: [{ x: mullX, startY: mullStartY, endY: mullEndY, touchesBottom: false, touchesTop: true }],
        panels: [
          { x: -(topPanelW + mullW) / 2, y: (mainH + MULLION_W) / 2, w: topPanelW, h: fanlightH, hinge: 'top' },
          { x:  (topPanelW + mullW) / 2, y: (mainH + MULLION_W) / 2, w: topPanelW, h: fanlightH, hinge: 'top' },
          { x: 0, y: -(fanlightH + MULLION_W) / 2, w: innerW, h: mainH, hinge: 'left' },
        ],
      };
    }

    // ─── 032: Transom full width + mullion ONLY below transom ───
    case '032': {
      const topH = innerH * FR;
      const bottomH = innerH - MULLION_W - topH;
      const transomY = BOTTOM_FACE + bottomH + MULLION_W / 2;
      const bottomPanelW = (innerW - mullW) / 2;
      const mullX = FRAME_FACE + bottomPanelW + mullW / 2;
      const mullEndY = transomY - MULLION_W / 2;
      return {
        transoms: [transomY],
        mullions: [{ x: mullX, startY: 0, endY: mullEndY, touchesBottom: true, touchesTop: false }],
        panels: [
          { x: 0, y: (bottomH + MULLION_W) / 2, w: innerW, h: topH, hinge: 'top' },
          { x: -(bottomPanelW + mullW) / 2, y: -(topH + MULLION_W) / 2, w: bottomPanelW, h: bottomH, hinge: 'left' },
          { x:  (bottomPanelW + mullW) / 2, y: -(topH + MULLION_W) / 2, w: bottomPanelW, h: bottomH, hinge: 'right' },
        ],
      };
    }

    // ─── TRIPLE ───
    case '130': {
      const panelW = (innerW - mullW * 2) / 3;
      const m1 = FRAME_FACE + panelW + mullW / 2;
      const m2 = FRAME_FACE + panelW * 2 + mullW + mullW / 2;
      return {
        mullions: [m1, m2],
        panels: [
          { x: -(panelW + mullW), y: 0, w: panelW, h: innerH, hinge: 'left' },
          { x: 0,                 y: 0, w: panelW, h: innerH, hinge: 'fixed' },
          { x:  (panelW + mullW), y: 0, w: panelW, h: innerH, hinge: 'right' },
        ],
      };
    }

    // ─── 131: Triple + transom ONLY in center ───
    case '131': {
      const panelW = (innerW - mullW * 2) / 3;
      const m1 = FRAME_FACE + panelW + mullW / 2;
      const m2 = FRAME_FACE + panelW * 2 + mullW + mullW / 2;
      const topH = innerH * FR;
      const bottomH = innerH - MULLION_W - topH;
      const transomY = BOTTOM_FACE + bottomH + MULLION_W / 2;
      return {
        mullions: [m1, m2],
        transoms: [{ y: transomY, width: panelW }],
        panels: [
          { x: -(panelW + mullW), y: 0, w: panelW, h: innerH, hinge: 'left' },
          { x: 0, y: (bottomH + MULLION_W) / 2, w: panelW, h: topH, hinge: 'top' },
          { x: 0, y: -(topH + MULLION_W) / 2, w: panelW, h: bottomH, hinge: 'fixed' },
          { x:  (panelW + mullW), y: 0, w: panelW, h: innerH, hinge: 'right' },
        ],
      };
    }

    // ─── 132: Triple + transom full width ───
    case '132': {
      const panelW = (innerW - mullW * 2) / 3;
      const m1 = FRAME_FACE + panelW + mullW / 2;
      const m2 = FRAME_FACE + panelW * 2 + mullW + mullW / 2;
      const topH = innerH * FR;
      const bottomH = innerH - MULLION_W - topH;
      const transomY = BOTTOM_FACE + bottomH + MULLION_W / 2;
      return {
        mullions: [m1, m2],
        transoms: [
          { y: transomY, width: panelW, offsetX: -(panelW + mullW) },  // left transom
          { y: transomY, width: panelW, offsetX: (panelW + mullW) },   // right transom
        ],
        panels: [
          { x: -(panelW + mullW), y: (bottomH + MULLION_W) / 2, w: panelW, h: topH, hinge: 'top' },
          { x: 0,                 y: 0, w: panelW, h: innerH, hinge: 'fixed' },
          { x:  (panelW + mullW), y: (bottomH + MULLION_W) / 2, w: panelW, h: topH, hinge: 'top' },
          { x: -(panelW + mullW), y: -(topH + MULLION_W) / 2, w: panelW, h: bottomH, hinge: 'left' },
          { x:  (panelW + mullW), y: -(topH + MULLION_W) / 2, w: panelW, h: bottomH, hinge: 'right' },
        ],
      };
    }

    // Default: single left
    default:
      return {
        panels: [{ x: 0, y: 0, w: innerW, h: innerH, hinge: 'left' }],
      };
  }
}

export default function CasementWindow({
  width = 800,
  height = 1200,
  layout = '040L',
  opening = 0.3,
  fanlightRatio = 0.3,
  woodColor = '#F6F6F6',
  woodColorExt = '#F6F6F6',
  woodColorInt = '#F6F6F6',
  sameColor = true,
  glassType = 'double',
  spacerColor = 'silver',
  glassFinish = 'clear',
  trickleVent = 'none',
  trickleColour = 'white',
  sillExtension = 0,
  sillWider = false,
  sealColour = 'black',
  showGuides = true,
  brightness = 1.0,
  hBars = 0,
  vBars = 0,
  ironmongery = 'brass',
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

  const gasketMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: sealColour === 'white' ? '#E8E8E8' : '#1a1a1a',
    roughness: 0.85, metalness: 0,
  }), [sealColour]);

  // Inner dimensions (after subtracting outer frame)
  const innerW = width - FRAME_FACE * 2;
  const innerH = height - FRAME_FACE - BOTTOM_FACE;

  // Get layout definition
  const layoutDef = useMemo(
    () => getLayout(layout, innerW, innerH, height, fanlightRatio),
    [layout, innerW, innerH, height, fanlightRatio]
  );

  const W = mm(width);
  const H = mm(height);
  const halfD = mm(FRAME_DEPTH) / 2;

  return (
    <group>
      {/* Outer frame */}
      <CasementFrame
        width={width}
        height={height}
        material={extMaterial}
        materialInt={intMaterial}
        sealColour={sealColour}
        mullions={layoutDef.mullions || []}
        transoms={layoutDef.transoms || []}
        debugColors={false}
      />

      {/* ─── Panels (leaves) ─── */}
      {layoutDef.panels && layoutDef.panels.map((p, i) => {
        // Leaf sits in rebate: extends 21mm into frame rebate on each side, minus 4mm gap
        const leafGap = 4;
        const leafW = p.w + REBATE_STEP * 2 - leafGap * 2;
        const leafH = p.h + REBATE_STEP * 2 - leafGap * 2;
        // Leaf Z: sits ON gasket, flush with exterior
        const leafZ = halfD - mm(EXT_DEPTH) + mm(GASKET_T) + mm(57) / 2;
        // Opening center Y offset (bottom rail taller than top rail)
        const openingCenterY = mm(BOTTOM_FACE - FRAME_FACE) / 2;
        // Bars: only on main (large) panels, not fanlights
        const isFanlight = p.h < innerH * 0.5;
        return (
          <CasementPanel
            key={`panel-${i}`}
            width={leafW}
            height={leafH}
            hingeType={p.hinge}
            opening={p.hinge === 'fixed' ? 0 : opening}
            material={extMaterial}
            materialInt={intMaterial}
            spacerColor={spacerColor}
            glassFinish={glassFinish}
            hBars={isFanlight ? 0 : hBars}
            vBars={isFanlight ? 0 : vBars}
            ironmongery={ironmongery}
            position={[mm(p.x), mm(p.y) + openingCenterY, leafZ]}
          />
        );
      })}

      {/* ═══ Orientation markers removed — using sash-style dimensions ═══ */}

      {/* ═══ Dimensions ═══ */}

      {/* ═══ Trickle Vent — 320mm × 21mm recess, pill shape R10.5, both sides ═══ */}
      {trickleVent !== 'none' && (() => {
        const ventW = mm(320);
        const ventH = mm(21);
        const ventD = mm(6);
        const ventR = mm(10.5);
        const ventColor = trickleColour === 'brown' ? '#5C3A1E' : '#F0F0F0';

        // Position: frame = head rail center, sash = top rail of first opening panel
        let ventX = 0;
        let ventY = H / 2 - mm(FRAME_FACE / 2) + mm(15); // frame: +15mm
        let ventZextOffset = 0;
        let ventZintOffset = 0;
        if (trickleVent === 'sash') {
          const layoutData = getLayout(layout, innerW, innerH, height, fanlightRatio);
          const openPanel = (layoutData.panels || []).find(p => p.hinge !== 'fixed' && p.hinge !== 'top');
          if (openPanel) {
            ventX = mm(openPanel.x);
            ventY = mm(openPanel.y) + mm(openPanel.h) / 2 - mm(SASH_RAIL / 2) + mm(20);
          }
          // Leaf is 26mm thinner than frame — push INT side toward leaf
          ventZintOffset = mm(26);
        }
        const ventZext = halfD + ventD / 2 + mm(1) + ventZextOffset;
        const ventZint = -halfD - ventD / 2 - mm(1) + ventZintOffset;

        // Pill shape (stadium)
        const ventShape = new THREE.Shape();
        const hw = ventW / 2 - ventR;
        const hh = ventH / 2 - ventR;
        ventShape.moveTo(-hw, -ventH / 2);
        ventShape.lineTo(hw, -ventH / 2);
        ventShape.absarc(hw, -hh, ventR, -Math.PI / 2, 0, false);
        ventShape.lineTo(ventW / 2, hh);
        ventShape.absarc(hw, hh, ventR, 0, Math.PI / 2, false);
        ventShape.lineTo(-hw, ventH / 2);
        ventShape.absarc(-hw, hh, ventR, Math.PI / 2, Math.PI, false);
        ventShape.lineTo(-ventW / 2, -hh);
        ventShape.absarc(-hw, -hh, ventR, Math.PI, Math.PI * 1.5, false);

        const extrudeSettings = { depth: ventD, bevelEnabled: false };

        return (
          <group>
            {/* EXT side */}
            <mesh position={[ventX, ventY, ventZext]} castShadow>
              <extrudeGeometry args={[ventShape, extrudeSettings]} />
              <meshStandardMaterial color={ventColor} roughness={0.7} />
            </mesh>
            {/* INT side */}
            <mesh position={[ventX, ventY, ventZint]} castShadow>
              <extrudeGeometry args={[ventShape, extrudeSettings]} />
              <meshStandardMaterial color={ventColor} roughness={0.7} />
            </mesh>
          </group>
        );
      })()}

      {/* ═══ Sill Extension — flush bottom, sloped profile ═══ */}
      {sillExtension > 0 && (() => {
        const sillProj = mm(sillExtension);
        const extra = sillWider ? mm(50) : 0;
        const sillW = W + extra * 2;
        const sillH = mm(25);
        const sillY = -H / 2 + sillH / 2; // flush — raised by thickness
        const sillZ = halfD + sillProj / 2;
        return (
          <mesh position={[0, sillY, sillZ]} castShadow receiveShadow>
            <boxGeometry args={[sillW, sillH, sillProj]} />
            <primitive object={extMaterial} attach="material" />
          </mesh>
        );
      })()}

      {showGuides && (
        <group>
          {/* Width — top */}
          <DimensionGuide
            from={[-W/2, H/2 + mm(80), 0]}
            to={[W/2, H/2 + mm(80), 0]}
            label={`${width}mm`}
            offset={[0, 0.05, 0]}
          />
          {/* Height — right side */}
          <DimensionGuide
            from={[W/2 + mm(130), -H/2, 0]}
            to={[W/2 + mm(130), H/2, 0]}
            label={`${height}mm`}
            offset={[0.07, 0, 0]}
          />
          {/* Depth — left side */}
          <DimensionGuide
            from={[-W/2 - mm(130), 0, -halfD]}
            to={[-W/2 - mm(130), 0, halfD]}
            label={`${FRAME_DEPTH}mm`}
            offset={[-0.07, 0, 0]}
          />
        </group>
      )}
    </group>
  );
}

// ─── Dimension guide (same style as sash) ───
function DimensionGuide({ from, to, label, offset = [0, 0, 0] }) {
  const mid = [
    (from[0] + to[0]) / 2 + offset[0],
    (from[1] + to[1]) / 2 + offset[1],
    (from[2] + to[2]) / 2 + offset[2],
  ];
  const points = [from, to].map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  return (
    <group>
      <Line points={points} color="#22324a" lineWidth={1.25} transparent opacity={0.9} />
      <Text position={mid} fontSize={0.06} color="#22324a" anchorX="center" anchorY="middle"
        outlineColor="#f5f2ec" outlineWidth={0.008}>
        {label}
      </Text>
    </group>
  );
}