// edit-mode.js — Edit existing window/door from estimate
// Loaded on online-estimate.html AFTER estimate-manager.js
// Checks URL params: ?edit=ITEM_ID&estimate=ESTIMATE_ID

(function() {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const editItemId = params.get('edit');
  const estimateId = params.get('estimate');

  // ─── ADD WINDOW MODE: auto-select estimate in dropdown ───
  if (estimateId && !editItemId) {
    document.addEventListener('DOMContentLoaded', () => {
      // Wait for estimate selector to populate
      setTimeout(() => {
        if (window.estimateSelectorManager) {
          window.estimateSelectorManager.selectedEstimateId = estimateId;
          const sel = document.getElementById('estimate-select');
          if (sel) { sel.value = estimateId; }
        }
      }, 1500);
    });
  }

  // ─── EDIT MODE ───
  if (!editItemId) return;

  console.log('=== EDIT MODE ACTIVATED ===');
  console.log('Item:', editItemId, 'Estimate:', estimateId);

  // State
  let editItem = null;
  let fullConfig = null;

  // ─── UI Setup ───
  document.addEventListener('DOMContentLoaded', () => {
    // Banner
    const banner = document.createElement('div');
    banner.style.cssText = 'background:#2a5a3a;color:#fff;padding:.6rem 1.2rem;text-align:center;font-family:Jost,sans-serif;font-size:.8rem;letter-spacing:.1em;text-transform:uppercase;position:fixed;top:0;left:0;right:0;z-index:9999;';
    banner.textContent = '✏️ EDIT MODE — EDITING EXISTING WINDOW';
    document.body.prepend(banner);
    document.body.style.paddingTop = '36px';

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
      console.log('=== LOADED FOR EDIT ===', fullConfig);

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

    console.log('=== PREFILL TYPE ===', { isSash, isCasement, isFixOnly, isDoor, wType });

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
    console.log('=== PREFILL SASH ===');
    const w = fc.actualFrameWidth || fc.width || editItem.width;
    const h = fc.actualFrameHeight || fc.height || editItem.height;

    // Sub-type
    setRadio('sash-type', fc.sashType || 'double');

    // Wait for triple/double panels to render
    setTimeout(() => {
      // Split ratio & head type
      setSelect('split-ratio', fc.splitRatio);
      setRadio('head-type', fc.headType || 'flat');

      // Dimensions via DimensionHandler (triggers 3D + display + config)
      setDimensionSash('width', w);
      setDimensionSash('height', h);

      // Glass
      setRadio('measurement-type', fc.measurementType);
      setRadio('frame-type', fc.frameType);
      setRadio('glass-type', fc.glassType);
      setRadio('glass-spec', fc.glassSpec);
      setRadio('glass-finish', fc.glassFinish);
      setRadio('spacer-color', fc.spacerColor || fc.spacer);
      setRadio('frosted-location', fc.frostedLocation);

      // Opening
      setRadio('opening-type', fc.openingType);
      setRadio('pas24', fc.pas24 === true || fc.pas24 === 'yes' ? 'yes' : 'no');

      // Color
      setRadio('color-type', fc.colorType || fc.colourMode);
      setTimeout(() => setWindowColor(fc), 200);

      // Bars
      setRadio('upper-bars', fc.upperBars);
      setRadio('lower-bars', fc.lowerBars);

      // Horns
      if (fc.horns && fc.horns !== 'none') setSelect('horns', fc.horns);

      // Quantity & Name
      setInput('window-quantity', fc.quantity || editItem.quantity || 1);
      if (editItem.window_number) setInput('custom-name', editItem.window_number);

      // Ironmongery (set directly on config — can't click gallery)
      if (fc.ironmongery && window.currentConfig) {
        window.currentConfig.ironmongery = fc.ironmongery;
      }

      // Force recalculate
      triggerUpdate();
      console.log('=== SASH PREFILL COMPLETE ===');
    }, 300);
  }

  // ══════════════════════════════════════════════
  // ═══ CASEMENT PREFILL ═════════════════════════
  // ══════════════════════════════════════════════
  function prefillCasement(fc) {
    console.log('=== PREFILL CASEMENT ===');
    const w = fc.actualFrameWidth || fc.width || editItem.width;
    const h = fc.actualFrameHeight || fc.height || editItem.height;

    // Sub-type
    setRadio('casement-type', fc.casementType || 'standard');

    // Layout
    setRadio('casement-layout', fc.casementLayout || fc.layout || editItem.casement_layout);

    // Dimensions (c-prefixed selects + hidden inputs)
    setCasementDimension('c-width', w);
    setCasementDimension('c-height', h);

    // Glass (c-prefixed)
    setRadio('c-glass-type', fc.glassType);
    setRadio('c-glass-spec', fc.glassSpec);
    setRadio('c-glass-finish', fc.glassFinish);
    setRadio('c-pas24', fc.pas24 === true || fc.pas24 === 'yes' ? 'yes' : 'no');

    // Spacer
    setRadio('spacer-color', fc.spacerColor || fc.spacer);

    // Color (casement uses c-color-type)
    setRadio('c-color-type', fc.colorType || fc.colourMode);
    setTimeout(() => setWindowColor(fc, 'casement'), 200);

    // Seal, trickle, sill
    setRadio('c-seal-colour', fc.sealColour || editItem.seal_colour);
    setRadio('c-trickle-vent', fc.trickleVent || editItem.trickle_vent);
    setRadio('c-sill-ext', fc.sillExtension || editItem.sill_extension);
    setRadio('c-sill-wider', fc.sillWider ? 'yes' : 'no');

    // Bars (c-prefixed)
    const hb = fc.hBars || fc.casementHBars || fc.upperBars || editItem.upper_bars;
    const vb = fc.vBars || fc.casementVBars || fc.lowerBars || editItem.lower_bars;
    if (hb) setRadio('c-hbars', String(hb));
    if (vb) setRadio('c-vbars', String(vb));

    // Quantity & Name
    setInput('c-quantity', fc.quantity || editItem.quantity || 1);
    if (editItem.window_number) setInput('c-custom-name', editItem.window_number);

    // Ironmongery
    if (fc.ironmongery && window.currentConfig) {
      window.currentConfig.ironmongery = fc.ironmongery;
    }

    triggerUpdate();
    console.log('=== CASEMENT PREFILL COMPLETE ===');
  }

  // ══════════════════════════════════════════════
  // ═══ FIX-ONLY PREFILL ═════════════════════════
  // ══════════════════════════════════════════════
  function prefillFixOnly(fc) {
    console.log('=== PREFILL FIX-ONLY ===');
    const w = fc.actualFrameWidth || fc.width || editItem.width;
    const h = fc.actualFrameHeight || fc.height || editItem.height;

    // Fix type & shape
    setRadio('fix-type', fc.fixType || 'standard');
    setRadio('fix-shape', fc.fixShape || fc.shape || 'rectangle');

    // Dimensions (number inputs)
    setInput('fix-width', w, 'input');
    setInput('fix-height', h, 'input');

    // Glass (f-prefixed)
    setRadio('f-glass-finish', fc.glassFinish);
    setRadio('f-spacer', fc.spacerColor || fc.spacer || 'silver');

    // Color
    setRadio('color-type', fc.colorType || fc.colourMode);
    setTimeout(() => setWindowColor(fc), 200);

    // Quantity
    setInput('fix-quantity', fc.quantity || editItem.quantity || 1);

    triggerUpdate();
    console.log('=== FIX-ONLY PREFILL COMPLETE ===');
  }

  // ══════════════════════════════════════════════
  // ═══ DOOR PREFILL ═════════════════════════════
  // ══════════════════════════════════════════════
  function prefillDoor(fc) {
    console.log('=== PREFILL DOOR ===');
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

        // French-specific (uses fd-door- prefix, not door-)
        if (doorType === 'french') {
          setRadio('fd-door-shape', fc.doorShape);
          setRadio('fd-door-style', fc.doorStyle);
          setRadio('fd-door-paneling', fc.doorPaneling);
          setRadio('fd-door-side-panels', fc.sidePanels);
          setRadio('fd-door-side-style', fc.sideStyle);
          setRadio('fd-door-center-mullion', fc.centerMullion);
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

        // Ironmongery
        if (fc.ironmongery && window.currentConfig) {
          window.currentConfig.ironmongery = fc.ironmongery;
        }

        // SAFETY NET: re-set dimensions after all events settle
        setTimeout(() => {
          setInput('d-width', w, 'input');
          setInput('d-height', h, 'input');
          if (window.updateDoorSpec) window.updateDoorSpec();
          if (window.updateDoor3D) window.updateDoor3D();
        }, 600);

        console.log('=== DOOR PREFILL COMPLETE ===');
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
      console.log('=== UPDATE WINDOW ===');

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
        spacer_color: windowConfig.spacerColor || windowConfig.fullConfig?.spacerColor || 'silver',
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
      const intOpt = document.querySelector(`${intSelector}[data-color="${intKey}"]`) ||
                     document.querySelector(`${intSelector}[data-name="${fc.colorInteriorName}"]`);
      if (intOpt) {
        intHex = intOpt.style.backgroundColor || '#F6F6F6';
        if (intHex.startsWith('rgb')) { const m = intHex.match(/\d+/g); if (m) intHex = '#' + m.slice(0,3).map(v => parseInt(v).toString(16).padStart(2,'0')).join(''); }
        document.querySelectorAll(intSelector).forEach(o => o.classList.remove('selected'));
        intOpt.classList.add('selected');
      }
      const extOpt = document.querySelector(`${extSelector}[data-color="${extKey}"]`) ||
                     document.querySelector(`${extSelector}[data-name="${fc.colorExteriorName}"]`);
      if (extOpt) {
        extHex = extOpt.style.backgroundColor || '#F6F6F6';
        if (extHex.startsWith('rgb')) { const m = extHex.match(/\d+/g); if (m) extHex = '#' + m.slice(0,3).map(v => parseInt(v).toString(16).padStart(2,'0')).join(''); }
        document.querySelectorAll(extSelector).forEach(o => o.classList.remove('selected'));
        extOpt.classList.add('selected');
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
      console.log(msg);
    }
  }

})();