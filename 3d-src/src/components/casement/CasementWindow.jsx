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
import CasementFrame, { FRAME_FACE, FRAME_DEPTH, EXT_DEPTH, INT_DEPTH, REBATE_STEP, MULLION_W, mm } from './CasementFrame';
import CasementPanel, { SASH_RAIL } from './CasementPanel';

// ─── Layout definitions ───
// Each layout = { panels: [...], mullions?: [...], transoms?: [...] }
// Panel: { x, y, w, h, hinge } — position & size relative to glass area, hinge type
function getLayout(code, innerW, innerH) {
  const half = innerW / 2;
  const third = innerW / 3;
  const mullW = MULLION_W;

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
    case '180L': {
      const openW = innerW * 0.4;
      const fixedW = innerW - mullW - openW;
      return {
        mullions: [FRAME_FACE + openW + mullW / 2],
        panels: [
          { x: -(fixedW + mullW) / 2 + (openW - fixedW) / 2, y: 0, w: openW, h: innerH, hinge: 'left' },
          { x:  (openW + mullW) / 2 + (fixedW - openW) / 2, y: 0, w: fixedW, h: innerH, hinge: 'fixed' },
        ],
      };
    }
    case '180R': {
      const openW = innerW * 0.4;
      const fixedW = innerW - mullW - openW;
      return {
        mullions: [FRAME_FACE + fixedW + mullW / 2],
        panels: [
          { x: -(openW + mullW) / 2 + (fixedW - openW) / 2, y: 0, w: fixedW, h: innerH, hinge: 'fixed' },
          { x:  (fixedW + mullW) / 2 + (openW - fixedW) / 2, y: 0, w: openW, h: innerH, hinge: 'right' },
        ],
      };
    }

    // ─── WITH FANLIGHT (top-hung top + side-hung bottom) ───
    case '021': {
      const fanlightH = innerH * 0.3;
      const mainH = innerH - MULLION_W - fanlightH;
      const transomY = FRAME_FACE + mainH + MULLION_W / 2;
      return {
        transoms: [transomY],
        panels: [
          { x: 0, y: (fanlightH + MULLION_W) / 2, w: innerW, h: fanlightH, hinge: 'top' },
          { x: 0, y: -(mainH - fanlightH + MULLION_W) / 2 + (fanlightH - mainH) / 2, w: innerW, h: mainH, hinge: 'left' },
        ],
      };
    }
    case '031': {
      const fanlightH = innerH * 0.3;
      const mainH = innerH - MULLION_W - fanlightH;
      const transomY = FRAME_FACE + mainH + MULLION_W / 2;
      const topPanelW = (innerW - mullW) / 2;
      return {
        transoms: [transomY],
        mullions: [FRAME_FACE + topPanelW + mullW / 2],  // mullion only in top part (visual)
        panels: [
          { x: -(topPanelW + mullW) / 2, y: (fanlightH + MULLION_W) / 2, w: topPanelW, h: fanlightH, hinge: 'top' },
          { x:  (topPanelW + mullW) / 2, y: (fanlightH + MULLION_W) / 2, w: topPanelW, h: fanlightH, hinge: 'top' },
          { x: 0, y: -(mainH - fanlightH + MULLION_W) / 2 + (fanlightH - mainH) / 2, w: innerW, h: mainH, hinge: 'left' },
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
  woodColor = '#F6F6F6',
  woodColorExt = '#F6F6F6',
  woodColorInt = '#F6F6F6',
  sameColor = true,
  glassType = 'double',
  spacerColor = 'silver',
  showGuides = true,
  brightness = 1.0,
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
  const innerH = height - FRAME_FACE * 2;

  // Get layout definition
  const layoutDef = useMemo(
    () => getLayout(layout, innerW, innerH),
    [layout, innerW, innerH]
  );

  const W = mm(width);
  const H = mm(height);

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
      />

      {/* Panels — TODO: add back step by step
        <CasementPanel
          key={i}
          width={panel.w}
          height={panel.h}
          hingeType={panel.hinge}
          opening={panel.hinge === 'fixed' ? 0 : opening}
          material={extMaterial}
          materialInt={intMaterial}
          glassType={glassType}
          spacerColor={spacerColor}
          position={[mm(panel.x), mm(panel.y), -mm(FRAME_DEPTH) / 2]}
        />
      */}

      {/* ═══ DEBUG: Axes ═══ */}
      <axesHelper args={[0.5]} />

      {/* ═══ DEBUG: Full dimensioning ═══ */}
      {showGuides && (
        <group>
          {/* A — Overall Height (right side) */}
          <DimLine
            from={[W/2 + mm(50), -H/2, 0]}
            to={[W/2 + mm(50), H/2, 0]}
            label={`A: ${height}mm`}
            color="#e74c3c"
          />

          {/* B — Overall Width (below) */}
          <DimLine
            from={[-W/2, -H/2 - mm(50), 0]}
            to={[W/2, -H/2 - mm(50), 0]}
            label={`B: ${width}mm`}
            color="#2980b9"
          />

          {/* C — Frame Face Width (top member, left edge detail) */}
          <DimLine
            from={[-W/2, H/2, mm(10)]}
            to={[-W/2 + mm(FRAME_FACE), H/2, mm(10)]}
            label={`C: ${FRAME_FACE}mm`}
            color="#27ae60"
          />

          {/* D — Frame Depth total (top-left corner, along Z) */}
          <DimLine
            from={[-W/2, H/2 + mm(30), mm(FRAME_DEPTH/2)]}
            to={[-W/2, H/2 + mm(30), -mm(FRAME_DEPTH/2)]}
            label={`D: ${FRAME_DEPTH}mm`}
            color="#f39c12"
          />

          {/* E — Ext Depth (exterior portion along Z) */}
          <DimLine
            from={[-W/2 - mm(30), H/2, mm(FRAME_DEPTH/2)]}
            to={[-W/2 - mm(30), H/2, mm(FRAME_DEPTH/2) - mm(EXT_DEPTH)]}
            label={`E: ${EXT_DEPTH}mm (ext)`}
            color="#9b59b6"
          />

          {/* F — Int Depth (interior portion along Z) */}
          <DimLine
            from={[-W/2 - mm(30), H/2, mm(FRAME_DEPTH/2) - mm(EXT_DEPTH)]}
            to={[-W/2 - mm(30), H/2, -mm(FRAME_DEPTH/2)]}
            label={`F: ${INT_DEPTH}mm (int)`}
            color="#e67e22"
          />

          {/* G — Rebate Step (width of rebate ledge) */}
          <DimLine
            from={[-W/2 + mm(FRAME_FACE) - mm(REBATE_STEP), H/2 + mm(15), -mm(EXT_DEPTH)]}
            to={[-W/2 + mm(FRAME_FACE), H/2 + mm(15), -mm(EXT_DEPTH)]}
            label={`G: ${REBATE_STEP}mm`}
            color="#1abc9c"
          />

          {/* H — Inner Opening Width */}
          <DimLine
            from={[-W/2 + mm(FRAME_FACE), -H/2 - mm(30), 0]}
            to={[W/2 - mm(FRAME_FACE), -H/2 - mm(30), 0]}
            label={`H: ${width - FRAME_FACE*2}mm`}
            color="#c0392b"
          />
        </group>
      )}
    </group>
  );
}

// ─── Dimension line with 3D label ───
function DimLine({ from, to, label, color = '#888' }) {
  const midX = (from[0] + to[0]) / 2;
  const midY = (from[1] + to[1]) / 2;
  const midZ = (from[2] + to[2]) / 2;

  const positions = new Float32Array([...from, ...to]);

  // Tick marks at ends
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
  const tick = 0.008;

  return (
    <group>
      {/* Main line */}
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={2} array={positions} itemSize={3} />
        </bufferGeometry>
        <lineBasicMaterial color={color} linewidth={2} />
      </line>

      {/* Start tick */}
      <mesh position={from}>
        <sphereGeometry args={[tick, 6, 6]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* End tick */}
      <mesh position={to}>
        <sphereGeometry args={[tick, 6, 6]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* Label */}
      <Html
        position={[midX, midY + 0.012, midZ]}
        center
        style={{
          background: 'rgba(255,255,255,0.9)',
          padding: '2px 6px',
          fontSize: '11px',
          fontFamily: 'monospace',
          fontWeight: 'bold',
          color: color,
          borderRadius: '3px',
          border: `1px solid ${color}`,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {label}
      </Html>
    </group>
  );
}