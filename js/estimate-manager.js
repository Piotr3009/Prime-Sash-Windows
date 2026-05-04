// estimate-manager.js - Zarządzanie wycenami według nowej logiki

class EstimateManager {
    constructor() {
        this.currentEstimate = null; // Aktualna wycena
        this.currentCustomer = null; // Zalogowany klient
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
        // Przycisk "Add to Estimate"
        const addBtn = document.getElementById('add-to-estimate');
        if (addBtn) {
            addBtn.addEventListener('click', async () => {
                // Pobierz wybrany estimate z dropdowna
                if (window.estimateSelectorManager) {
                    const isNew = window.estimateSelectorManager.selectedEstimateId === 'new';
                    const estimateId = await window.estimateSelectorManager.getOrCreateEstimate();
                    if (!estimateId) {
                        console.log('No estimate selected or creation cancelled');
                        return;
                    }

                    // If just created new estimate — DON'T add window yet
                    if (isNew) {
                        console.log('New estimate created — waiting for user to configure window first');
                        return;
                    }

                    // Existing estimate — add window
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

                if (!this.currentEstimate) {
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
                        .eq('id', this.currentEstimate.id)
                        .single();

                    if (error) throw error;

                    // Load extras
                    try {
                        data.extras = await EstimateExtras.load(this.currentEstimate.id);
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
}

// Inicjalizuj gdy strona jest gotowa
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.estimateManager = new EstimateManager();
    });
} else {
    window.estimateManager = new EstimateManager();
}