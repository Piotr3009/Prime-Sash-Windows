/**
 * casement-controller.js
 * Controls casement window configurator menu — separate from sash specification-controller.js
 * Handles: dimensions, bars, colour, glass, PAS24, hardware, quantity
 * Updates 3D via window.update3D()
 */
(function() {
  'use strict';

  // ─── Casement colour state (full payload sent every time) ───

  // ─── Default dimensions per layout ───
  const LAYOUT_DEFAULTS = {
    '010':  { w: 600,  h: 1000 },
    '010T': { w: 1000, h: 1200 },
    '040L': { w: 600,  h: 1200 },
    '040R': { w: 600,  h: 1200 },
    '040D': { w: 1200, h: 1200 },
    '120':  { w: 1200, h: 1200 },
    '051L': { w: 1200, h: 1200 },
    '051R': { w: 1200, h: 1200 },
    '052L': { w: 1200, h: 1500 },
    '052R': { w: 1200, h: 1500 },
    '180L': { w: 1500, h: 1200 },
    '180R': { w: 1500, h: 1200 },
    '021':  { w: 800,  h: 1400 },
    '021L': { w: 800,  h: 1400 },
    '021R': { w: 800,  h: 1400 },
    '031':  { w: 1200, h: 1400 },
    '031L': { w: 1200, h: 1400 },
    '031R': { w: 1200, h: 1400 },
    '032':  { w: 1200, h: 1400 },
    '130':  { w: 1800, h: 1200 },
    '131':  { w: 1800, h: 1500 },
    '132':  { w: 1800, h: 1500 },
  };

  // Layouts that have fanlights (transom)
  const FANLIGHT_LAYOUTS = ['021', '031', '032', '052L', '052R', '131', '132'];

  // ─── Helpers ───
  function $(id) { return document.getElementById(id); }
  function val(id) { const el = $(id); return el ? el.value : null; }
  function checked(name) { const el = document.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : null; }

  function debounce(fn, ms) {
    let t;
    return function() { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  // ─── Dimension select ↔ hidden input sync ───
  function setupDimSelect(selectId, customId, hiddenId) {
    const sel = $(selectId);
    const cust = $(customId);
    const hidden = $(hiddenId);
    if (!sel || !hidden) return;

    sel.addEventListener('change', function() {
      if (sel.value === 'custom') {
        if (cust) { cust.style.display = 'block'; cust.focus(); }
      } else {
        if (cust) cust.style.display = 'none';
        hidden.value = sel.value;
        hidden.dispatchEvent(new Event('input'));
        updateCasement3D();
      }
    });

    if (cust) {
      cust.addEventListener('input', function() {
        hidden.value = cust.value;
        updateCasement3D();
      });
    }
  }

  // ─── Set dimensions from layout defaults ───
  function setDefaultDimensions(layout) {
    const def = LAYOUT_DEFAULTS[layout] || { w: 800, h: 1200 };
    const wSel = $('c-width-select');
    const hSel = $('c-height-select');
    const wHid = $('c-width');
    const hHid = $('c-height');
    const wCust = $('c-width-custom');
    const hCust = $('c-height-custom');

    if (wSel) { wSel.value = String(def.w); if (wCust) wCust.style.display = 'none'; }
    if (hSel) { hSel.value = String(def.h); if (hCust) hCust.style.display = 'none'; }
    if (wHid) wHid.value = def.w;
    if (hHid) hHid.value = def.h;

    // Fanlight row
    const fRow = $('c-fanlight-row');
    const hasFanlight = FANLIGHT_LAYOUTS.includes(layout);
    if (fRow) {
      fRow.style.display = hasFanlight ? 'block' : 'none';
    }
    // Set default fanlight height (30% of inner height)
    if (hasFanlight) {
      var innerH = def.h - 57 - 68;
      var defaultFH = Math.round(innerH * 0.3);
      var fInput = $('c-fanlight-height');
      if (fInput) fInput.value = defaultFH;
    }
  }

  // ─── Update spec panel sidebar ───
  function updateSpecPanel() {
    var layout = checked('casement-layout') || '040L';
    var w = parseInt(val('c-width')) || 800;
    var h = parseInt(val('c-height')) || 1200;

    // Window type
    var specType = document.getElementById('spec-window-type');
    var specSashType = document.getElementById('spec-sash-type');
    var specSplitItem = document.getElementById('spec-split-ratio-item');
    if (specType) specType.style.display = 'block';
    if (specSashType) specSashType.textContent = 'Casement — Layout ' + layout;
    if (specSplitItem) specSplitItem.style.display = 'none';

    // Dimensions
    var specDims = document.getElementById('spec-dimensions');
    var specWidth = document.getElementById('spec-width');
    var specHeight = document.getElementById('spec-height');
    var specMeasurement = document.getElementById('spec-measurement');
    if (specDims) specDims.style.display = 'block';
    if (specWidth) specWidth.textContent = w + 'mm';
    if (specHeight) specHeight.textContent = h + 'mm';
    if (specMeasurement) specMeasurement.textContent = 'Frame Dimensions';

    // Hide sash-only sections
    ['spec-fix-bars', 'spec-frame', 'spec-opening'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

    // Bars
    var hBars = parseInt(checked('c-hbars')) || 0;
    var vBars = parseInt(checked('c-vbars')) || 0;
    var specBars = document.getElementById('spec-bars');
    if (specBars) {
      if (hBars > 0 || vBars > 0) {
        specBars.style.display = 'block';
        // Change label from "Upper Sash:" to "Bars:"
        var upperLabel = specBars.querySelector('#spec-upper-bars');
        if (upperLabel) {
          var labelEl = upperLabel.previousElementSibling;
          if (labelEl) labelEl.textContent = 'Bars:';
          upperLabel.textContent = hBars + ' horizontal, ' + vBars + ' vertical';
        }
        // Hide lower bars row
        var lowerItem = document.getElementById('spec-lower-bars');
        if (lowerItem) lowerItem.parentElement.style.display = 'none';
        var lowerDetail = document.getElementById('spec-lower-bars-detail');
        if (lowerDetail) lowerDetail.style.display = 'none';
      } else {
        specBars.style.display = 'none';
      }
    }

    // Colour — read from casement colour state
    var specColor = document.getElementById('spec-color');
    if (specColor) {
      specColor.style.display = 'block';
      var colorType = checked('cm-colour-mode') || 'same';
      if (colorType === 'same') {
        var singleEl = document.getElementById('spec-single-color');
        var dualEl = document.getElementById('spec-dual-color');
        if (singleEl) singleEl.style.display = 'block';
        if (dualEl) dualEl.style.display = 'none';
        // Read from preview (works for tiles AND F&B/RAL)
        var previewName = $('cm-single-preview-name');
        var previewRal = $('cm-single-preview-ral');
        var colorName = previewName ? previewName.textContent : 'White';
        var colorRal = previewRal ? previewRal.textContent : '';
        if (!colorName || colorName === '-') {
          var selectedTile = document.querySelector('#cm-single-color-selector .cm-co.selected');
          colorName = selectedTile ? (selectedTile.dataset.name || 'White') : 'White';
          colorRal = selectedTile ? (selectedTile.dataset.ral || '') : '';
        }
        var nameEl = document.getElementById('spec-color-name');
        var ralEl = document.getElementById('spec-color-ral');
        if (nameEl) nameEl.textContent = colorName;
        if (ralEl) ralEl.textContent = colorRal;
      } else {
        var singleEl2 = document.getElementById('spec-single-color');
        var dualEl2 = document.getElementById('spec-dual-color');
        if (singleEl2) singleEl2.style.display = 'none';
        if (dualEl2) dualEl2.style.display = 'block';
        // Read from dual preview elements
        var previewInt = $('cm-dual-preview-interior');
        var previewExt = $('cm-dual-preview-exterior');
        var intName = previewInt ? previewInt.textContent : '-';
        var extName = previewExt ? previewExt.textContent : '-';
        if (!intName || intName === '-') {
          var intTile = document.querySelector('.cm-interior.selected');
          intName = intTile ? (intTile.dataset.name + ' (' + intTile.dataset.ral + ')') : '-';
        }
        if (!extName || extName === '-') {
          var extTile = document.querySelector('.cm-exterior.selected');
          extName = extTile ? (extTile.dataset.name + ' (' + extTile.dataset.ral + ')') : '-';
        }
        var intEl = document.getElementById('spec-interior-color');
        var extEl = document.getElementById('spec-exterior-color');
        if (intEl) intEl.textContent = intName;
        if (extEl) extEl.textContent = extName;
      }
    }

    // Glass type + spacer (reuse sash spec elements)
    var specGlass = document.getElementById('spec-glass');
    var glassType = checked('c-glass-type') || 'double';
    var spacer = checked('c-spacer-color') || 'silver';
    if (specGlass) {
      specGlass.style.display = 'block';
      var gt = document.getElementById('spec-glass-type');
      if (gt) gt.textContent = glassType === 'passive' ? 'Passive Glass (U: 0.8)' : glassType === 'triple' ? 'Triple Glazing (U: 1.2)' : 'Double Glazing (U: 1.4)';
      var sc = document.getElementById('spec-spacer-color');
      if (sc) sc.textContent = spacer.charAt(0).toUpperCase() + spacer.slice(1);
    }

    // Glass specification (casement-specific)
    var specCGlass = document.getElementById('spec-casement-glass');
    if (specCGlass) {
      specCGlass.style.display = 'block';
      var gs = document.getElementById('spec-c-glass-spec');
      var gf = document.getElementById('spec-c-glass-finish');
      if (gs) gs.textContent = (checked('c-glass-spec') || 'float') === 'low-e' ? 'Low-E Coated' : 'Float Glass';
      if (gf) {
        var finish = checked('c-glass-finish') || 'clear';
        gf.textContent = finish.charAt(0).toUpperCase() + finish.slice(1);
      }
    }

    // Security & ventilation
    var specCSec = document.getElementById('spec-casement-security');
    if (specCSec) {
      specCSec.style.display = 'block';
      var sg = document.getElementById('spec-c-safety-glass');
      var tv = document.getElementById('spec-c-trickle');
      if (sg) {
        var safety = checked('c-safety-glass') || 'none';
        sg.textContent = safety === 'none' ? 'Standard' : safety === 'toughened' ? 'Toughened' : 'Laminate';
      }
      if (tv) {
        var vent = checked('c-trickle-vent') || 'none';
        var ventColour = checked('c-trickle-colour') || 'white';
        if (vent === 'none') {
          tv.textContent = 'None';
        } else {
          tv.textContent = (vent === 'frame' ? 'On Frame' : 'On Sash') + ' (' + ventColour + ')';
        }
      }
    }

    // PAS24 (reuse existing)
    var specPas = document.getElementById('spec-pas24');
    var pas = checked('c-pas24') || 'no';
    if (specPas) {
      specPas.style.display = 'block';
      var pv = document.getElementById('spec-pas24-value');
      if (pv) pv.textContent = pas === 'yes' ? 'Yes — Enhanced Security' : 'No';
    }

    // Sill
    var specSill = document.getElementById('spec-casement-sill');
    var sill = checked('c-sill-ext') || 'none';
    if (specSill) {
      if (sill !== 'none') {
        specSill.style.display = 'block';
        var sv = document.getElementById('spec-c-sill');
        var wider = checked('c-sill-wider') === 'yes';
        if (sv) sv.textContent = sill + 'mm' + (wider ? ' (+50mm each side)' : '');
      } else {
        specSill.style.display = 'none';
      }
    }

    // Seal colour
    var specSeal = document.getElementById('spec-casement-seal');
    if (specSeal) {
      specSeal.style.display = 'block';
      var seal = document.getElementById('spec-c-seal');
      var sealVal = checked('c-seal-colour') || 'black';
      if (seal) seal.textContent = sealVal.charAt(0).toUpperCase() + sealVal.slice(1);
    }

    // Hide sash details (horns etc)
    var specDetails = document.getElementById('spec-details');
    if (specDetails) specDetails.style.display = 'none';

    // Info panel
    var infoPanel = document.getElementById('info-panel-content');
    if (infoPanel) {
      infoPanel.innerHTML =
        '<p class="info-title">Casement Ordering Dimensions</p>' +
        '<p>Measure the brick/stone opening at the <strong>narrowest point</strong>.</p>' +
        '<p>Order <strong>10mm less</strong> than the structural opening (width &amp; height).</p>' +
        '<p class="info-note">Check plumb and level of reveals before ordering.</p>' +
        '<a href="measurement-guide.html" class="measurement-link" target="_blank">📐 Measuring instructions</a>';
    }

    // Update price on every spec change
    window.currentConfig = getCasementConfig();
    updateCasementPrice();
  }

  // ─── Update 3D ───
  function updateCasement3D() {
    if (typeof window.update3D !== 'function') return;

    var layout = checked('casement-layout') || '040L';
    var w = parseInt(val('c-width')) || 800;
    var h = parseInt(val('c-height')) || 1200;
    var fanlightMm = parseInt(val('c-fanlight-height')) || 350;
    var innerH = h - 57 - 68; // height minus top rail minus bottom rail
    var fanlightRatio = Math.max(0.15, Math.min(0.5, fanlightMm / innerH));

    // Update min/max display
    var fMinEl = $('c-fanlight-min');
    var fMaxEl = $('c-fanlight-max');
    var fMin = Math.round(innerH * 0.15);
    var fMax = Math.round(innerH * 0.5);
    if (fMinEl) fMinEl.textContent = fMin;
    if (fMaxEl) fMaxEl.textContent = fMax;

    window.update3D({
      windowCategory: 'casement',
      casementLayout: layout,
      extWidth: w,
      extHeight: h,
      fanlightRatio: fanlightRatio,
      glassType: checked('c-glass-type') || 'double',
      spacerColor: checked('c-spacer-color') || 'silver',
      casementHBars: parseInt(checked('c-hbars')) || 0,
      casementVBars: parseInt(checked('c-vbars')) || 0,
      casementOpening: (parseInt(val('c-opening')) || 0) / 100,
      trickleVent: checked('c-trickle-vent') || 'none',
      trickleColour: checked('c-trickle-colour') || 'white',
      sillExtension: parseInt(checked('c-sill-ext')) || 0,
      sillWider: checked('c-sill-wider') === 'yes',
      glassFinish: checked('c-glass-finish') || 'clear',
      colorSingleName: (function() { var pn = document.getElementById('cm-single-preview-name'); return pn ? pn.textContent.trim() : 'Pure White'; })(),
      colorSingleRal: (function() { var pr = document.getElementById('cm-single-preview-ral'); return pr ? pr.textContent.trim() : '#FAFAFA'; })(),
      colorExteriorName: (function() { var pe = document.getElementById('cm-dual-preview-exterior'); return pe ? pe.textContent.trim() : ''; })(),
      colorInteriorName: (function() { var pi = document.getElementById('cm-dual-preview-interior'); return pi ? pi.textContent.trim() : ''; })(),
      sealColour: checked('c-seal-colour') || 'black',
    });

    updateSpecPanel();

    // Update currentConfig and calculate price directly
    window.currentConfig = getCasementConfig();
    updateCasementPrice();
  }

  function updateCasementPrice() {
    var config = window.currentConfig;
    if (!config || config.windowType !== 'casement') return;
    if (typeof window.calculatePrice !== 'function') return;

    var priceData = window.calculatePrice(config);
    if (!priceData) return;

    // Update price display
    var priceEl = document.getElementById('sidebar-total-price');
    if (priceEl && priceData.unitPrice > 0) {
      priceEl.textContent = '£' + priceData.unitPrice.toFixed(2);
    }

    // Also update total if quantity > 1
    var totalEl = document.getElementById('sidebar-total-with-qty');
    var qty = config.quantity || 1;
    if (totalEl && qty > 1) {
      totalEl.textContent = '£' + priceData.totalPrice.toFixed(2) + ' (' + qty + ' × £' + priceData.unitPrice.toFixed(2) + ')';
      totalEl.style.display = 'block';
    } else if (totalEl) {
      totalEl.style.display = 'none';
    }
  }

  // ─── Colour: handled by shared ColorModule (js/color-module.js) ───

    // ─── Layout change handler ───
  function setupLayoutChange() {
    var layoutRadios = document.querySelectorAll('input[name="casement-layout"]');
    layoutRadios.forEach(function(r) {
      r.addEventListener('change', function() {
        setDefaultDimensions(r.value);
        updateCasement3D();
      });
    });
  }

  // ─── Live watchers for all casement inputs ───
  function setupLiveWatchers() {
    // Dimensions
    setupDimSelect('c-width-select', 'c-width-custom', 'c-width');
    setupDimSelect('c-height-select', 'c-height-custom', 'c-height');

    // Fanlight ratio
    var fRatio = $('c-fanlight-height');
    if (fRatio) fRatio.addEventListener('change', updateCasement3D);

    // Bars
    document.querySelectorAll('input[name="c-hbars"], input[name="c-vbars"]').forEach(function(r) {
      r.addEventListener('change', updateCasement3D);
    });

    // Glass type
    document.querySelectorAll('input[name="c-glass-type"]').forEach(function(r) {
      r.addEventListener('change', updateCasement3D);
    });

    // Glass spec + finish
    document.querySelectorAll('input[name="c-glass-spec"], input[name="c-glass-finish"]').forEach(function(r) {
      r.addEventListener('change', updateCasement3D);
    });

    // Spacer
    document.querySelectorAll('input[name="c-spacer-color"]').forEach(function(r) {
      r.addEventListener('change', updateCasement3D);
    });

    // PAS24
    document.querySelectorAll('input[name="c-pas24"]').forEach(function(r) {
      r.addEventListener('change', updateCasement3D);
    });

    // Trickle vent
    document.querySelectorAll('input[name="c-trickle-vent"]').forEach(function(r) {
      r.addEventListener('change', function() {
        var colourRow = document.getElementById('c-trickle-colour-row');
        if (colourRow) colourRow.style.display = r.value === 'none' ? 'none' : 'block';
        var infoPanel = document.getElementById('info-panel-content');
        if (infoPanel) {
          if (r.value !== 'none') {
            infoPanel.innerHTML =
              '<p class="info-title">Trickle Ventilation</p>' +
              '<p><span class="info-highlight">Building Regulations:</span> Approved Document F requires adequate background ventilation in habitable rooms.</p>' +
              '<p class="info-note">Trickle vents provide continuous low-level ventilation when windows are closed. 320mm × 21mm recessed unit with rounded ends.</p>';
          } else {
            infoPanel.innerHTML = '';
          }
        }
        updateCasement3D();
      });
    });
    document.querySelectorAll('input[name="c-trickle-colour"]').forEach(function(r) {
      r.addEventListener('change', updateCasement3D);
    });

    // Sill extension
    document.querySelectorAll('input[name="c-sill-ext"]').forEach(function(r) {
      r.addEventListener('change', function() {
        var widerRow = document.getElementById('c-sill-wider-row');
        if (widerRow) widerRow.style.display = r.value === 'none' ? 'none' : 'block';
        updateCasement3D();
      });
    });
    document.querySelectorAll('input[name="c-sill-wider"]').forEach(function(r) {
      r.addEventListener('change', updateCasement3D);
    });

    // Glass finish
    document.querySelectorAll('input[name="c-glass-finish"]').forEach(function(r) {
      r.addEventListener('change', function() { updateCasement3D(); updateSpecPanel(); });
    });

    // Safety glass
    document.querySelectorAll('input[name="c-safety-glass"]').forEach(function(r) {
      r.addEventListener('change', function() { updateSpecPanel(); });
    });

    // Glass spec (float/low-e)
    document.querySelectorAll('input[name="c-glass-spec"]').forEach(function(r) {
      r.addEventListener('change', function() { updateSpecPanel(); });
    });

    // Opening slider
    var openingSlider = $('c-opening');
    if (openingSlider) {
      openingSlider.addEventListener('input', function() {
        var label = $('c-opening-value');
        if (label) label.textContent = openingSlider.value;
        updateCasement3D();
      });
    }

    // Hardware finish
    document.querySelectorAll('input[name="c-hardware-finish"]').forEach(function(r) {
      r.addEventListener('change', function() {
        // Hardware update — placeholder for future
      });
    });
  }

  // ─── Store casement config (parallel to window.currentConfig for sash) ───
  function getCasementConfig() {
    return {
      windowType: 'casement',
      windowCategory: 'casement',
      measurementType: 'frame',
      casementLayout: checked('casement-layout') || '040L',
      layout: checked('casement-layout') || '040L',
      width: parseInt(val('c-width')) || 800,
      height: parseInt(val('c-height')) || 1200,
      fanlightHeight: parseInt(val('c-fanlight-height')) || 350,
      casementHBars: parseInt(checked('c-hbars')) || 0,
      casementVBars: parseInt(checked('c-vbars')) || 0,
      hBars: parseInt(checked('c-hbars')) || 0,
      vBars: parseInt(checked('c-vbars')) || 0,
      colorType: checked('cm-colour-mode') || 'same',
      colourMode: checked('cm-colour-mode') || 'same',
      colorSingle: (function() {
        var pn = document.getElementById('cm-single-preview-name');
        var name = pn ? pn.textContent.trim().toLowerCase() : 'white';
        return name.indexOf('white') > -1 ? 'white' : name || 'white';
      })(),
      colorSingleName: (function() { var pn = document.getElementById('cm-single-preview-name'); return pn ? pn.textContent.trim() : 'Pure White'; })(),
      colorSingleRal: (function() { var pr = document.getElementById('cm-single-preview-ral'); return pr ? pr.textContent.trim() : '#FAFAFA'; })(),
      colorExteriorName: (function() { var pe = document.getElementById('cm-dual-preview-exterior'); return pe ? pe.textContent.trim() : ''; })(),
      colorInteriorName: (function() { var pi = document.getElementById('cm-dual-preview-interior'); return pi ? pi.textContent.trim() : ''; })(),
      sealColour: checked('c-seal-colour') || 'black',
      glassType: checked('c-glass-type') || 'double',
      glassSpec: checked('c-glass-spec') || 'float',
      glassFinish: checked('c-glass-finish') || 'clear',
      spacer: checked('c-spacer-color') || 'silver',
      pas24: checked('c-pas24') || 'no',
      safetyGlass: checked('c-safety-glass') || 'none',
      sillExtension: checked('c-sill-ext') || 'none',
      trickleVent: checked('c-trickle-vent') || 'none',
      quantity: parseInt(val('c-quantity')) || 1,
    };
  }

  // Expose globally
  window.getCasementConfig = getCasementConfig;
  window.updateCasement3D = updateCasement3D;

  // ─── Init ───
  function init() {
    // Wait for DOM
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setup);
    } else {
      setup();
    }
  }

  function setup() {
    setupDimSelect('c-width-select', 'c-width-custom', 'c-width');
    setupDimSelect('c-height-select', 'c-height-custom', 'c-height');
    setupLayoutChange();
    // Colour now handled by ColorModule (js/color-module.js)
    if (typeof window.ColorModule === 'function' && document.getElementById('casement-color-container')) {
      window.casementColorModule = new ColorModule({
        containerId: 'casement-color-container',
        prefix: 'cm',
        onColorChange: function(state) {
          if (typeof window.update3D === 'function') window.update3D(state);
          updateSpecPanel();
          updateCasementPrice();
        }
      });
    }
    // Seal colour listener (was inside old setupColour)
    document.querySelectorAll('input[name="c-seal-colour"]').forEach(function(r) {
      r.addEventListener('change', updateCasement3D);
    });
    setupLiveWatchers();

    // Set initial defaults from current layout
    var currentLayout = checked('casement-layout') || '040L';
    setDefaultDimensions(currentLayout);

    console.log('✅ Casement controller initialized');
  }

  init();
})();