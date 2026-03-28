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

        return `
            <div class="estimate-card" data-order-id="${order.id}">
                <div class="estimate-header" onclick="this.parentElement.classList.toggle('open')">
                    <div>
                        <span class="estimate-title">Estimate #${order.estimate_number || order.id.substring(0, 8).toUpperCase()}</span>
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
                    <div class="estimate-actions">
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

        const isEditable = estimate.status === 'sent';
        const itemsHTML = estimate.estimate_items?.map(item => {
            // Parse specification and fullConfig (contains ALL real data)
            const spec = item.specification ? (typeof item.specification === 'string' ? JSON.parse(item.specification) : item.specification) : {};
            const fc = spec.fullConfig || spec || {};

            // IRONMONGERY — read from fullConfig if top-level is null
            let ironList = [];
            let ironSource = item.ironmongery;
            if (!ironSource && fc.ironmongery) {
                ironSource = fc.ironmongery;
            }
            if (ironSource) {
                try {
                    const ironData = typeof ironSource === 'string' ? JSON.parse(ironSource) : ironSource;
                    // Handle both formats: {products: {...}} and {lock: {...}, fingerLift: {...}}
                    const entries = ironData.products ? Object.values(ironData.products) : Object.values(ironData);
                    ironList = entries
                        .filter(p => p && p.name) // skip nulls (e.g. horns: null)
                        .map(p => ({
                            name: p.product ? p.product.name : p.name,
                            qty: p.quantity || 1,
                            img: p.product ? (p.product.image_url || p.product.image || '') : (p.image_url || p.image || ''),
                            color: p.product ? p.product.color : p.color
                        }));
                } catch(e) { console.warn('Ironmongery parse error:', e); }
            }

            // IRONMONGERY FINISH — derive from products if not set
            let hardwareFinish = item.ironmongery_finish || fc.ironmongeryFinish;
            if (!hardwareFinish && ironList.length > 0) {
                const colors = [...new Set(ironList.map(p => p.color).filter(Boolean))];
                hardwareFinish = colors.length > 0 ? colors.join(' / ') : null;
            }

            // COLOR — read actual color names from fullConfig
            let colorDisplay = '';
            if (item.color_type === 'single' || fc.colorType === 'single') {
                if (fc.singleColor && fc.singleColor !== 'custom' && fc.singleColor !== 'white') {
                    colorDisplay = fc.colorSingleName || fc.singleColor;
                } else if (fc.singleColor === 'white') {
                    colorDisplay = 'Pure White';
                } else if (spec.colorSingleName && spec.colorSingleName !== 'Custom Color') {
                    colorDisplay = spec.colorSingleName;
                } else if (fc.exteriorColor || fc.interiorColor) {
                    // "custom" but has actual colors in fullConfig
                    const ext = fc.exteriorColor || '—';
                    const int = fc.interiorColor || '—';
                    if (ext === int) {
                        colorDisplay = ext.charAt(0).toUpperCase() + ext.slice(1);
                    } else {
                        colorDisplay = `Ext: ${ext} / Int: ${int}`;
                    }
                } else {
                    colorDisplay = item.color_single || 'White';
                }
            } else {
                const extName = fc.colorExteriorName || fc.exteriorColor || item.color_exterior || '—';
                const intName = fc.colorInteriorName || fc.interiorColor || item.color_interior || '—';
                colorDisplay = `Ext: ${extName} / Int: ${intName}`;
                if (item.custom_exterior_color) colorDisplay += ` (Custom: ${item.custom_exterior_color})`;
            }

            // HORNS — read from fullConfig if null
            const horns = item.horns || fc.horns || 'none';

            // FROSTED — only show if glass_finish is NOT clear
            const glassFinish = item.glass_finish || fc.glassFinish || 'clear';
            const showFrosted = glassFinish !== 'clear' && item.frosted_location;

            // Opening display
            const openingLabels = { both: 'Both Sashes', bottom: 'Bottom Only', fixed: 'Fixed', top: 'Top Only' };
            const openingText = openingLabels[item.opening_type] || item.opening_type || '—';

            // Generate SVG window drawing
            const svg = this.generateWindowSVG(item);

            return `
            <div style="background:var(--cream2);border:1px solid rgba(158,158,144,.15);margin-bottom:1.5rem;padding:0;border-radius:2px;overflow:hidden;">
                <div style="background:var(--navy);padding:.8rem 1.5rem;display:flex;justify-content:space-between;align-items:center;">
                    <div style="display:flex;align-items:center;gap:.8rem;">
                        <span style="font-family:'Jost',sans-serif;font-size:.85rem;font-weight:500;letter-spacing:.15em;text-transform:uppercase;color:#fff;">Window ${item.window_number}</span>
                        ${isEditable ? `
                        <button onclick="dashboard.renameWindow('${item.id}','${(item.window_number || '').replace(/'/g, "\\'")}','${estimate.id}')" style="background:transparent;border:1px solid rgba(255,255,255,.25);color:rgba(255,255,255,.6);font-family:'Jost',sans-serif;font-size:.55rem;letter-spacing:.1em;text-transform:uppercase;padding:.2rem .5rem;cursor:pointer;border-radius:2px;">Rename</button>
                        <button onclick="dashboard.deleteWindow('${item.id}','${estimate.id}')" style="background:transparent;border:1px solid rgba(220,80,80,.4);color:rgba(220,80,80,.7);font-family:'Jost',sans-serif;font-size:.55rem;letter-spacing:.1em;text-transform:uppercase;padding:.2rem .5rem;cursor:pointer;border-radius:2px;">Delete</button>
                        ` : ''}
                    </div>
                    <span style="font-family:'Jost',sans-serif;font-size:.72rem;color:rgba(255,255,255,.5);">Qty: ${item.quantity} · £${this.formatPrice(item.total_price)} + VAT</span>
                </div>

                <div style="display:grid;grid-template-columns:220px 1fr;gap:0;">
                    <div style="padding:1.5rem;display:flex;align-items:center;justify-content:center;background:rgba(158,158,144,.04);border-right:1px solid rgba(158,158,144,.1);">
                        ${svg}
                    </div>

                    <div style="padding:1.5rem;">
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.3rem 2rem;">
                            ${item.original_width && item.original_height && (item.original_width !== item.width || item.original_height !== item.height) 
                                ? this.specRow('Window Size (Frame)', `${item.width}mm × ${item.height}mm`) + this.specRow('Structural Opening (Brick-to-Brick)', `${item.original_width}mm × ${item.original_height}mm`)
                                : this.specRow('Dimensions', `${item.width}mm × ${item.height}mm`)}
                            ${this.specRow('Frame', `${item.frame_type || 'standard'} (164mm)`)}
                            ${this.specRow('Opening', openingText)}
                            ${this.specRow('Glass', `${item.glass_type || 'double'}${item.glass_type === 'double' ? ' (4/16/4, U:1.4)' : item.glass_type === 'triple' ? ' (Triple)' : ''}`)}
                            ${item.glass_spec ? this.specRow('Glass Spec', item.glass_spec) : ''}
                            ${this.specRow('Spacer Bar', (() => { const s = item.spacer_color || 'silver'; const names = {'silver':'Silver (Stainless Steel)','white':'White','black':'Black'}; return names[s] || s; })())}
                            ${glassFinish !== 'clear' ? this.specRow('Glass Finish', glassFinish) : ''}
                            ${showFrosted ? this.specRow('Frosted', item.frosted_location) : ''}
                            ${this.specRow('Colour', colorDisplay)}
                            ${item.upper_bars && item.upper_bars !== 'none' ? this.specRow('Georgian Bars', `Upper: ${item.upper_bars}, Lower: ${item.lower_bars || item.upper_bars}`) : this.specRow('Georgian Bars', 'None')}
                            ${this.specRow('PAS24', item.pas24 ? 'Yes ✓' : 'No')}
                            ${horns && horns !== 'none' ? this.specRow('Horns', ({'A':'Richmond','D':'Type D'})[horns] || horns) : this.specRow('Horns', 'None')}
                            ${hardwareFinish ? this.specRow('Hardware Finish', hardwareFinish) : ''}
                        </div>

                        ${ironList.length > 0 ? `
                        <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid rgba(158,158,144,.15);">
                            <div style="font-family:'Jost',sans-serif;font-size:.60rem;letter-spacing:.2em;text-transform:uppercase;color:var(--silver);margin-bottom:.5rem;">Ironmongery</div>
                            <div style="display:flex;flex-wrap:wrap;gap:.8rem;">
                                ${ironList.map(p => `
                                    <div style="display:flex;align-items:center;gap:.5rem;font-family:'Jost',sans-serif;font-size:.78rem;color:var(--navy);">
                                        ${p.img ? `<img src="${p.img}" style="width:36px;height:36px;object-fit:cover;border:1px solid rgba(158,158,144,.2);border-radius:2px;" onerror="this.style.display='none'">` : ''}
                                        <span>${p.qty > 1 ? p.qty + 'x ' : ''}${p.name}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
            `;
        }).join('') || '<p style="text-align:center;color:var(--muted);padding:2rem;">No windows in this estimate</p>';

        content.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2rem;padding-bottom:1.5rem;border-bottom:1px solid rgba(158,158,144,.2);">
                <div>
                    <div style="font-family:'Jost',sans-serif;font-size:.50rem;letter-spacing:.5em;text-transform:uppercase;color:var(--silver);margin-bottom:.5rem;">Prime Sash Windows</div>
                    <div style="font-family:'Cormorant Garamond',serif;font-size:1.8rem;color:var(--navy);">Estimate ${estimate.estimate_number || ''}</div>
                    <div style="font-family:'Jost',sans-serif;font-size:.78rem;color:var(--muted);margin-top:.3rem;">
                        Created ${new Date(estimate.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })}
                        ${estimate.project_name ? ` · ${estimate.project_name}` : ''}
                    </div>
                </div>
                <span class="estimate-status status-${estimate.status}" style="font-size:.65rem;letter-spacing:.2em;text-transform:uppercase;padding:.4rem 1rem;">${this.getStatusConfig(estimate.status).label}</span>
            </div>

            ${estimate.delivery_address || estimate.notes ? `
            <div style="background:var(--cream2);padding:1.2rem 1.5rem;margin-bottom:2rem;border-left:3px solid var(--silver);">
                ${estimate.delivery_address ? `<div style="font-family:'Jost',sans-serif;font-size:.82rem;color:var(--muted);"><strong style="color:var(--navy);">Address:</strong> ${estimate.delivery_address}</div>` : ''}
                ${estimate.notes ? `<div style="font-family:'Jost',sans-serif;font-size:.82rem;color:var(--muted);margin-top:.3rem;"><strong style="color:var(--navy);">Notes:</strong> ${estimate.notes}</div>` : ''}
            </div>
            ` : ''}

            <div style="font-family:'Jost',sans-serif;font-size:.55rem;letter-spacing:.4em;text-transform:uppercase;color:var(--silver);margin-bottom:1rem;">Windows · ${estimate.estimate_items?.length || 0}</div>
            ${itemsHTML}

            <div style="display:flex;justify-content:flex-end;padding:1.5rem 0;border-top:2px solid var(--navy);margin-top:1rem;">
                <div style="text-align:right;">
                    <div style="display:flex;justify-content:space-between;gap:3rem;margin-bottom:.4rem;">
                        <span style="font-family:'Jost',sans-serif;font-size:.65rem;letter-spacing:.2em;text-transform:uppercase;color:var(--silver);">Subtotal (excl. VAT)</span>
                        <span style="font-family:'Jost',sans-serif;font-size:.9rem;color:var(--navy);">£${this.formatPrice(estimate.total_price)}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;gap:3rem;margin-bottom:.6rem;">
                        <span style="font-family:'Jost',sans-serif;font-size:.65rem;letter-spacing:.2em;text-transform:uppercase;color:var(--silver);">VAT (20%)</span>
                        <span style="font-family:'Jost',sans-serif;font-size:.9rem;color:var(--navy);">£${this.formatPrice(estimate.total_price * 0.2)}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;gap:3rem;padding-top:.6rem;border-top:1px solid rgba(158,158,144,.3);">
                        <span style="font-family:'Jost',sans-serif;font-size:.60rem;letter-spacing:.3em;text-transform:uppercase;color:var(--silver);">Total (incl. VAT)</span>
                        <span style="font-family:'Cormorant Garamond',serif;font-size:2rem;color:var(--navy);">£${this.formatPrice(estimate.total_price * 1.2)}</span>
                    </div>
                </div>
            </div>

            <div style="display:flex;gap:1rem;justify-content:center;padding-top:1.5rem;border-top:1px solid rgba(158,158,144,.15);">
                <button class="btn-sm" id="download-estimate-pdf">Download PDF</button>
                <button class="btn-sm" id="download-estimate-excel">Download Excel</button>
                <button class="btn-sm" onclick="dashboard.closeModal()">Close</button>
            </div>
        `;

        modal.style.display = 'flex';
        
        const pdfBtn = document.getElementById('download-estimate-pdf');
        if (pdfBtn) {
            pdfBtn.addEventListener('click', () => this.downloadEstimatePDF(estimate));
        }
        
        const excelBtn = document.getElementById('download-estimate-excel');
        if (excelBtn) {
            excelBtn.addEventListener('click', () => this.downloadEstimateExcel(estimate));
        }
    }

    // Generate spec row HTML
    specRow(label, value) {
        return `<div style="padding:.35rem 0;border-bottom:1px solid rgba(158,158,144,.08);">
            <div style="font-family:'Jost',sans-serif;font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;color:var(--silver);">${label}</div>
            <div style="font-family:'Jost',sans-serif;font-size:.82rem;color:var(--navy);">${value}</div>
        </div>`;
    }

    // Generate simple SVG window drawing
    generateWindowSVG(item) {
        const maxW = 180, maxH = 180;
        const w = item.width || 1000;
        const h = item.height || 1500;
        const ratio = Math.min(maxW / w, maxH / h);
        const sw = Math.round(w * ratio);
        const sh = Math.round(h * ratio);
        const ox = Math.round((maxW - sw) / 2) + 12;
        const oy = Math.round((maxH - sh) / 2);
        const meetingY = Math.round(sh * 0.45);
        const stroke = 'rgba(10,22,40,.6)';
        const light = 'rgba(10,22,40,.2)';
        const frame = 6;

        // Bar pattern definitions (must match bars-unified.js)
        const patternDefs = {
            'none': {h:0,v:0}, '2x2': {h:0,v:1}, '3x3': {h:0,v:2},
            '4x4': {h:1,v:1}, '6x6': {h:1,v:2}, '9x9': {h:2,v:2},
            '2-vertical': {h:0,v:2}, '1-vertical': {h:0,v:1}, 'custom': {h:0,v:0}
        };
        const upperDiv = patternDefs[item.upper_bars] || {h:0,v:0};
        const lowerDiv = patternDefs[item.lower_bars] || patternDefs[item.upper_bars] || {h:0,v:0};

        let bars = '';
        const innerL = ox + frame;
        const innerR = ox + sw - frame;
        const innerW = innerR - innerL;

        // Upper sash bars
        const upperT = oy + frame;
        const upperB = oy + meetingY;
        const upperH = upperB - upperT;
        for (let i = 1; i <= upperDiv.v; i++) {
            const x = innerL + innerW * i / (upperDiv.v + 1);
            bars += `<line x1="${x}" y1="${upperT}" x2="${x}" y2="${upperB}" stroke="${light}" stroke-width="1.5"/>`;
        }
        for (let i = 1; i <= upperDiv.h; i++) {
            const y = upperT + upperH * i / (upperDiv.h + 1);
            bars += `<line x1="${innerL}" y1="${y}" x2="${innerR}" y2="${y}" stroke="${light}" stroke-width="1.5"/>`;
        }

        // Lower sash bars
        const lowerT = oy + meetingY;
        const lowerB = oy + sh - frame;
        const lowerH = lowerB - lowerT;
        for (let i = 1; i <= lowerDiv.v; i++) {
            const x = innerL + innerW * i / (lowerDiv.v + 1);
            bars += `<line x1="${x}" y1="${lowerT}" x2="${x}" y2="${lowerB}" stroke="${light}" stroke-width="1.5"/>`;
        }
        for (let i = 1; i <= lowerDiv.h; i++) {
            const y = lowerT + lowerH * i / (lowerDiv.h + 1);
            bars += `<line x1="${innerL}" y1="${y}" x2="${innerR}" y2="${y}" stroke="${light}" stroke-width="1.5"/>`;
        }

        // Opening arrows
        let arrows = '';
        const arrowX = ox + sw + 12;
        if (item.opening_type === 'both') {
            arrows += `<text x="${arrowX}" y="${oy + meetingY/2 + 3}" font-family="Jost,sans-serif" font-size="10" fill="${stroke}" text-anchor="middle">↑</text>`;
            arrows += `<text x="${arrowX}" y="${oy + meetingY + (sh - meetingY)/2 + 3}" font-family="Jost,sans-serif" font-size="10" fill="${stroke}" text-anchor="middle">↓</text>`;
        } else if (item.opening_type === 'bottom') {
            arrows += `<text x="${arrowX}" y="${oy + meetingY + (sh - meetingY)/2 + 3}" font-family="Jost,sans-serif" font-size="10" fill="${stroke}" text-anchor="middle">↓</text>`;
        } else if (item.opening_type === 'fixed') {
            arrows += `<text x="${arrowX}" y="${oy + sh/2 + 3}" font-family="Jost,sans-serif" font-size="7" fill="rgba(10,22,40,.3)" text-anchor="middle">FIX</text>`;
        }

        // Dimension labels
        const dimW = `<text x="${ox + sw/2}" y="${oy + sh + 14}" font-family="Jost,sans-serif" font-size="8" fill="rgba(10,22,40,.4)" text-anchor="middle">${w}mm</text>`;
        const dimH = `<text x="${ox - 10}" y="${oy + sh/2}" font-family="Jost,sans-serif" font-size="8" fill="rgba(10,22,40,.4)" text-anchor="middle" transform="rotate(-90,${ox - 10},${oy + sh/2})">${h}mm</text>`;

        return `<svg width="${maxW + 30}" height="${maxH + 20}" viewBox="0 0 ${maxW + 30} ${maxH + 20}" xmlns="http://www.w3.org/2000/svg">
            <rect x="${ox}" y="${oy}" width="${sw}" height="${sh}" fill="none" stroke="${stroke}" stroke-width="2" rx="1"/>
            <rect x="${innerL}" y="${upperT}" width="${innerW}" height="${upperH}" fill="rgba(200,220,240,.12)" stroke="${light}" stroke-width="0.5"/>
            <rect x="${innerL}" y="${lowerT}" width="${innerW}" height="${lowerH}" fill="rgba(200,220,240,.08)" stroke="${light}" stroke-width="0.5"/>
            <line x1="${ox}" y1="${oy + meetingY}" x2="${ox + sw}" y2="${oy + meetingY}" stroke="${stroke}" stroke-width="2.5"/>
            ${bars}
            ${arrows}
            ${dimW}
            ${dimH}
        </svg>`;
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