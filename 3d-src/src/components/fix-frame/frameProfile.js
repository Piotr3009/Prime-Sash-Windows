/**
 * frameProfile.js
 * Shared constants and cross-section profile shapes for frame beads.
 * Copied from CasementPanel.jsx constants.
 */
import * as THREE from 'three';

const mm = (v) => v / 1000;

// Frame member dimensions
export const SASH_RAIL = 64;   // face width mm
export const SASH_DEPTH = 57;  // depth mm

// Bead dimensions (from CasementPanel)
export const EBW = mm(9);    // ext chamfer face width
export const EBD = mm(15);   // ext chamfer depth
export const IBW = mm(18);   // int ovolo face width
export const IBD = mm(14);   // int ovolo depth
export const IBR = mm(11);   // int ovolo radius
export const OVOLO_N = 16;   // arc segments

/**
 * Chamfer cross-section (exterior glazing edge)
 * Triangle: base EBW(9mm), height EBD(15mm)
 * Oriented: X = outward from glass edge, Y = along frame depth
 */
export function makeChamferProfile() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(EBW, 0);
  s.lineTo(0, EBD);
  s.closePath();
  return s;
}

/**
 * Ovolo cross-section (interior glazing edge)
 * Quarter circle R=IBR + flat base
 * Oriented: X = outward from glass edge, Y = along frame depth
 */
export function makeOvoloProfile() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(IBW, 0);
  // Quarter circle arc from (IBW, 0) curving to (0, IBD)
  const cx = 0;
  const cy = 0;
  const segs = OVOLO_N;
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    const a = t * (Math.PI / 2);
    const x = IBW * Math.cos(a);
    const y = IBD * Math.sin(a);
    s.lineTo(x, y);
  }
  s.closePath();
  return s;
}
