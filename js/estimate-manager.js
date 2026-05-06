// estimate-manager.js - Zarządzanie wycenami według nowej logiki

class EstimateManager {
    constructor() {
        this.currentEstimate = null; // Aktualna wycena
        this.currentCustomer = null; // Zalogowany klient
        this.editMode = false;       // Edit mode flag
        this.editItemId = null;      // Item being edited
        this.editEstimateId = null;  // Estimate of item being edited
        this.init();
    }

    async init() {
        // Pobierz zalogowanego użytkownika
        const user = await getCurrentUser();
        if (user) {
            await this.loadCustomer(user.id);
            // NIE ładujemy automatycznie draft - użytkownik wybiera z dropdowna!
        }

        // Inicjalizuj przyciski
        this.initializeButtons();

        // Check if we're in edit mode (URL params)
        this.checkEditMode();
    }

    // Pobierz dane klienta
    async loadCustomer(userId) {
        try {
            const { data, error } = await supabaseClient
                .from('customers')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error) throw error;

            this.currentCustomer = data;
            console.log('Customer loaded:', data.customer_code);
        } catch (error) {
            console.error('Error loading customer:', error);
        }
    }

    // STARA FUNKCJA - nie używana z nowym systemem dropdowna
    // Zostawiona dla kompatybilności wstecznej
    /*
    async loadOrCreateDraftEstimate() {
        try {
            // Sprawdź czy jest już draft
            const { data: drafts, error: draftError } = await supabaseClient
                .from('estimates')
                .select('*')
                .eq('customer_id', this.currentCustomer.id)
                .eq('status', 'draft')
                .order('created_at', { ascending: false })
                .limit(1);

            if (draftError) throw draftError;

            if (drafts && drafts.length > 0) {
                // Mamy już draft - użyj go
                this.currentEstimate = drafts[0];
                console.log('Using existing draft:', this.currentEstimate.estimate_number);
            } else {
                // Nie ma draftu - pytaj czy utworzyć nowy
                console.log('No draft estimate found. User needs to create one.');
                this.currentEstimate = null;
            }

            this.updateUI();
        } catch (error) {
            console.error('Error loading draft estimate:', error);
        }
    }
    */

    // Utwórz nową wycenę
    async createNewEstimate(projectName, deliveryAddress) {
        try {
            if (!this.currentCustomer) {
                throw new Error('Customer not loaded');
            }

            // Pobierz nowy estimate_number z funkcji SQL
            const { data: numberData, error: numberError } = await supabaseClient
                .rpc('generate_estimate_number', { 
                    cust_id: this.currentCustomer.id 
                });

            if (numberError) throw numberError;

            const estimateNumber = numberData;
            const validUntil = new Date();
            validUntil.setDate(validUntil.getDate() + 30); // 30 dni ważności

            // Utwórz estimate
            const { data: estimate, error: estimateError } = await supabaseClient
                .from('estimates')
                .insert([{
                    estimate_number: estimateNumber,
                    customer_id: this.currentCustomer.id,
                    project_name: projectName,
                    delivery_address: deliveryAddress,
                    status: 'draft',
                    valid_until: validUntil.toISOString().split('T')[0]
                }])
                .select()
                .single();

            if (estimateError) throw estimateError;

            this.currentEstimate = estimate;
            console.log('New estimate created:', estimateNumber);

            this.updateUI();
            this.showToast(`✅ New estimate created: ${estimateNumber}`, 'success');

            return estimate;
        } catch (error) {
            console.error('Error creating estimate:', error);
            this.showToast('❌ Error creating estimate', 'error');
            throw error;
        }
    }

    // Dodaj okno do wyceny
    async addWindowToEstimate(windowConfig, price, estimateId = null) {
        try {
            // SPRAWDŹ CZY ZALOGOWANY
            const user = await getCurrentUser();
            
            if (!user) {
                // NIEZALOGOWANY - zapisz do localStorage
                this.saveToLocalStorage(windowConfig, price);
                return;
            }
            
            // ZALOGOWANY - użyj przekazanego estimateId lub currentEstimate
            const targetEstimateId = estimateId || this.currentEstimate?.id;
            
            if (!targetEstimateId) {
                // Nie ma estimate - to nie powinno się zdarzyć
                alert('Please select or create an estimate first');
                return;
            }

            // Pobierz wszystkie window_numbers w tej wycenie
            const { data: items, error: countError } = await supabaseClient
                .from('estimate_items')
                .select('window_number')
                .eq('estimate_id', targetEstimateId);

            if (countError) throw countError;

            // Sprawdź czy użytkownik podał custom nazwę
            const isDoor = windowConfig && windowConfig.windowCategory === 'door';
            const customNameInput = isDoor ? document.getElementById('d-custom-name') : document.getElementById('window-custom-name');
            let windowNumber = (windowConfig && windowConfig.windowName) || (customNameInput ? customNameInput.value.trim() : '');
            const prefix = isDoor ? 'D' : 'W';

            // Jeśli nie ma custom nazwy, wygeneruj automatyczną (W1, W2... lub D1, D2...)
            if (!windowNumber) {
                windowNumber = prefix + '1';
                if (items && items.length > 0) {
                    // Wyciągnij numery tylko z okien o formacie W[number] lub D[number]
                    const re = new RegExp('^' + prefix + '\\d+$');
                    const numbers = items
                        .filter(item => re.test(item.window_number))
                        .map(item => parseInt(item.window_number.substring(prefix.length)))
                        .filter(n => !isNaN(n));
                    
                    if (numbers.length > 0) {
                        const maxNumber = Math.max(...numbers);
                        windowNumber = `${prefix}${maxNumber + 1}`;
                    }
                }
            }

            console.log('Window number:', windowNumber);

            // Wyczyść pole custom name po użyciu
            if (customNameInput) {
                customNameInput.value = '';
            }

            // 📸 Capture 3D screenshot before saving to DB
            if (typeof window.captureWindowScreenshots === 'function') {
                try {
                    const screenshots = await window.captureWindowScreenshots();
                    if (screenshots) {
                        windowConfig.screenshots = screenshots;
                        if (windowConfig.fullConfig) {
                            windowConfig.fullConfig.screenshots = screenshots;
                        }
                        console.log('📸 Screenshot captured for DB');
                    }
                } catch(e) {
                    console.warn('Screenshot capture failed:', e);
                }
            }

            // Zapisz okno
            const { data: item, error: itemError } = await supabaseClient
                .from('estimate_items')
                .insert([{
                    estimate_id: targetEstimateId,
                    window_number: windowNumber,
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
                    frosted_location: windowConfig.glassFinish === 'frosted' ? (windowConfig.frostedLocation || windowConfig.fullConfig?.frostedLocation || null) : null,
                    
                    opening_type: windowConfig.openingType,
                    
                    // Color — pull from fullConfig when direct fields are "custom" or null
                    color_type: windowConfig.colorType,
                    color_single: (() => {
                        const fc = windowConfig.fullConfig || {};
                        if (windowConfig.colorType === 'single') {
                            // Use colorSingleName if available, otherwise singleColor from fullConfig
                            return fc.colorSingleName || fc.singleColor || windowConfig.colorSingle || 'white';
                        }
                        return windowConfig.colorSingle;
                    })(),
                    color_interior: (() => {
                        const fc = windowConfig.fullConfig || {};
                        return windowConfig.colorInterior || fc.interiorColor || fc.colorInterior || null;
                    })(),
                    color_exterior: (() => {
                        const fc = windowConfig.fullConfig || {};
                        return windowConfig.colorExterior || fc.exteriorColor || fc.colorExterior || null;
                    })(),
                    custom_exterior_color: windowConfig.customExteriorColor || windowConfig.fullConfig?.customExteriorColor || null,
                    
                    upper_bars: windowConfig.upperBars || null,
                    lower_bars: windowConfig.lowerBars || null,
                    
                    // Horns — fullConfig stores "none" while windowConfig stores null
                    horns: (() => {
                        const h = windowConfig.horns || windowConfig.fullConfig?.horns || 'none';
                        return h === 'none' ? null : h;
                    })(),
                    
                    // Ironmongery — pull from fullConfig when direct field is null
                    ironmongery: (() => {
                        const iron = windowConfig.ironmongery || windowConfig.fullConfig?.ironmongery || null;
                        if (!iron) return null;
                        return typeof iron === 'string' ? iron : JSON.stringify(iron);
                    })(),
                    
                    // Ironmongery finish — derive from ironmongery products
                    ironmongery_finish: (() => {
                        if (windowConfig.ironmongeryFinish) return windowConfig.ironmongeryFinish;
                        const iron = windowConfig.fullConfig?.ironmongery;
                        if (iron) {
                            // Get finish from first product that has a color
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
                }])
                .select()
                .single();

            if (itemError) throw itemError;

            console.log('Window added:', windowNumber);

            // Google Ads conversion tracking
            if (typeof gtag === 'function') {
                gtag('event', 'conversion', {
                    'send_to': 'AW-3481705735/submit_lead_form',
                });
                console.log('📊 Google Ads conversion tracked');
            }
            
            // Pobierz nazwę estimate dla wiadomości
            const { data: estimate } = await supabaseClient
                .from('estimates')
                .select('estimate_number, project_name')
                .eq('id', targetEstimateId)
                .single();
            
            if (estimate) {
                this.showToast(`✅ ${windowNumber} added to ${estimate.estimate_number} (${estimate.project_name})`, 'success');
            }
            
            // Reset sekwencji apply buttons dla następnego okna
            if (window.configuratorCore && window.configuratorCore.resetApplySequence) {
                window.configuratorCore.resetApplySequence();
                console.log('🔄 Apply sequence reset for new window');
            }

            // Odśwież estimate selector żeby pokazać zaktualizowaną liczbę okien
            if (window.estimateSelectorManager) {
                await window.estimateSelectorManager.loadEstimates();
            }

            // Przelicz sumę estimate
            await this.recalculateEstimateTotal(targetEstimateId);

            return item;
        } catch (error) {
            console.error('Error adding window:', error);
            this.showToast('❌ Error adding window', 'error');
            throw error;
        }
    }

    // Przelicz sumę estimate na podstawie wszystkich okien
    async recalculateEstimateTotal(estimateId) {
        try {
            const { data: items, error } = await supabaseClient
                .from('estimate_items')
                .select('total_price')
                .eq('estimate_id', estimateId);
            
            if (error) throw error;
            
            const total = (items || []).reduce((sum, item) => sum + (parseFloat(item.total_price) || 0), 0);
            
            await supabaseClient
                .from('estimates')
                .update({ total_price: total })
                .eq('id', estimateId);
            
            console.log('Estimate total updated: £' + total.toFixed(2));
        } catch (e) {
            console.warn('Could not recalculate estimate total:', e.message);
        }
    }

    // Odśwież aktualną wycenę
    async refreshCurrentEstimate() {
        if (!this.currentEstimate) return;

        try {
            const { data, error } = await supabaseClient
                .from('estimates')
                .select('*')
                .eq('id', this.currentEstimate.id)
                .single();

            if (error) throw error;

            this.currentEstimate = data;
            this.updateUI();
        } catch (error) {
            console.error('Error refreshing estimate:', error);
        }
    }

    // Pokaż modal tworzenia nowej wyceny (używa tego samego modala co estimate-selector)
    showCreateEstimateModal() {
        const modal = document.getElementById('new-estimate-modal');
        if (modal) {
            // Clear form
            const projectNameInput = document.getElementById('new-estimate-project-name');
            const addressInput = document.getElementById('new-estimate-address');
            const notesInput = document.getElementById('new-estimate-notes');
            
            if (projectNameInput) projectNameInput.value = '';
            if (addressInput) addressInput.value = '';
            if (notesInput) notesInput.value = '';
            
            modal.style.display = 'block';
        }
    }

    // Zamknij modal
    closeCreateEstimateModal() {
        const modal = document.getElementById('new-estimate-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // Inicjalizuj przyciski
    initializeButtons() {
        // Przycisk "Add to Estimate" / "Update Window" (edit mode)
        const addBtn = document.getElementById('add-to-estimate');
        if (addBtn) {
            addBtn.addEventListener('click', async () => {
                // ── EDIT MODE: Update existing window ──
                if (this.editMode && this.editItemId) {
                    const windowConfig = this.getCurrentWindowConfig();
                    const price = this.getCurrentPrice();
                    await this.updateWindowInEstimate(this.editItemId, this.editEstimateId, windowConfig, price);
                    return;
                }

                // ── NORMAL MODE: Add new window ──
                if (window.estimateSelectorManager) {
                    const isNew = window.estimateSelectorManager.selectedEstimateId === 'new';
                    const estimateId = await window.estimateSelectorManager.getOrCreateEstimate();
                    if (!estimateId) {
                        console.log('No estimate selected or creation cancelled');
                        return;
                    }

                    if (isNew) {
                        console.log('New estimate created — waiting for user to configure window first');
                        return;
                    }

                    const windowConfig = this.getCurrentWindowConfig();
                    const price = this.getCurrentPrice();
                    await this.addWindowToEstimate(windowConfig, price, estimateId);
                } else {
                    const windowConfig = this.getCurrentWindowConfig();
                    const price = this.getCurrentPrice();
                    await this.addWindowToEstimate(windowConfig, price);
                }
            });
        }

        // Przycisk "Add Door to Estimate"
        const doorAddBtn = document.getElementById('d-add-to-estimate');
        if (doorAddBtn) {
            doorAddBtn.addEventListener('click', async () => {
                // ── EDIT MODE: Update existing door ──
                if (this.editMode && this.editItemId) {
                    const doorConfig = window.getDoorConfig ? window.getDoorConfig() : this.getCurrentWindowConfig();
                    doorConfig.windowCategory = 'door';
                    doorConfig.windowName = document.getElementById('d-custom-name')?.value || '';
                    doorConfig.quantity = parseInt(document.getElementById('d-quantity')?.value) || 1;
                    doorConfig.notes = document.getElementById('d-notes')?.value || '';
                    const price = this.getCurrentPrice();
                    await this.updateWindowInEstimate(this.editItemId, this.editEstimateId, doorConfig, price);
                    return;
                }

                // ── NORMAL MODE ──
                if (window.estimateSelectorManager) {
                    const isNew = window.estimateSelectorManager.selectedEstimateId === 'new';
                    const estimateId = await window.estimateSelectorManager.getOrCreateEstimate();
                    if (!estimateId) {
                        console.log('No estimate selected or creation cancelled');
                        return;
                    }

                    if (isNew) {
                        console.log('New estimate created — waiting for user to configure door first');
                        return;
                    }

                    // Use door config
                    const doorConfig = window.getDoorConfig ? window.getDoorConfig() : this.getCurrentWindowConfig();
                    doorConfig.windowCategory = 'door';
                    doorConfig.windowName = document.getElementById('d-custom-name')?.value || '';
                    doorConfig.quantity = parseInt(document.getElementById('d-quantity')?.value) || 1;
                    doorConfig.notes = document.getElementById('d-notes')?.value || '';
                    const price = this.getCurrentPrice();
                    await this.addWindowToEstimate(doorConfig, price, estimateId);
                }
            });
        }

        // Przycisk "Create New Estimate" (original)
        const createBtn = document.getElementById('create-new-estimate-btn');
        if (createBtn) {
            createBtn.addEventListener('click', () => {
                this.showCreateEstimateModal();
            });
        }

        // Przycisk "View My Estimates"
        const viewBtn = document.getElementById('view-my-estimates');
        const dViewBtn = document.getElementById('d-view-estimates');
        [viewBtn, dViewBtn].forEach(btn => {
            if (!btn) return;
            btn.addEventListener('click', async () => {
                const user = await getCurrentUser();
                
                if (user) {
                    window.location.href = 'customer-dashboard.html';
                } else {
                    const savedEstimates = JSON.parse(localStorage.getItem('windowEstimates') || '[]');
                    
                    if (savedEstimates.length > 0) {
                        if (confirm(`You have ${savedEstimates.length} window(s) saved locally.\n\nLogin to sync your estimates and access full features?`)) {
                            localStorage.setItem('redirect_after_login', 'customer-dashboard.html');
                            window.location.href = 'login.html';
                        }
                    } else {
                        if (confirm('Login to create and manage your estimates?')) {
                            localStorage.setItem('redirect_after_login', 'customer-dashboard.html');
                            window.location.href = 'login.html';
                        }
                    }
                }
            });
        });

        // Przycisk "Preview Estimate" — modal z podglądem
        const previewBtn = document.getElementById('preview-estimate');
        const dPreviewBtn = document.getElementById('d-preview-estimate');
        [previewBtn, dPreviewBtn].forEach(btn => {
            if (!btn) return;
            btn.addEventListener('click', async () => {
                const user = await getCurrentUser();
                if (!user) {
                    if (confirm('Login to preview your estimates?')) {
                        localStorage.setItem('redirect_after_login', 'online-estimate.html');
                        window.location.href = 'login.html';
                    }
                    return;
                }

                // Get estimate ID from selector dropdown or currentEstimate
                const selectorEl = document.getElementById('estimate-selector');
                const estimateId = this.currentEstimate?.id 
                    || (window.estimateSelectorManager && window.estimateSelectorManager.selectedEstimateId)
                    || (selectorEl && selectorEl.value);

                if (!estimateId) {
                    alert('No estimate selected. Please create or select an estimate first.');
                    return;
                }

                try {
                    // Load full estimate data from DB
                    const { data, error } = await supabaseClient
                        .from('estimates')
                        .select(`
                            *,
                            estimate_items (*),
                            customers (full_name, company_name, email, phone, customer_code)
                        `)
                        .eq('id', estimateId)
                        .single();

                    if (error) throw error;

                    // Load extras
                    try {
                        data.extras = await EstimateExtras.load(estimateId);
                    } catch (extErr) {
                        data.extras = [];
                    }

                    // Render in modal
                    const modal = document.getElementById('estimate-preview-modal');
                    const content = document.getElementById('estimate-preview-content');
                    const isEditable = ['draft', 'sent', 'quoted'].includes(data.status);

                    content.innerHTML = EstimateRenderer.renderEstimateHTML(data, {
                        isEditable,
                        isAdmin: false
                    });

                    modal.style.display = 'flex';
                    EstimateRenderer.attachExportButtons(data);

                    // After delete/rename — re-render modal and update selector
                    window.dashboard = {
                        viewOrderDetails: async (estimateId) => {
                            // Reload and re-render
                            const { data: fresh } = await supabaseClient
                                .from('estimates')
                                .select('*, estimate_items (*), customers (full_name, company_name, email, phone, customer_code)')
                                .eq('id', estimateId)
                                .single();
                            if (fresh) {
                                try { fresh.extras = await EstimateExtras.load(estimateId); } catch(e) { fresh.extras = []; }
                                content.innerHTML = EstimateRenderer.renderEstimateHTML(fresh, { isEditable: ['draft','sent','quoted'].includes(fresh.status), isAdmin: false });
                                EstimateRenderer.attachExportButtons(fresh);
                            }
                        },
                        closeModal: () => { modal.style.display = 'none'; },
                        loadEstimates: async () => { if (window.estimateSelectorManager) await window.estimateSelectorManager.loadEstimates(); },
                        renameWindow: async (itemId, currentName, estimateId) => {
                            const newName = prompt('Enter new window name:', currentName);
                            if (!newName || newName.trim() === '' || newName.trim() === currentName) return;
                            try {
                                const { error } = await supabaseClient.from('estimate_items').update({ window_number: newName.trim() }).eq('id', itemId);
                                if (error) throw error;
                                await window.dashboard.viewOrderDetails(estimateId);
                            } catch (e) {
                                console.error('Rename error:', e);
                                alert('Failed to rename window.');
                            }
                        }
                    };

                } catch (err) {
                    console.error('Preview estimate error:', err);
                    alert('Failed to load estimate preview.');
                }
            });
        });
            
            // Zaktualizuj licznik przy inicjalizacji
            this.updateLocalStorageCounter();

        // Zamknięcie modala - teraz obsługiwane przez HTML onclick
        // (new-estimate-modal ma już onclick na przycisku close)
    }

    // Pobierz aktualną konfigurację okna
    getCurrentWindowConfig() {
        // Użyj window.currentConfig który ma WSZYSTKIE dane ze specyfikacji
        if (window.currentConfig) {
            const cfg = window.currentConfig;
            const isCasement = cfg.windowType === 'casement' || cfg.windowCategory === 'casement';
            const isFixOnly = cfg.windowType === 'fix-only';

            return {
                // Window type
                windowType: isFixOnly ? 'fix-only' : isCasement ? 'casement' : 'sash',

                // Wymiary - ZAWSZE wymiar okna (nie brick-to-brick)
                width: cfg.actualFrameWidth || cfg.width,
                height: cfg.actualFrameHeight || cfg.height,
                
                // Informacja o pomiarze (do wyświetlenia)
                measurementType: cfg.measurementType,
                originalWidth: cfg.width,
                originalHeight: cfg.height,
                
                // Typ ramy (casement nie ma frameType)
                frameType: isCasement ? null : cfg.frameType,

                // Casement-specific
                casementLayout: isCasement ? (cfg.casementLayout || cfg.layout || '040L') : null,
                sillExtension: isCasement ? (cfg.sillExtension || 'none') : null,
                trickleVent: isCasement ? (cfg.trickleVent || 'none') : null,
                sealColour: isCasement ? (cfg.sealColour || 'black') : null,
                safetyGlass: isCasement ? (cfg.safetyGlass || 'none') : null,
                
                // Szkło
                glassType: cfg.glassType,
                glassSpec: cfg.glassSpec,
                glassFinish: cfg.glassFinish,
                frostedLocation: cfg.frostedLocation,
                spacerColor: cfg.spacerColor || cfg.spacer || 'silver',
                
                // Opening (sash only)
                openingType: isCasement ? null : cfg.openingType,
                
                // Kolory
                colorType: cfg.colorType || cfg.colourMode || 'single',
                colorSingle: cfg.colorSingle,
                colorInterior: cfg.colorInterior || cfg.colorInteriorName,
                colorExterior: cfg.colorExterior || cfg.colorExteriorName,
                customExteriorColor: cfg.customExteriorColor,
                
                // Bary
                upperBars: isCasement ? (cfg.hBars || cfg.casementHBars || null) : (cfg.upperBars || null),
                lowerBars: isCasement ? (cfg.vBars || cfg.casementVBars || null) : (cfg.lowerBars || null),
                
                // Detale (horns są w ironmongery)
                horns: null,
                
                // Ironmongery
                ironmongery: window.ConfiguratorCore?.currentWindow?.ironmongery || null,
                ironmongeryFinish: null,
                
                // PAS24
                pas24: cfg.pas24,
                
                // Quantity
                quantity: cfg.quantity || 1,
                
                // FULL BACKUP - cała konfiguracja
                fullConfig: { ...cfg }
            };
        }

        // Fallback - jeśli window.currentConfig nie istnieje
        console.warn('window.currentConfig not found - using fallback');
        return null;
    }

    // Pobierz aktualną cenę
    getCurrentPrice() {
        const priceText = document.getElementById('sidebar-total-price')?.textContent || '0';
        // Usuń £ i inne znaki nie-numeryczne (oprócz kropki)
        const cleanPrice = priceText.replace(/[^0-9.]/g, '');
        const totalPrice = parseFloat(cleanPrice) || 0;
        const quantity = parseInt(document.getElementById('window-quantity')?.value) || 1;
        const unitPrice = quantity > 1 ? totalPrice / quantity : totalPrice;

        return {
            unitPrice: unitPrice,
            totalPrice: totalPrice
        };
    }

    // Aktualizuj UI
    updateUI() {
        // Pokaż aktualną wycenę w nagłówku (jeśli istnieje element)
        const estimateInfo = document.getElementById('current-estimate-info');
        if (estimateInfo && this.currentEstimate) {
            estimateInfo.innerHTML = `
                <strong>Current Estimate:</strong> ${this.currentEstimate.estimate_number} 
                - ${this.currentEstimate.project_name}
                <span style="color: #666; margin-left: 10px;">Total: £${this.currentEstimate.total_price || 0}</span>
            `;
            estimateInfo.style.display = 'block';
        }
        
        // NIE zmieniamy button text - zarządza nim estimate-selector.js
    }

    // Toast notifications
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.textContent = message;

        switch (type) {
            case 'success':
                toast.style.background = '#10b981';
                break;
            case 'error':
                toast.style.background = '#ef4444';
                break;
            case 'warning':
                toast.style.background = '#f59e0b';
                break;
            default:
                toast.style.background = '#3b82f6';
        }

        Object.assign(toast.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '15px 20px',
            color: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: '10000',
            fontSize: '14px',
            fontWeight: '500',
            animation: 'slideInRight 0.3s ease-out'
        });

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Zapisz do localStorage (dla niezalogowanych użytkowników)
    saveToLocalStorage(windowConfig, price) {
        try {
            // Pobierz istniejące wyceny z localStorage
            const savedEstimates = JSON.parse(localStorage.getItem('windowEstimates') || '[]');
            
            // Wygeneruj numer okna (W1, W2, W3...)
            const windowNumber = `W${savedEstimates.length + 1}`;
            
            // Dodaj nowe okno
            const newWindow = {
                id: Date.now(),
                windowNumber: windowNumber,
                config: windowConfig,
                price: price,
                timestamp: new Date().toISOString()
            };
            
            savedEstimates.push(newWindow);
            
            // Zapisz z powrotem do localStorage
            localStorage.setItem('windowEstimates', JSON.stringify(savedEstimates));
            
            console.log('Window saved to localStorage:', windowNumber);
            this.showToast(`✅ ${windowNumber} saved locally. Login to sync your estimates.`, 'warning');
            
            // Reset sekwencji apply buttons dla następnego okna
            if (window.configuratorCore && window.configuratorCore.resetApplySequence) {
                window.configuratorCore.resetApplySequence();
                console.log('🔄 Apply sequence reset for new window');
            }
            
            // Zaktualizuj licznik w przycisku "View My Estimates"
            this.updateLocalStorageCounter();
            
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            this.showToast('❌ Error saving window', 'error');
        }
    }

    // Zaktualizuj licznik okien w localStorage
    updateLocalStorageCounter() {
        const savedEstimates = JSON.parse(localStorage.getItem('windowEstimates') || '[]');
        const viewBtn = document.getElementById('view-my-estimates');
        
        if (viewBtn && savedEstimates.length > 0) {
            viewBtn.textContent = `View My Estimates (${savedEstimates.length})`;
        }
    }

    // ─── EDIT MODE ───

    // Check URL params for edit mode (?edit=ITEM_ID&estimate=ESTIMATE_ID)
    async checkEditMode() {
        const params = new URLSearchParams(window.location.search);
        const editItemId = params.get('edit');
        const estimateId = params.get('estimate');

        if (!editItemId) return;

        console.log('=== EDIT MODE DETECTED ===');
        console.log('editItemId:', editItemId);
        console.log('estimateId:', estimateId);

        this.editMode = true;
        this.editItemId = editItemId;
        this.editEstimateId = estimateId;

        // Change button text
        const addBtn = document.getElementById('add-to-estimate');
        if (addBtn) {
            const span = addBtn.querySelector('span') || addBtn;
            span.textContent = 'Update Window';
            addBtn.style.background = '#2a5a3a';
        }
        // Also for door button
        const doorBtn = document.getElementById('d-add-to-estimate');
        if (doorBtn) {
            const span = doorBtn.querySelector('span') || doorBtn;
            span.textContent = 'Update Door';
            doorBtn.style.background = '#2a5a3a';
        }

        // Hide estimate selector (not needed in edit mode)
        const selectorWrap = document.getElementById('estimate-selector-wrap') || 
                            document.querySelector('.estimate-selector-container');
        if (selectorWrap) selectorWrap.style.display = 'none';

        // Show edit mode banner
        const banner = document.createElement('div');
        banner.style.cssText = 'background:#2a5a3a;color:#fff;padding:.6rem 1.2rem;text-align:center;font-family:Jost,sans-serif;font-size:.8rem;letter-spacing:.1em;text-transform:uppercase;position:fixed;top:0;left:0;right:0;z-index:9999;';
        banner.textContent = '✏️ EDIT MODE — Editing existing window';
        document.body.prepend(banner);

        // Load item data from Supabase
        await this.loadForEdit(editItemId);
    }

    // Load item from DB and prefill configurator
    async loadForEdit(itemId) {
        try {
            const { data: item, error } = await supabaseClient
                .from('estimate_items')
                .select('*')
                .eq('id', itemId)
                .single();

            if (error) throw error;
            if (!item) throw new Error('Item not found');

            console.log('=== LOADED ITEM FOR EDIT ===');
            console.log('item:', item);

            // Parse specification JSON
            const spec = typeof item.specification === 'string' 
                ? JSON.parse(item.specification) 
                : item.specification;

            if (!spec) throw new Error('No specification data');

            // fullConfig has everything
            const fc = spec.fullConfig || spec;
            console.log('fullConfig:', fc);

            // Wait for configurator to be ready
            await this.waitForConfigurator();

            // Prefill the configurator
            this.prefillConfigurator(fc, item);

        } catch (error) {
            console.error('Error loading item for edit:', error);
            this.showToast('❌ Error loading window for edit: ' + error.message, 'error');
        }
    }

    // Wait for configurator modules to be ready (max 10s)
    waitForConfigurator() {
        return new Promise((resolve, reject) => {
            let elapsed = 0;
            const check = () => {
                if (window.configuratorCore?.isInitialized && window.currentConfig) {
                    resolve();
                } else if (elapsed >= 10000) {
                    reject(new Error('Configurator failed to initialize within 10s'));
                } else {
                    elapsed += 100;
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }

    // Prefill configurator from saved fullConfig
    prefillConfigurator(fc, dbItem) {
        console.log('=== PREFILLING CONFIGURATOR ===');

        // ─── 1. Determine type ───
        const wType = fc.windowType || dbItem.window_type || 'sash';
        const isDoor = fc.windowCategory === 'door' || fc.productType === 'door' || 
                       ['french-doors', 'sliding-doors', 'bifold-doors'].includes(wType);
        const isCasement = !isDoor && (wType === 'casement' || fc.windowCategory === 'casement');
        const isFixOnly = !isDoor && wType === 'fix-only';

        if (isDoor) {
            // ─── Switch to Doors mode ───
            const doorsRadio = document.querySelector('input[name="product-range"][value="doors"]');
            if (doorsRadio) { doorsRadio.checked = true; doorsRadio.dispatchEvent(new Event('change', {bubbles:true})); }

            // Set door type (french/sliding/bifold)
            const doorType = fc.doorType || wType.replace('-doors', '') || 'french';
            setTimeout(() => {
                const dtRadio = document.querySelector(`input[name="door-type"][value="${doorType}"]`);
                if (dtRadio) { dtRadio.checked = true; dtRadio.dispatchEvent(new Event('change', {bubbles:true})); }
            }, 100);
        } else {
            // ─── Ensure Windows mode ───
            const windowsRadio = document.querySelector('input[name="product-range"][value="windows"]');
            if (windowsRadio && !windowsRadio.checked) { 
                windowsRadio.checked = true; 
                windowsRadio.dispatchEvent(new Event('change', {bubbles:true})); 
            }

            if (isCasement) {
                const casRadio = document.querySelector('input[name="window-type"][value="casement"]');
                if (casRadio) { casRadio.checked = true; casRadio.dispatchEvent(new Event('change', {bubbles:true})); }
            } else if (isFixOnly) {
                const fixRadio = document.querySelector('input[name="window-type"][value="fix-only"]');
                if (fixRadio) { fixRadio.checked = true; fixRadio.dispatchEvent(new Event('change', {bubbles:true})); }
            } else {
                const sashRadio = document.querySelector('input[name="window-type"][value="sash"]');
                if (sashRadio) { sashRadio.checked = true; sashRadio.dispatchEvent(new Event('change', {bubbles:true})); }
            }
        }

        // Delay for panels to render after type change
        setTimeout(() => {
            this._prefillFields(fc, dbItem, { isDoor, isCasement, isFixOnly });
        }, 400);
    }

    // Internal: set all form fields — type-aware with correct HTML element names
    _prefillFields(fc, dbItem, flags) {
        const { isDoor, isCasement, isFixOnly } = flags;
        const isSash = !isDoor && !isCasement && !isFixOnly;

        // Helper: set radio by name+value
        const setRadio = (name, value) => {
            if (!value && value !== 0) return;
            const radio = document.querySelector(`input[name="${name}"][value="${value}"]`);
            if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change', {bubbles:true})); }
            else { console.warn(`[EDIT] Radio not found: name="${name}" value="${value}"`); }
        };
        // Helper: set input/select value
        const setVal = (id, value, eventType = 'change') => {
            if (value === undefined || value === null) return;
            const el = document.getElementById(id);
            if (el) { el.value = value; el.dispatchEvent(new Event(eventType, {bubbles:true})); }
        };

        const w = fc.actualFrameWidth || fc.width || dbItem.width;
        const h = fc.actualFrameHeight || fc.height || dbItem.height;

        // ══════════════════════════════════════════════
        // ═══ SASH WINDOW ═════════════════════════════
        // ══════════════════════════════════════════════
        if (isSash) {
            // Dimensions (selects)
            setVal('width-select', w);
            setVal('width', w);
            const wd = document.getElementById('width-display');
            if (wd) wd.textContent = w;
            setVal('height-select', h);
            setVal('height', h);
            const hd = document.getElementById('height-display');
            if (hd) hd.textContent = h;

            // Sash sub-type (double/triple/arched-group)
            setRadio('sash-type', fc.sashType || 'double');

            // Split ratio (for triple sash)
            if (fc.splitRatio) setVal('split-ratio', fc.splitRatio);

            // Head type (flat/arch)
            setRadio('head-type', fc.headType || 'flat');

            // Radios
            setRadio('measurement-type', fc.measurementType);
            setRadio('frame-type', fc.frameType);
            setRadio('color-type', fc.colorType || fc.colourMode);
            setRadio('glass-type', fc.glassType);
            setRadio('glass-spec', fc.glassSpec);
            setRadio('glass-finish', fc.glassFinish);
            setRadio('opening-type', fc.openingType);
            setRadio('pas24', fc.pas24 === true || fc.pas24 === 'yes' ? 'yes' : 'no');
            setRadio('frosted-location', fc.frostedLocation);
            setRadio('spacer-color', fc.spacerColor || fc.spacer);

            // Bars
            setRadio('upper-bars', fc.upperBars);
            setRadio('lower-bars', fc.lowerBars);

            // Horns
            const horns = fc.horns || dbItem.horns;
            if (horns && horns !== 'none') setVal('horns', horns);

            // Quantity & Name
            setVal('window-quantity', fc.quantity || dbItem.quantity || 1);
            const nameEl = document.getElementById('custom-name');
            if (nameEl && dbItem.window_number) nameEl.value = dbItem.window_number;
        }

        // ══════════════════════════════════════════════
        // ═══ CASEMENT WINDOW ═════════════════════════
        // ══════════════════════════════════════════════
        if (isCasement) {
            // Dimensions (c-prefixed selects)
            setVal('c-width-select', w);
            setVal('c-width', w);
            setVal('c-height-select', h);
            setVal('c-height', h);

            // Casement sub-type (standard/arched)
            setRadio('casement-type', fc.casementType || 'standard');

            // Layout
            setRadio('casement-layout', fc.casementLayout || fc.layout || dbItem.casement_layout);

            // Glass (c-prefixed)
            setRadio('c-glass-type', fc.glassType);
            setRadio('c-glass-spec', fc.glassSpec);
            setRadio('c-glass-finish', fc.glassFinish);

            // PAS24 (c-prefixed)
            setRadio('c-pas24', fc.pas24 === true || fc.pas24 === 'yes' ? 'yes' : 'no');

            // Trickle vent
            setRadio('c-trickle-vent', fc.trickleVent || dbItem.trickle_vent);

            // Seal colour
            setRadio('c-seal-colour', fc.sealColour || dbItem.seal_colour);

            // Sill extension (correct name: c-sill-ext)
            setRadio('c-sill-ext', fc.sillExtension || dbItem.sill_extension);

            // Sill wider
            setRadio('c-sill-wider', fc.sillWider ? 'yes' : 'no');

            // Color type (casement shares window color system)
            setRadio('color-type', fc.colorType || fc.colourMode);

            // Spacer (casement uses sash spacer radio)
            setRadio('spacer-color', fc.spacerColor || fc.spacer);

            // Bars (c-prefixed)
            const casHBars = fc.hBars || fc.casementHBars || fc.upperBars || dbItem.upper_bars;
            const casVBars = fc.vBars || fc.casementVBars || fc.lowerBars || dbItem.lower_bars;
            if (casHBars) setRadio('c-hbars', String(casHBars));
            if (casVBars) setRadio('c-vbars', String(casVBars));

            // Quantity & Name
            setVal('c-quantity', fc.quantity || dbItem.quantity || 1);
            const cName = document.getElementById('c-custom-name');
            if (cName && dbItem.window_number) cName.value = dbItem.window_number;
        }

        // ══════════════════════════════════════════════
        // ═══ FIX-ONLY WINDOW ═════════════════════════
        // ══════════════════════════════════════════════
        if (isFixOnly) {
            // Dimensions (fix-prefixed number inputs)
            setVal('fix-width', w, 'input');
            setVal('fix-height', h, 'input');

            // Fix type (standard/fd30/fd60)
            setRadio('fix-type', fc.fixType || 'standard');

            // Fix shape
            setRadio('fix-shape', fc.fixShape || fc.shape || 'rectangle');

            // Glass finish (f-prefixed)
            setRadio('f-glass-finish', fc.glassFinish);

            // Spacer (f-prefixed)
            setRadio('f-spacer', fc.spacerColor || fc.spacer || 'silver');

            // Color type (fix shares window color system)
            setRadio('color-type', fc.colorType || fc.colourMode);

            // Quantity
            setVal('fix-quantity', fc.quantity || dbItem.quantity || 1);
        }

        // ══════════════════════════════════════════════
        // ═══ DOORS (French / Sliding / Bi-fold) ══════
        // ══════════════════════════════════════════════
        if (isDoor) {
            // Dimensions already set in main block above
            // Door-specific radios
            setRadio('d-glass-type', fc.glassType);
            setRadio('d-glass-finish', fc.glassFinish);
            setRadio('d-spacer-color', fc.spacerColor || fc.spacer);
            setRadio('d-seal-colour', fc.sealColour);
            setRadio('d-trickle-vent', fc.trickleVent);
            setRadio('d-trickle-colour', fc.trickleColour);

            // Door bars
            if (fc.hBars !== undefined) setRadio('d-hbars', String(fc.hBars));
            if (fc.vBars !== undefined) setRadio('d-vbars', String(fc.vBars));
            if (fc.sideHBars !== undefined) setRadio('d-side-hbars', String(fc.sideHBars));
            if (fc.sideVBars !== undefined) setRadio('d-side-vbars', String(fc.sideVBars));

            // French-specific
            if (fc.doorType === 'french') {
                setRadio('door-shape', fc.doorShape);
                setRadio('door-style', fc.doorStyle);
                setRadio('door-paneling', fc.doorPaneling);
                setRadio('door-side-panels', fc.sidePanels);
                setRadio('door-side-style', fc.sideStyle);
                setRadio('door-center-mullion', fc.centerMullion);
                setRadio('d-lock-type', fc.lockType);
                setRadio('d-threshold', fc.threshold);
                if (fc.thresholdExtension) setVal('d-threshold-extension', fc.thresholdExtension, 'input');
                if (fc.sideLeftWidth) setVal('d-side-left-width', fc.sideLeftWidth, 'input');
                if (fc.sideRightWidth) setVal('d-side-right-width', fc.sideRightWidth, 'input');
            }

            // Sliding-specific
            if (fc.doorType === 'sliding') {
                setRadio('sl-door-panel-count', String(fc.panelCount));
                setRadio('sl-door-slide-direction', fc.slideDirection);
            }

            // Bi-fold specific (panel count, fold, traffic already set in door dimensions block)
            if (fc.doorType === 'bifold') {
                setRadio('bf-open-direction', fc.bifoldOpenDirection || fc.openDirection || 'outward');
            }

            // Sill wider (checkbox)
            const sillWider = document.getElementById('d-sill-wider');
            if (sillWider) sillWider.checked = !!fc.sillWider;

            // Notes
            const notesEl = document.getElementById('d-notes');
            if (notesEl && fc.notes) notesEl.value = fc.notes;

            // Door colours — restore doorColourState from fullConfig
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
                // Refresh door spec panel and 3D
                if (window.updateDoorSpec) window.updateDoorSpec();
                if (window.updateDoor3D) window.updateDoor3D();
            }
        }

        // ══════════════════════════════════════════════
        // ═══ COLORS (windows: sash, casement, fix) ═══
        // ══════════════════════════════════════════════
        if (!isDoor) {
            const colorType = fc.colorType || fc.colourMode || 'single';
            if (colorType === 'single') {
                const colorName = fc.singleColor || fc.colorSingle || fc.colorSingleName;
                if (colorName) {
                    const colorOpt = document.querySelector(`.color-option[data-color="${colorName}"]`) ||
                                    document.querySelector(`.color-option[data-name="${colorName}"]`);
                    if (colorOpt) colorOpt.click();
                }
            } else if (colorType === 'dual') {
                const intColor = fc.interiorColor || fc.colorInterior || fc.colorInteriorName;
                const extColor = fc.exteriorColor || fc.colorExterior || fc.colorExteriorName;
                if (intColor) {
                    const intOpt = document.querySelector(`.interior-color[data-color="${intColor}"]`) ||
                                  document.querySelector(`.interior-color[data-name="${intColor}"]`);
                    if (intOpt) intOpt.click();
                }
                if (extColor) {
                    const extOpt = document.querySelector(`.exterior-color[data-color="${extColor}"]`) ||
                                  document.querySelector(`.exterior-color[data-name="${extColor}"]`);
                    if (extOpt) extOpt.click();
                }
            }
        }

        // ══════════════════════════════════════════════
        // ═══ FINAL: merge fullConfig + update ════════
        // ══════════════════════════════════════════════

        // Set fullConfig into state (ensures price calculator + 3D have all data)
        Object.assign(window.currentConfig, fc);

        // Restore custom bars via loadConfiguration (handles customBars object)
        if (window.configuratorCore && fc.customBars) {
            window.configuratorCore.loadConfiguration(fc);
        }

        // Trigger full update (price, 3D, spec panel)
        if (window.configuratorCore) {
            window.configuratorCore.updateAll();
        }

        console.log('=== PREFILL COMPLETE ===');
        this.showToast('✏️ Window loaded for editing', 'success');
    }

    // UPDATE existing window in DB (instead of INSERT)
    async updateWindowInEstimate(itemId, estimateId, windowConfig, price) {
        try {
            console.log('=== UPDATE WINDOW ===');
            console.log('itemId:', itemId);
            console.log('estimateId:', estimateId);

            // Take screenshots if available
            if (window.takeWindowScreenshots && windowConfig.fullConfig) {
                try {
                    const screenshots = await window.takeWindowScreenshots();
                    if (screenshots) {
                        windowConfig.fullConfig.screenshots = screenshots;
                    }
                } catch (ssErr) {
                    console.warn('Screenshot failed, continuing:', ssErr);
                }
            }

            // Build update object (same fields as insert)
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
                frosted_location: windowConfig.glassFinish === 'frosted' ? (windowConfig.frostedLocation || windowConfig.fullConfig?.frostedLocation || null) : null,
                opening_type: windowConfig.openingType,
                color_type: windowConfig.colorType,
                color_single: (() => {
                    const fc = windowConfig.fullConfig || {};
                    if (windowConfig.colorType === 'single') {
                        return fc.colorSingleName || fc.singleColor || windowConfig.colorSingle || 'white';
                    }
                    return windowConfig.colorSingle;
                })(),
                color_interior: (() => {
                    const fc = windowConfig.fullConfig || {};
                    return windowConfig.colorInterior || fc.interiorColor || fc.colorInterior || null;
                })(),
                color_exterior: (() => {
                    const fc = windowConfig.fullConfig || {};
                    return windowConfig.colorExterior || fc.exteriorColor || fc.colorExterior || null;
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
                specification: JSON.stringify(windowConfig),
                updated_at: new Date().toISOString()
            };

            // UPDATE item
            const { error: updateError } = await supabaseClient
                .from('estimate_items')
                .update(updateData)
                .eq('id', itemId);

            if (updateError) throw updateError;

            // Recalculate estimate total
            if (estimateId) {
                const { data: allItems, error: itemsError } = await supabaseClient
                    .from('estimate_items')
                    .select('total_price')
                    .eq('estimate_id', estimateId);

                if (!itemsError && allItems) {
                    const newTotal = allItems.reduce((sum, i) => sum + (parseFloat(i.total_price) || 0), 0);
                    await supabaseClient
                        .from('estimates')
                        .update({ total_price: newTotal, updated_at: new Date().toISOString() })
                        .eq('id', estimateId);
                }
            }

            this.showToast('✅ Window updated successfully!', 'success');

            // Redirect back after short delay
            setTimeout(() => {
                window.close(); // Close tab (if opened with window.open)
                // Fallback: redirect based on referrer
                if (!window.closed) {
                    const ref = document.referrer || '';
                    if (ref.includes('admin')) {
                        window.location.href = 'admin-dashboard.html';
                    } else {
                        window.location.href = 'customer-dashboard.html';
                    }
                }
            }, 1500);

        } catch (error) {
            console.error('Error updating window:', error);
            this.showToast('❌ Error updating window: ' + error.message, 'error');
        }
    }
}

// Inicjalizuj gdy strona jest gotowa
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.estimateManager = new EstimateManager();
    });
} else {
    window.estimateManager = new EstimateManager();
}