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
      + '.ctm-pill{font-family:Jost,sans-serif;font-size:13px;padding:6px 14px;border:1px solid #ccc;background:#fff;color:#444;border-radius:16px;cursor:pointer;line-height:1;}'
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
      + '.ctm-card-code{font-family:Jost,sans-serif;font-size:16px;font-weight:600;color:#0A1628;margin-top:6px;}.ctm-card-badge{display:inline-block;font-family:Jost,sans-serif;font-size:11px;letter-spacing:.04em;background:#0A1628;color:#fff;border-radius:10px;padding:3px 10px;margin-top:6px;}.ctm-step2{padding:18px;display:none;flex-direction:column;align-items:center;gap:12px;overflow-y:auto;}.ctm-step2.open{display:flex;}.ctm-hint{font-family:Jost,sans-serif;font-size:13px;color:#555;background:#fff8e6;border:1px solid #f0d9a0;border-radius:4px;padding:8px 14px;text-align:center;}.ctm-pane{cursor:pointer;}.ctm-pane rect{transition:fill .12s;}.ctm-pane:hover rect{fill:#eef2f8;}.ctm-step2-btns{display:flex;gap:10px;}.ctm-btn2{font-family:Jost,sans-serif;font-size:13px;padding:9px 22px;border-radius:4px;cursor:pointer;border:1px solid #ccc;background:#fff;color:#444;}.ctm-btn2:hover{border-color:#0A1628;color:#0A1628;}.ctm-btn2.primary{background:#0A1628;color:#fff;border-color:#0A1628;}.ctm-btn2.primary:hover{background:#132441;}'
      + '@media (max-width:600px){.ctm-modal{max-height:96vh;}.ctm-grid{grid-template-columns:repeat(auto-fill,minmax(145px,1fr));}}';
    var st = document.createElement('style');
    st.id = 'ctm-styles';
    st.textContent = css;
    document.head.appendChild(st);
  }

  // ─── Module state ───
  var entries = [];
  var filterLights = null;
  var hinges022 = null; // [fanL, fanR, bottomL, bottomR] — true = opens // null = all, 1,2,3 exact, 4 = 4+
  var els = {};

  function checkedEntry() {
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].radio.checked) return entries[i];
    }
    return entries[0] || null;
  }

  function lightsBuckets() {
    var present = {};
    entries.forEach(function (e) { present[e.lights >= 4 ? 4 : e.lights] = true; });
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
      + '<div class="ctm-row"><span class="ctm-lbl">Lights:</span><span id="ctm-pills"></span></div>'
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
      btn.className = 'ctm-pill';
      btn.textContent = b === 4 ? '4+' : String(b);
      btn.setAttribute('data-lights', b);
      btn.addEventListener('click', function () {
        filterLights = b;
        refreshPills();
        openModal();
      });
      pillWrap.appendChild(btn);
    });
  }

  function refreshPills() {
    if (!els.pills) return;
    els.pills.querySelectorAll('.ctm-pill').forEach(function (p) {
      p.classList.toggle('active', parseInt(p.getAttribute('data-lights'), 10) === filterLights);
    });
  }

  function refreshPreview() {
    var e = checkedEntry();
    if (!e || !els.selThumb) return;
    els.selThumb.innerHTML = scaledSvg(e.svgHtml, 34);
    els.selCode.textContent = e.code;
    els.selSub.textContent = (e.lights >= 4 ? '4+' : e.lights) + ' light' + (e.lights > 1 ? 's' : '')
      + (e.code === '022' && hinges022 ? ' \u2022 ' + hinges022.filter(Boolean).length + ' opening' : '');
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
    var list = entries.filter(matches);
    els.count.textContent = list.length + ' type' + (list.length !== 1 ? 's' : '')
      + (filterLights !== null ? ' \u2014 ' + (filterLights === 4 ? '4+' : filterLights) + ' light' + (filterLights !== 1 ? 's' : '') : '');
    els.grid.innerHTML = '';
    list.forEach(function (e) {
      var card = document.createElement('div');
      card.className = 'ctm-card' + (current && current.code === e.code ? ' sel' : '');
      card.innerHTML = scaledSvg(e.svgHtml, 118) + '<div class="ctm-card-code">' + e.code + '</div>'
        + (e.code === '022' ? '<div class="ctm-card-badge">Click \u2192 choose opening</div>' : '');
      card.addEventListener('click', function () {
        if (e.code === '022') { openStep2(); return; }
        // switching away from 022 clears custom openers
        clearHinges();
        e.radio.checked = true;
        e.radio.dispatchEvent(new Event('change', { bubbles: true }));
        refreshPreview();
        closeModal();
      });
      els.grid.appendChild(card);
    });
  }

  // ─── Step 2: 022 clickable openers ───
  function clearHinges() {
    hinges022 = null;
    if (window.currentConfig) window.currentConfig.casementHinges = null;
    if (typeof window.update3D === 'function') window.update3D({ casementHinges: null });
  }

  function openStep2() {
    if (!hinges022) hinges022 = [false, false, false, false]; // start: all FIXED
    els.grid.style.display = 'none';
    els.step2.classList.add('open');
    els.count.textContent = 'Type 022 \u2014 choose which panes open';
    renderStep2();
  }

  function renderStep2() {
    var W = 300, H = 340, m = 10, fT = 14;
    var ix = m + fT, iy = m + fT, iw = W - 2 * (m + fT), ih = H - 2 * (m + fT);
    var mullW = 10, half = (iw - mullW) / 2, fH = Math.round(ih * 0.3), mainH = ih - fH - mullW;
    var zones = [
      { x: ix, y: iy, w: half, h: fH, tent: 'top' },
      { x: ix + half + mullW, y: iy, w: half, h: fH, tent: 'top' },
      { x: ix, y: iy + fH + mullW, w: half, h: mainH, tent: 'left' },
      { x: ix + half + mullW, y: iy + fH + mullW, w: half, h: mainH, tent: 'right' }
    ];
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">';
    svg += '<rect x="' + m + '" y="' + m + '" width="' + (W - 2 * m) + '" height="' + (H - 2 * m) + '" fill="none" stroke="#0a1628" stroke-width="3"/>';
    zones.forEach(function (z, i) {
      var open = hinges022[i];
      svg += '<g class="ctm-pane" data-i="' + i + '">';
      svg += '<rect x="' + z.x + '" y="' + z.y + '" width="' + z.w + '" height="' + z.h + '" fill="' + (open ? '#f6efe0' : '#fafafa') + '" stroke="#0a1628" stroke-width="2"/>';
      if (open) {
        var t = '';
        if (z.tent === 'top') t = 'M ' + z.x + ' ' + z.y + ' L ' + (z.x + z.w / 2) + ' ' + (z.y + z.h) + ' L ' + (z.x + z.w) + ' ' + z.y;
        if (z.tent === 'left') t = 'M ' + (z.x + z.w) + ' ' + z.y + ' L ' + z.x + ' ' + (z.y + z.h / 2) + ' L ' + (z.x + z.w) + ' ' + (z.y + z.h);
        if (z.tent === 'right') t = 'M ' + z.x + ' ' + z.y + ' L ' + (z.x + z.w) + ' ' + (z.y + z.h / 2) + ' L ' + z.x + ' ' + (z.y + z.h);
        svg += '<path d="' + t + '" fill="none" stroke="#c8a24e" stroke-width="1.4" stroke-dasharray="6 4"/>';
        svg += '<text x="' + (z.x + z.w / 2) + '" y="' + (z.y + z.h / 2 + 5) + '" text-anchor="middle" font-family="Jost,sans-serif" font-size="14" font-weight="600" fill="#8a6d1f">OPENS</text>';
      } else {
        svg += '<text x="' + (z.x + z.w / 2) + '" y="' + (z.y + z.h / 2 + 5) + '" text-anchor="middle" font-family="Jost,sans-serif" font-size="13" fill="#999">FIXED</text>';
      }
      svg += '</g>';
    });
    svg += '</svg>';

    els.step2.innerHTML = ''
      + '<div class="ctm-hint">Click a pane to set it as <strong>opening</strong> or <strong>fixed</strong>. Fanlights open top-hung; bottom panes hinge left / right automatically.</div>'
      + svg
      + '<div class="ctm-step2-btns">'
      + '  <button type="button" class="ctm-btn2" id="ctm-back">\u2190 Back</button>'
      + '  <button type="button" class="ctm-btn2 primary" id="ctm-apply">Apply</button>'
      + '</div>';

    els.step2.querySelectorAll('.ctm-pane').forEach(function (g) {
      g.addEventListener('click', function () {
        var i = parseInt(g.getAttribute('data-i'), 10);
        hinges022[i] = !hinges022[i];
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
    for (var i = 0; i < entries.length; i++) if (entries[i].code === '022') { e = entries[i]; break; }
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
