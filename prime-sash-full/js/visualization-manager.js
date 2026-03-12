// visualization-manager-optimized.js - Zoptymalizowany manager wizualizacji
class VisualizationManager {
  constructor() {
    this.elements = {};
    this.initialized = false;
    this.colorMap = {
      'white': { bg: '#F8F8F8', name: 'White' },
      'oak': { bg: 'oak', name: 'Oak' },
      'green': { bg: '#396138', name: 'Green' },
      'anthracite': { bg: '#293133', name: 'Anthracite' },
      'black': { bg: '#0A0A0A', name: 'Black' },
      'red': { bg: '#9E2B20', name: 'Red' },
      'blue': { bg: '#1E5AA8', name: 'Blue' },
      'brown': { bg: '#8B572A', name: 'Brown' },
      'olive': { bg: '#424632', name: 'Olive Green' },
      'offwhite': { bg: '#F7F9F5', name: 'Off-White' },
      'cream': { bg: '#F1EFDC', name: 'Cream' },
      'burgundy': { bg: '#5E2028', name: 'Burgundy' },
      'royal': { bg: '#222D5A', name: 'Royal Blue' }
    };
  }

  init() {
    this.findElements();
    this.initialized = true;
  }

  findElements() {
    const selectors = {
      // Containers
      externalContainer: 'external-window-container',
      internalContainer: 'internal-window-container',
      
      // Color previews
      singleColorPreview: 'single-color-preview',
      dualColorPreview: 'dual-color-preview',
      colorSampleSingle: 'color-sample-single',
      colorSampleInterior: 'color-sample-interior',
      colorSampleExterior: 'color-sample-exterior',
      
      // Displays
      widthDisplay: 'width-display',
      heightDisplay: 'height-display',
      totalPriceDisplay: 'total-price',
      glassDisplay: 'glass-display',
      
      // Horns
      hornsDisplayItem: 'horns-display-item',
      hornsPreviewImg: 'horns-preview-img',
      hornsPreviewText: 'horns-preview-text',
      
      // Ironmongery
      ironmongeryDisplayItem: 'ironmongery-display-item',
      ironmongeryPreviewImg: 'ironmongery-preview-img',
      ironmongeryPreviewText: 'ironmongery-preview-text'
    };
    
    this.elements = UIHelpers.findElements(selectors);
  }

  update(config) {
    if (!config) return;
    
    this.updateColorPreview(config);
    this.updateDetails(config);
    this.updateDimensions(config.width, config.height);
    this.updateFrostedGlass(config);
  }

  updateColorPreview(config) {
    const isSingle = config.colorType === 'single';
    
    UIHelpers.toggle(this.elements.singleColorPreview, isSingle);
    UIHelpers.toggle(this.elements.dualColorPreview, !isSingle);
    
    if (isSingle) {
      this.setColorSample(
        this.elements.colorSampleSingle,
        config.singleColor || 'white',
        true
      );
    } else {
      this.setColorSample(
        this.elements.colorSampleInterior,
        config.interiorColor || 'white',
        false,
        'Interior'
      );
      this.setColorSample(
        this.elements.colorSampleExterior,
        config.exteriorColor || 'black',
        false,
        'Exterior'
      );
    }
  }

  setColorSample(element, colorKey, isSingle, prefix = '') {
    if (!element) return;
    
    const color = this.colorMap[colorKey] || this.colorMap['white'];
    const isOak = colorKey === 'oak';
    
    if (isOak) {
      element.style.backgroundImage = "url('configurator-overlay/img/oak-pattern.jpg')";
      element.style.backgroundSize = 'cover';
      element.style.backgroundColor = '';
      UIHelpers.addClass(element, 'oak');
    } else {
      element.style.backgroundImage = '';
      element.style.backgroundColor = color.bg;
      UIHelpers.removeClass(element, 'oak');
    }
    
    const label = element.querySelector('.color-label');
    if (label) {
      const text = prefix ? `${prefix}: ${color.name}` : color.name;
      UIHelpers.setText(label, text);
    }
  }

  updateDetails(config) {
    // Horns
    const hasHorns = config.horns && config.horns !== 'none';
    UIHelpers.toggle(this.elements.hornsDisplayItem, hasHorns, 'flex');
    
    if (hasHorns) {
      if (this.elements.hornsPreviewImg) {
        this.elements.hornsPreviewImg.src = `img/details/horns-${config.horns}.png`;
        this.elements.hornsPreviewImg.alt = `${config.horns} horns`;
      }
      UIHelpers.setText(
        this.elements.hornsPreviewText,
        UIHelpers.capitalize(config.horns) + ' Horns'
      );
    }
    
    // Ironmongery
    // Ironmongery - NOWY SYSTEM: teraz to obiekt {lock, fingerLift...}, nie string
    // Wyłączamy stary preview (dropdown już nie istnieje)
    const hasIronmongery = config.ironmongery && 
                          typeof config.ironmongery === 'object' &&
                          Object.values(config.ironmongery).some(v => v !== null);
    
    // Ukryj stary display item (był dla dropdown)
    UIHelpers.toggle(this.elements.ironmongeryDisplayItem, false, 'flex');
    
    // Nowy system używa updateMainPageDisplay() w Gallery
    
    // Glass
    if (this.elements.glassDisplay) {
      const spec = config.glassSpec === 'laminated' ? 'Laminated' : 'Toughened';
      const finish = config.glassFinish === 'frosted' ? 'Frosted' : 'Clear';
      UIHelpers.setText(this.elements.glassDisplay, `${finish} ${spec}`);
    }
  }

  updateDimensions(width, height) {
    UIHelpers.setText(this.elements.widthDisplay, width || 1000);
    UIHelpers.setText(this.elements.heightDisplay, height || 1500);
  }

  updatePrice(unitPrice, totalPrice, noDimensions = false) {
    const priceEl = this.elements.totalPriceDisplay;
    
    // Add updating class for animation
    if (priceEl) {
      priceEl.classList.add('updating');
    }
    
    // Small delay for visual effect
    setTimeout(() => {
      if (noDimensions) {
        UIHelpers.setText(
          priceEl,
          'Enter dimensions'
        );
      } else {
        UIHelpers.setText(
          priceEl,
          '£' + UIHelpers.formatPrice(totalPrice)
        );
      }
      
      // Remove updating class
      if (priceEl) {
        priceEl.classList.remove('updating');
      }
    }, 150);
  }

  updateOpeningIndicators(openingType) {
    const containers = [
      document.getElementById('external-opening-indicators'),
      document.getElementById('internal-opening-indicators')
    ];
    
    if (!containers[0] || !containers[1]) return;
    
    // Clear existing
    containers.forEach(c => c.innerHTML = '');
    
    const positions = {
      upper: { x: 50, y: 30 },
      lower: { x: 50, y: 65 }
    };
    
    const indicators = {
      'both': [
        { pos: positions.upper, symbol: '↕', type: 'arrow' },
        { pos: positions.lower, symbol: '↕', type: 'arrow' }
      ],
      'bottom': [
        { pos: positions.lower, symbol: '↕', type: 'arrow' }
      ],
      'fixed': [
        { pos: positions.upper, symbol: '✕', type: 'cross' },
        { pos: positions.lower, symbol: '✕', type: 'cross' }
      ]
    };
    
    const toAdd = indicators[openingType] || [];
    
    toAdd.forEach(({ pos, symbol, type }) => {
      containers.forEach(container => {
        this.addIndicator(container, symbol, pos, type);
      });
    });
  }

  addIndicator(container, symbol, position, type) {
    const indicator = document.createElement('div');
    indicator.className = `opening-indicator ${type}`;
    indicator.textContent = symbol;
    indicator.style.left = position.x + '%';
    indicator.style.top = position.y + '%';
    indicator.style.transform = 'translate(-50%, -50%)';
    container.appendChild(indicator);
  }

  updateFrostedGlass(config) {
    const isFrosted = config.glassFinish === 'frosted';
    const location = config.frostedLocation || 'bottom';
    
    ['external', 'internal'].forEach(viewType => {
      this.updateFrostedOverlay(viewType, isFrosted, location);
    });
  }

  updateFrostedOverlay(viewType, isFrosted, location) {
    const container = document.getElementById(`${viewType}-window-container`);
    if (!container) return;
    
    const areas = this.getGlassAreas(viewType);
    
    // Upper overlay
    let upperOverlay = container.querySelector('.frosted-overlay.upper');
    if (!upperOverlay && isFrosted) {
      upperOverlay = this.createFrostedOverlay('upper', areas.upper, container);
    }
    if (upperOverlay) {
      UIHelpers.toggleClass(upperOverlay, 'active', isFrosted && location === 'both');
    }
    
    // Lower overlay
    let lowerOverlay = container.querySelector('.frosted-overlay.lower');
    if (!lowerOverlay && isFrosted) {
      lowerOverlay = this.createFrostedOverlay('lower', areas.lower, container);
    }
    if (lowerOverlay) {
      UIHelpers.toggleClass(lowerOverlay, 'active', isFrosted);
    }
  }

  createFrostedOverlay(sashType, area, container) {
    const overlay = document.createElement('div');
    overlay.className = `frosted-overlay ${sashType} realistic`;
    
    const width = container.offsetWidth;
    const height = container.offsetHeight;
    
    Object.assign(overlay.style, {
      left: (width * area.x) + 'px',
      top: (height * area.y) + 'px',
      width: (width * area.width) + 'px',
      height: (height * area.height) + 'px'
    });
    
    container.appendChild(overlay);
    return overlay;
  }

  getGlassAreas(viewType) {
    const areas = {
      external: {
        upper: { x: 0.24, y: 0.21, width: 0.54, height: 0.265 },
        lower: { x: 0.24, y: 0.505, width: 0.54, height: 0.255 }
      },
      internal: {
        upper: { x: 0.23, y: 0.21, width: 0.54, height: 0.255 },
        lower: { x: 0.23, y: 0.49, width: 0.54, height: 0.29 }
      }
    };
    
    return areas[viewType] || areas.external;
  }

  createBarsCanvases() {
    ['external', 'internal'].forEach(type => {
      const container = this.elements[`${type}Container`];
      const canvasId = `${type}-bars-canvas`;
      
      if (container && !document.getElementById(canvasId)) {
        this.createCanvas(canvasId, container);
      }
    });
  }

  createCanvas(id, container) {
    const canvas = document.createElement('canvas');
    Object.assign(canvas, {
      id: id,
      className: 'bars-canvas',
      width: container.offsetWidth,
      height: container.offsetHeight
    });
    
    Object.assign(canvas.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      zIndex: '2',
      pointerEvents: 'none'
    });
    
    container.appendChild(canvas);
    return canvas;
  }

  reset() {
    this.updateColorPreview({ colorType: 'single', singleColor: 'white' });
    this.updateDetails({});
    this.updateDimensions(1000, 1500);
    this.updateFrostedGlass({ glassFinish: 'clear' });
  }
}

// Create global instance
window.visualizationManager = new VisualizationManager();