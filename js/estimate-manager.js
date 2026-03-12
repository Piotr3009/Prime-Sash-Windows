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
            const customNameInput = document.getElementById('window-custom-name');
            let windowNumber = customNameInput ? customNameInput.value.trim() : '';

            // Jeśli nie ma custom nazwy, wygeneruj automatyczną (W1, W2, W3...)
            if (!windowNumber) {
                windowNumber = 'W1';
                if (items && items.length > 0) {
                    // Wyciągnij numery tylko z okien o formacie W[number]
                    const numbers = items
                        .filter(item => /^W\d+$/.test(item.window_number))
                        .map(item => parseInt(item.window_number.substring(1)))
                        .filter(n => !isNaN(n));
                    
                    if (numbers.length > 0) {
                        const maxNumber = Math.max(...numbers);
                        windowNumber = `W${maxNumber + 1}`;
                    }
                }
            }

            console.log('Window number:', windowNumber);

            // Wyczyść pole custom name po użyciu
            if (customNameInput) {
                customNameInput.value = '';
            }

            // Zapisz okno
            const { data: item, error: itemError } = await supabaseClient
                .from('estimate_items')
                .insert([{
                    estimate_id: targetEstimateId,
                    window_number: windowNumber,
                    width: windowConfig.width,
                    height: windowConfig.height,
                    measurement_type: windowConfig.measurementType,
                    
                    // NOWE: Oryginalne wymiary (przed brick-to-brick adjustment)
                    original_width: windowConfig.originalWidth,
                    original_height: windowConfig.originalHeight,
                    
                    frame_type: windowConfig.frameType,
                    glass_type: windowConfig.glassType,
                    
                    // NOWE: Glass specification
                    glass_spec: windowConfig.glassSpec,
                    glass_finish: windowConfig.glassFinish,
                    frosted_location: windowConfig.frostedLocation,
                    
                    opening_type: windowConfig.openingType,
                    color_type: windowConfig.colorType,
                    color_single: windowConfig.colorSingle,
                    color_interior: windowConfig.colorInterior,
                    color_exterior: windowConfig.colorExterior,
                    
                    // NOWE: Custom exterior color
                    custom_exterior_color: windowConfig.customExteriorColor,
                    
                    upper_bars: windowConfig.upperBars || null,
                    lower_bars: windowConfig.lowerBars || null,
                    horns: windowConfig.horns,
                    
                    // ZMIENIONE: ironmongery jako JSONB (nie VARCHAR)
                    ironmongery: windowConfig.ironmongery ? JSON.stringify(windowConfig.ironmongery) : null,
                    
                    // NOWE: Ironmongery finish
                    ironmongery_finish: windowConfig.ironmongeryFinish,
                    
                    pas24: windowConfig.pas24 || false,
                    quantity: windowConfig.quantity || 1,
                    unit_price: price.unitPrice,
                    total_price: price.totalPrice,
                    specification: JSON.stringify(windowConfig)
                }])
                .select()
                .single();

            if (itemError) throw itemError;

            console.log('Window added:', windowNumber);
            
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

            return item;
        } catch (error) {
            console.error('Error adding window:', error);
            this.showToast('❌ Error adding window', 'error');
            throw error;
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
                // Pobierz konfigurację okna z konfiguratora
                const windowConfig = this.getCurrentWindowConfig();
                const price = this.getCurrentPrice();

                // Pobierz wybrany estimate z dropdowna
                if (window.estimateSelectorManager) {
                    const estimateId = await window.estimateSelectorManager.getOrCreateEstimate();
                    if (!estimateId) {
                        console.log('No estimate selected or creation cancelled');
                        return;
                    }
                    await this.addWindowToEstimate(windowConfig, price, estimateId);
                } else {
                    // Fallback - użyj starej logiki
                    await this.addWindowToEstimate(windowConfig, price);
                }
            });
        }

        // Przycisk "Create New Estimate"
        const createBtn = document.getElementById('create-new-estimate-btn');
        if (createBtn) {
            createBtn.addEventListener('click', () => {
                this.showCreateEstimateModal();
            });
        }

        // Przycisk "View My Estimates"
        const viewBtn = document.getElementById('view-my-estimates');
        if (viewBtn) {
            viewBtn.addEventListener('click', async () => {
                const user = await getCurrentUser();
                
                if (user) {
                    // ZALOGOWANY - idź do dashboardu
                    window.location.href = 'customer-dashboard.html';
                } else {
                    // NIEZALOGOWANY - sprawdź localStorage
                    const savedEstimates = JSON.parse(localStorage.getItem('windowEstimates') || '[]');
                    
                    if (savedEstimates.length > 0) {
                        // Ma zapisane okna - zaproponuj logowanie
                        if (confirm(`You have ${savedEstimates.length} window(s) saved locally.\n\nLogin to sync your estimates and access full features?`)) {
                            localStorage.setItem('redirect_after_login', 'customer-dashboard.html');
                            window.location.href = 'login.html';
                        }
                    } else {
                        // Nie ma nic - zaproponuj logowanie
                        if (confirm('Login to create and manage your estimates?')) {
                            localStorage.setItem('redirect_after_login', 'customer-dashboard.html');
                            window.location.href = 'login.html';
                        }
                    }
                }
            });
            
            // Zaktualizuj licznik przy inicjalizacji
            this.updateLocalStorageCounter();
        }

        // Zamknięcie modala - teraz obsługiwane przez HTML onclick
        // (new-estimate-modal ma już onclick na przycisku close)
    }

    // Pobierz aktualną konfigurację okna
    getCurrentWindowConfig() {
        // Użyj window.currentConfig który ma WSZYSTKIE dane ze specyfikacji
        if (window.currentConfig) {
            return {
                // Wymiary - ZAWSZE wymiar okna (nie brick-to-brick)
                width: window.currentConfig.actualFrameWidth || window.currentConfig.width,
                height: window.currentConfig.actualFrameHeight || window.currentConfig.height,
                
                // Informacja o pomiarze (do wyświetlenia)
                measurementType: window.currentConfig.measurementType,
                originalWidth: window.currentConfig.width,  // Oryginalny pomiar (brick-to-brick)
                originalHeight: window.currentConfig.height,
                
                // Typ ramy
                frameType: window.currentConfig.frameType,
                
                // Szkło
                glassType: window.currentConfig.glassType,
                glassSpec: window.currentConfig.glassSpec,
                glassFinish: window.currentConfig.glassFinish,
                frostedLocation: window.currentConfig.frostedLocation,
                
                // Opening
                openingType: window.currentConfig.openingType,
                
                // Kolory
                colorType: window.currentConfig.colorType,
                colorSingle: window.currentConfig.colorSingle,
                colorInterior: window.currentConfig.colorInterior,
                colorExterior: window.currentConfig.colorExterior,
                customExteriorColor: window.currentConfig.customExteriorColor,
                
                // Bary - Pobierz z window.currentConfig (najprostsze i najnowsze źródło)
                upperBars: window.currentConfig.upperBars || null,
                lowerBars: window.currentConfig.lowerBars || null,
                
                // Detale (horns są w ironmongery)
                horns: null, // USUNIĘTE - teraz w Gallery
                
                // Ironmongery - NOWY SYSTEM: z Gallery
                ironmongery: window.ConfiguratorCore?.currentWindow?.ironmongery || null,
                ironmongeryFinish: null, // USUNIĘTE - finish teraz w produkcie
                
                // PAS24
                pas24: window.currentConfig.pas24,
                
                // Quantity
                quantity: window.currentConfig.quantity || 1,
                
                // FULL BACKUP - cała konfiguracja
                fullConfig: { ...window.currentConfig }
            };
        }

        // Fallback - jeśli window.currentConfig nie istnieje
        console.warn('window.currentConfig not found - using fallback');
        return null;
    }

    // Pobierz aktualną cenę
    getCurrentPrice() {
        const priceText = document.getElementById('total-price')?.textContent || '0';
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