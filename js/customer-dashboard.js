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

            console.log(`Found ${savedEstimates.length} estimates in localStorage, importing...`);

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

            console.log(`Successfully imported ${data.length} estimates`);

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

            this.customerData = data;
            console.log('Customer data loaded:', data);  // Debug
            this.updateCustomerInfo();
        } catch (error) {
            console.error('Error loading customer data:', error);
            this.showError('Failed to load customer information');
        }
    }

    // Update customer info in UI
    updateCustomerInfo() {
        if (!this.customerData) return;

        document.getElementById('customer-name').textContent = 
            `Welcome Back, ${this.customerData.full_name.split(' ')[0]}`;
        document.getElementById('customer-fullname').textContent = this.customerData.full_name;
        document.getElementById('customer-email').textContent = this.customerData.email;
        document.getElementById('customer-phone').textContent = this.customerData.phone || 'Not provided';
        
        const memberSince = new Date(this.customerData.created_at);
        document.getElementById('customer-since').textContent = 
            memberSince.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
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
                    estimate_items (*)
                `)
                .eq('customer_id', this.customerData.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            console.log('Estimates loaded:', data);  // Debug
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
        const drafts = this.orders.filter(o => o.status === 'draft').length;
        const sent = this.orders.filter(o => o.status === 'sent').length;
        const approved = this.orders.filter(o => o.status === 'approved').length;

        document.getElementById('stat-estimates').textContent = drafts + sent;  // Draft + Sent = Total Estimates
        document.getElementById('stat-orders').textContent = approved;  // Approved = Ready for Production
        document.getElementById('stat-completed').textContent = this.orders.filter(o => o.status === 'ordered').length;  // Ordered
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
        
        // Check if estimate is in draft/saved state - admin cannot see it
        const isDraft = order.status === 'draft' || order.status === 'saved';
        
        // Warning message for draft estimates
        const draftWarning = isDraft ? `
            <div class="draft-warning" style="
                background: #fff3cd;
                border: 2px solid #ffc107;
                border-radius: 8px;
                padding: 12px 15px;
                margin-bottom: 15px;
                text-align: center;
            ">
                <p style="margin: 0 0 8px 0; color: #856404; font-weight: 600;">
                    ⚠️ This estimate is NOT visible to our team yet!
                </p>
                <p style="margin: 0 0 12px 0; color: #856404; font-size: 0.9rem;">
                    Click "Submit for Quote" to send it for review and receive a formal quotation.
                </p>
                <button class="btn" onclick="dashboard.submitEstimate('${order.id}')" style="
                    background: #28a745;
                    padding: 10px 25px;
                    font-size: 1rem;
                ">
                    📤 Submit for Quote
                </button>
            </div>
        ` : '';

        return `
            <div class="order-card" data-order-id="${order.id}">
                <div class="order-header">
                    <div>
                        <h3>Estimate #${order.estimate_number || order.id.substring(0, 8).toUpperCase()}</h3>
                        <p class="order-date">Created: ${createdDate}</p>
                    </div>
                    <span class="status-badge status-${order.status}">${statusConfig.label}</span>
                </div>

                <div class="order-body">
                    ${draftWarning}
                    
                    <div class="order-info">
                        <div class="info-row">
                            <span class="info-label">Windows:</span>
                            <span class="info-value">${itemCount} window${itemCount !== 1 ? 's' : ''}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Total:</span>
                            <span class="info-value price">£${this.formatPrice(order.total_price)}</span>
                        </div>
                        ${order.deposit_amount ? `
                        <div class="info-row">
                            <span class="info-label">Deposit:</span>
                            <span class="info-value ${order.deposit_paid ? 'paid' : 'unpaid'}">
                                £${this.formatPrice(order.deposit_amount)} 
                                ${order.deposit_paid ? '✓ Paid' : '⚠ Pending'}
                            </span>
                        </div>
                        ` : ''}
                    </div>

                    ${this.renderOrderProgress(order)}
                </div>

                <div class="order-footer">
                    <button class="btn-secondary" onclick="dashboard.viewOrderDetails('${order.id}')">
                        View Details
                    </button>
                    ${order.status === 'saved' ? `
                        <button class="btn" onclick="dashboard.placeOrder('${order.id}')">
                            Place Order
                        </button>
                    ` : ''}
                    ${order.status === 'sent' || order.status === 'approved' ? `
                        <button class="btn" onclick="dashboard.addLineDetailsForDeposit('${order.id}')">
                            Add line & details to send invoice for deposit
                        </button>
                    ` : ''}
                    <button class="btn-danger" onclick="dashboard.deleteEstimate('${order.id}')">
                        Delete
                    </button>
                </div>
            </div>
        `;
    }

    // Render order progress timeline
    renderOrderProgress(order) {
        const isDraft = order.status === 'draft' || order.status === 'saved';
        
        const timeline = [
            { status: 'draft', label: 'Saved Estimate', icon: '📋' },
            { status: 'sent', label: 'Submitted', icon: '📤' },
            { status: 'confirmed', label: 'Confirmed', icon: '✓' },
            { status: 'in_production', label: 'Production', icon: '🔨' },
            { status: 'completed', label: 'Completed', icon: '✅' }
        ];

        const currentIndex = timeline.findIndex(t => t.status === order.status);

        return `
            <div class="order-timeline">
                ${timeline.map((step, index) => {
                    // Special styling for Submit step when draft
                    const needsAction = isDraft && step.status === 'sent';
                    
                    return `
                        <div class="timeline-step ${index <= currentIndex ? 'active' : ''} ${index === currentIndex ? 'current' : ''} ${needsAction ? 'needs-action' : ''}">
                            <div class="timeline-icon">${step.icon}</div>
                            <div class="timeline-label">${step.label}</div>
                            ${needsAction ? '<div class="action-arrow" style="color: #dc3545; font-size: 0.75rem; font-weight: 600;">⬆ Click above</div>' : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    // Get status configuration
    getStatusConfig(status) {
        const configs = {
            draft: { label: 'DRAFT', color: '#6c757d' },
            saved: { label: 'DRAFT', color: '#6c757d' },
            sent: { label: 'Submitted - Awaiting Quote', color: '#17a2b8' },
            pending: { label: 'Pending Review', color: '#ffc107' },
            approved: { label: 'Approved', color: '#28a745' },
            confirmed: { label: 'Confirmed', color: '#28a745' },
            in_production: { label: 'In Production', color: '#007bff' },
            ordered: { label: 'In Production', color: '#007bff' },
            completed: { label: 'Completed', color: '#28a745' },
            cancelled: { label: 'Cancelled', color: '#dc3545' }
        };
        return configs[status] || configs.draft;
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
                    estimate_items (*)
                `)
                .eq('id', estimateId)
                .single();

            if (error) throw error;

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

        // Color to RAL mapping
        const colorRAL = {
            'Pure White': 'RAL 9016',
            'Jet Black': 'RAL 9005',
            'Anthracite Grey': 'RAL 7016',
            'Olive Green': 'RAL 6003',
            'Off-White': 'RAL 9010',
            'Cream': 'RAL 9001',
            'Burgundy Red': 'RAL 3005',
            'Royal Blue': 'RAL 5002'
        };

        const itemsHTML = estimate.estimate_items?.map(item => {
            // Parse ironmongery if it's a JSON string
            let ironmongeryDisplay = '';
            let ironmongeryThumbnails = '';
            if (item.ironmongery) {
                try {
                    const ironData = typeof item.ironmongery === 'string' ? JSON.parse(item.ironmongery) : item.ironmongery;
                    if (ironData && ironData.products) {
                        const productsList = Object.values(ironData.products).map(p => 
                            `${p.quantity}x ${p.product.name}`
                        ).join(', ');
                        ironmongeryDisplay = productsList;
                        
                        // Generate thumbnails
                        ironmongeryThumbnails = `
                            <div class="ironmongery-thumbnails" style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;">
                                ${Object.values(ironData.products).map(p => {
                                    const imgSrc = p.product.image_url || p.product.image || 'img/placeholder.png';
                                    const qty = p.quantity;
                                    return `
                                        <div style="position: relative; width: 50px; height: 50px;">
                                            <img src="${imgSrc}" 
                                                 style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; border: 1px solid #ddd;"
                                                 onerror="this.src='img/placeholder.png'"
                                                 title="${p.product.name}">
                                            ${qty > 1 ? `<span style="position: absolute; top: -5px; right: -5px; background: var(--primary-color, #0F3124); color: white; font-size: 10px; padding: 2px 5px; border-radius: 50%; min-width: 16px; text-align: center;">${qty}</span>` : ''}
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        `;
                    }
                } catch(e) {
                    ironmongeryDisplay = typeof item.ironmongery === 'string' ? item.ironmongery : JSON.stringify(item.ironmongery);
                }
            }

            // Get measurement type display text
            const measurementDisplay = item.measurement_type === 'brick-to-brick' ? 'Brick-to-Brick' : 
                                      item.measurement_type === 'box-to-box' ? 'Box-to-Box' : 
                                      item.measurement_type === 'sight-size' ? 'Sight Size' : 
                                      'Framed Dimension';

            return `
            <div class="order-item-detail">
                <h4>Window ${item.window_number}</h4>
                <div class="item-specs">
                    <p><strong>${measurementDisplay}:</strong> ${item.width}mm × ${item.height}mm</p>
                    ${item.original_width && item.original_height && (item.original_width !== item.width || item.original_height !== item.height) ? 
                        `<p><strong>Original Dimensions:</strong> ${item.original_width}mm × ${item.original_height}mm</p>` : ''
                    }
                    <p><strong>Frame:</strong> ${item.frame_type} (164mm deep)</p>
                    <p><strong>Glass:</strong> ${item.glass_type}${item.glass_type === 'double' ? ' (standard 4x16x4mm, U-value 1.4)' : ''}</p>
                    ${item.glass_spec ? `<p><strong>Glass Spec:</strong> ${item.glass_spec}</p>` : ''}
                    ${item.glass_finish && item.glass_finish !== 'clear' ? `<p><strong>Glass Finish:</strong> ${item.glass_finish}</p>` : ''}
                    ${item.frosted_location ? `<p><strong>Frosted Location:</strong> ${item.frosted_location}</p>` : ''}
                    ${item.opening_type ? `<p><strong>Opening:</strong> ${item.opening_type}</p>` : ''}
                    ${item.color_type === 'single' ? 
                        `<p><strong>Color:</strong> ${item.color_single}${colorRAL[item.color_single] ? ' (' + colorRAL[item.color_single] + ')' : ''}</p>` : 
                        `<p><strong>Interior:</strong> ${item.color_interior}${colorRAL[item.color_interior] ? ' (' + colorRAL[item.color_interior] + ')' : ''}<br><strong>Exterior:</strong> ${item.color_exterior}${colorRAL[item.color_exterior] ? ' (' + colorRAL[item.color_exterior] + ')' : ''}${item.custom_exterior_color ? ' [Custom: ' + item.custom_exterior_color + ']' : ''}</p>`
                    }
                    ${item.upper_bars || item.lower_bars ? 
                        `<p><strong>Georgian Bars:</strong> Upper: ${item.upper_bars || 'None'}, Lower: ${item.lower_bars || 'None'}</p>` : ''
                    }
                    ${item.horns ? `<p><strong>Horns:</strong> ${item.horns}</p>` : ''}
                    ${ironmongeryDisplay ? `<p><strong>Ironmongery:</strong> ${ironmongeryDisplay}</p>${ironmongeryThumbnails}` : ''}
                    ${item.ironmongery_finish ? `<p><strong>Ironmongery Finish:</strong> ${item.ironmongery_finish}</p>` : ''}
                    ${item.pas24 ? `<p><strong>PAS24:</strong> Yes ✓</p>` : ''}
                    <p><strong>Quantity:</strong> ${item.quantity}</p>
                    <p class="item-price"><strong>Price:</strong> £${this.formatPrice(item.total_price)}</p>
                </div>
            </div>
        `}).join('') || '<p>No windows in this estimate</p>';

        content.innerHTML = `
            <h2>Estimate ${estimate.estimate_number || estimate.id.substring(0, 8).toUpperCase()}</h2>
            <div class="detail-status">
                <span class="status-badge status-${estimate.status}">${this.getStatusConfig(estimate.status).label}</span>
            </div>
            
            ${estimate.project_name ? `
            <div class="detail-section">
                <h3>Project Information</h3>
                <p><strong>Project:</strong> ${estimate.project_name}</p>
                ${estimate.delivery_address ? `<p><strong>Address:</strong> ${estimate.delivery_address}</p>` : ''}
                ${estimate.notes ? `<p><strong>Notes:</strong> ${estimate.notes}</p>` : ''}
            </div>
            ` : ''}
            
            <div class="detail-section">
                <h3>Windows (${estimate.estimate_items?.length || 0})</h3>
                ${itemsHTML}
            </div>

            <div class="detail-section">
                <h3>Estimate Summary</h3>
                <div class="summary-row total">
                    <span><strong>Total Price:</strong></span>
                    <span><strong>£${this.formatPrice(estimate.total_price)}</strong></span>
                </div>
                ${estimate.valid_until ? `
                <div class="summary-row">
                    <span>Valid Until:</span>
                    <span>${new Date(estimate.valid_until).toLocaleDateString('en-GB')}</span>
                </div>
                ` : ''}
            </div>

            <div class="modal-actions">
                ${estimate.status === 'draft' ? `
                    <button class="btn" onclick="dashboard.submitEstimate('${estimate.id}')">
                        Submit for Quote
                    </button>
                ` : ''}
                <button class="btn btn-secondary" id="download-estimate-pdf">
                    📄 Download PDF
                </button>
                <button class="btn btn-secondary" id="download-estimate-excel">
                    📊 Download Excel
                </button>
                <button class="btn-secondary" onclick="dashboard.closeModal()">
                    Close
                </button>
            </div>
        `;

        modal.style.display = 'block';
        
        // Attach PDF download listener
        const pdfBtn = document.getElementById('download-estimate-pdf');
        if (pdfBtn) {
            pdfBtn.addEventListener('click', () => this.downloadEstimatePDF(estimate));
        }
        
        // Attach Excel download listener
        const excelBtn = document.getElementById('download-estimate-excel');
        if (excelBtn) {
            excelBtn.addEventListener('click', () => this.downloadEstimateExcel(estimate));
        }
    }

    // Close modal
    closeModal() {
        document.getElementById('order-modal').style.display = 'none';
    }

    // Delete estimate
    async deleteEstimate(estimateId) {
        if (!confirm('Are you sure you want to delete this estimate? This action cannot be undone.')) {
            return;
        }

        try {
            // First delete estimate_items (because of foreign key)
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
            console.error('Error deleting estimate:', error);
            this.showError('Failed to delete estimate');
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

    // Download estimate as PDF
    async downloadEstimatePDF(estimate) {
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Header
            doc.setFontSize(20);
            doc.setTextColor(15, 49, 36); // Primary color
            doc.text('Skylon Timber & Glazing', 105, 20, { align: 'center' });
            
            doc.setFontSize(14);
            doc.setTextColor(0, 0, 0);
            doc.text(`Estimate: ${estimate.estimate_number || estimate.id.substring(0, 8).toUpperCase()}`, 105, 30, { align: 'center' });
            
            // Project info
            let yPos = 45;
            doc.setFontSize(11);
            if (estimate.project_name) {
                doc.text(`Project: ${estimate.project_name}`, 14, yPos);
                yPos += 7;
            }
            if (estimate.delivery_address) {
                doc.text(`Address: ${estimate.delivery_address}`, 14, yPos);
                yPos += 7;
            }
            doc.text(`Date: ${new Date(estimate.created_at).toLocaleDateString('en-GB')}`, 14, yPos);
            yPos += 7;
            doc.text(`Status: ${this.getStatusConfig(estimate.status).label}`, 14, yPos);
            yPos += 15;
            
            // Windows table
            doc.setFontSize(12);
            doc.setTextColor(15, 49, 36);
            doc.text('Windows', 14, yPos);
            yPos += 5;
            
            const tableData = estimate.estimate_items?.map(item => {
                let ironmongeryText = '';
                if (item.ironmongery) {
                    try {
                        const ironData = typeof item.ironmongery === 'string' ? JSON.parse(item.ironmongery) : item.ironmongery;
                        if (ironData?.products) {
                            ironmongeryText = Object.values(ironData.products).map(p => `${p.quantity}x ${p.product.name}`).join(', ');
                        }
                    } catch(e) {}
                }
                
                return [
                    item.window_number,
                    `${item.width}mm × ${item.height}mm`,
                    `${item.frame_type}, ${item.glass_type}`,
                    item.color_type === 'single' ? item.color_single : `${item.color_interior}/${item.color_exterior}`,
                    ironmongeryText || '-',
                    item.quantity,
                    `£${this.formatPrice(item.total_price)}`
                ];
            }) || [];
            
            doc.autoTable({
                startY: yPos,
                head: [['Window', 'Size', 'Frame/Glass', 'Color', 'Ironmongery', 'Qty', 'Price']],
                body: tableData,
                headStyles: { fillColor: [15, 49, 36] },
                styles: { fontSize: 8 },
                columnStyles: {
                    0: { cellWidth: 20 },
                    4: { cellWidth: 40 }
                }
            });
            
            // Total
            const finalY = doc.lastAutoTable.finalY + 10;
            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            doc.text(`Total: £${this.formatPrice(estimate.total_price)}`, 196, finalY, { align: 'right' });
            
            // Footer
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            doc.text('Skylon Timber & Glazing | A trading name of Skylon Joinery LTD', 105, 285, { align: 'center' });
            doc.text('info@skylonjoinery.co.uk | 07842 510 060', 105, 290, { align: 'center' });
            
            // Download
            doc.save(`Estimate_${estimate.estimate_number || estimate.id.substring(0, 8)}.pdf`);
            
        } catch (error) {
            console.error('Error downloading PDF:', error);
            this.showError('Failed to download PDF: ' + error.message);
        }
    }
    
    // Download estimate as Excel
    downloadEstimateExcel(estimate) {
        try {
            // Prepare data
            const wsData = [
                ['Skylon Timber & Glazing - Estimate'],
                [''],
                ['Estimate Number:', estimate.estimate_number || estimate.id.substring(0, 8).toUpperCase()],
                ['Project:', estimate.project_name || '-'],
                ['Address:', estimate.delivery_address || '-'],
                ['Date:', new Date(estimate.created_at).toLocaleDateString('en-GB')],
                ['Status:', this.getStatusConfig(estimate.status).label],
                [''],
                ['Windows:'],
                ['Window', 'Width (mm)', 'Height (mm)', 'Frame', 'Glass', 'Color', 'Ironmongery', 'Qty', 'Price']
            ];
            
            estimate.estimate_items?.forEach(item => {
                let ironmongeryText = '';
                if (item.ironmongery) {
                    try {
                        const ironData = typeof item.ironmongery === 'string' ? JSON.parse(item.ironmongery) : item.ironmongery;
                        if (ironData?.products) {
                            ironmongeryText = Object.values(ironData.products).map(p => `${p.quantity}x ${p.product.name}`).join(', ');
                        }
                    } catch(e) {}
                }
                
                wsData.push([
                    item.window_number,
                    item.width,
                    item.height,
                    item.frame_type,
                    item.glass_type,
                    item.color_type === 'single' ? item.color_single : `${item.color_interior}/${item.color_exterior}`,
                    ironmongeryText || '-',
                    item.quantity,
                    item.total_price
                ]);
            });
            
            wsData.push(['']);
            wsData.push(['', '', '', '', '', '', '', 'TOTAL:', estimate.total_price]);
            
            // Create workbook
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            
            // Set column widths
            ws['!cols'] = [
                { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
                { wch: 12 }, { wch: 20 }, { wch: 35 }, { wch: 6 }, { wch: 12 }
            ];
            
            XLSX.utils.book_append_sheet(wb, ws, 'Estimate');
            
            // Download
            XLSX.writeFile(wb, `Estimate_${estimate.estimate_number || estimate.id.substring(0, 8)}.xlsx`);
            
        } catch (error) {
            console.error('Error downloading Excel:', error);
            this.showError('Failed to download Excel: ' + error.message);
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
        document.getElementById('logout-btn').addEventListener('click', async (e) => {
            e.preventDefault();
            await supabaseClient.auth.signOut();
            window.location.href = 'index.html';
        });

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