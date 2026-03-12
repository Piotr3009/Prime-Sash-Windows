// configurator-core-optimized.js - Zoptymalizowany główny kontroler
class ConfiguratorCore {
  constructor() {
    this.state = window.AppState;
    this.modules = {};
    this.isInitialized = false;
  }

  async init() {
    console.log('ConfiguratorCore: Initializing...');
    
    try {
      this.checkDependencies();
      await this.initializeModules();
      this.attachEventHandlers();
      this.isInitialized = true;  // Ustawić PRZED loadSavedConfiguration i updateAll
      this.loadSavedConfiguration();
      this.updateAll();
      
      // Auto-save przy zamykaniu strony
      window.addEventListener('beforeunload', () => {
        // Zapisz currentConfig (ma wszystkie dane)
        if (window.currentConfig) {
          localStorage.setItem('lastWindowConfig', JSON.stringify(window.currentConfig));
        }
        // Zapisz też przez storage manager
        const config = this.state.get();
        if (this.modules.storage) {
          this.modules.storage.saveLastConfig(config);
        }
        console.log('💾 Saved configuration before page unload');
      });
      
      console.log('ConfiguratorCore: Ready');
    } catch (error) {
      console.error('ConfiguratorCore: Init failed', error);
      alert('Failed to initialize. Please refresh the page.');
    }
  }

  checkDependencies() {
    const required = ['config', 'priceCalculator', 'storageManager', 'UIHelpers', 'AppState'];
    const missing = required.filter(m => !window[m]);
    if (missing.length) throw new Error(`Missing: ${missing.join(', ')}`);
  }

  async initializeModules() {
    // Inicjalizuj moduły
    this.modules = {
      form: window.formHandler,
      visual: window.visualizationManager,
      bars: window.barsController,
      details: window.detailsController,
      spec: window.specificationController,
      dimension: window.dimensionHandler,
      storage: window.storageManager,
      price: window.priceCalculator
    };
    
    // Inicjalizuj form handler
    if (this.modules.form) {
      this.modules.form.init(this.state.get());
    }
    
    // Inicjalizuj wizualizację
    if (this.modules.visual) {
      this.modules.visual.init();
    }
    
    // Eksportuj dla kompatybilności
    window.currentConfig = this.state.config;
    
    // Ustaw domyślne wartości dla kolorów jeśli nie są ustawione
    if (!window.currentConfig.colorType) {
      window.currentConfig.colorType = 'single';
    }
    if (!window.currentConfig.colorSingle) {
      window.currentConfig.colorSingle = 'white';
      window.currentConfig.colorSingleName = 'Pure White';
    }
    
    // Subskrybuj zmiany
    this.state.subscribe(() => {
      window.currentConfig = this.state.config;
    });
  }

  attachEventHandlers() {
    const handlers = {
      // Dimensions
      'dimensionChange': (data) => {
        this.state.update(data.dimension, data.value);
        this.updateAll();
      },
      
      // Radio changes
      'radioChange': (data) => {
        const fieldMap = {
          'measurement-type': 'measurementType',
          'frame-type': 'frameType',
          'color-type': 'colorType',
          'glass-type': 'glassType',
          'opening-type': 'openingType',
          'glass-spec': 'glassSpec',
          'glass-finish': 'glassFinish',
          'pas24': 'pas24'
        };
        
        const field = fieldMap[data.name] || data.name;
        this.state.update(field, data.value);
        this.updateAll();
      },
      
      // Colors
      'singleColorSelect': (data) => {
        this.state.update({
          singleColor: data.color,
          color: data.color
        });
        this.updateAll();
      },
      
      'dualColorSelect': (data) => {
        this.state.update({
          interiorColor: data.interior,
          exteriorColor: data.exterior
        });
        this.updateAll();
      },
      
      'customExteriorColor': (data) => {
        this.state.update('exteriorColor', data.color);
        this.updateAll();
      },
      
      // Selects
      'selectChange': (data) => {
        this.state.update(data.name, data.value);
        this.updateAll();
      },
      
      // Quantity
      'quantityChange': (value) => {
        this.state.update('quantity', value);
        this.updateAll();
      },
      
      // Actions
      'addToEstimate': () => this.addToEstimate(),
      'saveConfiguration': () => this.saveConfiguration(),
      'saveVariant': () => this.saveAsVariant()
    };
    
    // Attach all handlers
    if (this.modules.form) {
      Object.entries(handlers).forEach(([event, handler]) => {
        this.modules.form.on(event, handler);
      });
    }
    
    // Apply buttons handlers
    this.attachApplyButtons();
  }

  attachApplyButtons() {
    const applyButtons = [
      { id: 'apply-dimensions', handler: () => this.applySection('dimensions'), order: 1 },
      { id: 'apply-bars', handler: () => this.applySection('bars'), order: 2 },
      { id: 'apply-frame', handler: () => this.applySection('frame'), order: 3 },
      { id: 'apply-color', handler: () => this.applySection('color'), order: 4 },
      { id: 'apply-glass', handler: () => this.applySection('glass'), order: 5 },
      { id: 'apply-opening', handler: () => this.applySection('opening'), order: 6 },
      { id: 'apply-pas24', handler: () => this.applySection('pas24'), order: 7 },
      { id: 'apply-details', handler: () => this.applySection('details'), order: 8 },
      { id: 'apply-glass-spec', handler: () => this.applySection('glassSpec'), order: 9 }
    ];
    
    // Zapamiętaj listę buttonów
    this.applyButtonsOrder = applyButtons;
    
    // Pobierz zapisany stan z localStorage
    this.appliedSections = JSON.parse(localStorage.getItem('byow_applied_sections') || '{}');
    
    applyButtons.forEach(({ id, handler, order }) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      
      btn.addEventListener('click', (e) => {
        // Sprawdź czy button jest zablokowany
        if (btn.classList.contains('btn-locked')) {
          e.preventDefault();
          e.stopPropagation();
          this.showLockedMessage();
          return;
        }
        
        handler();
        // Zapisz że ta sekcja została zatwierdzona
        this.appliedSections[id] = true;
        localStorage.setItem('byow_applied_sections', JSON.stringify(this.appliedSections));
        
        // Zapisz całą konfigurację okna
        this.saveConfiguration();
        
        // Odblokuj następny button
        this.updateApplyButtonsState();
      });
    });
    
    // Ustaw początkowy stan buttonów
    this.updateApplyButtonsState();
  }
  
  showLockedMessage() {
    // Usuń poprzedni komunikat jeśli istnieje
    const existing = document.querySelector('.locked-message');
    if (existing) existing.remove();
    
    // Pokaż komunikat
    const msg = document.createElement('div');
    msg.className = 'locked-message';
    msg.innerHTML = '⚠️ Please confirm previous selection first';
    msg.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #fff3cd;
      color: #856404;
      border: 2px solid #ffc107;
      padding: 12px 25px;
      border-radius: 8px;
      font-weight: 600;
      z-index: 10000;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(msg);
    
    setTimeout(() => {
      msg.style.opacity = '0';
      msg.style.transition = 'opacity 0.3s';
      setTimeout(() => msg.remove(), 300);
    }, 2500);
  }
  
  saveConfiguration() {
    // Zapisz całą konfigurację do localStorage
    const config = window.currentConfig || this.state?.get() || {};
    localStorage.setItem('byow_saved_config', JSON.stringify(config));
  }
  
  loadSavedConfiguration() {
    // Najpierw spróbuj załadować z lastWindowConfig (auto-save)
    let savedConfig = localStorage.getItem('lastWindowConfig');
    
    // Fallback do starego klucza
    if (!savedConfig) {
      savedConfig = localStorage.getItem('byow_saved_config');
    }
    
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        
        // Aktualizuj state
        if (this.state) {
          this.state.update(config);
        }
        
        // Aktualizuj currentConfig
        if (window.currentConfig) {
          Object.assign(window.currentConfig, config);
        }
        console.log('📂 Configuration loaded from localStorage:', config);
        
        // Odtwórz wartości w formularzu
        this.restoreFormValues(config);
        
        // Odtwórz panel specyfikacji
        this.restoreSpecification(config);
        
        // Przywróć stan applied sections jeśli były
        const appliedSections = localStorage.getItem('byow_applied_sections');
        if (appliedSections) {
          this.appliedSections = JSON.parse(appliedSections);
          this.updateApplyButtonsState();
        }
      } catch (e) {
        console.error('Error loading saved config:', e);
      }
    }
  }
  
  restoreFormValues(config) {
    // Wymiary
    if (config.width) {
      const widthSelect = document.getElementById('width-select');
      if (widthSelect) widthSelect.value = config.width;
    }
    if (config.height) {
      const heightSelect = document.getElementById('height-select');
      if (heightSelect) heightSelect.value = config.height;
    }
    
    // Measurement type
    if (config.measurementType) {
      const radio = document.getElementById(config.measurementType);
      if (radio) radio.checked = true;
    }
    
    // Bars
    if (config.upperBars) {
      const upperBars = document.getElementById('upper-bars');
      if (upperBars) {
        upperBars.value = config.upperBars;
        upperBars.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    if (config.lowerBars) {
      const lowerBars = document.getElementById('lower-bars');
      if (lowerBars) {
        lowerBars.value = config.lowerBars;
        lowerBars.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    
    // Bar positions
    if (config.upperBarPosition) {
      const upperPos = document.getElementById('upper-bar-position');
      if (upperPos) upperPos.value = config.upperBarPosition;
    }
    if (config.lowerBarPosition) {
      const lowerPos = document.getElementById('lower-bar-position');
      if (lowerPos) lowerPos.value = config.lowerBarPosition;
    }
    
    // Frame type
    if (config.frameType) {
      const radio = document.querySelector(`input[name="frame-type"][value="${config.frameType}"]`);
      if (radio) radio.checked = true;
    }
    
    // Glass type
    if (config.glassType) {
      const radio = document.querySelector(`input[name="glass-type"][value="${config.glassType}"]`);
      if (radio) radio.checked = true;
    }
    
    // Color type
    if (config.colorType) {
      const radio = document.querySelector(`input[name="color-type"][value="${config.colorType}"]`);
      if (radio) {
        radio.checked = true;
        // Trigger change to show correct color selector
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    
    // Single color
    if (config.colorSingle || config.singleColor || config.color) {
      const colorValue = config.colorSingle || config.singleColor || config.color;
      const colorOption = document.querySelector(`#single-color-selector .color-option[data-color="${colorValue}"]`);
      if (colorOption) {
        document.querySelectorAll('#single-color-selector .color-option').forEach(opt => opt.classList.remove('selected'));
        colorOption.classList.add('selected');
      }
    }
    
    // Dual colors
    if (config.colorInterior || config.interiorColor) {
      const colorValue = config.colorInterior || config.interiorColor;
      const colorOption = document.querySelector(`.interior-color[data-color="${colorValue}"]`);
      if (colorOption) {
        document.querySelectorAll('.interior-color').forEach(opt => opt.classList.remove('selected'));
        colorOption.classList.add('selected');
      }
    }
    if (config.colorExterior || config.exteriorColor) {
      const colorValue = config.colorExterior || config.exteriorColor;
      const colorOption = document.querySelector(`.exterior-color[data-color="${colorValue}"]`);
      if (colorOption) {
        document.querySelectorAll('.exterior-color').forEach(opt => opt.classList.remove('selected'));
        colorOption.classList.add('selected');
      }
    }
    
    // Opening type
    if (config.openingType) {
      const radio = document.querySelector(`input[name="opening-type"][value="${config.openingType}"]`);
      if (radio) radio.checked = true;
    }
    
    // PAS24
    if (config.pas24) {
      const radio = document.querySelector(`input[name="pas24"][value="${config.pas24}"]`);
      if (radio) radio.checked = true;
    }
    
    // Glass spec
    if (config.glassSpec) {
      const radio = document.querySelector(`input[name="glass-spec"][value="${config.glassSpec}"]`);
      if (radio) radio.checked = true;
    }
    
    // Glass finish
    if (config.glassFinish) {
      const radio = document.querySelector(`input[name="glass-finish"][value="${config.glassFinish}"]`);
      if (radio) radio.checked = true;
    }
    
    // Quantity
    if (config.quantity) {
      const qtyInput = document.getElementById('window-quantity');
      if (qtyInput) qtyInput.value = config.quantity;
    }
    
    // Ironmongery - przywróć z config
    if (config.ironmongery) {
      window.currentConfig.ironmongery = config.ironmongery;
    }
    
    console.log('📋 Form values restored');
  }
  
  restoreSpecification(config) {
    // Odtwórz panel specyfikacji z zapisanych danych
    
    // Dimensions
    if (config.width && config.height) {
      const specDim = document.getElementById('spec-dimensions');
      if (specDim) {
        specDim.style.display = 'block';
        const specWidth = document.getElementById('spec-width');
        const specHeight = document.getElementById('spec-height');
        const specMeasurement = document.getElementById('spec-measurement');
        if (specWidth) specWidth.textContent = `${config.width}mm`;
        if (specHeight) specHeight.textContent = `${config.height}mm`;
        if (specMeasurement) {
          specMeasurement.textContent = config.measurementType === 'brick-to-brick' ? 'Structural Opening' : 'Frame Dimensions';
        }
      }
    }
    
    // Bars
    if (config.upperBars || config.lowerBars) {
      const specBars = document.getElementById('spec-bars');
      if (specBars) {
        specBars.style.display = 'block';
        const barNames = { 'none': 'No Bars', '2h': '2 Horizontal', '3h': '3 Horizontal', 'ь2v': '2 Vertical', '3v': '3 Vertical', 'georgian': 'Georgian' };
        const specUpper = document.getElementById('spec-upper-bars');
        const specLower = document.getElementById('spec-lower-bars');
        if (specUpper) specUpper.textContent = barNames[config.upperBars] || config.upperBars || 'No Bars';
        if (specLower) specLower.textContent = barNames[config.lowerBars] || config.lowerBars || 'No Bars';
      }
    }
    
    // Frame
    if (config.frameType) {
      const specFrame = document.getElementById('spec-frame');
      if (specFrame) {
        specFrame.style.display = 'block';
        const specFrameType = document.getElementById('spec-frame-type');
        if (specFrameType) {
          specFrameType.textContent = config.frameType === 'standard' ? 'Standard Frame (165mm)' : 'Slim Frame (145mm)';
        }
      }
    }
    
    // Color
    if (config.colorType) {
      const specColor = document.getElementById('spec-color');
      if (specColor) {
        specColor.style.display = 'block';
        
        if (config.colorType === 'single') {
          const specSingle = document.getElementById('spec-single-color');
          const specDual = document.getElementById('spec-dual-color');
          if (specSingle) specSingle.style.display = 'block';
          if (specDual) specDual.style.display = 'none';
          
          const specColorName = document.getElementById('spec-color-name');
          if (specColorName && config.colorSingleName) {
            specColorName.textContent = config.colorSingleName;
          }
        } else if (config.colorType === 'dual') {
          const specSingle = document.getElementById('spec-single-color');
          const specDual = document.getElementById('spec-dual-color');
          if (specSingle) specSingle.style.display = 'none';
          if (specDual) specDual.style.display = 'block';
          
          const specInterior = document.getElementById('spec-interior-color');
          const specExterior = document.getElementById('spec-exterior-color');
          if (specInterior && config.colorInteriorName) {
            specInterior.textContent = config.colorInteriorName;
          }
          if (specExterior && config.colorExteriorName) {
            specExterior.textContent = config.colorExteriorName;
          }
        }
      }
    }
    
    // Glass
    if (config.glassType) {
      const specGlass = document.getElementById('spec-glass');
      if (specGlass) {
        specGlass.style.display = 'block';
        const glassNames = { 'double': 'Double Glazed', 'triple': 'Triple Glazed' };
        const specGlassType = document.getElementById('spec-glass-type');
        if (specGlassType) specGlassType.textContent = glassNames[config.glassType] || config.glassType;
      }
    }
    
    // Opening
    if (config.openingType) {
      const specOpening = document.getElementById('spec-opening');
      if (specOpening) {
        specOpening.style.display = 'block';
        const openingNames = { 'tilt-only': 'Tilt Only', 'sliding': 'Sliding Sash', 'fixed': 'Fixed' };
        const specOpeningType = document.getElementById('spec-opening-type');
        if (specOpeningType) specOpeningType.textContent = openingNames[config.openingType] || config.openingType;
      }
    }
    
    // PAS24
    if (config.pas24) {
      const specPas24 = document.getElementById('spec-pas24');
      if (specPas24) {
        specPas24.style.display = 'block';
        const specPas24Value = document.getElementById('spec-pas24-value');
        if (specPas24Value) {
          specPas24Value.textContent = config.pas24 === 'yes' ? 'Yes - PAS 24 Compliant' : 'No - Standard Security';
        }
      }
    }
    
    // Details / Ironmongery
    if (config.ironmongery && Object.keys(config.ironmongery).length > 0) {
      const specDetails = document.getElementById('spec-details');
      if (specDetails) {
        specDetails.style.display = 'block';
        const specIronmongeryItem = document.getElementById('spec-ironmongery-item');
        const specIronmongery = document.getElementById('spec-ironmongery');
        if (specIronmongeryItem) specIronmongeryItem.style.display = 'flex';
        if (specIronmongery) {
          const productNames = Object.values(config.ironmongery)
            .filter(item => item && item.name)
            .map(item => item.name)
            .join(', ');
          specIronmongery.textContent = productNames || 'Selected';
        }
      }
    }
    
    // Glass Spec
    if (config.glassSpec) {
      const specGlassSpec = document.getElementById('spec-glass-spec');
      if (specGlassSpec) {
        specGlassSpec.style.display = 'block';
      }
    }
    
    console.log('📋 Specification panel restored');
  }
  
  updateApplyButtonsState() {
    this.applyButtonsOrder.forEach(({ id, order }) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      
      // Przywróć stan 'applied' jeśli sekcja była zatwierdzona
      if (this.appliedSections[id]) {
        btn.textContent = '✓ Applied';
        btn.classList.add('applied');
      }
      
      // Pierwszy button zawsze odblokowany
      if (order === 1) {
        btn.classList.remove('btn-locked');
        return;
      }
      
      // Sprawdź czy poprzedni jest zatwierdzony
      const prevButton = this.applyButtonsOrder.find(b => b.order === order - 1);
      if (prevButton && this.appliedSections[prevButton.id]) {
        btn.classList.remove('btn-locked');
      } else {
        btn.classList.add('btn-locked');
      }
    });
  }
  
  // Reset sekwencji (tylko przyciski, zachowaj konfigurację)
  resetApplySequence() {
    this.appliedSections = {};
    localStorage.removeItem('byow_applied_sections');
    // NIE usuwaj byow_saved_config - zachowaj parametry dla następnego okna
    this.resetButtonTexts();
    this.updateApplyButtonsState();
  }
  
  // Pełny reset (przy całkowicie nowej konfiguracji)
  fullReset() {
    this.appliedSections = {};
    localStorage.removeItem('byow_applied_sections');
    localStorage.removeItem('byow_saved_config');
    this.resetButtonTexts();
    this.updateApplyButtonsState();
  }

  // Mapa oryginalnych tekstów buttonów
  getOriginalButtonText(buttonId) {
    const textMap = {
      'apply-dimensions': 'Apply Dimensions',
      'apply-bars': 'Apply Georgian Bars',
      'apply-frame': 'Apply Frame Type',
      'apply-color': 'Apply Color',
      'apply-glass': 'Apply Glass Type',
      'apply-opening': 'Apply Opening Type',
      'apply-pas24': 'Apply Security Standard',
      'apply-details': 'Apply Details',
      'apply-glass-spec': 'Apply Glass Specification'
    };
    return textMap[buttonId] || 'Apply';
  }

  // Reset wszystkich tekstów buttonów do oryginalnych
  resetButtonTexts() {
    this.applyButtonsOrder.forEach(({ id }) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.textContent = this.getOriginalButtonText(id);
        btn.classList.remove('applied');
      }
    });
  }

  // NOWA FUNKCJA: Invalidate section when user changes something after Apply
  // Czyści tę sekcję i WSZYSTKIE następne sekcje
  invalidateSection(buttonId) {
    const buttonInfo = this.applyButtonsOrder.find(b => b.id === buttonId);
    if (!buttonInfo) return;
    
    const invalidatedOrder = buttonInfo.order;
    
    // Wyczyść tę sekcję i wszystkie następne
    this.applyButtonsOrder.forEach(({ id, order }) => {
      if (order >= invalidatedOrder) {
        // Usuń z appliedSections
        delete this.appliedSections[id];
        
        // Reset tekstu buttona
        const btn = document.getElementById(id);
        if (btn) {
          btn.textContent = this.getOriginalButtonText(id);
          btn.classList.remove('applied');
        }
      }
    });
    
    // Zapisz do localStorage
    localStorage.setItem('byow_applied_sections', JSON.stringify(this.appliedSections));
    
    // Zaktualizuj stany (zablokuj następne)
    this.updateApplyButtonsState();
    
    console.log(`Section ${buttonId} invalidated, subsequent sections reset`);
  }

  applySection(section) {
    // Delegate to specification controller
    if (this.modules.spec) {
      switch(section) {
        case 'dimensions': this.modules.spec.applyDimensions(); break;
        case 'bars': this.modules.spec.applyBars(); break;
        case 'frame': this.modules.spec.applyFrame(); break;
        case 'color': this.modules.spec.applyColor(); break;
        case 'glass': this.modules.spec.applyGlass(); break;
        case 'opening': this.modules.spec.applyOpening(); break;
        case 'pas24': this.modules.spec.applyPAS24(); break;
        case 'details': this.modules.spec.applyDetails(); break;
        case 'glassSpec': this.modules.spec.applyGlassSpec(); break;
      }
    }
    
    // Save po Apply
    if (this.modules.storage) {
      const config = this.state.get();
      this.modules.storage.saveLastConfig(config);
      console.log('💾 Saved after Apply:', section);
    }
  }

  updateAll() {
    if (!this.isInitialized) return;
    
    // Merge state with currentConfig (currentConfig has color data)
    const stateConfig = this.state.get();
    const config = { ...stateConfig, ...window.currentConfig };
    
    // Mapowanie nazw kolorów dla wizualizacji
    if (config.colorSingle && !config.singleColor) {
      config.singleColor = config.colorSingle;
    }
    if (config.colorInterior && !config.interiorColor) {
      config.interiorColor = config.colorInterior;
    }
    if (config.colorExterior && !config.exteriorColor) {
      config.exteriorColor = config.colorExterior;
    }
    
    // Calculate price
    const priceData = this.modules.price.calculate(config);
    
    // Update visualization
    if (this.modules.visual) {
      this.modules.visual.update(config);
      this.modules.visual.updatePrice(priceData.unitPrice, priceData.totalPrice, priceData.noDimensions);
    }
    
    // AUTO-SAVE - zapisz do localStorage przy każdej zmianie
    if (this.modules.storage) {
      this.modules.storage.saveLastConfig(config);
    }
    // Backup: bezpośredni zapis do localStorage
    try {
      localStorage.setItem('lastWindowConfig', JSON.stringify(config));
    } catch (e) {
      console.warn('Auto-save to localStorage failed:', e);
    }
    
    // Update bars if needed
    if (this.modules.bars) {
      const barsState = this.modules.bars.getState();
      if (barsState.upper.pattern !== config.upperBars || 
          barsState.lower.pattern !== config.lowerBars) {
        // Sync if needed
      }
    }
  }

  // loadSavedConfiguration jest zdefiniowana wcześniej w klasie (linia ~255)

  loadConfiguration(config) {
    this.state.update(config);
    
    if (this.modules.form) {
      this.modules.form.loadConfiguration(config);
    }
    
    if (config.customBars && this.modules.bars) {
      this.modules.bars.setState({
        upper: {
          pattern: config.upperBars || 'none',
          bars: config.customBars.upper || { horizontal: [], vertical: [] }
        },
        lower: {
          pattern: config.lowerBars || 'none',
          bars: config.customBars.lower || { horizontal: [], vertical: [] }
        }
      });
    }
    
    this.updateAll();
  }

  addToEstimate() {
    const validation = this.modules.form.validate();
    if (!validation.isValid) {
      alert('Please complete:\n' + validation.errors.join('\n'));
      return;
    }
    
    const config = this.state.get();
    const priceData = this.modules.price.calculate(config);
    
    const estimate = this.modules.storage.addToEstimates(config, priceData.unitPrice);
    
    if (estimate) {
      this.modules.storage.saveLastConfig(config);
      const count = this.modules.storage.getEstimates().length;
      
      // Pokaż ładny modal zamiast alert
      this.showWindowAddedModal(config.quantity, count, config.windowSymbol || 'A');
    }
  }
  
  showWindowAddedModal(quantity, totalCount, currentSymbol) {
    // Usuń poprzedni modal jeśli istnieje
    const existing = document.querySelector('.window-added-modal-overlay');
    if (existing) existing.remove();
    
    const overlay = document.createElement('div');
    overlay.className = 'window-added-modal-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    const modal = document.createElement('div');
    modal.className = 'window-added-modal';
    modal.style.cssText = `
      background: white;
      padding: 30px 40px;
      border-radius: 12px;
      max-width: 450px;
      text-align: center;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    `;
    
    modal.innerHTML = `
      <div style="font-size: 3rem; margin-bottom: 15px;">✅</div>
      <h3 style="color: #0F3124; margin-bottom: 10px; font-family: 'Playfair Display', serif;">
        ${quantity} Window(s) Added!
      </h3>
      <p style="color: #666; margin-bottom: 5px;">
        Total in estimate: <strong>${totalCount}</strong> window configuration(s)
      </p>
      <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px; margin: 20px 0; text-align: left;">
        <p style="color: #856404; margin: 0 0 10px 0; font-weight: 600;">
          💡 Want to add more windows?
        </p>
        <p style="color: #856404; margin: 0 0 8px 0; font-size: 0.9rem;">
          • Keep same selections or change some options
        </p>
        <p style="color: #856404; margin: 0; font-size: 0.9rem;">
          • <strong>Remember to change window symbol</strong> (current: ${currentSymbol})
        </p>
      </div>
      <div style="display: flex; gap: 15px; justify-content: center;">
        <button id="modal-add-another" style="
          padding: 12px 25px;
          background: #0F3124;
          color: white;
          border: none;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
        ">Add Another Window</button>
        <button id="modal-view-estimate" style="
          padding: 12px 25px;
          background: white;
          color: #0F3124;
          border: 2px solid #0F3124;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
        ">View Estimate</button>
      </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Event listeners
    document.getElementById('modal-add-another').addEventListener('click', () => {
      overlay.remove();
      // Scroll do góry formularza
      document.querySelector('.config-section')?.scrollIntoView({ behavior: 'smooth' });
    });
    
    document.getElementById('modal-view-estimate').addEventListener('click', () => {
      overlay.remove();
      // Scroll do sekcji estimate lub otwórz dashboard
      const estimateSection = document.querySelector('.estimate-selector-section');
      if (estimateSection) {
        estimateSection.scrollIntoView({ behavior: 'smooth' });
      } else {
        window.location.href = 'customer-dashboard.html';
      }
    });
    
    // Zamknij po kliknięciu w tło
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });
  }

  saveConfiguration() {
    const saved = this.modules.storage.saveConfig(this.state.get());
    // Silent save - no alert needed
    console.log('Configuration saved:', saved);
  }

  saveAsVariant() {
    const name = prompt('Enter variant name:');
    if (!name) return;
    
    const config = this.state.get();
    const priceData = this.modules.price.calculate(config);
    
    const variant = this.modules.storage.saveVariant(config, name, priceData.unitPrice);
    
    if (variant) {
      const count = this.modules.storage.getVariants().length;
      alert(`Variant "${name}" saved.\n${count} of ${this.modules.storage.maxVariants} variants used.`);
    }
  }

  reset() {
    if (!confirm('Reset all settings?')) return;
    
    this.state.reset();
    
    if (this.modules.form) this.modules.form.reset();
    if (this.modules.visual) this.modules.visual.reset();
    
    if (this.modules.bars) {
      this.modules.bars.setState({
        upper: { pattern: 'none', bars: { horizontal: [], vertical: [] } },
        lower: { pattern: 'none', bars: { horizontal: [], vertical: [] } }
      });
    }
    
    this.updateAll();
    alert('Reset complete.');
  }

  exportConfiguration() {
    const data = {
      configuration: this.state.get(),
      price: this.modules.price.calculate(this.state.get()),
      exportDate: new Date().toISOString()
    };
    
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `skylon-config-${Date.now()}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
  }

  importConfiguration(file) {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.configuration) {
          this.loadConfiguration(data.configuration);
          alert('Import successful!');
        }
      } catch (error) {
        alert('Import failed: ' + error.message);
      }
    };
    
    reader.readAsText(file);
  }
}

// Initialize on DOM ready
ready(() => {
  window.configuratorCore = new ConfiguratorCore();
  window.configuratorCore.init();
  
  // Export for backward compatibility
  window.updatePrice = () => {
    if (window.configuratorCore?.isInitialized) {
      window.configuratorCore.updateAll();
    }
  };
  
  window.updateVisualDetails = () => {
    if (window.visualizationManager) {
      window.visualizationManager.updateVisualDetails(window.currentConfig);
    }
  };
  
  window.loadConfiguration = (config) => {
    if (window.configuratorCore?.isInitialized) {
      window.configuratorCore.loadConfiguration(config);
    }
  };
  
  // Global function to invalidate a section when user changes it after Apply
  window.invalidateSection = (buttonId) => {
    if (window.configuratorCore?.isInitialized) {
      window.configuratorCore.invalidateSection(buttonId);
    }
  };
});