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
    
    // 1. CENA BAZOWA z degresywnym mnożnikiem
    const sizeMultiplier = this.getSizeMultiplier(sqm);
    const basePrice = this.pricing.basePricePerSqm * sqm * sizeMultiplier;
    
    // 2. CENA ZA SZPROSY (bars)
    const barsPrice = this.calculateBarsPrice(
      configuration.upperBars || 'none',
      configuration.lowerBars || 'none',
      configuration.customBars
    );
    
    // 3. DODATKOWE OPCJE (przekazujemy sqm i basePrice)
    const additionalPrice = this.calculateAdditionalOptions(configuration, sqm, basePrice);
    
    // 4. SUMA PRZED RABATEM
    const subtotal = basePrice + barsPrice + additionalPrice;
    
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
      galleryIronmongery.horns
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
    
    // Opening type
    if (configuration.openingType && options.openingTypes[configuration.openingType]) {
      const openingPrice = options.openingTypes[configuration.openingType];
      additionalPrice += openingPrice;
      console.log('Opening (' + configuration.openingType + '): £' + openingPrice);
    }
    
    // Color type - DUAL: 10% od ceny bazowej
    if (configuration.colorType && options.colorTypes[configuration.colorType]) {
      const colorMultiplier = options.colorTypes[configuration.colorType];
      if (colorMultiplier > 0 && colorMultiplier < 1) {
        // To jest procent (np. 0.10 = 10%)
        const colorPrice = basePrice * colorMultiplier;
        additionalPrice += colorPrice;
        console.log('Color type (' + configuration.colorType + '): ' + (colorMultiplier * 100) + '% × £' + basePrice.toFixed(2) + ' = £' + colorPrice.toFixed(2));
      } else {
        // Stała kwota
        additionalPrice += colorMultiplier;
        console.log('Color type (' + configuration.colorType + '): £' + colorMultiplier);
      }
    }
    
    // Color surcharge based on color choice
    if (options.colorSurcharges) {
      let colorSurcharge = 0;
      
      // Get the colors being used
      const colorsToCheck = [];
      if (configuration.colorType === 'single' && configuration.colorSingle) {
        colorsToCheck.push(configuration.colorSingle);
      } else if (configuration.colorType === 'dual') {
        if (configuration.colorInterior) colorsToCheck.push(configuration.colorInterior);
        if (configuration.colorExterior) colorsToCheck.push(configuration.colorExterior);
      }
      
      // Find the highest surcharge from selected colors
      colorsToCheck.forEach(color => {
        let surcharge = 0;
        if (color === 'white') {
          surcharge = options.colorSurcharges.white || 0;
        } else if (color === 'oak') {
          surcharge = options.colorSurcharges.oak || 0.20;
        } else if (color === 'custom') {
          surcharge = options.colorSurcharges.custom || 0.10;
        } else {
          surcharge = options.colorSurcharges.other || 0.05;
        }
        if (surcharge > colorSurcharge) {
          colorSurcharge = surcharge;
        }
      });
      
      if (colorSurcharge > 0) {
        const surchargePrice = basePrice * colorSurcharge;
        additionalPrice += surchargePrice;
        console.log('Color surcharge: ' + (colorSurcharge * 100) + '% × £' + basePrice.toFixed(2) + ' = £' + surchargePrice.toFixed(2));
      }
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