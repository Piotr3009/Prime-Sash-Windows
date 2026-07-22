// edit-mode.js — Edit existing window/door from estimate
// Loaded on online-estimate.html AFTER estimate-manager.js
// Checks URL params: ?edit=ITEM_ID&estimate=ESTIMATE_ID

(function() {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const editItemId = params.get('edit');
  const estimateId = params.get('estimate');

  // ─── ADD WINDOW MODE: ?estimate=ID (no edit) ───
  // Client → auto-select their own estimate in the dropdown.
  // Admin  → hard-target the client's estimate: hide selector, show banner,
  //          and return to the admin modal after each window/door is added.
  if (estimateId && !editItemId) {
    document.addEventListener('DOMContentLoaded', () => {
      initAddMode(estimateId);
    });
  }

  // ─── EDIT MODE ───
  if (!editItemId) return;
  // State
  let editItem = null;
  let fullConfig = null;

  // ─── UI Setup ───
  document.addEventListener('DOMContentLoaded', () => {
    // Banner (placeholder — updated after data loads)
    const banner = document.createElement('div');
    banner.id = 'edit-mode-banner';
    banner.style.cssText = 'background:#2a5a3a;color:#fff;padding:.5rem 1.2rem;display:flex;align-items:center;justify-content:space-between;font-family:Jost,sans-serif;font-size:.75rem;letter-spacing:.08em;text-transform:uppercase;position:fixed;top:0;left:0;right:0;z-index:9999;';
    banner.innerHTML = `
      <span id="edit-banner-text">✏️ EDIT MODE — Loading...</span>
      <button id="edit-banner-update" style="background:#fff;color:#2a5a3a;border:none;padding:.35rem 1.2rem;font-family:Jost,sans-serif;font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;border-radius:3px;font-weight:600;">Update Window</button>
    `;
    document.body.prepend(banner);
    document.body.style.paddingTop = '40px';

    // Banner Update button click
    document.getElementById('edit-banner-update').addEventListener('click', () => {
      // Determine if door or window
      const range = (document.querySelector('input[name="product-range"]:checked') || {}).value;
      handleUpdate(range === 'doors');
    });

    // Hide estimate selector (ALL instances — windows + doors panels)
    document.querySelectorAll('.estimate-selector-container').forEach(el => {
      el.style.display = 'none';
    });

    // Change button text
    changeButtonText();

    // Start loading
    loadItemForEdit();
  });

  function changeButtonText() {
    const addBtn = document.getElementById('add-to-estimate');
    if (addBtn) {
      addBtn.textContent = 'Update Window';
      addBtn.style.background = '#2a5a3a';
    }
    const doorBtn = document.getElementById('d-add-to-estimate');
    if (doorBtn) {
      doorBtn.textContent = 'Update Door';
      doorBtn.style.background = '#2a5a3a';
    }
  }

  // ─── Load item from DB ───
  async function loadItemForEdit() {
    try {
      // Wait for supabase
      await waitFor(() => window.supabaseClient, 5000);

      const { data: item, error } = await window.supabaseClient
        .from('estimate_items')
        .select('*')
        .eq('id', editItemId)
        .single();

      if (error) throw error;
      if (!item) throw new Error('Item not found');

      editItem = item;
      const spec = typeof item.specification === 'string'
        ? JSON.parse(item.specification)
        : item.specification;

      fullConfig = spec.fullConfig || spec;
      // Fetch estimate info for banner
      if (estimateId) {
        try {
          const { data: est } = await window.supabaseClient
            .from('estimates')
            .select('estimate_number, customer_id, customers(full_name, email)')
            .eq('id', estimateId)
            .single();

          if (est) {
            const customerName = est.customers?.full_name || est.customers?.email || '';
            const estNum = est.estimate_number || estimateId.slice(0,8);
            const winNum = item.window_number || 'Window';
            const bannerText = document.getElementById('edit-banner-text');
            if (bannerText) {
              bannerText.textContent = `✏️ Editing ${winNum} in Estimate #${estNum}${customerName ? ' — ' + customerName : ''}`;
            }
          }
        } catch (e) { console.warn('Could not load estimate info:', e); }
      }

      // Wait for configurator
      await waitFor(() => window.configuratorCore?.isInitialized && window.currentConfig, 10000);

      // Small delay for all controllers to finish init
      setTimeout(() => prefill(), 500);

    } catch (err) {
      console.error('Edit mode load error:', err);
      showToast('❌ Error loading window: ' + err.message);
    }
  }

  // ─── Prefill router ───
  function prefill() {
    const fc = fullConfig;
    const wType = fc.windowType || editItem.window_type || 'sash';
    const isDoor = fc.windowCategory === 'door' || fc.productType === 'door' ||
                   ['french-doors', 'sliding-doors', 'bifold-doors'].includes(wType);
    const isCasement = !isDoor && (wType === 'casement' || fc.windowCategory === 'casement');
    const isFixOnly = !isDoor && wType === 'fix-only';
    const isSash = !isDoor && !isCasement && !isFixOnly;
    if (isDoor) {
      prefillDoor(fc);
    } else if (isCasement) {
      switchToWindows();
      setRadio('window-type', 'casement');
      setTimeout(() => prefillCasement(fc), 400);
    } else if (isFixOnly) {
      switchToWindows();
      setRadio('window-type', 'fix-only');
      setTimeout(() => prefillFixOnly(fc), 400);
    } else {
      switchToWindows();
      setRadio('window-type', 'sash');
      setTimeout(() => prefillSash(fc), 400);
    }

    // Override save buttons
    setTimeout(() => overrideSaveButtons(), 600);
  }

  // ─── Switch to Windows mode ───
  function switchToWindows() {
    const r = document.querySelector('input[name="product-range"][value="windows"]');
    if (r && !r.checked) { r.checked = true; r.dispatchEvent(new Event('change', {bubbles:true})); }
  }

  // ══════════════════════════════════════════════
  // ═══ SASH PREFILL ═════════════════════════════
  // ══════════════════════════════════════════════
  function prefillSash(fc) {
    // For brick-to-brick (structural), input must contain STRUCTURAL dimensions (fc.width)
    // — dimension-handler will add +150/+75 to get frame
    // For box-to-box (frame), input contains FRAME dimensions
    const measurementType = fc.measurementType || 'box-to-box';
    let w, h;
    if (measurementType === 'brick-to-brick') {
      // fc.width = AppState.width = what user typed in input = structural
      w = fc.width || editItem.original_width || editItem.width;
      h = fc.height || editItem.original_height || editItem.height;
    } else {
      w = fc.actualFrameWidth || fc.width || editItem.width;
      h = fc.actualFrameHeight || fc.height || editItem.height;
    }

    // Sub-type
    setRadio('sash-type', fc.sashType || 'double');

    // Wait for triple/double panels to render
    setTimeout(() => {
      // Split ratio & head type
      setSelect('split-ratio', fc.splitRatio);
      setRadio('head-type', fc.headType || 'flat');

      // Set measurement-type BEFORE dimensions so handler knows context
      setRadio('measurement-type', fc.measurementType);

      // Dimensions via DimensionHandler (triggers 3D + display + config)
      setDimensionSash('width', w);
      setDimensionSash('height', h);

      // Glass
      setRadio('frame-type', fc.frameType);
      setRadio('glass-type', fc.glassType);
      setRadio('glass-spec', fc.glassSpec);
      setRadio('glass-finish', fc.glassFinish);
      setRadio('spacer-color', fc.spacerColor || fc.spacer);
      setRadio('frosted-location', fc.frostedLocation);

      // Opening
      setRadio('opening-type', fc.openingType);
      setRadio('pas24', fc.pas24 === true || fc.pas24 === 'yes' ? 'yes' : 'no');

      // Color — direct load like doors (no tile search)
      setRadio('color-type', fc.colorType || fc.colourMode);
      const sashColorType = fc.colorType || fc.colourMode || 'single';
      if (sashColorType === 'single') {
        const hex = fc.woodColor || lookupColorHex(fc.colorSingle, fc.colorSingleName, 'single') || '#F6F6F6';
        if (window.currentConfig) {
          window.currentConfig.colorType = 'single';
          window.currentConfig.colorSingle = fc.colorSingle || 'white';
          window.currentConfig.colorSingleName = fc.colorSingleName || 'Pure White';
          window.currentConfig.colorSingleRal = fc.colorSingleRal || '';
          window.currentConfig.singleColor = fc.colorSingle || 'white';
          window.currentConfig.woodColor = hex;
          window.currentConfig.woodColorExt = hex;
          window.currentConfig.woodColorInt = hex;
          window.currentConfig.sameColor = true;
        }
        if (window.update3D) window.update3D({ woodColor: hex, sameColor: true });
      } else if (sashColorType === 'dual') {
        // For old estimates: look up hex from color key or F&B name
        const hexInt = fc.woodColorInt || fc.woodColor || lookupColorHex(fc.colorInterior, fc.colorInteriorName, 'int') || '#F6F6F6';
        const hexExt = fc.woodColorExt || fc.woodColor || lookupColorHex(fc.colorExterior, fc.colorExteriorName, 'ext') || '#F6F6F6';
        if (window.currentConfig) {
          window.currentConfig.colorType = 'dual';
          window.currentConfig.colorInteriorName = fc.colorInteriorName || '';
          window.currentConfig.colorInteriorRal = fc.colorInteriorRal || '';
          window.currentConfig.colorExteriorName = fc.colorExteriorName || '';
          window.currentConfig.colorExteriorRal = fc.colorExteriorRal || '';
          window.currentConfig.woodColorInt = hexInt;
          window.currentConfig.woodColorExt = hexExt;
          window.currentConfig.sameColor = false;
        }
        if (window.update3D) window.update3D({ woodColorInt: hexInt, woodColorExt: hexExt, sameColor: false });
        console.log('[EDIT] Dual color: int=' + hexInt + ' ext=' + hexExt + ' keys=' + fc.colorInterior + '/' + fc.colorExterior);
      }
      // Fallback for old estimates without woodColor hex — try lookup
      if (!fc.woodColor && fc.colorSingleName && sashColorType === 'single') {
        const fallbackHex = lookupColorHex(fc.colorSingle, fc.colorSingleName, 'single');
        if (fallbackHex) {
          if (window.currentConfig) { window.currentConfig.woodColor = fallbackHex; window.currentConfig.woodColorExt = fallbackHex; window.currentConfig.woodColorInt = fallbackHex; }
          if (window.update3D) window.update3D({ woodColor: fallbackHex, sameColor: true });
        }
      }

      // Bars: restore sameBars checkbox FIRST (affects lower bars handler)
      // Uncheck if: flag is false OR upper and lower bars are different
      const barsAreDifferent = fc.upperBars && fc.lowerBars && fc.upperBars !== fc.lowerBars;
      if (fc.sameBars === false || barsAreDifferent) {
        const sameChk = document.getElementById('same-bars-both-sashes');
        if (sameChk && sameChk.checked) {
          sameChk.checked = false;
          sameChk.dispatchEvent(new Event('change', {bubbles: true}));
        }
      }
      // Bars (upper-bars and lower-bars are <select> elements, not radios)
      setSelect('upper-bars', fc.upperBars);
      setSelect('lower-bars', fc.lowerBars);

      // Custom bars: restore positions via barsController + local arrays + 3D
      if (fc.upperBars === 'custom' || fc.lowerBars === 'custom') {
        // Convert flat format [{type,mm}] to nested {horizontal:[], vertical:[]} for barsController
        const flatToNested = (arr) => {
          if (!arr || !Array.isArray(arr)) return { horizontal: [], vertical: [] };
          return {
            horizontal: arr.filter(b => b.type === 'h').map(b => ({ type: 'h', mm: b.mm })),
            vertical: arr.filter(b => b.type === 'v').map(b => ({ type: 'v', mm: b.mm }))
          };
        };
        // Get flat format for local arrays + 3D
        const getCustomFlat = (nested, flat) => {
          if (flat && Array.isArray(flat) && flat.length > 0) return flat;
          if (nested) {
            const result = [];
            if (nested.horizontal) nested.horizontal.forEach(b => result.push({ type: 'h', mm: b.mm }));
            if (nested.vertical) nested.vertical.forEach(b => result.push({ type: 'v', mm: b.mm }));
            return result;
          }
          return [];
        };
        const upperFlat = getCustomFlat(fc.customBars?.upper, fc.upperCustomBars);
        const lowerFlat = getCustomFlat(fc.customBars?.lower, fc.lowerCustomBars);

        // 1. Populate LOCAL arrays in IIFE (for liveUpdate + getCustomBars to work)
        if (window.setCustomBars) {
          window.setCustomBars(upperFlat, lowerFlat);
        }
        // 2. Set barsController internal state (for canvas preview)
        const upperNested = (fc.customBars && fc.customBars.upper) || flatToNested(upperFlat);
        const lowerNested = (fc.customBars && fc.customBars.lower) || flatToNested(lowerFlat);
        if (window.barsController) {
          window.barsController.setState({
            upper: { pattern: fc.upperBars || 'none', bars: upperNested },
            lower: { pattern: fc.lowerBars || 'none', bars: lowerNested }
          });
        }
      }
      // Send bars to 3D (works for all patterns incl. custom)
      if (window.update3D) {
        const getFlat = (nested, flat) => {
          if (flat && Array.isArray(flat) && flat.length > 0) return flat;
          if (nested) { const r = []; if (nested.horizontal) nested.horizontal.forEach(b => r.push({type:'h',mm:b.mm})); if (nested.vertical) nested.vertical.forEach(b => r.push({type:'v',mm:b.mm})); return r; }
          return [];
        };
        window.update3D({
          upperBars: fc.upperBars || 'none',
          lowerBars: fc.lowerBars || 'none',
          sameBars: fc.sameBars !== undefined ? fc.sameBars : true,
          upperCustomBars: getFlat(fc.customBars?.upper, fc.upperCustomBars),
          lowerCustomBars: getFlat(fc.customBars?.lower, fc.lowerCustomBars)
        });
      }

      // Horns
      if (fc.horns && fc.horns !== 'none') setSelect('horns', fc.horns);

      // Quantity & Name
      setInput('window-quantity', fc.quantity || editItem.quantity || 1, 'input');
      if (editItem.window_number) setInput('window-custom-name', editItem.window_number);

      // Ironmongery (gallery + 3D)
      restoreIronmongery(fc);

      // ── Update spec panel & menu with color names ──
      updateSpecColor(fc);

      // SAFETY NET: recalculate after all events settle + wait for DB prices
      setTimeout(async () => {
        if (window.pricingReadyPromise) await window.pricingReadyPromise;
        triggerUpdate();
        updateSpecColor(fc);
      }, 800);
    }, 300);
  }

  // ══════════════════════════════════════════════
  // ═══ CASEMENT PREFILL ═════════════════════════
  // ══════════════════════════════════════════════
  function prefillCasement(fc) {
    const w = fc.actualFrameWidth || fc.width || editItem.width;
    const h = fc.actualFrameHeight || fc.height || editItem.height;

    // Sub-type (standard/arched)
    setRadio('casement-type', fc.casementType || 'standard');

    // Arched casement fields
    if (fc.casementType === 'arched') {
      setRadio('cas-arch-shape', fc.casArchShape || 'gothic-arch');
      setRadio('cas-arch-opening', fc.casArchHinge || 'right');
    }

    // Layout
    setRadio('casement-layout', fc.casementLayout || fc.layout || editItem.casement_layout);

    // 022 clickable openers restore
    if (Array.isArray(fc.casementHinges)) {
      window.currentConfig = window.currentConfig || {};
      window.currentConfig.casementHinges = fc.casementHinges.slice();
      if (typeof window.update3D === 'function') window.update3D({ casementHinges: fc.casementHinges.slice() });
      if (window.CasementTypeModal && window.CasementTypeModal.setHinges) window.CasementTypeModal.setHinges(fc.casementHinges.slice());
    }

    // Dimensions (c-prefixed selects + hidden inputs)
    setCasementDimension('c-width', w);
    setCasementDimension('c-height', h);

    // Fanlight height
    if (fc.fanlightHeight) setSelect('c-fanlight-height', fc.fanlightHeight);

    // Fanlight bars restore
    setRadio('c-fan-hbars', String(Math.min(2, fc.casementFanHBars || 0)));
    setRadio('c-fan-vbars', String(Math.min(2, fc.casementFanVBars || 0)));

    // Glass (c-prefixed)
    setRadio('c-glass-type', fc.glassType);
    setRadio('c-glass-spec', fc.glassSpec);
    setRadio('c-glass-finish', fc.glassFinish);
    setRadio('c-pas24', fc.pas24 === true || fc.pas24 === 'yes' ? 'yes' : 'no');
    setRadio('c-safety-glass', fc.safetyGlass || 'none');

    // Spacer
    setRadio('spacer-color', fc.spacerColor || fc.spacer);

    // Color — direct load like doors (set casementColourState directly)
    setRadio('c-color-type', fc.colorType || fc.colourMode);
    if (window.casementColourState) {
      const isSingle = (fc.colorType || fc.colourMode || 'single') === 'single';
      const casHex = fc.woodColor || lookupColorHex(fc.colorSingle, fc.colorSingleName, 'single', 'c-') || '#F6F6F6';
      const casHexInt = fc.woodColorInt || (isSingle ? casHex : (lookupColorHex(fc.colorInterior, fc.colorInteriorName, 'int', 'c-') || '#F6F6F6'));
      const casHexExt = fc.woodColorExt || (isSingle ? casHex : (lookupColorHex(fc.colorExterior, fc.colorExteriorName, 'ext', 'c-') || '#F6F6F6'));
      window.casementColourState.sameColor = isSingle;
      window.casementColourState.woodColor = casHex;
      window.casementColourState.woodColorInt = casHexInt;
      window.casementColourState.woodColorExt = casHexExt;
    }
    if (window.update3D) {
      const isSingle = (fc.colorType || fc.colourMode || 'single') === 'single';
      const casHex = fc.woodColor || lookupColorHex(fc.colorSingle, fc.colorSingleName, 'single', 'c-') || '#F6F6F6';
      window.update3D({
        woodColor: casHex,
        woodColorInt: fc.woodColorInt || casHex,
        woodColorExt: fc.woodColorExt || casHex,
        sameColor: isSingle
      });
    }

    // Seal, trickle (+ colour), sill
    setRadio('c-seal-colour', fc.sealColour || editItem.seal_colour);
    setRadio('c-trickle-vent', fc.trickleVent || editItem.trickle_vent);
    setRadio('c-trickle-colour', fc.trickleColour || 'white');
    setRadio('c-sill-ext', fc.sillExtension || editItem.sill_extension);
    setRadio('c-sill-wider', fc.sillWider ? 'yes' : 'no');

    // Bars (c-prefixed for standard, f-prefixed for arched)
    if (fc.casementType === 'arched') {
      if (fc.hBars !== undefined) setRadio('f-hbars', String(fc.hBars || fc.casementHBars || 0));
      if (fc.vBars !== undefined) setRadio('f-vbars', String(fc.vBars || fc.casementVBars || 0));
      if (fc.fixSemiBarPattern) setRadio('f-semi-bars', fc.fixSemiBarPattern);
      if (fc.fixGothicBars) setRadio('f-gothic-bars', fc.fixGothicBars);
    } else {
      const hb = fc.hBars || fc.casementHBars || fc.upperBars || editItem.upper_bars;
      const vb = fc.vBars || fc.casementVBars || fc.lowerBars || editItem.lower_bars;
      if (hb) setRadio('c-hbars', String(hb));
      if (vb) setRadio('c-vbars', String(vb));
    }

    // Quantity & Name
    setInput('c-quantity', fc.quantity || editItem.quantity || 1);
    if (editItem.window_number) setInput('window-custom-name', editItem.window_number);

    // Ironmongery
    restoreIronmongery(fc);

    // Update spec panel & menu with color names
    updateSpecColor(fc);

    // SAFETY NET: recalculate after all events settle + wait for DB prices
    setTimeout(async () => {
      if (window.pricingReadyPromise) await window.pricingReadyPromise;
      if (window.updateCasementPrice) window.updateCasementPrice();
      if (window.updateCasementSpec) window.updateCasementSpec();
      updateSpecColor(fc);
    }, 800);
  }

  // ══════════════════════════════════════════════
  // ═══ FIX-ONLY PREFILL ═════════════════════════
  // ══════════════════════════════════════════════
  function prefillFixOnly(fc) {
    const w = fc.actualFrameWidth || fc.width || editItem.width;
    const h = fc.actualFrameHeight || fc.height || editItem.height;

    // Fix type (standard/fd30/fd60) & shape (rectangle/gothic-arch/semi-circle/etc)
    setRadio('fix-type', fc.fixType || 'standard');
    setRadio('fix-shape', fc.fixShape || fc.shape || 'rectangle');

    // Dimensions (number inputs)
    setInput('fix-width', w, 'input');
    setInput('fix-height', h, 'input');

    // Arch rise (slider — for segmental/elliptical shapes)
    if (fc.fixArchRise) {
      const slider = document.getElementById('fix-arch-rise');
      if (slider) { slider.value = fc.fixArchRise; slider.dispatchEvent(new Event('input', {bubbles:true})); }
      const display = document.getElementById('fix-arch-rise-value');
      if (display) display.textContent = fc.fixArchRise;
    }

    // Glass (f-prefixed — note: glass TYPE is 'f-glazing', not 'f-glass-type')
    setRadio('f-glazing', fc.glassType || 'double');
    setRadio('f-glass-finish', fc.glassFinish || 'clear');
    setRadio('f-spacer', fc.spacerColor || fc.spacer || 'white');

    // Bars (f-prefixed)
    if (fc.casementHBars !== undefined || fc.hBars !== undefined) {
      setRadio('f-hbars', String(fc.casementHBars || fc.hBars || 0));
    }
    if (fc.casementVBars !== undefined || fc.vBars !== undefined) {
      setRadio('f-vbars', String(fc.casementVBars || fc.vBars || 0));
    }

    // Bar patterns (shape-specific)
    if (fc.fixSemiBarPattern) setRadio('f-semi-bars', fc.fixSemiBarPattern);
    if (fc.fixGothicBars) setRadio('f-gothic-bars', fc.fixGothicBars);
    if (fc.fixCircleBarPattern) setRadio('f-circle-bars', fc.fixCircleBarPattern);

    // Circle offset
    if (fc.fixCircleOffset) {
      const offsetEl = document.getElementById('f-circle-offset');
      if (offsetEl) { offsetEl.value = fc.fixCircleOffset; offsetEl.dispatchEvent(new Event('input', {bubbles:true})); }
    }

    // Color (fix-only uses fx-colour-mode, NOT color-type)
    const fixColorMode = fc.colorType === 'dual' ? 'dual' : 'same';
    setRadio('fx-colour-mode', fixColorMode);
    setTimeout(() => setWindowColor(fc, 'fix-only'), 200);

    // Quantity
    setInput('fix-quantity', fc.quantity || editItem.quantity || 1);

    // Update 3D with fix-specific data
    if (window.update3D) {
      window.update3D({
        fixShape: fc.fixShape || fc.shape || 'rectangle',
        fixType: fc.fixType || 'standard',
        fixArchRise: fc.fixArchRise || 0
      });
    }

    // Update fix spec panel
    if (window.updateFixSpec) window.updateFixSpec();
    if (window.updateFixPrice) window.updateFixPrice();
  }

  // ══════════════════════════════════════════════
  // ═══ DOOR PREFILL ═════════════════════════════
  // ══════════════════════════════════════════════
  function prefillDoor(fc) {
    const w = fc.actualFrameWidth || fc.width || editItem.width;
    const h = fc.actualFrameHeight || fc.height || editItem.height;
    const doorType = fc.doorType || 'french';

    // Switch to doors
    const doorsRadio = document.querySelector('input[name="product-range"][value="doors"]');
    if (doorsRadio) { doorsRadio.checked = true; doorsRadio.dispatchEvent(new Event('change', {bubbles:true})); }

    // Set door type (after doors panel renders)
    setTimeout(() => {
      setRadio('door-type', doorType);

      // Wait for door controller to set defaults, then override
      setTimeout(() => {
        // Dimensions (number inputs — set AFTER door controller defaults)
        setInput('d-width', w, 'input');
        setInput('d-height', h, 'input');

        // French-specific (uses fd-door- prefix)
        if (doorType === 'french') {
          setRadio('fd-door-shape', fc.doorShape);
          setRadio('fd-door-style', fc.doorStyle);
          setRadio('fd-door-paneling', fc.doorPaneling);
          setRadio('fd-door-side-panels', fc.sidePanels);
          setRadio('fd-door-side-style', fc.sideStyle);
          setRadio('fd-door-center-mullion', fc.centerMullion);
        }

        // Single external (uses door- prefix)
        if (doorType === 'single-external') {
          setRadio('door-shape', fc.doorShape);
          setRadio('door-style', fc.doorStyle);
          setRadio('door-paneling', fc.doorPaneling);
          setRadio('door-side-panels', fc.sidePanels);
          setRadio('door-side-style', fc.sideStyle);
          setRadio('door-center-mullion', fc.centerMullion);
        }

        // Shared: lock, threshold, hinge, open direction, side panel dims
        if (doorType === 'french' || doorType === 'single-external') {
          setRadio('d-lock-type', fc.lockType);
          setRadio('d-threshold', fc.threshold);
          if (fc.thresholdExtension) setInput('d-threshold-extension', fc.thresholdExtension, 'input');
          if (fc.sideLeftWidth) setInput('d-side-left-width', fc.sideLeftWidth, 'input');
          if (fc.sideRightWidth) setInput('d-side-right-width', fc.sideRightWidth, 'input');
          if (fc.hingeSide) setRadio('d-hinge-side', fc.hingeSide);
          if (fc.openDirection) setRadio('d-open-direction', fc.openDirection);
        }

        // Sliding-specific
        if (doorType === 'sliding') {
          setRadio('sl-door-panel-count', String(fc.panelCount));
          setRadio('sl-door-slide-direction', fc.slideDirection);
        }

        // Bi-fold specific
        if (doorType === 'bifold') {
          setSelect('bf-door-panel-count', fc.panelCount);
          setRadio('bf-fold-direction', fc.foldDirection);
          setRadio('bf-traffic-door', fc.trafficDoor);
          setRadio('bf-open-direction', fc.bifoldOpenDirection || fc.openDirection || 'outward');
        }

        // Door opening slider
        if (fc.doorOpening !== undefined) {
          const slider = document.getElementById('d-door-opening');
          if (slider) { slider.value = Math.round(fc.doorOpening * 100); slider.dispatchEvent(new Event('input', {bubbles:true})); }
        }

        // Glass (d-prefixed)
        setRadio('d-glass-type', fc.glassType);
        setRadio('d-glass-finish', fc.glassFinish);
        setRadio('d-spacer-color', fc.spacerColor || fc.spacer);

        // Seal & trickle
        setRadio('d-seal-colour', fc.sealColour);
        setRadio('d-trickle-vent', fc.trickleVent);
        setRadio('d-trickle-colour', fc.trickleColour);

        // Bars
        if (fc.hBars !== undefined) setRadio('d-hbars', String(fc.hBars));
        if (fc.vBars !== undefined) setRadio('d-vbars', String(fc.vBars));
        if (fc.sideHBars !== undefined) setRadio('d-side-hbars', String(fc.sideHBars));
        if (fc.sideVBars !== undefined) setRadio('d-side-vbars', String(fc.sideVBars));

        // Sill wider (checkbox)
        const sillWider = document.getElementById('d-sill-wider');
        if (sillWider) sillWider.checked = !!fc.sillWider;

        // Quantity, name, notes
        setInput('d-quantity', fc.quantity || editItem.quantity || 1);
        if (editItem.window_number) setInput('d-custom-name', editItem.window_number);
        if (fc.notes) setInput('d-notes', fc.notes);

        // Door colours
        if (window.doorColourState) {
          window.doorColourState.sameColor = fc.sameColor !== undefined ? fc.sameColor : (fc.colorType === 'single');
          window.doorColourState.woodColor = fc.woodColor || '#F6F6F6';
          window.doorColourState.woodColorInt = fc.woodColorInt || fc.woodColor || '#F6F6F6';
          window.doorColourState.woodColorExt = fc.woodColorExt || fc.woodColor || '#F6F6F6';
          window.doorColourState.colorName = fc.colorSingleName || '';
          window.doorColourState.colorRal = fc.colorSingleRal || '';
          window.doorColourState.colorIntName = fc.colorInteriorName || '';
          window.doorColourState.colorIntRal = fc.colorInteriorRal || '';
          window.doorColourState.colorExtName = fc.colorExteriorName || '';
          window.doorColourState.colorExtRal = fc.colorExteriorRal || '';
        }
        // Door hint + preview (same approach as sash updateSpecColor)
        const dHint = document.getElementById('hint-door-colour');
        const isSingle = fc.sameColor !== undefined ? fc.sameColor : (fc.colorType === 'single');
        if (dHint) dHint.textContent = isSingle ? (fc.colorSingleName || 'White') : 'Dual Colour';
        if (isSingle) {
          const dp = document.getElementById('d-single-preview-name');
          const dr = document.getElementById('d-single-preview-ral');
          if (dp) dp.textContent = fc.colorSingleName || 'Pure White';
          if (dr) dr.textContent = fc.colorSingleRal || '';
        } else {
          const dpi = document.getElementById('d-dual-preview-interior');
          const dpe = document.getElementById('d-dual-preview-exterior');
          if (dpi) dpi.textContent = (fc.colorInteriorName || '') + (fc.colorInteriorRal ? ' (' + fc.colorInteriorRal + ')' : '');
          if (dpe) dpe.textContent = (fc.colorExteriorName || '') + (fc.colorExteriorRal ? ' (' + fc.colorExteriorRal + ')' : '');
        }

        // Ironmongery
        restoreIronmongery(fc);

        // SAFETY NET: re-set dimensions after all events settle
        setTimeout(() => {
          setInput('d-width', w, 'input');
          setInput('d-height', h, 'input');
          if (window.updateDoorSpec) window.updateDoorSpec();
          if (window.updateDoor3D) window.updateDoor3D();
        }, 600);
      }, 400);
    }, 200);
  }

  // ══════════════════════════════════════════════
  // ═══ SAVE: Override buttons ════════════════════
  // ══════════════════════════════════════════════
  function overrideSaveButtons() {
    // Window "Add to Estimate" → "Update Window"
    const addBtn = document.getElementById('add-to-estimate');
    if (addBtn) {
      const newBtn = addBtn.cloneNode(true);
      newBtn.textContent = 'Update Window';
      newBtn.style.background = '#2a5a3a';
      addBtn.parentNode.replaceChild(newBtn, addBtn);
      newBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleUpdate(false);
      });
    }

    // Door "Add Door to Estimate" → "Update Door"
    const doorBtn = document.getElementById('d-add-to-estimate');
    if (doorBtn) {
      const newDoorBtn = doorBtn.cloneNode(true);
      newDoorBtn.textContent = 'Update Door';
      newDoorBtn.style.background = '#2a5a3a';
      doorBtn.parentNode.replaceChild(newDoorBtn, doorBtn);
      newDoorBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleUpdate(true);
      });
    }
  }

  // ─── Handle UPDATE ───
  async function handleUpdate(isDoor) {
    try {
      let windowConfig, price;
      if (isDoor && window.getDoorConfig) {
        windowConfig = window.getDoorConfig();
        windowConfig.windowCategory = 'door';
        windowConfig.windowName = document.getElementById('d-custom-name')?.value || '';
        windowConfig.quantity = parseInt(document.getElementById('d-quantity')?.value) || 1;
        windowConfig.notes = document.getElementById('d-notes')?.value || '';
      } else {
        windowConfig = window.estimateManager.getCurrentWindowConfig();
      }
      price = window.estimateManager.getCurrentPrice();

      if (!windowConfig || !price) {
        showToast('❌ Cannot get window configuration');
        return;
      }

      // Take screenshots
      if (typeof window.captureWindowScreenshots === 'function') {
        try {
          const screenshots = await window.captureWindowScreenshots();
          if (screenshots) {
            windowConfig.screenshots = screenshots;
            if (windowConfig.fullConfig) windowConfig.fullConfig.screenshots = screenshots;
          }
        } catch (e) { console.warn('Screenshot failed:', e); }
      }

      // Build update object (same fields as INSERT in estimate-manager.js)
      const updateData = {
        window_type: windowConfig.windowType || 'sash',
        width: windowConfig.width,
        height: windowConfig.height,
        measurement_type: windowConfig.measurementType,
        original_width: windowConfig.originalWidth,
        original_height: windowConfig.originalHeight,
        frame_type: windowConfig.frameType || null,
        casement_layout: windowConfig.casementLayout || null,
        sill_extension: windowConfig.sillExtension || null,
        trickle_vent: windowConfig.trickleVent || null,
        seal_colour: windowConfig.sealColour || null,
        safety_glass: windowConfig.safetyGlass || null,
        glass_type: windowConfig.glassType || 'double',
        glass_spec: windowConfig.glassSpec,
        glass_finish: windowConfig.glassFinish,
        spacer_color: windowConfig.spacerColor || windowConfig.fullConfig?.spacerColor || 'white',
        frosted_location: windowConfig.glassFinish === 'frosted' ? (windowConfig.frostedLocation || null) : null,
        opening_type: windowConfig.openingType,
        color_type: windowConfig.colorType,
        color_single: (() => {
          const fc2 = windowConfig.fullConfig || {};
          if (windowConfig.colorType === 'single') return fc2.colorSingleName || fc2.singleColor || windowConfig.colorSingle || 'white';
          return windowConfig.colorSingle;
        })(),
        color_interior: (() => {
          const fc2 = windowConfig.fullConfig || {};
          return windowConfig.colorInterior || fc2.interiorColor || fc2.colorInterior || null;
        })(),
        color_exterior: (() => {
          const fc2 = windowConfig.fullConfig || {};
          return windowConfig.colorExterior || fc2.exteriorColor || fc2.colorExterior || null;
        })(),
        custom_exterior_color: windowConfig.customExteriorColor || windowConfig.fullConfig?.customExteriorColor || null,
        upper_bars: windowConfig.upperBars || null,
        lower_bars: windowConfig.lowerBars || null,
        horns: (() => {
          const h = windowConfig.horns || windowConfig.fullConfig?.horns || 'none';
          return h === 'none' ? null : h;
        })(),
        ironmongery: (() => {
          const iron = windowConfig.ironmongery || windowConfig.fullConfig?.ironmongery || null;
          if (!iron) return null;
          return typeof iron === 'string' ? iron : JSON.stringify(iron);
        })(),
        ironmongery_finish: (() => {
          if (windowConfig.ironmongeryFinish) return windowConfig.ironmongeryFinish;
          const iron = windowConfig.fullConfig?.ironmongery;
          if (iron) {
            const products = [iron.lock, iron.fingerLift, iron.pullHandles, iron.stoppers].filter(p => p && p.color);
            if (products.length > 0) return products[0].color;
          }
          return null;
        })(),
        pas24: windowConfig.pas24 === true || windowConfig.pas24 === 'yes' || windowConfig.fullConfig?.pas24 === 'yes' || false,
        quantity: windowConfig.quantity || 1,
        unit_price: price.unitPrice,
        total_price: price.totalPrice,
        specification: JSON.stringify(windowConfig)
      };

      // UPDATE
      const { error } = await window.supabaseClient
        .from('estimate_items')
        .update(updateData)
        .eq('id', editItemId);

      if (error) throw error;

      // Recalculate estimate total
      if (estimateId) {
        const { data: allItems } = await window.supabaseClient
          .from('estimate_items')
          .select('total_price')
          .eq('estimate_id', estimateId);

        if (allItems) {
          const newTotal = allItems.reduce((sum, i) => sum + (parseFloat(i.total_price) || 0), 0);
          await window.supabaseClient
            .from('estimates')
            .update({ total_price: newTotal, updated_at: new Date().toISOString() })
            .eq('id', estimateId);
        }
      }

      showToast('✅ Window updated successfully!');

      setTimeout(() => {
        window.close();
        if (!window.closed) {
          const ref = document.referrer || '';
          window.location.href = ref.includes('admin') ? 'admin-dashboard.html' : 'customer-dashboard.html';
        }
      }, 1500);

    } catch (err) {
      console.error('Update error:', err);
      showToast('❌ Error: ' + err.message);
    }
  }

  // ══════════════════════════════════════════════
  // ═══ HELPERS ══════════════════════════════════
  // ══════════════════════════════════════════════

  // Directly update spec panel & left menu with color info from fullConfig
  function updateSpecColor(fc) {
    const colorType = fc.colorType || fc.colourMode || 'single';
    const isCasement = fc.windowType === 'casement' || fc.windowCategory === 'casement';
    const p = isCasement ? 'c-' : ''; // prefix for casement elements
    const specSection = document.getElementById('spec-color');
    const specSingle = document.getElementById('spec-single-color');
    const specDual = document.getElementById('spec-dual-color');
    const hint = document.getElementById('hint-colour');

    if (specSection) specSection.style.display = 'block';

    if (colorType === 'single') {
      if (specSingle) specSingle.style.display = 'block';
      if (specDual) specDual.style.display = 'none';
      const nameEl = document.getElementById('spec-color-name');
      const ralEl = document.getElementById('spec-color-ral');
      if (nameEl) nameEl.textContent = fc.colorSingleName || 'Pure White';
      if (ralEl) ralEl.textContent = fc.colorSingleRal || 'RAL 9016';
      if (hint) hint.textContent = fc.colorSingleName || 'White';
      // Update color picker preview
      const prevName = document.getElementById(p + 'single-preview-name');
      const prevRal = document.getElementById(p + 'single-preview-ral');
      if (prevName) prevName.textContent = fc.colorSingleName || 'Pure White';
      if (prevRal) prevRal.textContent = fc.colorSingleRal || '#FAFAFA';
    } else {
      if (specSingle) specSingle.style.display = 'none';
      if (specDual) specDual.style.display = 'block';
      const intEl = document.getElementById('spec-interior-color');
      const extEl = document.getElementById('spec-exterior-color');
      if (intEl) intEl.textContent = (fc.colorInteriorName || 'Pure White') + ' (' + (fc.colorInteriorRal || 'RAL 9016') + ')';
      if (extEl) extEl.textContent = (fc.colorExteriorName || 'Pure White') + ' (' + (fc.colorExteriorRal || 'RAL 9016') + ')';
      if (hint) hint.textContent = 'Dual';
      // Update color picker preview
      const prevInt = document.getElementById(p + 'dual-preview-interior');
      const prevExt = document.getElementById(p + 'dual-preview-exterior');
      if (prevInt) prevInt.textContent = (fc.colorInteriorName || 'Pure White') + ' (' + (fc.colorInteriorRal || 'RAL 9016') + ')';
      if (prevExt) prevExt.textContent = (fc.colorExteriorName || 'Pure White') + ' (' + (fc.colorExteriorRal || 'RAL 9016') + ')';
    }
  }

  // Color hex lookup for old estimates that don't have woodColor saved
  const BASIC_COLOR_HEX = {
    // By key
    white: '#FAFAFA', black: '#0A0A0A', anthracite: '#293133', olive: '#424632',
    offwhite: '#F7F9F5', cream: '#F1EFDC', burgundy: '#5E2028', royal: '#222D5A', oak: '#8B6914',
    // By name (old estimates may store name instead of key)
    'pure white': '#FAFAFA', 'jet black': '#0A0A0A', 'anthracite grey': '#293133',
    'olive green': '#424632', 'off-white': '#F7F9F5', 'burgundy red': '#5E2028',
    'royal blue': '#222D5A'
  };
  function lookupColorHex(colorKey, colorName, target, prefix) {
    // 1. Basic color map by key
    if (colorKey && BASIC_COLOR_HEX[colorKey]) return BASIC_COLOR_HEX[colorKey];
    // 2. Basic color map by name (lowercase)
    if (colorKey && BASIC_COLOR_HEX[colorKey.toLowerCase()]) return BASIC_COLOR_HEX[colorKey.toLowerCase()];
    if (colorName && BASIC_COLOR_HEX[colorName.toLowerCase()]) return BASIC_COLOR_HEX[colorName.toLowerCase()];
    // 3. F&B dropdown by name (sash: single-fb-select, casement: c-single-fb-select)
    const p = prefix || '';
    const fbId = target === 'int' ? (p + 'int-fb-select') : target === 'ext' ? (p + 'ext-fb-select') : (p + 'single-fb-select');
    const fbSel = document.getElementById(fbId);
    if (fbSel && colorName) {
      const fbOpt = Array.from(fbSel.options).find(o => o.text.trim().toLowerCase() === colorName.trim().toLowerCase());
      if (fbOpt && fbOpt.value) return fbOpt.value;
    }
    return null;
  }

  function setRadio(name, value) {
    if (value === undefined || value === null) return;
    const radio = document.querySelector(`input[name="${name}"][value="${value}"]`);
    if (radio) {
      radio.checked = true;
      radio.dispatchEvent(new Event('change', {bubbles: true}));
    } else {
      console.warn(`[EDIT] Radio not found: name="${name}" value="${value}"`);
    }
  }

  function setSelect(id, value) {
    if (value === undefined || value === null) return;
    const el = document.getElementById(id);
    if (el) {
      el.value = value;
      el.dispatchEvent(new Event('change', {bubbles: true}));
    }
  }

  function setInput(id, value, eventType) {
    if (value === undefined || value === null) return;
    const el = document.getElementById(id);
    if (el) {
      el.value = value;
      el.dispatchEvent(new Event(eventType || 'change', {bubbles: true}));
    }
  }

  // Sash dimensions — uses DimensionHandler for proper 3D + display update
  function setDimensionSash(dimension, value) {
    if (!value) return;
    const input = document.getElementById(dimension); // hidden input: 'width' or 'height'
    const select = document.getElementById(dimension + '-select');

    if (input) input.value = value;

    // Check if value exists in select options
    if (select) {
      const exists = Array.from(select.options).some(o => o.value === String(value));
      if (exists) {
        select.value = String(value);
      } else {
        select.value = 'custom';
        const wrapper = select.closest('.dimension-input-wrapper');
        if (wrapper) wrapper.classList.add('custom-mode');
        if (input) input.style.display = 'block';
      }
    }

    // Trigger DimensionHandler
    if (window.dimensionHandler) {
      window.dimensionHandler.updateDimension(dimension, parseInt(value));
    }
  }

  // Casement dimensions
  function setCasementDimension(prefix, value) {
    if (!value) return;
    // prefix = 'c-width' or 'c-height'
    const select = document.getElementById(prefix + '-select');
    const input = document.getElementById(prefix);

    if (input) { input.value = value; input.dispatchEvent(new Event('input', {bubbles: true})); }
    if (select) {
      const exists = Array.from(select.options).some(o => o.value === String(value));
      if (exists) {
        select.value = String(value);
        select.dispatchEvent(new Event('change', {bubbles: true}));
      } else {
        select.value = 'custom';
        const wrapper = select.closest('.dimension-input-wrapper');
        if (wrapper) wrapper.classList.add('custom-mode');
        if (input) input.style.display = 'block';
      }
    }
  }

  // Window colors — set directly on config + update 3D (no click() dependency)
  function setWindowColor(fc, windowType) {
    const colorType = fc.colorType || fc.colourMode || 'single';
    const isCasement = windowType === 'casement';
    const isFixOnly = windowType === 'fix-only';

    // Fix-only: set preview elements directly (its own color module)
    if (isFixOnly) {
      const colorName = fc.colorSingleName || 'Pure White';
      const colorRal = fc.colorSingleRal || '#FAFAFA';
      const pn = document.getElementById('fx-single-preview-name');
      const pr = document.getElementById('fx-single-preview-ral');
      if (pn) pn.textContent = colorName;
      if (pr) pr.textContent = colorRal;

      if (colorType === 'dual') {
        const intEl = document.getElementById('fx-dual-preview-interior');
        const extEl = document.getElementById('fx-dual-preview-exterior');
        if (intEl) intEl.textContent = fc.colorInteriorName || '';
        if (extEl) extEl.textContent = fc.colorExteriorName || '';
      }

      // Find hex from sash picker (shared tiles) for 3D
      const colorKey = fc.colorSingle || fc.singleColor;
      const opt = document.querySelector(`.color-option[data-color="${colorKey}"]`) ||
                  document.querySelector(`.color-option[data-name="${colorName}"]`);
      if (opt && window.update3D) {
        let hex = opt.style.backgroundColor || '#FAFAFA';
        if (hex.startsWith('rgb')) {
          const m = hex.match(/\d+/g);
          if (m) hex = '#' + m.slice(0,3).map(v => parseInt(v).toString(16).padStart(2,'0')).join('');
        }
        window.update3D({ woodColor: hex, sameColor: colorType !== 'dual' });
      }

      // Update fix spec panel
      if (window.updateFixSpec) window.updateFixSpec();
      return;
    }

    // Selector prefix: casement has separate picker with c-color-option
    const singleSelector = isCasement ? '#c-single-color-selector .c-color-option' : '#single-color-selector .color-option';
    const intSelector = isCasement ? '.c-interior-color' : '.interior-color';
    const extSelector = isCasement ? '.c-exterior-color' : '.exterior-color';

    if (colorType === 'single') {
      const colorKey = fc.colorSingle || fc.singleColor;
      const colorName = fc.colorSingleName;
      const colorRal = fc.colorSingleRal;

      // Find in correct picker
      const opt = document.querySelector(`${singleSelector}[data-color="${colorKey}"]`) ||
                  document.querySelector(`${singleSelector}[data-name="${colorName}"]`);

      if (opt) {
        // For casement: click works because panel is visible
        if (isCasement) {
          opt.click();
          return;
        }
        // For sash/fix: set config directly (panel may be hidden)
        let hex = opt.style.backgroundColor || '#F6F6F6';
        if (hex.startsWith('rgb')) {
          const m = hex.match(/\d+/g);
          if (m) hex = '#' + m.slice(0,3).map(v => parseInt(v).toString(16).padStart(2,'0')).join('');
        }
        document.querySelectorAll(`${singleSelector}`).forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');

        if (window.currentConfig) {
          window.currentConfig.colorType = 'single';
          window.currentConfig.colorSingle = colorKey || 'white';
          window.currentConfig.colorSingleName = colorName || 'Pure White';
          window.currentConfig.colorSingleRal = colorRal || '';
          window.currentConfig.singleColor = colorKey || 'white';
        }
        if (window.update3D) window.update3D({ woodColor: hex, sameColor: true });
      } else {
        // Tile not found — likely F&B/RAL/custom color (not in basic tile grid)
        const fbPrefix = isCasement ? 'c-' : '';
        const fbSelect = document.getElementById(fbPrefix + 'single-fb-select');
        let hex = null;

        // Strategy 1: Find hex in F&B dropdown by matching option text
        if (fbSelect && colorName) {
          const trimName = colorName.trim();
          const fbOpt = Array.from(fbSelect.options).find(o =>
            o.text.trim() === trimName || o.text.trim().toLowerCase() === trimName.toLowerCase()
          );
          if (fbOpt && fbOpt.value) {
            hex = fbOpt.value; // value is hex like #6a1820
            fbSelect.value = fbOpt.value; // visually select in dropdown (no event)
            // Update preview text
            const previewName = document.getElementById(isCasement ? 'c-single-preview-name' : 'single-preview-name');
            const previewRal = document.getElementById(isCasement ? 'c-single-preview-ral' : 'single-preview-ral');
            if (previewName) previewName.textContent = colorName;
            if (previewRal) previewRal.textContent = hex;
          }
        }

        // Strategy 2: colorSingleRal might be a hex directly
        if (!hex && colorRal && /^#[0-9A-Fa-f]{6}$/.test(colorRal)) {
          hex = colorRal;
        }

        // Strategy 3: absolute fallback
        if (!hex) hex = '#F6F6F6';

        if (window.currentConfig) {
          window.currentConfig.colorType = 'single';
          window.currentConfig.colorSingle = colorKey || 'custom';
          window.currentConfig.colorSingleName = colorName || 'Pure White';
          window.currentConfig.colorSingleRal = colorRal || '';
          window.currentConfig.singleColor = colorKey || 'custom';
        }
        if (window.update3D) window.update3D({ woodColor: hex, sameColor: true });
        console.log('[EDIT] Color fallback: name=' + colorName + ', hex=' + hex);
      }

    } else if (colorType === 'dual') {
      const intKey = fc.colorInterior || fc.colorInteriorName;
      const extKey = fc.colorExterior || fc.colorExteriorName;

      if (isCasement) {
        // Click casement interior/exterior tiles directly
        const intOpt = document.querySelector(`${intSelector}[data-color="${intKey}"]`) ||
                       document.querySelector(`${intSelector}[data-name="${fc.colorInteriorName}"]`);
        const extOpt = document.querySelector(`${extSelector}[data-color="${extKey}"]`) ||
                       document.querySelector(`${extSelector}[data-name="${fc.colorExteriorName}"]`);
        if (intOpt) intOpt.click();
        if (extOpt) extOpt.click();
        return;
      }

      // Sash/fix: set config directly
      let intHex = '#F6F6F6', extHex = '#F6F6F6';
      const fbPrefix2 = isCasement ? 'c-' : '';
      const intOpt = document.querySelector(`${intSelector}[data-color="${intKey}"]`) ||
                     document.querySelector(`${intSelector}[data-name="${fc.colorInteriorName}"]`);
      if (intOpt) {
        intHex = intOpt.style.backgroundColor || '#F6F6F6';
        if (intHex.startsWith('rgb')) { const m = intHex.match(/\d+/g); if (m) intHex = '#' + m.slice(0,3).map(v => parseInt(v).toString(16).padStart(2,'0')).join(''); }
        document.querySelectorAll(intSelector).forEach(o => o.classList.remove('selected'));
        intOpt.classList.add('selected');
      } else if (fc.colorInteriorName) {
        // F&B fallback for interior
        const fbSel = document.getElementById(fbPrefix2 + 'int-fb-select');
        if (fbSel) {
          const fbOpt = Array.from(fbSel.options).find(o => o.text.trim() === fc.colorInteriorName.trim());
          if (fbOpt && fbOpt.value) { intHex = fbOpt.value; fbSel.value = fbOpt.value; }
        }
        console.log('[EDIT] Dual interior F&B fallback:', fc.colorInteriorName, intHex);
      }
      const extOpt = document.querySelector(`${extSelector}[data-color="${extKey}"]`) ||
                     document.querySelector(`${extSelector}[data-name="${fc.colorExteriorName}"]`);
      if (extOpt) {
        extHex = extOpt.style.backgroundColor || '#F6F6F6';
        if (extHex.startsWith('rgb')) { const m = extHex.match(/\d+/g); if (m) extHex = '#' + m.slice(0,3).map(v => parseInt(v).toString(16).padStart(2,'0')).join(''); }
        document.querySelectorAll(extSelector).forEach(o => o.classList.remove('selected'));
        extOpt.classList.add('selected');
      } else if (fc.colorExteriorName) {
        // F&B fallback for exterior
        const fbSel = document.getElementById(fbPrefix2 + 'ext-fb-select');
        if (fbSel) {
          const fbOpt = Array.from(fbSel.options).find(o => o.text.trim() === fc.colorExteriorName.trim());
          if (fbOpt && fbOpt.value) { extHex = fbOpt.value; fbSel.value = fbOpt.value; }
        }
        console.log('[EDIT] Dual exterior F&B fallback:', fc.colorExteriorName, extHex);
      }

      if (window.currentConfig) {
        window.currentConfig.colorType = 'dual';
        window.currentConfig.colorSingle = null;
        window.currentConfig.colorInterior = intKey;
        window.currentConfig.colorInteriorName = fc.colorInteriorName || '';
        window.currentConfig.colorInteriorRal = fc.colorInteriorRal || '';
        window.currentConfig.colorExterior = extKey;
        window.currentConfig.colorExteriorName = fc.colorExteriorName || '';
        window.currentConfig.colorExteriorRal = fc.colorExteriorRal || '';
      }
      if (window.update3D) window.update3D({ woodColorInt: intHex, woodColorExt: extHex, sameColor: false });
    }

    if (window.specificationController?.updateColourSpec) window.specificationController.updateColourSpec();
  }

  function triggerUpdate() {
    if (window.configuratorCore) window.configuratorCore.updateAll();
  }

  // Restore ironmongery: gallery display + 3D hardware
  function restoreIronmongery(fc) {
    if (!fc.ironmongery) return;
    window.currentConfig.ironmongery = fc.ironmongery;

    // Update gallery selection display (miniatures under "SELECTED HARDWARE")
    if (window.IronmongeryGallery) {
      window.IronmongeryGallery.loadCurrentSelections();
      window.IronmongeryGallery.updateMainPageDisplay();
    }

    // Update 3D ironmongery finish
    if (typeof window.update3D === 'function') {
      const finishMap = { 'chrome': 'chrome', 'polished chrome': 'chrome', 'satin': 'stainless', 'satin chrome': 'stainless', 'brass': 'brass', 'polished brass': 'brass', 'antique-brass': 'antique_brass', 'black': 'black', 'white': 'white' };
      const products = Object.values(fc.ironmongery).filter(p => p && p.color);
      if (products.length > 0) {
        const color = products[0].color.toLowerCase();
        const mapped = finishMap[color] || 'brass';
        window.update3D({ ironmongery: mapped });
      }
    }
  }

  function waitFor(check, timeout) {
    return new Promise((resolve, reject) => {
      let elapsed = 0;
      const interval = setInterval(() => {
        if (check()) { clearInterval(interval); resolve(); }
        else if (elapsed >= timeout) { clearInterval(interval); reject(new Error('Timeout waiting for: ' + check.toString())); }
        elapsed += 100;
      }, 100);
    });
  }

  function showToast(msg) {
    if (window.estimateManager?.showToast) {
      window.estimateManager.showToast(msg, msg.startsWith('✅') ? 'success' : 'error');
    } else {
    }
  }

  // ─── ADD WINDOW MODE controller (client auto-select OR admin add-to-client) ───
  async function initAddMode(targetEstimateId) {
    // Wait for the estimate selector manager (deterministic; replaces old setTimeout)
    try {
      await waitFor(() => window.estimateSelectorManager, 8000);
    } catch (e) {
      return; // selector never initialised — nothing to wire up
    }

    // The same button + URL is used by clients (own estimate) and admins (client estimate).
    // Role decides the behaviour.
    let admin = false;
    try {
      if (typeof window.isAdmin === 'function') admin = await window.isAdmin();
    } catch (e) { admin = false; }

    // ── CLIENT: original auto-select behaviour (with the correct element id) ──
    if (!admin) {
      window.estimateSelectorManager.selectedEstimateId = targetEstimateId;
      const sel = document.getElementById('estimate-selector');
      if (sel) sel.value = targetEstimateId;
      const dSel = document.getElementById('d-estimate-selector');
      if (dSel) dSel.value = targetEstimateId;
      if (typeof window.estimateSelectorManager.updateEstimateInfo === 'function') {
        try { window.estimateSelectorManager.updateEstimateInfo(); } catch (e) {}
      }
      return;
    }

    // ── ADMIN: add a window/door to a client's estimate ──
    // 1. Hard-target the client estimate (selector is hidden, so this is authoritative)
    window.estimateSelectorManager.selectedEstimateId = targetEstimateId;

    // 2. Hide the estimate selector(s) — the client list is irrelevant here
    document.querySelectorAll('.estimate-selector-container').forEach(el => {
      el.style.display = 'none';
    });

    // 3. Relabel the add buttons + show the admin banner
    relabelAdminAddButtons();
    buildAdminAddBanner(targetEstimateId);

    // 4. After a window/door is added, return to the admin modal and close this tab.
    //    Wrap the existing addWindowToEstimate — no listener duplication, no clone-timing race.
    await waitFor(
      () => window.estimateManager && typeof window.estimateManager.addWindowToEstimate === 'function',
      8000
    ).catch(() => {});
    if (window.estimateManager && !window.estimateManager.__adminAddWrapped) {
      const mgr = window.estimateManager;
      const origAdd = mgr.addWindowToEstimate.bind(mgr);
      mgr.addWindowToEstimate = async function(config, price, estId) {
        const result = await origAdd(config, price, estId || targetEstimateId);
        returnToAdminPanel(targetEstimateId);
        return result;
      };
      mgr.__adminAddWrapped = true;
    }
  }

  function relabelAdminAddButtons() {
    [['add-to-estimate', '+ Add to Client Estimate'], ['d-add-to-estimate', '+ Add Door to Client Estimate']]
      .forEach(([id, label]) => {
        const btn = document.getElementById(id);
        if (btn) {
          btn.textContent = label;
          btn.style.background = '#0A1628';
        }
      });
  }

  async function buildAdminAddBanner(targetEstimateId) {
    if (document.getElementById('admin-add-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'admin-add-banner';
    banner.style.cssText = 'background:#0A1628;color:#fff;padding:.5rem 1.2rem;display:flex;align-items:center;justify-content:space-between;font-family:Jost,sans-serif;font-size:.75rem;letter-spacing:.08em;text-transform:uppercase;position:fixed;top:0;left:0;right:0;z-index:9999;';
    banner.innerHTML =
      '<span id="admin-add-banner-text">➕ ADMIN — loading estimate…</span>' +
      '<button id="admin-add-banner-back" style="background:#fff;color:#0A1628;border:none;padding:.35rem 1.2rem;font-family:Jost,sans-serif;font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;border-radius:3px;font-weight:600;">Back to panel</button>';
    document.body.prepend(banner);
    document.body.style.paddingTop = '40px';

    document.getElementById('admin-add-banner-back').addEventListener('click', () => {
      returnToAdminPanel(targetEstimateId);
    });

    // estimate_number + project_name are admin-readable; client name intentionally omitted (RLS-safe)
    try {
      const { data } = await window.supabaseClient
        .from('estimates')
        .select('estimate_number, project_name')
        .eq('id', targetEstimateId)
        .single();
      const txt = document.getElementById('admin-add-banner-text');
      if (txt && data) {
        const num = data.estimate_number || targetEstimateId;
        const proj = data.project_name ? ' · ' + data.project_name : '';
        txt.textContent = '➕ ADMIN — adding window to ' + num + proj;
      }
    } catch (e) {
      const txt = document.getElementById('admin-add-banner-text');
      if (txt) txt.textContent = '➕ ADMIN — adding window to client estimate';
    }
  }

  function returnToAdminPanel(targetEstimateId) {
    const opener = window.opener;
    if (opener && !opener.closed && typeof opener.viewEstimate === 'function') {
      try { opener.viewEstimate(targetEstimateId); } catch (e) {}
      setTimeout(() => { try { window.close(); } catch (e) {} }, 700);
    } else {
      // No opener (e.g. URL pasted manually) — cannot auto-close this tab.
      showToast('✅ Saved — switch to the admin panel and press Refresh');
    }
  }

})();