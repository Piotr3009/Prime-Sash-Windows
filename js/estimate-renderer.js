// Shared Estimate Renderer — used by both customer-dashboard.js and admin-dashboard.html
// Provides: rendering, SVG drawing, PDF export, Excel export

class EstimateRenderer {

    static formatPrice(price) {
        return new Intl.NumberFormat('en-GB', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(price);
    }

    static getStatusConfig(status) {
        const configs = {
            draft: { label: 'Sent', color: '#17a2b8' },
            saved: { label: 'Sent', color: '#17a2b8' },
            sent: { label: 'Sent — Under Review', color: '#17a2b8' },
            pending: { label: 'Pending Review', color: '#ffc107' },
            quoted: { label: 'Quoted', color: '#fd7e14' },
            approved: { label: 'Approved', color: '#28a745' },
            confirmed: { label: 'Confirmed', color: '#28a745' },
            in_production: { label: 'In Production', color: '#007bff' },
            ordered: { label: 'In Production', color: '#007bff' },
            completed: { label: 'Completed', color: '#28a745' },
            cancelled: { label: 'Cancelled', color: '#dc3545' }
        };
        return configs[status] || configs.sent;
    }

    static specRow(label, value) {
        return `<div style="padding:.35rem 0;border-bottom:1px solid rgba(158,158,144,.08);">
            <div style="font-family:'Jost',sans-serif;font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;color:var(--silver);">${label}</div>
            <div style="font-family:'Jost',sans-serif;font-size:.82rem;color:var(--navy);">${value}</div>
        </div>`;
    }

    // Parse item data for rendering and export
    static parseItem(item) {
        const spec = item.specification ? (typeof item.specification === 'string' ? JSON.parse(item.specification) : item.specification) : {};
        const fc = spec.fullConfig || spec || {};

        // ═══ SINGLE SOURCE OF TRUTH: fc (fullConfig from specification) ═══

        // WINDOW TYPE
        const sashType = fc.sashType || 'double';
        const headType = fc.headType || 'flat';
        const splitRatio = fc.splitRatio || '1/4-1/2-1/4';

        // DIMENSIONS — prefer spec over item columns
        const width = fc.actualFrameWidth || item.width || 1000;
        const height = fc.actualFrameHeight || item.height || 1500;
        const originalWidth = fc.originalWidth || item.original_width || null;
        const originalHeight = fc.originalHeight || item.original_height || null;
        const measurementType = fc.measurementType || item.measurement_type || 'frame';

        // FRAME
        const frameType = fc.frameType || item.frame_type || 'standard';
        const frameText = frameType === 'standard' ? 'Standard Frame (164mm)' : 'Slim Frame (144mm)';

        // OPENING
        const openingType = fc.openingType || item.opening_type || 'both';
        const openingLabels = { both: 'Both Sashes', bottom: 'Bottom Only', fixed: 'Fixed (Non-opening)' };
        const openingText = openingLabels[openingType] || openingType;

        // GLASS
        const glassType = fc.glassType || item.glass_type || 'double';
        const glassLabels = { 'double': 'Double Glazed (4/16/4, U:1.4)', 'triple': 'Triple Glazed (U:1.2)', 'passive': 'Passive Glass (U:0.8)' };
        const glassText = glassLabels[glassType] || glassType;

        // GLASS SPEC
        const glassSpec = fc.glassSpec || item.glass_spec || 'toughened';
        const glassSpecText = glassSpec === 'laminated' ? 'Laminated' : 'Toughened';

        // GLASS FINISH
        const glassFinish = fc.glassFinish || item.glass_finish || 'clear';
        const frostedLocation = fc.frostedLocation || item.frosted_location || 'bottom';
        const showFrosted = glassFinish !== 'clear';
        let glassFinishText = 'Clear';
        if (glassFinish === 'frosted') {
            glassFinishText = frostedLocation === 'both' ? 'Frosted (Both Sashes)' : 'Frosted (Bottom Only)';
        } else if (glassFinish === 'obscure') {
            glassFinishText = 'Obscure';
        }

        // HARDWARE FINISH
        const hardwareFinishLabels = {
            'chrome': 'Polished Chrome', 'satin': 'Satin Chrome', 'brass': 'Polished Brass',
            'antique-brass': 'Antique Brass', 'black': 'Matt Black', 'white': 'White'
        };

        // SPACER
        const spacerColor = fc.spacerColor || item.spacer_color || 'silver';
        const spacerLabels = { 'silver': 'Silver (Stainless Steel)', 'white': 'White', 'black': 'Black' };
        const spacerText = spacerLabels[spacerColor] || spacerColor;

        // COLOR
        const colorType = fc.colorType || item.color_type || 'single';
        let colorDisplay = '';
        const formatColor = (name, ral) => {
            if (!name || name === 'white') return 'Pure White (RAL 9016)';
            if (name === 'Pure White') return 'Pure White (RAL 9016)';
            if (ral && ral.startsWith('F&B')) return `${name} (Farrow & Ball)`;
            if (ral && ral.startsWith('RAL') && !name.startsWith('RAL')) return `${name} (${ral})`;
            if (name.startsWith('RAL')) return name;
            if (ral) return `${name} (${ral})`;
            return name;
        };
        if (colorType === 'single') {
            colorDisplay = formatColor(fc.colorSingleName || item.color_single, fc.colorSingleRal);
        } else {
            const extDisplay = formatColor(fc.colorExteriorName || item.color_exterior, fc.colorExteriorRal);
            const intDisplay = formatColor(fc.colorInteriorName || item.color_interior, fc.colorInteriorRal);
            colorDisplay = `Ext: ${extDisplay} / Int: ${intDisplay}`;
        }

        // BARS (center sash)
        const upperBars = fc.upperBars || item.upper_bars || 'none';
        const lowerBars = fc.lowerBars || item.lower_bars || upperBars;
        const upperCustomList = fc.upperCustomBars || [];
        const lowerCustomList = (fc.lowerCustomBars && fc.lowerCustomBars.length > 0) ? fc.lowerCustomBars : upperCustomList;

        const formatBars = (pattern, customList) => {
            if (pattern === 'none') return 'None';
            if (pattern === 'custom') {
                if (customList && customList.length > 0) {
                    const h = customList.filter(b => b.type === 'h' || b.type === 'horizontal').length;
                    const v = customList.filter(b => b.type === 'v' || b.type === 'vertical').length;
                    const positions = customList.map(b => `${b.mm}mm ${b.type === 'h' || b.type === 'horizontal' ? 'H' : 'V'}`).join(', ');
                    return `Custom (${h}H + ${v}V): ${positions}`;
                }
                return 'Custom';
            }
            return pattern;
        };

        let barsText = 'None';
        if (upperBars !== 'none') {
            const upperText = formatBars(upperBars, upperCustomList);
            const lowerText = formatBars(lowerBars, lowerCustomList);
            barsText = `Upper: ${upperText}, Lower: ${lowerText}`;
        }

        // FIX BARS (triple only)
        const fixUpperBars = fc.fixUpperBars || 'none';
        const fixLowerBars = fc.fixLowerBars || fixUpperBars;
        // Fix custom bars fallback: fix own data → center bars data (when "same as center")
        const fixUpperCustomList = (fc.fixUpperCustomBars && fc.fixUpperCustomBars.length > 0) 
            ? fc.fixUpperCustomBars 
            : upperCustomList;  // fallback to center bars
        const fixLowerCustomList = (fc.fixLowerCustomBars && fc.fixLowerCustomBars.length > 0) 
            ? fc.fixLowerCustomBars 
            : fixUpperCustomList;  // fallback to fix upper
        let fixBarsText = '';
        if (sashType === 'triple' && fixUpperBars !== 'none') {
            const fixUpperText = formatBars(fixUpperBars, fixUpperCustomList);
            const fixLowerText = formatBars(fixLowerBars, fixLowerCustomList);
            fixBarsText = `Upper: ${fixUpperText}, Lower: ${fixLowerText}`;
        }

        // HORNS
        const horns = fc.horns || item.horns || 'none';
        const hornsLabels = { 'A': 'Richmond', 'D': 'Type D', 'none': 'None' };
        const hornsText = hornsLabels[horns] || horns;

        // PAS24
        const pas24 = fc.pas24 === 'yes' || fc.pas24 === true || item.pas24 === true;

        // IRONMONGERY
        let ironList = [];
        let ironSource = fc.ironmongery || item.ironmongery;
        if (ironSource && ironSource !== 'none' && ironSource !== 'null') {
            try {
                const ironData = typeof ironSource === 'string' ? JSON.parse(ironSource) : ironSource;
                const entries = ironData.products ? Object.values(ironData.products) : Object.values(ironData);
                ironList = entries
                    .filter(p => p && (p.name || p.product?.name))
                    .map(p => ({
                        name: p.product ? p.product.name : p.name,
                        qty: p.quantity || 1,
                        img: p.product ? (p.product.image_url || p.product.image || '') : (p.image_url || p.image || ''),
                        color: p.product ? p.product.color : p.color
                    }));
            } catch(e) { console.warn('Ironmongery parse error:', e); }
        }

        // HARDWARE FINISH
        let hardwareFinish = fc.ironmongeryFinish || item.ironmongery_finish || null;
        if (!hardwareFinish && ironList.length > 0) {
            const colors = [...new Set(ironList.map(p => p.color).filter(Boolean))];
            hardwareFinish = colors.length > 0 ? colors.join(' / ') : null;
        }
        if (hardwareFinish) {
            hardwareFinish = hardwareFinishLabels[hardwareFinish] || hardwareFinish.charAt(0).toUpperCase() + hardwareFinish.slice(1);
        }

        // QUANTITY
        const quantity = fc.quantity || item.quantity || 1;

        // ═══ CASEMENT FIELDS ═══
        const windowType = fc.windowType || fc.windowCategory || 'sash';
        const casementLayout = fc.casementLayout || fc.layout || '';
        const casementHBars = fc.casementHBars || fc.hBars || 0;
        const casementVBars = fc.casementVBars || fc.vBars || 0;
        let casementBarsText = 'None';
        if (casementHBars > 0 || casementVBars > 0) {
            casementBarsText = casementHBars + ' horizontal, ' + casementVBars + ' vertical';
        }
        const sillExtension = fc.sillExtension || 'none';
        const sillText = sillExtension !== 'none' ? sillExtension + 'mm' : 'None';
        const trickleVent = fc.trickleVent || 'none';
        const trickleColour = fc.trickleColour || fc.trickleColor || 'white';
        const trickleText = trickleVent === 'none' ? 'None' : (trickleVent === 'frame' ? 'On Frame' : 'On Sash') + ' (' + trickleColour + ')';
        const sealColour = fc.sealColour || 'black';
        const safetyGlass = fc.safetyGlass || 'none';
        const safetyGlassText = safetyGlass === 'toughened' ? 'Toughened' : safetyGlass === 'laminate' ? 'Laminate' : 'Standard';
        const glassSpecCasement = fc.glassSpec || 'float';
        const glassSpecCasementText = glassSpecCasement === 'low-e' ? 'Low-E Coated' : 'Float Glass';
        const fanlightHeight = fc.fanlightHeight || 0;

        return {
            fc, spec, windowType, sashType, headType, splitRatio,
            width, height, originalWidth, originalHeight, measurementType,
            frameType, frameText,
            openingType, openingText,
            glassType, glassText, glassSpec, glassSpecText,
            glassFinish, glassFinishText, showFrosted, frostedLocation,
            spacerColor, spacerText,
            colorType, colorDisplay,
            upperBars, lowerBars, barsText,
            fixUpperBars, fixLowerBars, fixBarsText,
            horns, hornsText, pas24,
            ironList, hardwareFinish, quantity,
            casementLayout, casementHBars, casementVBars, casementBarsText,
            sillExtension, sillText, trickleVent, trickleColour, trickleText,
            sealColour, safetyGlass, safetyGlassText,
            glassSpecCasement, glassSpecCasementText, fanlightHeight
        };
    }

    // ─── Render full estimate modal content ───
    // options: { isEditable, isAdmin, adminCallbacks, closeCallback, renameCallback, deleteCallback }
    static renderEstimateHTML(estimate, options = {}) {
        const R = EstimateRenderer;
        const isEditable = options.isEditable ?? (estimate.status === 'sent');
        const isAdmin = options.isAdmin ?? false;

        // Customer info (admin only)
        const customer = estimate.customers || {};
        const customerHTML = isAdmin ? `
            <div style="background:rgba(10,22,40,.04);padding:1.2rem 1.5rem;margin-bottom:1.5rem;border-left:3px solid var(--navy);">
                <div style="font-family:'Jost',sans-serif;font-size:.60rem;letter-spacing:.2em;text-transform:uppercase;color:var(--silver);margin-bottom:.5rem;">Customer</div>
                <div style="font-family:'Jost',sans-serif;font-size:.82rem;color:var(--navy);">
                    <strong>${customer.full_name || '-'}</strong>
                    ${customer.company_name ? ` · ${customer.company_name}` : ''}
                    ${customer.customer_code ? ` · ${customer.customer_code}` : ''}
                </div>
                <div style="font-family:'Jost',sans-serif;font-size:.75rem;color:var(--muted);margin-top:.3rem;">
                    ${customer.email || ''} ${customer.phone ? ` · ${customer.phone}` : ''}
                </div>
            </div>
        ` : '';

        // Windows
        const itemsHTML = estimate.estimate_items?.map(item => {
            const p = R.parseItem(item);
            const svg = R.generateWindowSVG(item);
            const screenshots = p.fc.screenshots || p.spec.screenshots || item.screenshots || null;

            return `
            <div style="background:var(--cream2);border:1px solid rgba(158,158,144,.15);margin-bottom:1.5rem;padding:0;border-radius:2px;overflow:hidden;">
                <div style="background:var(--navy);padding:.8rem 1.5rem;display:flex;justify-content:space-between;align-items:center;">
                    <div style="display:flex;align-items:center;gap:.8rem;">
                        <span style="font-family:'Jost',sans-serif;font-size:.85rem;font-weight:500;letter-spacing:.15em;text-transform:uppercase;color:#fff;">Window ${item.window_number}</span>
                        ${isEditable && !isAdmin ? `
                        <button onclick="dashboard.renameWindow('${item.id}','${(item.window_number || '').replace(/'/g, "\\'")}','${estimate.id}')" style="background:transparent;border:1px solid rgba(255,255,255,.25);color:rgba(255,255,255,.6);font-family:'Jost',sans-serif;font-size:.55rem;letter-spacing:.1em;text-transform:uppercase;padding:.2rem .5rem;cursor:pointer;border-radius:2px;">Rename</button>
                        <button onclick="dashboard.deleteWindow('${item.id}','${estimate.id}')" style="background:transparent;border:1px solid rgba(220,80,80,.4);color:rgba(220,80,80,.7);font-family:'Jost',sans-serif;font-size:.55rem;letter-spacing:.1em;text-transform:uppercase;padding:.2rem .5rem;cursor:pointer;border-radius:2px;">Delete</button>
                        ` : ''}
                    </div>
                    <span style="font-family:'Jost',sans-serif;font-size:.72rem;color:rgba(255,255,255,.5);">Qty: ${p.quantity} · £${R.formatPrice(item.total_price)} + VAT</span>
                </div>

                <div style="display:grid;grid-template-columns:280px 1fr;gap:0;">
                    <div style="padding:1rem;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;background:rgba(158,158,144,.04);border-right:1px solid rgba(158,158,144,.1);gap:10px;">
                        ${screenshots?.interior ? `
                        <div style="text-align:center;">
                            <div style="font-family:'Jost',sans-serif;font-size:.5rem;letter-spacing:.15em;text-transform:uppercase;color:var(--silver);margin-bottom:4px;">Interior View</div>
                            <img src="${screenshots.interior}" style="width:250px;border:1px solid rgba(158,158,144,.15);border-radius:2px;" />
                        </div>
                        ` : ''}
                        <div style="text-align:center;">
                            ${svg}
                        </div>
                    </div>
                    <div style="padding:1.5rem;">
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.3rem 2rem;">
                            ${p.windowType === 'casement' ? `
                            ${R.specRow('Type', 'Casement — Layout ' + p.casementLayout)}
                            ${R.specRow('Dimensions', p.width + 'mm × ' + p.height + 'mm')}
                            ${p.fanlightHeight > 0 ? R.specRow('Fanlight Height', p.fanlightHeight + 'mm') : ''}
                            ${R.specRow('Glass', p.glassText)}
                            ${R.specRow('Glass Spec', p.glassSpecCasementText)}
                            ${R.specRow('Glass Finish', p.glassFinishText)}
                            ${R.specRow('Spacer Bar', p.spacerText)}
                            ${R.specRow('Colour', p.colorDisplay)}
                            ${R.specRow('Bars', p.casementBarsText)}
                            ${R.specRow('PAS24', p.pas24 ? 'Yes ✓' : 'No')}
                            ${R.specRow('Safety Glass', p.safetyGlassText)}
                            ${R.specRow('Seal Colour', p.sealColour.charAt(0).toUpperCase() + p.sealColour.slice(1))}
                            ${p.sillExtension !== 'none' ? R.specRow('Sill Projection', p.sillText) : ''}
                            ${p.trickleVent !== 'none' ? R.specRow('Trickle Vent', p.trickleText) : ''}
                            ${p.hardwareFinish ? R.specRow('Hardware Finish', p.hardwareFinish) : ''}
                            ` : `
                            ${p.sashType !== 'double' ? R.specRow('Window Type', p.sashType === 'triple' ? 'Triple Sash' : p.sashType) : ''}
                            ${p.headType === 'arch' ? R.specRow('Head Type', 'Glazing Arch') : ''}
                            ${p.sashType === 'triple' ? R.specRow('Split Ratio', p.splitRatio) : ''}
                            ${p.originalWidth && p.originalHeight && (p.originalWidth !== p.width || p.originalHeight !== p.height) 
                                ? R.specRow('Window Size (Frame)', p.width + 'mm × ' + p.height + 'mm') + R.specRow('Structural Opening', p.originalWidth + 'mm × ' + p.originalHeight + 'mm')
                                : R.specRow('Dimensions', p.width + 'mm × ' + p.height + 'mm')}
                            ${R.specRow('Frame', p.frameText)}
                            ${R.specRow('Opening', p.openingText)}
                            ${R.specRow('Glass', p.glassText)}
                            ${R.specRow('Glass Spec', p.glassSpecText)}
                            ${R.specRow('Spacer Bar', p.spacerText)}
                            ${R.specRow('Glass Finish', p.glassFinishText)}
                            ${R.specRow('Colour', p.colorDisplay)}
                            ${R.specRow('Georgian Bars', p.barsText)}
                            ${p.fixBarsText ? R.specRow('Fix Panel Bars', p.fixBarsText) : ''}
                            ${R.specRow('PAS24', p.pas24 ? 'Yes ✓' : 'No')}
                            ${R.specRow('Horns', p.hornsText)}
                            ${p.hardwareFinish ? R.specRow('Hardware Finish', p.hardwareFinish) : ''}
                            `}
                        </div>

                        ${p.ironList.length > 0 ? `
                        <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid rgba(158,158,144,.15);">
                            <div style="font-family:'Jost',sans-serif;font-size:.60rem;letter-spacing:.2em;text-transform:uppercase;color:var(--silver);margin-bottom:.5rem;">Ironmongery</div>
                            <div style="display:flex;flex-wrap:wrap;gap:.8rem;">
                                ${p.ironList.map(pr => `
                                    <div style="display:flex;align-items:center;gap:.5rem;font-family:'Jost',sans-serif;font-size:.78rem;color:var(--navy);">
                                        ${pr.img ? `<img src="${pr.img}" style="width:36px;height:36px;object-fit:cover;border:1px solid rgba(158,158,144,.2);border-radius:2px;" onerror="this.style.display='none'">` : ''}
                                        <span>${pr.qty > 1 ? pr.qty + 'x ' : ''}${pr.name}</span>
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

        // Admin action buttons
        const adminButtons = isAdmin ? `
            ${estimate.status === 'sent' ? `<button class="btn-sm" onclick="sendQuote('${estimate.id}')">✉️ Send Quote</button>` : ''}
            ${estimate.status === 'quoted' ? `<button class="btn-sm" onclick="confirmOrder('${estimate.id}')">✅ Confirm Order</button>` : ''}
            ${estimate.status === 'confirmed' ? `<button class="btn-sm" onclick="startProduction('${estimate.id}')">🔨 Start Production</button>` : ''}
            ${estimate.status === 'in_production' ? `<button class="btn-sm" onclick="completeOrder('${estimate.id}')">✅ Mark Completed</button>` : ''}
        ` : '';

        const closeAction = isAdmin ? `closeModal()` : `dashboard.closeModal()`;

        return `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2rem;padding-bottom:1.5rem;border-bottom:1px solid rgba(158,158,144,.2);">
                <div>
                    <div style="font-family:'Jost',sans-serif;font-size:.50rem;letter-spacing:.5em;text-transform:uppercase;color:var(--silver);margin-bottom:.5rem;">Prime Sash Windows</div>
                    <div style="font-family:'Cormorant Garamond',serif;font-size:1.8rem;color:var(--navy);">Estimate ${estimate.estimate_number || ''}</div>
                    <div style="font-family:'Jost',sans-serif;font-size:.78rem;color:var(--muted);margin-top:.3rem;">
                        Created ${new Date(estimate.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })}
                        ${estimate.project_name ? ` · ${estimate.project_name}` : ''}
                    </div>
                </div>
                <span class="estimate-status status-${estimate.status}" style="font-size:.65rem;letter-spacing:.2em;text-transform:uppercase;padding:.4rem 1rem;">${R.getStatusConfig(estimate.status).label}</span>
            </div>

            ${customerHTML}

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
                        <span style="font-family:'Jost',sans-serif;font-size:.9rem;color:var(--navy);">£${R.formatPrice(estimate.total_price)}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;gap:3rem;margin-bottom:.6rem;">
                        <span style="font-family:'Jost',sans-serif;font-size:.65rem;letter-spacing:.2em;text-transform:uppercase;color:var(--silver);">VAT (20%)</span>
                        <span style="font-family:'Jost',sans-serif;font-size:.9rem;color:var(--navy);">£${R.formatPrice(estimate.total_price * 0.2)}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;gap:3rem;padding-top:.6rem;border-top:1px solid rgba(158,158,144,.3);">
                        <span style="font-family:'Jost',sans-serif;font-size:.60rem;letter-spacing:.3em;text-transform:uppercase;color:var(--silver);">Total (incl. VAT)</span>
                        <span style="font-family:'Cormorant Garamond',serif;font-size:2rem;color:var(--navy);">£${R.formatPrice(estimate.total_price * 1.2)}</span>
                    </div>
                </div>
            </div>

            <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;padding-top:1.5rem;border-top:1px solid rgba(158,158,144,.15);">
                ${adminButtons}
                <button class="btn-sm" id="download-estimate-pdf">Download PDF</button>
                <button class="btn-sm" id="download-estimate-excel">Download Excel</button>
                <button class="btn-sm" onclick="${closeAction}">Close</button>
            </div>
        `;
    }

    // ─── SVG Window Drawing ───
    static drawSVGBars(pattern, customList, glassX, glassW, topY, height, scale, light, panelWidthMm) {
        let svg = '';
        const patternDefs = {'none':{h:0,v:0},'2x2':{h:0,v:1},'3x3':{h:0,v:2},'4x4':{h:1,v:1},'6x6':{h:1,v:2},'9x9':{h:2,v:2}};

        if (pattern === 'custom' && customList && customList.length > 0) {
            // Find max position to detect if we need to scale down
            const maxV = Math.max(...customList.filter(b => b.type === 'v' || b.type === 'vertical').map(b => b.mm), 0);
            const maxH = Math.max(...customList.filter(b => b.type === 'h' || b.type === 'horizontal').map(b => b.mm), 0);
            // Scale factor: if bar positions exceed panel, scale proportionally
            const panelW = panelWidthMm || (glassW / scale);
            const panelH = height / scale;
            const vScale = maxV > panelW * 0.95 ? (panelW * 0.9) / maxV : 1;
            const hScale = maxH > panelH * 0.95 ? (panelH * 0.9) / maxH : 1;

            customList.forEach(bar => {
                if (bar.type === 'h' || bar.type === 'horizontal') {
                    const pos = Math.round(bar.mm * hScale * scale);
                    const y = topY + pos;
                    if (y > topY && y < topY + height) {
                        svg += `<line x1="${glassX}" y1="${y}" x2="${glassX + glassW}" y2="${y}" stroke="${light}" stroke-width="1"/>`;
                    }
                } else {
                    const pos = Math.round(bar.mm * vScale * scale);
                    const x = glassX + pos;
                    if (x > glassX && x < glassX + glassW) {
                        svg += `<line x1="${x}" y1="${topY}" x2="${x}" y2="${topY + height}" stroke="${light}" stroke-width="1"/>`;
                    }
                }
            });
        } else {
            const p = patternDefs[pattern] || {h:0,v:0};
            for (let i = 1; i <= p.v; i++) {
                const x = glassX + glassW * i / (p.v + 1);
                svg += `<line x1="${x}" y1="${topY}" x2="${x}" y2="${topY + height}" stroke="${light}" stroke-width="1"/>`;
            }
            for (let i = 1; i <= p.h; i++) {
                const y = topY + height * i / (p.h + 1);
                svg += `<line x1="${glassX}" y1="${y}" x2="${glassX + glassW}" y2="${y}" stroke="${light}" stroke-width="1"/>`;
            }
        }
        return svg;
    }

    static generateWindowSVG(item) {
        const spec = item.specification ? (typeof item.specification === 'string' ? JSON.parse(item.specification) : item.specification) : {};
        const fc = spec.fullConfig || spec || {};

        // ═══ CASEMENT SVG ═══
        const windowType = fc.windowType || fc.windowCategory || 'sash';
        if (windowType === 'casement') {
            return EstimateRenderer.generateCasementSVG(item, fc);
        }

        // ═══ SASH SVG (existing code below) ═══
        const sashType = fc.sashType || 'double';
        const headType = fc.headType || 'flat';
        const splitRatio = fc.splitRatio || '1/4-1/2-1/4';
        const openingType = fc.openingType || 'both';

        const w = fc.actualFrameWidth || item.width || 1000;
        const h = fc.actualFrameHeight || item.height || 1500;
        const upperBarsPattern = fc.upperBars || 'none';
        const lowerBarsPattern = fc.lowerBars || upperBarsPattern;
        const fixUpperBarsPattern = fc.fixUpperBars || 'none';
        const fixLowerBarsPattern = fc.fixLowerBars || fixUpperBarsPattern;
        const stroke = 'rgba(10,22,40,.7)';
        const light = 'rgba(10,22,40,.25)';
        const dimColor = 'rgba(10,22,40,.45)';
        const dimFont = 'font-family="Jost,sans-serif" font-size="7" fill="' + dimColor + '"';

        // Box frame dimensions in mm
        const boxLeft = 80, boxRight = 80, mullionW = 50;
        const beadGap = 12; // visual gap for beading

        if (sashType === 'triple') {
            // Parse split ratio
            let leftR = 0.25, centerR = 0.5, rightR = 0.25;
            if (splitRatio === '1/3-1/3-1/3') { leftR = 1/3; centerR = 1/3; rightR = 1/3; }
            else if (splitRatio === '1/5-3/5-1/5') { leftR = 0.2; centerR = 0.6; rightR = 0.2; }

            const innerTotalMm = w - boxLeft - boxRight - mullionW * 2;
            const leftMm = Math.round(innerTotalMm * leftR);
            const centerMm = Math.round(innerTotalMm * centerR);
            const rightMm = innerTotalMm - leftMm - centerMm;

            // SVG sizing
            const svgW = 260, svgH = 220;
            const drawW = 220, drawH = 140;
            const ox = (svgW - drawW) / 2;
            const oy = 10;
            const scale = drawW / w;
            const sh = Math.round(h * scale);
            const actualH = Math.min(sh, drawH);
            const frameW = 2;

            // Scaled positions
            const sBoxL = Math.round(boxLeft * scale);
            const sBoxR = Math.round(boxRight * scale);
            const sMull = Math.round(mullionW * scale);
            const sLeft = Math.round(leftMm * scale);
            const sCenter = Math.round(centerMm * scale);
            const sRight = drawW - sBoxL - sLeft - sMull - sCenter - sMull - sBoxR;
            const meetingY = Math.round(actualH * 0.47);

            // Arch rise
            const archRise = headType === 'arch' ? Math.round(Math.min(12, actualH * 0.06)) : 0;

            let svg = '';

            // Outer frame
            svg += `<rect x="${ox}" y="${oy}" width="${drawW}" height="${actualH}" fill="none" stroke="${stroke}" stroke-width="${frameW}" rx="1"/>`;

            // Meeting rail full width
            svg += `<line x1="${ox}" y1="${oy + meetingY}" x2="${ox + drawW}" y2="${oy + meetingY}" stroke="${stroke}" stroke-width="2"/>`;

            // Mullions
            const mull1X = ox + sBoxL + sLeft;
            const mull2X = mull1X + sMull + sCenter;
            svg += `<rect x="${mull1X}" y="${oy}" width="${sMull}" height="${actualH}" fill="rgba(10,22,40,.08)" stroke="${stroke}" stroke-width="1"/>`;
            svg += `<rect x="${mull2X}" y="${oy}" width="${sMull}" height="${actualH}" fill="rgba(10,22,40,.08)" stroke="${stroke}" stroke-width="1"/>`;

            // Glass panels (3 upper + 3 lower)
            const sections = [
                { x: ox + sBoxL, w: sLeft, label: 'FIX' },
                { x: mull1X + sMull, w: sCenter, label: '' },
                { x: mull2X + sMull, w: sRight, label: 'FIX' }
            ];

            sections.forEach((sec, i) => {
                const glassX = sec.x + 2;
                const glassW = sec.w - 4;
                const upperT = oy + frameW + 1;
                const upperH = meetingY - frameW - 2;
                const lowerT = oy + meetingY + 1;
                const lowerH = actualH - meetingY - frameW - 1;

                // Upper glass
                if (headType === 'arch' && archRise > 0) {
                    const peakY = upperT;
                    const edgeY = upperT + archRise;
                    svg += `<path d="M${glassX},${edgeY} Q${glassX + glassW/2},${peakY - archRise} ${glassX + glassW},${edgeY} L${glassX + glassW},${oy + meetingY - 1} L${glassX},${oy + meetingY - 1} Z" fill="rgba(200,220,240,.15)" stroke="${light}" stroke-width="0.5"/>`;
                } else {
                    svg += `<rect x="${glassX}" y="${upperT}" width="${glassW}" height="${upperH}" fill="rgba(200,220,240,.15)" stroke="${light}" stroke-width="0.5"/>`;
                }

                // Lower glass
                svg += `<rect x="${glassX}" y="${lowerT}" width="${glassW}" height="${lowerH}" fill="rgba(200,220,240,.1)" stroke="${light}" stroke-width="0.5"/>`;

                // FIX labels
                if (sec.label) {
                    svg += `<text x="${glassX + glassW/2}" y="${oy + actualH/2 + 2}" ${dimFont} font-size="6" text-anchor="middle" opacity="0.4">${sec.label}</text>`;
                }
            });

            // Opening arrow on center lower
            const centerX = mull1X + sMull + sCenter / 2;
            svg += `<text x="${centerX}" y="${oy + meetingY + (actualH - meetingY)/2 + 3}" font-family="Jost,sans-serif" font-size="10" fill="${stroke}" text-anchor="middle">↓</text>`;

            // Bars on panels (upper + lower) using helper
            const R = EstimateRenderer;
            const upperCustomList = fc.upperCustomBars || [];
            const lowerCustomList = (fc.lowerCustomBars && fc.lowerCustomBars.length > 0) ? fc.lowerCustomBars : upperCustomList;
            // Fix custom: own data → center bars data (when "same as center")
            const fixUpperCustomList = (fc.fixUpperCustomBars && fc.fixUpperCustomBars.length > 0) 
                ? fc.fixUpperCustomBars : upperCustomList;
            const fixLowerCustomList = (fc.fixLowerCustomBars && fc.fixLowerCustomBars.length > 0) 
                ? fc.fixLowerCustomBars : fixUpperCustomList;

            const sectionsMm = [leftMm, centerMm, rightMm];

            sections.forEach((sec, i) => {
                const glassX = sec.x + 2;
                const glassW = sec.w - 4;
                const uT = oy + frameW + 1 + (headType === 'arch' ? archRise : 0);
                const uH = meetingY - frameW - 2 - (headType === 'arch' ? archRise : 0);
                const lT = oy + meetingY + 1;
                const lH = actualH - meetingY - frameW - 1;
                const panelMm = sectionsMm[i];

                if (i === 1) {
                    svg += R.drawSVGBars(upperBarsPattern, upperCustomList, glassX, glassW, uT, uH, scale, light, panelMm);
                    svg += R.drawSVGBars(lowerBarsPattern, lowerCustomList, glassX, glassW, lT, lH, scale, light, panelMm);
                } else {
                    svg += R.drawSVGBars(fixUpperBarsPattern, fixUpperCustomList, glassX, glassW, uT, uH, scale, light, panelMm);
                    svg += R.drawSVGBars(fixLowerBarsPattern, fixLowerCustomList, glassX, glassW, lT, lH, scale, light, panelMm);
                }
            });

            // ═══ DIMENSION LINES ═══
            const dimY = oy + actualH + 8;
            const dimY2 = dimY + 14;
            const tickH = 4;

            // Overall width dimension
            svg += `<line x1="${ox}" y1="${dimY}" x2="${ox + drawW}" y2="${dimY}" stroke="${dimColor}" stroke-width="0.5"/>`;
            svg += `<line x1="${ox}" y1="${dimY - tickH}" x2="${ox}" y2="${dimY + tickH}" stroke="${dimColor}" stroke-width="0.5"/>`;
            svg += `<line x1="${ox + drawW}" y1="${dimY - tickH}" x2="${ox + drawW}" y2="${dimY + tickH}" stroke="${dimColor}" stroke-width="0.5"/>`;
            svg += `<text x="${ox + drawW/2}" y="${dimY - 3}" ${dimFont} text-anchor="middle">${w}mm</text>`;

            // Detailed dims below
            const dims = [
                { w: sBoxL, label: boxLeft },
                { w: sLeft, label: leftMm },
                { w: sMull, label: mullionW },
                { w: sCenter, label: centerMm },
                { w: sMull, label: mullionW },
                { w: sRight, label: rightMm },
                { w: sBoxR, label: boxRight }
            ];
            let cx = ox;
            dims.forEach(d => {
                svg += `<line x1="${cx}" y1="${dimY2 - tickH/2}" x2="${cx}" y2="${dimY2 + tickH/2}" stroke="${dimColor}" stroke-width="0.4"/>`;
                svg += `<line x1="${cx}" y1="${dimY2}" x2="${cx + d.w}" y2="${dimY2}" stroke="${dimColor}" stroke-width="0.4"/>`;
                if (d.w > 8) {
                    svg += `<text x="${cx + d.w/2}" y="${dimY2 + 9}" ${dimFont} font-size="5.5" text-anchor="middle">${d.label}</text>`;
                }
                cx += d.w;
            });
            svg += `<line x1="${cx}" y1="${dimY2 - tickH/2}" x2="${cx}" y2="${dimY2 + tickH/2}" stroke="${dimColor}" stroke-width="0.4"/>`;

            // Height dimension (right side)
            const hDimX = ox + drawW + 10;
            svg += `<line x1="${hDimX}" y1="${oy}" x2="${hDimX}" y2="${oy + actualH}" stroke="${dimColor}" stroke-width="0.5"/>`;
            svg += `<line x1="${hDimX - tickH}" y1="${oy}" x2="${hDimX + tickH}" y2="${oy}" stroke="${dimColor}" stroke-width="0.5"/>`;
            svg += `<line x1="${hDimX - tickH}" y1="${oy + actualH}" x2="${hDimX + tickH}" y2="${oy + actualH}" stroke="${dimColor}" stroke-width="0.5"/>`;
            svg += `<text x="${hDimX + 3}" y="${oy + actualH/2 + 2}" ${dimFont} transform="rotate(90,${hDimX + 3},${oy + actualH/2})">${h}mm</text>`;

            return `<svg width="${svgW}" height="${dimY2 + 18}" viewBox="0 0 ${svgW} ${dimY2 + 18}" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;

        } else {
            // ═══ DOUBLE / ARCHED DOUBLE ═══
            const svgW = 220, drawH = 160;
            const innerMm = w - boxLeft - boxRight;
            const scale = 160 / w;
            const drawW = Math.round(w * scale);
            const sh = Math.min(Math.round(h * scale), drawH);
            const ox = (svgW - drawW) / 2;
            const oy = 10;
            const sBoxL = Math.round(boxLeft * scale);
            const sBoxR = Math.round(boxRight * scale);
            const meetingY = Math.round(sh * 0.47);
            const frameW = 2;

            const archRise = headType === 'arch' ? Math.round(Math.min(15, sh * 0.06)) : 0;

            let svg = '';

            // Outer frame
            svg += `<rect x="${ox}" y="${oy}" width="${drawW}" height="${sh}" fill="none" stroke="${stroke}" stroke-width="${frameW}" rx="1"/>`;

            // Meeting rail
            svg += `<line x1="${ox}" y1="${oy + meetingY}" x2="${ox + drawW}" y2="${oy + meetingY}" stroke="${stroke}" stroke-width="2.5"/>`;

            // Glass
            const glassX = ox + sBoxL + 1;
            const glassW = drawW - sBoxL - sBoxR - 2;
            const upperT = oy + frameW + 1;
            const lowerT = oy + meetingY + 1;
            const lowerH = sh - meetingY - frameW - 1;

            if (headType === 'arch' && archRise > 0) {
                const edgeY = upperT + archRise;
                svg += `<path d="M${glassX},${edgeY} Q${glassX + glassW/2},${upperT - archRise} ${glassX + glassW},${edgeY} L${glassX + glassW},${oy + meetingY - 1} L${glassX},${oy + meetingY - 1} Z" fill="rgba(200,220,240,.12)" stroke="${light}" stroke-width="0.5"/>`;
            } else {
                const upperH = meetingY - frameW - 2;
                svg += `<rect x="${glassX}" y="${upperT}" width="${glassW}" height="${upperH}" fill="rgba(200,220,240,.12)" stroke="${light}" stroke-width="0.5"/>`;
            }
            svg += `<rect x="${glassX}" y="${lowerT}" width="${glassW}" height="${lowerH}" fill="rgba(200,220,240,.08)" stroke="${light}" stroke-width="0.5"/>`;

            // Bars using helper
            const R2 = EstimateRenderer;
            const upperCustomList = fc.upperCustomBars || [];
            const lowerCustomList = (fc.lowerCustomBars && fc.lowerCustomBars.length > 0) ? fc.lowerCustomBars : upperCustomList;
            const bUpperT = upperT + (headType === 'arch' ? archRise : 0);
            const bUpperH = meetingY - frameW - 2 - (headType === 'arch' ? archRise : 0);
            svg += R2.drawSVGBars(upperBarsPattern, upperCustomList, glassX, glassW, bUpperT, bUpperH, scale, light, innerMm);
            svg += R2.drawSVGBars(lowerBarsPattern, lowerCustomList, glassX, glassW, lowerT, lowerH, scale, light, innerMm);

            // Opening arrows
            const arrowX = ox + drawW + 14;
            if (openingType === 'both') {
                svg += `<text x="${arrowX}" y="${oy + meetingY/2 + 3}" font-family="Jost,sans-serif" font-size="10" fill="${stroke}" text-anchor="middle">↑</text>`;
                svg += `<text x="${arrowX}" y="${oy + meetingY + lowerH/2 + 3}" font-family="Jost,sans-serif" font-size="10" fill="${stroke}" text-anchor="middle">↓</text>`;
            } else if (openingType === 'bottom') {
                svg += `<text x="${arrowX}" y="${oy + meetingY + lowerH/2 + 3}" font-family="Jost,sans-serif" font-size="10" fill="${stroke}" text-anchor="middle">↓</text>`;
            } else if (openingType === 'fixed') {
                svg += `<text x="${arrowX}" y="${oy + sh/2 + 3}" font-family="Jost,sans-serif" font-size="7" fill="rgba(10,22,40,.3)" text-anchor="middle">FIX</text>`;
            }

            // ═══ DIMENSION LINES ═══
            const dimY = oy + sh + 8;
            const dimY2 = dimY + 14;
            const tickH = 4;

            // Overall width
            svg += `<line x1="${ox}" y1="${dimY}" x2="${ox + drawW}" y2="${dimY}" stroke="${dimColor}" stroke-width="0.5"/>`;
            svg += `<line x1="${ox}" y1="${dimY - tickH}" x2="${ox}" y2="${dimY + tickH}" stroke="${dimColor}" stroke-width="0.5"/>`;
            svg += `<line x1="${ox + drawW}" y1="${dimY - tickH}" x2="${ox + drawW}" y2="${dimY + tickH}" stroke="${dimColor}" stroke-width="0.5"/>`;
            svg += `<text x="${ox + drawW/2}" y="${dimY - 3}" ${dimFont} text-anchor="middle">${w}mm</text>`;

            // Detailed dims: box | opening | box
            const dims = [
                { w: sBoxL, label: boxLeft },
                { w: drawW - sBoxL - sBoxR, label: innerMm },
                { w: sBoxR, label: boxRight }
            ];
            let cx = ox;
            dims.forEach(d => {
                svg += `<line x1="${cx}" y1="${dimY2 - tickH/2}" x2="${cx}" y2="${dimY2 + tickH/2}" stroke="${dimColor}" stroke-width="0.4"/>`;
                svg += `<line x1="${cx}" y1="${dimY2}" x2="${cx + d.w}" y2="${dimY2}" stroke="${dimColor}" stroke-width="0.4"/>`;
                if (d.w > 10) {
                    svg += `<text x="${cx + d.w/2}" y="${dimY2 + 9}" ${dimFont} font-size="5.5" text-anchor="middle">${d.label}</text>`;
                }
                cx += d.w;
            });
            svg += `<line x1="${cx}" y1="${dimY2 - tickH/2}" x2="${cx}" y2="${dimY2 + tickH/2}" stroke="${dimColor}" stroke-width="0.4"/>`;

            // Height
            const hDimX = ox + drawW + 24;
            svg += `<line x1="${hDimX}" y1="${oy}" x2="${hDimX}" y2="${oy + sh}" stroke="${dimColor}" stroke-width="0.5"/>`;
            svg += `<line x1="${hDimX - tickH}" y1="${oy}" x2="${hDimX + tickH}" y2="${oy}" stroke="${dimColor}" stroke-width="0.5"/>`;
            svg += `<line x1="${hDimX - tickH}" y1="${oy + sh}" x2="${hDimX + tickH}" y2="${oy + sh}" stroke="${dimColor}" stroke-width="0.5"/>`;
            svg += `<text x="${hDimX + 3}" y="${oy + sh/2 + 2}" ${dimFont} transform="rotate(90,${hDimX + 3},${oy + sh/2})">${h}mm</text>`;

            return `<svg width="${svgW}" height="${dimY2 + 18}" viewBox="0 0 ${svgW} ${dimY2 + 18}" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
        }
    }

    // ═══ CASEMENT SVG GENERATOR ═══
    static generateCasementSVG(item, fc) {
        const layout = fc.casementLayout || fc.layout || '040L';
        const w = fc.width || item.width || 1000;
        const h = fc.height || item.height || 1200;
        const hBars = fc.casementHBars || fc.hBars || 0;
        const vBars = fc.casementVBars || fc.vBars || 0;
        const fanlightHeight = fc.fanlightHeight || 0;
        const FR = fanlightHeight > 0 ? fanlightHeight / h : 0.25;

        const stroke = 'rgba(10,22,40,.7)';
        const light = 'rgba(10,22,40,.25)';
        const dimColor = 'rgba(10,22,40,.45)';
        const dimFont = `font-family="Jost,sans-serif" font-size="7" fill="${dimColor}"`;
        const gold = 'rgba(200,162,78,.5)';

        // SVG coordinate system
        const svgW = 260, drawW = 200;
        const scale = drawW / w;
        const drawH = Math.round(h * scale);
        const svgH = drawH + 80;
        const ox = 30, oy = 10;

        // Frame dimensions in mm scaled
        const frameT = 57, mullW = 68;
        const fT = Math.max(frameT * scale, 4);
        const mW = Math.max(mullW * scale, 3);

        // Inner area
        const ix = ox + fT, iy = oy + fT;
        const iw = drawW - fT * 2, ih = drawH - fT * 2;

        let svg = '';

        // Outer + inner frame
        svg += `<rect x="${ox}" y="${oy}" width="${drawW}" height="${drawH}" fill="none" stroke="${stroke}" stroke-width="1.5"/>`;
        svg += `<rect x="${ix}" y="${iy}" width="${iw}" height="${ih}" fill="none" stroke="${stroke}" stroke-width="0.5"/>`;

        // Get panels for this layout
        const panels = EstimateRenderer._casementPanels(layout, iw, ih, mW, FR);

        // Draw mullions
        if (panels.mullions) {
            panels.mullions.forEach(mx => {
                const sx = ix + mx;
                svg += `<rect x="${sx - mW/2}" y="${iy}" width="${mW}" height="${ih}" fill="none" stroke="${stroke}" stroke-width="0.7"/>`;
            });
        }

        // Draw transoms
        if (panels.transoms) {
            panels.transoms.forEach(t => {
                const ty = typeof t === 'number' ? t : t.y;
                const tx = typeof t === 'number' ? 0 : (t.x || 0);
                const tw = typeof t === 'number' ? iw : (t.w || iw);
                const sy = iy + ty;
                svg += `<rect x="${ix + tx}" y="${sy - mW/2}" width="${tw}" height="${mW}" fill="none" stroke="${stroke}" stroke-width="0.7"/>`;
            });
        }

        // Draw each panel
        panels.list.forEach(p => {
            const px = ix + p.x, py = iy + p.y;
            const pw = p.w, ph = p.h;
            const cx = px + pw / 2, cy = py + ph / 2;

            // Opening indicator
            if (p.hinge === 'fixed') {
                // X cross
                svg += `<line x1="${px+2}" y1="${py+2}" x2="${px+pw-2}" y2="${py+ph-2}" stroke="${light}" stroke-width="0.5"/>`;
                svg += `<line x1="${px+pw-2}" y1="${py+2}" x2="${px+2}" y2="${py+ph-2}" stroke="${light}" stroke-width="0.5"/>`;
            } else if (p.hinge === 'left') {
                // Hinge on left — point at LEFT center, lines from right corners
                svg += `<line x1="${px+pw-2}" y1="${py+2}" x2="${px+2}" y2="${cy}" stroke="${gold}" stroke-width="0.7"/>`;
                svg += `<line x1="${px+pw-2}" y1="${py+ph-2}" x2="${px+2}" y2="${cy}" stroke="${gold}" stroke-width="0.7"/>`;
            } else if (p.hinge === 'right') {
                // Hinge on right — point at RIGHT center, lines from left corners
                svg += `<line x1="${px+2}" y1="${py+2}" x2="${px+pw-2}" y2="${cy}" stroke="${gold}" stroke-width="0.7"/>`;
                svg += `<line x1="${px+2}" y1="${py+ph-2}" x2="${px+pw-2}" y2="${cy}" stroke="${gold}" stroke-width="0.7"/>`;
            } else if (p.hinge === 'top') {
                // Hinge on top — point at TOP center, lines from bottom corners
                svg += `<line x1="${px+2}" y1="${py+ph-2}" x2="${cx}" y2="${py+2}" stroke="${gold}" stroke-width="0.7"/>`;
                svg += `<line x1="${px+pw-2}" y1="${py+ph-2}" x2="${cx}" y2="${py+2}" stroke="${gold}" stroke-width="0.7"/>`;
            }

            // Bars (only on non-fanlight panels unless specified)
            if (hBars > 0 || vBars > 0) {
                if (!p.fanlight) {
                    for (let i = 1; i <= hBars; i++) {
                        const by = py + (ph / (hBars + 1)) * i;
                        svg += `<line x1="${px+2}" y1="${by}" x2="${px+pw-2}" y2="${by}" stroke="${stroke}" stroke-width="0.4"/>`;
                    }
                    for (let i = 1; i <= vBars; i++) {
                        const bx = px + (pw / (vBars + 1)) * i;
                        svg += `<line x1="${bx}" y1="${py+2}" x2="${bx}" y2="${py+ph-2}" stroke="${stroke}" stroke-width="0.4"/>`;
                    }
                }
            }
        });

        // ─── DIMENSIONS ───
        const dimY = oy + drawH + 8;
        const tickH = 3;

        // Overall width
        svg += `<line x1="${ox}" y1="${dimY}" x2="${ox + drawW}" y2="${dimY}" stroke="${dimColor}" stroke-width="0.5"/>`;
        svg += `<line x1="${ox}" y1="${dimY - tickH}" x2="${ox}" y2="${dimY + tickH}" stroke="${dimColor}" stroke-width="0.5"/>`;
        svg += `<line x1="${ox + drawW}" y1="${dimY - tickH}" x2="${ox + drawW}" y2="${dimY + tickH}" stroke="${dimColor}" stroke-width="0.5"/>`;
        svg += `<text x="${ox + drawW/2}" y="${dimY + 12}" ${dimFont} text-anchor="middle">${w}mm</text>`;

        // Panel widths breakdown
        if (panels.widthBreakdown && panels.widthBreakdown.length > 1) {
            const dimY2 = dimY + 18;
            let cx2 = ox;
            panels.widthBreakdown.forEach((seg, i) => {
                const sw = seg.mm * scale;
                svg += `<line x1="${cx2}" y1="${dimY2 - tickH}" x2="${cx2}" y2="${dimY2 + tickH}" stroke="${dimColor}" stroke-width="0.4"/>`;
                svg += `<text x="${cx2 + sw/2}" y="${dimY2 + 3}" ${dimFont} text-anchor="middle" font-size="5.5">${seg.mm}</text>`;
                cx2 += sw;
            });
            svg += `<line x1="${cx2}" y1="${dimY2 - tickH}" x2="${cx2}" y2="${dimY2 + tickH}" stroke="${dimColor}" stroke-width="0.4"/>`;
        }

        // Overall height (right side)
        const hDimX = ox + drawW + 12;
        svg += `<line x1="${hDimX}" y1="${oy}" x2="${hDimX}" y2="${oy + drawH}" stroke="${dimColor}" stroke-width="0.5"/>`;
        svg += `<line x1="${hDimX - tickH}" y1="${oy}" x2="${hDimX + tickH}" y2="${oy}" stroke="${dimColor}" stroke-width="0.5"/>`;
        svg += `<line x1="${hDimX - tickH}" y1="${oy + drawH}" x2="${hDimX + tickH}" y2="${oy + drawH}" stroke="${dimColor}" stroke-width="0.5"/>`;
        svg += `<text x="${hDimX + 3}" y="${oy + drawH/2 + 2}" ${dimFont} transform="rotate(90,${hDimX + 3},${oy + drawH/2})">${h}mm</text>`;

        // Fanlight height annotation (if has transom)
        if (fanlightHeight > 0 && panels.transoms && panels.transoms.length > 0) {
            const ty = typeof panels.transoms[0] === 'number' ? panels.transoms[0] : panels.transoms[0].y;
            const fhDimX = ox - 12;
            const transomSvgY = iy + ty;
            // Fanlight is at top: from frame top to transom
            svg += `<line x1="${fhDimX}" y1="${iy}" x2="${fhDimX}" y2="${transomSvgY}" stroke="${dimColor}" stroke-width="0.4"/>`;
            svg += `<line x1="${fhDimX - tickH}" y1="${iy}" x2="${fhDimX + tickH}" y2="${iy}" stroke="${dimColor}" stroke-width="0.4"/>`;
            svg += `<line x1="${fhDimX - tickH}" y1="${transomSvgY}" x2="${fhDimX + tickH}" y2="${transomSvgY}" stroke="${dimColor}" stroke-width="0.4"/>`;
        }

        const totalH = dimY + (panels.widthBreakdown && panels.widthBreakdown.length > 1 ? 32 : 18);
        return `<svg width="${svgW}" height="${totalH}" viewBox="0 0 ${svgW} ${totalH}" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
    }

    // Panel layout definitions for casement SVG
    static _casementPanels(code, iw, ih, mW, FR) {
        const half = (iw - mW) / 2;
        const third = (iw - mW * 2) / 3;
        const fH = ih * FR;
        const mainH = ih - mW - fH;
        const openW40 = iw * 0.4;
        const fixedW40 = iw - mW - openW40;

        const wbd = (segs) => segs; // width breakdown helper

        switch (code) {
            case '010T':
                return { list: [{ x:0,y:0,w:iw,h:ih,hinge:'top' }], widthBreakdown: [{mm:57},{mm:0},{mm:57}] };
            case '040L':
                return { list: [{ x:0,y:0,w:iw,h:ih,hinge:'right' }] };
            case '040R':
                return { list: [{ x:0,y:0,w:iw,h:ih,hinge:'left' }] };
            case '040D':
                return {
                    mullions: [iw/2],
                    list: [
                        { x:0,y:0,w:half,h:ih,hinge:'left' },
                        { x:half+mW,y:0,w:half,h:ih,hinge:'right' }
                    ],
                    widthBreakdown: [{mm:57},{mm:'opening'},{mm:68},{mm:'opening'},{mm:57}]
                };
            case '051L':
                return {
                    mullions: [iw/2],
                    list: [
                        { x:0,y:0,w:half,h:ih,hinge:'left' },
                        { x:half+mW,y:0,w:half,h:ih,hinge:'fixed' }
                    ]
                };
            case '051R':
                return {
                    mullions: [iw/2],
                    list: [
                        { x:0,y:0,w:half,h:ih,hinge:'fixed' },
                        { x:half+mW,y:0,w:half,h:ih,hinge:'right' }
                    ]
                };
            case '180L':
                return {
                    mullions: [openW40],
                    list: [
                        { x:0,y:0,w:openW40-mW/2,h:ih,hinge:'left' },
                        { x:openW40+mW/2,y:0,w:fixedW40-mW/2,h:ih,hinge:'fixed' }
                    ]
                };
            case '180R':
                return {
                    mullions: [fixedW40],
                    list: [
                        { x:0,y:0,w:fixedW40-mW/2,h:ih,hinge:'fixed' },
                        { x:fixedW40+mW/2,y:0,w:openW40-mW/2,h:ih,hinge:'right' }
                    ]
                };
            case '021':
                return {
                    transoms: [fH + mW/2],
                    list: [
                        { x:0,y:0,w:iw,h:fH,hinge:'top',fanlight:true },
                        { x:0,y:fH+mW,w:iw,h:mainH,hinge:'fixed' }
                    ]
                };
            case '021L':
                return {
                    transoms: [fH + mW/2],
                    list: [
                        { x:0,y:0,w:iw,h:fH,hinge:'top',fanlight:true },
                        { x:0,y:fH+mW,w:iw,h:mainH,hinge:'right' }
                    ]
                };
            case '021R':
                return {
                    transoms: [fH + mW/2],
                    list: [
                        { x:0,y:0,w:iw,h:fH,hinge:'top',fanlight:true },
                        { x:0,y:fH+mW,w:iw,h:mainH,hinge:'left' }
                    ]
                };
            case '031':
                return {
                    transoms: [fH + mW/2],
                    mullions: [iw/2],
                    list: [
                        { x:0,y:0,w:half,h:fH,hinge:'top',fanlight:true },
                        { x:half+mW,y:0,w:half,h:fH,hinge:'top',fanlight:true },
                        { x:0,y:fH+mW,w:iw,h:mainH,hinge:'fixed' }
                    ]
                };
            case '031L':
                return {
                    transoms: [fH + mW/2],
                    mullions: [iw/2],
                    list: [
                        { x:0,y:0,w:half,h:fH,hinge:'top',fanlight:true },
                        { x:half+mW,y:0,w:half,h:fH,hinge:'top',fanlight:true },
                        { x:0,y:fH+mW,w:iw,h:mainH,hinge:'right' }
                    ]
                };
            case '031R':
                return {
                    transoms: [fH + mW/2],
                    mullions: [iw/2],
                    list: [
                        { x:0,y:0,w:half,h:fH,hinge:'top',fanlight:true },
                        { x:half+mW,y:0,w:half,h:fH,hinge:'top',fanlight:true },
                        { x:0,y:fH+mW,w:iw,h:mainH,hinge:'left' }
                    ]
                };
            case '032':
                return {
                    transoms: [fH + mW/2],
                    mullions: [iw/2],
                    list: [
                        { x:0,y:0,w:iw,h:fH,hinge:'top',fanlight:true },
                        { x:0,y:fH+mW,w:half,h:mainH,hinge:'left' },
                        { x:half+mW,y:fH+mW,w:half,h:mainH,hinge:'right' }
                    ]
                };
            case '052L':
                return {
                    mullions: [iw/2],
                    transoms: [{ y:fH+mW/2, x:0, w:half }],
                    list: [
                        { x:0,y:0,w:half,h:fH,hinge:'top',fanlight:true },
                        { x:0,y:fH+mW,w:half,h:mainH,hinge:'left' },
                        { x:half+mW,y:0,w:half,h:ih,hinge:'right' }
                    ]
                };
            case '052R':
                return {
                    mullions: [iw/2],
                    transoms: [{ y:fH+mW/2, x:half+mW, w:half }],
                    list: [
                        { x:0,y:0,w:half,h:ih,hinge:'left' },
                        { x:half+mW,y:0,w:half,h:fH,hinge:'top',fanlight:true },
                        { x:half+mW,y:fH+mW,w:half,h:mainH,hinge:'right' }
                    ]
                };
            case '130':
                return {
                    mullions: [third, third*2+mW],
                    list: [
                        { x:0,y:0,w:third-mW/2,h:ih,hinge:'left' },
                        { x:third+mW/2,y:0,w:third,h:ih,hinge:'fixed' },
                        { x:third*2+mW+mW/2,y:0,w:third-mW/2,h:ih,hinge:'right' }
                    ]
                };
            case '131': {
                const tpW = third;
                return {
                    mullions: [third, third*2+mW],
                    transoms: [{ y:fH+mW/2, x:third+mW/2, w:tpW }],
                    list: [
                        { x:0,y:0,w:third-mW/2,h:ih,hinge:'left' },
                        { x:third+mW/2,y:0,w:tpW,h:fH,hinge:'top',fanlight:true },
                        { x:third+mW/2,y:fH+mW,w:tpW,h:mainH,hinge:'fixed' },
                        { x:third*2+mW+mW/2,y:0,w:third-mW/2,h:ih,hinge:'right' }
                    ]
                };
            }
            case '132': {
                const tpW = third;
                return {
                    mullions: [third, third*2+mW],
                    transoms: [
                        { y:fH+mW/2, x:0, w:third-mW/2 },
                        { y:fH+mW/2, x:third*2+mW+mW/2, w:third-mW/2 }
                    ],
                    list: [
                        { x:0,y:0,w:third-mW/2,h:fH,hinge:'top',fanlight:true },
                        { x:0,y:fH+mW,w:third-mW/2,h:mainH,hinge:'left' },
                        { x:third+mW/2,y:0,w:tpW,h:ih,hinge:'fixed' },
                        { x:third*2+mW+mW/2,y:0,w:third-mW/2,h:fH,hinge:'top',fanlight:true },
                        { x:third*2+mW+mW/2,y:fH+mW,w:third-mW/2,h:mainH,hinge:'right' }
                    ]
                };
            }
            default:
                return { list: [{ x:0,y:0,w:iw,h:ih,hinge:'right' }] };
        }
    }

    // ─── PDF Window Drawing ───
    static generateWindowPDF(doc, p, ox, oy) {
        const maxW = 50, maxH = 55;
        const w = p.width || 1000;
        const h = p.height || 1500;
        const ratio = Math.min(maxW / w, maxH / h);
        const sw = Math.round(w * ratio);
        const sh = Math.round(h * ratio);
        const cx = ox + (maxW - sw) / 2;
        const cy = oy + (maxH - sh) / 2;
        const meetingY = Math.round(sh * 0.45);
        const frame = 1.8;

        const patternDefs = {
            'none': {h:0,v:0}, '2x2': {h:0,v:1}, '3x3': {h:0,v:2},
            '4x4': {h:1,v:1}, '6x6': {h:1,v:2}, '9x9': {h:2,v:2},
            '2-vertical': {h:0,v:2}, '1-vertical': {h:0,v:1}, 'custom': {h:0,v:0}
        };
        const upperDiv = patternDefs[p.upperBars] || {h:0,v:0};
        const lowerDiv = patternDefs[p.lowerBars] || patternDefs[p.upperBars] || {h:0,v:0};

        const innerL = cx + frame;
        const innerW = sw - frame * 2;
        const upperT = cy + frame;
        const upperH = meetingY - frame;
        const lowerT = cy + meetingY;
        const lowerH = sh - meetingY - frame;

        doc.setDrawColor(10, 22, 40);
        doc.setLineWidth(0.5);
        doc.rect(cx, cy, sw, sh);

        doc.setFillColor(220, 235, 248);
        doc.setDrawColor(160, 180, 200);
        doc.setLineWidth(0.15);
        doc.rect(innerL, upperT, innerW, upperH, 'FD');

        doc.setFillColor(230, 240, 250);
        doc.rect(innerL, lowerT, innerW, lowerH, 'FD');

        doc.setDrawColor(10, 22, 40);
        doc.setLineWidth(0.7);
        doc.line(cx, cy + meetingY, cx + sw, cy + meetingY);

        doc.setDrawColor(140, 160, 180);
        doc.setLineWidth(0.25);

        for (let i = 1; i <= upperDiv.v; i++) {
            const x = innerL + innerW * i / (upperDiv.v + 1);
            doc.line(x, upperT, x, upperT + upperH);
        }
        for (let i = 1; i <= upperDiv.h; i++) {
            const y = upperT + upperH * i / (upperDiv.h + 1);
            doc.line(innerL, y, innerL + innerW, y);
        }
        for (let i = 1; i <= lowerDiv.v; i++) {
            const x = innerL + innerW * i / (lowerDiv.v + 1);
            doc.line(x, lowerT, x, lowerT + lowerH);
        }
        for (let i = 1; i <= lowerDiv.h; i++) {
            const y = lowerT + lowerH * i / (lowerDiv.h + 1);
            doc.line(innerL, y, innerL + innerW, y);
        }

        doc.setFontSize(8);
        doc.setTextColor(10, 22, 40);
        const arrowX = cx + sw + 3;
        if (p.openingType === 'both') {
            doc.text('↑', arrowX, cy + meetingY / 2 + 1);
            doc.text('↓', arrowX, cy + meetingY + lowerH / 2 + 1);
        } else if (p.openingType === 'bottom') {
            doc.text('↓', arrowX, cy + meetingY + lowerH / 2 + 1);
        } else if (p.openingType === 'fixed') {
            doc.setFontSize(5);
            doc.setTextColor(150, 150, 150);
            doc.text('FIX', arrowX - 1, cy + sh / 2);
        }

        doc.setFontSize(6);
        doc.setTextColor(120, 120, 120);
        doc.text(`${w}mm`, cx + sw / 2, cy + sh + 4, { align: 'center' });
        doc.text(`${h}mm`, cx - 3, cy + sh / 2, { angle: 90, align: 'center' });

        return oy + maxH + 8;
    }

    // ─── Export helper ───
    static parseItemForExport(item) {
        const p = EstimateRenderer.parseItem(item);
        const ironText = p.ironList.length > 0
            ? p.ironList.map(pr => `${pr.qty > 1 ? pr.qty + 'x ' : ''}${pr.name}`).join(', ')
            : '-';
        return { ...p, ironText };
    }

    // ─── SVG to PNG helper for PDF export ───
    static svgToImage(svgString, maxW = 200, maxH = 200) {
        return new Promise((resolve) => {
            // Parse SVG to get dimensions
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
            const svgEl = svgDoc.querySelector('svg');
            if (!svgEl) { resolve(null); return; }

            // Ensure SVG has explicit width/height and xmlns
            if (!svgEl.getAttribute('xmlns')) svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

            const vb = svgEl.getAttribute('viewBox');
            let svgW = parseFloat(svgEl.getAttribute('width')) || 300;
            let svgH = parseFloat(svgEl.getAttribute('height')) || 300;
            if (vb) {
                const parts = vb.split(/[\s,]+/);
                svgW = parseFloat(parts[2]) || svgW;
                svgH = parseFloat(parts[3]) || svgH;
            }

            // Replace Jost font with sans-serif for standalone rendering
            let cleanSvg = new XMLSerializer().serializeToString(svgEl);
            cleanSvg = cleanSvg.replace(/Jost,\s*/g, '');

            // Set explicit pixel dimensions for canvas
            const scale = 3; // high res
            const cW = Math.round(svgW * scale);
            const cH = Math.round(svgH * scale);

            // Inject width/height in px for the image
            cleanSvg = cleanSvg.replace(/<svg([^>]*)>/, (m, attrs) => {
                let a = attrs.replace(/width="[^"]*"/g, '').replace(/height="[^"]*"/g, '');
                return `<svg${a} width="${cW}" height="${cH}">`;
            });

            const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(cleanSvg);
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = cW;
                canvas.height = cH;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, cW, cH);
                ctx.drawImage(img, 0, 0, cW, cH);
                resolve({ data: canvas.toDataURL('image/png'), w: cW, h: cH, origW: svgW, origH: svgH });
            };
            img.onerror = (e) => { console.warn('SVG image load failed:', e); resolve(null); };
            img.src = dataUrl;
        });
    }

    // ─── Download PDF ───
    static async downloadEstimatePDF(estimate) {
        const R = EstimateRenderer;
        try {
            const jsPDF = (window.jspdf && window.jspdf.jsPDF) || (window.jsPDF) || (typeof jspdf !== 'undefined' && jspdf.jsPDF);
            if (!jsPDF) throw new Error('jsPDF library not loaded. Please refresh the page.');
            if (!window.html2canvas) throw new Error('html2canvas library not loaded. Please refresh the page.');

            // Build print-only HTML (no buttons, white background, fixed width)
            const printHTML = R.renderEstimatePrintHTML(estimate);

            // Create offscreen container
            const container = document.createElement('div');
            container.style.cssText = 'position:fixed;left:-9999px;top:0;width:800px;background:#fff;padding:40px 50px;font-family:Jost,sans-serif;color:#0a1628;';
            container.innerHTML = printHTML;
            document.body.appendChild(container);

            // Wait for images to load
            const images = container.querySelectorAll('img');
            if (images.length > 0) {
                await Promise.all([...images].map(img => {
                    if (img.complete) return Promise.resolve();
                    return new Promise(res => { img.onload = res; img.onerror = res; });
                }));
            }

            // Render to canvas
            const canvas = await window.html2canvas(container, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                logging: false
            });

            document.body.removeChild(container);

            // Split canvas into A4 pages
            const doc = new jsPDF('p', 'mm', 'a4');
            const pageW = 210;
            const pageH = 297;
            const margin = 5;
            const usableW = pageW - margin * 2;
            const usableH = pageH - margin * 2;

            const imgW = canvas.width;
            const imgH = canvas.height;
            const ratio = usableW / imgW;
            const scaledH = imgH * ratio;
            const pageContentH = usableH;
            const totalPages = Math.ceil(scaledH / pageContentH);

            for (let i = 0; i < totalPages; i++) {
                if (i > 0) doc.addPage();

                // Crop section of canvas for this page
                const srcY = Math.round(i * pageContentH / ratio);
                const srcH = Math.min(Math.round(pageContentH / ratio), imgH - srcY);
                if (srcH <= 0) break;

                const pageCanvas = document.createElement('canvas');
                pageCanvas.width = imgW;
                pageCanvas.height = srcH;
                pageCanvas.getContext('2d').drawImage(canvas, 0, srcY, imgW, srcH, 0, 0, imgW, srcH);

                const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.92);
                const drawH = srcH * ratio;
                doc.addImage(pageImgData, 'JPEG', margin, margin, usableW, drawH);
            }

            doc.save(`Estimate_${estimate.estimate_number || estimate.id.substring(0, 8)}.pdf`);

        } catch (error) {
            console.error('Error downloading PDF:', error);
            alert('Failed to download PDF: ' + error.message);
        }
    }

    // ─── Print-only HTML (no buttons, clean layout) ───
    static renderEstimatePrintHTML(estimate) {
        const R = EstimateRenderer;
        const customer = estimate.customers || {};

        const customerBlock = customer.full_name ? `
            <div style="margin-bottom:15px;">
                <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px;">Customer</div>
                <div style="font-size:14px;"><strong>${customer.full_name}</strong>${customer.company_name ? ` · ${customer.company_name}` : ''}${customer.customer_code ? ` · ${customer.customer_code}` : ''}</div>
                <div style="font-size:12px;color:#666;">${customer.email || ''}${customer.phone ? ` · ${customer.phone}` : ''}</div>
            </div>
        ` : '';

        const itemsHTML = (estimate.estimate_items || []).map(item => {
            const p = R.parseItem(item);
            const svg = R.generateWindowSVG(item);
            const screenshots = p.fc.screenshots || p.spec.screenshots || item.screenshots || null;

            // Build spec rows
            const specs = [];
            if (p.sashType !== 'double') specs.push(['Window Type', p.sashType === 'triple' ? 'Triple Sash' : p.sashType]);
            if (p.headType === 'arch') specs.push(['Head Type', 'Glazing Arch']);
            if (p.sashType === 'triple') specs.push(['Split Ratio', p.splitRatio]);
            if (p.originalWidth && p.originalHeight && (p.originalWidth !== p.width || p.originalHeight !== p.height)) {
                specs.push(['Window Size (Frame)', `${p.width}mm × ${p.height}mm`]);
                specs.push(['Structural Opening', `${p.originalWidth}mm × ${p.originalHeight}mm`]);
            } else {
                specs.push(['Dimensions', `${p.width}mm × ${p.height}mm`]);
            }
            specs.push(['Frame', p.frameText]);
            specs.push(['Opening', p.openingText]);
            specs.push(['Glass', p.glassText]);
            specs.push(['Glass Spec', p.glassSpecText]);
            specs.push(['Glass Finish', p.glassFinishText]);
            specs.push(['Spacer Bar', p.spacerText]);
            specs.push(['Colour', p.colorDisplay]);
            specs.push(['Georgian Bars', p.barsText]);
            if (p.fixBarsText) specs.push(['Fix Panel Bars', p.fixBarsText]);
            specs.push(['PAS24', p.pas24 ? 'Yes' : 'No']);
            specs.push(['Horns', p.hornsText]);
            if (p.hardwareFinish) specs.push(['Hardware Finish', p.hardwareFinish]);

            const ironText = p.ironList.length > 0 
                ? p.ironList.map(pr => `${pr.qty > 1 ? pr.qty + 'x ' : ''}${pr.name}`).join(', ')
                : '-';

            const specRowsHTML = specs.map(([label, value]) => `
                <div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #f0f0f0;">
                    <span style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;">${label}</span>
                    <span style="font-size:12px;color:#0a1628;text-align:right;max-width:60%;">${value}</span>
                </div>
            `).join('');

            const typeLabel = p.sashType === 'triple' ? 'Triple Sash' : p.sashType === 'single' ? 'Single Sash' : 'Double Sash';
            const headLabel = p.headType !== 'flat' ? ` — ${p.headType.charAt(0).toUpperCase() + p.headType.slice(1)} Head` : '';

            return `
                <div style="margin-bottom:25px;border:1px solid #ddd;border-radius:3px;overflow:hidden;page-break-inside:avoid;">
                    <div style="background:#0a1628;padding:10px 20px;display:flex;justify-content:space-between;align-items:center;">
                        <span style="font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#fff;">Window ${item.window_number} — ${typeLabel}${headLabel}</span>
                        <span style="font-size:11px;color:rgba(255,255,255,.5);">Qty: ${p.quantity} · £${R.formatPrice(item.total_price)} + VAT</span>
                    </div>
                    <div style="display:flex;gap:0;">
                        <div style="width:280px;min-width:280px;padding:15px;display:flex;flex-direction:column;align-items:center;gap:10px;background:#f8f8f6;border-right:1px solid #eee;">
                            ${screenshots?.interior ? `<img src="${screenshots.interior}" style="width:250px;border:1px solid #ddd;border-radius:2px;" />` : ''}
                            <div>${svg}</div>
                        </div>
                        <div style="flex:1;padding:15px 20px;">
                            ${specRowsHTML}
                            <div style="margin-top:10px;padding-top:8px;border-top:1px solid #ddd;">
                                <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Ironmongery</div>
                                <div style="font-size:12px;color:#0a1628;">${ironText}</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div style="text-align:center;margin-bottom:30px;padding-bottom:20px;border-bottom:2px solid #0a1628;">
                <div style="font-size:28px;font-weight:700;color:#0a1628;letter-spacing:2px;">Prime Sash Windows</div>
                <div style="font-size:11px;color:#999;margin-top:3px;">A trading name of Skylon Joinery LTD</div>
                <div style="font-size:18px;font-weight:600;color:#0a1628;margin-top:15px;">Estimate: ${estimate.estimate_number || ''}</div>
            </div>

            ${customerBlock}

            <div style="margin-bottom:20px;font-size:12px;color:#555;line-height:1.8;">
                ${estimate.project_name ? `<div><strong>Project:</strong> ${estimate.project_name}</div>` : ''}
                ${estimate.delivery_address ? `<div><strong>Address:</strong> ${estimate.delivery_address}</div>` : ''}
                <div><strong>Date:</strong> ${new Date(estimate.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })}</div>
                <div><strong>Status:</strong> ${R.getStatusConfig(estimate.status).label}</div>
            </div>

            ${itemsHTML}

            <div style="border-top:2px solid #0a1628;padding-top:15px;margin-top:20px;text-align:right;">
                <div style="font-size:12px;color:#888;margin-bottom:3px;">
                    <span style="text-transform:uppercase;letter-spacing:1px;">Subtotal (excl. VAT):</span>
                    <span style="color:#0a1628;margin-left:20px;font-size:14px;">£${R.formatPrice(estimate.total_price)}</span>
                </div>
                <div style="font-size:12px;color:#888;margin-bottom:8px;">
                    <span style="text-transform:uppercase;letter-spacing:1px;">VAT (20%):</span>
                    <span style="color:#0a1628;margin-left:20px;font-size:14px;">£${R.formatPrice(estimate.total_price * 0.2)}</span>
                </div>
                <div style="font-size:14px;padding-top:8px;border-top:1px solid #ccc;">
                    <span style="text-transform:uppercase;letter-spacing:2px;color:#888;">Total (incl. VAT):</span>
                    <span style="font-size:26px;font-weight:700;color:#0a1628;margin-left:20px;">£${R.formatPrice(estimate.total_price * 1.2)}</span>
                </div>
            </div>

            <div style="text-align:center;margin-top:30px;padding-top:15px;border-top:1px solid #eee;font-size:10px;color:#aaa;">
                Prime Sash Windows | A trading name of Skylon Joinery LTD<br>
                info@skylonjoinery.co.uk | 07842 510 060 | 01992 450 848<br>
                Unit 3, Leaside Industrial Park, Sedge Green, Nazeing, EN9 2BF
            </div>
        `;
    }

    // ─── Download Excel ───
    static downloadEstimateExcel(estimate) {
        const R = EstimateRenderer;
        try {
            const wsData = [
                ['Prime Sash Windows — Estimate'],
                ['A trading name of Skylon Joinery LTD'],
                [''],
                ['Estimate Number:', estimate.estimate_number || ''],
                ['Project:', estimate.project_name || '-'],
                ['Address:', estimate.delivery_address || '-'],
                ['Date:', new Date(estimate.created_at).toLocaleDateString('en-GB')],
                ['Status:', R.getStatusConfig(estimate.status).label],
                ['']
            ];

            // Customer info
            const customer = estimate.customers;
            if (customer) {
                wsData.push(['Customer:', customer.full_name || '']);
                wsData.push(['Email:', customer.email || '']);
                wsData.push(['Phone:', customer.phone || '']);
                wsData.push(['Code:', customer.customer_code || '']);
                wsData.push(['']);
            }

            wsData.push(['Window', 'Type', 'Width', 'Height', 'Frame', 'Glass', 'Glass Spec', 'Glass Finish', 'Spacer', 'Opening', 'Colour', 'Bars', 'Fix Bars', 'PAS24', 'Horns', 'Hardware Finish', 'Ironmongery', 'Qty', 'Price + VAT']);

            estimate.estimate_items?.forEach(item => {
                const p = R.parseItemForExport(item);
                const typeLabel = p.sashType === 'triple' ? 'Triple Sash' : p.sashType === 'single' ? 'Single Sash' : 'Double Sash';
                const headLabel = p.headType !== 'flat' ? ` (${p.headType})` : '';
                wsData.push([
                    item.window_number,
                    typeLabel + headLabel,
                    p.width,
                    p.height,
                    p.frameText,
                    p.glassText,
                    p.glassSpecText,
                    p.glassFinishText,
                    p.spacerText,
                    p.openingText,
                    p.colorDisplay,
                    p.barsText,
                    p.fixBarsText || '-',
                    p.pas24 ? 'Yes' : 'No',
                    p.hornsText,
                    p.hardwareFinish || '-',
                    p.ironText,
                    p.quantity,
                    parseFloat(item.total_price) || 0
                ]);
            });

            wsData.push(['']);
            wsData.push(['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'Subtotal:', parseFloat(estimate.total_price) || 0]);
            wsData.push(['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'VAT (20%):', (parseFloat(estimate.total_price) || 0) * 0.2]);
            wsData.push(['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'Total incl. VAT:', (parseFloat(estimate.total_price) || 0) * 1.2]);

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(wsData);

            ws['!cols'] = [
                { wch: 10 }, { wch: 18 }, { wch: 8 }, { wch: 8 }, { wch: 22 },
                { wch: 28 }, { wch: 12 }, { wch: 22 }, { wch: 22 }, { wch: 14 },
                { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 6 }, { wch: 10 },
                { wch: 16 }, { wch: 40 }, { wch: 5 }, { wch: 12 }
            ];

            XLSX.utils.book_append_sheet(wb, ws, 'Estimate');
            XLSX.writeFile(wb, `Estimate_${estimate.estimate_number || estimate.id.substring(0, 8)}.xlsx`);

        } catch (error) {
            console.error('Error downloading Excel:', error);
            alert('Failed to download Excel: ' + error.message);
        }
    }

    // ─── Attach PDF/Excel buttons after rendering ───
    static attachExportButtons(estimate) {
        const pdfBtn = document.getElementById('download-estimate-pdf');
        if (pdfBtn) pdfBtn.addEventListener('click', () => EstimateRenderer.downloadEstimatePDF(estimate));
        const excelBtn = document.getElementById('download-estimate-excel');
        if (excelBtn) excelBtn.addEventListener('click', () => EstimateRenderer.downloadEstimateExcel(estimate));
    }
}

// Make globally available
window.EstimateRenderer = EstimateRenderer;