// french-layout-picker.js
// Door Layout summary tile (tab 1) + full-screen picker for French Doors.
// Mechanism copied from casement-type-modal.js: the existing radio inputs
// (name="fd-door-side-panels") stay in the DOM and remain the single source
// of truth. The picker only checks a radio and dispatches 'change', so every
// existing listener (3D, pricing, spec, save, edit-mode) keeps working
// untouched. Nothing is removed or hidden.
// Stage 1: layout row only. Stage 2 will add a Transom row inside the same
// modal (placeholder kept in markup structure, not rendered yet).

(function () {
  'use strict';

  var RADIO_NAME = 'fd-door-side-panels';

  // ─── Layout definitions (value = existing radio value) ───
  var LAYOUTS = [
    { value: 'none',  label: 'French Doors',   svg: thumbSvg('none')  },
    { value: 'left',  label: '+ Left Panel',   svg: thumbSvg('left')  },
    { value: 'right', label: '+ Right Panel',  svg: thumbSvg('right') },
    { value: 'both',  label: '+ Both Panels',  svg: thumbSvg('both')  }
  ];

  var TRANSOM_RADIO = 'fd-transom-type';
  var TRANSOMS = [
    { value: 'none',    label: 'No Transom', svg: transomSvg('none')    },
    { value: 'fixed',   label: 'Fixed',      svg: transomSvg('fixed')   },
    { value: 'opening', label: 'Opening',    svg: transomSvg('opening') }
  ];
  var TRANSOM_ARCHED_GHOST = { label: 'Arched', svg: transomSvg('arched') };

  function transomSvg(kind) {
    var s = '<svg viewBox="0 0 60 72" fill="none" stroke="currentColor" stroke-width="2">';
    if (kind === 'none') {
      s += '<rect x="8" y="4" width="44" height="64"/><line x1="30" y1="4" x2="30" y2="68"/>';
    } else if (kind === 'arched') {
      s += '<path d="M8 68 L8 24 A22 20 0 0 1 52 24 L52 68 Z"/><path d="M12 23 A18 16 0 0 1 48 23"/>'
         + '<line x1="8" y1="27" x2="52" y2="27" stroke-width="3.5"/><line x1="30" y1="27" x2="30" y2="68"/>';
    } else {
      s += '<rect x="8" y="4" width="44" height="64"/><rect x="12" y="8" width="36" height="14"/>'
         + '<line x1="8" y1="26" x2="52" y2="26" stroke-width="3.5"/><line x1="30" y1="26" x2="30" y2="68"/>';
      if (kind === 'opening') {
        s += '<path d="M30 21 L14 9.5 M30 21 L46 9.5" stroke-dasharray="2.5 2.5" stroke-width="1.2"/>';
      }
    }
    return s + '</svg>';
  }

  function thumbSvg(kind) {
    var s = '<svg viewBox="0 0 60 72" fill="none" stroke="currentColor" stroke-width="2">';
    if (kind === 'none') {
      s += '<rect x="8" y="4" width="44" height="64"/><line x1="30" y1="4" x2="30" y2="68"/>'
         + '<rect x="12.5" y="8.5" width="13" height="42"/><rect x="34.5" y="8.5" width="13" height="42"/>';
    } else if (kind === 'left') {
      s += '<rect x="2" y="4" width="14" height="64"/><rect x="5" y="8.5" width="8" height="42"/>'
         + '<rect x="16" y="4" width="42" height="64"/><line x1="37" y1="4" x2="37" y2="68"/>'
         + '<rect x="20" y="8.5" width="13" height="42"/><rect x="41" y="8.5" width="13" height="42"/>';
    } else if (kind === 'right') {
      s += '<rect x="2" y="4" width="42" height="64"/><line x1="23" y1="4" x2="23" y2="68"/>'
         + '<rect x="6" y="8.5" width="13" height="42"/><rect x="27" y="8.5" width="13" height="42"/>'
         + '<rect x="44" y="4" width="14" height="64"/><rect x="47" y="8.5" width="8" height="42"/>';
    } else {
      s += '<rect x="2" y="4" width="11" height="64"/><rect x="4.5" y="8.5" width="6" height="42"/>'
         + '<rect x="13" y="4" width="34" height="64"/><line x1="30" y1="4" x2="30" y2="68"/>'
         + '<rect x="16" y="8.5" width="10" height="42"/><rect x="34" y="8.5" width="10" height="42"/>'
         + '<rect x="47" y="4" width="11" height="64"/><rect x="49.5" y="8.5" width="6" height="42"/>';
    }
    return s + '</svg>';
  }

  // ─── Helpers ───
  function getRadio(value) {
    return document.querySelector('input[name="' + RADIO_NAME + '"][value="' + value + '"]');
  }
  function currentValue() {
    var r = document.querySelector('input[name="' + RADIO_NAME + '"]:checked');
    return r ? r.value : 'none';
  }
  function layoutByValue(v) {
    for (var i = 0; i < LAYOUTS.length; i++) if (LAYOUTS[i].value === v) return LAYOUTS[i];
    return LAYOUTS[0];
  }
  function getTransomRadio(value) {
    return document.querySelector('input[name="' + TRANSOM_RADIO + '"][value="' + value + '"]');
  }
  function currentTransom() {
    var r = document.querySelector('input[name="' + TRANSOM_RADIO + '"]:checked');
    return r ? r.value : 'none';
  }
  function transomByValue(v) {
    for (var i = 0; i < TRANSOMS.length; i++) if (TRANSOMS[i].value === v) return TRANSOMS[i];
    return TRANSOMS[0];
  }
  function transomHeightVal() {
    var el = document.getElementById('fd-transom-height');
    var n = el ? parseInt(el.value, 10) : 450;
    return (n && n > 0) ? n : 450;
  }
  function isFrenchSelected() {
    var dt = document.querySelector('input[name="door-type"]:checked');
    var pr = document.querySelector('input[name="product-range"]:checked');
    return !!(dt && dt.value === 'french' && pr && pr.value === 'doors');
  }

  // ─── Styles (injected once) ───
  function injectStyles() {
    if (document.getElementById('flp-styles')) return;
    var css = ''
      + '#flp-section h3{margin-top:0;}'
      + '.flp-tile{background:#fff;border:1px solid rgba(10,22,40,.25);border-radius:4px;'
      + 'padding:10px;text-align:center;cursor:pointer;color:#0a1628;max-width:150px;'
      + 'transition:border-color .15s ease;}'
      + '.flp-tile:hover{border-color:#0a1628;}'
      + '.flp-tile svg{width:56px;height:66px;display:block;margin:0 auto;}'
      + '.flp-tile-label{font-family:"Jost",sans-serif;font-size:11px;color:#0a1628;margin:6px 0 0;}'
      + '.flp-tile-change{font-family:"Jost",sans-serif;font-size:10.5px;letter-spacing:.12em;'
      + 'text-transform:uppercase;color:#0a1628;margin:8px 0 0;border-top:1px solid #e3e0d6;padding-top:8px;}'
      + '.flp-overlay{display:none;position:fixed;inset:0;background:rgba(5,10,20,.6);'
      + 'z-index:3000;align-items:center;justify-content:center;padding:4vw;}'
      + '.flp-overlay.open{display:flex;}'
      + '.flp-modal{background:#fafaf8;border-radius:6px;padding:22px 24px;max-width:560px;'
      + 'width:100%;max-height:90vh;overflow:auto;position:relative;}'
      + '.flp-modal-title{font-family:"Jost",sans-serif;font-size:12px;letter-spacing:.16em;'
      + 'text-transform:uppercase;color:#0a1628;margin:0 0 16px;}'
      + '.flp-close{position:absolute;top:10px;right:14px;background:none;border:none;'
      + 'font-size:22px;line-height:1;color:#0a1628;cursor:pointer;padding:4px;}'
      + '.flp-grid{display:flex;flex-wrap:wrap;gap:10px;}'
      + '.flp-opt{background:#fff;border:1px solid rgba(10,22,40,.25);border-radius:4px;'
      + 'padding:10px 8px;text-align:center;cursor:pointer;color:#0a1628;width:104px;'
      + 'transition:border-color .15s ease;}'
      + '.flp-opt:hover{border-color:#0a1628;}'
      + '.flp-opt.selected{border:2px solid #0a1628;padding:9px 7px;}'
      + '.flp-opt svg{width:60px;height:70px;display:block;margin:0 auto;}'
      + '.flp-opt-label{font-family:"Jost",sans-serif;font-size:11px;color:#0a1628;margin:6px 0 0;}'
      + '.flp-opt.ghost{border:1px dashed #9E9E90;color:#9E9E90;cursor:default;}'
      + '.flp-opt.ghost:hover{border-color:#9E9E90;}'
      + '.flp-ghost-tag{font-family:"Jost",sans-serif;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#9E9E90;margin:2px 0 0;}'
      + '@media (max-width:600px){.flp-opt{width:calc(50% - 5px);}}';
    var st = document.createElement('style');
    st.id = 'flp-styles';
    st.textContent = css;
    document.head.appendChild(st);
  }

  // ─── Build summary tile (inside #flp-section placeholder in tab 1) ───
  function buildSection() {
    var host = document.getElementById('flp-section');
    if (!host || host.dataset.flpReady) return;
    host.dataset.flpReady = '1';

    host.innerHTML = ''
      + '<h3>Door Layout</h3>'
      + '<div class="input-group">'
      + '<div class="flp-tile" id="flp-tile" role="button" tabindex="0" aria-label="Change door layout">'
      + '<span id="flp-tile-svg"></span>'
      + '<p class="flp-tile-label" id="flp-tile-label"></p>'
      + '<p class="flp-tile-change">Change &rsaquo;</p>'
      + '</div>'
      + '</div>'
      + '<div class="input-group">'
      + '<div class="flp-tile" id="flp-transom-tile" role="button" tabindex="0" aria-label="Change transom">'
      + '<span id="flp-transom-tile-svg"></span>'
      + '<p class="flp-tile-label" id="flp-transom-tile-label"></p>'
      + '<p class="flp-tile-change">Change &rsaquo;</p>'
      + '</div>'
      + '</div>';

    var ttile = document.getElementById('flp-transom-tile');
    ttile.addEventListener('click', function () { openModal('transom'); });
    ttile.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal('transom'); }
    });

    var tile = document.getElementById('flp-tile');
    tile.addEventListener('click', openModal);
    tile.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(); }
    });
  }

  // ─── Build modal (once) ───
  function buildModal() {
    if (document.getElementById('flp-overlay')) return;

    var overlay = document.createElement('div');
    overlay.id = 'flp-overlay';
    overlay.className = 'flp-overlay';

    var opts = '';
    for (var i = 0; i < LAYOUTS.length; i++) {
      var L = LAYOUTS[i];
      opts += '<div class="flp-opt" data-value="' + L.value + '" role="button" tabindex="0">'
            + L.svg + '<p class="flp-opt-label">' + L.label + '</p></div>';
    }

    var topts = '';
    for (var j = 0; j < TRANSOMS.length; j++) {
      var T = TRANSOMS[j];
      topts += '<div class="flp-opt flp-transom-opt" data-value="' + T.value + '" role="button" tabindex="0">'
             + T.svg + '<p class="flp-opt-label">' + T.label + '</p></div>';
    }
    topts += '<div class="flp-opt ghost" aria-disabled="true">'
           + TRANSOM_ARCHED_GHOST.svg + '<p class="flp-opt-label" style="color:#9E9E90;">' + TRANSOM_ARCHED_GHOST.label + '</p>'
           + '<p class="flp-ghost-tag">Coming Soon</p></div>';

    overlay.innerHTML = ''
      + '<div class="flp-modal" role="dialog" aria-label="Select door layout">'
      + '<button class="flp-close" id="flp-close" aria-label="Close">&times;</button>'
      + '<p class="flp-modal-title">Select Door Layout</p>'
      + '<div class="flp-grid" id="flp-grid">' + opts + '</div>'
      + '<p class="flp-modal-title" id="flp-transom-title" style="margin-top:18px;">Transom / Fanlight</p>'
      + '<div class="flp-grid" id="flp-transom-grid">' + topts + '</div>'
      + '</div>';

    document.body.appendChild(overlay);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });
    document.getElementById('flp-close').addEventListener('click', closeModal);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });

    overlay.querySelectorAll('.flp-opt').forEach(function (opt) {
      function pick() {
        var radio = getRadio(opt.dataset.value);
        if (radio && !radio.checked) {
          radio.checked = true;
          radio.dispatchEvent(new Event('change', { bubbles: true }));
        }
        refresh();
        closeModal();
      }
      opt.addEventListener('click', pick);
      opt.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); }
      });
    });

    overlay.querySelectorAll('.flp-transom-opt').forEach(function (opt) {
      function pickT() {
        var radio = getTransomRadio(opt.dataset.value);
        if (radio && !radio.checked) {
          radio.checked = true;
          radio.dispatchEvent(new Event('change', { bubbles: true }));
        }
        refresh();
        closeModal();
      }
      opt.addEventListener('click', pickT);
      opt.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickT(); }
      });
    });
  }

  function openModal(section) {
    buildModal();
    refresh();
    var ov = document.getElementById('flp-overlay');
    if (ov) ov.classList.add('open');
    if (section === 'transom') {
      var tt = document.getElementById('flp-transom-title');
      if (tt) tt.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }
  function closeModal() {
    var ov = document.getElementById('flp-overlay');
    if (ov) ov.classList.remove('open');
  }

  // ─── Refresh: summary tile content, modal selection, section visibility ───
  function refresh() {
    var host = document.getElementById('flp-section');
    if (!host) return;
    host.style.display = isFrenchSelected() ? '' : 'none';

    var L = layoutByValue(currentValue());
    var svgSpan = document.getElementById('flp-tile-svg');
    var label = document.getElementById('flp-tile-label');
    if (svgSpan) svgSpan.innerHTML = L.svg;
    if (label) label.textContent = L.label;

    var grid = document.getElementById('flp-grid');
    if (grid) {
      grid.querySelectorAll('.flp-opt').forEach(function (opt) {
        opt.classList.toggle('selected', opt.dataset.value === L.value);
      });
    }

    var tv = currentTransom();
    var T = transomByValue(tv);
    var tSvg = document.getElementById('flp-transom-tile-svg');
    var tLabel = document.getElementById('flp-transom-tile-label');
    if (tSvg) tSvg.innerHTML = T.svg;
    if (tLabel) tLabel.textContent = tv === 'none' ? 'No Transom' : (T.label + ' \u00b7 ' + transomHeightVal() + 'mm');

    var tGrid = document.getElementById('flp-transom-grid');
    if (tGrid) {
      tGrid.querySelectorAll('.flp-transom-opt').forEach(function (opt) {
        opt.classList.toggle('selected', opt.dataset.value === tv);
      });
    }
  }

  // ─── Init ───
  function init() {
    injectStyles();
    buildSection();
    refresh();

    // Stay in sync when the source radios change from anywhere
    // (Dimensions/Design tab, edit-mode restore, save/load).
    document.querySelectorAll('input[name="' + RADIO_NAME + '"]').forEach(function (r) {
      r.addEventListener('change', refresh);
    });
    document.querySelectorAll('input[name="' + TRANSOM_RADIO + '"]').forEach(function (r) {
      r.addEventListener('change', refresh);
    });
    var thEl = document.getElementById('fd-transom-height');
    if (thEl) thEl.addEventListener('input', refresh);
    document.querySelectorAll('input[name="door-type"]').forEach(function (r) {
      r.addEventListener('change', refresh);
    });
    document.querySelectorAll('input[name="product-range"]').forEach(function (r) {
      r.addEventListener('change', refresh);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
