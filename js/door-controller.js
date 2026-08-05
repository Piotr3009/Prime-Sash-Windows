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

  function isDoorActive() {
    return (document.querySelector('input[name="product-range"]:checked') || {}).value === 'doors';
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
    'front-door':      { wMin: 700, wMax: 1200, hMin: 1900, hMax: 3000, defaultW: 900, defaultH: 2100 },
    'french':          { wMin: 1000, wMax: 2000, hMin: 1900, hMax: 3000, defaultW: 1400, defaultH: 2100 },
    'sliding':         { wMin: 1500, wMax: 8000, hMin: 1900, hMax: 2500, defaultW: 2400, defaultH: 2100 },
    'bifold':          { wMin: 1500, wMax: 7500, hMin: 1900, hMax: 2500, defaultW: 3000, defaultH: 2100 }
  };

  // ─── Get current door config ───
  function getDoorConfig() {
    var doorType = checked('door-type') || 'single-external';
    var isFrench = doorType === 'french';
    var isSliding = doorType === 'sliding';
    var isBifold = doorType === 'bifold';
    var isFrontDoor = doorType === 'front-door';   // Layer 1: behaves as single; panels/arch/sunburst come in later layers
    var prefix = isFrench ? 'fd-door-' : 'door-';

    // Sliding: fixed defaults (no shape/style/paneling/sidePanels)
    // Bifold: fixed shape + no sidePanels/mullion, but style/paneling allowed
    var doorShape, doorStyle, doorPaneling, sidePanels, centerMullion;
    if (isSliding) {
      doorShape = 'standard';
      doorStyle = 'full-glass';
      doorPaneling = 'flat';
      sidePanels = 'none';
      centerMullion = false;
    } else if (isBifold) {
      doorShape = 'standard';
      doorStyle = checked('door-style') || 'full-glass';
      doorPaneling = checked('door-paneling') || 'flat';
      sidePanels = 'none';
      centerMullion = false;
    } else {
      doorShape = checked(prefix + 'shape') || 'standard';
      doorStyle = checked(prefix + 'style') || 'full-glass';
      doorPaneling = checked(prefix + 'paneling') || 'flat';
      sidePanels = checked(prefix + 'side-panels') || 'none';
      centerMullion = checked(prefix + 'center-mullion') === 'on';
    }

    // Sliding-specific fields
    var panelCount = isSliding ? (parseInt(checked('sl-door-panel-count')) || 2) : 0;
    var extraWidth = isSliding ? (checked('sl-door-extra-width') === 'extra') : false;
    var slideDirection = isSliding ? (checked('sl-door-slide-direction') || 'left-to-right') : '';
    var width = numVal('d-width');
    var glassWidth = 0;
    var panelDepth = 57; // default for non-sliding/bifold
    var frameDepth = 93; // default for non-sliding/bifold
    var panelWidth = 0;

    // Bi-fold specific fields
    var foldDirection = '';
    var trafficDoor = 'no';
    var bifoldOpenDirection = '';
    if (isBifold) {
      panelCount = parseInt(document.getElementById('bf-door-panel-count') ? document.getElementById('bf-door-panel-count').value : 4) || 4;
      foldDirection = (checked('bf-fold-direction') || 'left');
      trafficDoor = (panelCount >= 3) ? (checked('bf-traffic-door') || 'no') : 'no';
      bifoldOpenDirection = (checked('bf-open-direction') || 'outward');
      // Bi-fold panel math: panelW = (width - 100 - (N-1) × 5) / N
      var gaps = panelCount - 1;
      panelWidth = Math.round((width - 100 - gaps * 5) / panelCount);
      panelDepth = 65; // leaf depth 65mm
      frameDepth = 95; // 15 + 65 + 15
    }

    if (isSliding && panelCount > 0) {
      var stileW = 93; // panel stile width
      var innerWidth = width - 100; // 50mm frame each side
      var overlaps = panelCount - 1;
      panelWidth = Math.round((innerWidth + overlaps * stileW) / panelCount);
      glassWidth = panelWidth - 2 * stileW;
      if (glassWidth < 0) glassWidth = 0;
      // Panel depth: glass thickness + 33mm timber (based on glass width)
      var glassThickness = glassWidth <= 1000 ? 28 : (glassWidth <= 1600 ? 32 : 36); // 6+16+6 / 8+16+8 / 10+16+10
      panelDepth = glassThickness + 33;
      // Track count: 2-panel=2, 3-panel=3, 4-panel=2 (two pairs)
      var trackCount = panelCount === 4 ? 2 : panelCount;
      // Frame depth: 15mm wall + tracks × panelDepth + (tracks-1) × 5mm gap + 15mm wall
      frameDepth = 15 + (trackCount * panelDepth) + ((trackCount - 1) * 5) + 15;
    }

    // Transom / fanlight (Stage 2 — french only)
    var transomType = isFrench ? (checked('fd-transom-type') || 'none') : 'none';
    var transomHeight = isFrench ? (numVal('fd-transom-height') || 450) : 0;
    var transomBars = isFrench ? (checked('fd-transom-bars') || 'none') : 'none';

    return {
      productType: 'door',
      doorType: doorType,
      doorShape: doorShape,
      doorStyle: doorStyle,
      doorPaneling: doorPaneling,
      sidePanels: sidePanels,
      centerMullion: centerMullion,
      width: width,
      height: numVal('d-height'),
      sideLeftWidth: numVal('d-side-left-width'),
      sideRightWidth: numVal('d-side-right-width'),
      hBars: parseInt(checked('d-hbars') || '0'),
      vBars: parseInt(checked('d-vbars') || '0'),
      sideHBars: parseInt(checked('d-side-hbars') || '0'),
      sideVBars: parseInt(checked('d-side-vbars') || '0'),
      sideStyle: (isSliding || isBifold) ? 'full-glass' : (checked(prefix + 'side-style') || 'full-glass'),
      transomType: transomType,
      transomHeight: transomHeight,
      transomBars: transomBars,
      glassType: checked('d-glass-type') || 'double',
      glassFinish: checked('d-glass-finish') || 'clear',
      spacerColor: checked('d-spacer-color') || 'white',
      hingeSide: (isSliding || isBifold) ? '' : (checked('d-hinge-side') || 'left'),
      openDirection: isBifold ? bifoldOpenDirection : (isSliding ? '' : (checked('d-open-direction') || 'inward')),
      lockType: (isSliding || isBifold) ? 'standard' : (checked('d-lock-type') || 'multipoint'),
      threshold: (isSliding || isBifold) ? 'standard' : (checked('d-threshold') || 'standard'),
      thresholdExtension: numVal('d-threshold-extension'),
      doorOpening: (numVal('d-door-opening') || 0) / 100,
      sillWider: document.getElementById('d-sill-wider') ? document.getElementById('d-sill-wider').checked : false,
      quantity: numVal('d-quantity') || 1,
      notes: val('d-notes') || '',
      // Sliding-specific
      panelCount: panelCount,
      extraWidth: extraWidth,
      slideDirection: slideDirection,
      glassWidth: glassWidth,
      panelDepth: panelDepth,
      panelWidth: panelWidth,
      frameDepth: frameDepth,
      // Bi-fold specific
      foldDirection: foldDirection,
      trafficDoor: trafficDoor,
      bifoldOpenDirection: bifoldOpenDirection,
      // Colour
      sameColor: doorColourState.sameColor,
      woodColor: doorColourState.woodColor,
      woodColorInt: doorColourState.woodColorInt,
      woodColorExt: doorColourState.woodColorExt,
      colorType: doorColourState.sameColor ? 'single' : 'dual',
      colorSingleName: doorColourState.colorName || '',
      colorSingleRal: doorColourState.colorRal || '',
      colorInteriorName: doorColourState.colorIntName || '',
      colorInteriorRal: doorColourState.colorIntRal || '',
      colorExteriorName: doorColourState.colorExtName || '',
      colorExteriorRal: doorColourState.colorExtRal || '',
      // Seal & Ventilation
      sealColour: checked('d-seal-colour') || 'black',
      trickleVent: checked('d-trickle-vent') || 'none',
      trickleColour: checked('d-trickle-colour') || 'white',
      safetyGlass: 'toughened',
      // Ironmongery — doors don't use the sash ironmongery gallery
      ironmongery: {}
    };
  }

  // ─── Update 3D ───
  function updateDoor3D() {
    if (typeof window.update3D !== 'function') return;
    if (!isDoorActive()) return;

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
      transomType: config.transomType,
      transomHeight: config.transomHeight,
      transomBars: config.transomBars,
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
      sillWider: config.sillWider,
      doorOpenDirection: config.openDirection,
      sealColour: config.sealColour,
      trickleVent: config.trickleVent,
      trickleColour: config.trickleColour,
      // Sliding-specific
      panelCount: config.panelCount,
      slideDirection: config.slideDirection,
      extraWidth: config.extraWidth,
      glassWidth: config.glassWidth,
      panelDepth: config.panelDepth,
      frameDepth: config.frameDepth,
      // Bi-fold specific
      foldDirection: config.foldDirection,
      trafficDoor: config.trafficDoor,
      bifoldOpenDirection: config.bifoldOpenDirection
    });

    if (isDoorActive()) window.currentConfig = getDoorConfig();
  }

  // ─── Update spec panel ───
  function updateSpecPanel() {
    if (!isDoorActive()) return;
    var config = getDoorConfig();
    var glassLabels = { 'double': 'Double Glazing', 'triple': 'Triple Glazing', 'passive': 'Passive Glass' };

    // Update hints
    var hintDim = $('hint-door-dim');
    if (hintDim) hintDim.textContent = config.width + ' × ' + config.height + 'mm';

    var hintGlass = $('hint-door-glass');
    if (hintGlass) {
      hintGlass.textContent = glassLabels[config.glassType] || 'Standard DG';
    }

    var hintColour = $('hint-door-colour');
    if (hintColour) {
      hintColour.textContent = config.sameColor ? 'Single' : 'Dual Colour';
    }

    // ─── Spec panel sections ───

    // Door Type name
    var specDoorType = $('spec-d-door-type');
    var doorTypeLabels = { 'single-external': 'Single Patio Door', 'front-door': 'Front Door', 'french': 'French Doors', 'sliding': 'Sliding Door', 'bifold': 'Bi-Fold Door' };
    if (specDoorType) specDoorType.textContent = doorTypeLabels[config.doorType] || 'Single Patio Door';

    // Shape / Style / Paneling / Mullion — hide for sliding/bifold
    var isSliding = config.doorType === 'sliding';
    var isBifold = config.doorType === 'bifold';
    var isSlidingOrBifold = isSliding || isBifold;

    var specShape = $('spec-d-shape');
    var shapeLabels = { 'standard': 'Standard', 'arched': 'Arched', 'glazed-arch': 'Glazed Arch' };
    if (specShape) {
      specShape.textContent = shapeLabels[config.doorShape] || 'Standard';
      specShape.parentElement.style.display = isSlidingOrBifold ? 'none' : '';
    }

    var specStyle = $('spec-d-style');
    var styleLabels = { 'full-glass': 'Full Glass', 'three-quarter': '¾ Glass', 'half-glazed': 'Half Glass' };
    if (specStyle) {
      specStyle.textContent = styleLabels[config.doorStyle] || 'Full Glass';
      specStyle.parentElement.style.display = isSliding ? 'none' : '';
    }

    var specPaneling = $('spec-d-paneling');
    var panelingLabels = { 'flat': 'Flat', 'panel': 'Recessed Panel', 'beading': 'Beading', 'bespoke': 'Bespoke' };
    var panelingItem = $('spec-d-paneling-item');
    if (specPaneling) specPaneling.textContent = panelingLabels[config.doorPaneling] || 'Flat';
    if (panelingItem) panelingItem.style.display = (isSliding || config.doorStyle === 'full-glass') ? 'none' : '';

    var specMullion = $('spec-d-mullion');
    var mullionItem = $('spec-d-mullion-item');
    if (specMullion) specMullion.textContent = config.centerMullion ? 'Yes' : 'No';
    if (mullionItem) mullionItem.style.display = (isSlidingOrBifold || config.doorStyle === 'full-glass') ? 'none' : '';

    var sideStyleItem = $('spec-d-side-style-item');
    var sideStyleVal = $('spec-d-side-style');
    var sp = config.sidePanels || 'none';
    var sideStyleLabels = { 'full-glass': 'Full Glass', 'same': 'Same as Door' };
    if (sideStyleItem && sideStyleVal) {
      if (sp !== 'none') {
        sideStyleItem.style.display = '';
        sideStyleVal.textContent = sideStyleLabels[config.sideStyle] || 'Full Glass';
      } else {
        sideStyleItem.style.display = 'none';
      }
    }

    // Dimensions
    var specW = $('spec-d-width');
    var specH = $('spec-d-height');
    if (specW) specW.textContent = config.width + 'mm';
    if (specH) specH.textContent = config.height + 'mm';

    var panelsItem = $('spec-d-panels-item');
    var panelsVal = $('spec-d-panels');
    var sp = config.sidePanels || 'none';
    if (panelsItem && panelsVal) {
      var panelsLabel = $('spec-d-panels-label');
      if (isSliding) {
        panelsItem.style.display = '';
        if (panelsLabel) panelsLabel.textContent = 'Panels:';
        panelsVal.textContent = config.panelCount + ' panels, panel ' + config.panelWidth + 'mm × ' + config.panelDepth + 'mm';
      } else if (isBifold) {
        panelsItem.style.display = '';
        if (panelsLabel) panelsLabel.textContent = 'Panels:';
        panelsVal.textContent = config.panelCount + ' panels, panel ' + config.panelWidth + 'mm × ' + config.panelDepth + 'mm';
      } else if (sp !== 'none') {
        panelsItem.style.display = '';
        if (panelsLabel) panelsLabel.textContent = 'Side Panels:';
        var panelDesc = [];
        if (sp === 'left' || sp === 'both') panelDesc.push('Left ' + (config.sideLeftWidth || 500) + 'mm');
        if (sp === 'right' || sp === 'both') panelDesc.push('Right ' + (config.sideRightWidth || 500) + 'mm');
        panelsVal.textContent = panelDesc.join(' + ');
      } else {
        panelsItem.style.display = 'none';
      }
    }

    // Transom spec line (french only)
    var transomItem = $('spec-d-transom-item');
    var transomVal = $('spec-d-transom');
    if (transomItem && transomVal) {
      if (config.doorType === 'french' && config.transomType && config.transomType !== 'none') {
        transomItem.style.display = '';
        var tLabel = (config.transomType === 'opening' ? 'Opening (Top-Hung)' : 'Fixed') + ' \u00b7 ' + config.transomHeight + 'mm';
        if (config.transomBars === 'match') tLabel += ' \u00b7 Bars: match door';
        transomVal.textContent = tLabel;
      } else {
        transomItem.style.display = 'none';
      }
    }

    // Bars
    var specBars = $('spec-d-bars');
    if (specBars) {
      var hb = config.hBars || 0;
      var vb = config.vBars || 0;
      if (hb === 0 && vb === 0) {
        specBars.textContent = 'None';
      } else {
        specBars.textContent = hb + 'H × ' + vb + 'V';
      }
    }

    var sideBarsItem = $('spec-d-side-bars-item');
    var sideBarsVal = $('spec-d-side-bars');
    if (sideBarsItem && sideBarsVal) {
      if (sp !== 'none') {
        sideBarsItem.style.display = '';
        var sh = config.sideHBars || 0;
        var sv = config.sideVBars || 0;
        sideBarsVal.textContent = (sh === 0 && sv === 0) ? 'None' : sh + 'H × ' + sv + 'V';
      } else {
        sideBarsItem.style.display = 'none';
      }
    }

    // Design
    var specHinge = $('spec-d-hinge');
    if (specHinge) {
      if (isSliding) {
        specHinge.textContent = config.panelCount + ' Panels' + (config.extraWidth ? ' (Extra Width)' : '');
      } else if (isBifold) {
        specHinge.textContent = config.panelCount + ' Panels';
      } else {
        specHinge.textContent = (config.hingeSide || 'left') === 'left' ? 'Right' : 'Left';
      }
    }

    // Update hinge label for sliding/bifold
    var hingeLabel = $('spec-d-hinge-label');
    if (hingeLabel) hingeLabel.textContent = (isSliding || isBifold) ? 'Panels:' : 'Open First:';

    var specOpening = $('spec-d-opening');
    if (specOpening) {
      if (isSliding) {
        var dirLabels = {
          'left-to-right': 'Left → Right (exterior view)',
          'right-to-left': 'Right → Left (exterior view)',
          'from-center': 'Open from Center (exterior view)',
          'from-sides': 'Open from Sides (exterior view)'
        };
        specOpening.textContent = dirLabels[config.slideDirection] || 'Left → Right (exterior view)';
      } else if (isBifold) {
        var foldLabel = config.foldDirection === 'left' ? 'Fold Left (exterior view)' : 'Fold Right (exterior view)';
        var trafficLabel = config.trafficDoor === 'yes' ? ' + Traffic Door' : '';
        var openLabel = config.bifoldOpenDirection === 'inward' ? ' (Inward)' : ' (Outward)';
        specOpening.textContent = foldLabel + trafficLabel + openLabel;
      } else {
        specOpening.textContent = (config.openDirection || 'outward') === 'outward' ? 'Outward' : 'Inward';
      }
    }

    // Update opening label for sliding/bifold
    var openingLabel = $('spec-d-opening-label');
    if (openingLabel) openingLabel.textContent = isSliding ? 'Slide Direction:' : (isBifold ? 'Fold Config:' : 'Opening:');

    var specThreshold = $('spec-d-threshold');
    var thresholdLabels = { 'standard': 'Standard Hardwood', 'aluminium': 'Aluminium', 'low-profile': 'Low Profile' };
    if (specThreshold) {
      specThreshold.textContent = thresholdLabels[config.threshold] || 'Standard Hardwood';
      specThreshold.parentElement.style.display = isSlidingOrBifold ? 'none' : '';
    }

    var extItem = $('spec-d-extension-item');
    var extVal = $('spec-d-extension');
    if (extItem && extVal) {
      var ext = config.thresholdExtension || 0;
      if (ext > 0 && config.threshold === 'standard') {
        extItem.style.display = '';
        extVal.textContent = ext + 'mm' + (config.sillWider ? ' (wider)' : '');
      } else {
        extItem.style.display = 'none';
      }
    }

    // Glass
    var specGlassType = $('spec-d-glass-type');
    if (specGlassType) specGlassType.textContent = glassLabels[config.glassType] || 'Double Glazing';

    var specGlassFinish = $('spec-d-glass-finish');
    if (specGlassFinish) {
      var finishLabels = { 'clear': 'Clear', 'frosted': 'Frosted' };
      specGlassFinish.textContent = finishLabels[config.glassFinish] || 'Clear';
    }

    var specSpacer = $('spec-d-spacer');
    if (specSpacer) {
      var spacerLabels = { 'silver': 'Silver', 'white': 'White', 'black': 'Black' };
      specSpacer.textContent = spacerLabels[config.spacerColor] || 'Silver';
    }

    // Colour
    var singleEl = $('spec-d-single-color');
    var dualEl = $('spec-d-dual-color');
    if (singleEl && dualEl) {
      if (doorColourState.sameColor) {
        singleEl.style.display = '';
        dualEl.style.display = 'none';
        var nameEl = $('spec-d-color-name');
        if (nameEl) {
          var cn = doorColourState.colorName || '';
          var cr = doorColourState.colorRal || '';
          nameEl.textContent = cn ? (cr ? cn + ' (' + cr + ')' : cn) : (doorColourState.woodColor || 'White');
        }
      } else {
        singleEl.style.display = 'none';
        dualEl.style.display = '';
        var intEl = $('spec-d-int-color');
        var extEl = $('spec-d-ext-color');
        if (intEl) {
          var cin = doorColourState.colorIntName || '';
          var cir = doorColourState.colorIntRal || '';
          intEl.textContent = cin ? (cir ? cin + ' (' + cir + ')' : cin) : (doorColourState.woodColorInt || 'White');
        }
        if (extEl) {
          var cen = doorColourState.colorExtName || '';
          var cer = doorColourState.colorExtRal || '';
          extEl.textContent = cen ? (cer ? cen + ' (' + cer + ')' : cen) : (doorColourState.woodColorExt || 'White');
        }
      }
    }

    // Hardware
    var specLock = $('spec-d-lock');
    var lockLabels = { 'multipoint': 'Multipoint Lock', 'deadbolt': 'Deadbolt' };
    if (specLock) {
      specLock.textContent = lockLabels[config.lockType] || 'Multipoint Lock';
      specLock.parentElement.style.display = isSlidingOrBifold ? 'none' : '';
    }

    var specSeal = $('spec-d-seal');
    if (specSeal) specSeal.textContent = (config.sealColour || 'black') === 'black' ? 'Black' : 'White';

    var specTrickle = $('spec-d-trickle');
    if (specTrickle) {
      var tv = config.trickleVent || 'none';
      specTrickle.textContent = tv === 'none' ? 'None' : 'On Frame (' + (config.trickleColour === 'brown' ? 'Brown' : 'White') + ')';
    }

    // Store config globally (only when doors tab active)
    if (isDoorActive()) window.currentConfig = config;
  }

  // ─── Update price ───
  function updateDoorPrice() {
    if (!isDoorActive()) return;

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
    ['d-width', 'd-height', 'd-side-left-width', 'd-side-right-width', 'd-threshold-extension'].forEach(function(id) {
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

    // Door shape/style/paneling changes (single + french + sliding)
    ['door-shape', 'door-style', 'door-paneling', 'door-side-panels', 'door-center-mullion', 'door-side-style',
     'fd-door-shape', 'fd-door-style', 'fd-door-paneling', 'fd-door-side-panels', 'fd-door-center-mullion', 'fd-door-side-style',
     'sl-door-panel-count', 'sl-door-slide-direction', 'sl-door-extra-width',
     'bf-fold-direction', 'bf-traffic-door', 'bf-open-direction',
     'fd-transom-type', 'fd-transom-bars',
     'd-seal-colour', 'd-trickle-vent', 'd-trickle-colour'].forEach(function(name) {
      document.querySelectorAll('input[name="' + name + '"]').forEach(function(radio) {
        radio.addEventListener('change', debouncedUpdate);
      });
    });

    // Bi-fold panel count select
    var bfPanelSel = document.getElementById('bf-door-panel-count');
    if (bfPanelSel) bfPanelSel.addEventListener('change', debouncedUpdate);

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

    // Transom type -> show/hide height+bars options
    function updateTransomUI() {
      var tt = checked('fd-transom-type') || 'none';
      var isFr = (checked('door-type') || '') === 'french';
      var show = isFr && tt !== 'none';
      var row = $('fd-transom-options');
      if (row) row.style.display = show ? '' : 'none';
      var hGroup = $('fd-transom-height-group');
      if (hGroup) hGroup.style.display = show ? '' : 'none';
    }
    document.querySelectorAll('input[name="door-type"]').forEach(function(radio) {
      radio.addEventListener('change', updateTransomUI);
    });
    document.querySelectorAll('input[name="fd-transom-type"]').forEach(function(radio) {
      radio.addEventListener('change', updateTransomUI);
    });
    var transomHeightEl = $('fd-transom-height');
    if (transomHeightEl) transomHeightEl.addEventListener('input', debouncedUpdate);
    updateTransomUI(); // initial state

    // Opening slider — immediate update (no debounce) for smooth animation
    var openSlider = $('d-door-opening');
    var openVal = $('d-door-opening-val');
    if (openSlider && openVal) {
      openSlider.addEventListener('input', function() {
        openVal.textContent = openSlider.value;
        if (window.update3D) {
          window.update3D({ doorOpening: (parseInt(openSlider.value) || 0) / 100 });
        }
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
  }

  init();
})();