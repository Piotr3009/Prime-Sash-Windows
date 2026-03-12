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
            console.log('User not logged in - estimate selector disabled');
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
            console.log('Loaded estimates:', this.estimates);
            this.renderEstimateOptions();
        } catch (error) {
            console.error('Error loading estimates:', error);
        }
    }

    renderEstimateOptions() {
        const selector = document.getElementById('estimate-selector');
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

        this.updateEstimateInfo();
    }

    updateEstimateInfo() {
        const info = document.getElementById('estimate-info');
        const addBtn = document.getElementById('add-to-estimate');
        
        if (!info || !addBtn) return;

        if (this.selectedEstimateId === 'new') {
            info.textContent = 'A new estimate will be created when you add the window';
            info.style.color = '#666';
            info.style.fontWeight = 'normal';
            addBtn.textContent = 'Create New Estimate & Add Window';
        } else {
            const estimate = this.estimates.find(e => e.id === this.selectedEstimateId);
            if (estimate) {
                info.textContent = `Window will be added to: ${estimate.project_name}`;
                info.style.color = 'var(--primary-color)';
                info.style.fontWeight = '600';
                addBtn.textContent = `Add Window to "${estimate.project_name}"`;
            }
        }
    }

    disableSelector() {
        const selector = document.getElementById('estimate-selector');
        if (selector) {
            selector.disabled = true;
            selector.innerHTML = '<option>Login to create estimates</option>';
        }
    }

    attachEventListeners() {
        // Selector change
        const selector = document.getElementById('estimate-selector');
        if (selector) {
            selector.addEventListener('change', (e) => {
                this.selectedEstimateId = e.target.value;
                this.updateEstimateInfo();
                console.log('Selected estimate:', this.selectedEstimateId);
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
                    status: 'draft',
                    total_price: 0
                }])
                .select()
                .single();

            if (error) throw error;

            console.log('New estimate created:', data);

            // Close modal
            document.getElementById('new-estimate-modal').style.display = 'none';

            // Reload estimates
            await this.loadEstimates();

            // Select the new estimate
            this.selectedEstimateId = data.id;
            document.getElementById('estimate-selector').value = data.id;
            this.updateEstimateInfo();

            alert(`Estimate ${estimateNumber} created successfully!`);

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