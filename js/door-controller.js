/**
 * door-controller.js
 * Controls door configurator — dimensions, glass, colour, hardware, spec panel.
 * Separate from sash/casement controllers.
 * Updates 3D via window.update3D()
 */
(function() {
  'use strict';

  // ─── Helpers ───
  function $(id) { return document.getElementById(id); }
  function val(id) { var el = $(id); return el ? el.value : null; }
  function numVal(id) { var el = $(id); return el ? parseInt(el.value) || 0 : 0; }
  function checked(name) { var el = document.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : null; }

  function debounce(fn, ms) {
    var t;
    return function() { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  // ─── Door colour state ───
  var doorColourState = {
    sameColor: true,
    woodColor: '#F6F6F6',
    woodColorInt: '#F6F6F6',
    woodColorExt: '#F6F6F6'
  };

  // ─── Dimension constraints per door type ───
  var DOOR_DIMS = {
    'single-external': { wMin: 600, wMax: 1100, hMin: 1900, hMax: 3000, defaultW: 900, defaultH: 2100 },
    'french':          { wMin: 1000, wMax: 2000, hMin: 1900, hMax: 3000, defaultW: 1400, defaultH: 2100 },
    'sliding':         { wMin: 1500, wMax: 4000, hMin: 1900, hMax: 2500, defaultW: 2400, defaultH: 2100 },
    'bifold':          { wMin: 1800, wMax: 6000, hMin: 1900, hMax: 2500, defaultW: 3000, defaultH: 2100 }
  };

  // ─── Get current door config ───
  function getDoorConfig() {
    var doorType = checked('door-type') || 'single-external';
    var doorShape = checked('door-shape') || 'standard';
    var doorStyle = checked('door-style') || 'full-glass';
    var doorPaneling = checked('door-paneling') || 'panel';
    var sidePanels = checked('door-side-panels') || 'none';

    return {
      productType: 'door',
      doorType: doorType,
      doorShape: doorShape,
      doorStyle: doorStyle,
      doorPaneling: doorPaneling,
      sidePanels: sidePanels,
      width: numVal('d-width'),
      height: numVal('d-height'),
      sideLeftWidth: numVal('d-side-left-width'),
      sideRightWidth: numVal('d-side-right-width'),
      hBars: parseInt(checked('d-hbars') || '0'),
      vBars: parseInt(checked('d-vbars') || '0'),
      glassType: checked('d-glass-type') || 'double',
      glassFinish: checked('d-glass-finish') || 'clear',
      spacerColor: checked('d-spacer-color') || 'silver',
      hingeSide: checked('d-hinge-side') || 'left',
      openDirection: checked('d-open-direction') || 'inward',
      lockType: checked('d-lock-type') || 'multipoint',
      threshold: checked('d-threshold') || 'standard',
      letterbox: checked('d-letterbox') || 'none',
      spyhole: checked('d-spyhole') || 'none',
      knocker: checked('d-knocker') || 'none',
      numerals: checked('d-numerals') || 'none',
      quantity: numVal('d-quantity') || 1,
      notes: val('d-notes') || '',
      // Colour
      sameColor: doorColourState.sameColor,
      woodColor: doorColourState.woodColor,
      woodColorInt: doorColourState.woodColorInt,
      woodColorExt: doorColourState.woodColorExt,
      // Ironmongery
      ironmongery: (window.currentConfig && window.currentConfig.ironmongery) ? window.currentConfig.ironmongery : {}
    };
  }

  // ─── Update 3D ───
  function updateDoor3D() {
    if (typeof window.update3D !== 'function') return;

    var config = getDoorConfig();
    window.update3D({
      windowCategory: 'door',
      doorType: config.doorType,
      doorShape: config.doorShape,
      doorStyle: config.doorStyle,
      doorPaneling: config.doorPaneling,
      sidePanels: config.sidePanels,
      extWidth: config.width,
      extHeight: config.height,
      sideLeftWidth: config.sideLeftWidth,
      sideRightWidth: config.sideRightWidth,
      hBars: config.hBars,
      vBars: config.vBars,
      glassType: config.glassType,
      spacerColor: config.spacerColor,
      hingeSide: config.hingeSide,
      openDirection: config.openDirection,
      sameColor: config.sameColor,
      woodColor: config.woodColor,
      woodColorInt: config.woodColorInt,
      woodColorExt: config.woodColorExt
    });

    window.currentConfig = getDoorConfig();
  }

  // ─── Update spec panel ───
  function updateSpecPanel() {
    var config = getDoorConfig();

    // Update hints
    var hintDim = $('hint-door-dim');
    if (hintDim) hintDim.textContent = config.width + ' × ' + config.height + 'mm';

    var hintGlass = $('hint-door-glass');
    if (hintGlass) {
      var glassLabels = { 'double': 'Double Glazing', 'triple': 'Triple Glazing', 'passive': 'Passive Glass' };
      hintGlass.textContent = glassLabels[config.glassType] || 'Standard DG';
    }

    var hintColour = $('hint-door-colour');
    if (hintColour) {
      hintColour.textContent = config.sameColor ? 'Single' : 'Dual Colour';
    }

    // Store config globally
    window.currentConfig = config;
  }

  // ─── Update price ───
  function updateDoorPrice() {
    var config = getDoorConfig();
    window.currentConfig = config;

    if (typeof window.calculatePrice !== 'function') return;

    var priceData = window.calculatePrice(config);

    var priceEl = $('sidebar-total-price');
    if (priceEl && priceData && priceData.total !== undefined) {
      priceEl.textContent = '£' + priceData.total.toFixed(2);
    }
  }

  // ─── Update dimension constraints when door type changes ───
  function updateDimConstraints() {
    var doorType = checked('door-type') || 'single-external';
    var dims = DOOR_DIMS[doorType] || DOOR_DIMS['single-external'];

    var wEl = $('d-width');
    var hEl = $('d-height');

    if (wEl) {
      wEl.min = dims.wMin;
      wEl.max = dims.wMax;
      if (parseInt(wEl.value) < dims.wMin || parseInt(wEl.value) > dims.wMax) {
        wEl.value = dims.defaultW;
      }
    }
    if (hEl) {
      hEl.min = dims.hMin;
      hEl.max = dims.hMax;
      if (parseInt(hEl.value) < dims.hMin || parseInt(hEl.value) > dims.hMax) {
        hEl.value = dims.defaultH;
      }
    }
  }

  // ─── Live watchers ───
  function setupLiveWatchers() {
    var debouncedUpdate = debounce(function() {
      updateDoor3D();
      updateSpecPanel();
      updateDoorPrice();
    }, 300);

    // Dimension inputs
    ['d-width', 'd-height', 'd-side-left-width', 'd-side-right-width'].forEach(function(id) {
      var el = $(id);
      if (el) el.addEventListener('input', debouncedUpdate);
    });

    // Radio groups
    [
      'd-hbars', 'd-vbars',
      'd-glass-type', 'd-glass-finish', 'd-spacer-color',
      'd-hinge-side', 'd-open-direction', 'd-lock-type',
      'd-threshold', 'd-letterbox', 'd-spyhole', 'd-knocker', 'd-numerals'
    ].forEach(function(name) {
      document.querySelectorAll('input[name="' + name + '"]').forEach(function(radio) {
        radio.addEventListener('change', debouncedUpdate);
      });
    });

    // Door type change — update dimension constraints
    document.querySelectorAll('input[name="door-type"]').forEach(function(radio) {
      radio.addEventListener('change', function() {
        updateDimConstraints();
        debouncedUpdate();
      });
    });

    // Door shape/style/paneling changes
    ['door-shape', 'door-style', 'door-paneling', 'door-side-panels'].forEach(function(name) {
      document.querySelectorAll('input[name="' + name + '"]').forEach(function(radio) {
        radio.addEventListener('change', debouncedUpdate);
      });
    });

    // Quantity
    var qtyEl = $('d-quantity');
    if (qtyEl) qtyEl.addEventListener('input', debouncedUpdate);
  }

  // ─── Add to estimate ───
  function setupAddToEstimate() {
    var btn = $('d-add-to-estimate');
    if (!btn) return;

    btn.addEventListener('click', function() {
      var config = getDoorConfig();
      window.currentConfig = config;

      // Trigger estimate flow (same as windows)
      if (window.estimateManager && window.estimateManager.addItem) {
        window.estimateManager.addItem(config);
      }
    });
  }

  // ─── Expose globally ───
  window.getDoorConfig = getDoorConfig;
  window.updateDoor3D = updateDoor3D;
  window.updateDoorSpec = updateSpecPanel;
  window.updateDoorPrice = updateDoorPrice;

  // ─── Init ───
  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setup);
    } else {
      setup();
    }
  }

  function setup() {
    updateDimConstraints();
    setupLiveWatchers();
    setupAddToEstimate();
    updateSpecPanel();
    console.log('✅ Door controller initialized');
  }

  init();
})();