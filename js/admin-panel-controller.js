// Admin Dashboard New - Complete Workflow System

class AdminDashboard {
    constructor() {
        this.currentView = 'dashboard';
        this.currentUser = null;
        this.quotes = [];
        this.orders = [];
        this.customers = [];
        this.filters = {
            status: 'all',
            period: 'all',
            search: ''
        };
        this.init();
    }

    async init() {
        try {
            console.log('Admin Dashboard initializing...');
            
            // Check authentication
            const user = await getCurrentUser();
            if (!user) {
                window.location.href = 'index.html';
                return;
            }

            const isAdminUser = await isAdmin();
            if (!isAdminUser) {
                alert('Access denied. Admin privileges required.');
                window.location.href = 'index.html';
                return;
            }

            this.currentUser = user;
            
            // Load all data
            await this.loadAllData();
            
            // Setup event listeners
            this.attachEventListeners();
            
            console.log('Admin Dashboard initialized successfully');
        } catch (error) {
            console.error('Error initializing admin dashboard:', error);
            alert('Error loading admin dashboard: ' + error.message);
        }
    }

    // Load all data from database
    async loadAllData() {
        try {
            await Promise.all([
                this.loadQuotes(),
                this.loadOrders(),
                this.loadCustomers(),
                this.updateDashboard()
            ]);
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    // Load quotes from database
    async loadQuotes() {
        try {
            // Load from estimates table (customer creates estimates)
            const { data, error } = await supabaseClient
                .from('estimates')
                .select(`
                    *,
                    customers (full_name, email, phone)
                `)
                .in('status', ['draft', 'sent', 'quote_sent', 'confirmed', 'rejected'])
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error loading quotes:', error);
                throw error;
            }
            
            this.quotes = data || [];
            console.log('Quotes loaded from estimates:', this.quotes.length);
            
            // Map statuses to our workflow
            // 'draft' -> customer hasn't sent yet (admin doesn't see)
            // 'sent' -> NEW QUOTE REQUEST (customer sent to supplier)
            // 'quote_sent' -> QUOTE SENT (admin sent quote back to customer)
            // 'confirmed' -> CUSTOMER CONFIRMED (needs deposit invoice)
            
        } catch (error) {
            console.error('Error loading quotes:', error);
            this.quotes = [];
        }
    }

    // Load orders from database
    async loadOrders() {
        try {
            const { data, error } = await supabaseClient
                .from('orders')
                .select(`
                    *,
                    customers (full_name, email, phone)
                `)
                .in('status', ['deposit_invoice_sent', 'deposit_paid', 'in_production', 'ready_delivery', 'completed'])
                .order('created_at', { ascending: false });

            if (error) throw error;
            
            this.orders = data || [];
            console.log('Orders loaded:', this.orders.length);
        } catch (error) {
            console.error('Error loading orders:', error);
        }
    }

    // Load customers from database
    async loadCustomers() {
        try {
            const { data, error } = await supabaseClient
                .from('customers')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            
            this.customers = data || [];
            console.log('Customers loaded:', this.customers.length);
        } catch (error) {
            console.error('Error loading customers:', error);
        }
    }

    // Update dashboard view
    async updateDashboard() {
        // Update badges
        this.updateBadges();
        
        // Update today's stats
        this.updateTodayStats();
        
        // Update pipeline
        this.updatePipeline();
        
        // Update priority actions
        this.updatePriorityActions();
        
        // Update recent activity
        this.updateRecentActivity();
    }

    // Update navigation badges
    updateBadges() {
        const newQuotes = this.quotes.filter(q => q.status === 'sent').length;
        const needAction = this.quotes.filter(q => q.status === 'confirmed').length;
        
        document.getElementById('new-quotes-badge').textContent = newQuotes;
        document.getElementById('need-action-badge').textContent = needAction;
    }

    // Update today's statistics
    updateTodayStats() {
        const today = new Date().toISOString().split('T')[0];
        
        // New customers today
        const newCustomersToday = this.customers.filter(c => 
            c.created_at && c.created_at.split('T')[0] === today
        ).length;
        document.getElementById('new-customers-today').textContent = newCustomersToday;
        
        // New quote requests
        const newQuoteRequests = this.quotes.filter(q => q.status === 'quote_requested').length;
        document.getElementById('new-quote-requests').textContent = newQuoteRequests;
        
        // Need invoice (urgent)
        const needInvoice = this.quotes.filter(q => q.status === 'customer_confirmed').length;
        document.getElementById('need-invoice-count').textContent = needInvoice;
        
        // In production
        const inProduction = this.orders.filter(o => o.status === 'in_production').length;
        document.getElementById('in-production-count').textContent = inProduction;
    }

    // Update pipeline stages
    updatePipeline() {
        document.getElementById('stage-quote-requested').textContent = 
            this.quotes.filter(q => q.status === 'quote_requested').length;
        
        document.getElementById('stage-quote-sent').textContent = 
            this.quotes.filter(q => q.status === 'quote_sent').length;
        
        document.getElementById('stage-customer-confirmed').textContent = 
            this.quotes.filter(q => q.status === 'customer_confirmed').length;
        
        document.getElementById('stage-deposit-invoice-sent').textContent = 
            this.orders.filter(o => o.status === 'deposit_invoice_sent').length;
        
        document.getElementById('stage-in-production').textContent = 
            this.orders.filter(o => o.status === 'in_production').length;
    }

    // Update priority actions list
    updatePriorityActions() {
        const container = document.getElementById('priority-actions-list');
        const priorities = [];
        
        // Customer confirmed - need invoice
        const needInvoice = this.quotes.filter(q => q.status === 'customer_confirmed');
        if (needInvoice.length > 0) {
            priorities.push({
                text: `⚠️ ${needInvoice.length} ORDER${needInvoice.length > 1 ? 'S' : ''} CONFIRMED BY CUSTOMER - Generate & send deposit invoice`,
                action: 'need-action',
                urgent: true
            });
        }
        
        // New quote requests
        const newQuotes = this.quotes.filter(q => q.status === 'quote_requested');
        if (newQuotes.length > 0) {
            priorities.push({
                text: `🆕 ${newQuotes.length} NEW QUOTE REQUEST${newQuotes.length > 1 ? 'S' : ''} - Review & send quotes to customers`,
                action: 'new-quotes',
                urgent: false
            });
        }
        
        // Deposit received
        const depositPaid = this.orders.filter(o => o.status === 'deposit_paid');
        if (depositPaid.length > 0) {
            priorities.push({
                text: `💰 ${depositPaid.length} DEPOSIT${depositPaid.length > 1 ? 'S' : ''} RECEIVED - Confirm & send to production`,
                action: 'active-orders',
                urgent: false
            });
        }
        
        if (priorities.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666;">✅ No urgent actions required. Great job!</p>';
            return;
        }
        
        container.innerHTML = priorities.map(p => `
            <div class="priority-item ${p.urgent ? 'urgent' : ''}">
                <div class="priority-item-text">${p.text}</div>
                <div class="priority-item-action">
                    <button class="btn btn-small" onclick="adminDashboard.switchView('${p.action}')">
                        View
                    </button>
                </div>
            </div>
        `).join('');
    }

    // Update recent activity
    updateRecentActivity() {
        const container = document.getElementById('recent-activity-list');
        const allItems = [...this.quotes, ...this.orders]
            .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
            .slice(0, 10);
        
        if (allItems.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666;">No recent activity</p>';
            return;
        }
        
        container.innerHTML = allItems.map(item => {
            const time = this.formatTimeAgo(item.updated_at || item.created_at);
            const customerName = item.customers?.full_name || 'Unknown';
            const statusText = this.getStatusText(item.status);
            
            return `
                <div class="activity-item">
                    <div>
                        <strong>${customerName}</strong> - ${statusText}
                        <br><small style="color: #666;">${item.id}</small>
                    </div>
                    <div class="activity-time">${time}</div>
                </div>
            `;
        }).join('');
    }

    // Get status display text
    getStatusText(status) {
        const statusTexts = {
            // Estimates statuses (from customer)
            draft: 'Draft (Customer)',
            sent: 'New Quote Request',
            quote_sent: 'Quote Sent to Customer',
            confirmed: 'Customer Confirmed Order',
            rejected: 'Rejected',
            
            // Orders statuses (after deposit invoice)
            deposit_invoice_sent: 'Awaiting Deposit Payment',
            deposit_paid: 'Deposit Paid',
            in_production: 'In Production',
            ready_delivery: 'Ready for Delivery',
            completed: 'Completed'
        };
        return statusTexts[status] || status;
    }

    // Format time ago
    formatTimeAgo(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);
        
        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
        
        return date.toLocaleDateString();
    }

    // Format price
    formatPrice(price) {
        return new Intl.NumberFormat('en-GB', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(price);
    }

    // Switch view
    switchView(view) {
        // Hide all views
        document.querySelectorAll('.admin-view').forEach(v => v.classList.remove('active'));
        
        // Remove active from all nav buttons
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        
        // Show selected view
        document.getElementById(`${view}-view`).classList.add('active');
        document.querySelector(`[data-view="${view}"]`).classList.add('active');
        
        this.currentView = view;
        
        // Load view-specific data
        this.loadViewData(view);
    }

    // Load data for specific view
    loadViewData(view) {
        switch(view) {
            case 'dashboard':
                this.updateDashboard();
                break;
            case 'new-quotes':
                this.renderNewQuotes();
                break;
            case 'need-action':
                this.renderNeedAction();
                break;
            case 'all-quotes':
                this.renderAllQuotes();
                break;
            case 'active-orders':
                this.renderActiveOrders();
                break;
            case 'analytics':
                this.renderAnalytics();
                break;
            case 'customers':
                this.renderCustomers();
                break;
            case 'invoices':
                this.renderInvoices();
                break;
        }
    }

    // Render customers (placeholder)
    renderCustomers() {
        const container = document.getElementById('customers-list');
        container.innerHTML = '<p style="text-align: center; padding: 40px;">Customers list coming soon...</p>';
    }

    // Render invoices (placeholder)
    renderInvoices() {
        const container = document.getElementById('invoices-list');
        container.innerHTML = '<p style="text-align: center; padding: 40px;">Invoices list coming soon...</p>';
    }

    // Render new quotes
    renderNewQuotes() {
        const container = document.getElementById('new-quotes-list');
        const newQuotes = this.quotes.filter(q => q.status === 'quote_requested');
        
        if (newQuotes.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">No new quote requests</p>';
            return;
        }
        
        container.innerHTML = newQuotes.map(quote => this.renderQuoteCard(quote, true)).join('');
    }

    // Render need action
    renderNeedAction() {
        const container = document.getElementById('need-action-list');
        const needAction = this.quotes.filter(q => q.status === 'customer_confirmed');
        
        if (needAction.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">✅ No actions required</p>';
            return;
        }
        
        container.innerHTML = needAction.map(quote => this.renderQuoteCard(quote, true, true)).join('');
    }

    // Render quote card
    renderQuoteCard(quote, showActions = false, isUrgent = false) {
        const customer = quote.customers;
        const price = quote.total_price || 0;
        
        return `
            <div class="quote-card ${isUrgent ? 'urgent' : ''}">
                <div class="quote-header">
                    <div>
                        <div class="quote-id">${quote.id}</div>
                        <div style="font-size: 0.9rem; color: #666; margin-top: 3px;">
                            ${customer?.full_name || 'Unknown'} | ${customer?.email || ''}
                        </div>
                    </div>
                    <div class="quote-status ${isUrgent ? 'status-urgent' : 'status-new'}">
                        ${this.getStatusText(quote.status)}
                    </div>
                </div>
                <div class="quote-body">
                    <div class="quote-info-row">
                        <span>Created:</span>
                        <strong>${new Date(quote.created_at).toLocaleDateString()}</strong>
                    </div>
                    <div class="quote-info-row">
                        <span>Total Value:</span>
                        <strong style="color: var(--secondary-color); font-size: 1.1rem;">£${this.formatPrice(price)}</strong>
                    </div>
                    <div class="quote-info-row">
                        <span>Items:</span>
                        <strong>${quote.items?.length || 0} window(s)</strong>
                    </div>
                </div>
                ${showActions ? `
                    <div class="quote-actions">
                        <button class="btn btn-small" onclick="adminDashboard.viewQuoteDetail('${quote.id}')">
                            View Details
                        </button>
                        ${quote.status === 'quote_requested' ? `
                            <button class="btn btn-small" onclick="adminDashboard.sendQuote('${quote.id}')">
                                📤 Send Quote to Customer
                            </button>
                        ` : ''}
                        ${quote.status === 'customer_confirmed' ? `
                            <button class="btn btn-small" onclick="adminDashboard.generateDepositInvoice('${quote.id}')">
                                💰 Generate Deposit Invoice
                            </button>
                        ` : ''}
                    </div>
                ` : ''}
            </div>
        `;
    }

    // Render all quotes with filters
    renderAllQuotes() {
        const container = document.getElementById('all-quotes-list');
        
        // Apply filters
        let filteredQuotes = [...this.quotes];
        
        // Status filter
        const statusFilter = document.getElementById('quotes-status-filter')?.value || 'all';
        if (statusFilter !== 'all') {
            filteredQuotes = filteredQuotes.filter(q => q.status === statusFilter);
        }
        
        // Period filter
        const periodFilter = document.getElementById('quotes-period-filter')?.value || 'all';
        if (periodFilter !== 'all') {
            filteredQuotes = this.filterByPeriod(filteredQuotes, periodFilter);
        }
        
        // Search filter
        const searchFilter = document.getElementById('quotes-search')?.value.toLowerCase() || '';
        if (searchFilter) {
            filteredQuotes = filteredQuotes.filter(q => {
                const customer = q.customers;
                return (customer?.full_name?.toLowerCase().includes(searchFilter) ||
                        customer?.email?.toLowerCase().includes(searchFilter) ||
                        q.id?.toLowerCase().includes(searchFilter));
            });
        }
        
        // Calculate statistics
        this.updateQuotesSummary(filteredQuotes);
        
        // Render quotes
        if (filteredQuotes.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">No quotes found</p>';
            return;
        }
        
        container.innerHTML = filteredQuotes.map(quote => this.renderQuoteCard(quote, true)).join('');
        
        // Attach filter event listeners
        this.attachQuotesFilters();
    }

    // Filter by period
    filterByPeriod(items, period) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        switch(period) {
            case 'today':
                return items.filter(item => {
                    const date = new Date(item.created_at);
                    return date >= today;
                });
            case 'week':
                const weekAgo = new Date(today);
                weekAgo.setDate(weekAgo.getDate() - 7);
                return items.filter(item => new Date(item.created_at) >= weekAgo);
            case 'month':
                const monthAgo = new Date(today);
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                return items.filter(item => new Date(item.created_at) >= monthAgo);
            case 'year':
                const yearStart = new Date(now.getFullYear(), 0, 1);
                return items.filter(item => new Date(item.created_at) >= yearStart);
            default:
                return items;
        }
    }

    // Update quotes summary statistics
    updateQuotesSummary(quotes) {
        const totalCount = quotes.length;
        const totalValue = quotes.reduce((sum, q) => sum + (q.total_price || 0), 0);
        const avgValue = totalCount > 0 ? totalValue / totalCount : 0;
        
        // Calculate conversion rate (quotes that became orders)
        const convertedQuotes = quotes.filter(q => 
            ['customer_confirmed', 'deposit_invoice_sent', 'deposit_paid', 'in_production', 'completed'].includes(q.status)
        ).length;
        const conversionRate = totalCount > 0 ? (convertedQuotes / totalCount * 100) : 0;
        
        document.getElementById('total-quotes-count').textContent = totalCount;
        document.getElementById('total-quotes-value').textContent = `£${this.formatPrice(totalValue)}`;
        document.getElementById('avg-quotes-value').textContent = `£${this.formatPrice(avgValue)}`;
        document.getElementById('quotes-conversion-rate').textContent = `${conversionRate.toFixed(1)}%`;
    }

    // Attach quotes filters event listeners
    attachQuotesFilters() {
        const statusFilter = document.getElementById('quotes-status-filter');
        const periodFilter = document.getElementById('quotes-period-filter');
        const searchInput = document.getElementById('quotes-search');
        
        if (statusFilter && !statusFilter.dataset.listenerAttached) {
            statusFilter.addEventListener('change', () => this.renderAllQuotes());
            statusFilter.dataset.listenerAttached = 'true';
        }
        
        if (periodFilter && !periodFilter.dataset.listenerAttached) {
            periodFilter.addEventListener('change', () => this.renderAllQuotes());
            periodFilter.dataset.listenerAttached = 'true';
        }
        
        if (searchInput && !searchInput.dataset.listenerAttached) {
            searchInput.addEventListener('input', () => this.renderAllQuotes());
            searchInput.dataset.listenerAttached = 'true';
        }
    }

    // Render active orders
    renderActiveOrders() {
        const container = document.getElementById('active-orders-list');
        
        if (this.orders.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">No active orders</p>';
            return;
        }
        
        container.innerHTML = this.orders.map(order => this.renderOrderCard(order)).join('');
        
        // Attach filter buttons
        document.querySelectorAll('#active-orders-view .filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const filter = btn.dataset.filter;
                document.querySelectorAll('#active-orders-view .filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.filterOrders(filter);
            });
        });
    }

    // Render order card
    renderOrderCard(order) {
        const customer = order.customers;
        const price = order.total_price || 0;
        
        return `
            <div class="quote-card">
                <div class="quote-header">
                    <div>
                        <div class="quote-id">${order.id}</div>
                        <div style="font-size: 0.9rem; color: #666; margin-top: 3px;">
                            ${customer?.full_name || 'Unknown'} | ${customer?.email || ''}
                        </div>
                    </div>
                    <div class="quote-status status-sent">
                        ${this.getStatusText(order.status)}
                    </div>
                </div>
                <div class="quote-body">
                    <div class="quote-info-row">
                        <span>Created:</span>
                        <strong>${new Date(order.created_at).toLocaleDateString()}</strong>
                    </div>
                    <div class="quote-info-row">
                        <span>Total Value:</span>
                        <strong style="color: var(--secondary-color); font-size: 1.1rem;">£${this.formatPrice(price)}</strong>
                    </div>
                    <div class="quote-info-row">
                        <span>Items:</span>
                        <strong>${order.items?.length || 0} window(s)</strong>
                    </div>
                </div>
                <div class="quote-actions">
                    <button class="btn btn-small" onclick="adminDashboard.viewQuoteDetail('${order.id}')">
                        View Details
                    </button>
                    ${order.status === 'deposit_paid' ? `
                        <button class="btn btn-small" onclick="adminDashboard.sendToProduction('${order.id}')">
                            🏭 Send to Production
                        </button>
                    ` : ''}
                    ${order.status === 'in_production' ? `
                        <button class="btn btn-small" onclick="adminDashboard.markReadyForDelivery('${order.id}')">
                            ✅ Mark Ready for Delivery
                        </button>
                    ` : ''}
                    ${order.status === 'ready_delivery' ? `
                        <button class="btn btn-small" onclick="adminDashboard.markCompleted('${order.id}')">
                            ✅ Mark as Completed
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    // Filter orders
    filterOrders(filter) {
        const container = document.getElementById('active-orders-list');
        let filteredOrders = this.orders;
        
        if (filter !== 'all') {
            filteredOrders = this.orders.filter(o => o.status === filter);
        }
        
        if (filteredOrders.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">No orders in this category</p>';
            return;
        }
        
        container.innerHTML = filteredOrders.map(order => this.renderOrderCard(order)).join('');
    }

    // Send to production
    async sendToProduction(orderId) {
        if (!confirm('Send this order to production?')) return;
        
        try {
            const { error } = await supabaseClient
                .from('orders')
                .update({ status: 'in_production', updated_at: new Date().toISOString() })
                .eq('id', orderId);
            
            if (error) throw error;
            
            alert('Order sent to production!');
            await this.loadAllData();
        } catch (error) {
            console.error('Error:', error);
            alert('Error: ' + error.message);
        }
    }

    // Mark ready for delivery
    async markReadyForDelivery(orderId) {
        if (!confirm('Mark this order as ready for delivery?')) return;
        
        try {
            const { error } = await supabaseClient
                .from('orders')
                .update({ status: 'ready_delivery', updated_at: new Date().toISOString() })
                .eq('id', orderId);
            
            if (error) throw error;
            
            alert('Order marked as ready for delivery!');
            await this.loadAllData();
        } catch (error) {
            console.error('Error:', error);
            alert('Error: ' + error.message);
        }
    }

    // Mark completed
    async markCompleted(orderId) {
        if (!confirm('Mark this order as completed?')) return;
        
        try {
            const { error } = await supabaseClient
                .from('orders')
                .update({ status: 'completed', updated_at: new Date().toISOString() })
                .eq('id', orderId);
            
            if (error) throw error;
            
            alert('Order completed!');
            await this.loadAllData();
        } catch (error) {
            console.error('Error:', error);
            alert('Error: ' + error.message);
        }
    }

    // Render analytics
    renderAnalytics() {
        // Default period: month
        const activePeriod = document.querySelector('.period-btn.active')?.dataset.period || 'month';
        this.loadAnalyticsData(activePeriod);
        
        // Attach period selector listeners
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                if (btn.dataset.period === 'custom') {
                    document.querySelector('.date-range').style.display = 'flex';
                } else {
                    document.querySelector('.date-range').style.display = 'none';
                    this.loadAnalyticsData(btn.dataset.period);
                }
            });
        });
    }

    // Load analytics data
    loadAnalyticsData(period) {
        // Get all items for the period
        const allItems = [...this.quotes, ...this.orders];
        const filteredItems = this.filterByPeriod(allItems, period);
        
        // Calculate revenue
        const quotesRevenue = filteredItems
            .filter(i => ['saved', 'quote_requested', 'quote_sent'].includes(i.status))
            .reduce((sum, i) => sum + (i.total_price || 0), 0);
        
        const ordersRevenue = filteredItems
            .filter(i => ['customer_confirmed', 'deposit_invoice_sent', 'deposit_paid', 'in_production', 'ready_delivery', 'completed'].includes(i.status))
            .reduce((sum, i) => sum + (i.total_price || 0), 0);
        
        const totalRevenue = quotesRevenue + ordersRevenue;
        
        // Conversion rate
        const totalQuotes = filteredItems.filter(i => ['saved', 'quote_requested', 'quote_sent', 'customer_confirmed'].includes(i.status)).length;
        const convertedOrders = filteredItems.filter(i => ['customer_confirmed', 'deposit_invoice_sent', 'deposit_paid', 'in_production', 'ready_delivery', 'completed'].includes(i.status)).length;
        const conversionRate = totalQuotes > 0 ? (convertedOrders / totalQuotes * 100) : 0;
        
        // Average order value
        const completedOrders = filteredItems.filter(i => i.status === 'completed');
        const avgOrderValue = completedOrders.length > 0 
            ? completedOrders.reduce((sum, i) => sum + (i.total_price || 0), 0) / completedOrders.length 
            : 0;
        
        // New customers in period
        const newCustomers = this.filterByPeriod(this.customers, period).length;
        
        // Update UI
        document.getElementById('total-revenue').textContent = `£${this.formatPrice(totalRevenue)}`;
        document.getElementById('quotes-revenue').textContent = `£${this.formatPrice(quotesRevenue)}`;
        document.getElementById('orders-revenue').textContent = `£${this.formatPrice(ordersRevenue)}`;
        document.getElementById('conversion-rate').textContent = `${conversionRate.toFixed(1)}%`;
        document.getElementById('avg-order-value').textContent = `£${this.formatPrice(avgOrderValue)}`;
        document.getElementById('new-customers-period').textContent = newCustomers;
        
        // Render detailed stats table
        this.renderAnalyticsTable();
    }

    // Render analytics table
    renderAnalyticsTable() {
        const tbody = document.getElementById('analytics-table-body');
        
        const metrics = [
            { name: 'Total Quotes', week: 0, month: 0, year: 0 },
            { name: 'Total Orders', week: 0, month: 0, year: 0 },
            { name: 'Revenue', week: 0, month: 0, year: 0 },
            { name: 'New Customers', week: 0, month: 0, year: 0 },
            { name: 'Conversion Rate', week: '0%', month: '0%', year: '0%' }
        ];
        
        // Calculate for each period
        ['week', 'month', 'year'].forEach(period => {
            const allItems = [...this.quotes, ...this.orders];
            const filtered = this.filterByPeriod(allItems, period);
            
            metrics[0][period] = filtered.filter(i => ['saved', 'quote_requested', 'quote_sent'].includes(i.status)).length;
            metrics[1][period] = filtered.filter(i => ['customer_confirmed', 'deposit_invoice_sent', 'deposit_paid', 'in_production', 'ready_delivery', 'completed'].includes(i.status)).length;
            metrics[2][period] = `£${this.formatPrice(filtered.reduce((sum, i) => sum + (i.total_price || 0), 0))}`;
            metrics[3][period] = this.filterByPeriod(this.customers, period).length;
            
            const quotes = metrics[0][period];
            const orders = metrics[1][period];
            metrics[4][period] = quotes > 0 ? `${(orders / quotes * 100).toFixed(1)}%` : '0%';
        });
        
        tbody.innerHTML = metrics.map(m => `
            <tr>
                <td><strong>${m.name}</strong></td>
                <td>${m.week}</td>
                <td>${m.month}</td>
                <td>${m.year}</td>
            </tr>
        `).join('');
    }

    // View quote detail (opens modal)
    viewQuoteDetail(quoteId) {
        const quote = this.quotes.find(q => q.id === quoteId) || this.orders.find(o => o.id === quoteId);
        if (!quote) return;
        
        const modal = document.getElementById('quote-modal');
        const content = document.getElementById('quote-detail-content');
        
        content.innerHTML = this.renderQuoteDetail(quote);
        modal.classList.add('active');
    }

    // Render quote detail
    renderQuoteDetail(quote) {
        const customer = quote.customers;
        const price = quote.total_price || 0;
        const deposit = price * 0.3;
        
        return `
            <h2>Quote/Order Details</h2>
            <div style="background: var(--light-gray); padding: 15px; border-radius: 5px; margin: 15px 0;">
                <strong>ID:</strong> ${quote.id}<br>
                <strong>Status:</strong> ${this.getStatusText(quote.status)}<br>
                <strong>Created:</strong> ${new Date(quote.created_at).toLocaleString()}
            </div>
            
            <h3>Customer Information</h3>
            <div style="background: var(--light-gray); padding: 15px; border-radius: 5px; margin: 15px 0;">
                <strong>Name:</strong> ${customer?.full_name || 'Unknown'}<br>
                <strong>Email:</strong> ${customer?.email || 'N/A'}<br>
                <strong>Phone:</strong> ${customer?.phone || 'N/A'}
            </div>
            
            <h3>Order Details</h3>
            <div style="background: var(--light-gray); padding: 15px; border-radius: 5px; margin: 15px 0;">
                <strong>Items:</strong> ${quote.items?.length || 0} window(s)<br>
                <strong>Total Price:</strong> £${this.formatPrice(price)}<br>
                <strong>Deposit (30%):</strong> £${this.formatPrice(deposit)}<br>
                <strong>Balance:</strong> £${this.formatPrice(price - deposit)}
            </div>
            
            <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: center;">
                <button class="btn" onclick="adminDashboard.closeModal()">Close</button>
            </div>
        `;
    }

    // Close modal
    closeModal() {
        document.getElementById('quote-modal').classList.remove('active');
    }

    // Send quote to customer
    async sendQuote(quoteId) {
        if (!confirm('Send this quote to customer?')) return;
        
        try {
            // Update status
            const { error } = await supabaseClient
                .from('orders')
                .update({ status: 'quote_sent', updated_at: new Date().toISOString() })
                .eq('id', quoteId);
            
            if (error) throw error;
            
            // TODO: Send email to customer
            
            alert('Quote sent to customer successfully!');
            await this.loadAllData();
        } catch (error) {
            console.error('Error sending quote:', error);
            alert('Error sending quote: ' + error.message);
        }
    }

    // Generate deposit invoice
    async generateDepositInvoice(quoteId) {
        if (!confirm('Generate deposit invoice for this order?')) return;
        
        try {
            // Update status
            const { error } = await supabaseClient
                .from('orders')
                .update({ status: 'deposit_invoice_sent', updated_at: new Date().toISOString() })
                .eq('id', quoteId);
            
            if (error) throw error;
            
            // TODO: Generate PDF invoice and send email
            
            alert('Deposit invoice generated and sent to customer!');
            await this.loadAllData();
        } catch (error) {
            console.error('Error generating invoice:', error);
            alert('Error generating invoice: ' + error.message);
        }
    }

    // Filter by status from pipeline
    filterByStatus(status) {
        this.filters.status = status;
        this.switchView('all-quotes');
    }

    // Attach event listeners
    attachEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchView(btn.dataset.view);
            });
        });
        
        // Logout
        document.getElementById('admin-logout').addEventListener('click', async () => {
            await supabaseClient.auth.signOut();
            window.location.href = 'index.html';
        });
    }
}

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.adminDashboard = new AdminDashboard();
});