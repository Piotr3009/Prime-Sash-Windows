// ============================================
// PRIME SASH WINDOWS - 3D Viewer Modal (Etap 2)
// ============================================
// Shows a saved window configuration (specification.viewer3d, captured in Etap 1)
// in the live 3D engine, inside a fullscreen modal on estimate pages.
//
// Included on: admin-dashboard.html, customer-dashboard.html, /e/<token> (api/estimate-view.js).
// Deliberately NOT included on online-estimate.html — the live configurator owns
// window.update3D there, and driving it from a modal would change the main window state.
//
// How it works:
//   1. estimate-renderer.js registers configs in window.__psw3dConfigs and renders
//      buttons with data-psw3d="<item.id>" (only when this script is present).
//   2. First click: builds the modal, injects 3d/assets/window3d.js (the engine
//      mounts itself into #root-3d inside the modal), waits for window.update3D.
//   3. Feeds the engine the exact saved config — zero translation, same object
//      the configurator rendered from. Next opens are instant (engine stays mounted).
//
// Note: 3d/assets/window3d.css is NOT loaded here on purpose — it contains global
// selectors (body, button, h1...) that would restyle the dashboard. The few layout
// rules the viewport needs are scoped below under #psw3d-stage.

(function () {
  'use strict';

  // Phones are supported: the viewer is read-only, and the heavy engine still
  // lazy-loads only on the first click, so estimate pages stay light on mobile.
  // (Phone block removed 2026-07-28 with explicit approval - it was inherited
  // from the configurator, where it guards the full editing UI, not 3D itself.)

  var BUNDLE_URL = '/3d/assets/window3d.js?v=66';
  var enginePromise = null;
  var modalBuilt = false;

  function buildModal() {
    if (modalBuilt) return;
    modalBuilt = true;

    var css = document.createElement('style');
    css.id = 'psw3d-style';
    css.textContent =
      '#psw3d-overlay{position:fixed;inset:0;background:rgba(10,22,40,.82);z-index:99990;display:none;align-items:center;justify-content:center;padding:24px;}' +
      '#psw3d-overlay.open{display:flex;}' +
      '#psw3d-panel{background:#FAFAF8;border-radius:6px;width:min(1100px,96vw);height:min(760px,92vh);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 12px 48px rgba(0,0,0,.35);}' +
      '#psw3d-head{display:flex;justify-content:space-between;align-items:center;padding:12px 20px;border-bottom:1px solid #E5E2DA;flex:0 0 auto;}' +
      '#psw3d-title{font-family:"Cormorant Garamond",Georgia,serif;font-size:1.25rem;color:#0A1628;}' +
      '#psw3d-dims{font-family:"Jost",sans-serif;font-size:.7rem;letter-spacing:.08em;color:#9E9E90;margin-left:12px;}' +
      '#psw3d-close{background:none;border:none;font-size:1.5rem;line-height:1;color:#9E9E90;cursor:pointer;padding:2px 8px;}' +
      '#psw3d-close:hover{color:#0A1628;}' +
      '#psw3d-stage{flex:1 1 auto;position:relative;background:#F3F0EA;min-height:0;}' +
      '#psw3d-stage #root-3d{position:absolute;inset:0;}' +
      '#psw3d-stage .app-shell{width:100%;height:100%;display:block;}' +
      '#psw3d-stage .viewport{width:100%;height:100%;}' +
      '#psw3d-stage canvas{display:block;}' +
      '#psw3d-loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:"Jost",sans-serif;font-size:.7rem;letter-spacing:.2em;text-transform:uppercase;color:#9E9E90;background:#F3F0EA;z-index:2;}' +
      '#psw3d-hint{flex:0 0 auto;text-align:center;padding:8px;font-family:"Jost",sans-serif;font-size:.62rem;letter-spacing:.16em;text-transform:uppercase;color:#9E9E90;border-top:1px solid #E5E2DA;}' +
      '@media (max-width:480px){' +
        '#psw3d-overlay{padding:10px;}' +
        '#psw3d-stage .viewport-controls{max-width:128px !important;padding:4px !important;gap:4px !important;top:8px !important;left:8px !important;transform:scale(.9);transform-origin:top left;}' +
      '}';
    document.head.appendChild(css);

    var overlay = document.createElement('div');
    overlay.id = 'psw3d-overlay';
    overlay.innerHTML =
      '<div id="psw3d-panel">' +
        '<div id="psw3d-head">' +
          '<div><span id="psw3d-title"></span><span id="psw3d-dims"></span></div>' +
          '<button id="psw3d-close" type="button" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div id="psw3d-stage"><div id="root-3d"></div><div id="psw3d-loading">Loading 3D&hellip;</div></div>' +
        '<div id="psw3d-hint">drag to rotate &middot; scroll to zoom</div>' +
      '</div>';
    document.body.appendChild(overlay);

    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      document.getElementById('psw3d-hint').textContent = 'drag to rotate \u00b7 pinch to zoom';
    }

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeViewer();
    });
    document.getElementById('psw3d-close').addEventListener('click', closeViewer);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('open')) closeViewer();
    });
  }

  function closeViewer() {
    var overlay = document.getElementById('psw3d-overlay');
    if (overlay) overlay.classList.remove('open');
  }

  function loadEngine() {
    if (typeof window.update3D === 'function') return Promise.resolve();
    if (enginePromise) return enginePromise;
    enginePromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.type = 'module';
      s.src = BUNDLE_URL;
      s.onerror = function () { reject(new Error('3D engine failed to load')); };
      document.head.appendChild(s);
      var t0 = Date.now();
      (function poll() {
        if (typeof window.update3D === 'function') return resolve();
        if (Date.now() - t0 > 20000) return reject(new Error('3D engine timed out'));
        setTimeout(poll, 100);
      })();
    });
    return enginePromise;
  }

  // Public API. config = saved viewer3d object (verbatim engine config from Etap 1).
  window.open3DViewer = function (config, label, dims) {
    if (!config) return;
    buildModal();
    var overlay = document.getElementById('psw3d-overlay');
    var loading = document.getElementById('psw3d-loading');
    document.getElementById('psw3d-title').textContent = label || 'Window';
    document.getElementById('psw3d-dims').textContent = dims || '';
    loading.style.display = 'flex';
    loading.textContent = 'Loading 3D\u2026';
    overlay.classList.add('open');

    loadEngine().then(function () {
      // Exact saved config + clean closed presentation. The sliders inside the
      // viewport still let the viewer open sashes/doors themselves.
      window.update3D(Object.assign({}, config, {
        showGuides: false,
        autoRotate: false,
        opening: 0,
        upperOpening: 0,
        doorOpening: 0
      }));
      // Give React a moment to apply state before revealing the canvas.
      setTimeout(function () { loading.style.display = 'none'; }, 400);
    }).catch(function (err) {
      loading.textContent = '3D preview unavailable';
      console.warn('3D viewer:', err);
    });
  };

  // Delegated clicks from the estimate-renderer buttons (data-psw3d="<item.id>").
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('[data-psw3d]') : null;
    if (!btn) return;
    var reg = window.__psw3dConfigs || {};
    var entry = reg[btn.getAttribute('data-psw3d')];
    if (entry) window.open3DViewer(entry.config, entry.label, entry.dims);
  });
})();
