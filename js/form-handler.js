// form-handler-optimized.js - Zoptymalizowany handler formularza
class FormHandler {
  constructor() {
    this.elements = {};
    this.callbacks = {};
    this.initialized = false;
  }

  init(initialConfig = {}) {
    this.findElements();
    this.attachEventListeners();
    this.loadConfiguration(initialConfig);
    this.initialized = true;
  }

  findElements() {
    // Batch find elements
    const elementMap = {
      // Inputs
      widthInput: 'width',
      heightInput: 'height',
      widthSelect: 'width-select',
      heightSelect: 'height-select',
      widthDisplay: 'width-display',
      heightDisplay: 'height-display',
      quantityInput: 'window-quantity',
      
      // Selects
      hornsSelect: 'horns',
      ironmongerySelect: 'ironmongery',
      
      // Containers
      singleColorSelector: 'single-color-selector',
      dualColorSelector: 'dual-color-selector',
      customExteriorColor: 'custom-exterior-color',
      
      // Buttons - usunięte, obsługiwane przez estimate-handler.js
      // addToEstimateBtn: 'add-to-estimate',
      // viewMyEstimatesBtn: 'view-my-estimates'
    };
    
    // Get all single elements
    Object.entries(elementMap).forEach(([key, id]) => {
      this.elements[key] = document.getElementById(id);
    });
    
    // Get radio groups
    const radioGroups = [
      'measurement-type', 'frame-type', 'color-type',
      'glass-type', 'opening-type', 'glass-spec',
      'glass-finish', 'pas24', 'frosted-location'
    ];
    
    radioGroups.forEach(name => {
      this.elements[name] = document.querySelectorAll(`input[name="${name}"]`);
    });
    
    // Get color options
    this.elements.colorOptions = document.querySelectorAll('.color-option:not(.interior-color):not(.exterior-color)');
    this.elements.interiorColors = document.querySelectorAll('.interior-color');
    this.elements.exteriorColors = document.querySelectorAll('.exterior-color');
  }

  attachEventListeners() {
    const { elements: el } = this;
    
    // Radio groups - simplified
    const radioNames = [
      'measurement-type', 'frame-type', 'color-type',
      'glass-type', 'opening-type', 'glass-spec',
      'glass-finish', 'pas24', 'frosted-location'
    ];
    
    radioNames.forEach(name => {
      UIHelpers.attachRadios(name, value => {
        this.handleRadioChange(name, value);
      });
    });
    
    // Color selections
    UIHelpers.on(el.colorOptions, 'click', e => {
      this.handleColorSelect(e.currentTarget, 'single');
    });
    
    UIHelpers.on(el.interiorColors, 'click', e => {
      this.handleColorSelect(e.currentTarget, 'interior');
    });
    
    UIHelpers.on(el.exteriorColors, 'click', e => {
      this.handleColorSelect(e.currentTarget, 'exterior');
    });
    
    // Selects
    UIHelpers.onChange(el.hornsSelect, e => {
      this.triggerCallback('selectChange', { name: 'horns', value: e.target.value });
    });
    
    UIHelpers.onChange(el.ironmongerySelect, e => {
      this.triggerCallback('selectChange', { name: 'ironmongery', value: e.target.value });
    });
    
    // Quantity
    UIHelpers.on(el.quantityInput, 'input', e => {
      let value = parseInt(e.target.value) || 1;
      value = Math.max(1, Math.min(20, value));
      e.target.value = value;
      this.triggerCallback('quantityChange', value);
    });
    
    // Action buttons - usunięte, obsługiwane przez estimate-handler.js
    // const buttons = {
    //   addToEstimateBtn: 'addToEstimate',
    //   saveConfigBtn: 'saveConfiguration',
    //   saveVariantBtn: 'saveVariant'
    // };
    // 
    // Object.entries(buttons).forEach(([key, event]) => {
    //   UIHelpers.onClick(el[key], () => this.triggerCallback(event));
    // });
    
    // View estimate button - usunięte, obsługiwane przez estimate-handler.js
    // UIHelpers.onClick(el.viewEstimateBtn, () => {
    //   window.location.href = 'estimate-page.html';
    // });
  }

  handleRadioChange(name, value) {
    // Special handling for color type
    if (name === 'color-type') {
      UIHelpers.toggle('single-color-selector', value === 'single');
      UIHelpers.toggle('dual-color-selector', value === 'dual');
    }
    
    // Frame-glass compatibility
    if (name === 'frame-type') {
      this.checkFrameGlassCompatibility(value);
    }
    
    this.triggerCallback('radioChange', { name, value });
  }

  handleColorSelect(element, type) {
    const parent = element.parentElement.parentElement;
    const siblings = parent.querySelectorAll('.color-option');
    
    // Remove selected from siblings
    siblings.forEach(opt => opt.classList.remove('selected'));
    
    // Add selected
    element.classList.add('selected');
    
    const color = element.dataset.color;
    const name = element.dataset.name;
    
    if (type === 'single') {
      this.triggerCallback('singleColorSelect', { color, name });
      
      // Update preview
      UIHelpers.setText('single-preview-name', name);
      UIHelpers.setText('single-preview-ral', element.dataset.ral);
    } else if (type === 'interior') {
      const exterior = document.querySelector('.exterior-color.selected');
      if (exterior) {
        this.triggerCallback('dualColorSelect', {
          interior: color,
          exterior: exterior.dataset.color
        });
      }
      UIHelpers.setText('dual-preview-interior', `${name} (${element.dataset.ral})`);
    } else if (type === 'exterior') {
      const interior = document.querySelector('.interior-color.selected');
      if (interior) {
        this.triggerCallback('dualColorSelect', {
          interior: interior.dataset.color,
          exterior: color
        });
      }
      UIHelpers.setText('dual-preview-exterior', `${name} (${element.dataset.ral})`);
    }
  }

  checkFrameGlassCompatibility(frameType) {
    const tripleOption = document.querySelector('#triple-glazing')?.closest('.radio-option');
    const tripleInput = document.getElementById('triple-glazing');
    const doubleInput = document.getElementById('double-glazing');
    
    if (!tripleOption || !tripleInput) return;
    
    if (frameType === 'slim') {
      UIHelpers.hide(tripleOption);
      
      if (tripleInput.checked) {
        if (doubleInput) {
          doubleInput.checked = true;
          this.triggerCallback('radioChange', { name: 'glass-type', value: 'double' });
        }
      }
      
      this.showWarning('Slim frames cannot accommodate Triple Glazing');
    } else {
      UIHelpers.show(tripleOption);
      this.hideWarning();
    }
  }

  showWarning(message) {
    let warning = document.getElementById('compatibility-warning');
    
    if (!warning) {
      warning = document.createElement('div');
      warning.id = 'compatibility-warning';
      warning.className = 'warning-message';
      
      const glassSection = document.querySelector('input[name="glass-type"]')?.closest('.config-section');
      if (glassSection) {
        glassSection.appendChild(warning);
      }
    }
    
    UIHelpers.setText(warning, message);
    UIHelpers.show(warning);
  }

  hideWarning() {
    UIHelpers.hide('compatibility-warning');
  }

  loadConfiguration(config) {
    if (!config) return;
    
    // Set dimensions
    ['width', 'height'].forEach(dim => {
      if (config[dim]) {
        UIHelpers.setValue(dim, config[dim]);
        UIHelpers.setText(`${dim}-display`, config[dim]);
      }
    });
    
    // Set radios
    const radioMappings = {
      measurementType: 'measurement-type',
      frameType: 'frame-type',
      colorType: 'color-type',
      glassType: 'glass-type',
      openingType: 'opening-type',
      glassSpec: 'glass-spec',
      glassFinish: 'glass-finish',
      pas24: 'pas24',
      frostedLocation: 'frosted-location'
    };
    
    Object.entries(radioMappings).forEach(([configKey, radioName]) => {
      if (config[configKey]) {
        const radio = document.querySelector(`input[name="${radioName}"][value="${config[configKey]}"]`);
        if (radio) radio.checked = true;
      }
    });
    
    // Set colors
    if (config.colorType === 'single' && config.singleColor) {
      const colorOpt = document.querySelector(`.color-option[data-color="${config.singleColor}"]`);
      if (colorOpt) this.handleColorSelect(colorOpt, 'single');
    } else if (config.colorType === 'dual') {
      const interior = document.querySelector(`.interior-color[data-color="${config.interiorColor}"]`);
      const exterior = document.querySelector(`.exterior-color[data-color="${config.exteriorColor}"]`);
      if (interior) this.handleColorSelect(interior, 'interior');
      if (exterior) this.handleColorSelect(exterior, 'exterior');
    }
    
    // Set selects
    UIHelpers.setValue('horns', config.horns || 'none');
    UIHelpers.setValue('ironmongery', config.ironmongery || 'none');
    UIHelpers.setValue('window-quantity', config.quantity || 1);
  }

  getConfiguration() {
    const config = {};
    
    // Dimensions
    config.width = parseInt(UIHelpers.getValue('width') || 800);
    config.height = parseInt(UIHelpers.getValue('height') || 1000);
    
    // Radio values
    const radioNames = [
      'measurement-type', 'frame-type', 'color-type',
      'glass-type', 'opening-type', 'glass-spec',
      'glass-finish', 'pas24', 'frosted-location'
    ];
    
    radioNames.forEach(name => {
      const checked = document.querySelector(`input[name="${name}"]:checked`);
      if (checked) {
        const key = name.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
        config[key] = checked.value;
      }
    });
    
    // Colors
    if (config.colorType === 'single') {
      const selected = document.querySelector('#single-color-selector .color-option.selected');
      if (selected) config.singleColor = selected.dataset.color;
    } else {
      const interior = document.querySelector('.interior-color.selected');
      const exterior = document.querySelector('.exterior-color.selected');
      if (interior) config.interiorColor = interior.dataset.color;
      if (exterior) config.exteriorColor = exterior.dataset.color;
    }
    
    // Selects
    config.horns = UIHelpers.getValue('horns') || 'none';
    config.ironmongery = UIHelpers.getValue('ironmongery') || 'none';
    config.quantity = parseInt(UIHelpers.getValue('window-quantity') || 1);
    
    return config;
  }

  validate() {
    const errors = [];
    const config = this.getConfiguration();
    
    // Check dimensions
    if (!config.width || config.width < 400 || config.width > 1500) {
      errors.push('Width must be between 400mm and 1500mm');
    }
    
    if (!config.height || config.height < 800 || config.height > 2500) {
      errors.push('Height must be between 800mm and 2500mm');
    }
    
    // Check required fields
    const required = ['frameType', 'colorType', 'glassType', 'openingType'];
    required.forEach(field => {
      if (!config[field]) {
        const name = field.replace(/([A-Z])/g, ' $1').toLowerCase();
        errors.push(`Please select ${name}`);
      }
    });
    
    return { isValid: errors.length === 0, errors };
  }

  on(event, callback) {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(callback);
  }

  triggerCallback(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(cb => cb(data));
    }
  }

  reset() {
    // Reset dimensions
    UIHelpers.setValue('width', 800);
    UIHelpers.setValue('height', 1000);
    UIHelpers.setText('width-display', 800);
    UIHelpers.setText('height-display', 1000);
    
    // Reset radios to defaults
    const defaults = {
      'measurement-type': 'brick-to-brick',
      'frame-type': 'standard',
      'color-type': 'single',
      'glass-type': 'double',
      'opening-type': 'both',
      'glass-spec': 'toughened',
      'glass-finish': 'clear',
      'pas24': 'no'
    };
    
    Object.entries(defaults).forEach(([name, value]) => {
      const radio = document.querySelector(`input[name="${name}"][value="${value}"]`);
      if (radio) radio.checked = true;
    });
    
    // Reset selects
    UIHelpers.setValue('horns', 'none');
    UIHelpers.setValue('ironmongery', 'none');
    UIHelpers.setValue('window-quantity', 1);
    
    this.triggerCallback('reset');
  }
}

// Create global instance
window.formHandler = new FormHandler();