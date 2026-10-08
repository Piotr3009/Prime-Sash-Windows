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
 *   · #multi-part-section (Dimensions): number of units (run 2–6, bay front 1–6), unit widths,
 *     cover strips, continuous cill; for the square bay also #square-bay-options: side window
 *     width (each side, frame size) and the timber corner posts — width × depth, 164 × 164 (the
 *     box depth) as standard, 164–400 mm (owner, 05.10.2026: masonry piers removed).
 *   · square bay limits (owner, 05.10.2026): up to 6 front units + 1 each side (8 windows);
 *     front + both sides ≤ 7000 mm, the corner posts come on top. The field being edited gives
 *     way: the front list stops at 7000 − 2 × side, the side stops at (7000 − front) / 2.
 *   · config keys for the bay: windowLayout 'square-bay', baySideWidth, bayPostWidth,
 *     bayPostDepth — null for a run / a single window.
 *   · the width list / max while a run is active: N × 2000 (one unit = one sash, max 2000 — owner,
 *     08.10.2026: was 1500, the standard single double-hung limit; raised for runs and bays).
 *   · three config keys:
 *       currentConfig.multiUnits   — unit widths (mm) AS ENTERED, sum = the entered overall width;
 *                                    null = single window. Brick-to-brick: the run's +150 allowance
 *                                    is shared equally by the 3D, the price and the spec.
 *       currentConfig.multiCovers  — 'both' | 'outside' | 'inside'  (100 × 17 cover strips on the
 *                                    joins and, in a square bay, at the corner posts)
 *       currentConfig.multiSillExt — continuous cill extension at each end (mm)
 *
 * It never touches other controllers' fields except the width list/max (restored on leaving).
 * REMOVAL: delete the <script> line, the #type-special tile and the two sections; the 3D, the
 * calculator and the renderer all treat a missing multiUnits as a single window.
 */
(function () {
  'use strict';

  var UNIT_MIN = 400, UNIT_MAX = 2000;   // one unit = one double-hung sash; max 2000 in runs and bays (owner, 08.10.2026 — was 1500)
  var UNIT_COUNT_MAX = 6;                // run 2–6 units; square-bay front 1–6 (+ 1 each side = 8 windows)
  var BAY_TOTAL_MAX = 7000;              // square bay: front + both sides, mm — the corner posts are extra
  var POST_MIN = 164, POST_MAX = 400, POST_DEFAULT = 164;   // corner post, mm: the box depth as standard, never smaller
  var LIST_STEP = 50;                    // extra width-list entries above 3000 (owner: pick from the list)
  var lastKey = null;                    // last applied [units, covers, sillExt] — skips no-op re-applies
  var runActive = false;                 // width list/max currently extended for a run
  var savedMax = null;                   // #width max before the run extended it
  var bayFront = null;                   // square bay: the front width last accepted — the sides get what it leaves of the 7 m

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
  function unitMaxCount() { return UNIT_COUNT_MAX; }
  function unitCount() { return Math.min(unitMaxCount(), Math.max(unitMin(), parseInt(checked('multi-units'), 10) || unitMin())); }
  // Square bay — side window: a sash of 400–2000 (UNIT_MAX) that also fits in what the accepted
  // front leaves of the 7 m. Before a front is accepted (entering the layout) the field rules.
  function sideCap() {
    if (bayFront === null) return UNIT_MAX;
    return Math.max(UNIT_MIN, Math.min(UNIT_MAX, Math.floor((BAY_TOTAL_MAX - bayFront) / 2)));
  }
  function sideTyped() { var v = parseInt(($('bay-side-width') || {}).value, 10); return (v > 0) ? v : 700; }
  function sideWidth() { return Math.min(sideCap(), Math.max(UNIT_MIN, sideTyped())); }
  // Square bay — timber corner posts: width (along the front) × depth (front to back)
  function postSize(id) { var v = parseInt(($(id) || {}).value, 10); return Math.min(POST_MAX, Math.max(POST_MIN, (v > 0) ? v : POST_DEFAULT)); }
  function postWidth() { return postSize('bay-post-width'); }
  function postDepth() { return postSize('bay-post-depth'); }
  // Overall-width limit: N × 2000 (6 units → 12 000); square-bay front: also what the sides leave of the 7 m
  function widthMaxFor(n) {
    var m = n * UNIT_MAX;
    return isBay() ? Math.min(m, BAY_TOTAL_MAX - 2 * sideWidth()) : m;
  }
  function multiWidthMax() { return widthMaxFor(unitCount()); }

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
    // Square bay: the typed units may not take the front past what the sides leave of the 7 m
    if (!err && mode === 'individual' && isBay() && sum > widthMaxFor(n)) {
      err = 'Front ' + sum + ' mm + both sides (2 × ' + sideWidth() + ' mm) is over ' + BAY_TOTAL_MAX + ' mm — with these sides the front can be up to ' + widthMaxFor(n) + ' mm.';
    }
    return { units: units, error: err, total: total, sum: sum, n: n, mode: mode };
  }

  // ── Width list / max: extended to N × 2000 while a run is active, restored after ──
  function extendWidthList(maxW) {
    var sel = $('width-select'), inp = $('width');
    if (!sel || !inp) return;
    if (!runActive) { savedMax = inp.max; runActive = true; }
    inp.max = String(maxW);
    // Extra entries above 3000 (the list's own top), created once, shown up to maxW
    var have = sel.querySelectorAll('option[data-multi]').length;
    if (!have) {
      var frag = document.createDocumentFragment();
      for (var v = 3000 + LIST_STEP; v <= UNIT_COUNT_MAX * UNIT_MAX; v += LIST_STEP) {
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
  // Square bay: the range also ends at what the sides leave of the 7 m (see widthMaxFor).
  function ensureWidthForUnits(n, softMin) {
    var total = overallWidth();
    var hi = widthMaxFor(n);
    var lo = Math.min(hi, n * (softMin || UNIT_MIN));
    if (total >= lo && total <= hi) return false;
    // A bay front that suits the unit count but not the 7 m: keep as much of it as the sides allow
    if (isBay() && total > hi && total <= n * UNIT_MAX) return setOverallWidth(Math.floor(hi / LIST_STEP) * LIST_STEP);
    var target = n * 1000;
    if (target > hi) target = Math.floor(hi / (n * LIST_STEP)) * n * LIST_STEP;   // bay: the widest n × (multiple of 50) that fits
    return setOverallWidth(target);
  }

  // ── Mode: the Special tile switches the layout UI on; the Sash Type radios hide (double forced) ──
  function applyLayoutUi() {
    var bay = isSpecial() && isBay();
    var t = $('multi-part-title'); if (t) t.textContent = bay ? 'Square bay — front and sides' : 'Multi-part run';
    var rw = $('multi-run-word'); if (rw) rw.textContent = bay ? 'front' : 'run';
    var wr = $('multi-width-rule'); if (wr) wr.textContent = bay
      ? '(' + UNIT_MAX + ' mm per unit; front + both sides up to ' + BAY_TOTAL_MAX + ' mm — the corner posts are extra)'
      : 'for the number of units chosen (' + UNIT_MAX + ' mm per unit)';
    var ul = $('multi-units-label'); if (ul) ul.textContent = bay ? 'Front units' : 'Number of units';
    var jw = $('multi-joins-word'); if (jw) jw.textContent = bay ? 'joins and corner posts' : 'joins';
    var o1 = $('mu-1-option'); if (o1) o1.style.display = bay ? '' : 'none';
    // 5 and 6 units: both layouts (owner, 05.10.2026 — the bay front was 1–4)
    var o5 = $('mu-5-option'); if (o5) o5.style.display = '';
    var o6 = $('mu-6-option'); if (o6) o6.style.display = '';
    var n = parseInt(checked('multi-units'), 10) || 2;
    if (!bay && n < 2) setRadio('multi-units', '2');
    var bo = $('square-bay-options'); if (bo) bo.style.display = bay ? '' : 'none';
  }

  // Square bay notes: projection, overall front (frame size, posts included), the 7 m check
  function refreshBayNotes(front) {
    var S = sideWidth(), W = postWidth(), D = postDepth();
    var b2b = checked('measurement-type') === 'brick-to-brick';
    var pn = $('bay-projection-note'); if (pn) pn.textContent = String(D + S);
    var fo = $('bay-front-overall-note'); if (fo) fo.textContent = String(front + (b2b ? 150 : 0) + 2 * W);
    var bsw = $('bay-side-width'); if (bsw) bsw.max = String(sideCap());
    var tn = $('bay-total-note');
    if (tn) {
      var cap = sideCap();
      var limited = sideTyped() > S;                 // the typed side does not fit beside this front
      // Whenever the front leaves less than a full UNIT_MAX for each side, say how much it leaves —
      // so a side that was cut back on leaving the field is explained (red while it is being typed)
      tn.textContent = 'Front ' + front + ' + sides 2 × ' + S + ' = ' + (front + 2 * S) + ' mm — up to ' + BAY_TOTAL_MAX + ' mm, the corner posts are extra.'
        + (cap < UNIT_MAX ? ' With this front the sides can be up to ' + cap + ' mm (reduce the front first for wider sides).' : '');
      tn.style.color = limited ? '#b3261e' : '';
    }
  }

  // restoring === true: a saved run / bay is being put back (applyFromConfig) — its width is kept
  // as saved; the "start at n × 1000" nudge is only for someone entering the layout by hand.
  function applyMode(restoring) {
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
        if (ensureWidthForUnits(unitCount(), restoring === true ? UNIT_MIN : 800)) return;   // entering: a run of 2 × 1000, not 2 × 500 — apply() follows the width change
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
    if (!(multi && isBay())) bayFront = null;        // not a bay (any more): the side field rules again
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
      if (isBay()) bayFront = r.total;               // accepted (in range): the sides get what is left of the 7 m
      // While the individual widths are wrong (empty, out of range) keep the run alive with an
      // equal split, so the 3D and the price do not flip to a single window on every keystroke.
      units = r.error ? (r.total > 0 ? equalUnits(r.total, r.n) : null) : r.units;
      covers = checked('multi-covers') || 'both';
      sillExt = parseInt(($('multi-sill-ext') || {}).value, 10) || 0;
      if (note) {
        if (r.error) { note.textContent = r.error + (units ? ' Showing an equal split until this is fixed.' : ''); note.style.color = '#b3261e'; }
        else {
          var joints = r.n - 1;
          var lead = (r.mode === 'equal')
            ? (r.n === 1 ? 'One unit ' : 'Each unit ') + r.units[0] + ' mm wide · '
            : 'Overall width ' + r.total + ' mm · ';
          note.textContent = isBay()
            ? lead + (joints ? joints + (joints === 1 ? ' join' : ' joins') + ' and ' : '') + '2 corner posts, each with 100 × 17 mm cover strips.'
            : lead + joints + (joints === 1 ? ' join' : ' joins') + ', each with a 100 × 17 mm cover strip.';
          note.style.color = '';
        }
      }
      if (isBay()) refreshBayNotes(r.total);
    } else {
      lastTotal = null;
    }

    // Nothing changed (e.g. a width edit on a single window): leave the 3D and the price
    // alone — the dimension handler already recalculates, a second pass would only add churn.
    var bay = multi && isBay();
    var layoutKey = multi ? (bay ? 'square-bay' : 'multi-part') : null;
    var bayKeys = bay ? { baySideWidth: sideWidth(), bayPostWidth: postWidth(), bayPostDepth: postDepth() }
                      : { baySideWidth: null, bayPostWidth: null, bayPostDepth: null };
    var key = JSON.stringify([units, multi ? covers : null, multi ? sillExt : 0, layoutKey, bayKeys]);
    var changed = (key !== lastKey) || (cfg && JSON.stringify(cfg.multiUnits || null) !== JSON.stringify(units));
    lastKey = key;
    if (cfg) {
      cfg.multiUnits = units;
      cfg.multiCovers = multi ? covers : null;
      cfg.multiSillExt = multi ? sillExt : 0;
      cfg.windowLayout = layoutKey;
      cfg.baySideWidth = bayKeys.baySideWidth;
      cfg.bayPostWidth = bayKeys.bayPostWidth;
      cfg.bayPostDepth = bayKeys.bayPostDepth;
      // masonry piers were removed (owner, 05.10.2026): drop their keys from a config restored from an older session
      delete cfg.bayCorners; delete cfg.bayPierWidth; delete cfg.bayLTrims;
    }
    refreshSpec(multi, units, covers, sillExt);
    if (!changed) return;

    // 3D — the run / bay renders from multiUnits (+ layout), a single window otherwise
    if (typeof window.update3D === 'function') {
      window.update3D({ multiUnits: units, multiCovers: covers, multiSillExt: sillExt, windowLayout: layoutKey,
        baySideWidth: bayKeys.baySideWidth || 700, bayPostWidth: bayKeys.bayPostWidth || POST_DEFAULT, bayPostDepth: bayKeys.bayPostDepth || POST_DEFAULT });
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
      val.textContent = 'Square bay 90° · front ' + units.length + (units.length === 1 ? ' unit' : ' units') + ' (' + frameUnits(units).join(' / ') + ' mm) + 1 each side ' + sideWidth() + ' mm · '
        + 'timber corner posts ' + postWidth() + ' × ' + postDepth() + ' mm · cover strips ' + coversTxt + ' on the ' + (units.length > 1 ? 'joins and ' : '') + 'posts'
        + ' · continuous cill' + (sillExt ? ' +' + sillExt + ' mm each end' : '');
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
    var total = units.reduce(function (a, b) { return a + b; }, 0);
    bayFront = null;                                // the saved side width is taken as saved (capped again once the front is in)
    if (isBayCfg) {
      var sw = $('bay-side-width'); if (sw) sw.value = String(fc.baySideWidth || 700);
      // post size: saved value, 164 × 164 for a bay saved before the size could be set
      var pw = $('bay-post-width'); if (pw) pw.value = String(fc.bayPostWidth || POST_DEFAULT);
      var pd = $('bay-post-depth'); if (pd) pd.value = String(fc.bayPostDepth || POST_DEFAULT);
    }
    applyLayoutUi();
    setRadio('multi-units', String(Math.min(UNIT_COUNT_MAX, Math.max(isBayCfg ? 1 : 2, units.length))));
    var eq = equalUnits(total, units.length);
    var isEqual = units.every(function (u, i) { return u === eq[i]; });
    setRadio('multi-widths', isEqual ? 'equal' : 'individual');
    renderIndividualInputs(units.length, units);
    var box = $('multi-unit-widths'); if (box) box.style.display = isEqual ? 'none' : '';
    setRadio('multi-covers', fc.multiCovers || 'both');
    var se = $('multi-sill-ext'); if (se) se.value = String(fc.multiSillExt || 0);
    // The overall width is the units' sum: set it ourselves first (list extended for it), so the
    // mode switch finds it in range and never re-splits the restored units.
    extendWidthList(multiWidthMax());
    if (overallWidth() !== total) setOverallWidth(total);
    applyMode(true);                               // sections, width list/max, config — the saved width stays
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
      baySideWidth: isBayCfg ? sideWidth() : 700, bayPostWidth: isBayCfg ? postWidth() : POST_DEFAULT, bayPostDepth: isBayCfg ? postDepth() : POST_DEFAULT });
    refreshSpec(true, units, fc.multiCovers || 'both', fc.multiSillExt || 0);
  }
  window.applyMultiPartFromConfig = applyFromConfig;
  window.getMultiPartConfig = function () {
    var c = window.currentConfig || {};
    return { multiUnits: c.multiUnits || null, multiCovers: c.multiCovers || null, multiSillExt: c.multiSillExt || 0, windowLayout: c.windowLayout || null,
      baySideWidth: c.baySideWidth || null, bayPostWidth: c.bayPostWidth || null, bayPostDepth: c.bayPostDepth || null };
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
    // Square bay inputs: live while typing; on leaving the field it shows the value actually used
    // (side: 400–2000 and what the front leaves of the 7 m; posts: 164–400)
    var bsw = $('bay-side-width');
    if (bsw) {
      bsw.addEventListener('input', function () { schedule(apply); });
      bsw.addEventListener('change', function () { bsw.value = String(sideWidth()); apply(); });
    }
    ['bay-post-width', 'bay-post-depth'].forEach(function (id) {
      var el = $(id); if (!el) return;
      el.addEventListener('input', function () { schedule(apply); });
      el.addEventListener('change', function () { el.value = String(postSize(id)); apply(); });
    });

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
