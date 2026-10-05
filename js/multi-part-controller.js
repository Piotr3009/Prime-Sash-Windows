/**
 * multi-part-controller.js — Special Layout Windows: a run of sash units (owner, 01.10.2026)
 *
 * Product Range has a 4th window-type tile, "Special Layout Windows" (#type-special). Its radio
 * VALUE is "sash" — the run is an assembly of standard double-hung sash units, so every sash flow
 * (price, 3D, spec, save, edit) is reused unchanged; only this file knows the tile is special.
 *
 * Owns:
 *   · #special-layout-section (Product Range): Multi-part run · Bay (canted — not built yet) ·
 *     Square bay (02.10.2026). While special: the Sash Type radios are hidden (double-hung
 *     forced), Head Type (glazing arch) stays available.
 *   · #multi-part-section (Dimensions): number of units (run 2–6, bay front 1–4), unit widths,
 *     cover strips, continuous cill; for the square bay also #square-bay-options: side window
 *     width (each side, frame size), corners (timber posts 120 / masonry piers of the owner's
 *     width, windows set behind them, optional L-trims inside).
 *   · config keys for the bay: windowLayout 'square-bay', baySideWidth, bayCorners
 *     ('posts'|'piers'), bayPierWidth, bayLTrims — null for a run / a single window.
 *   · the width list / max while a run is active: N × 1500 (one unit = one standard sash, max 1500).
 *   · three config keys:
 *       currentConfig.multiUnits   — unit widths (mm) AS ENTERED, sum = the entered overall width;
 *                                    null = single window. Brick-to-brick: the run's +150 allowance
 *                                    is shared equally by the 3D, the price and the spec.
 *       currentConfig.multiCovers  — 'both' | 'outside' | 'inside'  (100 × 17 cover strips on the joins)
 *       currentConfig.multiSillExt — continuous cill extension at each end (mm)
 *
 * It never touches other controllers' fields except the width list/max (restored on leaving).
 * REMOVAL: delete the <script> line, the #type-special tile and the two sections; the 3D, the
 * calculator and the renderer all treat a missing multiUnits as a single window.
 */
(function () {
  'use strict';

  var UNIT_MIN = 400, UNIT_MAX = 1500;   // one unit = one standard double-hung sash
  var LIST_STEP = 50;                    // extra width-list entries above 3000 (owner: pick from the list)
  var lastKey = null;                    // last applied [units, covers, sillExt] — skips no-op re-applies
  var runActive = false;                 // width list/max currently extended for a run
  var savedMax = null;                   // #width max before the run extended it

  function $(id) { return document.getElementById(id); }
  function checked(name) { var r = document.querySelector('input[name="' + name + '"]:checked'); return r ? r.value : null; }
  function setRadio(name, value) {
    var r = document.querySelector('input[name="' + name + '"][value="' + value + '"]');
    if (r) r.checked = true;
    return !!r;
  }

  function overallWidth() {
    var sel = $('width-select'), inp = $('width');
    var v = (sel && sel.value && sel.value !== 'custom') ? parseInt(sel.value, 10) : parseInt((inp || {}).value, 10);
    return (v > 0) ? v : 0;
  }
  function isWindows() { return (checked('product-range') || 'windows') !== 'doors'; }
  function isSpecial() { var t = $('type-special'); return isWindows() && !!(t && t.checked); }
  function layout() { return checked('special-layout') || 'multi'; }
  function isBay() { return layout() === 'square-bay'; }
  // Double-hung only (this release): the Sash Type radios are hidden while special, double is forced.
  // Both layouts (multi-part run, square bay) are "multi": a run of units — the bay adds two sides.
  function isMulti() { return isSpecial() && (layout() === 'multi' || layout() === 'square-bay') && (checked('sash-type') || 'double') === 'double'; }
  function unitMin() { return isBay() ? 1 : 2; }
  function unitMaxCount() { return isBay() ? 4 : 6; }
  function unitCount() { return Math.min(unitMaxCount(), Math.max(unitMin(), parseInt(checked('multi-units'), 10) || unitMin())); }
  function multiWidthMax() { return unitCount() * UNIT_MAX; }   // 6 units → 6 × 1500 = 9000
  function sideWidth() { var v = parseInt(($('bay-side-width') || {}).value, 10); return Math.min(UNIT_MAX, Math.max(UNIT_MIN, v || 700)); }
  function pierWidth() { var v = parseInt(($('bay-pier-width') || {}).value, 10); return Math.min(450, Math.max(100, v || 150)); }

  // Equal split that still sums exactly to the overall width (last unit takes the remainder)
  function equalUnits(total, n) {
    if (n <= 1) return [total];
    var base = Math.floor(total / n), out = [], acc = 0;
    for (var i = 0; i < n - 1; i++) { out.push(base); acc += base; }
    out.push(total - acc);
    return out;
  }

  function readIndividual(n) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var el = $('multi-unit-w-' + i);
      out.push(el ? (parseInt(el.value, 10) || 0) : 0);
    }
    return out;
  }

  function renderIndividualInputs(n, values) {
    var box = $('multi-unit-widths'); if (!box) return;
    var html = '';
    for (var i = 0; i < n; i++) {
      var v = (values && values[i]) ? values[i] : '';
      html += '<div style="display:flex;align-items:center;gap:8px;margin:4px 0;">'
            + '<label for="multi-unit-w-' + i + '" style="font-size:.78rem;min-width:52px;">Unit ' + (i + 1) + '</label>'
            + '<input type="number" id="multi-unit-w-' + i + '" min="' + UNIT_MIN + '" max="' + UNIT_MAX + '" step="10" value="' + v + '" '
            + 'style="width:110px;padding:6px 8px;border:1px solid #ccc;border-radius:3px;font-size:.85rem;">'
            + '<span style="font-size:.72rem;color:var(--secondary-color);">mm</span></div>';
    }
    box.innerHTML = html;
  }

  // ── Compute the unit widths from the UI ────────────────────────────────────
  // Equal: the overall width is split. Set individually: the units are typed and the
  // OVERALL width follows their sum (owner, 01.10.2026) — apply() pushes it to the width field.
  function computeUnits() {
    var total = overallWidth(), n = unitCount();
    if (!(total > 0)) return { units: null, error: 'Enter the overall width first.' };
    var mode = (n <= 1) ? 'equal' : (checked('multi-widths') || 'equal');
    var units = (mode === 'individual') ? readIndividual(n) : equalUnits(total, n);
    var sum = units.reduce(function (a, b) { return a + b; }, 0);
    var err = null;
    if (mode === 'individual' && units.some(function (u) { return !(u > 0); })) err = 'Enter a width for every unit.';
    var bad = units.filter(function (u) { return u > 0 && (u < UNIT_MIN || u > UNIT_MAX); });
    if (!err && bad.length) err = (mode === 'individual')
      ? 'Each unit must be between ' + UNIT_MIN + ' and ' + UNIT_MAX + ' mm (a standard sash).'
      : 'Each unit must be between ' + UNIT_MIN + ' and ' + UNIT_MAX + ' mm (a standard sash) — ' + n + ' units allow up to ' + (n * UNIT_MAX) + ' mm overall. Change the overall width or the number of units.';
    return { units: units, error: err, total: total, sum: sum, n: n, mode: mode };
  }

  // ── Width list / max: extended to N × 1500 while a run is active, restored after ──
  function extendWidthList(maxW) {
    var sel = $('width-select'), inp = $('width');
    if (!sel || !inp) return;
    if (!runActive) { savedMax = inp.max; runActive = true; }
    inp.max = String(maxW);
    // Extra entries above 3000 (the list's own top), created once, shown up to maxW
    var have = sel.querySelectorAll('option[data-multi]').length;
    if (!have) {
      var frag = document.createDocumentFragment();
      for (var v = 3000 + LIST_STEP; v <= 6 * UNIT_MAX; v += LIST_STEP) {
        var o = document.createElement('option');
        o.value = String(v); o.textContent = v + ' mm'; o.setAttribute('data-multi', '1');
        frag.appendChild(o);
      }
      sel.appendChild(frag);
    }
    sel.querySelectorAll('option').forEach(function (opt) {
      if (opt.value === 'custom' || opt.value === '0') return;
      var v = parseInt(opt.value, 10);
      opt.style.display = (v >= UNIT_MIN && v <= maxW) ? '' : 'none';
    });
    var note = $('multi-width-max-note'); if (note) note.textContent = String(maxW);
  }
  function restoreWidthList() {
    var sel = $('width-select'), inp = $('width');
    if (!runActive || !sel || !inp) return;
    runActive = false;
    var max = parseInt(savedMax, 10) || 3000;
    inp.max = String(max);
    sel.querySelectorAll('option').forEach(function (opt) {
      if (opt.value === 'custom' || opt.value === '0') return;
      var v = parseInt(opt.value, 10);
      if (opt.hasAttribute('data-multi')) opt.style.display = 'none';
      else if (v > max) opt.style.display = 'none';
    });
    // A run width wider than a single sash allows: clamp through the dimension handler's own blur rule
    if (overallWidth() > max) {
      inp.value = String(max);
      inp.dispatchEvent(new Event('blur'));
    }
  }

  // Pick a width from the list through the dimension handler (its select handler updates the
  // input, the config, the 3D and the price; our capture listener then re-splits the units).
  function setOverallWidth(mm) {
    var sel = $('width-select'), inp = $('width'); if (!sel || !inp) return false;
    lastTotal = mm;                                   // our own change — not the user editing the overall
    var opt = sel.querySelector('option[value="' + mm + '"]');
    if (opt) {
      sel.value = String(mm);
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    // Not in the list (e.g. 950 + 1230): show the custom box with the value and let the
    // dimension handler's own input rule take it (config, 3D, price)
    var wrap = sel.closest('.dimension-input-wrapper');
    if (wrap) wrap.classList.add('custom-mode');
    inp.style.display = 'block';
    sel.value = 'custom';
    inp.value = String(mm);
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }
  var lastTotal = null;                               // overall width at the last apply (detects the user editing it)
  // Keep the overall width sensible for the chosen unit count: n × 1000 when it is out of range
  // (a 1000 mm single-sash default would make 3 units of 333). Returns true when it changed it.
  function ensureWidthForUnits(n, softMin) {
    var total = overallWidth();
    var lo = n * (softMin || UNIT_MIN), hi = n * UNIT_MAX;
    if (total >= lo && total <= hi) return false;
    return setOverallWidth(n * 1000);
  }

  // ── Mode: the Special tile switches the layout UI on; the Sash Type radios hide (double forced) ──
  function applyLayoutUi() {
    var bay = isSpecial() && isBay();
    var t = $('multi-part-title'); if (t) t.textContent = bay ? 'Square bay — front and sides' : 'Multi-part run';
    var rw = $('multi-run-word'); if (rw) rw.textContent = bay ? 'front' : 'run';
    var ul = $('multi-units-label'); if (ul) ul.textContent = bay ? 'Front units' : 'Number of units';
    var jw = $('multi-joins-word'); if (jw) jw.textContent = bay ? 'front joins' : 'joins';
    var o1 = $('mu-1-option'); if (o1) o1.style.display = bay ? '' : 'none';
    var o5 = $('mu-5-option'); if (o5) o5.style.display = bay ? 'none' : '';
    var o6 = $('mu-6-option'); if (o6) o6.style.display = bay ? 'none' : '';
    var n = parseInt(checked('multi-units'), 10) || 2;
    if (bay && n > 4) setRadio('multi-units', '4');
    if (!bay && n < 2) setRadio('multi-units', '2');
    var bo = $('square-bay-options'); if (bo) bo.style.display = bay ? '' : 'none';
    var po = $('bay-pier-options'); if (po) po.style.display = (bay && checked('bay-corners') === 'piers') ? '' : 'none';
  }

  function applyMode() {
    var special = isSpecial();
    var ls = $('special-layout-section'), sts = $('sash-type-section');
    if (ls) ls.hidden = !special;
    if (sts) sts.classList.toggle('psw-special', special);
    applyLayoutUi();
    if (special) {
      var dbl = $('sash-double');
      if (dbl && !dbl.checked) {            // triple / arched → double: the sash-type handler sets limits + 3D
        dbl.checked = true;
        dbl.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (isMulti()) {
        extendWidthList(multiWidthMax());   // the n × 1000 entry must be in the list before it is picked
        if (ensureWidthForUnits(unitCount(), 800)) return;   // entering: a run of 2 × 1000, not 2 × 500 — apply() follows the width change
      }
    }
    apply();
  }

  // ── Apply: config → 3D → price → spec ──────────────────────────────────────
  function apply(opts) {
    opts = opts || {};
    var cfg = window.currentConfig;
    var section = $('multi-part-section');
    var multi = isMulti();
    if (section) section.hidden = !multi;
    if (multi) extendWidthList(multiWidthMax()); else restoreWidthList();
    if (multi && overallWidth() >= UNIT_MIN && ensureWidthForUnits(unitCount())) return;   // out of range for this count → n × 1000, apply() follows
    var hint = $('hint-product-range');
    if (hint && isSpecial()) hint.textContent = isBay() ? 'Special Layout · Square bay' : 'Special Layout · Multi-part run';
    applyLayoutUi();

    var note = $('multi-units-note');
    var units = null, covers = 'both', sillExt = 0;
    // A width below the sash minimum is a custom value still being typed ("9" of "9000"):
    // leave the run as it is — the dimension handler ignores such values too.
    if (multi && overallWidth() < UNIT_MIN) return;
    if (multi) {
      var r = computeUnits();
      if (r.mode === 'individual') {
        if (lastTotal !== null && r.total !== lastTotal) {
          // The user changed the OVERALL width while in individual mode: start again from an
          // equal split of the new width (the typed units no longer describe it).
          renderIndividualInputs(r.n, equalUnits(r.total, r.n));
          r = computeUnits();
        } else if (!r.error && r.sum !== r.total) {
          // The units were typed: the overall width follows their sum; apply() runs again
          // after the width change (capture listener), with sum === total.
          lastTotal = r.sum;
          if (setOverallWidth(r.sum)) return;
        }
      }
      lastTotal = r.total;
      // While the individual widths are wrong (empty, out of range) keep the run alive with an
      // equal split, so the 3D and the price do not flip to a single window on every keystroke.
      units = r.error ? (r.total > 0 ? equalUnits(r.total, r.n) : null) : r.units;
      covers = checked('multi-covers') || 'both';
      sillExt = parseInt(($('multi-sill-ext') || {}).value, 10) || 0;
      if (note) {
        if (r.error) { note.textContent = r.error + (units ? ' Showing an equal split until this is fixed.' : ''); note.style.color = '#b3261e'; }
        else {
          var joints = r.n - 1;
          note.textContent = (r.mode === 'equal' ? 'Each unit ' + r.units[0] + ' mm wide · ' : 'Overall width ' + r.total + ' mm · ') + joints + (joints === 1 ? ' join' : ' joins') + ', each with a 100 × 17 mm cover strip.';
          note.style.color = '';
        }
      }
    } else {
      lastTotal = null;
    }

    // Nothing changed (e.g. a width edit on a single window): leave the 3D and the price
    // alone — the dimension handler already recalculates, a second pass would only add churn.
    var bay = multi && isBay();
    var layoutKey = multi ? (bay ? 'square-bay' : 'multi-part') : null;
    var bayKeys = bay ? { baySideWidth: sideWidth(), bayCorners: checked('bay-corners') || 'posts', bayPierWidth: pierWidth(), bayLTrims: (checked('bay-ltrims') || 'yes') === 'yes' }
                      : { baySideWidth: null, bayCorners: null, bayPierWidth: null, bayLTrims: null };
    var key = JSON.stringify([units, multi ? covers : null, multi ? sillExt : 0, layoutKey, bayKeys]);
    var changed = (key !== lastKey) || (cfg && JSON.stringify(cfg.multiUnits || null) !== JSON.stringify(units));
    lastKey = key;
    if (cfg) {
      cfg.multiUnits = units;
      cfg.multiCovers = multi ? covers : null;
      cfg.multiSillExt = multi ? sillExt : 0;
      cfg.windowLayout = layoutKey;
      cfg.baySideWidth = bayKeys.baySideWidth;
      cfg.bayCorners = bayKeys.bayCorners;
      cfg.bayPierWidth = bayKeys.bayPierWidth;
      cfg.bayLTrims = bayKeys.bayLTrims;
    }
    refreshSpec(multi, units, covers, sillExt);
    if (!changed) return;

    // 3D — the run / bay renders from multiUnits (+ layout), a single window otherwise
    if (typeof window.update3D === 'function') {
      window.update3D({ multiUnits: units, multiCovers: covers, multiSillExt: sillExt, windowLayout: layoutKey,
        baySideWidth: bayKeys.baySideWidth || 700, bayCorners: bayKeys.bayCorners || 'posts', bayPierWidth: bayKeys.bayPierWidth || 150, bayLTrims: bayKeys.bayLTrims === null ? true : bayKeys.bayLTrims });
    }
    if (!opts.silentPrice) {
      if (window.configuratorCore && window.configuratorCore.isInitialized && typeof window.configuratorCore.updateAll === 'function') window.configuratorCore.updateAll();
      else if (typeof window.updatePrice === 'function') window.updatePrice();
    }
  }

  // Units are stored AS ENTERED; the spec always shows FRAME sizes (brick-to-brick adds
  // 150 to the run, shared equally), to match the Width line above it.
  function frameUnits(units) {
    var b2b = checked('measurement-type') === 'brick-to-brick';
    var extra = b2b ? 150 / units.length : 0;
    return units.map(function (u) { return Math.round(u + extra); });
  }
  function refreshSpec(multi, units, covers, sillExt) {
    var item = $('spec-multi-item'), val = $('spec-multi');
    if (!item || !val) return;
    if (!multi || !units) { item.style.display = 'none'; return; }
    var coversTxt = covers === 'both' ? 'inside & outside' : covers === 'inside' ? 'inside only' : 'outside only';
    if (isBay()) {
      var corners = (checked('bay-corners') || 'posts') === 'piers'
        ? 'masonry piers ' + pierWidth() + ' mm (windows set behind)' + (((checked('bay-ltrims') || 'yes') === 'yes') ? ', L-trims inside' : '')
        : 'timber corner posts 120 mm';
      val.textContent = 'Square bay 90° · front ' + units.length + (units.length === 1 ? ' unit' : ' units') + ' (' + frameUnits(units).join(' / ') + ' mm) + 1 each side ' + sideWidth() + ' mm · '
        + corners + (units.length > 1 ? ' · front cover strips ' + coversTxt : '') + ' · continuous cill' + (sillExt ? ' +' + sillExt + ' mm each end' : '');
    } else {
      val.textContent = 'Multi-part run · ' + units.length + ' units (' + frameUnits(units).join(' / ') + ' mm) · cover strips ' + coversTxt
        + ' · continuous cill' + (sillExt ? ' +' + sillExt + ' mm each end' : '');
    }
    item.style.display = '';
  }

  // ── Restore from a saved config (edit-mode, localStorage) ──────────────────
  function applyFromConfig(fc) {
    fc = fc || window.currentConfig || {};
    var isBayCfg = fc.windowLayout === 'square-bay';
    var units = Array.isArray(fc.multiUnits) && fc.multiUnits.length >= (isBayCfg ? 1 : 2) ? fc.multiUnits.slice() : null;
    if (!units) {                                   // a plain sash: back to the Sash tile (same value, no page handler needed)
      var plain = $('type-sash'); if (plain && isSpecial()) plain.checked = true;
      applyMode(); return;
    }
    var tile = $('type-special'); if (tile) tile.checked = true;   // same value ("sash") as the tile edit-mode set — no change event needed
    setRadio('special-layout', isBayCfg ? 'square-bay' : 'multi');
    if (isBayCfg) {
      var sw = $('bay-side-width'); if (sw) sw.value = String(fc.baySideWidth || 700);
      setRadio('bay-corners', fc.bayCorners === 'piers' ? 'piers' : 'posts');
      var pw = $('bay-pier-width'); if (pw) pw.value = String(fc.bayPierWidth || 150);
      setRadio('bay-ltrims', fc.bayLTrims === false ? 'no' : 'yes');
    }
    applyLayoutUi();
    setRadio('multi-units', String(Math.min(isBayCfg ? 4 : 6, Math.max(isBayCfg ? 1 : 2, units.length))));
    var total = units.reduce(function (a, b) { return a + b; }, 0);
    var eq = equalUnits(total, units.length);
    var isEqual = units.every(function (u, i) { return u === eq[i]; });
    setRadio('multi-widths', isEqual ? 'equal' : 'individual');
    renderIndividualInputs(units.length, units);
    var box = $('multi-unit-widths'); if (box) box.style.display = isEqual ? 'none' : '';
    setRadio('multi-covers', fc.multiCovers || 'both');
    var se = $('multi-sill-ext'); if (se) se.value = String(fc.multiSillExt || 0);
    // The overall width is the units' sum: set it ourselves first (list extended for it), so the
    // mode switch finds it in range and never re-splits the restored units.
    extendWidthList(units.length * UNIT_MAX);
    if (overallWidth() !== total) setOverallWidth(total);
    applyMode();                                   // sections, width list/max, config
    // The saved split wins until the width is restored (edit-mode restores it right after this call)
    if (window.currentConfig) {
      window.currentConfig.multiUnits = units;
      window.currentConfig.multiCovers = fc.multiCovers || 'both';
      window.currentConfig.multiSillExt = fc.multiSillExt || 0;
      window.currentConfig.windowLayout = isBayCfg ? 'square-bay' : 'multi-part';
    }
    lastKey = null;                                 // the next apply() re-pushes the full state (bay keys included)
    lastTotal = total;                              // the restored width equals the units' sum (edit-mode sets it next)
    if (typeof window.update3D === 'function') window.update3D({ multiUnits: units, multiCovers: fc.multiCovers || 'both', multiSillExt: fc.multiSillExt || 0, windowLayout: isBayCfg ? 'square-bay' : 'multi-part',
      baySideWidth: fc.baySideWidth || 700, bayCorners: fc.bayCorners || 'posts', bayPierWidth: fc.bayPierWidth || 150, bayLTrims: fc.bayLTrims !== false });
    refreshSpec(true, units, fc.multiCovers || 'both', fc.multiSillExt || 0);
  }
  window.applyMultiPartFromConfig = applyFromConfig;
  window.getMultiPartConfig = function () {
    var c = window.currentConfig || {};
    return { multiUnits: c.multiUnits || null, multiCovers: c.multiCovers || null, multiSillExt: c.multiSillExt || 0, windowLayout: c.windowLayout || null,
      baySideWidth: c.baySideWidth || null, bayCorners: c.bayCorners || null, bayPierWidth: c.bayPierWidth || null, bayLTrims: c.bayLTrims == null ? null : c.bayLTrims };
  };

  // ── Wiring ─────────────────────────────────────────────────────────────────
  var pending = null;
  function schedule(fn) { clearTimeout(pending); pending = setTimeout(fn || apply, 120); }

  function init() {
    if (!$('multi-part-section') || !$('type-special')) return;
    document.querySelectorAll('input[name="multi-covers"], input[name="special-layout"]').forEach(function (r) {
      r.addEventListener('change', apply);
    });
    document.querySelectorAll('input[name="multi-units"]').forEach(function (r) {
      r.addEventListener('change', function () {
        var n = unitCount();
        renderIndividualInputs(n, (checked('multi-widths') === 'individual') ? equalUnits(overallWidth(), n) : null);
        apply();
      });
    });
    document.querySelectorAll('input[name="multi-widths"]').forEach(function (r) {
      r.addEventListener('change', function () {
        var box = $('multi-unit-widths'), n = unitCount();
        var individual = checked('multi-widths') === 'individual';
        if (individual) renderIndividualInputs(n, equalUnits(overallWidth(), n));
        if (box) box.style.display = individual ? '' : 'none';
        apply();
      });
    });
    var box = $('multi-unit-widths');
    if (box) box.addEventListener('input', function () { schedule(apply); });
    var se = $('multi-sill-ext'); if (se) se.addEventListener('change', apply);
    // Square bay inputs
    document.querySelectorAll('input[name="bay-corners"], input[name="bay-ltrims"]').forEach(function (r) { r.addEventListener('change', apply); });
    var bsw = $('bay-side-width'); if (bsw) { bsw.addEventListener('input', function () { schedule(apply); }); bsw.addEventListener('change', apply); }
    var bpw = $('bay-pier-width'); if (bpw) { bpw.addEventListener('input', function () { schedule(apply); }); bpw.addEventListener('change', apply); }

    // Window type (the Special tile included) switches the mode — after the page's own
    // window-type handlers have run (capture + delay). Overall width changes re-split the
    // units; sash-type changes may re-filter the width list (the double-sash handler).
    document.addEventListener('change', function (e) {
      var t = e.target; if (!t) return;
      if (t.name === 'window-type' || t.name === 'product-range') schedule(applyMode);
      else if (t.id === 'width-select' || t.id === 'width' || t.name === 'sash-type' || t.name === 'measurement-type') schedule(apply);
    }, true);
    document.addEventListener('input', function (e) { if (e.target && e.target.id === 'width') schedule(apply); }, true);

    // Restore a run saved in this browser (configurator-core restores currentConfig first)
    setTimeout(function () {
      var c = window.currentConfig;
      if (c && Array.isArray(c.multiUnits) && c.multiUnits.length >= (c.windowLayout === 'square-bay' ? 1 : 2)) applyFromConfig(c);
    }, 300);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
