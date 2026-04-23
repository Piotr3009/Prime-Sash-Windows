class PriceCalculator {
  constructor() {
    // Sprawdź czy pricing config jest dostępny
    if (!window.pricingConfig) {
      console.error('PriceCalculator: pricing-config.js must be loaded first!');
      return;
    }
    
    this.pricing = window.pricingConfig;
    this.config = window.config; // stary config dla kompatybilności
  }

  calculate(configuration) {
    if (!configuration) {
      console.error('PriceCalculator: No configuration provided');
      return { unitPrice: 0, totalPrice: 0, breakdown: {}, noDimensions: true };
    }

    // Check if dimensions are entered (0 means not entered)
    const width = configuration.width;
    const height = configuration.height;
    
    if (!width || width === 0 || !height || height === 0) {
      return { 
        unitPrice: 0, 
        totalPrice: 0, 
        breakdown: {}, 
        noDimensions: true,
        message: 'Enter dimensions'
      };
    }

    // Use actual frame dimensions if available, otherwise calculate them
    let frameWidth, frameHeight;
    
    // Check if we have actualFrameWidth/Height (from specification)
    if (configuration.actualFrameWidth && configuration.actualFrameHeight) {
      frameWidth = configuration.actualFrameWidth;
      frameHeight = configuration.actualFrameHeight;
    } else {
      // Calculate based on measurement type
      const measurementType = configuration.measurementType || 'brick-to-brick';
      
      if (measurementType === 'brick-to-brick') {
        frameWidth = width + 150;
        frameHeight = height + 75;
      } else {
        frameWidth = width;
        frameHeight = height;
      }
    }

    // Calculate area in m² using FRAME dimensions
    const sqm = (frameWidth / 1000) * (frameHeight / 1000);
    
    console.log('PriceCalculator: Frame dimensions:', frameWidth, 'x', frameHeight, '=', sqm, 'm²');
    
    // ═══ CASEMENT PRICING ═══
    if (configuration.windowType === 'casement' && this.pricing.casement) {
      // Arched casement uses separate pricing
      if (configuration.casementType === 'arched') {
        return this.calculateArchedCasement(configuration, sqm, frameWidth, frameHeight);
      }
      return this.calculateCasement(configuration, sqm, frameWidth, frameHeight);
    }

    // ═══ FIX-ONLY PRICING ═══
    if (configuration.windowType === 'fix-only') {
      return this.calculateFixOnly(configuration, sqm, frameWidth, frameHeight);
    }

    // ═══ DOOR PRICING ═══
    if (configuration.productType === 'door' || configuration.windowCategory === 'door') {
      return this.calculateDoor(configuration, frameWidth, frameHeight);
    }

    // 1. CENA BAZOWA (SASH)
    let basePrice;
    let sizeMultiplier;
    if (configuration.sashType === 'triple') {
      // Triple: flat £950/sqm, no size degression
      sizeMultiplier = 1.0;
      basePrice = 950 * sqm;
      console.log('Triple sash: flat £950/sqm × ' + sqm.toFixed(2) + ' = £' + basePrice.toFixed(2));
    } else {
      // Double: £800/sqm with degressive multiplier
      sizeMultiplier = this.getSizeMultiplier(sqm);
      basePrice = this.pricing.basePricePerSqm * sqm * sizeMultiplier;
    }
    
    // 2. CENA ZA SZPROSY (bars) — center sash
    const barsPrice = this.calculateBarsPrice(
      configuration.upperBars || 'none',
      configuration.lowerBars || 'none',
      configuration.customBars
    );

    // 2b. FIX PANEL BARS (triple only) — ×2 because left and right fix have same bars
    let fixBarsPrice = 0;
    if (configuration.sashType === 'triple') {
      const fixBarsOnce = this.calculateBarsPrice(
        configuration.fixUpperBars || 'none',
        configuration.fixLowerBars || 'none',
        configuration.fixCustomBars
      );
      fixBarsPrice = fixBarsOnce * 2; // left fix + right fix
      if (fixBarsPrice > 0) {
        console.log('Fix bars (×2 panels): £' + fixBarsPrice.toFixed(2));
      }
    }
    
    // 3. DODATKOWE OPCJE (przekazujemy sqm i basePrice)
    const additionalPrice = this.calculateAdditionalOptions(configuration, sqm, basePrice);
    
    // 4. SUMA PRZED RABATEM (bez dopłaty za kolor)
    let subtotal = basePrice + barsPrice + fixBarsPrice + additionalPrice;

    // ARCHED HEAD SURCHARGE: +10% on subtotal (glazing arch on any sash type)
    if (configuration.headType === 'arch') {
      const archedSurcharge = subtotal * 0.10;
      console.log('Glazing arch surcharge: 10% × £' + subtotal.toFixed(2) + ' = £' + archedSurcharge.toFixed(2));
      subtotal += archedSurcharge;
    }

    // KOLOR: liczone od czystego subtotal (single white = baza)
    if (configuration.colorType === 'dual') {
      // Dual color: +15% od subtotal single white
      const dualSurcharge = subtotal * 0.15;
      console.log('Dual color: 15% × £' + subtotal.toFixed(2) + ' = £' + dualSurcharge.toFixed(2));
      subtotal += dualSurcharge;
    } else if (configuration.colorType === 'single' && configuration.colorSingle && configuration.colorSingle !== 'white') {
      // Single inny kolor: +5% od subtotal
      const colorSurcharge = subtotal * 0.05;
      console.log('Single colour (non-white): 5% × £' + subtotal.toFixed(2) + ' = £' + colorSurcharge.toFixed(2));
      subtotal += colorSurcharge;
    }
    
    // 5. RABAT ILOŚCIOWY
    const quantity = configuration.quantity || 1;
    const discount = this.getQuantityDiscount(quantity);
    const discountAmount = subtotal * discount;
    
    // 6. CENA JEDNOSTKOWA PO RABACIE
    const unitPrice = subtotal - discountAmount;
    
    // 7. CENA CAŁKOWITA
    const totalPrice = unitPrice * quantity;
    
    // Przygotuj breakdown dla debugowania
    const breakdown = {
      frameWidth: frameWidth,
      frameHeight: frameHeight,
      sqm: sqm.toFixed(2),
      sizeMultiplier: sizeMultiplier,
      basePrice: basePrice.toFixed(2),
      barsPrice: barsPrice,
      fixBarsPrice: fixBarsPrice,
      sashType: configuration.sashType || 'double',
      additionalOptions: additionalPrice,
      subtotal: subtotal.toFixed(2),
      quantity: quantity,
      discount: (discount * 100) + '%',
      discountAmount: discountAmount.toFixed(2),
      unitPrice: unitPrice.toFixed(2),
      totalPrice: totalPrice.toFixed(2),
      vatAmount: (totalPrice * this.pricing.vatRate).toFixed(2),
      totalWithVat: (totalPrice * (1 + this.pricing.vatRate)).toFixed(2)
    };

    return {
      unitPrice: Math.round(unitPrice * 100) / 100,
      totalPrice: Math.round(totalPrice * 100) / 100,
      breakdown: breakdown
    };
  }

  getSizeMultiplier(sqm) {
    // Znajdź odpowiedni mnożnik dla rozmiaru
    for (const tier of this.pricing.sizeMultipliers) {
      if (sqm <= tier.maxSqm) {
        return tier.multiplier;
      }
    }
    return 0.8; // domyślnie dla bardzo dużych okien
  }

  calculateBarsPrice(upperBars, lowerBars, customBars) {
    const barConfig = this.pricing.barPricing;
    let totalBars = 0;
    
    console.log('=== BARS PRICE CALCULATION ===');
    console.log('Upper bars type:', upperBars);
    console.log('Lower bars type:', lowerBars);
    console.log('Price per bar: £', barConfig.pricePerBar);
    
    // Upper sash bars
    if (upperBars === 'custom' && customBars?.upper) {
      const upperCount = (customBars.upper.horizontal?.length || 0) + 
                         (customBars.upper.vertical?.length || 0);
      totalBars += upperCount;
      console.log('Custom upper bars count:', upperCount);
    } else if (upperBars && upperBars !== 'none' && barConfig.barsPerPattern[upperBars] !== undefined) {
      const upperCount = barConfig.barsPerPattern[upperBars];
      totalBars += upperCount;
      console.log('Upper bars pattern "' + upperBars + '" count:', upperCount);
    }
    
    // Lower sash bars
    if (lowerBars === 'custom' && customBars?.lower) {
      const lowerCount = (customBars.lower.horizontal?.length || 0) + 
                         (customBars.lower.vertical?.length || 0);
      totalBars += lowerCount;
      console.log('Custom lower bars count:', lowerCount);
    } else if (lowerBars && lowerBars !== 'none' && barConfig.barsPerPattern[lowerBars] !== undefined) {
      const lowerCount = barConfig.barsPerPattern[lowerBars];
      totalBars += lowerCount;
      console.log('Lower bars pattern "' + lowerBars + '" count:', lowerCount);
    }
    
    const barsPrice = totalBars * barConfig.pricePerBar;
    console.log('TOTAL: ' + totalBars + ' bars x £' + barConfig.pricePerBar + ' = £' + barsPrice);
    console.log('==============================');
    
    return barsPrice;
  }

  calculateAdditionalOptions(configuration, sqm, basePrice) {
    const options = this.pricing.additionalOptions;
    let additionalPrice = 0;
    
    console.log('=== ADDITIONAL OPTIONS ===');
    
    // Frame type
    if (configuration.frameType && options.frameTypes[configuration.frameType]) {
      const framePrice = options.frameTypes[configuration.frameType];
      additionalPrice += framePrice;
      console.log('Frame (' + configuration.frameType + '): £' + framePrice);
    }
    
    // Glass type
    if (configuration.glassType && options.glassTypes[configuration.glassType]) {
      const glassPrice = options.glassTypes[configuration.glassType];
      additionalPrice += glassPrice;
      console.log('Glass (' + configuration.glassType + '): £' + glassPrice);
    }
    
    // Glass specification - LAMINATED: £/m²
    if (configuration.glassSpec && options.glassSpec[configuration.glassSpec]) {
      const specPricePerSqm = options.glassSpec[configuration.glassSpec];
      const specPrice = specPricePerSqm * sqm; // mnożenie przez m²
      additionalPrice += specPrice;
      console.log('Glass spec (' + configuration.glassSpec + '): £' + specPricePerSqm + '/m² × ' + sqm.toFixed(2) + 'm² = £' + specPrice.toFixed(2));
    }
    
    // Glass finish
    if (configuration.glassFinish && options.glassFinish[configuration.glassFinish]) {
      const finishPrice = options.glassFinish[configuration.glassFinish];
      additionalPrice += finishPrice;
      console.log('Glass finish (' + configuration.glassFinish + '): £' + finishPrice);
    }
    
    // Horns - USUNIĘTE (teraz w Gallery jako ironmongery)
    
    // Ironmongery - NOWY SYSTEM: pobierz z Gallery - POPRAWKA: window.currentConfig
    const galleryIronmongery = window.currentConfig?.ironmongery || {};
    const selectedProducts = [
      galleryIronmongery.lock,
      galleryIronmongery.fingerLift,
      galleryIronmongery.pullHandles,
      galleryIronmongery.stoppers,
      galleryIronmongery.horns,
      galleryIronmongery.casementHandles,
      galleryIronmongery.casementStays,
      galleryIronmongery.casementLocks,
      galleryIronmongery.doorHandles,
      galleryIronmongery.doorLocks
    ].filter(p => p !== null && p !== undefined);
    
    if (selectedProducts.length > 0) {
      let ironmongeryTotal = 0;
      selectedProducts.forEach(product => {
        const price = product.price_net || product.price || 0;
        const quantity = product.quantity || 1;
        ironmongeryTotal += (price * quantity);
      });
      
      if (ironmongeryTotal > 0) {
        additionalPrice += ironmongeryTotal;
        console.log('Ironmongery total: £' + ironmongeryTotal.toFixed(2), selectedProducts);
      }
    }
    
    // Opening type — skip for triple (bottom-only is the only option, no discount)
    if (configuration.sashType !== 'triple' && configuration.openingType && options.openingTypes[configuration.openingType]) {
      const openingPrice = options.openingTypes[configuration.openingType];
      additionalPrice += openingPrice;
      console.log('Opening (' + configuration.openingType + '): £' + openingPrice);
    }
    
    // Color type - DUAL: liczone od subtotal (patrz niżej)
    // (przeniesione poza tę funkcję)
    
    // Color surcharge based on color choice
    // Color surcharges handled above (single non-white +5%, dual +15%)
    
    // Sill extension
    if (configuration.sillExtension && options.sillExtension && options.sillExtension[configuration.sillExtension]) {
      const sillPrice = options.sillExtension[configuration.sillExtension];
      additionalPrice += sillPrice;
      console.log('Sill extension (' + configuration.sillExtension + 'mm): £' + sillPrice);
    }
    
    // PAS24
    if (configuration.pas24 && options.pas24[configuration.pas24]) {
      const pas24Price = options.pas24[configuration.pas24];
      additionalPrice += pas24Price;
      console.log('PAS24 (' + configuration.pas24 + '): £' + pas24Price);
    }
    
    console.log('TOTAL ADDITIONAL: £' + additionalPrice);
    console.log('========================');
    
    return additionalPrice;
  }

  calculateCasement(configuration, sqm, frameWidth, frameHeight) {
    const c = this.pricing.casement;
    const layout = configuration.casementLayout || '040L';
    const layoutData = c.layouts[layout] || { mullions: 0, transoms: 0, sashes: 1 };
    
    console.log('=== CASEMENT PRICING ===');
    console.log('Layout:', layout, layoutData);
    console.log('SQM:', sqm.toFixed(2));
    
    // Base price: 600 + (sqm - 1) * 300 + mullions * 150 + transoms * 200 + sashes * 200
    let basePrice = c.firstSqmPrice;
    if (sqm > 1) {
      basePrice += (sqm - 1) * c.basePricePerSqm;
    }
    basePrice = Math.max(basePrice, c.basePriceMin);
    
    const mullionPrice = layoutData.mullions * c.mullionPrice;
    const transomPrice = layoutData.transoms * c.transomPrice;
    const sashPrice = layoutData.sashes * c.sashPrice;
    
    console.log('Base (sqm):', basePrice.toFixed(2));
    console.log('Mullions:', layoutData.mullions, '×', c.mullionPrice, '=', mullionPrice);
    console.log('Transoms:', layoutData.transoms, '×', c.transomPrice, '=', transomPrice);
    console.log('Sashes:', layoutData.sashes, '×', c.sashPrice, '=', sashPrice);
    
    basePrice += mullionPrice + transomPrice + sashPrice;
    console.log('Total base:', basePrice.toFixed(2));
    
    // Bars pricing (casement uses hBars × vBars count)
    let barsPrice = 0;
    const hBars = configuration.casementHBars || 0;
    const vBars = configuration.casementVBars || 0;
    const totalBars = hBars + vBars;
    if (totalBars > 0) {
      barsPrice = totalBars * 2 * this.pricing.barPricing.pricePerBar;
      // Multiply by number of panels
      const panelCount = layoutData.mullions + 1 + (layoutData.transoms > 0 ? layoutData.mullions + 1 : 0);
      barsPrice *= Math.max(1, layoutData.sashes + (layoutData.mullions + 1 - layoutData.sashes));
      console.log('Bars:', totalBars, '× 2 × £' + this.pricing.barPricing.pricePerBar, '× panels =', barsPrice.toFixed(2));
    }
    
    // Additional options (glass, finish, PAS24, sill, ironmongery — same as sash)
    const additionalPrice = this.calculateAdditionalOptions(configuration, sqm, basePrice);
    
    // Subtotal
    let subtotal = basePrice + barsPrice + additionalPrice;
    
    // Colour surcharges (same logic as sash)
    if (configuration.colorType === 'dual') {
      const dualSurcharge = subtotal * 0.15;
      console.log('Dual color: 15% × £' + subtotal.toFixed(2) + ' = £' + dualSurcharge.toFixed(2));
      subtotal += dualSurcharge;
    } else if (configuration.colorType === 'single' && configuration.colorSingle && configuration.colorSingle !== 'white') {
      const colorSurcharge = subtotal * 0.10;
      console.log('Single colour (non-white): 10% = £' + colorSurcharge.toFixed(2));
      subtotal += colorSurcharge;
    }
    
    // Quantity discount
    const quantity = configuration.quantity || 1;
    const discount = this.getQuantityDiscount(quantity);
    const discountAmount = subtotal * discount;
    const unitPrice = subtotal - discountAmount;
    const totalPrice = unitPrice * quantity;
    
    console.log('Subtotal: £' + subtotal.toFixed(2));
    console.log('Quantity:', quantity, 'Discount:', (discount * 100) + '%');
    console.log('Final unit: £' + unitPrice.toFixed(2));
    console.log('=========================');
    
    return {
      unitPrice: Math.round(unitPrice * 100) / 100,
      totalPrice: Math.round(totalPrice * 100) / 100,
      breakdown: {
        windowType: 'casement',
        layout: layout,
        frameWidth: frameWidth,
        frameHeight: frameHeight,
        sqm: sqm.toFixed(2),
        basePrice: basePrice.toFixed(2),
        mullions: layoutData.mullions,
        transoms: layoutData.transoms,
        sashes: layoutData.sashes,
        barsPrice: barsPrice.toFixed(2),
        additionalOptions: additionalPrice,
        subtotal: subtotal.toFixed(2),
        quantity: quantity,
        discount: (discount * 100) + '%',
        discountAmount: discountAmount.toFixed(2),
        unitPrice: unitPrice.toFixed(2),
        totalPrice: totalPrice.toFixed(2),
        vatAmount: (totalPrice * this.pricing.vatRate).toFixed(2),
        totalWithVat: (totalPrice * (1 + this.pricing.vatRate)).toFixed(2)
      }
    };
  }

  // ═══ FIX-ONLY PRICING ═══
  calculateFixOnly(configuration, sqm, frameWidth, frameHeight) {
    const shape = configuration.fixShape || 'rectangle';
    const type = configuration.fixType || 'standard';

    console.log('=== FIX-ONLY PRICING ===');
    console.log('Shape:', shape, 'Type:', type, 'SQM:', sqm.toFixed(2));

    // Base price by shape
    let basePrice;
    if (shape === 'rectangle') {
      basePrice = sqm * 450;
      console.log('Base (rectangle):', sqm.toFixed(2), '× £450 = £' + basePrice.toFixed(2));
    } else if (shape === 'circle') {
      basePrice = sqm * 1200;
      console.log('Base (circle):', sqm.toFixed(2), '× £1200 = £' + basePrice.toFixed(2));
    } else {
      // Arch shapes: £800 first sqm + £400 per additional
      basePrice = 800 + Math.max(0, sqm - 1) * 400;
      console.log('Base (arch): £800 + ' + Math.max(0, sqm - 1).toFixed(2) + ' × £400 = £' + basePrice.toFixed(2));
    }

    // FD30/FD60 premium
    if (type === 'fd30') { basePrice += sqm * 150; console.log('FD30: +£' + (sqm * 150).toFixed(2)); }
    else if (type === 'fd60') { basePrice += sqm * 300; console.log('FD60: +£' + (sqm * 300).toFixed(2)); }

    // Pattern premium
    let patternPrice = 0;
    const semiPat = configuration.fixSemiBarPattern || 'none';
    const gothPat = configuration.fixGothicBars || 'none';
    const circlePat = configuration.fixCircleBarPattern || 'none';
    const patternPrices = { 'intersecting': 250, 'half-hub': 150, 'hub-spoke': 210, 'double-hub-spoke': 270, 'triple-hub-spoke': 320, 'sunburst': 300 };
    if (semiPat !== 'none' && patternPrices[semiPat]) patternPrice = patternPrices[semiPat];
    if (gothPat !== 'none' && patternPrices[gothPat]) patternPrice = patternPrices[gothPat];
    if (circlePat !== 'none' && patternPrices[circlePat]) patternPrice = patternPrices[circlePat];
    if (patternPrice > 0) console.log('Pattern: +£' + patternPrice);

    // Bars
    const hBars = configuration.casementHBars || 0;
    const vBars = configuration.casementVBars || 0;
    const totalBars = hBars + vBars;
    const barRate = this.pricing.barPricing ? this.pricing.barPricing.pricePerBar : 15;
    const barsPrice = totalBars * 2 * barRate;
    if (barsPrice > 0) console.log('Bars:', totalBars, '× £' + barRate, '= £' + barsPrice);

    // Additional options (glass, sill)
    const additionalPrice = this.calculateAdditionalOptions(configuration, sqm, basePrice);

    let subtotal = basePrice + patternPrice + barsPrice + additionalPrice;

    // Colour surcharges
    if (configuration.colorType === 'dual') {
      const surcharge = subtotal * 0.15;
      console.log('Dual colour: +£' + surcharge.toFixed(2));
      subtotal += surcharge;
    } else if (configuration.colorType === 'single' && configuration.colorSingle && configuration.colorSingle !== 'white') {
      const surcharge = subtotal * 0.10;
      console.log('Single colour (non-white): +£' + surcharge.toFixed(2));
      subtotal += surcharge;
    }

    const quantity = configuration.quantity || 1;
    const discount = this.getQuantityDiscount(quantity);
    const discountAmount = subtotal * discount;
    const unitPrice = subtotal - discountAmount;
    const totalPrice = unitPrice * quantity;

    console.log('Subtotal: £' + subtotal.toFixed(2), 'Unit: £' + unitPrice.toFixed(2));
    console.log('=========================');

    return {
      unitPrice: Math.round(unitPrice * 100) / 100,
      totalPrice: Math.round(totalPrice * 100) / 100,
      breakdown: {
        windowType: 'fix-only',
        shape: shape,
        frameType: type,
        frameWidth: frameWidth,
        frameHeight: frameHeight,
        sqm: sqm.toFixed(2),
        basePricePerSqm: (shape === 'rectangle') ? 450 : (shape === 'circle') ? 1200 : '800+400',
        basePrice: basePrice.toFixed(2),
        patternPrice: patternPrice,
        barsPrice: barsPrice.toFixed(2),
        additionalOptions: additionalPrice,
        subtotal: subtotal.toFixed(2),
        quantity: quantity,
        discount: (discount * 100) + '%',
        discountAmount: discountAmount.toFixed(2),
        unitPrice: unitPrice.toFixed(2),
        totalPrice: totalPrice.toFixed(2),
        vatAmount: (totalPrice * this.pricing.vatRate).toFixed(2),
        totalWithVat: (totalPrice * (1 + this.pricing.vatRate)).toFixed(2)
      }
    };
  }

  // ═══ DOOR PRICING ═══
  calculateDoor(configuration, frameWidth, frameHeight) {
    const DOOR_BASE_PER_SQM = 900;
    const SILL_EXTENSION_PRICE = 80;
    const BEADING_DOOR = 80;
    const BEADING_PANEL = 40;
    const RECESSED_DOOR = 120;
    const RECESSED_PANEL = 80;
    const SINGLE_COLOUR_SURCHARGE = 0.05;
    const DUAL_COLOUR_SURCHARGE = 0.15;

    console.log('=== DOOR PRICING ===');

    // ── 1. Door leaf base price ──
    const doorW = configuration.width || 900;
    const doorH = configuration.height || 2100;
    const doorSqm = (doorW / 1000) * (doorH / 1000);
    let basePrice = DOOR_BASE_PER_SQM * doorSqm;
    console.log('Door leaf:', doorW + 'x' + doorH, '=', doorSqm.toFixed(2) + 'm²', '× £' + DOOR_BASE_PER_SQM, '= £' + basePrice.toFixed(2));

    // ── 2. Side panels ──
    let panelPrice = 0;
    const sidePanels = configuration.sidePanels || 'none';
    const hasLeft = sidePanels === 'left' || sidePanels === 'both';
    const hasRight = sidePanels === 'right' || sidePanels === 'both';
    let panelCount = 0;

    if (hasLeft) {
      const leftW = configuration.sideLeftWidth || 500;
      const leftSqm = (leftW / 1000) * (doorH / 1000);
      panelPrice += DOOR_BASE_PER_SQM * leftSqm;
      panelCount++;
      console.log('Left panel:', leftW + 'x' + doorH, '=', leftSqm.toFixed(2) + 'm² = £' + (DOOR_BASE_PER_SQM * leftSqm).toFixed(2));
    }
    if (hasRight) {
      const rightW = configuration.sideRightWidth || 500;
      const rightSqm = (rightW / 1000) * (doorH / 1000);
      panelPrice += DOOR_BASE_PER_SQM * rightSqm;
      panelCount++;
      console.log('Right panel:', rightW + 'x' + doorH, '=', rightSqm.toFixed(2) + 'm² = £' + (DOOR_BASE_PER_SQM * rightSqm).toFixed(2));
    }

    // ── 3. Bars (from DB price) ──
    const barRate = this.pricing.barPricing ? this.pricing.barPricing.pricePerBar : 20;
    const doorHBars = configuration.hBars || 0;
    const doorVBars = configuration.vBars || 0;
    const doorBarCount = doorHBars + doorVBars;
    let barsPrice = doorBarCount * barRate;

    const sideHBars = configuration.sideHBars || 0;
    const sideVBars = configuration.sideVBars || 0;
    const sideBarCount = sideHBars + sideVBars;
    barsPrice += sideBarCount * panelCount * barRate;

    if (barsPrice > 0) console.log('Bars: door(' + doorBarCount + ') + panels(' + sideBarCount + '×' + panelCount + ') × £' + barRate + ' = £' + barsPrice.toFixed(2));

    // ── 4. Sill extension ──
    let sillPrice = 0;
    if (configuration.thresholdExtension > 0) {
      sillPrice = SILL_EXTENSION_PRICE;
      console.log('Sill extension: £' + sillPrice);
    }

    // ── 5. Paneling (only when not full-glass) ──
    let panelingPrice = 0;
    const paneling = configuration.doorPaneling || 'flat';
    const doorStyleForPrice = configuration.doorStyle || 'full-glass';
    const sideStyle = configuration.sideStyle || 'full-glass';
    const chargeablePanels = sideStyle === 'same' ? panelCount : 0;
    if (doorStyleForPrice !== 'full-glass') {
      if (paneling === 'beading') {
        panelingPrice = BEADING_DOOR + (chargeablePanels * BEADING_PANEL);
        console.log('Beading: door £' + BEADING_DOOR + ' + ' + chargeablePanels + ' panels × £' + BEADING_PANEL + ' = £' + panelingPrice);
      } else if (paneling === 'panel') {
        panelingPrice = RECESSED_DOOR + (chargeablePanels * RECESSED_PANEL);
        console.log('Recessed: door £' + RECESSED_DOOR + ' + ' + chargeablePanels + ' panels × £' + RECESSED_PANEL + ' = £' + panelingPrice);
      }
    }

    // ── 6. Glass (from DB — uses calculateAdditionalOptions) ──
    const totalSqm = doorSqm + (hasLeft ? (configuration.sideLeftWidth || 500) / 1000 * doorH / 1000 : 0)
                              + (hasRight ? (configuration.sideRightWidth || 500) / 1000 * doorH / 1000 : 0);
    const additionalPrice = this.calculateAdditionalOptions(configuration, totalSqm, basePrice + panelPrice);

    // ── Subtotal ──
    let subtotal = basePrice + panelPrice + barsPrice + sillPrice + panelingPrice + additionalPrice;
    console.log('Subtotal: £' + subtotal.toFixed(2));

    // ── 7. Colour surcharge ──
    let colourSurcharge = 0;
    const isWhite = !configuration.woodColor || configuration.woodColor === '#FAFAFA' || configuration.woodColor === '#F6F6F6' || configuration.woodColor === '#ffffff';
    if (!configuration.sameColor) {
      colourSurcharge = subtotal * DUAL_COLOUR_SURCHARGE;
      console.log('Dual colour: 15% × £' + subtotal.toFixed(2) + ' = £' + colourSurcharge.toFixed(2));
    } else if (!isWhite) {
      colourSurcharge = subtotal * SINGLE_COLOUR_SURCHARGE;
      console.log('Single colour: 5% × £' + subtotal.toFixed(2) + ' = £' + colourSurcharge.toFixed(2));
    }
    subtotal += colourSurcharge;

    // ── Quantity ──
    const quantity = configuration.quantity || 1;
    const discount = this.getQuantityDiscount(quantity);
    const discountAmount = subtotal * discount;
    const unitPrice = subtotal - discountAmount;
    const totalPrice = unitPrice * quantity;

    console.log('Unit: £' + unitPrice.toFixed(2), 'Qty:', quantity, 'Total: £' + totalPrice.toFixed(2));
    console.log('=== END DOOR PRICING ===');

    return {
      unitPrice: Math.round(unitPrice * 100) / 100,
      totalPrice: Math.round(totalPrice * 100) / 100,
      total: Math.round(unitPrice * 100) / 100,
      breakdown: {
        windowType: 'door',
        doorWidth: doorW,
        doorHeight: doorH,
        doorSqm: doorSqm.toFixed(2),
        basePrice: basePrice.toFixed(2),
        panelPrice: panelPrice.toFixed(2),
        panelCount: panelCount,
        barsPrice: barsPrice.toFixed(2),
        sillPrice: sillPrice.toFixed(2),
        panelingPrice: panelingPrice.toFixed(2),
        additionalOptions: additionalPrice,
        colourSurcharge: colourSurcharge.toFixed(2),
        subtotal: subtotal.toFixed(2),
        quantity: quantity,
        discount: (discount * 100) + '%',
        unitPrice: unitPrice.toFixed(2),
        totalPrice: totalPrice.toFixed(2),
        vatAmount: (totalPrice * this.pricing.vatRate).toFixed(2),
        totalWithVat: (totalPrice * (1 + this.pricing.vatRate)).toFixed(2)
      }
    };
  }

  // ═══ ARCHED CASEMENT PRICING ═══
  calculateArchedCasement(configuration, sqm, frameWidth, frameHeight) {
    const shape = configuration.casArchShape || 'semi-circle';

    console.log('=== ARCHED CASEMENT PRICING ===');
    console.log('Shape:', shape, 'SQM:', sqm.toFixed(2));

    // Base: £1200 first sqm + £600 per additional sqm
    let basePrice = 1200 + Math.max(0, sqm - 1) * 600;
    console.log('Base: £1200 + ' + Math.max(0, sqm - 1).toFixed(2) + ' × £600 = £' + basePrice.toFixed(2));

    // Sash (1 leaf): +£50
    basePrice += 50;
    console.log('Sash: +£50');

    // Pattern premium (same as fix)
    let patternPrice = 0;
    const semiPat = configuration.fixSemiBarPattern || 'none';
    const gothPat = configuration.fixGothicBars || 'none';
    const patternPrices = { 'intersecting': 250, 'half-hub': 150, 'hub-spoke': 210, 'double-hub-spoke': 270, 'triple-hub-spoke': 320 };
    if (semiPat !== 'none' && patternPrices[semiPat]) patternPrice = patternPrices[semiPat];
    if (gothPat !== 'none' && patternPrices[gothPat]) patternPrice = patternPrices[gothPat];
    if (patternPrice > 0) console.log('Pattern: +£' + patternPrice);

    // Bars
    const hBars = configuration.casementHBars || 0;
    const vBars = configuration.casementVBars || 0;
    const totalBars = hBars + vBars;
    const barRate = this.pricing.barPricing ? this.pricing.barPricing.pricePerBar : 15;
    const barsPrice = totalBars * 2 * barRate;
    if (barsPrice > 0) console.log('Bars:', totalBars, '× £' + barRate, '= £' + barsPrice);

    // Additional options (glass, sill)
    const additionalPrice = this.calculateAdditionalOptions(configuration, sqm, basePrice);

    let subtotal = basePrice + patternPrice + barsPrice + additionalPrice;

    // Colour surcharges
    if (configuration.colorType === 'dual') {
      const surcharge = subtotal * 0.15;
      console.log('Dual colour: +£' + surcharge.toFixed(2));
      subtotal += surcharge;
    } else if (configuration.colorType === 'single' && configuration.colorSingle && configuration.colorSingle !== 'white') {
      const surcharge = subtotal * 0.10;
      console.log('Single colour (non-white): +£' + surcharge.toFixed(2));
      subtotal += surcharge;
    }

    const quantity = configuration.quantity || 1;
    const discount = this.getQuantityDiscount(quantity);
    const discountAmount = subtotal * discount;
    const unitPrice = subtotal - discountAmount;
    const totalPrice = unitPrice * quantity;

    console.log('Subtotal: £' + subtotal.toFixed(2), 'Unit: £' + unitPrice.toFixed(2));
    console.log('=========================');

    return {
      unitPrice: Math.round(unitPrice * 100) / 100,
      totalPrice: Math.round(totalPrice * 100) / 100,
      breakdown: {
        windowType: 'arched-casement',
        shape: shape,
        frameWidth: frameWidth,
        frameHeight: frameHeight,
        sqm: sqm.toFixed(2),
        basePrice: basePrice.toFixed(2),
        patternPrice: patternPrice,
        barsPrice: barsPrice.toFixed(2),
        additionalOptions: additionalPrice,
        subtotal: subtotal.toFixed(2),
        quantity: quantity,
        discount: (discount * 100) + '%',
        discountAmount: discountAmount.toFixed(2),
        unitPrice: unitPrice.toFixed(2),
        totalPrice: totalPrice.toFixed(2),
        vatAmount: (totalPrice * this.pricing.vatRate).toFixed(2),
        totalWithVat: (totalPrice * (1 + this.pricing.vatRate)).toFixed(2)
      }
    };
  }

    getQuantityDiscount(quantity) {
    // Znajdź odpowiedni rabat dla ilości
    let discount = 0;
    for (const tier of this.pricing.quantityDiscounts) {
      if (quantity >= tier.minQty) {
        discount = tier.discount;
      }
    }
    return discount;
  }

  formatPrice(price, includeSymbol = true) {
    const formatted = price.toFixed(2);
    return includeSymbol ? `£${formatted}` : formatted;
  }

  validateConfiguration(configuration) {
    const requiredFields = [
      'width', 'height', 'frameType', 'glassType',
      'openingType', 'colorType', 'glassSpec', 'glassFinish'
    ];

    const missingFields = [];

    requiredFields.forEach(field => {
      if (!configuration[field]) {
        missingFields.push(field);
      }
    });

    return {
      isValid: missingFields.length === 0,
      missingFields: missingFields
    };
  }

  generatePriceSummary(configuration) {
    const calculation = this.calculate(configuration);
    
    const summary = {
      dimensions: `${configuration.width}mm × ${configuration.height}mm`,
      frameDimensions: `${calculation.breakdown.frameWidth}mm × ${calculation.breakdown.frameHeight}mm`,
      area: calculation.breakdown.sqm + ' m²',
      sizeMultiplier: `${((calculation.breakdown.sizeMultiplier - 1) * 100).toFixed(0)}%`,
      
      // Ceny składowe
      basePrice: this.formatPrice(parseFloat(calculation.breakdown.basePrice)),
      barsPrice: this.formatPrice(calculation.breakdown.barsPrice),
      additionalOptions: this.formatPrice(calculation.breakdown.additionalOptions),
      
      // Podsumowanie
      subtotal: this.formatPrice(parseFloat(calculation.breakdown.subtotal)),
      quantity: configuration.quantity || 1,
      discount: calculation.breakdown.discount,
      unitPrice: this.formatPrice(calculation.unitPrice),
      totalPrice: this.formatPrice(calculation.totalPrice),
      
      // VAT
      vatAmount: this.formatPrice(parseFloat(calculation.breakdown.vatAmount)),
      totalWithVat: this.formatPrice(parseFloat(calculation.breakdown.totalWithVat))
    };

    return summary;
  }

  // Metoda do wyświetlania szczegółowego breakdown (do debugowania)
  getDetailedBreakdown(configuration) {
    const calc = this.calculate(configuration);
    
    console.log('=== FULL PRICE BREAKDOWN ===');
    console.log('Input dimensions:', configuration.width, 'x', configuration.height);
    console.log('Frame dimensions:', calc.breakdown.frameWidth, 'x', calc.breakdown.frameHeight);
    console.log('Area:', calc.breakdown.sqm, 'm²');
    console.log('Size multiplier:', calc.breakdown.sizeMultiplier);
    console.log('Base price: £', calc.breakdown.basePrice);
    console.log('Bars price: £', calc.breakdown.barsPrice);
    console.log('Additional options: £', calc.breakdown.additionalOptions);
    console.log('Subtotal: £', calc.breakdown.subtotal);
    console.log('Quantity:', configuration.quantity || 1);
    console.log('Quantity discount:', calc.breakdown.discount);
    console.log('Discount amount: £', calc.breakdown.discountAmount);
    console.log('Unit price: £', calc.breakdown.unitPrice);
    console.log('Total price: £', calc.breakdown.totalPrice);
    console.log('VAT: £', calc.breakdown.vatAmount);
    console.log('Total with VAT: £', calc.breakdown.totalWithVat);
    console.log('============================');
    
    return calc.breakdown;
  }
}

// Utwórz globalną instancję
window.priceCalculator = new PriceCalculator();

// Eksportuj dla kompatybilności wstecznej
window.calculatePrice = function(configuration) {
  return window.priceCalculator.calculate(configuration);
};