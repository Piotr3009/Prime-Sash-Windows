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

    // Wait for DB prices before calculating — prevents stale defaults
    if (!window.pricingReady) {
      return { unitPrice: 0, totalPrice: 0, breakdown: {}, noDimensions: true, message: 'Loading prices...' };
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

    // ═══ ARCHED SASH PRICING ═══
    // sashType 'arched' is its own product: base × 1.6 (curved IGU is inside the
    // multiplier, spec O3/O7), then pattern premium + bars + options.
    if (configuration.sashType === 'arched') {
      return this.calculateArchedSash(configuration, sqm, frameWidth, frameHeight);
    }

    // 1. CENA BAZOWA (SASH)
    let basePrice;
    let sizeMultiplier;
    if (configuration.sashType === 'triple') {
      // Triple: flat £950/sqm, no size degression
      sizeMultiplier = 1.0;
      basePrice = 950 * sqm;
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
      }
    }
    
    // 3. DODATKOWE OPCJE (przekazujemy sqm i basePrice, sqm jako glassMultiplier — glass per sqm)
    const additionalPrice = this.calculateAdditionalOptions(configuration, sqm, basePrice, sqm);
    
    // 4. SUMA PRZED RABATEM (bez dopłaty za kolor)
    let subtotal = basePrice + barsPrice + fixBarsPrice + additionalPrice;

    // ARCHED HEAD SURCHARGE: +10% on subtotal (glazing arch on any sash type)
    if (configuration.headType === 'arch') {
      const archedSurcharge = subtotal * 0.10;
      subtotal += archedSurcharge;
    }

    // KOLOR: liczone od czystego subtotal (single white = baza)
    if (configuration.colorType === 'dual') {
      // Dual color: +15% od subtotal single white
      const dualSurcharge = subtotal * 0.15;
      subtotal += dualSurcharge;
    } else if (configuration.colorType === 'single' && configuration.colorSingle && configuration.colorSingle !== 'white') {
      // Single inny kolor: +5% od subtotal
      const colorSurcharge = subtotal * 0.05;
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
    // Upper sash bars
    if (upperBars === 'custom' && customBars?.upper) {
      const upperCount = (customBars.upper.horizontal?.length || 0) + 
                         (customBars.upper.vertical?.length || 0);
      totalBars += upperCount;
    } else if (upperBars && upperBars !== 'none' && barConfig.barsPerPattern[upperBars] !== undefined) {
      const upperCount = barConfig.barsPerPattern[upperBars];
      totalBars += upperCount;
    }
    
    // Lower sash bars
    if (lowerBars === 'custom' && customBars?.lower) {
      const lowerCount = (customBars.lower.horizontal?.length || 0) + 
                         (customBars.lower.vertical?.length || 0);
      totalBars += lowerCount;
    } else if (lowerBars && lowerBars !== 'none' && barConfig.barsPerPattern[lowerBars] !== undefined) {
      const lowerCount = barConfig.barsPerPattern[lowerBars];
      totalBars += lowerCount;
    }
    
    const barsPrice = totalBars * barConfig.pricePerBar;
    return barsPrice;
  }

  calculateAdditionalOptions(configuration, sqm, basePrice, glassMultiplier) {
    if (glassMultiplier === undefined) glassMultiplier = 1;
    const options = this.pricing.additionalOptions;
    let additionalPrice = 0;
    // Frame type
    if (configuration.frameType && options.frameTypes[configuration.frameType]) {
      const framePrice = options.frameTypes[configuration.frameType];
      additionalPrice += framePrice;
    }
    
    // Glass type (sliding/bifold: per sqm via glassMultiplier)
    if (configuration.glassType && options.glassTypes[configuration.glassType]) {
      const glassPrice = options.glassTypes[configuration.glassType] * glassMultiplier;
      additionalPrice += glassPrice;
    }
    
    // Glass specification - LAMINATED: £/m² (already per sqm, no multiplier needed)
    if (configuration.glassSpec && options.glassSpec[configuration.glassSpec]) {
      const specPricePerSqm = options.glassSpec[configuration.glassSpec];
      const specPrice = specPricePerSqm * sqm; // mnożenie przez m²
      additionalPrice += specPrice;
    }
    
    // Glass finish (sliding/bifold: per sqm via glassMultiplier)
    if (configuration.glassFinish && options.glassFinish[configuration.glassFinish]) {
      const finishPrice = options.glassFinish[configuration.glassFinish] * glassMultiplier;
      additionalPrice += finishPrice;
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
      }
    }
    
    // Opening type — skip for triple (bottom-only is the only option, no discount)
    if (configuration.sashType !== 'triple' && configuration.openingType && options.openingTypes[configuration.openingType]) {
      const openingPrice = options.openingTypes[configuration.openingType];
      additionalPrice += openingPrice;
    }
    
    // Color type - DUAL: liczone od subtotal (patrz niżej)
    // (przeniesione poza tę funkcję)
    
    // Color surcharge based on color choice
    // Color surcharges handled above (single non-white +5%, dual +15%)
    
    // Sill extension
    if (configuration.sillExtension && options.sillExtension && options.sillExtension[configuration.sillExtension]) {
      const sillPrice = options.sillExtension[configuration.sillExtension];
      additionalPrice += sillPrice;
    }
    
    // PAS24
    if (configuration.pas24 && options.pas24[configuration.pas24]) {
      const pas24Price = options.pas24[configuration.pas24];
      additionalPrice += pas24Price;
    }
    return additionalPrice;
  }

  calculateCasement(configuration, sqm, frameWidth, frameHeight) {
    const c = this.pricing.casement;
    const layout = configuration.casementLayout || '040L';
    const layoutData = c.layouts[layout] || { mullions: 0, transoms: 0, sashes: 1 };
    
    // Base price: firstSqmPrice + (sqm - 1) * basePricePerSqm + mullions/transoms/sashes from pricing-config (single source of truth)
    let basePrice = c.firstSqmPrice;
    if (sqm > 1) {
      const midSqm = Math.min(sqm, 3) - 1;              // sqm 1–3 at full rate
      basePrice += midSqm * c.basePricePerSqm;
      if (sqm > 3) {                                     // portion above 3 sqm discounted
        basePrice += (sqm - 3) * c.basePricePerSqm * (c.largeSqmFactor || 1);
      }
    }
    basePrice = Math.max(basePrice, c.basePriceMin);
    
    const mullionPrice = layoutData.mullions * c.mullionPrice;
    const transomPrice = layoutData.transoms * c.transomPrice;
    // 022 clickable openers: pay per opening pane when hinges array present
    let sashPrice;
    if (Array.isArray(configuration.casementHinges)) {
      const openers = configuration.casementHinges.filter(h => h === true || (typeof h === 'string' && h !== 'fixed')).length;
      sashPrice = openers * c.sashPrice;
    } else {
      sashPrice = layoutData.sashes * c.sashPrice;
    }
    
    basePrice += mullionPrice + transomPrice + sashPrice;
    
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
    }

    // Fanlight bars — priced per bar, per fan pane (H and V, max 2 each)
    const FAN_CELLS = { '021': 1, '031': 2, '032': 1, '052L': 1, '052R': 1, '131': 1, '132': 2, '133': 3, '022': 2, '013': 1, '023': 2 };  // TOP fan cells
    const FAN2_CELLS = { '013': 1, '023': 2 };  // BOTTOM tier cells
    const fanHBars = Math.min(2, configuration.casementFanHBars || 0);
    const fanVBars = Math.min(2, configuration.casementFanVBars || 0);
    const fanCells = FAN_CELLS[layout] || 0;
    if ((fanHBars + fanVBars) > 0 && fanCells > 0) {
      barsPrice += (fanHBars + fanVBars) * 2 * this.pricing.barPricing.pricePerBar * fanCells;
    }
    const fan2HBars = Math.min(2, configuration.casementFan2HBars || 0);
    const fan2VBars = Math.min(2, configuration.casementFan2VBars || 0);
    const fan2Cells = FAN2_CELLS[layout] || 0;
    if ((fan2HBars + fan2VBars) > 0 && fan2Cells > 0) {
      barsPrice += (fan2HBars + fan2VBars) * 2 * this.pricing.barPricing.pricePerBar * fan2Cells;
    }
    
    // Additional options (glass, finish, PAS24, sill, ironmongery — same as sash, glass per sqm)
    const additionalPrice = this.calculateAdditionalOptions(configuration, sqm, basePrice, sqm);
    
    // Subtotal
    let subtotal = basePrice + barsPrice + additionalPrice;
    
    // Colour surcharges (same logic as sash)
    if (configuration.colorType === 'dual') {
      const dualSurcharge = subtotal * 0.15;
      subtotal += dualSurcharge;
    } else if (configuration.colorType === 'single' && configuration.colorSingle && configuration.colorSingle !== 'white') {
      const colorSurcharge = subtotal * 0.10;
      subtotal += colorSurcharge;
    }
    
    // Quantity discount
    const quantity = configuration.quantity || 1;
    const discount = this.getQuantityDiscount(quantity);
    const discountAmount = subtotal * discount;
    const unitPrice = subtotal - discountAmount;
    const totalPrice = unitPrice * quantity;
    
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

    // Base price by shape
    let basePrice;
    if (shape === 'rectangle') {
      basePrice = sqm * 450;
    } else if (shape === 'circle') {
      basePrice = sqm * 1200;
    } else {
      // Arch shapes: £800 first sqm + £400 per additional
      basePrice = 800 + Math.max(0, sqm - 1) * 400;
    }

    // FD30/FD60 premium
    if (type === 'fd30') { basePrice += sqm * 150; }
    else if (type === 'fd60') { basePrice += sqm * 300; }

    // Pattern premium
    let patternPrice = 0;
    const semiPat = configuration.fixSemiBarPattern || 'none';
    const gothPat = configuration.fixGothicBars || 'none';
    const circlePat = configuration.fixCircleBarPattern || 'none';
    const patternPrices = { 'intersecting': 250, 'half-hub': 150, 'hub-spoke': 210, 'double-hub-spoke': 270, 'triple-hub-spoke': 320, 'sunburst': 300 };
    if (semiPat !== 'none' && patternPrices[semiPat]) patternPrice = patternPrices[semiPat];
    if (gothPat !== 'none' && patternPrices[gothPat]) patternPrice = patternPrices[gothPat];
    if (circlePat !== 'none' && patternPrices[circlePat]) patternPrice = patternPrices[circlePat];

    // Bars
    const hBars = configuration.casementHBars || 0;
    const vBars = configuration.casementVBars || 0;
    const totalBars = hBars + vBars;
    const barRate = this.pricing.barPricing ? this.pricing.barPricing.pricePerBar : 15;
    const barsPrice = totalBars * 2 * barRate;

    // Additional options (glass, sill — glass per sqm)
    const additionalPrice = this.calculateAdditionalOptions(configuration, sqm, basePrice, sqm);

    let subtotal = basePrice + patternPrice + barsPrice + additionalPrice;

    // Colour surcharges
    if (configuration.colorType === 'dual') {
      const surcharge = subtotal * 0.15;
      subtotal += surcharge;
    } else if (configuration.colorType === 'single' && configuration.colorSingle && configuration.colorSingle !== 'white') {
      const surcharge = subtotal * 0.10;
      subtotal += surcharge;
    }

    const quantity = configuration.quantity || 1;
    const discount = this.getQuantityDiscount(quantity);
    const discountAmount = subtotal * discount;
    const unitPrice = subtotal - discountAmount;
    const totalPrice = unitPrice * quantity;

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
    const DOOR_BASE_PER_SQM = 980;
    // French doors: same rate as single. Double = 2x the area, so the extra work
    // is already paid for by the larger m2 — no per-sqm surcharge on top.
    const FRENCH_SURCHARGE_PER_SQM = 0;
    const PANEL_BASE_PER_SQM = 550; // side panels
    const TRANSOM_PER_SQM = 500;    // french transom / fanlight (own rate)
    const SILL_EXTENSION_PRICE = 80;
    const BEADING_DOOR = 80;
    const BEADING_PANEL = 40;
    const RECESSED_DOOR = 120;
    const RECESSED_PANEL = 80;
    const SINGLE_COLOUR_SURCHARGE = 0.05;
    const DUAL_COLOUR_SURCHARGE = 0.15;
    // ── 1. Door leaf base price ──
    const doorW = configuration.width || 900;
    const doorH = configuration.height || 2100;
    const doorSqm = (doorW / 1000) * (doorH / 1000);
    const isSlidingDoor = (configuration.doorType || 'single-external') === 'sliding';
    const isBifoldDoor = (configuration.doorType || 'single-external') === 'bifold';
    const isFrenchDoor = (configuration.doorType || 'single-external') === 'french';

    let basePrice;
    if (isSlidingDoor) {
      const SLIDING_STANDARD_PER_SQM = 1100;
      const SLIDING_EXTRA_PER_SQM = 1400;
      const slidingRate = configuration.extraWidth ? SLIDING_EXTRA_PER_SQM : SLIDING_STANDARD_PER_SQM;
      basePrice = slidingRate * doorSqm;
    } else if (isBifoldDoor) {
      const BIFOLD_PER_SQM = 1050;
      basePrice = BIFOLD_PER_SQM * doorSqm;
    } else if ((configuration.doorType || '') === 'front-door') {
      // Front doors: heavier construction, panel grid, entrance-grade spec —
      // priced 28% above the patio-door base rate (was 60%; -20% price cut, Aug 2026).
      const FRONT_DOOR_PER_SQM = Math.round(DOOR_BASE_PER_SQM * 1.28);  // 1254
      basePrice = FRONT_DOOR_PER_SQM * doorSqm;
    } else {
      basePrice = DOOR_BASE_PER_SQM * doorSqm;
      if (isFrenchDoor) {
        basePrice += FRENCH_SURCHARGE_PER_SQM * doorSqm;
      }
    }

    // ── 2. Side panels ──
    let panelPrice = 0;
    const sidePanels = configuration.sidePanels || 'none';
    const hasLeft = sidePanels === 'left' || sidePanels === 'both';
    const hasRight = sidePanels === 'right' || sidePanels === 'both';
    let panelCount = 0;

    if (hasLeft) {
      const leftW = configuration.sideLeftWidth || 500;
      const leftSqm = (leftW / 1000) * (doorH / 1000);
      panelPrice += PANEL_BASE_PER_SQM * leftSqm;
      panelCount++;
    }
    if (hasRight) {
      const rightW = configuration.sideRightWidth || 500;
      const rightSqm = (rightW / 1000) * (doorH / 1000);
      panelPrice += PANEL_BASE_PER_SQM * rightSqm;
      panelCount++;
    }

    // ── 3. Bars (from DB price) ──
    const barRate = this.pricing.barPricing ? this.pricing.barPricing.pricePerBar : 20;
    const doorHBars = configuration.hBars || 0;
    const doorVBars = configuration.vBars || 0;
    const doorBarCount = doorHBars + doorVBars;
    // Sliding/Bifold: each panel has its own bars
    const doorPanelCount = (isSlidingDoor || isBifoldDoor) ? (configuration.panelCount || 2) : 1;
    let barsPrice = doorBarCount * barRate * doorPanelCount;

    const sideHBars = configuration.sideHBars || 0;
    const sideVBars = configuration.sideVBars || 0;
    const sideBarCount = sideHBars + sideVBars;
    barsPrice += sideBarCount * panelCount * barRate;

    // ── 3b. Transom / fanlight (french only, stage 2) ──
    // Area = full width (doors + side panels) × transom height, priced at the
    // side-panel rate (£500/m²). Opening: flat £100 hardware surcharge.
    // Bars 'match': computed transom bar count × standard barRate.
    let transomPrice = 0;
    let transomSqm = 0;
    const transomType = configuration.transomType || 'none';
    const isFrontDoor = (configuration.doorType || 'single-external') === 'front-door';
    if ((isFrenchDoor || isFrontDoor) && transomType !== 'none') {
      const tH = (configuration.transomHeight || 450) / 1000;
      const totalWm = (doorW / 1000)
        + (hasLeft ? (configuration.sideLeftWidth || 500) / 1000 : 0)
        + (hasRight ? (configuration.sideRightWidth || 500) / 1000 : 0);
      transomSqm = totalWm * tH;
      transomPrice = TRANSOM_PER_SQM * transomSqm;
      // Decorative fanlight bar patterns (hub & spoke, double, triple, daisy):
      // flat charge for the joinery work, on top of the transom rate.
      const FANLIGHT_PATTERN_PRICE = 400;
      if (isFrontDoor && configuration.fanBarPattern && configuration.fanBarPattern !== 'none') {
        transomPrice += FANLIGHT_PATTERN_PRICE;
      }
      if (transomType === 'opening') {
        const TRANSOM_OPENING_SURCHARGE = 100;
        transomPrice += TRANSOM_OPENING_SURCHARGE;
      }
      if (configuration.transomBars === 'match') {
        const tBarsOverDoors = doorVBars > 0 ? (doorVBars * 2 + 1) : 0;
        const tBarsOverSides = sideVBars * panelCount;
        transomPrice += (tBarsOverDoors + tBarsOverSides) * barRate;
      }
    }

    // ── 4. Sill extension ──
    let sillPrice = 0;
    if (configuration.thresholdExtension > 0) {
      if (isSlidingDoor || isBifoldDoor) {
        // Sliding/Bifold: price per linear meter of door width
        const SILL_RATE_PER_M = 80;
        sillPrice = Math.round(SILL_RATE_PER_M * (doorW / 1000));
      } else {
        sillPrice = SILL_EXTENSION_PRICE;
      }
    }

    // ── 5. Paneling (only when not full-glass) ──
    let panelingPrice = 0;
    const paneling = configuration.doorPaneling || 'flat';
    const doorStyleForPrice = configuration.doorStyle || 'full-glass';
    const sideStyle = configuration.sideStyle || 'full-glass';
    const chargeablePanels = sideStyle === 'same' ? panelCount : 0;
    if (doorStyleForPrice !== 'full-glass') {
      if (paneling === 'beading') {
        panelingPrice = (BEADING_DOOR * doorPanelCount) + (chargeablePanels * BEADING_PANEL);
      } else if (paneling === 'panel') {
        panelingPrice = (RECESSED_DOOR * doorPanelCount) + (chargeablePanels * RECESSED_PANEL);
      }
    }

    // ── 6. Glass (from DB — uses calculateAdditionalOptions) ──
    const totalSqm = doorSqm + (hasLeft ? (configuration.sideLeftWidth || 500) / 1000 * doorH / 1000 : 0)
                              + (hasRight ? (configuration.sideRightWidth || 500) / 1000 * doorH / 1000 : 0)
                              + transomSqm;
    // Sliding/Bifold: glass surcharges scale with total sqm (each panel has its own glass)
    const glassMultiplier = (isSlidingDoor || isBifoldDoor) ? totalSqm : 1;
    const additionalPrice = this.calculateAdditionalOptions(configuration, totalSqm, basePrice + panelPrice, glassMultiplier);

    // ── Subtotal ──
    let subtotal = basePrice + panelPrice + barsPrice + sillPrice + panelingPrice + transomPrice + additionalPrice;

    // ── 7. Colour surcharge ──
    let colourSurcharge = 0;
    const isWhite = !configuration.woodColor || configuration.woodColor === '#FAFAFA' || configuration.woodColor === '#F6F6F6' || configuration.woodColor === '#ffffff';
    if (!configuration.sameColor) {
      colourSurcharge = subtotal * DUAL_COLOUR_SURCHARGE;
    } else if (!isWhite) {
      colourSurcharge = subtotal * SINGLE_COLOUR_SURCHARGE;
    }
    subtotal += colourSurcharge;

    // ── Quantity ──
    const quantity = configuration.quantity || 1;
    const discount = this.getQuantityDiscount(quantity);
    const discountAmount = subtotal * discount;
    const unitPrice = subtotal - discountAmount;
    const totalPrice = unitPrice * quantity;

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
        transomPrice: transomPrice.toFixed(2),
        transomSqm: transomSqm.toFixed(2),
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
  // ═══════════════════════════════════════════════════════════════════════
  // ARCHED SASH (spec O2/O3)
  //   (basePrice_double(sqm) × 1.6) + archPatternPremium + bars + options
  // The 1.6 multiplies the BASE ONLY — not the subtotal. Glazing Arch's +10%
  // works on the subtotal, but that is a different product and headType is
  // ignored here. Colour and quantity then behave exactly like a double sash.
  // ═══════════════════════════════════════════════════════════════════════
  calculateArchedSash(configuration, sqm, frameWidth, frameHeight) {
    const A = window.ArchedSash;
    const shape = configuration.archShape || 'semi-circle';

    // Base: the double-hung base for this area, × 1.6
    const sizeMultiplier = this.getSizeMultiplier(sqm);
    const basePriceDouble = this.pricing.basePricePerSqm * sqm * sizeMultiplier;
    const basePrice = basePriceDouble * 1.6;

    // Arch bar pattern premium — same table as arched casement
    const pattern = configuration.archBarPattern || 'none';
    const patternPrice = (A && A.PATTERN_PREMIUM[pattern]) ? A.PATTERN_PREMIUM[pattern] : 0;

    // Upper (arched) sash grid — casement convention: (h + v) × 2 × rate
    const barRate = this.pricing.barPricing ? this.pricing.barPricing.pricePerBar : 15;
    const archBars = (configuration.archHBars || 0) + (configuration.archVBars || 0);
    const archBarsPrice = archBars * 2 * barRate;

    // Lower sash: with 'match' (22.08.2026) its bars continue the upper sash's
    // columns — priced per bar like any other bar: (V + H) × rate. Otherwise the
    // ordinary sash bar pricing applies.
    const lowerBarsPrice = (configuration.lowerBars === 'match')
      ? ((configuration.lowerVBars || 0) + (configuration.lowerHBars || 0)) * barRate
      : this.calculateBarsPrice('none', configuration.lowerBars || 'none', configuration.customBars);

    const additionalPrice = this.calculateAdditionalOptions(configuration, sqm, basePrice, sqm);

    let subtotal = basePrice + patternPrice + archBarsPrice + lowerBarsPrice + additionalPrice;

    // Colour — identical to the double sash branch (single non-white +5%, dual +15%)
    if (configuration.colorType === 'dual') {
      subtotal += subtotal * 0.15;
    } else if (configuration.colorType === 'single' && configuration.colorSingle && configuration.colorSingle !== 'white') {
      subtotal += subtotal * 0.05;
    }

    const quantity = configuration.quantity || 1;
    const discount = this.getQuantityDiscount(quantity);
    const discountAmount = subtotal * discount;
    const unitPrice = subtotal - discountAmount;
    const totalPrice = unitPrice * quantity;

    const metrics = A ? A.metricsFor(shape, frameWidth, frameHeight, configuration.archProfile) : null;

    return {
      unitPrice: Math.round(unitPrice * 100) / 100,
      totalPrice: Math.round(totalPrice * 100) / 100,
      breakdown: {
        windowType: 'arched-sash',
        archShape: shape,
        archProfile: metrics ? metrics.archProfile : null,
        archRise: metrics ? metrics.archRise : null,
        straightHeight: metrics ? metrics.straightHeight : null,
        upperMaxDrop: metrics ? metrics.upperMaxDrop : null,
        frameWidth: frameWidth,
        frameHeight: frameHeight,
        sqm: sqm.toFixed(2),
        sizeMultiplier: sizeMultiplier,
        basePriceDouble: basePriceDouble.toFixed(2),
        archMultiplier: 1.6,
        basePrice: basePrice.toFixed(2),
        patternPrice: patternPrice,
        archBarsPrice: archBarsPrice.toFixed(2),
        lowerBarsPrice: lowerBarsPrice,
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

  calculateArchedCasement(configuration, sqm, frameWidth, frameHeight) {
    const shape = configuration.casArchShape || 'semi-circle';

    // Base: £1200 first sqm + £600 per additional sqm
    let basePrice = 1200 + Math.max(0, sqm - 1) * 600;

    // Sash (1 leaf): +£50
    basePrice += 50;
    // Pattern premium (same as fix)
    let patternPrice = 0;
    const semiPat = configuration.fixSemiBarPattern || 'none';
    const gothPat = configuration.fixGothicBars || 'none';
    const patternPrices = { 'intersecting': 250, 'half-hub': 150, 'hub-spoke': 210, 'double-hub-spoke': 270, 'triple-hub-spoke': 320 };
    if (semiPat !== 'none' && patternPrices[semiPat]) patternPrice = patternPrices[semiPat];
    if (gothPat !== 'none' && patternPrices[gothPat]) patternPrice = patternPrices[gothPat];

    // Bars
    const hBars = configuration.casementHBars || 0;
    const vBars = configuration.casementVBars || 0;
    const totalBars = hBars + vBars;
    const barRate = this.pricing.barPricing ? this.pricing.barPricing.pricePerBar : 15;
    const barsPrice = totalBars * 2 * barRate;

    // Additional options (glass, sill — glass per sqm)
    const additionalPrice = this.calculateAdditionalOptions(configuration, sqm, basePrice, sqm);

    let subtotal = basePrice + patternPrice + barsPrice + additionalPrice;

    // Colour surcharges
    if (configuration.colorType === 'dual') {
      const surcharge = subtotal * 0.15;
      subtotal += surcharge;
    } else if (configuration.colorType === 'single' && configuration.colorSingle && configuration.colorSingle !== 'white') {
      const surcharge = subtotal * 0.10;
      subtotal += surcharge;
    }

    const quantity = configuration.quantity || 1;
    const discount = this.getQuantityDiscount(quantity);
    const discountAmount = subtotal * discount;
    const unitPrice = subtotal - discountAmount;
    const totalPrice = unitPrice * quantity;

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
    return calc.breakdown;
  }
}

// Utwórz globalną instancję
window.priceCalculator = new PriceCalculator();

// Eksportuj dla kompatybilności wstecznej
window.calculatePrice = function(configuration) {
  return window.priceCalculator.calculate(configuration);
};

// ═══════════════════════════════════════════════════════════════════════════
// ARCHED SASH — one source of truth for shape names, rise and dimension limits.
//
// Everything outside the 3D bundle (online-estimate.html validation + handlers,
// estimate-renderer SVG/spec rows, edit-mode restore, specification-controller
// labels) reads these helpers, so the four ratios are stated once here.
// The bundle cannot import from js/, so ArchedSashWindow.jsx mirrors the same
// four ratios — keep the two in step.
//
// Terminology: the line where the arch begins is the "arch start"; the straight
// part below it is `straightHeight`. (Piotr, 21.08 — do not use the s-word.)
// ═══════════════════════════════════════════════════════════════════════════
window.ArchedSash = (function () {
  // rise as a fraction of the EXTERNAL frame width (spec §5)
  var RISE_RATIO = {
    'segmental-arch': 0.20,
    'elliptical-arch': 0.325,
    'semi-circle': 0.50,
    'gothic-arch': Math.sqrt(3) / 2,
  };
  // Gothic steepness (owner decision 22.08.2026): the pointed arch can be the
  // classic equilateral one or a flatter "drop" arch. Rise as a fraction of W.
  // Default 'equilateral' = the original 0.866 — existing estimates unchanged.
  var GOTHIC_PROFILE_RATIO = {
    equilateral: Math.sqrt(3) / 2,   // 0.866
    drop: 0.70,
    shallow: 0.60,
  };
  var GOTHIC_PROFILE_NAMES = { equilateral: 'Equilateral', drop: 'Drop', shallow: 'Shallow' };
  var DEFAULT_GOTHIC_PROFILE = 'equilateral';

  // The radio values in online-estimate.html are the legacy short names; the
  // config/CSV value is the shared shape id used by casArchShape / fixShape.
  var SHAPE_FROM_RADIO = {
    gothic: 'gothic-arch',
    segmental: 'segmental-arch',
    semicircular: 'semi-circle',
    elliptical: 'elliptical-arch',
  };
  var RADIO_FROM_SHAPE = {
    'gothic-arch': 'gothic',
    'segmental-arch': 'segmental',
    'semi-circle': 'semicircular',
    'elliptical-arch': 'elliptical',
  };
  var SHAPE_NAMES = {
    'gothic-arch': 'Gothic',
    'segmental-arch': 'Segmental',
    'semi-circle': 'Semicircular',
    'elliptical-arch': 'Elliptical',
  };

  // Arch bar pattern premium — same table as arched casement (spec §3.3)
  var PATTERN_PREMIUM = {
    'intersecting': 250,
    'half-hub': 150,
    'hub-spoke': 210,
    'double-hub-spoke': 270,
    'triple-hub-spoke': 320,
  };

  // Which patterns each shape offers (spec §5 / O9)
  var PATTERNS_FOR_SHAPE = {
    'semi-circle': ['none', 'half-hub', 'hub-spoke', 'double-hub-spoke', 'triple-hub-spoke', 'intersecting'],
    'gothic-arch': ['none', 'intersecting'],
    'segmental-arch': ['none'],
    'elliptical-arch': ['none'],
  };

  var MIN_WIDTH = 400;          // O5
  var MAX_WIDTH = 1500;         // O5
  var MIN_STRAIGHT = 900;       // O4: H >= rise + 900
  var MIN_UPPER_STILE = 100;    // O8 (owner, 22.08.2026): straight stile of the upper sash >= 100 mm (was 300)
  var INNER_OFFSET = 144;       // H_inner = H_total - 144 (sill + head + running gaps) — geometry only, not validation
  var SASH_TRAVEL_MARGIN = 120; // same margin ParametricSashWindow leaves at the end of a sash's travel
  var HEIGHT_STEP = 10;         // the dimension selects only carry multiples of 10

  function riseFor(shape, extWidth, archProfile) {
    var r = RISE_RATIO[shape];
    if (r === undefined) r = RISE_RATIO['semi-circle'];
    if (shape === 'gothic-arch') {
      var pr = GOTHIC_PROFILE_RATIO[archProfile || DEFAULT_GOTHIC_PROFILE];
      if (pr !== undefined) r = pr;
    }
    return Math.round(r * (parseFloat(extWidth) || 0));
  }

  // Smallest external height that satisfies BOTH O4 and O8, on the 10 mm grid.
  function minHeightFor(shape, extWidth, archProfile) {
    var rise = riseFor(shape, extWidth, archProfile);
    var byStraight = rise + MIN_STRAIGHT;
    var byUpperStile = 2 * (rise + MIN_UPPER_STILE);   // straight stile = H/2 - rise (arch starts at H - rise, meeting line at H/2)
    var need = Math.max(byStraight, byUpperStile);
    return Math.ceil(need / HEIGHT_STEP) * HEIGHT_STEP;
  }

  // Widest external width whose minimum height still fits under maxHeight.
  function maxWidthFor(shape, maxHeight, archProfile) {
    var w = MAX_WIDTH;
    while (w > MIN_WIDTH && minHeightFor(shape, w, archProfile) > maxHeight) w -= HEIGHT_STEP;
    return w;
  }

  function metricsFor(shape, extWidth, extHeight, archProfile) {
    var W = parseFloat(extWidth) || 0;
    var H = parseFloat(extHeight) || 0;
    var rise = riseFor(shape, W, archProfile);
    var straightHeight = H - rise;
    var innerHeight = H - INNER_OFFSET;
    return {
      shape: shape,
      shapeName: SHAPE_NAMES[shape] || shape,
      archRise: rise,
      straightHeight: straightHeight,
      innerHeight: innerHeight,
      upperSashHeight: Math.round(innerHeight / 2),
      lowerSashHeight: Math.round(innerHeight / 2),
      // 22.08.2026: the upper sash travels like any sash — nothing in the box
      // stops it until its bottom rail nears the sill (O1 limit withdrawn).
      upperMaxDrop: Math.max(0, Math.round(innerHeight / 2 - SASH_TRAVEL_MARGIN)),
      // The lower sash stops where the arch starts: its top rail cannot enter the head.
      lowerMaxLift: Math.max(0, Math.round(straightHeight - H / 2)),   // = upper straight stile: lower top rail stops at the arch start
      archProfile: shape === 'gothic-arch' ? (GOTHIC_PROFILE_RATIO[archProfile] !== undefined ? archProfile : DEFAULT_GOTHIC_PROFILE) : null,
      minHeight: minHeightFor(shape, W, archProfile),
    };
  }

  return {
    RISE_RATIO: RISE_RATIO,
    GOTHIC_PROFILE_RATIO: GOTHIC_PROFILE_RATIO,
    GOTHIC_PROFILE_NAMES: GOTHIC_PROFILE_NAMES,
    DEFAULT_GOTHIC_PROFILE: DEFAULT_GOTHIC_PROFILE,
    SASH_TRAVEL_MARGIN: SASH_TRAVEL_MARGIN,
    SHAPE_FROM_RADIO: SHAPE_FROM_RADIO,
    RADIO_FROM_SHAPE: RADIO_FROM_SHAPE,
    SHAPE_NAMES: SHAPE_NAMES,
    PATTERN_PREMIUM: PATTERN_PREMIUM,
    PATTERNS_FOR_SHAPE: PATTERNS_FOR_SHAPE,
    MIN_WIDTH: MIN_WIDTH,
    MAX_WIDTH: MAX_WIDTH,
    MIN_STRAIGHT: MIN_STRAIGHT,
    MIN_UPPER_STILE: MIN_UPPER_STILE,
    INNER_OFFSET: INNER_OFFSET,
    riseFor: riseFor,
    minHeightFor: minHeightFor,
    maxWidthFor: maxWidthFor,
    metricsFor: metricsFor,
  };
})();
