class BarsController {
  constructor() {
    this.config = {
      patterns: {
        'none': { name: 'No Bars', divisions: { h: 0, v: 0 } },
        '2x2': { name: '2×2', divisions: { h: 0, v: 1 } }, // 2 okienka (1×2)
        '3x3': { name: '3×3', divisions: { h: 0, v: 2 } }, // 3 okienka (1×3)
        '4x4': { name: '4×4', divisions: { h: 1, v: 1 } }, // 4 okienka (2×2) - PRZYWRÓCONE
        '6x6': { name: '6×6', divisions: { h: 1, v: 2 } }, // 6 okienek (2×3)
        '9x9': { name: '9×9', divisions: { h: 2, v: 2 } }, // 9 okienek (3×3)
        '2-vertical': { name: '2 Vertical Bars', divisions: { h: 0, v: 2 } },
        '1-vertical': { name: '1 Vertical Bar', divisions: { h: 0, v: 1 } },
        'custom': { name: 'Custom Design', divisions: null }
      }
    };

    this.state = {
      upper: { pattern: 'none', bars: { horizontal: [], vertical: [] }, customPosition: 150 },
      lower: { pattern: 'none', bars: { horizontal: [], vertical: [] }, customPosition: 150 },
      sameBarsForBoth: true,
      customMode: false
    };

    this.canvases = {
      upperPreview: null,
      lowerPreview: null,
      externalMain: null,
      internalMain: null
    };

    this.init();
  }

  init() {
    // Znajdź elementy DOM
    this.elements = {
      upperSelect: document.getElementById('upper-bars'),
      lowerSelect: document.getElementById('lower-bars'),
      sameBarsCheckbox: document.getElementById('same-bars-both-sashes'),
      upperPositionDiv: document.getElementById('upper-custom-bars-position'),
      lowerPositionDiv: document.getElementById('lower-custom-bars-position'),
      upperPositionInput: document.getElementById('upper-bar-position'),
      lowerPositionInput: document.getElementById('lower-bar-position'),
      customContainer: document.getElementById('custom-bars-container')
    };

    // Inicjalizuj canvasy
    this.initCanvases();

    // Dodaj event listenery
    this.attachEventListeners();

    // Synchronizuj state z wartościami selectów (domyślnie 'none')
    this.syncStateFromSelects();

    // Pierwsze renderowanie
    this.updateAllVisualizations();
  }

  syncStateFromSelects() {
    // Czytaj aktualne wartości z selectów
    const upperPattern = this.elements.upperSelect?.value || 'none';
    const lowerPattern = this.elements.lowerSelect?.value || 'none';
    
    // Ustaw state
    this.state.upper.pattern = upperPattern;
    this.state.lower.pattern = lowerPattern;
    
    // Wygeneruj bary na podstawie pattern
    this.generatePattern('upper', upperPattern);
    this.generatePattern('lower', lowerPattern);
    
    // Zapisz do currentConfig
    if (window.currentConfig) {
      window.currentConfig.upperBars = upperPattern;
      window.currentConfig.lowerBars = lowerPattern;
    }
    
    console.log('Bars synced from selects:', upperPattern, lowerPattern);
  }

  initCanvases() {
    // Canvasy podglądu w panelu custom
    this.canvases.upperPreview = document.getElementById('upper-sash-bars-canvas');
    this.canvases.lowerPreview = document.getElementById('lower-sash-bars-canvas');

    // Główne canvasy wizualizacji
    this.createMainCanvases();
  }

  createMainCanvases() {
    const externalContainer = document.getElementById('external-window-container');
    const internalContainer = document.getElementById('internal-window-container');

    if (externalContainer && !document.getElementById('external-bars-canvas')) {
      this.canvases.externalMain = this.createCanvas('external-bars-canvas', externalContainer);
    }

    if (internalContainer && !document.getElementById('internal-bars-canvas')) {
      this.canvases.internalMain = this.createCanvas('internal-bars-canvas', internalContainer);
    }
  }

  createCanvas(id, container) {
    const canvas = document.createElement('canvas');
    canvas.id = id;
    canvas.className = 'overlay';
    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight;
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.zIndex = '3';
    canvas.style.pointerEvents = 'none';
    container.appendChild(canvas);
    return canvas;
  }

  attachEventListeners() {
    // Upper bars select
    if (this.elements.upperSelect) {
      this.elements.upperSelect.addEventListener('change', (e) => {
        this.handlePatternChange('upper', e.target.value);
      });
    }

    // Lower bars select
    if (this.elements.lowerSelect) {
      this.elements.lowerSelect.addEventListener('change', (e) => {
        if (!this.state.sameBarsForBoth) {
          this.handlePatternChange('lower', e.target.value);
        }
      });
    }

    // Same bars checkbox
    if (this.elements.sameBarsCheckbox) {
      this.elements.sameBarsCheckbox.addEventListener('change', (e) => {
        this.handleSameBarsToggle(e.target.checked);
      });
    }

    // Position inputs - PRZYWRÓCONE
    if (this.elements.upperPositionInput) {
      this.elements.upperPositionInput.addEventListener('input', (e) => {
        this.handlePositionChange('upper', parseInt(e.target.value));
      });
    }

    if (this.elements.lowerPositionInput) {
      this.elements.lowerPositionInput.addEventListener('input', (e) => {
        if (!this.state.sameBarsForBoth) {
          this.handlePositionChange('lower', parseInt(e.target.value));
        }
      });
    }

    // Custom panel buttons
    this.attachCustomPanelListeners();
  }

  attachCustomPanelListeners() {
    // Pattern buttons
    document.querySelectorAll('.pattern-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sash = e.target.dataset.sash;
        const pattern = e.target.dataset.pattern;
        this.selectCustomPattern(sash, pattern);
      });
    });

    // Same pattern checkbox
    const samePatternCheckbox = document.getElementById('same-pattern-both-sashes');
    if (samePatternCheckbox) {
      samePatternCheckbox.addEventListener('change', (e) => {
        this.handleSamePatternToggle(e.target.checked);
      });
    }

    // Apply/Cancel buttons
    const applyBtn = document.getElementById('apply-pattern');
    const cancelBtn = document.getElementById('cancel-pattern');

    if (applyBtn) {
      applyBtn.addEventListener('click', () => this.applyCustomPattern());
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.cancelCustomPattern());
    }

    // Tool buttons
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sash = e.target.dataset.sash;
        const tool = e.target.dataset.tool;
        this.handleToolClick(sash, tool);
      });
    });
  }

  handlePatternChange(sash, pattern) {
    this.state[sash].pattern = pattern;

    // Pokaż/ukryj elementy UI
    this.updateUIVisibility(sash, pattern);

    // Generuj szprosy
    if (pattern === 'custom') {
      this.showCustomPanel();
    } else if (pattern === '2-vertical') {
      this.generateTwoVerticalBars(sash);
    } else {
      this.generatePattern(sash, pattern);
    }

    // Jeśli same bars dla obu
    if (this.state.sameBarsForBoth && sash === 'upper') {
      this.syncLowerToUpper();
    }

    this.updateAllVisualizations();
    
    // ZAPISZ DO KONFIGURACJI
    if (window.currentConfig) {
      window.currentConfig[sash + 'Bars'] = pattern;
      console.log('Bars updated in config:', sash + 'Bars', '=', pattern);
      
      // Jeśli same bars dla obu, zapisz też lower
      if (this.state.sameBarsForBoth && sash === 'upper') {
        window.currentConfig.lowerBars = pattern;
        console.log('Lower bars synced in config:', pattern);
      }
    }
    
    this.updatePrice();
  }

  handlePositionChange(sash, position) {
    this.state[sash].customPosition = position;

    if (this.state[sash].pattern === '2-vertical') {
      this.generateTwoVerticalBars(sash);
    }

    if (this.state.sameBarsForBoth && sash === 'upper') {
      this.state.lower.customPosition = position;
      if (this.elements.lowerPositionInput) {
        this.elements.lowerPositionInput.value = position;
      }
      this.generateTwoVerticalBars('lower');
    }

    this.updateAllVisualizations();
  }

  handleSameBarsToggle(checked) {
    this.state.sameBarsForBoth = checked;

    if (this.elements.lowerSelect) {
      this.elements.lowerSelect.disabled = checked;
    }
    if (this.elements.lowerPositionInput) {
      this.elements.lowerPositionInput.disabled = checked;
    }

    if (checked) {
      this.syncLowerToUpper();
    }
  }

  handleSamePatternToggle(checked) {
    const lowerPanel = document.getElementById('lower-sash-panel');
    if (lowerPanel) {
      lowerPanel.style.display = checked ? 'none' : 'block';
    }

    if (checked) {
      // Skopiuj wzór z górnego do dolnego
      this.state.lower.bars = JSON.parse(JSON.stringify(this.state.upper.bars));
      this.drawPreviewCanvas('lower');
    }
  }

  syncLowerToUpper() {
    // Skopiuj wszystkie ustawienia z upper do lower
    this.state.lower.pattern = this.state.upper.pattern;
    this.state.lower.bars = JSON.parse(JSON.stringify(this.state.upper.bars));
    this.state.lower.customPosition = this.state.upper.customPosition;

    // Zaktualizuj UI
    if (this.elements.lowerSelect) {
      this.elements.lowerSelect.value = this.state.upper.pattern;
    }
    if (this.elements.lowerPositionInput) {
      this.elements.lowerPositionInput.value = this.state.upper.customPosition;
    }

    this.updateUIVisibility('lower', this.state.lower.pattern);
    
    // Zapisz do konfiguracji
    if (window.currentConfig) {
      window.currentConfig.lowerBars = this.state.upper.pattern;
      console.log('Lower bars synced to upper in config:', this.state.upper.pattern);
    }
  }

  updateUIVisibility(sash, pattern) {
    const positionDiv = sash === 'upper' ? this.elements.upperPositionDiv : this.elements.lowerPositionDiv;

    // POKAZUJ INPUT DLA 2-VERTICAL
    if (positionDiv) {
      positionDiv.style.display = (pattern === '2-vertical') ? 'block' : 'none';
    }

    // Ukryj custom container dla wszystkich oprócz custom
    if (this.elements.customContainer) {
      this.elements.customContainer.style.display = (pattern === 'custom') ? 'block' : 'none';
    }
  }

  generatePattern(sash, patternKey) {
    const pattern = this.config.patterns[patternKey];
    if (!pattern || !pattern.divisions) return;

    const canvas = sash === 'upper' ? this.canvases.upperPreview : this.canvases.lowerPreview;
    if (!canvas) return;

    const width = canvas.width;
    const height = canvas.height;

    // Wyczyść istniejące szprosy
    this.state[sash].bars.horizontal = [];
    this.state[sash].bars.vertical = [];

    // Generuj poziome
    for (let i = 1; i <= pattern.divisions.h; i++) {
      this.state[sash].bars.horizontal.push(height * i / (pattern.divisions.h + 1));
    }

    // Generuj pionowe
    for (let i = 1; i <= pattern.divisions.v; i++) {
      this.state[sash].bars.vertical.push(width * i / (pattern.divisions.v + 1));
    }
  }

  generateTwoVerticalBars(sash) {
    const canvas = sash === 'upper' ? this.canvases.upperPreview : this.canvases.lowerPreview;
    if (!canvas) return;

    const width = canvas.width;
    const position = this.state[sash].customPosition;

    // Przelicz mm na procent szerokości szyby
    // Zakładamy że szerokość szyby to około 700mm
    const glassWidthMm = 700;
    const positionPercent = position / glassWidthMm;

    // Wyczyść i dodaj 2 pionowe szprosy
    this.state[sash].bars.horizontal = [];
    this.state[sash].bars.vertical = [
      width * positionPercent,
      width * (1 - positionPercent)
    ];
  }

  showCustomPanel() {
    if (this.elements.customContainer) {
      this.elements.customContainer.style.display = 'block';
      this.state.customMode = true;

      // Zapisz backup aktualnego stanu
      this.backupState = JSON.parse(JSON.stringify(this.state));

      // Ustaw domyślny wzór 6x6
      this.selectCustomPattern('upper', '6x6');
      this.selectCustomPattern('lower', '6x6');
    }
  }

  selectCustomPattern(sash, pattern) {
    // Odznacz wszystkie przyciski w tej grupie
    document.querySelectorAll(`.pattern-btn[data-sash="${sash}"]`).forEach(btn => {
      btn.classList.remove('selected');
    });

    // Zaznacz wybrany
    const selectedBtn = document.querySelector(`.pattern-btn[data-sash="${sash}"][data-pattern="${pattern}"]`);
    if (selectedBtn) {
      selectedBtn.classList.add('selected');
    }

    // Pokaż/ukryj narzędzia dla custom
    const tools = document.getElementById(`${sash}-advanced-tools`);
    if (tools) {
      tools.style.display = (pattern === 'custom') ? 'block' : 'none';
    }

    // Generuj wzór
    if (pattern !== 'custom') {
      this.generatePattern(sash, pattern);
      this.drawPreviewCanvas(sash);
    }

    // Jeśli same pattern dla obu
    const samePatternCheckbox = document.getElementById('same-pattern-both-sashes');
    if (samePatternCheckbox && samePatternCheckbox.checked && sash === 'upper') {
      this.selectCustomPattern('lower', pattern);
    }
  }

  handleToolClick(sash, tool) {
    switch(tool) {
      case 'add-horizontal':
        this.enableAddMode(sash, 'horizontal');
        break;
      case 'add-vertical':
        this.enableAddMode(sash, 'vertical');
        break;
      case 'clear':
        this.clearBars(sash);
        break;
    }
  }

  enableAddMode(sash, orientation) {
    const canvas = sash === 'upper' ? this.canvases.upperPreview : this.canvases.lowerPreview;
    if (!canvas) return;

    canvas.style.cursor = 'crosshair';

    const clickHandler = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (orientation === 'horizontal') {
        // Sprawdź czy nie ma już szprosu w tym miejscu
        const exists = this.state[sash].bars.horizontal.some(pos => Math.abs(pos - y) < 10);
        if (!exists) {
          this.state[sash].bars.horizontal.push(y);
          this.state[sash].bars.horizontal.sort((a, b) => a - b);
        }
      } else {
        const exists = this.state[sash].bars.vertical.some(pos => Math.abs(pos - x) < 10);
        if (!exists) {
          this.state[sash].bars.vertical.push(x);
          this.state[sash].bars.vertical.sort((a, b) => a - b);
        }
      }

      this.drawPreviewCanvas(sash);

      // Jeśli same pattern dla obu
      const samePatternCheckbox = document.getElementById('same-pattern-both-sashes');
      if (samePatternCheckbox && samePatternCheckbox.checked && sash === 'upper') {
        this.state.lower.bars = JSON.parse(JSON.stringify(this.state.upper.bars));
        this.drawPreviewCanvas('lower');
      }

      // Wyłącz tryb dodawania
      canvas.style.cursor = 'default';
      canvas.removeEventListener('click', clickHandler);
    };

    canvas.addEventListener('click', clickHandler, { once: true });
  }

  clearBars(sash) {
    this.state[sash].bars.horizontal = [];
    this.state[sash].bars.vertical = [];
    this.drawPreviewCanvas(sash);

    // Jeśli same pattern dla obu
    const samePatternCheckbox = document.getElementById('same-pattern-both-sashes');
    if (samePatternCheckbox && samePatternCheckbox.checked && sash === 'upper') {
      this.state.lower.bars = { horizontal: [], vertical: [] };
      this.drawPreviewCanvas('lower');
    }
  }

  applyCustomPattern() {
    // Zapisz custom bars do głównego stanu
    this.state.customMode = false;

    // Ukryj panel
    if (this.elements.customContainer) {
      this.elements.customContainer.style.display = 'none';
    }

    // Zaktualizuj główną wizualizację
    this.updateAllVisualizations();

    // Zaktualizuj konfigurację
    if (window.currentConfig) {
      window.currentConfig.upperBars = 'custom';
      window.currentConfig.lowerBars = 'custom';
      window.currentConfig.customBars = {
        upper: JSON.parse(JSON.stringify(this.state.upper.bars)),
        lower: JSON.parse(JSON.stringify(this.state.lower.bars))
      };
      console.log('Custom bars applied to config');
    }

    this.updatePrice();
  }

  cancelCustomPattern() {
    // Przywróć backup
    if (this.backupState) {
      this.state = JSON.parse(JSON.stringify(this.backupState));
    }

    // Ukryj panel
    if (this.elements.customContainer) {
      this.elements.customContainer.style.display = 'none';
    }

    this.state.customMode = false;
    this.updateAllVisualizations();
  }

  drawPreviewCanvas(sash) {
    const canvas = sash === 'upper' ? this.canvases.upperPreview : this.canvases.lowerPreview;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    this.drawBars(ctx, this.state[sash].bars, canvas.width, canvas.height);
  }

  updateAllVisualizations() {
    // Rysuj podglądy
    this.drawPreviewCanvas('upper');
    this.drawPreviewCanvas('lower');

    // Rysuj główne wizualizacje
    this.drawMainVisualizations();
  }

  drawMainVisualizations() {
    if (this.canvases.externalMain) {
      this.drawMainCanvas(this.canvases.externalMain, 'external');
    }
    if (this.canvases.internalMain) {
      this.drawMainCanvas(this.canvases.internalMain, 'internal');
    }
  }

  // POPRAWIONE OBSZARY SZYB - MNIEJSZE O 20% I PRZESUNIĘTE
  getGlassAreas(viewType) {
    if (viewType === 'external') {
      return {
        upper: {
          x: 0.24, // 24% od lewej
          y: 0.21, // 19% od góry (przesunięte w dół)
          width: 0.54, // 52% szerokości (20% mniejsze)
          height: 0.265 // 27% wysokości (20% mniejsze)
        },
        lower: {
          x: 0.24, // 24% od lewej
          y: 0.505, // było 0.47, teraz 0.53 (przesunięte niżej o 25px)
          width: 0.54, // 52% szerokości (20% mniejsze)
          height: 0.255 // 27% wysokości (20% mniejsze)
        }
      };
    } else {
      // Internal view - też zmniejszone o 20% i zwiększony odstęp
      return {
        upper: {
          x: 0.23, // 20% od lewej
          y: 0.21, // 17% od góry (przesunięte w dół)
          width: 0.54, // 60% szerokości (20% mniejsze)
          height: 0.255 // 29% wysokości (20% mniejsze)
        },
        lower: {
          x: 0.23,
          y: 0.49, // było 0.47, teraz 0.53 (przesunięte niżej)
          width: 0.54,
          height: 0.29
        }
      };
    }
  }

  drawMainCanvas(canvas, viewType) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const areas = this.getGlassAreas(viewType);

    // Rysuj górne skrzydło
    this.drawSashBars(ctx, this.state.upper, areas.upper, canvas.width, canvas.height);

    // Rysuj dolne skrzydło
    this.drawSashBars(ctx, this.state.lower, areas.lower, canvas.width, canvas.height);
  }

  drawSashBars(ctx, sashState, area, canvasWidth, canvasHeight) {
    // Oblicz rzeczywiste wymiary obszaru szyby
    const glassX = canvasWidth * area.x;
    const glassY = canvasHeight * area.y;
    const glassWidth = canvasWidth * area.width;
    const glassHeight = canvasHeight * area.height;

    // Ogranicz rysowanie do obszaru szyby
    ctx.save();
    ctx.beginPath();
    ctx.rect(glassX, glassY, glassWidth, glassHeight);
    ctx.clip();

    // Ustaw style
    const barColor = this.getBarColor();
    ctx.strokeStyle = barColor;
    ctx.lineWidth = Math.max(3, glassWidth * 0.01);

    // Dodaj cień
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 2;

    // Skaluj pozycje szprosów
    const scaleX = glassWidth / 300; // 300 to szerokość canvas podglądu
    const scaleY = glassHeight / 200; // 200 to wysokość canvas podglądu

    // Rysuj poziome
    sashState.bars.horizontal.forEach(y => {
      const realY = glassY + (y * scaleY);
      ctx.beginPath();
      ctx.moveTo(glassX, realY);
      ctx.lineTo(glassX + glassWidth, realY);
      ctx.stroke();
    });

    // Rysuj pionowe
    sashState.bars.vertical.forEach(x => {
      const realX = glassX + (x * scaleX);
      ctx.beginPath();
      ctx.moveTo(realX, glassY);
      ctx.lineTo(realX, glassY + glassHeight);
      ctx.stroke();
    });

    ctx.restore();
  }

  drawBars(ctx, bars, width, height, offsetX = 0, offsetY = 0, useOffsets = true) {
    const barColor = this.getBarColor();
    ctx.strokeStyle = barColor;
    ctx.lineWidth = Math.max(3, width * 0.01);

    // Rysuj poziome
    bars.horizontal.forEach(y => {
      ctx.beginPath();
      ctx.moveTo(offsetX, useOffsets ? y : y);
      ctx.lineTo(offsetX + width, useOffsets ? y : y);
      ctx.stroke();
    });

    // Rysuj pionowe
    bars.vertical.forEach(x => {
      ctx.beginPath();
      ctx.moveTo(useOffsets ? x : x, offsetY);
      ctx.lineTo(useOffsets ? x : x, offsetY + height);
      ctx.stroke();
    });
  }

  getBarColor() {
    if (!window.currentConfig) return '#FFFFFF';

    if (window.currentConfig.colorType === 'single') {
      const color = window.currentConfig.singleColor || window.currentConfig.colorSingle || 'white';
      return color === 'white' ? '#FFFFFF' : '#D2B48C';
    } else {
      const color = window.currentConfig.interiorColor || window.currentConfig.colorInterior || 'white';
      return color === 'white' ? '#FFFFFF' : '#D2B48C';
    }
  }

  updatePrice() {
    if (typeof window.updatePrice === 'function') {
      window.updatePrice();
    }
  }

  // Public API
  getState() {
    return this.state;
  }

  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.updateAllVisualizations();
  }
}

// Inicjalizuj kontroler po załadowaniu DOM
document.addEventListener('DOMContentLoaded', function() {
  window.barsController = new BarsController();
  console.log('Bars controller initialized');
});

// Eksportuj dla kompatybilności wstecznej
window.barModule = {
  generateBarsPattern: function(sash, pattern) {
    if (window.barsController) {
      window.barsController.generatePattern(sash, pattern);
      window.barsController.updateAllVisualizations();
    }
  },
  generateCustomBars: function(sash, position) {
    if (window.barsController) {
      window.barsController.state[sash].customPosition = position;
      window.barsController.generateTwoVerticalBars(sash);
      window.barsController.updateAllVisualizations();
    }
  },
  updateWindowVisuals: function() {
    if (window.barsController) {
      window.barsController.updateAllVisualizations();
    }
  }
};