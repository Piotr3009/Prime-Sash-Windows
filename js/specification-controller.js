class SpecificationController {
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
    this.attachEventListeners();
    this.setupColorPreviews();
    this.setupColorDropdowns();
    this.setupSectionChangeListeners();
    this.setupFrostedOptions();
    this.setupGlobalAutoSave();
  }
  
  setupGlobalAutoSave() {
    // Debounced auto-save przy każdej zmianie
    let saveTimeout;
    const debouncedSave = () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        if (window.currentConfig) {
          localStorage.setItem('lastWindowConfig', JSON.stringify(window.currentConfig));
          console.log('💾 Auto-saved (debounced)');
        }
      }, 1000); // 1 sekunda debounce
    };
    
    // Słuchaj na wszystkie inputy, selecty i radio buttons
    document.querySelectorAll('.config-section input, .config-section select').forEach(element => {
      element.addEventListener('change', debouncedSave);
      element.addEventListener('input', debouncedSave);
    });
    
    // Słuchaj na kliknięcia w color options
    document.querySelectorAll('.color-option').forEach(option => {
      option.addEventListener('click', debouncedSave);
    });
  }

  setupSectionChangeListeners() {
    // Sekcja 1: Dimensions
    this.watchSection(['width', 'width-select', 'height', 'height-select', 'measurement-type'], 'apply-dimensions');

    // Sekcja 2: Georgian Bars
    this.watchSection(['upper-bars', 'lower-bars', 'same-bars-both-sashes'], 'apply-bars');

    // Sekcja 3: Frame
    this.watchSection(['frame-type'], 'apply-frame');

    // Sekcja 4: Horns
    this.watchSection(['horn-type'], 'apply-horns');

    // Sekcja 5: Glass
    this.watchSection(['glass-type', 'spacer-color'], 'apply-glass');

    // Sekcja 6: Glass Spec
    this.watchSection(['glass-spec', 'glass-finish', 'frosted-location'], 'apply-glass-spec');

    // Sekcja 7: Opening
    this.watchSection(['opening-type'], 'apply-opening');

    // Sekcja 8: PAS 24
    this.watchSection(['pas24'], 'apply-pas24');

    // Sekcja 9: Color
    this.watchSection(['color-type'], 'apply-color');
    // Dodatkowe obserwowanie dla color options
    this.watchColorSection();

    // Sekcja 10: Details (Hardware)
    this.watchSection([], 'apply-details');
  }

  watchSection(fieldIds, buttonId) {
    const button = document.getElementById(buttonId);
    if (!button) return;

    fieldIds.forEach(fieldId => {
      // Dla radio buttons i checkboxów
      const radios = document.getElementsByName(fieldId);
      if (radios.length > 0) {
        radios.forEach(radio => {
          radio.addEventListener('change', () => {
            // Invalidate this section and all subsequent ones
            if (window.invalidateSection) {
              window.invalidateSection(buttonId);
            }
          });
        });
      }

      // Dla pojedynczych elementów
      const element = document.getElementById(fieldId);
      if (element) {
        const eventType = element.type === 'checkbox' ? 'change' : 'input';
        element.addEventListener(eventType, () => {
          // Invalidate this section and all subsequent ones
          if (window.invalidateSection) {
            window.invalidateSection(buttonId);
          }
        });

        // Dla selectów dodaj też change
        if (element.tagName === 'SELECT') {
          element.addEventListener('change', () => {
            // Invalidate this section and all subsequent ones
            if (window.invalidateSection) {
              window.invalidateSection(buttonId);
            }
          });
        }
      }
    });
  }

  watchColorSection() {
    const button = document.getElementById('apply-color');
    if (!button) return;

    // Single color options
    const singleColorOptions = document.querySelectorAll('#single-color-selector .color-option');
    singleColorOptions.forEach(option => {
      option.addEventListener('click', () => {
        // Invalidate color section and all subsequent ones
        if (window.invalidateSection) {
          window.invalidateSection('apply-color');
        }
      });
    });

    // Dual color options
    const dualColorOptions = document.querySelectorAll('.interior-color, .exterior-color');
    dualColorOptions.forEach(option => {
      option.addEventListener('click', () => {
        // Invalidate color section and all subsequent ones
        if (window.invalidateSection) {
          window.invalidateSection('apply-color');
        }
      });
    });
  }

  attachEventListeners() {
    // Apply Dimensions
    const applyDimensionsBtn = document.getElementById('apply-dimensions');
    if (applyDimensionsBtn) {
      applyDimensionsBtn.addEventListener('click', () => this.applyDimensions());
    }

    // Apply Bars
    const applyBarsBtn = document.getElementById('apply-bars');
    if (applyBarsBtn) {
      applyBarsBtn.addEventListener('click', () => this.applyBars());
    }

    // Apply Fix Bars
    const applyFixBarsBtn = document.getElementById('apply-fix-bars');
    if (applyFixBarsBtn) {
      applyFixBarsBtn.addEventListener('click', () => this.applyFixBars());
    }

    // Apply Frame
    const applyFrameBtn = document.getElementById('apply-frame');
    if (applyFrameBtn) {
      applyFrameBtn.addEventListener('click', () => this.applyFrame());
    }

    // Apply Horns
    const applyHornsBtn = document.getElementById('apply-horns');
    if (applyHornsBtn) {
      applyHornsBtn.addEventListener('click', () => this.applyHorns());
    }

    // Apply Color
    const applyColorBtn = document.getElementById('apply-color');
    if (applyColorBtn) {
      applyColorBtn.addEventListener('click', () => this.applyColor());
    }

    // Apply Glass
    const applyGlassBtn = document.getElementById('apply-glass');
    if (applyGlassBtn) {
      applyGlassBtn.addEventListener('click', () => this.applyGlass());
    }

    // Apply Opening
    const applyOpeningBtn = document.getElementById('apply-opening');
    if (applyOpeningBtn) {
      applyOpeningBtn.addEventListener('click', () => this.applyOpening());
    }

    // Apply PAS 24
    const applyPAS24Btn = document.getElementById('apply-pas24');
    if (applyPAS24Btn) {
      applyPAS24Btn.addEventListener('click', () => this.applyPAS24());
    }

    // Apply Details
    const applyDetailsBtn = document.getElementById('apply-details');
    if (applyDetailsBtn) {
      applyDetailsBtn.addEventListener('click', () => this.applyDetails());
    }

    // Apply Glass Spec
    const applyGlassSpecBtn = document.getElementById('apply-glass-spec');
    if (applyGlassSpecBtn) {
      applyGlassSpecBtn.addEventListener('click', () => this.applyGlassSpec());
    }

    // Frame type radios for warning box
    const frameRadios = document.querySelectorAll('input[name="frame-type"]');
    frameRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        const infoPanel = document.getElementById('info-panel-content');
        if (infoPanel) {
          if (e.target.value === 'slim') {
            infoPanel.innerHTML =
              '<p class="info-title">Slim Frame</p>' +
              '<p><span class="info-highlight">Note:</span> Slim frame cannot accommodate Triple Glazing</p>' +
              '<p class="info-warning">Non-standard product — additional cost applies</p>';
          } else {
            infoPanel.innerHTML = '';
          }
        }
      });
    });

    // Opening type radios - immediate update (overlay + 3D)
    const openingRadios = document.querySelectorAll('input[name="opening-type"]');
    openingRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.checked) {
          // Old visualization manager
          if (window.visualizationManager && window.visualizationManager.updateOpeningIndicators) {
            window.visualizationManager.updateOpeningIndicators(e.target.value);
          }
          // 3D overlay + sash reset
          this.updateOpeningOverlay(e.target.value);
          if (typeof window.update3D === 'function') {
            window.update3D({ openingType: e.target.value });
          }
        }
      });
    });

    // Spacer colour radios - live 3D update + info panel
    const spacerRadios = document.querySelectorAll('input[name="spacer-color"]');
    const spacerInfoHtml =
      '<p class="info-title" style="color:#c0392b;font-weight:600;">Spacer colour affects the overall look!</p>' +
      '<p><span class="info-highlight">Black</span> — best for dark frames (Anthracite, Black, Burgundy)</p>' +
      '<p><span class="info-highlight">White</span> — best for White, Off-White, Cream frames</p>' +
      '<p><span class="info-highlight">Silver</span> — neutral, works with any colour</p>';
    spacerRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (typeof window.update3D === 'function') {
          window.update3D({ spacerColor: e.target.value });
        }
        const infoPanel = document.getElementById('info-panel-content');
        if (infoPanel) infoPanel.innerHTML = spacerInfoHtml;
      });
    });

    // Horn type radios - live 3D update
    const hornRadios = document.querySelectorAll('input[name="horn-type"]');
    hornRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (typeof window.update3D === 'function') {
          if (e.target.value === 'none') {
            window.update3D({ showHorns: false });
          } else {
            window.update3D({ showHorns: true, hornType: e.target.value });
          }
        }
      });
    });

    const pas24InfoBtn = document.getElementById('pas24-info');
    if (pas24InfoBtn) {
      pas24InfoBtn.addEventListener('click', () => {
        window.open('certifications.html', '_blank');
      });
    }

    // PAS24 radio - show info in info panel
    const pas24Radios = document.querySelectorAll('input[name="pas24"]');
    pas24Radios.forEach(radio => {
      radio.addEventListener('change', () => {
        const infoPanel = document.getElementById('info-panel-content');
        if (!infoPanel) return;
        if (radio.value === 'yes') {
          infoPanel.innerHTML =
            '<p class="info-title">PAS 24 Security Standard</p>' +
            '<p>PAS 24 is an enhanced security specification for doors and windows. It tests resistance to <span class="info-highlight">physical attack, manipulation and weather</span>.</p>' +
            '<p class="info-red">Required for most insurance policies and Building Regulations Part Q.</p>' +
            '<p class="info-note"><a href="certifications.html" target="_blank" class="measurement-link">Learn more →</a></p>';
        } else {
          infoPanel.innerHTML = '';
        }
      });
    });
  }

  setupColorPreviews() {
    // Color name → hex map for 3D
    const colorHexMap = {
      'white':     '#FAFAFA',
      'black':     '#0A0A0A',
      'anthracite':'#293133',
      'olive':     '#424632',
      'offwhite':  '#F7F9F5',
      'cream':     '#F1EFDC',
      'burgundy':  '#5E2028',
      'royal':     '#222D5A',
      'oak':       '#8B6914'
    };
    this._colorHexMap = colorHexMap;

    // Single color options
    const singleColorOptions = document.querySelectorAll('#single-color-selector .color-option');
    singleColorOptions.forEach(option => {
      option.addEventListener('click', () => {
        // Remove selected from all
        singleColorOptions.forEach(opt => opt.classList.remove('selected'));
        // Add selected to clicked
        option.classList.add('selected');

        const name = option.dataset.name;
        const color = option.dataset.color;
        const hex = colorHexMap[color] || option.style.backgroundColor;
        document.getElementById('single-preview-name').textContent = name;
        document.getElementById('single-preview-ral').textContent = hex || color;
        
        if (window.currentConfig) {
          window.currentConfig.colorSingle = color;
          window.currentConfig.colorSingleName = name;
          window.currentConfig.colorType = 'single';
        }

        // ✅ LIVE 3D update
        if (hex && typeof window.update3D === 'function') {
          window.update3D({ woodColor: hex, sameColor: true });
        }

        // Trigger price recalculation
        if (window.configuratorCore && window.configuratorCore.isInitialized) {
          window.configuratorCore.updateAll();
        }
      });
    });

    // Interior color options
    const interiorColorOptions = document.querySelectorAll('.interior-color');
    interiorColorOptions.forEach(option => {
      option.addEventListener('click', () => {
        interiorColorOptions.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');

        const name = option.dataset.name;
        const ral = option.dataset.ral;
        const color = option.dataset.color;
        document.getElementById('dual-preview-interior').textContent = `${name} (${ral})`;
        
        if (window.currentConfig) {
          window.currentConfig.colorInterior = color;
          window.currentConfig.colorInteriorName = name;
          window.currentConfig.colorType = 'dual';
        }

        // ✅ LIVE 3D update (interior)
        const hex = colorHexMap[color];
        if (hex && typeof window.update3D === 'function') {
          window.update3D({ woodColorInt: hex, sameColor: false });
        }
        if (window.configuratorCore && window.configuratorCore.isInitialized) {
          window.configuratorCore.updateAll();
        }
      });
    });

    // Exterior color options
    const exteriorColorOptions = document.querySelectorAll('.exterior-color');
    exteriorColorOptions.forEach(option => {
      option.addEventListener('click', () => {
        exteriorColorOptions.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');

        const name = option.dataset.name;
        const ral = option.dataset.ral;
        const color = option.dataset.color;
        document.getElementById('dual-preview-exterior').textContent = `${name} (${ral})`;
        
        if (window.currentConfig) {
          window.currentConfig.colorExterior = color;
          window.currentConfig.colorExteriorName = name;
          window.currentConfig.colorType = 'dual';
        }

        // ✅ LIVE 3D update (exterior)
        const hex = colorHexMap[color];
        if (hex && typeof window.update3D === 'function') {
          window.update3D({ woodColorExt: hex, sameColor: false });
        }
        if (window.configuratorCore && window.configuratorCore.isInitialized) {
          window.configuratorCore.updateAll();
        }
      });
    });

    // Color type radio buttons
    const colorTypeRadios = document.querySelectorAll('input[name="color-type"]');
    colorTypeRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        if (window.currentConfig) {
          window.currentConfig.colorType = radio.value;
        }

        const dualSection = document.getElementById('dual-colour-section');
        const singleSelector = document.getElementById('single-color-selector');

        if (radio.value === 'single') {
          if (dualSection) dualSection.style.display = 'none';
          if (singleSelector) singleSelector.style.display = 'block';
          const singlePreview = document.getElementById('single-color-preview-info');
          const dualPreview = document.getElementById('dual-color-preview-info');
          if (singlePreview) singlePreview.style.display = 'block';
          if (dualPreview) dualPreview.style.display = 'none';
          const infoPanel = document.getElementById('info-panel-content');
          if (infoPanel) infoPanel.innerHTML = '';
        } else {
          if (dualSection) dualSection.style.display = 'block';
          if (singleSelector) singleSelector.style.display = 'none';
          const singlePreview = document.getElementById('single-color-preview-info');
          const dualPreview = document.getElementById('dual-color-preview-info');
          if (singlePreview) singlePreview.style.display = 'none';
          if (dualPreview) dualPreview.style.display = 'block';
          const infoPanel = document.getElementById('info-panel-content');
          if (infoPanel) infoPanel.innerHTML =
            '<p class="info-title">Dual Colour</p>' +
            '<p><span class="info-highlight">Additional cost:</span> +15% applied to total window price</p>' +
            '<p class="info-note">Interior and exterior can be different colours</p>';
        }
        // Trigger price recalculation
        if (window.configuratorCore && window.configuratorCore.isInitialized) {
          window.configuratorCore.updateAll();
        }
      });
    });
  }

  setupColorDropdowns() {
    // Full RAL lookup map for number input
    const RAL = {
      '1000':'#BEBD7F','1001':'#C2B078','1002':'#C6A664','1003':'#E5BE01','1004':'#CDA434',
      '1005':'#A98307','1006':'#E4A010','1007':'#DC9D00','1011':'#8A6642','1012':'#C7B446',
      '1013':'#EAE6CA','1014':'#E1CC4F','1015':'#E6D690','1016':'#EDFF21','1017':'#F5D033',
      '1018':'#F8F32B','1019':'#9E9764','1020':'#999950','1021':'#F3DA0B','1023':'#FAD201',
      '1024':'#AEA04B','1026':'#FFFF00','1027':'#9D9101','1028':'#F4A900','1032':'#D6AE01',
      '1033':'#F3A505','1034':'#EFA94A','2000':'#ED760E','2001':'#C93C20','2002':'#CB2821',
      '2003':'#FF7514','2004':'#F44611','3000':'#AF2B1E','3001':'#A52019','3002':'#A2231D',
      '3003':'#9B111E','3004':'#75151E','3005':'#5E2129','3007':'#412227','3009':'#642424',
      '3011':'#781F19','3012':'#C1876B','3013':'#A12312','3014':'#D36E70','3015':'#EA899A',
      '3016':'#B32821','3017':'#E63244','3018':'#D53032','3020':'#CC0605','3022':'#D95030',
      '3027':'#C51D34','3031':'#B32428','4001':'#6D3F5B','4002':'#922B3E','4003':'#DE4C8A',
      '4004':'#641C34','4005':'#6C4675','4006':'#A03472','4007':'#4A192C','4008':'#924E7D',
      '5000':'#354D73','5001':'#1F3438','5002':'#1E2460','5003':'#1D1E33','5004':'#18171C',
      '5005':'#1E2460','5007':'#3E5F8A','5008':'#26252D','5009':'#025669','5010':'#0E4243',
      '5011':'#1B2A4A','5012':'#3B83BD','5013':'#1E213D','5014':'#606E8C','5015':'#2271B3',
      '5017':'#063971','5018':'#3F888F','5019':'#1B5583','5020':'#1D334A','5021':'#256D7B',
      '5022':'#252850','5023':'#49678D','5024':'#5D9B9B','6000':'#316650','6001':'#287233',
      '6002':'#2D572C','6003':'#424632','6004':'#1F3A3D','6005':'#2F4538','6006':'#3E3B32',
      '6007':'#343B29','6008':'#39352A','6009':'#31372B','6010':'#35682D','6011':'#587246',
      '6012':'#343E40','6013':'#6C7156','6014':'#47402E','6016':'#1E5945','7000':'#78858B',
      '7001':'#8A9597','7002':'#817F68','7003':'#7D7F7D','7004':'#9EA0A1','7005':'#6C7059',
      '7006':'#756F61','7008':'#6A5F31','7011':'#434B4D','7012':'#4E5754','7015':'#434750',
      '7016':'#293133','7021':'#23282B','7022':'#332F2C','7023':'#8B8C7A','7024':'#474A51',
      '7030':'#8B8B7A','7031':'#474B4E','7032':'#B8B799','7033':'#7D8471','7034':'#8F8B66',
      '7035':'#D7D7D7','7036':'#7F7679','7037':'#7D7F7D','7038':'#B5B8B1','7039':'#6C6960',
      '7040':'#9DA1AA','7042':'#8D948D','7043':'#4E5452','7044':'#CAC4B0','7045':'#909090',
      '7046':'#82898F','7047':'#D0D0D0','8000':'#826C34','8001':'#955F20','8002':'#6C3B2A',
      '8003':'#734222','8004':'#8E402A','8007':'#59351F','8008':'#6F4F28','8011':'#6F3B2A',
      '8014':'#382C1E','8017':'#45322E','8019':'#403A3A','8022':'#212121','8024':'#79553D',
      '8025':'#755C48','8028':'#4E3B31','9001':'#FDF4E3','9002':'#E7EBDA','9003':'#F4F4F4',
      '9004':'#282828','9005':'#0A0A0A','9006':'#A5A5A5','9007':'#8F8F8F','9010':'#FFFFFF',
      '9011':'#1C2023','9016':'#F6F6F6','9017':'#1E1E1E','9018':'#D7D7D7'
    };

    const update3DColor = (hex, target) => {
      if (typeof window.update3D !== 'function') return;
      if (target === 'single') {
        window.update3D({ woodColor: hex, sameColor: true });
      } else if (target === 'interior') {
        window.update3D({ woodColorInt: hex, sameColor: false });
      } else if (target === 'exterior') {
        window.update3D({ woodColorExt: hex, sameColor: false });
      }
    };

    // Helper: switch swatch to Custom when RAL/F&B is used
    const switchToCustomSwatch = (target) => {
      if (target === 'single') {
        document.querySelectorAll('#single-color-selector .color-option').forEach(o => o.classList.remove('selected'));
        const customBtn = document.querySelector('#single-color-selector .custom-color-btn');
        if (customBtn) customBtn.classList.add('selected');
        if (window.currentConfig) { window.currentConfig.colorSingle = 'custom'; window.currentConfig.colorSingleName = 'Custom Color'; }
      } else if (target === 'interior') {
        document.querySelectorAll('.interior-color').forEach(o => o.classList.remove('selected'));
        const customBtn = document.querySelector('.interior-color.custom-color-btn');
        if (customBtn) customBtn.classList.add('selected');
        if (window.currentConfig) { window.currentConfig.colorInterior = 'custom'; window.currentConfig.colorInteriorName = 'Custom Color'; }
      } else if (target === 'exterior') {
        document.querySelectorAll('.exterior-color').forEach(o => o.classList.remove('selected'));
        const customBtn = document.querySelector('.exterior-color.custom-color-btn');
        if (customBtn) customBtn.classList.add('selected');
        if (window.currentConfig) { window.currentConfig.colorExterior = 'custom'; window.currentConfig.colorExteriorName = 'Custom Color'; }
      }
    };

    // RAL & F&B dropdown handlers
    document.querySelectorAll('.color-ral-dropdown, .color-fb-dropdown').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const hex = e.target.value;
        const target = e.target.dataset.target;
        if (!hex) return;
        switchToCustomSwatch(target);
        update3DColor(hex, target);
        // Reset the other dropdown in same row
        const row = e.target.closest('.color-dropdown-row');
        row.querySelectorAll('select').forEach(s => { if (s !== e.target) s.value = ''; });
        // Update preview text
        const text = e.target.options[e.target.selectedIndex].text;
        if (target === 'single') {
          document.getElementById('single-preview-name').textContent = text;
          document.getElementById('single-preview-ral').textContent = hex;
          if (window.currentConfig) {
            window.currentConfig.colorSingleName = text;
            window.currentConfig.colorType = 'single';
            window.currentConfig.colorSingle = 'custom';
          }
        } else if (target === 'interior') {
          document.getElementById('dual-preview-interior').textContent = text + ' (' + hex + ')';
          if (window.currentConfig) {
            window.currentConfig.colorInteriorName = text;
            window.currentConfig.colorType = 'dual';
          }
        } else if (target === 'exterior') {
          document.getElementById('dual-preview-exterior').textContent = text + ' (' + hex + ')';
          if (window.currentConfig) {
            window.currentConfig.colorExteriorName = text;
            window.currentConfig.colorType = 'dual';
          }
        }
        // Trigger price recalculation
        if (window.configuratorCore && window.configuratorCore.isInitialized) {
          window.configuratorCore.updateAll();
        }
      });
    });

    // RAL number input handlers
    const setupRalInput = (inputId, btnId, errorId, target) => {
      const input = document.getElementById(inputId);
      const btn = document.getElementById(btnId);
      const err = document.getElementById(errorId);
      if (!input || !btn) return;

      const applyRal = () => {
        const key = input.value.trim().replace(/^ral\s*/i, '');
        const hex = RAL[key];
        if (hex) {
          switchToCustomSwatch(target);
          update3DColor(hex, target);
          err.textContent = '';
          if (target === 'single') {
            document.getElementById('single-preview-name').textContent = 'RAL ' + key;
            document.getElementById('single-preview-ral').textContent = hex;
            if (window.currentConfig) { window.currentConfig.colorSingleName = 'RAL ' + key; window.currentConfig.colorSingle = 'custom'; window.currentConfig.colorType = 'single'; }
          } else if (target === 'interior') {
            document.getElementById('dual-preview-interior').textContent = 'RAL ' + key + ' (' + hex + ')';
            if (window.currentConfig) { window.currentConfig.colorInteriorName = 'RAL ' + key; window.currentConfig.colorType = 'dual'; }
          } else if (target === 'exterior') {
            document.getElementById('dual-preview-exterior').textContent = 'RAL ' + key + ' (' + hex + ')';
            if (window.currentConfig) { window.currentConfig.colorExteriorName = 'RAL ' + key; window.currentConfig.colorType = 'dual'; }
          }
          // Trigger price recalculation
          if (window.configuratorCore && window.configuratorCore.isInitialized) {
            window.configuratorCore.updateAll();
          }
        } else {
          err.textContent = 'Unknown RAL';
        }
      };
      btn.addEventListener('click', applyRal);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') applyRal(); });
    };

    setupRalInput('single-ral-input', 'single-ral-apply', 'single-ral-error', 'single');
    setupRalInput('int-ral-input', 'int-ral-apply', 'int-ral-error', 'interior');
    setupRalInput('ext-ral-input', 'ext-ral-apply', 'ext-ral-error', 'exterior');
  }

  setupFrostedOptions() {
    const frostedRadio = document.getElementById('frosted-glass');
    const clearRadio = document.getElementById('clear-glass');
    const frostedOptions = document.getElementById('frosted-options');

    if (frostedRadio && clearRadio && frostedOptions) {
      const updateFrosted3D = () => {
        if (typeof window.update3D !== 'function') return;
        if (clearRadio.checked) {
          window.update3D({ upperGlass: 'clear', lowerGlass: 'clear' });
        } else {
          const loc = document.querySelector('input[name="frosted-location"]:checked')?.value || 'bottom';
          window.update3D({
            upperGlass: loc === 'both' ? 'frosted' : 'clear',
            lowerGlass: 'frosted'
          });
        }
      };

      const toggleFrostedOptions = () => {
        frostedOptions.style.display = frostedRadio.checked ? 'block' : 'none';

        if (clearRadio.checked && window.currentConfig) {
          window.currentConfig.glassFinish = 'clear';
          window.currentConfig.frostedLocation = 'bottom';
          if (window.visualizationManager) {
            window.visualizationManager.updateFrostedGlass(window.currentConfig);
          }
        } else if (frostedRadio.checked && window.currentConfig) {
          window.currentConfig.glassFinish = 'frosted';
          const frostedLocationElement = document.querySelector('input[name="frosted-location"]:checked');
          window.currentConfig.frostedLocation = frostedLocationElement ? frostedLocationElement.value : 'bottom';
          if (window.visualizationManager) {
            window.visualizationManager.updateFrostedGlass(window.currentConfig);
          }
        }
        updateFrosted3D();
      };

      frostedRadio.addEventListener('change', toggleFrostedOptions);
      clearRadio.addEventListener('change', toggleFrostedOptions);

      const frostedLocationRadios = document.querySelectorAll('input[name="frosted-location"]');
      frostedLocationRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
          if (frostedRadio.checked && window.currentConfig) {
            window.currentConfig.frostedLocation = e.target.value;
            window.currentConfig.glassFinish = 'frosted';
            if (window.visualizationManager) {
              window.visualizationManager.updateFrostedGlass(window.currentConfig);
            }
          }
          updateFrosted3D();
        });
      });

      toggleFrostedOptions();
    }
  }

  applyDimensions() {
    const width = parseInt(document.getElementById('width').value);
    const height = parseInt(document.getElementById('height').value);
    const measurementType = document.querySelector('input[name="measurement-type"]:checked')?.value;

    // Calculate actual frame dimensions
    let frameWidth = width;
    let frameHeight = height;
    
    if (measurementType === 'brick-to-brick') {
      frameWidth = width + 150;
      frameHeight = height + 75;
    }

    // Update specification - ALWAYS show frame dimensions
    document.getElementById('spec-dimensions').style.display = 'block';
    document.getElementById('spec-width').textContent = `${frameWidth}mm`;
    document.getElementById('spec-height').textContent = `${frameHeight}mm`;
    document.getElementById('spec-measurement').textContent = measurementType === 'brick-to-brick' ? 'Structural Opening' : 'Frame Dimensions';

    // Update window type spec
    const sashTypeVal = document.querySelector('input[name="sash-type"]:checked')?.value || 'double';
    const splitRatioVal = document.getElementById('split-ratio')?.value || '1/4-1/2-1/4';
    const specWindowType = document.getElementById('spec-window-type');
    const specSashType = document.getElementById('spec-sash-type');
    const specSplitItem = document.getElementById('spec-split-ratio-item');
    const specSplitRatio = document.getElementById('spec-split-ratio');
    if (specWindowType) specWindowType.style.display = 'block';
    if (specSashType) specSashType.textContent = sashTypeVal === 'triple' ? 'Triple Sash (Fixed Side Panels)' : 'Double Hung Sash';
    if (specSplitItem) specSplitItem.style.display = sashTypeVal === 'triple' ? '' : 'none';
    if (specSplitRatio) specSplitRatio.textContent = splitRatioVal;

    // Remove old actual size element (nie potrzebujemy już dodatkowego)
    const oldActual = document.querySelector('.spec-item.actual-size');
    if (oldActual) oldActual.remove();

    // Update config with actual frame dimensions for price calculation
    if (window.currentConfig) {
      window.currentConfig.actualFrameWidth = frameWidth;
      window.currentConfig.actualFrameHeight = frameHeight;
      window.currentConfig.sashType = document.querySelector('input[name="sash-type"]:checked')?.value || 'double';
      window.currentConfig.splitRatio = document.getElementById('split-ratio')?.value || '1/4-1/2-1/4';
      
      // Trigger price recalculation
      if (window.configuratorCore && window.configuratorCore.isInitialized) {
        window.configuratorCore.updateAll();
      }
    }

    // Show success feedback
    this.showAppliedFeedback('apply-dimensions');

    // Update 3D visualizer
    if (typeof window.update3D === 'function') {
      const sashType = document.querySelector('input[name="sash-type"]:checked')?.value || 'double';
      const splitRatio = document.getElementById('split-ratio')?.value || '1/4-1/2-1/4';
      window.update3D({
        extWidth: frameWidth,
        extHeight: frameHeight,
        sashType: sashType,
        splitRatio: splitRatio
      });
    }
  }

  applyBars() {
    const upperBars = document.getElementById('upper-bars').value;
    const lowerBars = document.getElementById('lower-bars').value;
    const sameBars = document.getElementById('same-bars-both-sashes')?.checked;
    const customData = typeof window.getCustomBars === 'function' ? window.getCustomBars() : {};

    // Get bar names
    const barNames = {
      'none': 'No Bars',
      '2x2': '2x2 Pattern',
      '3x3': '3x3 Pattern',
      '4x4': '4x4 Pattern',
      '6x6': '6x6 Pattern',
      '9x9': '9x9 Pattern',
      'custom': 'Custom Design'
    };

    const effectiveLower = sameBars ? upperBars : lowerBars;

    // Update specification
    document.getElementById('spec-bars').style.display = 'block';
    document.getElementById('spec-upper-bars').textContent = barNames[upperBars] || upperBars;
    document.getElementById('spec-lower-bars').textContent = barNames[effectiveLower] || effectiveLower;
    
    // Custom bar details for spec
    this.renderBarDetails('spec-upper-bars-detail', customData.upperCustomBars || [], upperBars);
    this.renderBarDetails('spec-lower-bars-detail', customData.lowerCustomBars || [], effectiveLower);
    
    // ✅ AKTUALIZUJ window.currentConfig
    if (window.currentConfig) {
      window.currentConfig.upperBars = upperBars;
      window.currentConfig.lowerBars = effectiveLower;
      window.currentConfig.upperCustomBars = customData.upperCustomBars || [];
      window.currentConfig.lowerCustomBars = customData.lowerCustomBars || [];
      
      // Set customBars in format price calculator expects
      if (upperBars === 'custom' || effectiveLower === 'custom') {
        const upperList = customData.upperCustomBars || [];
        const lowerList = customData.lowerCustomBars || [];
        window.currentConfig.customBars = {
          upper: {
            horizontal: upperList.filter(b => b.type === 'horizontal' || b.type === 'h'),
            vertical: upperList.filter(b => b.type === 'vertical' || b.type === 'v')
          },
          lower: {
            horizontal: lowerList.filter(b => b.type === 'horizontal' || b.type === 'h'),
            vertical: lowerList.filter(b => b.type === 'vertical' || b.type === 'v')
          }
        };
      }
    }

    // ✅ UPDATE 3D visualizer
    if (typeof window.update3D === 'function') {
      window.update3D({
        upperBars: upperBars,
        lowerBars: effectiveLower,
        sameBars: sameBars,
        upperCustomBars: customData.upperCustomBars || [],
        lowerCustomBars: customData.lowerCustomBars || []
      });
    }

    this.showAppliedFeedback('apply-bars');
  }

  applyFixBars() {
    const fixUpperBars = document.getElementById('fix-upper-bars')?.value || 'none';
    const fixLowerBars = document.getElementById('fix-lower-bars')?.value || 'none';
    const sameFixBars = document.getElementById('same-fix-bars')?.checked;
    const customData = typeof window.getFixCustomBars === 'function' ? window.getFixCustomBars() : {};

    const barNames = {
      'none': 'No Bars', '2x2': '2x2 Pattern', '3x3': '3x3 Pattern',
      '4x4': '4x4 Pattern', '6x6': '6x6 Pattern', '9x9': '9x9 Pattern', 'custom': 'Custom Design'
    };

    const effectiveLower = sameFixBars ? fixUpperBars : fixLowerBars;

    // Update spec panel
    const specFixBars = document.getElementById('spec-fix-bars');
    if (specFixBars) {
      specFixBars.style.display = 'block';
      document.getElementById('spec-fix-upper-bars').textContent = barNames[fixUpperBars] || fixUpperBars;
      document.getElementById('spec-fix-lower-bars').textContent = barNames[effectiveLower] || effectiveLower;
    }

    // Update currentConfig
    if (window.currentConfig) {
      window.currentConfig.fixUpperBars = fixUpperBars;
      window.currentConfig.fixLowerBars = effectiveLower;
      window.currentConfig.fixUpperCustomBars = customData.fixUpperCustomBars || [];
      window.currentConfig.fixLowerCustomBars = customData.fixLowerCustomBars || [];

      if (window.configuratorCore && window.configuratorCore.isInitialized) {
        window.configuratorCore.updateAll();
      }
    }

    // Update 3D
    if (typeof window.update3D === 'function') {
      window.update3D({
        fixUpperBars: fixUpperBars,
        fixLowerBars: effectiveLower,
        fixUpperCustomBars: customData.fixUpperCustomBars || [],
        fixLowerCustomBars: customData.fixLowerCustomBars || []
      });
    }

    this.showAppliedFeedback('apply-fix-bars');
  }

  applyProductRange() {
    const sashType = document.querySelector('input[name="sash-type"]:checked')?.value || 'double';
    const splitRatio = document.getElementById('split-ratio')?.value || '1/4-1/2-1/4';
    const isTriple = sashType === 'triple';

    // Read current dimensions from inputs
    const frameWidth = parseInt(document.getElementById('width')?.value) || (isTriple ? 1500 : 1000);
    const frameHeight = parseInt(document.getElementById('height')?.value) || (isTriple ? 1200 : 1500);

    // Update currentConfig
    if (window.currentConfig) {
      window.currentConfig.sashType = sashType;
      window.currentConfig.splitRatio = splitRatio;
      window.currentConfig.actualFrameWidth = frameWidth;
      window.currentConfig.actualFrameHeight = frameHeight;
    }

    // Update 3D
    if (typeof window.update3D === 'function') {
      window.update3D({
        sashType: sashType,
        splitRatio: splitRatio,
        extWidth: frameWidth,
        extHeight: frameHeight
      });
    }

    // Update spec panel
    const specWindowType = document.getElementById('spec-window-type');
    const specSashType = document.getElementById('spec-sash-type');
    const specSplitItem = document.getElementById('spec-split-ratio-item');
    const specSplitRatio = document.getElementById('spec-split-ratio');
    if (specWindowType) specWindowType.style.display = 'block';
    if (specSashType) specSashType.textContent = isTriple ? 'Triple Sash' : 'Double Hung Sash';
    if (specSplitItem) specSplitItem.style.display = isTriple ? '' : 'none';
    if (specSplitRatio) specSplitRatio.textContent = splitRatio;

    // Trigger price recalculation
    if (window.configuratorCore && window.configuratorCore.isInitialized) {
      window.configuratorCore.updateAll();
    }

    this.showAppliedFeedback('apply-product-range');
  }

  applyFrame() {
    const frameType = document.querySelector('input[name="frame-type"]:checked')?.value;

    document.getElementById('spec-frame').style.display = 'block';
    document.getElementById('spec-frame-type').textContent = frameType === 'standard' ? 'Standard Frame (165mm)' : 'Slim Frame (145mm)';

    this.showAppliedFeedback('apply-frame');
  }

  applyHorns() {
    const val = document.querySelector('input[name="horn-type"]:checked')?.value;

    // Update currentConfig
    if (window.currentConfig) {
      window.currentConfig.horns = val || 'none';
    }

    // Update 3D
    if (typeof window.update3D === 'function') {
      if (val === 'none') {
        window.update3D({ showHorns: false });
      } else {
        window.update3D({ showHorns: true, hornType: val });
      }
    }

    // Update spec
    const hornsItem = document.getElementById('spec-horns-item');
    const hornsVal = document.getElementById('spec-horns');
    if (hornsItem && hornsVal) {
      hornsItem.style.display = 'flex';
      const names = { 'none': 'No Horns', 'A': 'Richmond', 'D': 'Type D' };
      hornsVal.textContent = names[val] || val;
    }

    this.showAppliedFeedback('apply-horns');
  }

  applyColor() {
    const colorType = document.querySelector('input[name="color-type"]:checked')?.value;

    document.getElementById('spec-color').style.display = 'block';

    if (colorType === 'single') {
      const selectedColor = document.querySelector('#single-color-selector .color-option.selected');
      if (selectedColor) {
        let name = selectedColor.dataset.name;
        const ral = selectedColor.dataset.ral;

        // If custom swatch but we have a real F&B/RAL name stored, use it
        if (name === 'Custom Color' && window.currentConfig && window.currentConfig.colorSingleName && window.currentConfig.colorSingleName !== 'Custom Color') {
          name = window.currentConfig.colorSingleName;
        }

        document.getElementById('spec-single-color').style.display = 'block';
        document.getElementById('spec-dual-color').style.display = 'none';
        document.getElementById('spec-color-name').textContent = name;
        document.getElementById('spec-color-ral').textContent = ral;
        
        // ✅ AKTUALIZUJ window.currentConfig
        if (window.currentConfig) {
          window.currentConfig.colorType = 'single';
          window.currentConfig.colorSingle = selectedColor.dataset.color; // data-color value
          window.currentConfig.colorSingleName = name; // display name
          window.currentConfig.colorInterior = null;
          window.currentConfig.colorExterior = null;
          window.currentConfig.customExteriorColor = null;
        }
      }
    } else {
      // Dual color
      const selectedInterior = document.querySelector('.interior-color.selected');
      const selectedExterior = document.querySelector('.exterior-color.selected');

      if (selectedInterior && selectedExterior) {
        let intName = selectedInterior.dataset.name;
        const intRal = selectedInterior.dataset.ral;
        let extName = selectedExterior.dataset.name;
        const extRal = selectedExterior.dataset.ral;

        // If custom swatch but we have real F&B/RAL names stored, use them
        if (intName === 'Custom Color' && window.currentConfig && window.currentConfig.colorInteriorName && window.currentConfig.colorInteriorName !== 'Custom Color') {
          intName = window.currentConfig.colorInteriorName;
        }
        if (extName === 'Custom Color' && window.currentConfig && window.currentConfig.colorExteriorName && window.currentConfig.colorExteriorName !== 'Custom Color') {
          extName = window.currentConfig.colorExteriorName;
        }

        document.getElementById('spec-single-color').style.display = 'none';
        document.getElementById('spec-dual-color').style.display = 'block';
        document.getElementById('spec-interior-color').textContent = `${intName} (${intRal})`;
        document.getElementById('spec-exterior-color').textContent = `${extName} (${extRal})`;
        
        // ✅ AKTUALIZUJ window.currentConfig
        if (window.currentConfig) {
          window.currentConfig.colorType = 'dual';
          window.currentConfig.colorSingle = null;
          window.currentConfig.colorInterior = selectedInterior.dataset.color; // data-color value
          window.currentConfig.colorInteriorName = intName; // display name
          window.currentConfig.colorExterior = selectedExterior.dataset.color; // data-color value  
          window.currentConfig.colorExteriorName = extName; // display name
          window.currentConfig.customExteriorColor = extName === 'Custom' ? extName : null;
        }
      }
    }

    // ✅ UPDATE 3D with color
    if (typeof window.update3D === 'function' && this._colorHexMap) {
      const cType = document.querySelector('input[name="color-type"]:checked')?.value;
      if (cType === 'single') {
        const sel = document.querySelector('#single-color-selector .color-option.selected');
        const hex = sel ? this._colorHexMap[sel.dataset.color] : null;
        if (hex) window.update3D({ woodColor: hex, sameColor: true });
      } else {
        const selInt = document.querySelector('.interior-color.selected');
        const selExt = document.querySelector('.exterior-color.selected');
        const hexInt = selInt ? this._colorHexMap[selInt.dataset.color] : null;
        const hexExt = selExt ? this._colorHexMap[selExt.dataset.color] : null;
        if (hexInt) window.update3D({ woodColorInt: hexInt, sameColor: false });
        if (hexExt) window.update3D({ woodColorExt: hexExt, sameColor: false });
      }
    }

    this.showAppliedFeedback('apply-color');
  }

  applyGlass() {
    const glassType = document.querySelector('input[name="glass-type"]:checked')?.value;
    const spacerColor = document.querySelector('input[name="spacer-color"]:checked')?.value || 'silver';

    const glassNames = {
      'double': 'Double Glazing (U-value: 1.4)',
      'triple': 'Triple Glazing (U-value: 1.2)',
      'passive': 'Passive Glass (U-value: 0.8)'
    };

    const spacerNames = {
      'silver': 'Silver (Stainless Steel)',
      'white': 'White',
      'black': 'Black'
    };

    document.getElementById('spec-glass').style.display = 'block';
    document.getElementById('spec-glass-type').textContent = glassNames[glassType] || glassType;
    document.getElementById('spec-spacer-color').textContent = spacerNames[spacerColor] || spacerColor;

    // ✅ Save to currentConfig
    if (window.currentConfig) {
      window.currentConfig.spacerColor = spacerColor;
    }

    // ✅ UPDATE 3D
    if (typeof window.update3D === 'function') {
      window.update3D({ spacerColor: spacerColor });
    }

    this.showAppliedFeedback('apply-glass');
  }

  applyOpening() {
    const openingType = document.querySelector('input[name="opening-type"]:checked')?.value;

    const openingNames = {
      'both': 'Both Sashes Open',
      'bottom': 'Bottom Sash Only',
      'fixed': 'Fixed Only (Non-opening)'
    };

    document.getElementById('spec-opening').style.display = 'block';
    document.getElementById('spec-opening-type').textContent = openingNames[openingType] || openingType;

    // Update opening indicators (old + new)
    this.updateOpeningIndicators(openingType);
    this.updateOpeningOverlay(openingType);

    // ✅ UPDATE 3D
    if (typeof window.update3D === 'function') {
      window.update3D({ openingType: openingType });
    }

    this.showAppliedFeedback('apply-opening');
  }

  updateOpeningIndicators(openingType) {
    if (window.visualizationManager && window.visualizationManager.updateOpeningIndicators) {
      window.visualizationManager.updateOpeningIndicators(openingType);
    }
  }

  updateOpeningOverlay(openingType) {
    const overlay = document.getElementById('opening-overlay');
    const upper = document.getElementById('opening-upper');
    const lower = document.getElementById('opening-lower');
    if (!overlay || !upper || !lower) return;

    overlay.style.display = 'block';

    if (openingType === 'both') {
      upper.className = 'opening-indicator arrow';
      upper.textContent = '↕';
      lower.className = 'opening-indicator arrow';
      lower.textContent = '↕';
    } else if (openingType === 'bottom') {
      upper.className = 'opening-indicator cross';
      upper.textContent = '✕';
      lower.className = 'opening-indicator arrow';
      lower.textContent = '↕';
    } else if (openingType === 'fixed') {
      upper.className = 'opening-indicator cross';
      upper.textContent = '✕';
      lower.className = 'opening-indicator cross';
      lower.textContent = '✕';
    }

    // Auto-hide after 3 seconds
    clearTimeout(this._overlayTimeout);
    this._overlayTimeout = setTimeout(() => {
      overlay.style.display = 'none';
    }, 3000);
  }

  applyPAS24() {
    const pas24 = document.querySelector('input[name="pas24"]:checked')?.value;

    document.getElementById('spec-pas24').style.display = 'block';
    document.getElementById('spec-pas24-value').textContent = pas24 === 'yes' ? 'Yes - PAS 24 Compliant' : 'No - Standard Security';

    this.showAppliedFeedback('apply-pas24');
  }

  applyDetails() {
    // NOWY SYSTEM - pobierz z Gallery - POPRAWKA: window.currentConfig
    console.log('📋 applyDetails START - window.currentConfig:', window.currentConfig);
    const gallerySelection = window.currentConfig?.ironmongery || {};
    
    console.log('📋 applyDetails - Gallery selection:', gallerySelection);

    document.getElementById('spec-details').style.display = 'block';

    // Zbierz wszystkie wybrane produkty z Gallery (z quantity)
    const selectedProducts = [];
    
    if (gallerySelection.lock) selectedProducts.push({...gallerySelection.lock, category: 'Lock'});
    if (gallerySelection.fingerLift) selectedProducts.push({...gallerySelection.fingerLift, category: 'Lift'});
    if (gallerySelection.pullHandles) selectedProducts.push({...gallerySelection.pullHandles, category: 'Handle'});
    if (gallerySelection.stoppers) selectedProducts.push({...gallerySelection.stoppers, category: 'Stopper'});
    if (gallerySelection.horns) selectedProducts.push({...gallerySelection.horns, category: 'Horns'});

    const hasIronmongery = selectedProducts.length > 0;
    
    console.log('📋 Selected products:', selectedProducts.length, selectedProducts);

    // Ironmongery - wyświetl listę produktów z Gallery + QUANTITY
    if (hasIronmongery) {
      document.getElementById('spec-ironmongery-item').style.display = 'flex';
      const productNames = selectedProducts
        .map(product => {
          const qty = product.quantity || 1;
          return qty > 1 ? `${qty}x ${product.name}` : product.name;
        })
        .join(', ');
      document.getElementById('spec-ironmongery').textContent = productNames;
      console.log('✅ Ironmongery displayed:', productNames);
      
      // MINIATURKI - generuj obrazki w specification
      const thumbnailsContainer = document.getElementById('spec-ironmongery-thumbnails');
      if (thumbnailsContainer) {
        thumbnailsContainer.style.display = 'block';
        const thumbnailsGrid = thumbnailsContainer.querySelector('div');
        thumbnailsGrid.innerHTML = selectedProducts.map(product => {
          const imgSrc = product.image_url || 'images/placeholder.png';
          const qty = product.quantity || 1;
          return `
            <div style="position: relative; width: 45px; height: 45px;">
              <img src="${imgSrc}" 
                   alt="${product.name}" 
                   title="${product.name}"
                   style="width: 45px; height: 45px; object-fit: cover; border-radius: 4px; border: 1px solid #ddd;">
              ${qty > 1 ? `<span style="position: absolute; top: -5px; right: -5px; background: var(--primary-color); color: white; font-size: 10px; padding: 1px 4px; border-radius: 50%; font-weight: bold;">${qty}</span>` : ''}
            </div>
          `;
        }).join('');
      }
    } else {
      document.getElementById('spec-ironmongery-item').style.display = 'none';
      document.getElementById('spec-details').style.display = 'none';
      const thumbnailsContainer = document.getElementById('spec-ironmongery-thumbnails');
      if (thumbnailsContainer) {
        thumbnailsContainer.style.display = 'none';
      }
      console.log('❌ No ironmongery to display');
    }

    this.showAppliedFeedback('apply-details');
  }

  applyGlassSpec() {
    const glassSpec = document.querySelector('input[name="glass-spec"]:checked')?.value;
    const glassFinish = document.querySelector('input[name="glass-finish"]:checked')?.value;

    // Pobierz frosted location tylko gdy frosted jest wybrane
    let frostedLocation = 'bottom'; // domyślnie bottom
    if (glassFinish === 'frosted') {
      const frostedLocationElement = document.querySelector('input[name="frosted-location"]:checked');
      if (frostedLocationElement) {
        frostedLocation = frostedLocationElement.value;
      }
    }

    document.getElementById('spec-glass-spec').style.display = 'block';
    document.getElementById('spec-glass-spec-type').textContent = glassSpec === 'toughened' ? 'Toughened' : 'Laminated';

    // Update glass finish display
    let finishText = glassFinish === 'clear' ? 'Clear' : 'Frosted';
    if (glassFinish === 'frosted' && frostedLocation === 'both') {
      finishText = 'Frosted (Both Sashes)';
    } else if (glassFinish === 'frosted') {
      finishText = 'Frosted (Bottom Only)';
    }
    document.getElementById('spec-glass-finish').textContent = finishText;

    // Update configuration
    if (window.currentConfig) {
      window.currentConfig.glassSpec = glassSpec;
      window.currentConfig.glassFinish = glassFinish;
      window.currentConfig.frostedLocation = frostedLocation;

      if (window.visualizationManager) {
        window.visualizationManager.updateFrostedGlass(window.currentConfig);
      }

      if (window.configuratorCore && window.configuratorCore.isInitialized) {
        window.configuratorCore.updateAll();
      }
    }

    // ✅ UPDATE 3D
    if (typeof window.update3D === 'function') {
      if (glassFinish === 'clear') {
        window.update3D({ upperGlass: 'clear', lowerGlass: 'clear' });
      } else {
        window.update3D({
          upperGlass: frostedLocation === 'both' ? 'frosted' : 'clear',
          lowerGlass: 'frosted'
        });
      }
    }

    this.showAppliedFeedback('apply-glass-spec');
  }

  renderBarDetails(containerId, bars, barType) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (barType !== 'custom' || !bars || bars.length === 0) {
      container.style.display = 'none';
      container.innerHTML = '';
      return;
    }

    const vBars = bars.filter(b => b.type === 'v');
    const hBars = bars.filter(b => b.type === 'h');

    let html = '';
    bars.forEach(b => {
      if (b.type === 'v') {
        const idx = vBars.indexOf(b);
        const from = idx === 0 ? 'from right' : 'from left';
        html += `<div class="spec-item spec-detail"><span class="spec-label">↕ Vertical</span><span class="spec-value">${b.mm}mm ${from}</span></div>`;
      } else {
        const idx = hBars.indexOf(b);
        const from = idx === 0 ? 'from bottom' : 'from top';
        html += `<div class="spec-item spec-detail"><span class="spec-label">↔ Horizontal</span><span class="spec-value">${b.mm}mm ${from}</span></div>`;
      }
    });

    container.innerHTML = html;
    container.style.display = 'block';
  }

  formatName(name) {
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  showAppliedFeedback(buttonId) {
    const button = document.getElementById(buttonId);
    if (!button) return;

    const originalText = button.textContent;
    button.textContent = '✓ Applied';
    button.classList.add('applied');

    // AUTO-SAVE przy każdym Apply
    if (window.currentConfig) {
      localStorage.setItem('lastWindowConfig', JSON.stringify(window.currentConfig));
      console.log('💾 Auto-saved after', buttonId);
    }

    // AUTO-SWITCH to next category after last Apply in each section
    // dim-design: dimensions → bars → frame → horns → GLASS
    // glass: glass → glass-spec → OPENING
    // opening: opening → pas24 → COLOUR
    // colour: color → HARDWARE
    const nextCategory = {
      'apply-horns': 'glass',
      'apply-glass-spec': 'opening',
      'apply-pas24': 'colour',
      'apply-color': 'hardware',
      'apply-details': 'finalise'
    };

    const next = nextCategory[buttonId];
    if (next && typeof window.showCategory === 'function') {
      setTimeout(() => {
        window.showCategory(next);
        // Highlight the next tab briefly
        const nextBtn = document.querySelector(`.cat-btn[data-target="${next}"]`);
        if (nextBtn) {
          nextBtn.classList.add('next-step');
          setTimeout(() => nextBtn.classList.remove('next-step'), 2000);
        }
        // Scroll to top of configurator
        const configPanel = document.querySelector('.config-panel');
        if (configPanel) configPanel.scrollTop = 0;
      }, 600);
    }
  }
}

// Initialize
window.specificationController = new SpecificationController();