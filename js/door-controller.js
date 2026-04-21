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
  window.doorColourState = doorColourState;

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
    var doorPaneling = checked('door-paneling') || 'flat';
    var sidePanels = checked('door-side-panels') || 'none';
    var centerMullion = checked('door-center-mullion') === 'on';

    return {
      productType: 'door',
      doorType: doorType,
      doorShape: doorShape,
      doorStyle: doorStyle,
      doorPaneling: doorPaneling,
      sidePanels: sidePanels,
      centerMullion: centerMullion,
      width: numVal('d-width'),
      height: numVal('d-height'),
      sideLeftWidth: numVal('d-side-left-width'),
      sideRightWidth: numVal('d-side-right-width'),
      hBars: parseInt(checked('d-hbars') || '0'),
      vBars: parseInt(checked('d-vbars') || '0'),
      sideHBars: parseInt(checked('d-side-hbars') || '0'),
      sideVBars: parseInt(checked('d-side-vbars') || '0'),
      sideStyle: checked('door-side-style') || 'full-glass',
      glassType: checked('d-glass-type') || 'double',
      glassFinish: checked('d-glass-finish') || 'clear',
      spacerColor: checked('d-spacer-color') || 'silver',
      hingeSide: checked('d-hinge-side') || 'left',
      openDirection: checked('d-open-direction') || 'inward',
      lockType: checked('d-lock-type') || 'multipoint',
      threshold: checked('d-threshold') || 'standard',
      thresholdExtension: numVal('d-threshold-extension'),
      doorOpening: (numVal('d-door-opening') || 0) / 100,
      sillWider: document.getElementById('d-sill-wider') ? document.getElementById('d-sill-wider').checked : false,
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
      paneling: config.doorPaneling,
      sidePanels: config.sidePanels,
      centerMullion: config.centerMullion,
      extWidth: config.width,
      extHeight: config.height,
      sideLeftWidth: config.sideLeftWidth,
      sideRightWidth: config.sideRightWidth,
      doorHBars: config.hBars,
      doorVBars: config.vBars,
      sideHBars: config.sideHBars,
      sideVBars: config.sideVBars,
      sideStyle: config.sideStyle,
      glassFinish: config.glassFinish,
      spacerColor: config.spacerColor,
      doorHinge: config.hingeSide,
      sameColor: config.sameColor,
      woodColor: config.woodColor,
      woodColorInt: config.woodColorInt,
      woodColorExt: config.woodColorExt,
      thresholdType: config.threshold,
      thresholdExtension: config.thresholdExtension,
      doorOpening: config.doorOpening,
      sillWider: config.sillWider
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
    ['d-width', 'd-height', 'd-side-left-width', 'd-side-right-width', 'd-threshold-extension', 'd-door-opening'].forEach(function(id) {
      var el = $(id);
      if (el) el.addEventListener('input', debouncedUpdate);
    });

    // Sill wider checkbox
    var sillWiderEl = $('d-sill-wider');
    if (sillWiderEl) sillWiderEl.addEventListener('change', debouncedUpdate);

    // Radio groups
    [
      'd-hbars', 'd-vbars',
      'd-side-hbars', 'd-side-vbars',
      'd-glass-type', 'd-glass-finish', 'd-spacer-color',
      'd-hinge-side', 'd-open-direction', 'd-lock-type'
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
    ['door-shape', 'door-style', 'door-paneling', 'door-side-panels', 'door-center-mullion', 'door-side-style'].forEach(function(name) {
      document.querySelectorAll('input[name="' + name + '"]').forEach(function(radio) {
        radio.addEventListener('change', debouncedUpdate);
      });
    });

    // Quantity
    var qtyEl = $('d-quantity');
    if (qtyEl) qtyEl.addEventListener('input', debouncedUpdate);

    // Threshold type → show/hide extension input
    function updateThresholdUI() {
      var type = checked('d-threshold') || 'standard';
      var extRow = $('d-threshold-extension-row');
      if (extRow) extRow.style.display = type === 'standard' ? '' : 'none';
    }
    document.querySelectorAll('input[name="d-threshold"]').forEach(function(radio) {
      radio.addEventListener('change', function() {
        updateThresholdUI();
        debouncedUpdate();
      });
    });
    updateThresholdUI(); // initial state

    // Opening slider display
    var openSlider = $('d-door-opening');
    var openVal = $('d-door-opening-val');
    if (openSlider && openVal) {
      openSlider.addEventListener('input', function() {
        openVal.textContent = openSlider.value;
      });
    }
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