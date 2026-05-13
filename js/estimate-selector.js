// Estimate Selector Manager
// Manages the dropdown for selecting/creating estimates

class EstimateSelectorManager {
    constructor() {
        this.currentUser = null;
        this.customerData = null;
        this.estimates = [];
        this.selectedEstimateId = 'new';
        this.init();
    }

    async init() {
        // Check if user is logged in
        const user = await getCurrentUser();
        if (!user) {
            this.disableSelector();
            return;
        }

        this.currentUser = user;
        await this.loadCustomerData();
        await this.loadEstimates();
        this.attachEventListeners();
    }

    async loadCustomerData() {
        try {
            const { data, error } = await supabaseClient
                .from('customers')
                .select('*')
                .eq('user_id', this.currentUser.id)
                .single();

            if (error) throw error;
            this.customerData = data;
        } catch (error) {
            console.error('Error loading customer data:', error);
        }
    }

    async loadEstimates() {
        try {
            if (!this.customerData) {
                console.error('Customer data not loaded');
                return;
            }

            const { data, error } = await supabaseClient
                .from('estimates')
                .select('id, estimate_number, project_name, status, total_price, created_at, estimate_items(count)')
                .eq('customer_id', this.customerData.id)
                .in('status', ['draft', 'sent'])  // Only show active estimates
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.estimates = data || [];
            this.renderEstimateOptions();
        } catch (error) {
            console.error('Error loading estimates:', error);
        }
    }

    renderEstimateOptions() {
        // Populate all estimate dropdowns (sash + door)
        const selectors = [
            document.getElementById('estimate-selector'),
            document.getElementById('d-estimate-selector')
        ];

        selectors.forEach(selector => {
            if (!selector) return;

            // Clear existing options except "Create New"
            selector.innerHTML = '<option value="new">+ Create New Estimate</option>';

            // Add estimates
            this.estimates.forEach(estimate => {
                const itemCount = estimate.estimate_items?.[0]?.count || 0;
                const option = document.createElement('option');
                option.value = estimate.id;
                option.textContent = `${estimate.estimate_number} - ${estimate.project_name} (${itemCount} windows, £${this.formatPrice(estimate.total_price)})`;
                selector.appendChild(option);
            });

            // Sync selected value
            if (this.selectedEstimateId) {
                selector.value = this.selectedEstimateId;
            }
        });

        this.updateEstimateInfo();
    }

    // Keep all estimate dropdowns in sync
    syncDropdowns(source) {
        const allSelectors = [
            document.getElementById('estimate-selector'),
            document.getElementById('d-estimate-selector')
        ];
        allSelectors.forEach(sel => {
            if (sel && sel !== source) sel.value = this.selectedEstimateId;
        });
    }

    updateEstimateInfo() {
        // Update both sash and door info elements
        const pairs = [
            { info: document.getElementById('estimate-info'), btn: document.getElementById('add-to-estimate'), label: 'Window' },
            { info: document.getElementById('d-estimate-info'), btn: document.getElementById('d-add-to-estimate'), label: 'Door' }
        ];

        pairs.forEach(({ info, btn, label }) => {
            if (!info && !btn) return;

            if (this.selectedEstimateId === 'new') {
                if (info) {
                    info.textContent = 'Create a new estimate first, then configure and add items';
                    info.style.color = '#666';
                    info.style.fontWeight = 'normal';
                }
                if (btn) btn.textContent = 'Create New Estimate';
            } else {
                const estimate = this.estimates.find(e => e.id === this.selectedEstimateId);
                if (estimate) {
                    if (info) {
                        info.textContent = `${label} will be added to: ${estimate.project_name}`;
                        info.style.color = 'var(--primary-color)';
                        info.style.fontWeight = '600';
                    }
                    if (btn) btn.textContent = `Add ${label} to "${estimate.project_name}"`;
                }
            }
        });
    }

    disableSelector() {
        const selector = document.getElementById('estimate-selector');
        if (selector) {
            selector.disabled = true;
            selector.innerHTML = '<option>Login to create estimates</option>';
        }
    }

    attachEventListeners() {
        // Selector change — sash
        const selector = document.getElementById('estimate-selector');
        if (selector) {
            selector.addEventListener('change', (e) => {
                this.selectedEstimateId = e.target.value;
                this.syncDropdowns(e.target);
                this.updateEstimateInfo();
            });
        }

        // Selector change — door
        const doorSelector = document.getElementById('d-estimate-selector');
        if (doorSelector) {
            doorSelector.addEventListener('change', (e) => {
                this.selectedEstimateId = e.target.value;
                this.syncDropdowns(e.target);
                this.updateEstimateInfo();
            });
        }

        // Refresh button
        const refreshBtn = document.getElementById('refresh-estimates');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                await this.loadEstimates();
            });
        }

        // Create estimate button in modal
        const createBtn = document.getElementById('create-estimate-btn');
        if (createBtn) {
            createBtn.addEventListener('click', () => this.createNewEstimate());
        }
    }

    async showCreateEstimateModal() {
        // Check if user is logged in first
        const user = await getCurrentUser();
        if (!user) {
            const existingPrompt = document.getElementById('register-prompt-modal');
            if (existingPrompt) existingPrompt.remove();

            const promptHTML = `
                <div id="register-prompt-modal" style="position:fixed;inset:0;background:rgba(10,22,40,.7);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;" onclick="if(event.target===this)this.remove()">
                    <div style="background:#fff;border-radius:8px;max-width:480px;width:100%;padding:2.5rem;text-align:center;position:relative;">
                        <button onclick="this.parentElement.parentElement.remove()" style="position:absolute;top:12px;right:16px;background:none;border:none;font-size:1.5rem;cursor:pointer;color:#999;">×</button>
                        <div style="font-size:2.5rem;margin-bottom:1rem;">🔐</div>
                        <h2 style="font-family:var(--serif,Georgia);font-size:1.6rem;color:#0A1628;margin-bottom:0.8rem;">Create a Free Account</h2>
                        <p style="font-family:var(--sans,sans-serif);font-size:0.95rem;color:#666;line-height:1.7;margin-bottom:1.5rem;">Register to save your estimate, download PDF, and access it anytime. Your configured window will be preserved.</p>
                        <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;">
                            <a href="login.html" onclick="localStorage.setItem('redirect_after_login','online-estimate.html')" style="display:inline-block;padding:14px 36px;background:#0A1628;color:#fff;text-decoration:none;font-family:var(--sans,sans-serif);font-size:0.7rem;letter-spacing:0.25em;text-transform:uppercase;border-radius:3px;">Register — 30 Seconds</a>
                            <a href="login.html" onclick="localStorage.setItem('redirect_after_login','online-estimate.html')" style="display:inline-block;padding:14px 36px;background:transparent;color:#0A1628;text-decoration:none;font-family:var(--sans,sans-serif);font-size:0.7rem;letter-spacing:0.25em;text-transform:uppercase;border:1px solid #0A1628;border-radius:3px;">I Have an Account</a>
                        </div>
                        <p style="font-family:var(--sans,sans-serif);font-size:0.75rem;color:#999;margin-top:1.2rem;">No spam. No sales calls. Just your saved estimate.</p>
                    </div>
                </div>`;
            document.body.insertAdjacentHTML('beforeend', promptHTML);
            return;
        }

        const modal = document.getElementById('new-estimate-modal');
        if (modal) {
            // Clear form
            document.getElementById('new-estimate-project-name').value = '';
            document.getElementById('new-estimate-address').value = '';
            document.getElementById('new-estimate-notes').value = '';
            
            modal.style.display = 'block';
        }
    }

    async createNewEstimate() {
        const projectName = document.getElementById('new-estimate-project-name').value.trim();
        const address = document.getElementById('new-estimate-address').value.trim();
        const notes = document.getElementById('new-estimate-notes').value.trim();

        if (!projectName) {
            alert('Please enter a project name');
            return;
        }

        if (!this.customerData) {
            alert('Customer data not loaded');
            return;
        }

        try {
            // Generate estimate number
            const estimateNumber = await this.generateEstimateNumber();

            // Create new estimate
            const { data, error } = await supabaseClient
                .from('estimates')
                .insert([{
                    customer_id: this.customerData.id,
                    estimate_number: estimateNumber,
                    project_name: projectName,
                    delivery_address: address || null,
                    notes: notes || null,
                    status: 'sent',
                    total_price: 0
                }])
                .select()
                .single();

            if (error) throw error;
            // Close modal
            document.getElementById('new-estimate-modal').style.display = 'none';

            // Reload estimates
            await this.loadEstimates();

            // Select the new estimate
            this.selectedEstimateId = data.id;
            document.getElementById('estimate-selector').value = data.id;
            this.updateEstimateInfo();

            alert(`Estimate ${estimateNumber} created!\n\nNow configure your first window using the panels on the left, then click "Create New Estimate & Add Window" to save it.`);

            // Highlight window name field
            const nameInput = document.getElementById('window-custom-name');
            if (nameInput) {
                nameInput.style.border = '2px solid #c8a96e';
                nameInput.placeholder = 'Enter window name (e.g. Kitchen Left, W1...)';
                nameInput.focus();
                setTimeout(() => { nameInput.style.border = ''; }, 5000);
            }

        } catch (error) {
            console.error('Error creating estimate:', error);
            alert('Failed to create estimate: ' + error.message);
        }
    }

    async generateEstimateNumber() {
        if (!this.customerData || !this.customerData.customer_code) {
            console.error('Customer data not loaded');
            return 'ERROR/01/2025';
        }

        const customerCode = this.customerData.customer_code;
        const year = new Date().getFullYear();

        // Get latest estimate for this customer in current year
        const { data, error } = await supabaseClient
            .from('estimates')
            .select('estimate_number')
            .eq('customer_id', this.customerData.id)
            .ilike('estimate_number', `${customerCode}/%/${year}`)
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) {
            console.error('Error getting estimate number:', error);
        }

        let sequence = 1;
        
        if (data && data.length > 0) {
            // Extract sequence from format: SKL00125/03/2025
            const match = data[0].estimate_number.match(/\/(\d+)\//);
            if (match) {
                sequence = parseInt(match[1]) + 1;
            }
        }

        // Format: SKL00125/01/2025
        return `${customerCode}/${String(sequence).padStart(2, '0')}/${year}`;
    }

    formatPrice(price) {
        return new Intl.NumberFormat('en-GB', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(price || 0);
    }

    getSelectedEstimateId() {
        return this.selectedEstimateId;
    }

    async getOrCreateEstimate() {
        if (this.selectedEstimateId === 'new') {
            // Show modal to create new estimate
            await this.showCreateEstimateModal();
            
            // Return promise that resolves when estimate is created
            return new Promise((resolve) => {
                const checkInterval = setInterval(() => {
                    if (this.selectedEstimateId !== 'new') {
                        clearInterval(checkInterval);
                        resolve(this.selectedEstimateId);
                    }
                }, 100);

                // Timeout after 60 seconds
                setTimeout(() => {
                    clearInterval(checkInterval);
                    resolve(null);
                }, 60000);
            });
        }

        return this.selectedEstimateId;
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.estimateSelectorManager = new EstimateSelectorManager();
    });
} else {
    window.estimateSelectorManager = new EstimateSelectorManager();
}