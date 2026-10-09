/**
 * sash-proportions.js — "Sash Proportions" for double / triple sash windows (owner, 09.10.2026)
 *
 * Three choices in the Sash Type step (under Head Type): Standard (as before), Cottage 40/60
 * (top sash 40% of the sash height) and Cottage 1/3–2/3 (top sash one third).
 *
 * The field is the SAME as in Production Core (tura "SASH PROPORTIONS", 09.10.2026):
 *   currentConfig.sashProportion = 'standard' | 'cottage-40-60' | 'cottage-1-3'  (missing = standard)
 * and so is the formula (workshop profile):
 *   total sash height  T = frame H − 135 + 43   (= H − 92)
 *   standard:  top = (T − 33) / 2, bottom = top + 33      (equal glass — unchanged)
 *   cottage:   top = T × 0.4  or  T / 3,  bottom = T − top
 * The 3D places the meeting rail at the same fraction of the opening (ParametricSashWindow.jsx,
 * same numbers); the price adds 5% for cottage (price-calculator.js); the estimate drawing and the
 * spec rows read fc.sashProportion (estimate-renderer.js).
 *
 * Rules (owner): double and triple only (not the arched sashes — the group sits inside
 * #head-type-options, which hides for them), frame height at least 900 mm. Whenever a rule says
 * no, the effective value is 'standard'.
 *
 * REMOVAL: delete the <script> line, the #sash-proportion-group and #spec-sash-proportion-item
 * markup and the sashProportion lines in the sync points (grep "sashProportion").
 */
(function () {
  'use strict';

  var PROD = { openingDeduct: 135, meet: 43, diff: 33 };   // Production Core default profile
  var MIN_FRAME_H = 900;
  var TOP_SHARE = { 'cottage-40-60': 0.4, 'cottage-1-3': 1 / 3 };
  var LABELS = { 'standard': 'Standard', 'cottage-40-60': 'Cottage 40/60', 'cottage-1-3': 'Cottage 1/3–2/3' };
  var SPEC_TEXT = { 'cottage-40-60': 'Cottage 40/60 (top sash 40%)', 'cottage-1-3': 'Cottage 1/3–2/3 (top sash 1/3)' };

  function isCottage(v) { return Object.prototype.hasOwnProperty.call(TOP_SHARE, v); }

  /** Sash heights (mm) for a frame height, as Production Core computes them. */
  function sashHeights(frameH, value) {
    var T = Number(frameH) - PROD.openingDeduct + PROD.meet;
    var top = isCottage(value) ? T * TOP_SHARE[value] : (T - PROD.diff) / 2;
    return { total: T, top: top, bottom: T - top };
  }

  /** Meeting line (centre of the meeting rails) as a fraction of the opening, from the bottom. */
  function meetingFraction(frameH, value) {
    var h = sashHeights(frameH, value);
    var f = (h.bottom - PROD.meet / 2) / (h.total - PROD.meet);
    return (f > 0.05 && f < 0.95) ? f : 0.5;
  }

  function $(id) { return document.getElementById(id); }
  function checkedValue(name) { var r = document.querySelector('input[name="' + name + '"]:checked'); return r ? r.value : null; }

  /** Live FRAME height, read like the other sync points (select first, then the input; +75 for structural). */
  function liveFrameHeight() {
    var sel = $('height-select');
    var h = (sel && sel.value && sel.value !== 'custom') ? parseInt(sel.value, 10) : parseInt(($('height') || {}).value, 10);
    if (isNaN(h)) return NaN;
    return h + (checkedValue('measurement-type') === 'brick-to-brick' ? 75 : 0);
  }

  function isSashWindow() {
    var range = checkedValue('product-range');
    if (range && range !== 'windows') return false;
    var wt = checkedValue('window-type');
    return !wt || wt === 'sash';
  }

  function sashTypeLive() { return checkedValue('sash-type') || 'double'; }

  function heightAllows() { var h = liveFrameHeight(); return isNaN(h) || h >= MIN_FRAME_H; }

  function applicable() {
    var st = sashTypeLive();
    return isSashWindow() && (st === 'double' || st === 'triple') && heightAllows();
  }

  function selected() { return checkedValue('sash-proportion') || 'standard'; }

  /** The value that is priced, saved and drawn: 'standard' whenever a rule says no. */
  function get() {
    var v = selected();
    return (isCottage(v) && applicable()) ? v : 'standard';
  }

  /** Share of the frame height for one sash's custom-bar slider (standard 0.5 — as before). */
  function heightShare(isLower) {
    var ts = TOP_SHARE[get()];
    return ts ? (isLower ? 1 - ts : ts) : 0.5;
  }

  function updateSpec(v) {
    var item = $('spec-sash-proportion-item'), val = $('spec-sash-proportion');
    if (item) item.style.display = isCottage(v) ? '' : 'none';
    if (val) val.textContent = SPEC_TEXT[v] || LABELS.standard;
  }

  var lastPushed = 'standard';

  /** Push the effective value to currentConfig, the 3D, the spec panel and the price. */
  function push() {
    var v = get();
    lastPushed = v;
    if (window.currentConfig) window.currentConfig.sashProportion = v;
    if (typeof window.update3D === 'function') window.update3D({ sashProportion: v });
    updateSpec(v);
    if (window.specificationController && typeof window.specificationController.applyProductRange === 'function') {
      window.specificationController.applyProductRange();   // currentConfig + 3D + price (updateAll)
    }
    if (typeof window.scheduleProductSync === 'function') window.scheduleProductSync();
    // The custom-bar editors refresh their slider limits (top / bottom sash heights changed)
    try { document.dispatchEvent(new CustomEvent('sashproportionchange', { detail: { value: v } })); } catch (e) { /* old browsers */ }
  }

  function setStandard() {
    var std = $('sash-prop-standard');
    if (std && !std.checked) std.checked = true;
  }

  /** UI rules: cottage disabled below 900 mm, reset when it no longer applies; push when the value changed. */
  function applyRules() {
    var low = !heightAllows();
    document.querySelectorAll('input[name="sash-proportion"]').forEach(function (r) {
      if (r.value === 'standard') return;
      r.disabled = low;
      var opt = r.closest('.radio-option');
      if (opt) { opt.style.opacity = low ? '.45' : ''; opt.title = low ? 'Needs a window at least ' + MIN_FRAME_H + ' mm high' : ''; }
    });
    var note = $('sash-proportion-note');
    if (note) note.hidden = !(low && isSashWindow());
    // Leaving the double/triple family (arched) or going below 900 mm resets the choice to standard,
    // so it does not come back on its own later.
    if (isCottage(selected()) && (low || sashTypeLive() === 'arched-group')) setStandard();
    var v = get();
    updateSpec(v);
    if (v !== lastPushed) push();
  }

  function init() {
    document.querySelectorAll('input[name="sash-proportion"]').forEach(function (r) {
      r.addEventListener('change', applyRules);   // pushes when the effective value changed
    });
    // Height, measurement, sash type, window type or range changed: re-check after their own handlers ran.
    document.addEventListener('change', function (e) {
      var t = e.target || {};
      if (t.name === 'sash-proportion') return;
      if (t.id === 'height' || t.id === 'height-select' || t.name === 'measurement-type' || t.name === 'sash-type' ||
          t.name === 'window-type' || t.name === 'product-range') {
        setTimeout(applyRules, 0);
      }
    }, false);
    applyRules();
  }

  window.SashProportions = {
    MIN_FRAME_H: MIN_FRAME_H, TOP_SHARE: TOP_SHARE, LABELS: LABELS, SPEC_TEXT: SPEC_TEXT,
    isCottage: isCottage, sashHeights: sashHeights, meetingFraction: meetingFraction,
    heightShare: heightShare, get: get, applyRules: applyRules
  };
  window.getSashProportion = get;
  window.applySashProportionRules = applyRules;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
