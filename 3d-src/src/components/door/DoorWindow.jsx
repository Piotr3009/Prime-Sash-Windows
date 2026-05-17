/**
 * DoorWindow.jsx
 * Main door window component.
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
import DoorFrame, { FRAME_FACE, EXT_FACE, FRAME_DEPTH, EXT_DEPTH, INT_DEPTH, REBATE_STEP, MULLION_W, BOTTOM_FACE, BOTTOM_EXT_OUTER, BOTTOM_INNER_FACE, GASKET_T, mm } from './DoorFrame';
import DoorPanel, { SASH_RAIL } from './DoorPanel';
import DoorSidePanel from './DoorSidePanel';

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
    // ─── FRENCH DOORS (no mullion, both leaves meet in center) ───
    case '040F': {
      const panelW = innerW / 2;
      return {
        panels: [
          { x: -panelW / 2, y: 0, w: panelW, h: innerH, hinge: 'left' },
          { x:  panelW / 2, y: 0, w: panelW, h: innerH, hinge: 'right' },
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

    // ─── 140L: Quad — left opens, rest fixed ───
    case '140L': {
      const panelW = (innerW - mullW * 3) / 4;
      const m1 = FRAME_FACE + panelW + mullW / 2;
      const m2 = FRAME_FACE + panelW * 2 + mullW + mullW / 2;
      const m3 = FRAME_FACE + panelW * 3 + mullW * 2 + mullW / 2;
      return {
        mullions: [m1, m2, m3],
        panels: [
          { x: -(1.5 * panelW + 1.5 * mullW), y: 0, w: panelW, h: innerH, hinge: 'left' },
          { x: -(0.5 * panelW + 0.5 * mullW), y: 0, w: panelW, h: innerH, hinge: 'fixed' },
          { x:  (0.5 * panelW + 0.5 * mullW), y: 0, w: panelW, h: innerH, hinge: 'fixed' },
          { x:  (1.5 * panelW + 1.5 * mullW), y: 0, w: panelW, h: innerH, hinge: 'fixed' },
        ],
      };
    }

    // ─── 140R: Quad — right opens, rest fixed ───
    case '140R': {
      const panelW = (innerW - mullW * 3) / 4;
      const m1 = FRAME_FACE + panelW + mullW / 2;
      const m2 = FRAME_FACE + panelW * 2 + mullW + mullW / 2;
      const m3 = FRAME_FACE + panelW * 3 + mullW * 2 + mullW / 2;
      return {
        mullions: [m1, m2, m3],
        panels: [
          { x: -(1.5 * panelW + 1.5 * mullW), y: 0, w: panelW, h: innerH, hinge: 'fixed' },
          { x: -(0.5 * panelW + 0.5 * mullW), y: 0, w: panelW, h: innerH, hinge: 'fixed' },
          { x:  (0.5 * panelW + 0.5 * mullW), y: 0, w: panelW, h: innerH, hinge: 'fixed' },
          { x:  (1.5 * panelW + 1.5 * mullW), y: 0, w: panelW, h: innerH, hinge: 'right' },
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

    // ─── SLIDING DOORS ───
    // Overlap per zone = 1×stile (adjacent stiles stack in Z on different tracks)
    // N panels, (N-1) overlaps: panelW = (innerW + (N-1)×S) / N
    // Stride = panelW - S
    // showHandle: only on the panel(s) user grabs to open
    // 020S: 2-panel sliding — default: left slides behind right
    case '020S': {
      const S = SASH_RAIL;
      const panelW = (innerW + S) / 2;
      const stride = panelW - S;
      return {
        panels: [
          { x: -stride / 2, y: 0, w: panelW, h: innerH, hinge: 'slide', slideDist: stride, trackIdx: 1, showHandle: true },
          { x:  stride / 2, y: 0, w: panelW, h: innerH, hinge: 'fixed', trackIdx: 0 },
        ],
      };
    }
    // 030S: 3-panel sequential — default: all slide right, rightmost fixed
    case '030S': {
      const S = SASH_RAIL;
      const panelW = (innerW + 2 * S) / 3;
      const stride = panelW - S;
      return {
        panels: [
          { x: -stride, y: 0, w: panelW, h: innerH, hinge: 'slide', slideDist: 2 * stride, trackIdx: 2, showHandle: true },
          { x: 0,        y: 0, w: panelW, h: innerH, hinge: 'slide', slideDist: stride,     trackIdx: 1 },
          { x:  stride,  y: 0, w: panelW, h: innerH, hinge: 'fixed', trackIdx: 0 },
        ],
      };
    }
    // 040S: 4-panel, alternating tracks — default: left-to-right (2 left slide behind 2 right)
    case '040S': {
      const S = SASH_RAIL;
      const panelW = (innerW + 3 * S) / 4;
      const stride = panelW - S;
      return {
        panels: [
          { x: -1.5 * stride, y: 0, w: panelW, h: innerH, hinge: 'slide', slideDist: 2 * stride, trackIdx: 1, showHandle: true },
          { x: -0.5 * stride, y: 0, w: panelW, h: innerH, hinge: 'slide', slideDist: 2 * stride, trackIdx: 0 },
          { x:  0.5 * stride, y: 0, w: panelW, h: innerH, hinge: 'fixed', trackIdx: 1 },
          { x:  1.5 * stride, y: 0, w: panelW, h: innerH, hinge: 'fixed', trackIdx: 0 },
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

export default function DoorWindow({
  width = 800,
  height = 1200,
  layout = '040L',
  opening = 0,
  primaryLeaf = 'left',
  openDirection = 'outward',
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
  doorStyle = 'full-glass',
  centerMullion = false,
  paneling = 'flat',
  sidePanels = 'none',
  sideLeftWidth = 400,
  sideRightWidth = 400,
  sideHBars = 0,
  sideVBars = 0,
  sideStyle = 'full-glass',
  thresholdType = 'standard',
  thresholdExtension = 0,
  panelCount = 2,
  slideDirection = 'left-to-right',
  slidingFrameDepth = 93,
  slidingPanelDepth = 57,
  foldDirection = 'left',
  trafficDoor = 'no',
  bifoldOpenDirection = 'outward',
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

  // Inner dimensions (after subtracting outer frame — 50mm for sliding/bifold, 57mm for others)
  const isSliding = layout.endsWith('S');
  const isBifold = layout.endsWith('B');
  const isSlidingOrBifold = isSliding || isBifold;
  const SLIDING_FRAME_FACE = 50;
  const BIFOLD_FRAME_DEPTH = 95; // 15 + 65 + 15
  const effectiveFrameDepth = isSliding ? slidingFrameDepth : (isBifold ? BIFOLD_FRAME_DEPTH : FRAME_DEPTH);
  const effectiveFrameFace = isSlidingOrBifold ? SLIDING_FRAME_FACE : FRAME_FACE;
  const halfD = mm(effectiveFrameDepth) / 2;
  const innerW = width - effectiveFrameFace * 2;
  const innerH = height - (isSlidingOrBifold ? SLIDING_FRAME_FACE : FRAME_FACE) - BOTTOM_FACE;

  // Get layout definition
  const layoutDef = useMemo(
    () => {
      const def = getLayout(layout, innerW, innerH, height, fanlightRatio);
      // Sliding direction swap (defaults: 020S/030S=left-to-right, 040S=left-to-right)
      if (layout.endsWith('S') && def.panels) {
        const dir = slideDirection;
        const S = SASH_RAIL;
        // 020S swaps
        if (dir === 'right-to-left' && layout === '020S') {
          const stride = ((innerW + S) / 2) - S;
          def.panels = [
            { ...def.panels[0], hinge: 'fixed', trackIdx: 0, slideDist: undefined, showHandle: false },
            { ...def.panels[1], hinge: 'slide', trackIdx: 1, slideDist: -stride, showHandle: true },
          ];
        // 030S swaps
        } else if (dir === 'right-to-left' && layout === '030S') {
          const stride = ((innerW + 2 * S) / 3) - S;
          def.panels = [
            { ...def.panels[0], hinge: 'fixed', trackIdx: 0, slideDist: undefined, showHandle: false },
            { ...def.panels[1], hinge: 'slide', trackIdx: 1, slideDist: -stride, showHandle: false },
            { ...def.panels[2], hinge: 'slide', trackIdx: 2, slideDist: -2 * stride, showHandle: true },
          ];
        // 040S swaps — right-to-left: 2 right behind 2 left
        } else if (dir === 'right-to-left' && layout === '040S') {
          const stride = ((innerW + 3 * S) / 4) - S;
          def.panels = [
            { ...def.panels[0], hinge: 'fixed', trackIdx: 1, slideDist: undefined, showHandle: false },
            { ...def.panels[1], hinge: 'fixed', trackIdx: 0, slideDist: undefined, showHandle: false },
            { ...def.panels[2], hinge: 'slide', trackIdx: 1, slideDist: -2 * stride, showHandle: false },
            { ...def.panels[3], hinge: 'slide', trackIdx: 0, slideDist: -2 * stride, showHandle: true },
          ];
        // 040S — from-center: inner 2 slide outward
        } else if (dir === 'from-center' && layout === '040S') {
          const stride = ((innerW + 3 * S) / 4) - S;
          def.panels = [
            { ...def.panels[0], hinge: 'fixed', trackIdx: 0, slideDist: undefined, showHandle: false },
            { ...def.panels[1], hinge: 'slide', trackIdx: 1, slideDist: -stride, showHandle: true },
            { ...def.panels[2], hinge: 'slide', trackIdx: 1, slideDist:  stride, showHandle: true },
            { ...def.panels[3], hinge: 'fixed', trackIdx: 0, slideDist: undefined, showHandle: false },
          ];
        // 040S — from-sides: outer 2 slide inward
        } else if (dir === 'from-sides' && layout === '040S') {
          const stride = ((innerW + 3 * S) / 4) - S;
          def.panels = [
            { ...def.panels[0], hinge: 'slide', trackIdx: 1, slideDist: stride, showHandle: true },
            { ...def.panels[1], hinge: 'fixed', trackIdx: 0, slideDist: undefined, showHandle: false },
            { ...def.panels[2], hinge: 'fixed', trackIdx: 0, slideDist: undefined, showHandle: false },
            { ...def.panels[3], hinge: 'slide', trackIdx: 1, slideDist: -stride, showHandle: true },
          ];
        }
      }
      return def;
    },
    [layout, innerW, innerH, height, fanlightRatio, slideDirection]
  );

  const W = mm(width);
  const H = mm(height);

  return (
    <group>
      {/* ═══ Frame ═══ */}
      {isSlidingOrBifold ? (
        /* Sliding: simple rectangular frame — no rebate, no seal, dual colour */
        (() => {
          const fW = mm(effectiveFrameFace); // 50mm for sliding
          const fD = mm(effectiveFrameDepth);
          const halfFD = fD / 2;
          const stileH = H - fW - mm(BOTTOM_FACE) + 0.001;
          const bottomH = mm(BOTTOM_FACE);
          // Helper: dual-colour box — ext half (Z>0) and int half (Z<0)
          const DualBox = ({ pos, args }) => (
            <group>
              <mesh castShadow receiveShadow position={[pos[0], pos[1], pos[2] + halfFD / 2]}>
                <boxGeometry args={[args[0], args[1], halfFD]} />
                <primitive object={extMaterial} attach="material" />
              </mesh>
              <mesh castShadow receiveShadow position={[pos[0], pos[1], pos[2] - halfFD / 2]}>
                <boxGeometry args={[args[0], args[1], halfFD]} />
                <primitive object={intMaterial} attach="material" />
              </mesh>
            </group>
          );
          return (
            <group>
              {/* Top rail */}
              <DualBox pos={[0, H / 2 - fW / 2, 0]} args={[W, fW, fD]} />
              {/* Bottom rail */}
              <DualBox pos={[0, -H / 2 + bottomH / 2, 0]} args={[W, bottomH, fD]} />
              {/* Left stile */}
              <DualBox pos={[-W / 2 + fW / 2, mm(BOTTOM_FACE - FRAME_FACE) / 2, 0]} args={[fW, stileH, fD]} />
              {/* Right stile */}
              <DualBox pos={[W / 2 - fW / 2, mm(BOTTOM_FACE - FRAME_FACE) / 2, 0]} args={[fW, stileH, fD]} />
            </group>
          );
        })()
      ) : (
        /* Standard doors: profiled frame with rebate and seal */
        <group scale={[1, 1, openDirection === 'inward' ? -1 : 1]}>
          <DoorFrame
            width={width}
            height={height}
            material={openDirection === 'inward' ? intMaterial : extMaterial}
            materialInt={openDirection === 'inward' ? extMaterial : intMaterial}
            sealColour={sealColour}
            mullions={layoutDef.mullions || []}
            transoms={layoutDef.transoms || []}
            debugColors={false}
            thresholdType={thresholdType}
            thresholdExtension={thresholdExtension}
            openDirection={openDirection}
          />
        </group>
      )}

      {/* ─── Panels (leaves) ─── */}
      {/* Bi-fold: accordion fold rendering */}
      {isBifold && (() => {
        const N = panelCount;
        const bfGap = 5; // mm between panels
        const bfPW_mm = (innerW - (N - 1) * bfGap) / N;
        const bfPW = mm(bfPW_mm);
        const bfLH_mm = innerH;

        const theta = Math.max(0, Math.min(1, opening)) * Math.PI / 2;
        const outSign = bifoldOpenDirection === 'outward' ? 1 : -1;
        const isRight = foldDirection === 'right';
        const dir = isRight ? -1 : 1;

        const hasTraffic = trafficDoor === 'yes' && N >= 3;
        const accN = hasTraffic ? N - 1 : N;

        // Accordion ALWAYS from fold-direction side (unchanged by TD)
        const accStartX = isRight
          ? W / 2 - mm(effectiveFrameFace)
          : -W / 2 + mm(effectiveFrameFace);
        const accDir = isRight ? -1 : 1;

        const centerY = mm(BOTTOM_FACE - effectiveFrameFace) / 2;
        const panels = [];

        // ── Traffic door: OPPOSITE side of fold, opens outward ──
        if (hasTraffic) {
          const tdHingeX = isRight
            ? -W / 2 + mm(effectiveFrameFace)
            : W / 2 - mm(effectiveFrameFace);
          const tdDir = isRight ? 1 : -1;
          const tdRotY = dir * outSign * theta;

          panels.push(
            <group key="bf-traffic" position={[tdHingeX, centerY, 0]} rotation={[0, tdRotY, 0]}>
              <DoorPanel
                width={bfPW_mm}
                height={bfLH_mm}
                hingeType={isRight ? 'left' : 'right'}
                opening={0}
                material={extMaterial}
                materialInt={intMaterial}
                spacerColor={spacerColor}
                glassFinish={glassFinish}
                hBars={hBars}
                vBars={vBars}
                doorStyle={doorStyle}
                paneling={paneling}
                showHandle={true}
                isSliding={true}
                position={[tdDir * bfPW / 2, 0, 0]}
              />
            </group>
          );
        }

        // ── Accordion: fold-direction side, no PI, no material swap ──
        let hingeX = accStartX;
        let hingeZ = 0;
        let absAngle = 0;

        for (let i = 0; i < accN; i++) {
          if (i === 0) {
            absAngle = outSign * theta;
          } else {
            absAngle += (i % 2 === 1) ? -2 * outSign * theta : 2 * outSign * theta;
          }

          const dx = Math.cos(absAngle) * accDir;
          const dz = Math.sin(absAngle);

          const cx = hingeX + (bfPW / 2) * dx;
          const cz = hingeZ + (bfPW / 2) * dz;
          const rotY = -absAngle;

          const isLastPanel = i === accN - 1;

          panels.push(
            <group key={`bf-panel-${i}`} position={[cx, centerY, cz]} rotation={[0, rotY, 0]}>
              <DoorPanel
                width={bfPW_mm}
                height={bfLH_mm}
                hingeType={isLastPanel ? (isRight ? 'right' : 'left') : 'fixed'}
                opening={0}
                material={extMaterial}
                materialInt={intMaterial}
                spacerColor={spacerColor}
                glassFinish={glassFinish}
                hBars={hBars}
                vBars={vBars}
                doorStyle={doorStyle}
                paneling={paneling}
                showHandle={isLastPanel}
                isSliding={true}
                position={[0, 0, 0]}
              />
            </group>
          );

          hingeX += bfPW * dx;
          hingeZ += bfPW * dz;
        }

        return panels;
      })()}
      {/* Standard + Sliding panels */}
      {!isBifold && layoutDef.panels && layoutDef.panels.map((p, i) => {
        // Standard doors: leaf extends into frame rebate (21mm each side, minus 4mm gap)
        // Sliding doors: no rebate, panel = exact calculated width
        const leafGap = 4;
        const leafW = isSliding ? p.w : p.w + REBATE_STEP * 2 - leafGap * 2;
        const leafH = isSliding ? p.h : p.h + REBATE_STEP * 2 - leafGap * 2;

        let leafZ;
        if (isSliding) {
          // Sliding: panels distributed inside frame from exterior to interior
          // Frame layout: [20mm wall] [panel] [5mm gap] [panel] ... [20mm wall]
          // trackIdx 0 = most exterior (front), higher = more interior
          leafZ = halfD - mm(20) - mm(slidingPanelDepth) / 2 - p.trackIdx * mm(slidingPanelDepth + 5);
        } else {
          // Standard doors: leaf sits ON gasket
          const leafZbase = halfD - mm(EXT_DEPTH) + mm(GASKET_T) + mm(57) / 2;
          leafZ = openDirection === 'inward' ? -leafZbase : leafZbase;
        }
        // Opening center Y offset (bottom rail taller than top rail)
        const openingCenterY = mm(BOTTOM_FACE - FRAME_FACE) / 2;
        // Bars: only on main (large) panels, not fanlights
        const isFanlight = p.h < innerH * 0.5;

        // ─── French doors: sequential opening ───
        // Primary opens first; when primary reaches 45° (of 70° max), secondary starts
        let panelOpening = p.hinge === 'fixed' ? 0 : opening;
        if (layout === '040F' && p.hinge !== 'fixed') {
          const isPrimary = p.hinge === primaryLeaf;
          const PHASE1_END = 0.5; // slider midpoint
          const TARGET_45 = 45 / 70; // opening fraction = 45° of 70° max
          if (isPrimary) {
            if (opening <= PHASE1_END) {
              panelOpening = (opening / PHASE1_END) * TARGET_45;
            } else {
              panelOpening = TARGET_45 + ((opening - PHASE1_END) / (1 - PHASE1_END)) * (1 - TARGET_45);
            }
          } else {
            // Secondary: stays closed until slider > PHASE1_END
            panelOpening = opening <= PHASE1_END ? 0 : ((opening - PHASE1_END) / (1 - PHASE1_END));
          }
        }

        // Sliding door: slide distance from layout definition
        const slideDist = isSliding ? mm(p.slideDist || 0) : 0;

        return (
          <DoorPanel
            key={`panel-${i}`}
            width={leafW}
            height={leafH}
            hingeType={p.hinge}
            opening={panelOpening}
            openDirection={openDirection}
            slideDist={slideDist}
            isSliding={isSliding}
            showHandle={isSliding ? !!p.showHandle : undefined}
            doorStyle={doorStyle}
            centerMullion={centerMullion}
            paneling={paneling}
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

      {/* ═══ EXT / INT labels — subtle text on door faces ═══ */}
      {showGuides && (() => {
        const labelY = H / 2 - H / 3; // 1/3 from top of door
        const labelZext = halfD + mm(2);  // just outside exterior face
        const labelZint = -halfD - mm(2); // just outside interior face
        const labelOffsetX = mm(150); // offset left/right so they don't overlap
        return (
          <group>
            <Text position={[-labelOffsetX, labelY, labelZext]} fontSize={0.038} color="#ffffff"
              anchorX="center" anchorY="middle" outlineColor="#22324a" outlineWidth={0.003}
              transparent opacity={0.5}>
              EXT
            </Text>
            <Text position={[labelOffsetX, labelY, labelZint]} fontSize={0.038} color="#ffffff"
              anchorX="center" anchorY="middle" rotation={[0, Math.PI, 0]} outlineColor="#22324a" outlineWidth={0.003}
              transparent opacity={0.5}>
              INT
            </Text>
          </group>
        );
      })()}

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

      {/* ═══ Sliding sill extension — always visible when extension > 0 ═══ */}
      {isSlidingOrBifold && thresholdExtension > 0 && (() => {
        const ext = Math.min(thresholdExtension, 100);
        const sillDepth = mm(ext);
        const sillH = mm(40);
        const sillY = -H / 2 + sillH / 2;
        const sillZ = halfD + sillDepth / 2;
        // sillWider adds 50mm each side
        const sillW = sillWider ? W + mm(100) : W;
        return (
          <mesh position={[0, sillY, sillZ]} castShadow receiveShadow>
            <boxGeometry args={[sillW, sillH, sillDepth]} />
            <primitive object={extMaterial} attach="material" />
          </mesh>
        );
      })()}

      {/* ═══ Sill Wider — extends threshold extension 50mm past configuration edges (non-sliding) ═══ */}
      {!isSlidingOrBifold && sillWider && thresholdExtension > 0 && (() => {
        // Standard doors: ear boxes on sides
        const hasLeft = (sidePanels === 'left' || sidePanels === 'both') && sideLeftWidth > 0;
        const hasRight = (sidePanels === 'right' || sidePanels === 'both') && sideRightWidth > 0;
        const totalLeftX = hasLeft ? -W / 2 - mm(sideLeftWidth) : -W / 2;
        const totalRightX = hasRight ? W / 2 + mm(sideRightWidth) : W / 2;

        const earW = mm(50);
        const ext = Math.min(thresholdExtension, 100);
        const earDepth = mm(ext);    // only the extension projection
        const earH = mm(40);         // THRESHOLD_HEIGHT
        const earY = -H / 2 + earH / 2;
        const earZ = halfD + earDepth / 2;  // projects forward from frame face

        return (
          <group>
            <mesh position={[totalLeftX - earW / 2, earY, earZ]} castShadow receiveShadow>
              <boxGeometry args={[earW, earH, earDepth]} />
              <primitive object={extMaterial} attach="material" />
            </mesh>
            <mesh position={[totalRightX + earW / 2, earY, earZ]} castShadow receiveShadow>
              <boxGeometry args={[earW, earH, earDepth]} />
              <primitive object={extMaterial} attach="material" />
            </mesh>
          </group>
        );
      })()}

      {/* ─── Side panels (sidelights) — attached next to main door frame ─── */}
      {(sidePanels === 'left' || sidePanels === 'both') && sideLeftWidth > 0 && (
        <DoorSidePanel
          width={sideLeftWidth}
          height={height}
          woodColor={woodColor}
          woodColorExt={woodColorExt}
          woodColorInt={woodColorInt}
          sameColor={sameColor}
          spacerColor={spacerColor}
          glassFinish={glassFinish}
          glassType={glassType}
          hBars={sideHBars}
          vBars={sideVBars}
          sideStyle={sideStyle}
          doorStyle={doorStyle}
          paneling={paneling}
          sealColour={sealColour}
          thresholdType={thresholdType}
          thresholdExtension={thresholdExtension}
          position={[-W / 2 - mm(sideLeftWidth) / 2, 0, 0]}
        />
      )}
      {(sidePanels === 'right' || sidePanels === 'both') && sideRightWidth > 0 && (
        <DoorSidePanel
          width={sideRightWidth}
          height={height}
          woodColor={woodColor}
          woodColorExt={woodColorExt}
          woodColorInt={woodColorInt}
          sameColor={sameColor}
          spacerColor={spacerColor}
          glassFinish={glassFinish}
          glassType={glassType}
          hBars={sideHBars}
          vBars={sideVBars}
          sideStyle={sideStyle}
          doorStyle={doorStyle}
          paneling={paneling}
          sealColour={sealColour}
          thresholdType={thresholdType}
          thresholdExtension={thresholdExtension}
          position={[W / 2 + mm(sideRightWidth) / 2, 0, 0]}
        />
      )}

      {/* ═══ Door Hinges — visible barrel cylinders on exterior ═══ */}
      {(() => {
        if (!layoutDef.panels) return null;
        // Collect panels that have side hinges (left or right)
        const hingePanels = layoutDef.panels.filter(p => p.hinge === 'left' || p.hinge === 'right');
        if (hingePanels.length === 0) return null;

        const leafGap = 4;
        const openingCenterY = mm(BOTTOM_FACE - FRAME_FACE) / 2;

        // Hinge Z: barrel center at frame exterior face
        const hingeZ = openDirection === 'inward' ? -halfD : halfD;
        const hingeR = mm(5);  // 10mm diameter = 5mm radius
        const hingeH = mm(100); // 100mm tall barrel

        // Hinge barrel material — matches ironmongery colour
        const hingeColors = {
          brass:         '#d4af37',
          chrome:        '#e8eaec',
          stainless:     '#c8c8c8',
          antique_brass: '#9c7722',
          black:         '#1a1a1a',
          white:         '#f0f0f0',
        };
        const hingeColor = hingeColors[ironmongery] || '#c8c8c8';

        return (
          <group>
            {hingePanels.map((p, pi) => {
              const leafW = p.w + REBATE_STEP * 2 - leafGap * 2;
              const leafH = p.h + REBATE_STEP * 2 - leafGap * 2;

              // Hinge X: panel center + offset to hinge edge
              const hingeX = mm(p.x) + (p.hinge === 'left' ? -mm(leafW) / 2 : mm(leafW) / 2);

              // Hinge Y positions — relative to DOOR LEAF
              const leafTop    = openingCenterY + mm(leafH) / 2;
              const leafBottom = openingCenterY - mm(leafH) / 2;
              const leafCenter = openingCenterY;

              const topY    = leafTop - mm(200);       // 200mm below door top edge
              const middleY = leafCenter + mm(100);
              const bottomY = leafBottom + mm(150);

              const positions = [topY, middleY, bottomY];
              if (height > 2400) {
                positions.push((topY + middleY) / 2);
              }

              return positions.map((y, i) => (
                <mesh key={`hinge-${pi}-${i}`} position={[hingeX, y, hingeZ]} castShadow>
                  <cylinderGeometry args={[hingeR, hingeR, hingeH, 16]} />
                  <meshStandardMaterial color={hingeColor} metalness={0.7} roughness={0.3} />
                </mesh>
              ));
            })}
          </group>
        );
      })()}

      {showGuides && (() => {
        const hasLeft = (sidePanels === 'left' || sidePanels === 'both') && sideLeftWidth > 0;
        const hasRight = (sidePanels === 'right' || sidePanels === 'both') && sideRightWidth > 0;
        const hasPanels = hasLeft || hasRight;
        const totalLeftX = hasLeft ? -W / 2 - mm(sideLeftWidth) : -W / 2;
        const totalRightX = hasRight ? W / 2 + mm(sideRightWidth) : W / 2;
        const totalWidthMm = width + (hasLeft ? sideLeftWidth : 0) + (hasRight ? sideRightWidth : 0);

        return (
          <group>
            {/* Total width — top */}
            <DimensionGuide
              from={[totalLeftX, H/2 + mm(hasPanels ? 140 : 80), 0]}
              to={[totalRightX, H/2 + mm(hasPanels ? 140 : 80), 0]}
              label={`${totalWidthMm}mm`}
              offset={[0, 0.05, 0]}
            />

            {/* Individual widths — below total, only when panels present */}
            {hasPanels && (
              <group>
                {hasLeft && (
                  <DimensionGuide
                    from={[totalLeftX, H/2 + mm(60), 0]}
                    to={[-W / 2, H/2 + mm(60), 0]}
                    label={`${sideLeftWidth}`}
                    offset={[0, 0.04, 0]}
                  />
                )}
                <DimensionGuide
                  from={[-W / 2, H/2 + mm(60), 0]}
                  to={[W / 2, H/2 + mm(60), 0]}
                  label={`${width}`}
                  offset={[0, 0.04, 0]}
                />
                {hasRight && (
                  <DimensionGuide
                    from={[W / 2, H/2 + mm(60), 0]}
                    to={[totalRightX, H/2 + mm(60), 0]}
                    label={`${sideRightWidth}`}
                    offset={[0, 0.04, 0]}
                  />
                )}
              </group>
            )}

            {/* Height — right side */}
            <DimensionGuide
              from={[totalRightX + mm(80), -H/2, 0]}
              to={[totalRightX + mm(80), H/2, 0]}
              label={`${height}mm`}
              offset={[0.07, 0, 0]}
            />
            {/* Depth — left side */}
            <DimensionGuide
              from={[totalLeftX - mm(80), 0, -halfD]}
              to={[totalLeftX - mm(80), 0, halfD]}
              label={`${effectiveFrameDepth}mm`}
              offset={[-0.07, 0, 0]}
            />
          </group>
        );
      })()}
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