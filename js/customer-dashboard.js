// Customer Dashboard JavaScript

class CustomerDashboard {
    constructor() {
        this.currentUser = null;
        this.customerData = null;
        this.orders = [];
        this.currentFilter = 'all';
        this.init();
    }

    async init() {
        // Check if user is logged in
        const user = await getCurrentUser();
        if (!user) {
            window.location.href = 'index.html';
            return;
        }

        this.currentUser = user;
        
        // Import any saved estimates from localStorage (for existing users)
        await this.importLocalStorageEstimates();
        
        await this.loadCustomerData();
        await this.loadEstimates();  // ← Zmienione z loadOrders
        this.attachEventListeners();
    }

    // Import estimates from localStorage to database
    async importLocalStorageEstimates() {
        try {
            const savedEstimates = JSON.parse(localStorage.getItem('savedEstimates') || '[]');
            
            if (savedEstimates.length === 0) {
                return; // Nothing to import
            }
            // Najpierw pobierz customer_id
            const { data: customer, error: customerError } = await supabaseClient
                .from('customers')
                .select('id')
                .eq('user_id', this.currentUser.id)
                .single();

            if (customerError) throw customerError;

            // Convert each estimate to order format
            const orders = savedEstimates.map(estimate => ({
                customer_id: customer.id,  // ← Używa customer.id!
                status: 'saved',
                total_price: estimate.price || estimate.total_price || 0,
                window_spec: estimate,
                created_at: estimate.timestamp || new Date().toISOString()
            }));

            // Insert into database
            const { data, error } = await supabaseClient
                .from('orders')
                .insert(orders)
                .select();

            if (error) throw error;
            // Clear localStorage after successful import
            localStorage.removeItem('savedEstimates');
            
            // Show success message
            this.showSuccessMessage(`${data.length} saved estimate(s) imported to your account!`);

        } catch (error) {
            console.error('Error importing localStorage estimates:', error);
            // Don't show error to user - it's a background operation
        }
    }

    // Show success message
    showSuccessMessage(message) {
        const alertDiv = document.createElement('div');
        alertDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4caf50;
            color: white;
            padding: 15px 25px;
            border-radius: 5px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        alertDiv.textContent = message;
        document.body.appendChild(alertDiv);

        setTimeout(() => {
            alertDiv.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => alertDiv.remove(), 300);
        }, 3000);
    }

    // Load customer data from database
    async loadCustomerData() {
        try {
            const { data, error } = await supabaseClient
                .from('customers')
                .select('*')
                .eq('user_id', this.currentUser.id)
                .single();

            if (error) throw error;

            this.customerData = data;  // Debug
            this.updateCustomerInfo();
        } catch (error) {
            console.error('Error loading customer data:', error);
            this.showError('Failed to load customer information');
        }
    }

    // Update customer info in UI
    updateCustomerInfo() {
        if (!this.customerData) return;

        const heroTitle = document.getElementById('hero-title');
        const heroEmail = document.getElementById('hero-email');
        if (heroTitle) heroTitle.textContent = `Welcome Back, ${this.customerData.full_name.split(' ')[0]}`;
        if (heroEmail) heroEmail.textContent = this.customerData.email;

        const nameEl = document.getElementById('customer-fullname');
        if (nameEl) nameEl.textContent = this.customerData.full_name;
        
        const emailEl = document.getElementById('customer-email');
        if (emailEl) emailEl.textContent = this.customerData.email;
        
        const phoneEl = document.getElementById('customer-phone');
        if (phoneEl) phoneEl.textContent = this.customerData.phone || 'Not provided';

        const codeEl = document.getElementById('customer-code');
        if (codeEl) codeEl.textContent = this.customerData.customer_code || '—';
        
        const memberSince = new Date(this.customerData.created_at);
        const sinceEl = document.getElementById('customer-since');
        if (sinceEl) sinceEl.textContent = memberSince.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    }

    // Load estimates from database
    async loadEstimates() {
        try {
            // Sprawdź czy mamy customer data
            if (!this.customerData || !this.customerData.id) {
                console.error('Customer data not loaded yet');
                return;
            }

            const { data, error } = await supabaseClient
                .from('estimates')
                .select(`
                    *,
                    estimate_items (*),
                    estimate_extras (*),
                    customers (full_name, company_name, email, phone, customer_code)
                `)
                .eq('customer_id', this.customerData.id)
                .order('created_at', { ascending: false });

            if (error) throw error;  // Debug
            this.orders = data || [];  // Używamy tej samej zmiennej dla kompatybilności z resztą kodu
            this.updateStats();
            this.renderOrders();
        } catch (error) {
            console.error('Error loading estimates:', error);
            this.showError('Failed to load estimates');
        }
    }

    // Update statistics
    updateStats() {
        const estimates = this.orders.filter(o => ['sent', 'pending', 'draft', 'saved'].includes(o.status)).length;
        const active = this.orders.filter(o => ['approved', 'confirmed', 'in_production', 'ordered'].includes(o.status)).length;
        const completed = this.orders.filter(o => o.status === 'completed').length;

        document.getElementById('stat-estimates').textContent = estimates;
        document.getElementById('stat-orders').textContent = active;
        document.getElementById('stat-completed').textContent = completed;
    }

    // Render orders list
    renderOrders() {
        const container = document.getElementById('orders-container');
        
        // Filter orders based on current filter
        let filteredOrders = this.orders;
        if (this.currentFilter !== 'all') {
            filteredOrders = this.orders.filter(o => o.status === this.currentFilter);
        }

        if (filteredOrders.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📋</div>
                    <h3>No orders found</h3>
                    <p>Start by creating a new estimate for your windows</p>
                    <a href="online-estimate.html">
                        <button class="btn">Create Estimate</button>
                    </a>
                </div>
            `;
            return;
        }

        container.innerHTML = filteredOrders.map(order => this.renderOrderCard(order)).join('');
    }

    // Render single order card
    renderOrderCard(order) {
        const statusConfig = this.getStatusConfig(order.status);
        const createdDate = new Date(order.created_at).toLocaleDateString('en-GB');
        const itemCount = order.estimate_items?.length || 0;

        // Extras state (for Add Installation / Add Delivery buttons)
        const extras = order.estimate_extras || [];
        const hasInstallation = extras.some(e => e.type === 'installation');
        const hasDelivery = extras.some(e => e.type === 'delivery');
        const canEditExtras = ['draft', 'sent', 'pending', 'saved'].includes(order.status);

        // Gold color = #c9a96e (brand accent)
        const extraBtnBase = `font-family:'Jost',sans-serif;font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;padding:.45rem .9rem;cursor:pointer;border-radius:2px;transition:all .15s ease;`;
        const extraBtnOutline = `${extraBtnBase}background:#fff;border:1px solid #c9a96e;color:#c9a96e;`;
        const extraBtnSolid = `${extraBtnBase}background:#c9a96e;border:1px solid #c9a96e;color:#fff;`;
        const extraBtnDisabled = `${extraBtnBase}background:#f5f4f0;border:1px solid #e5e4dd;color:#9e9e90;cursor:not-allowed;`;

        const installationBtn = !canEditExtras
            ? `<button style="${extraBtnDisabled}" disabled title="Additional services cannot be changed at this stage">${hasInstallation ? '✓ Installation' : '+ Installation'}</button>`
            : hasInstallation
                ? `<button style="${extraBtnSolid}" onclick="event.stopPropagation();dashboard.toggleInstallation('${order.id}', true)" title="Click to remove">✓ Installation added</button>`
                : `<button style="${extraBtnOutline}" onclick="event.stopPropagation();dashboard.toggleInstallation('${order.id}', false)">+ Add Installation</button>`;

        const deliveryBtn = !canEditExtras
            ? `<button style="${extraBtnDisabled}" disabled title="Additional services cannot be changed at this stage">${hasDelivery ? '✓ Delivery' : '+ Delivery'}</button>`
            : hasDelivery
                ? `<button style="${extraBtnSolid}" onclick="event.stopPropagation();dashboard.toggleDelivery('${order.id}', true)" title="Click to remove">✓ Delivery added</button>`
                : `<button style="${extraBtnOutline}" onclick="event.stopPropagation();dashboard.toggleDelivery('${order.id}', false)">+ Add Delivery</button>`;

        return `
            <div class="estimate-card" data-order-id="${order.id}">
                <div class="estimate-header" onclick="this.parentElement.classList.toggle('open')">
                    <div>
                        <span class="estimate-title">Estimate #${order.estimate_number || order.id.substring(0, 8).toUpperCase()}${order.project_name ? ` — ${order.project_name}` : ''}</span>
                        <span class="estimate-meta"> — ${createdDate} — ${itemCount} window${itemCount !== 1 ? 's' : ''} — £${this.formatPrice(order.total_price)} + VAT</span>
                    </div>
                    <span class="estimate-status status-${order.status}">${statusConfig.label}</span>
                </div>
                <div class="estimate-body">
                    <div class="estimate-info-row">
                        <span class="lbl">Windows</span>
                        <span class="val">${itemCount} window${itemCount !== 1 ? 's' : ''}</span>
                    </div>
                    <div class="estimate-info-row">
                        <span class="lbl">Total Price</span>
                        <span class="val">£${this.formatPrice(order.total_price)} + VAT</span>
                    </div>
                    ${order.deposit_amount ? `
                    <div class="estimate-info-row">
                        <span class="lbl">Deposit</span>
                        <span class="val">£${this.formatPrice(order.deposit_amount)} ${order.deposit_paid ? '✓ Paid' : '— Pending'}</span>
                    </div>
                    ` : ''}
                    <div class="estimate-info-row">
                        <span class="lbl">Status</span>
                        <span class="val">${statusConfig.label}</span>
                    </div>
                    ${this.renderOrderProgress(order)}
                    <div class="estimate-actions" style="display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;">
                        ${installationBtn}
                        ${deliveryBtn}
                        <button class="btn-sm" onclick="dashboard.viewOrderDetails('${order.id}')">View Details</button>
                        <button class="btn-sm danger" onclick="dashboard.deleteEstimate('${order.id}')">Delete</button>
                    </div>
                </div>
            </div>
        `;
    }

    // Render order progress timeline
    renderOrderProgress(order) {
        const timeline = [
            { status: 'sent', label: 'Sent' },
            { status: 'confirmed', label: 'Confirmed' },
            { status: 'in_production', label: 'Production' },
            { status: 'completed', label: 'Completed' }
        ];

        const currentIndex = timeline.findIndex(t => t.status === order.status);

        return `
            <div class="timeline">
                ${timeline.map((step, index) => `
                    <div class="timeline-step ${index <= currentIndex ? 'active' : ''}">
                        <div class="timeline-dot"></div>
                        <div class="timeline-step-label">${step.label}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Get status configuration
    getStatusConfig(status) {
        const configs = {
            draft: { label: 'Sent', color: '#17a2b8' },
            saved: { label: 'Sent', color: '#17a2b8' },
            sent: { label: 'Sent — Under Review', color: '#17a2b8' },
            pending: { label: 'Pending Review', color: '#ffc107' },
            approved: { label: 'Approved', color: '#28a745' },
            confirmed: { label: 'Confirmed', color: '#28a745' },
            in_production: { label: 'In Production', color: '#007bff' },
            ordered: { label: 'In Production', color: '#007bff' },
            completed: { label: 'Completed', color: '#28a745' },
            cancelled: { label: 'Cancelled', color: '#dc3545' }
        };
        return configs[status] || configs.sent;
    }

    // Format price
    formatPrice(price) {
        return new Intl.NumberFormat('en-GB', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(price);
    }

    // View order details
    // View estimate details
    async viewOrderDetails(estimateId) {
        try {
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

            // Load extras (installation / delivery / custom) from DB
            try {
                data.extras = await EstimateExtras.load(estimateId);
            } catch (extrasErr) {
                console.warn('Failed to load extras, continuing with empty list:', extrasErr);
                data.extras = [];
            }

            this.showOrderModal(data);
        } catch (error) {
            console.error('Error loading estimate details:', error);
            this.showError('Failed to load estimate details');
        }
    }

    // Show order detail modal
    showOrderModal(estimate) {
        const modal = document.getElementById('order-modal');
        const content = document.getElementById('order-detail-content');

        const isEditable = ['draft', 'sent', 'quoted'].includes(estimate.status);
        content.innerHTML = EstimateRenderer.renderEstimateHTML(estimate, {
            isEditable,
            isAdmin: false
        });

        // === DIAGNOSTIC: check if buttons exist and have onclick ===
        const allBtns = content.querySelectorAll('button');
        allBtns.forEach((btn, i) => {
        });
        // === EVENT DELEGATION BACKUP: catch clicks on Delete/Rename buttons ===
        content.addEventListener('click', function(e) {
            const btn = e.target.closest('button');
            if (!btn) return;
            const onclickAttr = btn.getAttribute('onclick');
        });

        modal.style.display = 'flex';
        EstimateRenderer.attachExportButtons(estimate);
    }

    // Format price
    formatPrice(price) {
        return EstimateRenderer.formatPrice(price);
    }

    // Get status config
    getStatusConfig(status) {
        return EstimateRenderer.getStatusConfig(status);
    }



    // Close modal
    closeModal() {
        document.getElementById('order-modal').style.display = 'none';
    }

    // Delete estimate
    // Toggle Installation (add or remove)
    async toggleInstallation(estimateId, currentlyAdded) {
        try {
            if (currentlyAdded) {
                if (!confirm('Remove installation from this estimate?')) return;
                await EstimateExtras.removeByType(estimateId, 'installation');
                this.showSuccessMessage('Installation removed');
            } else {
                const order = this.orders.find(o => o.id === estimateId);
                if (!order) throw new Error('Estimate not found');
                const items = order.estimate_items || [];
                const totalQty = items.reduce((s, i) => s + (parseInt(i.quantity) || 1), 0);
                if (totalQty < 1) {
                    this.showError('Cannot add installation: no windows in estimate');
                    return;
                }
                await EstimateExtras.addInstallation(estimateId, items);
                const totalPrice = items.reduce((s, item) => {
                    const qty = parseInt(item.quantity) || 1;
                    let spec = {};
                    try { spec = typeof item.specification === 'string' ? JSON.parse(item.specification) : (item.specification || {}); } catch(e) {}
                    const fc = spec.fullConfig || spec;
                    const wType = fc.windowType || fc.windowCategory || 'sash';
                    const rate = wType === 'casement' ? 250 : wType === 'fix-only' ? 200 : wType === 'door' ? 450 : 400;
                    return s + (qty * rate);
                }, 0);
                this.showSuccessMessage(`Installation added (${totalQty} windows — £${totalPrice.toLocaleString()})`);
            }
            await this.loadEstimates();
        } catch (error) {
            console.error('Error toggling installation:', error);
            this.showError(error.message || 'Failed to update installation');
        }
    }

    // Toggle Delivery (add or remove)
    async toggleDelivery(estimateId, currentlyAdded) {
        try {
            if (currentlyAdded) {
                if (!confirm('Remove delivery from this estimate?')) return;
                await EstimateExtras.removeByType(estimateId, 'delivery');
                this.showSuccessMessage('Delivery removed');
            } else {
                const order = this.orders.find(o => o.id === estimateId);
                const items = order ? (order.estimate_items || []) : [];
                const totalQty = items.reduce((s, i) => s + (parseInt(i.quantity) || 1), 0);
                await EstimateExtras.addDelivery(estimateId, totalQty);
                const extraWindows = Math.max(0, totalQty - 10);
                const deliveryPrice = 300 + (extraWindows * 30);
                this.showSuccessMessage(`Delivery added (£${deliveryPrice}${extraWindows > 0 ? ` — includes £${extraWindows * 30} surcharge for ${extraWindows} extra windows` : ''})`);
            }
            await this.loadEstimates();
        } catch (error) {
            console.error('Error toggling delivery:', error);
            this.showError(error.message || 'Failed to update delivery');
        }
    }

    async deleteEstimate(estimateId) {
        if (!confirm('Are you sure you want to delete this estimate? This action cannot be undone.')) {
            return;
        }

        try {
            // First delete estimate_extras (because of foreign key)
            const { error: extrasError } = await supabaseClient
                .from('estimate_extras')
                .delete()
                .eq('estimate_id', estimateId);
            if (extrasError) throw extrasError;
            // Then delete estimate_items (because of foreign key)
            const { error: itemsError } = await supabaseClient
                .from('estimate_items')
                .delete()
                .eq('estimate_id', estimateId);
            if (itemsError) throw itemsError;
            // Then delete the estimate
            const { error: estimateError } = await supabaseClient
                .from('estimates')
                .delete()
                .eq('id', estimateId);
            if (estimateError) throw estimateError;
            this.showSuccessMessage('Estimate deleted successfully');
            await this.loadEstimates();
        } catch (error) {
            console.error('=== DELETE ESTIMATE FAILED ===', error);
            this.showError('Failed to delete estimate');
        }
    }

    // Rename window in estimate
    async renameWindow(itemId, currentName, estimateId) {
        const newName = prompt('Enter new window name:', currentName);
        if (!newName || newName.trim() === '' || newName.trim() === currentName) return;

        try {
            const { error } = await supabaseClient
                .from('estimate_items')
                .update({ window_number: newName.trim() })
                .eq('id', itemId);

            if (error) throw error;

            this.showSuccessMessage(`Window renamed to "${newName.trim()}"`);
            // Reload modal
            await this.viewOrderDetails(estimateId);
        } catch (error) {
            console.error('Error renaming window:', error);
            this.showError('Failed to rename window');
        }
    }

    // Delete window from estimate
    async deleteWindow(itemId, estimateId) {
        if (!confirm('Are you sure you want to delete this window? This action cannot be undone.')) {
            return;
        }

        try {
            // Get the item price before deleting
            const { data: item, error: fetchError } = await supabaseClient
                .from('estimate_items')
                .select('total_price, quantity')
                .eq('id', itemId)
                .single();

            if (fetchError) throw fetchError;

            // Delete the item
            const { error: deleteError } = await supabaseClient
                .from('estimate_items')
                .delete()
                .eq('id', itemId);

            if (deleteError) throw deleteError;

            // Get remaining items to recalculate total
            const { data: remaining, error: remainError } = await supabaseClient
                .from('estimate_items')
                .select('total_price')
                .eq('estimate_id', estimateId);

            if (remainError) throw remainError;

            const newTotal = remaining.reduce((sum, r) => sum + (parseFloat(r.total_price) || 0), 0);

            // Update estimate total
            const { error: updateError } = await supabaseClient
                .from('estimates')
                .update({ 
                    total_price: newTotal,
                    updated_at: new Date().toISOString()
                })
                .eq('id', estimateId);

            if (updateError) throw updateError;

            // Check if no windows left
            if (remaining.length === 0) {
                this.closeModal();
                this.showSuccessMessage('Last window deleted. Estimate is now empty.');
                await this.loadEstimates();
            } else {
                this.showSuccessMessage('Window deleted successfully');
                await this.viewOrderDetails(estimateId);
            }
        } catch (error) {
            console.error('Error deleting window:', error);
            this.showError('Failed to delete window');
        }
    }

    // Submit estimate for quote (change status from draft to sent)
    async submitEstimate(estimateId) {
        if (!confirm('Submit this estimate for a quote? Our team will review it and send you a formal quotation.')) {
            return;
        }

        try {
            const { error } = await supabaseClient
                .from('estimates')
                .update({ 
                    status: 'sent',
                    updated_at: new Date().toISOString()
                })
                .eq('id', estimateId);

            if (error) throw error;

            alert('Estimate submitted successfully! We will send you a quote shortly.');
            this.closeModal();
            await this.loadEstimates();
        } catch (error) {
            console.error('Error submitting estimate:', error);
            this.showError('Failed to submit estimate');
        }
    }


    

    // Place order (change status from saved to pending)
    async placeOrder(orderId) {
        if (!confirm('Are you sure you want to place this order? Our team will contact you shortly to arrange measurements.')) {
            return;
        }

        try {
            const { error } = await supabaseClient
                .from('orders')
                .update({ status: 'pending' })
                .eq('id', orderId);

            if (error) throw error;

            // Add timeline event
            await supabaseClient
                .from('order_timeline')
                .insert([{
                    order_id: orderId,
                    status_change: 'Order placed by customer - awaiting contact',
                    created_at: new Date().toISOString()
                }]);

            alert('Order placed successfully! We will contact you soon to arrange measurements.');
            await this.loadOrders();
        } catch (error) {
            console.error('Error placing order:', error);
            this.showError('Failed to place order');
        }
    }

    // Add line details for deposit invoice
    async addLineDetailsForDeposit(orderId) {
        // TODO: Implement modal or form to add line items and details
        // For now, placeholder alert
        alert('Add line items and details for deposit invoice. Feature coming soon - contact admin for manual processing.');
        // This would open a modal where customer can add:
        // - Additional line items
        // - Special requirements
        // - Delivery details
        // Then admin creates invoice for deposit
    }

    // Pay deposit (placeholder - would integrate with payment gateway)
    async payDeposit(orderId) {
        alert('Payment integration coming soon. Please contact us to arrange deposit payment.');
        // TODO: Integrate with Stripe/PayPal
    }

    // Attach event listeners
    attachEventListeners() {
        // Logout button
        var logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await supabaseClient.auth.signOut();
                window.location.href = 'index.html';
            });
        }

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentFilter = btn.dataset.filter;
                this.renderOrders();
            });
        });

        // Modal close
        document.querySelector('.modal-close').addEventListener('click', () => {
            this.closeModal();
        });

        // Click outside modal to close
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('order-modal');
            if (e.target === modal) {
                this.closeModal();
            }
        });
    }

    // Show error message
    showError(message) {
        alert(message); // Simple for now, can be improved with toast notifications
    }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new CustomerDashboard();
});