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
import CasementFrame, { FRAME_FACE, EXT_FACE, FRAME_DEPTH, EXT_DEPTH, INT_DEPTH, REBATE_STEP, MULLION_W, BOTTOM_FACE, BOTTOM_EXT_OUTER, BOTTOM_INNER_FACE, mm } from './CasementFrame';
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
        debugColors={true}
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
      {showGuides && (() => {
        const fW = mm(FRAME_FACE);     // 65mm
        const halfD = mm(FRAME_DEPTH) / 2; // 46.5mm
        const extD = mm(EXT_DEPTH);    // 36mm
        const intD = mm(INT_DEPTH);    // 57mm
        const reb = mm(REBATE_STEP);   // 12mm

        // Absolute Z positions of frame faces
        const zExt = -halfD + extD / 2;           // exterior face
        const zJunction = -halfD - extD / 2;      // ext/int junction
        const zInt = -halfD - extD / 2 - intD;    // interior face

        const off = mm(60); // offset for dimension lines from frame edge

        return (
          <group>
            {/* A — Overall Height — LEFT side, full height */}
            <DimLine
              from={[-W/2 - off, -H/2, zExt]}
              to={[-W/2 - off, H/2, zExt]}
              label={`A: ${height}mm (height)`}
              color="#e74c3c"
            />

            {/* B — Overall Width — BOTTOM, full width */}
            <DimLine
              from={[-W/2, -H/2 - off, zExt]}
              to={[W/2, -H/2 - off, zExt]}
              label={`B: ${width}mm (width)`}
              color="#2980b9"
            />

            {/* C — Frame Face Width — LEFT stile, mid-height, outer→inner edge */}
            <DimLine
              from={[-W/2, 0, zExt + mm(20)]}
              to={[-W/2 + fW, 0, zExt + mm(20)]}
              label={`C: ${FRAME_FACE}mm (frame face)`}
              color="#27ae60"
            />

            {/* D — Frame Depth — TOP-RIGHT corner, along Z, ext face → int face */}
            <DimLine
              from={[W/2 + mm(20), H/2 + mm(20), zExt]}
              to={[W/2 + mm(20), H/2 + mm(20), zInt]}
              label={`D: ${FRAME_DEPTH}mm (total depth)`}
              color="#f39c12"
            />

            {/* E — Ext Depth — BOTTOM-RIGHT corner, ext face → junction */}
            <DimLine
              from={[W/2 + mm(20), -H/2 - mm(20), zExt]}
              to={[W/2 + mm(20), -H/2 - mm(20), zJunction]}
              label={`E: ${EXT_DEPTH}mm (ext depth)`}
              color="#9b59b6"
            />

            {/* F — Int Depth — BOTTOM-RIGHT corner, junction → int face */}
            <DimLine
              from={[W/2 + mm(20), -H/2 - mm(40), zJunction]}
              to={[W/2 + mm(20), -H/2 - mm(40), zInt]}
              label={`F: ${INT_DEPTH}mm (int depth)`}
              color="#e67e22"
            />

            {/* G — Rebate Step — TOP-LEFT inner corner, the step width */}
            <DimLine
              from={[-W/2 + fW - reb, H/2 + mm(30), zJunction]}
              to={[-W/2 + fW, H/2 + mm(30), zJunction]}
              label={`G: ${REBATE_STEP}mm (rebate)`}
              color="#1abc9c"
            />

            {/* H — Inner Opening Width — TOP, inner-left → inner-right */}
            <DimLine
              from={[-W/2 + fW, H/2 + mm(15), zExt]}
              to={[W/2 - fW, H/2 + mm(15), zExt]}
              label={`H: ${width - FRAME_FACE * 2}mm (inner opening)`}
              color="#c0392b"
            />

            {/* ═══ FACE NUMBERS — Bottom rail cross-section ═══ */}
            {/* 
              L-shape profile of bottom rail (looking from left end):
              
              Exterior (+Z)          Interior (-Z)
                ┌──────────┐
                │    EXT   │  ←── F1 front
                │  BLOCK   │
              F3│ (65×36)  │F5   ┌────────┐
                │          │     │  INT   │
                └──┬───────┘F7/F8│ BLOCK  │
              F4   │  rebate     │(53×57) │
                   └─────────────┘
                        F2 bottom    F6 back
            */}

            {(() => {
              // Frame group Z offset
              const zC = -halfD; // -0.0465

              // ─── BOTTOM RAIL actual world positions ───
              // Ext block center: [0, -H/2+fW/2, zC], size [W, fW, extD]
              const extFrontZ = zC + extD/2;     // -0.0285 (exterior face)
              const extBackZ  = zC - extD/2;     // -0.0645 (junction)
              const extTopY   = -H/2 + fW;       // inner edge
              const extBotY   = -H/2;            // outer edge

              // Int block center: [0, -H/2+fW/2-reb/2, zC-extD/2-intD/2]
              const intCZ     = zC - extD/2 - intD/2;  // -0.093
              const intBackZ  = intCZ - intD/2;         // -0.1215 (room face)
              const intFrontZ = intCZ + intD/2;         // -0.0645 (junction)
              const intFW     = fW - reb;               // 0.053
              const intTopY   = -H/2 + intFW;           // top of int block
              const intBotY   = -H/2;

              const faces = [
                // F1: Ext front face — BOTTOM RAIL, exterior side
                { n: 1, pos: [-W*0.2, -H/2 + fW/2, extFrontZ + 0.005], desc: 'Ext front', bg: '#e74c3c' },
                // F2: Ext bottom face — BOTTOM RAIL, underneath
                { n: 2, pos: [W*0.2, extBotY - 0.008, zC], desc: 'Ext bottom', bg: '#2980b9' },
                // F3: Ext inner top — BOTTOM RAIL, facing opening
                { n: 3, pos: [0, extTopY + 0.008, zC], desc: 'Ext inner top', bg: '#27ae60' },
                // F4: Int bottom — BOTTOM RAIL, underneath int block
                { n: 4, pos: [-W*0.15, intBotY - 0.008, intCZ], desc: 'Int bottom', bg: '#f39c12' },
                // F5: Junction face — LEFT STILE, where ext meets int
                { n: 5, pos: [-W/2 + fW/2, H*0.1, extBackZ - 0.005], desc: 'Junction', bg: '#9b59b6' },
                // F6: Int back (room side) — RIGHT STILE
                { n: 6, pos: [W/2 - fW/2, -H*0.1, intBackZ - 0.005], desc: 'Int back (room)', bg: '#e67e22' },
                // F7: Int inner top — TOP RAIL, facing opening
                { n: 7, pos: [0, H/2 - fW + intFW - 0.001, intCZ], desc: 'Int inner top', bg: '#1abc9c' },
                // F8: Rebate step — LEFT STILE, horizontal step between ext/int
                { n: 8, pos: [-W/2 + fW - reb/2, -H*0.2, extBackZ], desc: 'Rebate step', bg: '#c0392b' },
              ];

              return faces.map(f => (
                <Html
                  key={f.n}
                  position={f.pos}
                  center
                  style={{
                    background: f.bg,
                    color: '#fff',
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    fontFamily: 'monospace',
                    border: '3px solid #fff',
                    boxShadow: '0 2px 8px rgba(0,0,0,.5)',
                    pointerEvents: 'none',
                    userSelect: 'none',
                    cursor: 'default',
                  }}
                  title={f.desc}
                >
                  {f.n}
                </Html>
              ));
            })()}

            {/* Face legend */}
            <Html
              position={[W/2 + mm(120), 0, 0]}
              style={{
                background: 'rgba(255,255,255,0.95)',
                padding: '12px 16px',
                fontSize: '14px',
                fontFamily: 'monospace',
                lineHeight: '1.8',
                borderRadius: '6px',
                border: '2px solid #333',
                boxShadow: '0 4px 12px rgba(0,0,0,.2)',
                pointerEvents: 'none',
                userSelect: 'none',
                whiteSpace: 'pre',
              }}
            >
{`FACE  COLOR    SURFACE          SIZE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ①   Red      Ext front (+Z)   ${FRAME_FACE}×${EXT_DEPTH}mm
 ②   Blue     Ext bottom (-Y)  ${width}×${EXT_DEPTH}mm
 ③   Green    Ext inner (+Y)   ${width}×${EXT_DEPTH}mm
 ④   Yellow   Int bottom (-Y)  ${width}×${INT_DEPTH}mm
 ⑤   Purple   Junction         ${FRAME_FACE}×${FRAME_FACE}mm
 ⑥   Orange   Int back (-Z)    ${FRAME_FACE-REBATE_STEP}×${INT_DEPTH}mm
 ⑦   Teal     Int inner (+Y)   ${width}×${INT_DEPTH}mm
 ⑧   DkRed    Rebate step      ${width}×${REBATE_STEP}mm

PROFILE: L-shape 93mm total
  Ext: ${FRAME_FACE}w × ${EXT_DEPTH}d
  Int: ${FRAME_FACE-REBATE_STEP}w × ${INT_DEPTH}d
  Rebate: ${REBATE_STEP}mm step`}
            </Html>
          </group>
        );
      })()}
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