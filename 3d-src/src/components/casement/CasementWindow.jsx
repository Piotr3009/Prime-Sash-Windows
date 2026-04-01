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
import { Html } from '@react-three/drei';
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
        panels: [{ x: 0, y: 0, w: innerW, h: innerH, hinge: 'left' }],
      };
    case '040R':
      return {
        panels: [{ x: 0, y: 0, w: innerW, h: innerH, hinge: 'right' }],
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
    case '021':
    case '021L': {
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
    case '021R': {
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
    case '031':
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
          { x: 0, y: -(fanlightH + MULLION_W) / 2, w: innerW, h: mainH, hinge: 'left' },
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
          { x: 0, y: -(fanlightH + MULLION_W) / 2, w: innerW, h: mainH, hinge: 'right' },
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
  showGuides = true,
  brightness = 1.0,
  hBars = 0,
  vBars = 0,
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
            opening={0}
            material={extMaterial}
            materialInt={intMaterial}
            spacerColor={spacerColor}
            hBars={isFanlight ? 0 : hBars}
            vBars={isFanlight ? 0 : vBars}
            position={[mm(p.x), mm(p.y) + openingCenterY, leafZ]}
          />
        );
      })}

      {/* ═══ Orientation markers — on the sides ═══ */}
      <Html position={[W/2 + mm(80), 0, halfD]} center style={{
        fontSize: '14px', fontWeight: 'bold', color: '#2980b9', fontFamily: 'monospace',
        background: 'rgba(255,255,255,0.9)', padding: '3px 8px', borderRadius: '4px',
        border: '2px solid #2980b9', pointerEvents: 'none',
      }}>EXT (+Z)</Html>

      <Html position={[W/2 + mm(80), 0, -halfD]} center style={{
        fontSize: '14px', fontWeight: 'bold', color: '#e74c3c', fontFamily: 'monospace',
        background: 'rgba(255,255,255,0.9)', padding: '3px 8px', borderRadius: '4px',
        border: '2px solid #e74c3c', pointerEvents: 'none',
      }}>INT (-Z)</Html>

      {/* ═══ Dimensions ═══ */}
      {showGuides && (() => {
        const off = mm(70);
        return (
          <group>
            {/* Height — left side */}
            <DimLine from={[-W/2 - off, -H/2, 0]} to={[-W/2 - off, H/2, 0]}
              label={`${height}mm`} color="#e74c3c" />
            {/* Width — bottom */}
            <DimLine from={[-W/2, -H/2 - off, 0]} to={[W/2, -H/2 - off, 0]}
              label={`${width}mm`} color="#2980b9" />
            {/* Depth — top right corner along Z */}
            <DimLine from={[W/2 + mm(30), H/2 + mm(20), halfD]} to={[W/2 + mm(30), H/2 + mm(20), -halfD]}
              label={`${FRAME_DEPTH}mm`} color="#9b59b6" />
          </group>
        );
      })()}
    </group>
  );
}

// ─── Dimension line ───
function DimLine({ from, to, label, color = '#888' }) {
  const midX = (from[0] + to[0]) / 2;
  const midY = (from[1] + to[1]) / 2;
  const midZ = (from[2] + to[2]) / 2;
  const positions = new Float32Array([...from, ...to]);

  return (
    <group>
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={2} array={positions} itemSize={3} />
        </bufferGeometry>
        <lineBasicMaterial color={color} />
      </line>
      <mesh position={from}><sphereGeometry args={[0.006, 6, 6]} /><meshBasicMaterial color={color} /></mesh>
      <mesh position={to}><sphereGeometry args={[0.006, 6, 6]} /><meshBasicMaterial color={color} /></mesh>
      <Html position={[midX, midY + 0.01, midZ]} center style={{
        background: 'rgba(255,255,255,0.92)', padding: '2px 6px', fontSize: '11px',
        fontFamily: 'monospace', fontWeight: 'bold', color, borderRadius: '3px',
        border: `1px solid ${color}`, whiteSpace: 'nowrap', pointerEvents: 'none',
      }}>{label}</Html>
    </group>
  );
}