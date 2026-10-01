/**
 * multi-part-controller.js — several sash units coupled in ONE straight run (owner, 01.10.2026)
 *
 * Owns the "Arrangement" block of the sash Dimensions section and three config keys:
 *   currentConfig.multiUnits   — unit widths (mm) AS ENTERED, sum = the entered overall width;
 *                                null = single window. Brick-to-brick: the run's +150 frame
 *                                allowance is shared equally by the 3D, the price and the spec.
 *   currentConfig.multiCovers  — 'both' | 'outside' | 'inside'  (150 × 17 cover strips on the joins)
 *   currentConfig.multiSillExt — continuous cill extension at each end (mm)
 *
 * Everything else about the run (glass, bars, colour, hardware, opening) is the ordinary
 * sash configuration — the run is an assembly of standard units, not a new product.
 * Reads the DOM, writes the three keys, pushes them to the 3D and asks for a price
 * recalculation. It never touches other controllers' fields.
 *
 * REMOVAL: delete the <script> line and the #multi-part-section block; the 3D, the
 * calculator and the renderer all treat a missing multiUnits as a single window.
 */
(function () {
  'use strict';

  var SINGLE_WIDTH_MAX = 3000;   // #width max for a single sash (HTML attribute)
  var MULTI_WIDTH_MAX = 6000;    // overall width of a run
  var UNIT_MIN = 400, UNIT_MAX = 3000;   // one unit = one standard sash
  var lastKey = null;                    // last applied [units, covers, sillExt] — skips no-op re-applies

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
  // Double-hung only (this release): a triple or an arched sash cannot be a run.
  function runCapable() { return (checked('sash-type') || 'double') === 'double'; }
  function isMulti() { return checked('sash-arrangement') === 'multi' && runCapable(); }
  function unitCount() { return Math.min(6, Math.max(2, parseInt(checked('multi-units'), 10) || 2)); }

  // Equal split that still sums exactly to the overall width (last unit takes the remainder)
  function equalUnits(total, n) {
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
  function computeUnits() {
    var total = overallWidth(), n = unitCount();
    if (!(total > 0)) return { units: null, error: 'Enter the overall width first.' };
    var mode = checked('multi-widths') || 'equal';
    var units = (mode === 'individual') ? readIndividual(n) : equalUnits(total, n);
    var sum = units.reduce(function (a, b) { return a + b; }, 0);
    var err = null;
    if (mode === 'individual') {
      if (units.some(function (u) { return !(u > 0); })) err = 'Enter a width for every unit.';
      else if (sum !== total) err = 'Unit widths add up to ' + sum + ' mm — they must equal the overall width of ' + total + ' mm.';
    }
    var bad = units.filter(function (u) { return u > 0 && (u < UNIT_MIN || u > UNIT_MAX); });
    if (!err && bad.length) err = 'Each unit must be between ' + UNIT_MIN + ' and ' + UNIT_MAX + ' mm (a standard sash). Change the overall width or the number of units.';
    return { units: units, error: err, total: total, n: n, mode: mode };
  }

  // ── Apply: config → 3D → price → spec ──────────────────────────────────────
  function apply(opts) {
    opts = opts || {};
    var cfg = window.currentConfig;
    var section = $('multi-part-section'), options = $('multi-part-options'), widthInp = $('width');
    if (section) section.hidden = !runCapable();       // triple / arched sash cannot be a run (this release)
    var multi = isMulti();
    if (options) options.style.display = multi ? '' : 'none';
    if (widthInp) widthInp.max = String(multi ? MULTI_WIDTH_MAX : SINGLE_WIDTH_MAX);

    var note = $('multi-units-note');
    var units = null, covers = 'both', sillExt = 0;
    if (multi) {
      var r = computeUnits();
      // While the individual widths are wrong (typing, bad sum) keep the run alive with an
      // equal split, so the 3D and the price do not flip to a single window on every keystroke.
      units = r.error ? (r.total > 0 ? equalUnits(r.total, r.n) : null) : r.units;
      covers = checked('multi-covers') || 'both';
      sillExt = parseInt(($('multi-sill-ext') || {}).value, 10) || 0;
      if (note) {
        if (r.error) { note.textContent = r.error + (units ? ' Showing an equal split until this is fixed.' : ''); note.style.color = '#b3261e'; }
        else {
          var joints = r.n - 1;
          note.textContent = (r.mode === 'equal' ? 'Each unit ' + r.units[0] + ' mm wide · ' : '') + joints + (joints === 1 ? ' join' : ' joins') + ', each with a 150 × 17 mm cover strip.';
          note.style.color = '';
        }
      }
    }

    // Nothing changed (e.g. a width edit on a single window): leave the 3D and the price
    // alone — the dimension handler already recalculates, a second pass would only add churn.
    var key = JSON.stringify([units, multi ? covers : null, multi ? sillExt : 0]);
    var changed = (key !== lastKey) || (cfg && JSON.stringify(cfg.multiUnits || null) !== JSON.stringify(units));
    lastKey = key;
    if (cfg) {
      cfg.multiUnits = units;
      cfg.multiCovers = multi ? covers : null;
      cfg.multiSillExt = multi ? sillExt : 0;
      cfg.multiArrangement = multi ? 'multi' : 'single';
    }
    refreshSpec(multi, units, covers, sillExt);
    if (!changed) return;

    // 3D — the run renders when multiUnits has 2+ entries, a single window otherwise
    if (typeof window.update3D === 'function') {
      window.update3D({ multiUnits: units, multiCovers: covers, multiSillExt: sillExt });
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
    val.textContent = 'Multi-part run · ' + units.length + ' units (' + frameUnits(units).join(' / ') + ' mm) · cover strips ' + coversTxt
      + ' · continuous cill' + (sillExt ? ' +' + sillExt + ' mm each end' : '');
    item.style.display = '';
  }

  // ── Restore from a saved config (edit-mode, localStorage) ──────────────────
  function applyFromConfig(fc) {
    fc = fc || window.currentConfig || {};
    var units = Array.isArray(fc.multiUnits) && fc.multiUnits.length >= 2 ? fc.multiUnits.slice() : null;
    setRadio('sash-arrangement', units ? 'multi' : 'single');
    if (!units) { apply({ silentPrice: true }); return; }   // a single window: clear any run left in currentConfig / 3D
    if (units) {
      setRadio('multi-units', String(Math.min(6, Math.max(2, units.length))));
      var total = units.reduce(function (a, b) { return a + b; }, 0);
      var eq = equalUnits(total, units.length);
      var isEqual = units.every(function (u, i) { return u === eq[i]; });
      setRadio('multi-widths', isEqual ? 'equal' : 'individual');
      renderIndividualInputs(units.length, units);
      var box = $('multi-unit-widths'); if (box) box.style.display = isEqual ? 'none' : '';
      setRadio('multi-covers', fc.multiCovers || 'both');
      var se = $('multi-sill-ext'); if (se) se.value = String(fc.multiSillExt || 0);
      var w = $('width'); if (w) w.max = String(MULTI_WIDTH_MAX);   // before the width is restored
      if (window.currentConfig) {
        window.currentConfig.multiUnits = units;
        window.currentConfig.multiCovers = fc.multiCovers || 'both';
        window.currentConfig.multiSillExt = fc.multiSillExt || 0;
      }
      if (typeof window.update3D === 'function') window.update3D({ multiUnits: units, multiCovers: fc.multiCovers || 'both', multiSillExt: fc.multiSillExt || 0 });
      refreshSpec(true, units, fc.multiCovers || 'both', fc.multiSillExt || 0);
      var options = $('multi-part-options'); if (options) options.style.display = '';
    }
  }
  window.applyMultiPartFromConfig = applyFromConfig;
  window.getMultiPartConfig = function () {
    var c = window.currentConfig || {};
    return { multiUnits: c.multiUnits || null, multiCovers: c.multiCovers || null, multiSillExt: c.multiSillExt || 0 };
  };

  // ── Wiring ─────────────────────────────────────────────────────────────────
  var pending = null;
  function schedule() { clearTimeout(pending); pending = setTimeout(apply, 120); }

  function init() {
    if (!$('multi-part-section')) return;
    document.querySelectorAll('input[name="sash-arrangement"], input[name="multi-covers"]').forEach(function (r) {
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
    if (box) box.addEventListener('input', schedule);
    var se = $('multi-sill-ext'); if (se) se.addEventListener('change', apply);
    // ("Reset all settings" clears localStorage and reloads the page — nothing to do here.)

    // Overall width changes (select or custom input) re-split the units; sash type
    // changes may hide the block (arched). Capture phase so it also sees DimensionHandler's inputs.
    document.addEventListener('change', function (e) {
      var t = e.target; if (!t) return;
      if (t.id === 'width-select' || t.id === 'width' || t.name === 'sash-type' || t.name === 'measurement-type') schedule();
    }, true);
    document.addEventListener('input', function (e) { if (e.target && e.target.id === 'width') schedule(); }, true);

    // Restore a run saved in this browser (configurator-core restores currentConfig first)
    setTimeout(function () {
      var c = window.currentConfig;
      if (c && Array.isArray(c.multiUnits) && c.multiUnits.length >= 2) applyFromConfig(c);
    }, 300);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
