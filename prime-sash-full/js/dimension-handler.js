class DimensionHandler {
  constructor() {
    this.init();
  }

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  setup() {
    // Width controls
    this.widthSelect = document.getElementById('width-select');
    this.widthInput = document.getElementById('width');
    this.widthWrapper = this.widthSelect?.closest('.dimension-input-wrapper');

    // Height controls
    this.heightSelect = document.getElementById('height-select');
    this.heightInput = document.getElementById('height');
    this.heightWrapper = this.heightSelect?.closest('.dimension-input-wrapper');

    if (this.widthSelect && this.widthInput) {
      this.setupDimensionControl('width', this.widthSelect, this.widthInput, this.widthWrapper);
    }

    if (this.heightSelect && this.heightInput) {
      this.setupDimensionControl('height', this.heightSelect, this.heightInput, this.heightWrapper);
    }

    // MEASUREMENT TYPE LISTENERS - START
    const measurementRadios = document.querySelectorAll('input[name="measurement-type"]');
    measurementRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        this.updateMeasurementInfo();
      });
    });

    // Initial call for measurement info
    this.updateMeasurementInfo();
    // MEASUREMENT TYPE LISTENERS - END
  }

  setupDimensionControl(dimension, selectEl, inputEl, wrapperEl) {
    // Obsługa zmiany select
    selectEl.addEventListener('change', (e) => {
      const value = e.target.value;

      if (value === 'custom') {
        // Pokaż input dla custom
        wrapperEl.classList.add('custom-mode');
        inputEl.style.display = 'block';
        inputEl.focus();

        // Ustaw obecną wartość
        const currentValue = window.currentConfig ? window.currentConfig[dimension] : (dimension === 'width' ? 800 : 1000);
        inputEl.value = currentValue;
      } else {
        // Ukryj input, użyj wartości z select
        wrapperEl.classList.remove('custom-mode');
        inputEl.style.display = 'none';
        inputEl.value = value;

        // Aktualizuj wyświetlanie i konfigurację
        this.updateDimension(dimension, parseInt(value));
      }
    });

    // Obsługa zmiany input
    inputEl.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);

      // Walidacja
      const min = parseInt(inputEl.min);
      const max = parseInt(inputEl.max);

      if (!isNaN(value) && value >= min && value <= max) {
        this.updateDimension(dimension, value);

        // Sprawdź czy wartość jest w liście select
        const optionExists = Array.from(selectEl.options).some(opt => parseInt(opt.value) === value);
        if (optionExists) {
          selectEl.value = value.toString();
          wrapperEl.classList.remove('custom-mode');
          inputEl.style.display = 'none';
        } else {
          selectEl.value = 'custom';
        }
      }
    });

    // Obsługa utraty focusu
    inputEl.addEventListener('blur', (e) => {
      const value = parseInt(e.target.value);
      const min = parseInt(inputEl.min);
      const max = parseInt(inputEl.max);

      // Popraw wartość jeśli poza zakresem
      if (isNaN(value) || value < min) {
        inputEl.value = min;
        this.updateDimension(dimension, min);
      } else if (value > max) {
        inputEl.value = max;
        this.updateDimension(dimension, max);
      }
    });

    // Ustaw początkową wartość
    const initialValue = inputEl.value;
    const optionExists = Array.from(selectEl.options).some(opt => opt.value === initialValue);

    if (optionExists) {
      selectEl.value = initialValue;
    } else {
      selectEl.value = 'custom';
      wrapperEl.classList.add('custom-mode');
      inputEl.style.display = 'block';
    }

    // DODANE: Wymuś aktualizację początkową
    this.updateDimension(dimension, parseInt(initialValue));
  }

  updateDimension(dimension, value) {
    console.log('DimensionHandler: Updating', dimension, 'to', value);

    // Aktualizuj wyświetlanie
    const displayEl = document.getElementById(`${dimension}-display`);
    console.log('Display element:', displayEl);

    if (displayEl) {
      displayEl.textContent = value;
      console.log('Updated display to:', value);
    } else {
      console.error('Display element not found for:', dimension);
    }

    // Aktualizuj konfigurację
    if (window.currentConfig) {
      window.currentConfig[dimension] = value;
    }

    // Wywołaj event dla form handlera
    if (window.formHandler) {
      window.formHandler.triggerCallback('dimensionChange', { dimension, value });
    }

    // Wymuś aktualizację całego konfiguratora
    if (window.configuratorCore && window.configuratorCore.isInitialized) {
      window.configuratorCore.updateAll();
    }

    // Aktualizuj measurement info
    this.updateMeasurementInfo();
  }

  updateMeasurementInfo() {
    const measurementType = document.querySelector('input[name="measurement-type"]:checked')?.value;
    const infoBox = document.getElementById('measurement-info');
    
    if (measurementType === 'brick-to-brick') {
      const width = parseInt(document.getElementById('width').value) || 800;
      const height = parseInt(document.getElementById('height').value) || 1000;
      
      const actualWidth = width + 150;
      const actualHeight = height + 75;
      
      const actualWidthEl = document.getElementById('actual-width');
      const actualHeightEl = document.getElementById('actual-height');
      
      if (actualWidthEl) actualWidthEl.textContent = actualWidth;
      if (actualHeightEl) actualHeightEl.textContent = actualHeight;
      
      if (infoBox) {
        infoBox.style.display = 'block';
      }
      
      // Save to config for specification and price calculation
      if (window.currentConfig) {
        window.currentConfig.actualWidth = actualWidth;
        window.currentConfig.actualHeight = actualHeight;
        window.currentConfig.actualFrameWidth = actualWidth;
        window.currentConfig.actualFrameHeight = actualHeight;
      }
    } else {
      if (infoBox) {
        infoBox.style.display = 'none';
      }
      if (window.currentConfig) {
        window.currentConfig.actualWidth = null;
        window.currentConfig.actualHeight = null;
        window.currentConfig.actualFrameWidth = null;
        window.currentConfig.actualFrameHeight = null;
      }
    }
  }
}

// Inicjalizuj
window.dimensionHandler = new DimensionHandler();