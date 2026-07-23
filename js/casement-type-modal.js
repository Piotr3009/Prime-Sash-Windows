// casement-type-modal.js
// Lights-count pills + full-screen type picker modal for casement layouts.
// Mechanism: the existing radio inputs (name="casement-layout") stay in the DOM
// and remain the single source of truth. The legacy thumbnail grid is only
// HIDDEN (not removed); the modal simply checks a radio and dispatches
// 'change', so every existing listener (3D, dimensions, pricing, spec, save,
// edit-mode) keeps working untouched.

(function () {
  'use strict';

  var WRAP_ID = 'casement-standard-layouts';

  // ─── Parse a thumbnail SVG string: count full-height navy mullions ───
  // lights = vertical dividers + 1. Frame is a <rect>; mullions are <line>
  // elements with stroke #0a1628 where x1 === x2 spanning most of the height.
  function lightsFromSvg(svgHtml) {
    var mullions = 0;
    var re = /<line\b[^>]*>/g;
    var m;
    while ((m = re.exec(svgHtml)) !== null) {
      var tag = m[0];
      if (tag.indexOf('#0a1628') === -1) continue;
      var x1 = parseFloat(attr(tag, 'x1'));
      var x2 = parseFloat(attr(tag, 'x2'));
      var y1 = parseFloat(attr(tag, 'y1'));
      var y2 = parseFloat(attr(tag, 'y2'));
      if (isNaN(x1) || isNaN(x2) || isNaN(y1) || isNaN(y2)) continue;
      if (Math.abs(x1 - x2) < 0.01 && Math.abs(y2 - y1) >= 40) mullions++;
    }
    return mullions + 1;
  }

  function attr(tag, name) {
    var r = new RegExp(name + '="([^"]*)"');
    var mm = tag.match(r);
    return mm ? mm[1] : '';
  }

  // ─── Collect layout entries from the existing radios ───
  function collectEntries(wrap) {
    var entries = [];
    wrap.querySelectorAll('input[name="casement-layout"]').forEach(function (radio) {
      var label = radio.closest('label');
      var thumb = label ? label.querySelector('.layout-thumb') : null;
      if (!thumb) return;
      var svgHtml = thumb.innerHTML;
      entries.push({
        code: radio.value,
        radio: radio,
        svgHtml: svgHtml,
        lights: lightsFromSvg(svgHtml)
      });
    });
    return entries;
  }

  // ─── Styles (injected once) ───
  function injectStyles() {
    if (document.getElementById('ctm-styles')) return;
    var css = ''
      + '.ctm-panel{margin-bottom:12px;}'
      + '.ctm-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px;}'
      + '.ctm-lbl{font-size:13px;color:#555;font-family:Jost,sans-serif;}'
      + '.ctm-pill{font-family:Jost,sans-serif;font-size:13px;padding:6px 14px;border:1px solid #ccc;background:#fff;color:#444;border-radius:16px;cursor:pointer;line-height:1;}.ctm-segrow{display:flex;gap:8px;margin:6px 0 12px;}.ctm-seg{flex:1;cursor:pointer;text-align:center;padding:8px 0 7px;border-radius:4px;background:#fff;color:#333;border:1px solid #ddd;font-family:Jost,sans-serif;}.ctm-seg:hover{border-color:#0A1628;}.ctm-seg.active{background:#0A1628;color:#fff;border-color:#0A1628;}.ctm-seg svg{display:block;margin:0 auto 3px;}.ctm-seg span{font-size:13px;}.ctm-seg.active span{font-weight:600;}'
      + '.ctm-pill:hover{border-color:#0A1628;color:#0A1628;}'
      + '.ctm-pill.active{background:#0A1628;color:#fff;border-color:#0A1628;}'
      + '.ctm-sel{display:flex;align-items:center;gap:12px;border:1px solid #ddd;border-radius:6px;padding:8px 10px;margin-bottom:10px;background:#fff;}'
      + '.ctm-sel .ctm-thumb svg{display:block;}'
      + '.ctm-sel-code{font-family:Jost,sans-serif;font-size:13px;font-weight:600;color:#0A1628;}'
      + '.ctm-sel-sub{font-family:Jost,sans-serif;font-size:12px;color:#888;}'
      + '.ctm-open-btn{font-family:Jost,sans-serif;font-size:13px;letter-spacing:.05em;width:100%;padding:10px 12px;background:#0A1628;color:#fff;border:none;border-radius:4px;cursor:pointer;}'
      + '.ctm-open-btn:hover{background:#132441;}'
      + '.ctm-overlay{display:none;position:fixed;inset:0;background:rgba(10,22,40,.55);z-index:3000;align-items:center;justify-content:center;padding:20px;}'
      + '.ctm-overlay.open{display:flex;}'
      + '.ctm-modal{background:#fff;border-radius:8px;max-width:1000px;width:100%;max-height:92vh;display:flex;flex-direction:column;overflow:hidden;}'
      + '.ctm-head{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #eee;cursor:grab;user-select:none;touch-action:none;}.ctm-head.dragging{cursor:grabbing;}'
      + '.ctm-title{font-family:Jost,sans-serif;font-size:15px;font-weight:600;color:#0A1628;margin:0;}'
      + '.ctm-count{font-family:Jost,sans-serif;font-size:12px;color:#888;margin:2px 0 0;}'
      + '.ctm-close{background:#0A1628;border:none;font-size:20px;line-height:1;color:#fff;cursor:pointer;width:38px;height:38px;border-radius:50%;flex:none;}'
      + '.ctm-close:hover{background:#c0392b;}'
      + '.ctm-grid{padding:16px 18px;overflow-y:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(185px,1fr));gap:14px;}'
      + '.ctm-card{border:1px solid #ddd;border-radius:6px;padding:12px 8px;text-align:center;cursor:pointer;background:#fff;}'
      + '.ctm-card:hover{border-color:#0A1628;}'
      + '.ctm-card.sel{border:2px solid #0A1628;padding:11px 7px;}'
      + '.ctm-card svg{display:block;margin:0 auto;}'
      + '.ctm-card-code{font-family:Jost,sans-serif;font-size:16px;font-weight:600;color:#0A1628;margin-top:6px;}.ctm-card-sub{font-family:Jost,sans-serif;font-size:11px;color:#999;margin-top:1px;}.ctm-card-badge{display:inline-block;font-family:Jost,sans-serif;font-size:11px;letter-spacing:.04em;background:#0A1628;color:#fff;border-radius:10px;padding:3px 10px;margin-top:6px;}.ctm-step2{padding:18px;display:none;flex-direction:column;align-items:center;gap:12px;overflow-y:auto;}.ctm-step2.open{display:flex;}.ctm-hint{font-family:Jost,sans-serif;font-size:13px;color:#555;background:#fff8e6;border:1px solid #f0d9a0;border-radius:4px;padding:8px 14px;text-align:center;}.ctm-pane{cursor:pointer;}.ctm-pane rect{transition:fill .12s;}.ctm-pane:hover rect{fill:#eef2f8;}.ctm-step2-btns{display:flex;gap:10px;}.ctm-btn2{font-family:Jost,sans-serif;font-size:13px;padding:9px 22px;border-radius:4px;cursor:pointer;border:1px solid #ccc;background:#fff;color:#444;}.ctm-btn2:hover{border-color:#0A1628;color:#0A1628;}.ctm-btn2.primary{background:#0A1628;color:#fff;border-color:#0A1628;}.ctm-btn2.primary:hover{background:#132441;}'
      + '@media (max-width:600px){.ctm-modal{max-height:96vh;}.ctm-grid{grid-template-columns:repeat(auto-fill,minmax(145px,1fr));}}';
    var st = document.createElement('style');
    st.id = 'ctm-styles';
    st.textContent = css;
    document.head.appendChild(st);
  }

  // ─── Module state ───
  var entries = [];
  var filterLights = null;
  var hinges022 = null; // hinge states array — see step 2 (historic name)

  // Structural duplicates — same panel geometry, only default opening differed.
  // Opening is now chosen by clicking, so one card per structure is enough.
  // Codes stay fully functional underneath (old estimates, pricing, edit-mode).
  var HIDDEN_DUPLICATES = { '051L':1, '051R':1, '021L':1, '021R':1, '031L':1, '031R':1, '040R':1, '140R':1 };

  // Friendly names (only where the structure is unambiguous; others show the code)
  var DISPLAY_NAMES = {
    '040L': 'Single', '010T': 'Single Top-Hung', '040D': '2 Lights',
    '021': '1 Light + Fanlight', '022': '2 Lights + Fanlights',
    '052L': '2 Lights + Fan Left', '052R': '2 Lights + Fan Right',
    '133': '3 Lights + Fanlights',
    '140L': '4 Lights'
  }; // null = all, 1,2,3 exact, 4 = 4+
  var els = {};

  function checkedEntry() {
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].radio.checked) return entries[i];
    }
    return entries[0] || null;
  }

  function visibleEntries() {
    return entries.filter(function (e) { return !HIDDEN_DUPLICATES[e.code]; });
  }

  function lightsBuckets() {
    var present = {};
    visibleEntries().forEach(function (e) { present[e.lights >= 4 ? 4 : e.lights] = true; });
    return [1, 2, 3, 4].filter(function (b) { return present[b]; });
  }

  function matches(e) {
    if (filterLights === null) return true;
    if (filterLights === 4) return e.lights >= 4;
    return e.lights === filterLights;
  }

  function scaledSvg(svgHtml, width) {
    // Thumbnails carry fixed width/height attrs; swap for a uniform card size.
    return svgHtml
      .replace(/width="\d+"/, 'width="' + width + '"')
      .replace(/height="\d+"/, 'height="' + Math.round(width * 1.6) + '"');
  }

  // ─── Panel UI (lights pills + selected preview + open button) ───
  function buildPanel(wrap, legacyGrid) {
    var panel = document.createElement('div');
    panel.className = 'ctm-panel';
    panel.innerHTML = ''
      + '<div class="ctm-lbl" style="margin-bottom:2px;">Number of Lights <span style="color:#999;">(vertical panes)</span>:</div>'
      + '<div class="ctm-segrow" id="ctm-pills"></div>'
      + '<div class="ctm-sel">'
      + '  <div class="ctm-thumb" id="ctm-sel-thumb"></div>'
      + '  <div><div class="ctm-sel-code" id="ctm-sel-code"></div>'
      + '  <div class="ctm-sel-sub" id="ctm-sel-sub"></div></div>'
      + '</div>'
      + '<button type="button" class="ctm-open-btn" id="ctm-open">Choose window type</button>';
    legacyGrid.parentNode.insertBefore(panel, legacyGrid);
    legacyGrid.style.display = 'none'; // hidden, never removed

    els.pills = panel.querySelector('#ctm-pills');
    els.selThumb = panel.querySelector('#ctm-sel-thumb');
    els.selCode = panel.querySelector('#ctm-sel-code');
    els.selSub = panel.querySelector('#ctm-sel-sub');
    panel.querySelector('#ctm-open').addEventListener('click', function () { openModal(); });

    var pillWrap = els.pills;
    var buckets = lightsBuckets();
    buckets.forEach(function (b) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ctm-seg';
      btn.innerHTML = segGlyph(b) + '<span>' + (b === 4 ? '4+' : String(b)) + '</span>';
      btn.setAttribute('data-lights', b);
      btn.addEventListener('click', function () {
        filterLights = b;
        refreshPills();
        openModal();
      });
      pillWrap.appendChild(btn);
    });
  }

  // Mini window glyph with N vertical panes (stroke follows currentColor)
  function segGlyph(p) {
    var w = 34, h = 24;
    var out = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="30">';
    out += '<rect x="1.5" y="1.5" width="' + (w - 3) + '" height="' + (h - 3) + '" fill="none" stroke="currentColor" stroke-width="2"/>';
    for (var i = 1; i < p; i++) {
      var x = 1.5 + (w - 3) * i / p;
      out += '<line x1="' + x + '" y1="1.5" x2="' + x + '" y2="' + (h - 1.5) + '" stroke="currentColor" stroke-width="1.4"/>';
    }
    return out + '</svg>';
  }

  function refreshPills() {
    if (!els.pills) return;
    els.pills.querySelectorAll('.ctm-seg').forEach(function (p) {
      p.classList.toggle('active', parseInt(p.getAttribute('data-lights'), 10) === filterLights);
    });
  }

  function refreshPreview() {
    var e = checkedEntry();
    if (!e || !els.selThumb) return;
    els.selThumb.innerHTML = scaledSvg(e.svgHtml, 34);
    els.selCode.textContent = e.code;
    var openCount = (window.currentConfig && Array.isArray(window.currentConfig.casementHinges))
      ? window.currentConfig.casementHinges.filter(function (h) { return h === true || (typeof h === 'string' && h !== 'fixed'); }).length
      : null;
    els.selSub.textContent = (e.lights >= 4 ? '4+' : e.lights) + ' light' + (e.lights > 1 ? 's' : '')
      + (openCount !== null ? ' \u2022 ' + openCount + ' opening' : '');
    if (filterLights === null) {
      filterLights = e.lights >= 4 ? 4 : e.lights;
      refreshPills();
    }
  }

  // ─── Modal ───
  function buildModal() {
    var ov = document.createElement('div');
    ov.className = 'ctm-overlay';
    ov.id = 'ctm-overlay';
    ov.innerHTML = ''
      + '<div class="ctm-modal" role="dialog" aria-modal="true" aria-label="Choose window type">'
      + '  <div class="ctm-head">'
      + '    <div><p class="ctm-title">Choose window type</p><p class="ctm-count" id="ctm-count"></p></div>'
      + '    <button type="button" class="ctm-close" id="ctm-close" aria-label="Close">&times;</button>'
      + '  </div>'
      + '  <div class="ctm-grid" id="ctm-grid"></div>'
      + '  <div class="ctm-step2" id="ctm-step2"></div>'
      + '</div>';
    document.body.appendChild(ov);
    els.overlay = ov;
    els.grid = ov.querySelector('#ctm-grid');
    els.step2 = ov.querySelector('#ctm-step2');
    els.count = ov.querySelector('#ctm-count');
    ov.querySelector('#ctm-close').addEventListener('click', closeModal);
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && ov.classList.contains('open')) closeModal();
    });

    // Drag: grab the header and move the whole modal
    var box = ov.querySelector('.ctm-modal');
    var head = ov.querySelector('.ctm-head');
    var drag = null;
    head.addEventListener('pointerdown', function (ev) {
      if (ev.target.closest('.ctm-close')) return;
      var t = box.style.transform.match(/translate\((-?\d+(?:\.\d+)?)px,\s*(-?\d+(?:\.\d+)?)px\)/);
      drag = { sx: ev.clientX, sy: ev.clientY, ox: t ? parseFloat(t[1]) : 0, oy: t ? parseFloat(t[2]) : 0 };
      head.classList.add('dragging');
      head.setPointerCapture(ev.pointerId);
    });
    head.addEventListener('pointermove', function (ev) {
      if (!drag) return;
      box.style.transform = 'translate(' + (drag.ox + ev.clientX - drag.sx) + 'px, ' + (drag.oy + ev.clientY - drag.sy) + 'px)';
    });
    head.addEventListener('pointerup', function (ev) {
      drag = null;
      head.classList.remove('dragging');
      try { head.releasePointerCapture(ev.pointerId); } catch (e) {}
    });
  }

  function openModal() {
    els.step2.classList.remove('open');
    els.grid.style.display = '';
    renderGrid();
    var box = els.overlay.querySelector('.ctm-modal');
    box.style.transform = '';
    els.overlay.classList.add('open');
  }

  function closeModal() {
    els.overlay.classList.remove('open');
  }

  function renderGrid() {
    var current = checkedEntry();
    var list = visibleEntries().filter(matches);
    els.count.textContent = list.length + ' type' + (list.length !== 1 ? 's' : '')
      + (filterLights !== null ? ' \u2014 ' + (filterLights === 4 ? '4+' : filterLights) + ' light' + (filterLights !== 1 ? 's' : '') : '');
    els.grid.innerHTML = '';
    list.forEach(function (e) {
      var card = document.createElement('div');
      card.className = 'ctm-card' + (current && current.code === e.code ? ' sel' : '');
      var name = DISPLAY_NAMES[e.code] || e.code;
      card.innerHTML = scaledSvg(e.svgHtml, 118) + '<div class="ctm-card-code">' + name + '</div>'
        + (name !== e.code ? '<div class="ctm-card-sub">' + e.code + '</div>' : '')
        + '<div class="ctm-card-badge">Click \u2192 choose opening</div>';
      card.addEventListener('click', function () {
        openStep2(e.code);
      });
      els.grid.appendChild(card);
    });
  }

  // ─── Step 2: clickable openers — generic for every layout ───
  // hinges022 (historic name) = array of 'fixed'|'left'|'right'|'top', aligned to canonical def.panels order.
  var step2Code = null;
  var step2Def = null;

  function clearHinges() {
    hinges022 = null;
    if (window.currentConfig) window.currentConfig.casementHinges = null;
    if (typeof window.update3D === 'function') window.update3D({ casementHinges: null });
  }

  function currentGeometry(code) {
    if (typeof EstimateRenderer === 'undefined' || !EstimateRenderer.casementLayoutDef) return null;
    // Proportions: this layout's DEFAULT size — the width/height inputs still hold the
    // previous layout's dimensions at this point. Real inputs only when re-editing the
    // already-selected layout.
    var checkedE = checkedEntry();
    var useInputs = checkedE && checkedE.code === code;
    var dflt = (window.CASEMENT_LAYOUT_DEFAULTS && window.CASEMENT_LAYOUT_DEFAULTS[code]) || null;
    var w = useInputs ? (parseInt((document.getElementById('c-width') || {}).value) || (dflt ? dflt.w : 1200)) : (dflt ? dflt.w : 1200);
    var h = useInputs ? (parseInt((document.getElementById('c-height') || {}).value) || (dflt ? dflt.h : 1500)) : (dflt ? dflt.h : 1500);
    var innerW = w - 114, innerH = h - 125;
    var fanMm = parseInt((document.getElementById('c-fanlight-height') || {}).value) || Math.round(innerH * 0.3);
    var FR = Math.max(0.15, Math.min(0.5, fanMm / innerH));
    var def = EstimateRenderer.casementLayoutDef(code, innerW, innerH, h, FR);
    if (!def || !def.panels) return null;
    return { def: def, innerW: innerW, innerH: innerH };
  }

  function normalizeHinges(arr, def, code) {
    var H022 = ['top', 'top', 'left', 'right'];
    return def.panels.map(function (p, i) {
      var v = arr ? arr[i] : undefined;
      if (v === true) return code === '022' ? H022[i] : p.hinge;
      if (v === false) return 'fixed';
      if (v === 'fixed' || v === 'left' || v === 'right' || v === 'top') return v;
      return 'fixed'; // entering step 2: everything starts FIXED
    });
  }

  function openStep2(code) {
    var g = currentGeometry(code);
    if (!g) { // renderer unavailable — fall back to direct select
      var ent = entries.filter(function (x) { return x.code === code; })[0];
      if (ent) { clearHinges(); ent.radio.checked = true; ent.radio.dispatchEvent(new Event('change', { bubbles: true })); refreshPreview(); closeModal(); }
      return;
    }
    step2Code = code;
    step2Def = g;
    var checked = checkedEntry();
    var existing = (checked && checked.code === code && window.currentConfig) ? window.currentConfig.casementHinges : null;
    hinges022 = normalizeHinges(existing, g.def, code);
    els.grid.style.display = 'none';
    els.step2.classList.add('open');
    els.count.textContent = 'Type ' + code + ' — choose which panes open';
    renderStep2();
  }

  function renderStep2() {
    var g = step2Def, def = g.def;
    // Fit both axes: never wider than ~300px inner, never taller than ~420px — no towers
    var scale = Math.min(300 / g.innerW, 420 / g.innerH);
    var m = 20, fT = 12;
    var W = Math.round(g.innerW * scale) + 2 * m;
    var H = Math.round(g.innerH * scale) + 2 * m;
    var gcx = W / 2, gcy = H / 2;

    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" style="max-width:100%;height:auto;">';
    svg += '<rect x="' + (m - fT) + '" y="' + (m - fT) + '" width="' + (W - 2 * m + 2 * fT) + '" height="' + (H - 2 * m + 2 * fT) + '" fill="none" stroke="#0a1628" stroke-width="3"/>';

    (def.mullions || []).forEach(function (mu) {
      var mx = (typeof mu === 'number') ? mu : mu.x;
      var x = m + (mx - 57) * scale; // def mullion x includes FRAME_FACE(57)
      svg += '<line x1="' + x + '" y1="' + m + '" x2="' + x + '" y2="' + (H - m) + '" stroke="#0a1628" stroke-width="3"/>';
    });
    (def.transoms || []).forEach(function (tr) {
      var ty = (typeof tr === 'number') ? tr : tr.y;
      var y = H - m - (ty - 68) * scale; // def y measured from BOTTOM_FACE(68), SVG y down
      if (typeof tr === 'number' || tr.width === undefined) {
        svg += '<line x1="' + m + '" y1="' + y + '" x2="' + (W - m) + '" y2="' + y + '" stroke="#0a1628" stroke-width="3"/>';
      } else {
        var cx0 = m + (g.innerW / 2 + (tr.offsetX || 0)) * scale;
        svg += '<line x1="' + (cx0 - tr.width * scale / 2) + '" y1="' + y + '" x2="' + (cx0 + tr.width * scale / 2) + '" y2="' + y + '" stroke="#0a1628" stroke-width="3"/>';
      }
    });

    def.panels.forEach(function (p, i) {
      var px = gcx + (p.x - p.w / 2) * scale;
      var py = gcy - (p.y + p.h / 2) * scale;
      var pw = p.w * scale, ph = p.h * scale;
      var st = hinges022[i];
      var isFanRole = p.hinge === 'top';
      var open = st !== 'fixed';
      svg += '<g class="ctm-pane" data-i="' + i + '">';
      svg += '<rect x="' + px + '" y="' + py + '" width="' + pw + '" height="' + ph + '" fill="' + (open ? '#f6efe0' : '#fafafa') + '" stroke="#0a1628" stroke-width="2"/>';
      if (open) {
        var t = '';
        if (st === 'top') t = 'M ' + px + ' ' + py + ' L ' + (px + pw / 2) + ' ' + (py + ph) + ' L ' + (px + pw) + ' ' + py;
        if (st === 'left') t = 'M ' + (px + pw) + ' ' + py + ' L ' + px + ' ' + (py + ph / 2) + ' L ' + (px + pw) + ' ' + (py + ph);
        if (st === 'right') t = 'M ' + px + ' ' + py + ' L ' + (px + pw) + ' ' + (py + ph / 2) + ' L ' + px + ' ' + (py + ph);
        svg += '<path d="' + t + '" fill="none" stroke="#c8a24e" stroke-width="1.4" stroke-dasharray="6 4"/>';
      }
      var lbl = st === 'fixed' ? 'FIXED' : (st === 'top' ? 'OPENS' : (st === 'left' ? 'LEFT' : 'RIGHT'));
      var fs = Math.max(10, Math.min(14, pw / 6));
      svg += '<text x="' + (px + pw / 2) + '" y="' + (py + ph / 2 + fs * 0.35) + '" text-anchor="middle" font-family="Jost,sans-serif" font-size="' + fs + '" ' + (st === 'fixed' ? 'fill="#999"' : 'font-weight="600" fill="#8a6d1f"') + '>' + lbl + '</text>';
      void isFanRole;
      svg += '</g>';
    });
    svg += '</svg>';

    els.step2.innerHTML = ''
      + '<div class="ctm-hint">Click a pane to set its opening. Side panes cycle <strong>Fixed → Left hinge → Right hinge</strong>. Fanlights and top-hung panes toggle <strong>Fixed / Opens</strong>.</div>'
      + svg
      + '<div class="ctm-step2-btns">'
      + '  <button type="button" class="ctm-btn2" id="ctm-back">← Back</button>'
      + '  <button type="button" class="ctm-btn2 primary" id="ctm-apply">Apply</button>'
      + '</div>';

    els.step2.querySelectorAll('.ctm-pane').forEach(function (gEl) {
      gEl.addEventListener('click', function () {
        var i = parseInt(gEl.getAttribute('data-i'), 10);
        var role = step2Def.def.panels[i].hinge === 'top' ? 'fan' : 'side';
        var st = hinges022[i];
        if (role === 'fan') hinges022[i] = (st === 'fixed') ? 'top' : 'fixed';
        else hinges022[i] = (st === 'fixed') ? 'left' : (st === 'left' ? 'right' : 'fixed');
        renderStep2();
      });
    });
    els.step2.querySelector('#ctm-back').addEventListener('click', function () {
      els.step2.classList.remove('open');
      els.grid.style.display = '';
      renderGrid();
    });
    els.step2.querySelector('#ctm-apply').addEventListener('click', applyStep2);
  }

  function applyStep2() {
    var e = null;
    for (var i = 0; i < entries.length; i++) if (entries[i].code === step2Code) { e = entries[i]; break; }
    if (!e) return;
    window.currentConfig = window.currentConfig || {};
    window.currentConfig.casementHinges = hinges022.slice();
    if (typeof window.update3D === 'function') window.update3D({ casementHinges: hinges022.slice() });
    e.radio.checked = true;
    e.radio.dispatchEvent(new Event('change', { bubbles: true }));
    refreshPreview();
    closeModal();
  }

  // ─── Init ───
  function init() {
    var wrap = document.getElementById(WRAP_ID);
    if (!wrap) return;
    var legacyGrid = wrap.querySelector('.input-group');
    if (!legacyGrid) return;

    entries = collectEntries(wrap);
    if (entries.length === 0) return;

    injectStyles();
    buildPanel(wrap, legacyGrid);
    buildModal();
    refreshPreview();

    // Keep preview in sync with any external change (edit-mode setRadio dispatches 'change')
    document.addEventListener('change', function (ev) {
      if (ev.target && ev.target.name === 'casement-layout') refreshPreview();
    });
  }

  window.CasementTypeModal = {
    setHinges: function (arr) {
      hinges022 = Array.isArray(arr) ? arr.slice() : null;
      refreshPreview();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
