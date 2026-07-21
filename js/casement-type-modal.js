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
      + '.ctm-head{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #eee;}'
      + '.ctm-title{font-family:Jost,sans-serif;font-size:15px;font-weight:600;color:#0A1628;margin:0;}'
      + '.ctm-count{font-family:Jost,sans-serif;font-size:12px;color:#888;margin:2px 0 0;}'
      + '.ctm-close{background:none;border:none;font-size:22px;line-height:1;color:#666;cursor:pointer;padding:4px 8px;}'
      + '.ctm-close:hover{color:#0A1628;}'
      + '.ctm-grid{padding:16px 18px;overflow-y:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(185px,1fr));gap:14px;}'
      + '.ctm-card{border:1px solid #ddd;border-radius:6px;padding:12px 8px;text-align:center;cursor:pointer;background:#fff;}'
      + '.ctm-card:hover{border-color:#0A1628;}'
      + '.ctm-card.sel{border:2px solid #0A1628;padding:11px 7px;}'
      + '.ctm-card svg{display:block;margin:0 auto;}'
      + '.ctm-card-code{font-family:Jost,sans-serif;font-size:16px;font-weight:600;color:#0A1628;margin-top:6px;}'
      + '@media (max-width:600px){.ctm-modal{max-height:96vh;}.ctm-grid{grid-template-columns:repeat(auto-fill,minmax(145px,1fr));}}';
    var st = document.createElement('style');
    st.id = 'ctm-styles';
    st.textContent = css;
    document.head.appendChild(st);
  }

  // ─── Module state ───
  var entries = [];
  var filterLights = null; // null = all, 1,2,3 exact, 4 = 4+
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
    els.selSub.textContent = (e.lights >= 4 ? '4+' : e.lights) + ' light' + (e.lights > 1 ? 's' : '');
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
      + '</div>';
    document.body.appendChild(ov);
    els.overlay = ov;
    els.grid = ov.querySelector('#ctm-grid');
    els.count = ov.querySelector('#ctm-count');
    ov.querySelector('#ctm-close').addEventListener('click', closeModal);
    ov.addEventListener('click', function (ev) { if (ev.target === ov) closeModal(); });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && ov.classList.contains('open')) closeModal();
    });
  }

  function openModal() {
    renderGrid();
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
      card.innerHTML = scaledSvg(e.svgHtml, 118) + '<div class="ctm-card-code">' + e.code + '</div>';
      card.addEventListener('click', function () {
        e.radio.checked = true;
        e.radio.dispatchEvent(new Event('change', { bubbles: true }));
        refreshPreview();
        closeModal();
      });
      els.grid.appendChild(card);
    });
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
