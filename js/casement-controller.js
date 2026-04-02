/**
 * casement-controller.js
 * Controls casement window configurator menu — separate from sash specification-controller.js
 * Handles: dimensions, bars, colour, glass, PAS24, hardware, quantity
 * Updates 3D via window.update3D()
 */
(function() {
  'use strict';

  // ─── Casement colour state (full payload sent every time) ───
  var casementColourState = {
    sameColor: true,
    woodColor: '#F6F6F6',
    woodColorInt: '#F6F6F6',
    woodColorExt: '#F6F6F6'
  };

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
        var specUpper = document.getElementById('spec-upper-bars');
        if (specUpper) specUpper.textContent = hBars + ' horizontal, ' + vBars + ' vertical';
        // Hide lower bars label (casement doesn't have upper/lower distinction)
        var lowerItem = specBars.querySelector('#spec-lower-bars');
        if (lowerItem) lowerItem.parentElement.style.display = 'none';
      } else {
        specBars.style.display = 'none';
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
    });

    updateSpecPanel();
  }

  // ─── Colour logic (matching sash tile system) ───
  function setupColour() {
    // Single/Dual toggle
    // Color type radio buttons — exact copy of sash pattern
    var cColorTypeRadios = document.querySelectorAll('input[name="c-color-type"]');
    cColorTypeRadios.forEach(function(radio) {
      radio.addEventListener('change', function() {
        var dualSection = document.getElementById('c-dual-colour-section');
        var singleSelector = document.getElementById('c-single-color-selector');

        if (radio.value === 'single') {
          if (dualSection) dualSection.style.display = 'none';
          if (singleSelector) singleSelector.style.display = 'block';
          var singlePreview = document.getElementById('c-single-color-preview-info');
          var dualPreview = document.getElementById('c-dual-color-preview-info');
          if (singlePreview) singlePreview.style.display = 'block';
          if (dualPreview) dualPreview.style.display = 'none';
          // Sync colour state back to single
          casementColourState.sameColor = true;
          casementColourState.woodColorInt = casementColourState.woodColor;
          casementColourState.woodColorExt = casementColourState.woodColor;
        } else {
          if (dualSection) dualSection.style.display = 'block';
          if (singleSelector) singleSelector.style.display = 'none';
          var singlePreview2 = document.getElementById('c-single-color-preview-info');
          var dualPreview2 = document.getElementById('c-dual-color-preview-info');
          if (singlePreview2) singlePreview2.style.display = 'none';
          if (dualPreview2) dualPreview2.style.display = 'block';
          var infoPanel = document.getElementById('info-panel-content');
          if (infoPanel) infoPanel.innerHTML =
            '<p class="info-title">Dual Colour</p>' +
            '<p><span class="info-highlight">Additional cost:</span> +15% applied to total window price</p>' +
            '<p class="info-note">Interior and exterior can be different colours</p>';
          // Switch to dual mode
          casementColourState.sameColor = false;
        }
        // Send full colour state to 3D
        if (typeof window.update3D === 'function') {
          window.update3D({
            sameColor: casementColourState.sameColor,
            woodColor: casementColourState.woodColor,
            woodColorInt: casementColourState.woodColorInt,
            woodColorExt: casementColourState.woodColorExt
          });
        }
      });
    });

    // ── Tile clicks: single ──
    setupTileClicks('#c-single-color-selector .c-color-option', 'single');
    setupTileClicks('.c-interior-color', 'interior');
    setupTileClicks('.c-exterior-color', 'exterior');

    // ── RAL/FB dropdowns ──
    ['c-single-ral-select', 'c-single-fb-select', 'c-int-ral-select', 'c-int-fb-select', 'c-ext-ral-select', 'c-ext-fb-select'].forEach(function(id) {
      var sel = $(id);
      if (!sel) return;
      sel.addEventListener('change', function() {
        var hex = sel.value;
        if (!hex) return;
        var target = id.indexOf('int-') > -1 ? 'interior' : id.indexOf('ext-') > -1 ? 'exterior' : 'single';
        switchToCustomTile(target);
        applyColourHex(hex, target);
        // Update preview
        var text = sel.options[sel.selectedIndex].text;
        updatePreview(target, text, hex);
        // Reset other dropdown in same row
        var row = sel.closest('.color-dropdown-row');
        if (row) row.querySelectorAll('select').forEach(function(s) { if (s !== sel) s.value = ''; });
      });
    });

    // ── RAL text input ──
    setupRalInput('c-single-ral-input', 'c-single-ral-apply', 'c-single-ral-error', 'single');
    setupRalInput('c-int-ral-input', 'c-int-ral-apply', 'c-int-ral-error', 'interior');
    setupRalInput('c-ext-ral-input', 'c-ext-ral-apply', 'c-ext-ral-error', 'exterior');

    // Seal colour
    document.querySelectorAll('input[name="c-seal-colour"]').forEach(function(r) {
      r.addEventListener('change', updateCasementColour);
    });
  }

  function setupTileClicks(selector, target) {
    var tiles = document.querySelectorAll(selector);

    tiles.forEach(function(tile) {
      tile.addEventListener('click', function() {
        // Deselect siblings
        tile.closest('.color-options').querySelectorAll('.color-option').forEach(function(t) { t.classList.remove('selected'); });
        tile.classList.add('selected');
        var hex = tile.style.backgroundColor;
        var name = tile.dataset.name || '';
        var ral = tile.dataset.ral || '';
        if (tile.dataset.color === 'custom') return; // custom = use dropdown
        // Convert rgb to hex
        hex = rgbToHex(hex) || '#F6F6F6';
        applyColourHex(hex, target);
        updatePreview(target, name, ral);
      });
    });
  }

  function switchToCustomTile(target) {
    var selector = target === 'single' ? '#c-single-color-selector .c-color-option' :
                   target === 'interior' ? '.c-interior-color' : '.c-exterior-color';
    document.querySelectorAll(selector).forEach(function(t) { t.classList.remove('selected'); });
    var customBtn = target === 'single' ? document.querySelector('#c-single-color-selector .c-custom-color-btn') :
                    target === 'interior' ? document.querySelector('.c-interior-color.c-custom-color-btn') :
                    document.querySelector('.c-exterior-color.c-custom-color-btn');
    if (customBtn) customBtn.classList.add('selected');
  }

  function setupRalInput(inputId, btnId, errorId, target) {
    var input = $(inputId);
    var btn = $(btnId);
    var err = $(errorId);
    if (!input || !btn) return;
    var apply = function() {
      var key = input.value.trim().replace(/^ral\s*/i, '');
      var hex = RAL[key];
      if (hex) {
        switchToCustomTile(target);
        applyColourHex(hex, target);
        updatePreview(target, 'RAL ' + key, hex);
        if (err) err.textContent = '';
      } else {
        if (err) err.textContent = 'RAL not found';
      }
    };
    btn.addEventListener('click', apply);
    input.addEventListener('keydown', function(e) { if (e.key === 'Enter') apply(); });
  }

  function applyColourHex(hex, target) {
    if (typeof window.update3D !== 'function') return;

    if (target === 'single') {
      casementColourState.sameColor = true;
      casementColourState.woodColor = hex;
      casementColourState.woodColorInt = hex;
      casementColourState.woodColorExt = hex;
    } else if (target === 'interior') {
      casementColourState.sameColor = false;
      casementColourState.woodColorInt = hex;
    } else if (target === 'exterior') {
      casementColourState.sameColor = false;
      casementColourState.woodColorExt = hex;
    }

    window.update3D({
      sameColor: casementColourState.sameColor,
      woodColor: casementColourState.woodColor,
      woodColorInt: casementColourState.woodColorInt,
      woodColorExt: casementColourState.woodColorExt
    });
  }

  function updatePreview(target, name, code) {
    if (target === 'single') {
      var pn = $('c-single-preview-name');
      var pr = $('c-single-preview-ral');
      if (pn) pn.textContent = name;
      if (pr) pr.textContent = code;
    } else if (target === 'interior') {
      var pi = $('c-dual-preview-interior');
      if (pi) pi.textContent = name + ' (' + code + ')';
    } else if (target === 'exterior') {
      var pe = $('c-dual-preview-exterior');
      if (pe) pe.textContent = name + ' (' + code + ')';
    }
  }

  function updateCasementColour() {
    // Called by seal colour change — just trigger a generic update
    updateCasement3D();
  }

  function rgbToHex(rgb) {
    if (!rgb || rgb.charAt(0) === '#') return rgb;
    var m = rgb.match(/\d+/g);
    if (!m || m.length < 3) return null;
    return '#' + ((1 << 24) + (parseInt(m[0]) << 16) + (parseInt(m[1]) << 8) + parseInt(m[2])).toString(16).slice(1).toUpperCase();
  }

  // ─── RAL colours (same data as sash) ───
  const RAL = {
    '1000':'#BEBD7F','1001':'#C2B078','1002':'#C6A664','1003':'#E5BE01','1004':'#CDA434',
    '1005':'#A98307','1006':'#E4A010','1007':'#DC9D00','1011':'#8A6642','1012':'#C7B446',
    '1013':'#EAE6CA','1014':'#E1CC4F','1015':'#E6D690','1016':'#EDFF21','1017':'#F5D033',
    '1018':'#F8F32B','1019':'#9E9764','1020':'#999950','1021':'#F3DA0B','1023':'#FAD201',
    '1024':'#AEA04B','1026':'#FFFF00','1027':'#9D9101','1028':'#F4A900','1032':'#D6AE01',
    '1033':'#F3A505','1034':'#EFA94A','2000':'#ED760E','2001':'#C93C20','2002':'#CB2821',
    '2003':'#FF7514','2004':'#F44611','3000':'#AF2B1E','3001':'#A52019','3002':'#A2231D',
    '3003':'#9B111E','3004':'#75151E','3005':'#5E2129','3007':'#412227','3009':'#642424',
    '3011':'#781F19','3012':'#C1876B','3013':'#A12312','3014':'#D36E70','3015':'#EA899A',
    '3016':'#B32821','3017':'#E63244','3018':'#D53032','3020':'#CC0605','3022':'#D95030',
    '3027':'#C51D34','3031':'#B32428','4001':'#6D3F5B','4002':'#922B3E','4003':'#DE4C8A',
    '4004':'#641C34','4005':'#6C4675','4006':'#A03472','4007':'#4A192C','4008':'#924E7D',
    '5000':'#354D73','5001':'#1F3438','5002':'#1E2460','5003':'#1D1E33','5004':'#18171C',
    '5005':'#1E2460','5007':'#3E5F8A','5008':'#26252D','5009':'#025669','5010':'#0E4243',
    '5011':'#1B2A4A','5012':'#3B83BD','5013':'#1E213D','5014':'#606E8C','5015':'#2271B3',
    '5017':'#063971','5018':'#3F888F','5019':'#1B5583','5020':'#1D334A','5021':'#256D7B',
    '5022':'#252850','5023':'#49678D','5024':'#5D9B9B','6000':'#316650','6001':'#287233',
    '6002':'#2D572C','6003':'#424632','6004':'#1F3A3D','6005':'#2F4538','6006':'#3E3B32',
    '6007':'#343B29','6008':'#39352A','6009':'#31372B','6010':'#35682D','6011':'#587246',
    '6012':'#343E40','6013':'#6C7156','6014':'#47402E','6016':'#1E5945','7000':'#78858B',
    '7001':'#8A9597','7002':'#817F68','7003':'#7D7F7D','7004':'#9EA0A1','7005':'#6C7059',
    '7006':'#756F61','7008':'#6A5F31','7011':'#434B4D','7012':'#4E5754','7015':'#434750',
    '7016':'#293133','7021':'#23282B','7022':'#332F2C','7023':'#8B8C7A','7024':'#474A51',
    '7030':'#8B8B7A','7031':'#474B4E','7032':'#B8B799','7033':'#7D8471','7034':'#8F8B66',
    '7035':'#D7D7D7','7036':'#7F7679','7037':'#7D7F7D','7038':'#B5B8B1','7039':'#6C6960',
    '7040':'#9DA1AA','7042':'#8D948D','7043':'#4E5452','7044':'#CAC4B0','7045':'#909090',
    '7046':'#82898F','7047':'#D0D0D0','8000':'#826C34','8001':'#955F20','8002':'#6C3B2A',
    '8003':'#734222','8004':'#8E402A','8007':'#59351F','8008':'#6F4F28','8011':'#6F3B2A',
    '8014':'#382C1E','8017':'#45322E','8019':'#403A3A','8022':'#212121','8024':'#79553D',
    '8025':'#755C48','8028':'#4E3B31','9001':'#FDF4E3','9002':'#E7EBDA','9003':'#F4F4F4',
    '9004':'#282828','9005':'#0A0A0A','9006':'#A5A5A5','9007':'#8F8F8F','9010':'#FFFFFF',
    '9011':'#1C2023','9016':'#F6F6F6','9017':'#1E1E1E','9018':'#D7D7D7'
  };

  // RAL dropdowns already populated in HTML (same as sash)
  function populateRALDropdowns() {
    // No-op: RAL options are in the HTML
  }

  // Farrow & Ball — copy from sash dropdown (single source of truth)
  function populateFBDropdowns() {
    var source = document.getElementById('single-fb-select');
    if (!source) {
      console.log('F&B source dropdown not found — casement FB dropdowns empty');
      return;
    }
    ['c-fb-code', 'c-fb-ext', 'c-fb-int'].forEach(function(id) {
      var sel = $(id);
      if (!sel) return;
      sel.innerHTML = source.innerHTML;
    });
  }

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
      r.addEventListener('change', updateCasement3D);
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
      windowCategory: 'casement',
      layout: checked('casement-layout') || '040L',
      width: parseInt(val('c-width')) || 800,
      height: parseInt(val('c-height')) || 1200,
      fanlightHeight: parseInt(val('c-fanlight-height')) || 350,
      hBars: parseInt(checked('c-hbars')) || 0,
      vBars: parseInt(checked('c-vbars')) || 0,
      colourMode: checked('c-color-type') || 'single',
      sealColour: checked('c-seal-colour') || 'black',
      glassType: checked('c-glass-type') || 'double',
      glassSpec: checked('c-glass-spec') || 'float',
      glassFinish: checked('c-glass-finish') || 'clear',
      spacer: checked('c-spacer-color') || 'silver',
      pas24: checked('c-pas24') || 'no',
      hardwareFinish: checked('c-hardware-finish') || 'chrome',
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
    setupColour();
    setupLiveWatchers();

    // Set initial defaults from current layout
    var currentLayout = checked('casement-layout') || '040L';
    setDefaultDimensions(currentLayout);

    console.log('✅ Casement controller initialized');
  }

  init();
})();