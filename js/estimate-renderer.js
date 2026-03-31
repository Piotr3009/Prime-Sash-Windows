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

        // IRONMONGERY
        let ironList = [];
        let ironSource = item.ironmongery;
        if (!ironSource && fc.ironmongery) ironSource = fc.ironmongery;
        if (ironSource) {
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
        let hardwareFinish = item.ironmongery_finish || fc.ironmongeryFinish;
        if (!hardwareFinish && ironList.length > 0) {
            const colors = [...new Set(ironList.map(p => p.color).filter(Boolean))];
            hardwareFinish = colors.length > 0 ? colors.join(' / ') : null;
        }

        // COLOR
        let colorDisplay = '';
        if (item.color_type === 'single' || fc.colorType === 'single') {
            if (fc.singleColor && fc.singleColor !== 'custom' && fc.singleColor !== 'white') {
                colorDisplay = fc.colorSingleName || fc.singleColor;
            } else if (fc.singleColor === 'white') {
                colorDisplay = 'Pure White';
            } else if (spec.colorSingleName && spec.colorSingleName !== 'Custom Color') {
                colorDisplay = spec.colorSingleName;
            } else if (fc.exteriorColor || fc.interiorColor) {
                const ext = fc.exteriorColor || '—';
                const int = fc.interiorColor || '—';
                colorDisplay = ext === int ? ext.charAt(0).toUpperCase() + ext.slice(1) : `Ext: ${ext} / Int: ${int}`;
            } else {
                colorDisplay = item.color_single || 'White';
            }
        } else {
            const extName = fc.colorExteriorName || fc.exteriorColor || item.color_exterior || '—';
            const intName = fc.colorInteriorName || fc.interiorColor || item.color_interior || '—';
            colorDisplay = `Ext: ${extName} / Int: ${intName}`;
            if (item.custom_exterior_color) colorDisplay += ` (Custom: ${item.custom_exterior_color})`;
        }

        // HORNS
        const horns = item.horns || fc.horns || 'none';
        const hornsText = ({'A':'Richmond','D':'Type D','none':'None'})[horns] || horns;

        // FROSTED
        const glassFinish = item.glass_finish || fc.glassFinish || 'clear';
        const showFrosted = glassFinish !== 'clear' && item.frosted_location;

        // OPENING
        const openingLabels = { both: 'Both Sashes', bottom: 'Bottom Only', fixed: 'Fixed', top: 'Top Only' };
        const openingText = openingLabels[item.opening_type] || item.opening_type || '—';

        // SPACER
        const spacer = item.spacer_color || 'silver';
        const spacerText = ({'silver':'Silver (Stainless Steel)','white':'White','black':'Black'})[spacer] || spacer;

        // BARS
        let barsText = 'None';
        if (item.upper_bars && item.upper_bars !== 'none') {
            barsText = `Upper: ${item.upper_bars}, Lower: ${item.lower_bars || item.upper_bars}`;
        }

        return { fc, spec, ironList, hardwareFinish, colorDisplay, horns, hornsText, glassFinish, showFrosted, openingText, spacer, spacerText, barsText };
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
            const spec = item.specification ? (typeof item.specification === 'string' ? JSON.parse(item.specification) : item.specification) : {};
            const fc = spec.fullConfig || spec || {};
            const screenshots = item.screenshots || spec.screenshots || fc.screenshots || null;

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
                    <span style="font-family:'Jost',sans-serif;font-size:.72rem;color:rgba(255,255,255,.5);">Qty: ${item.quantity} · £${R.formatPrice(item.total_price)} + VAT</span>
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
                            ${fc.sashType && fc.sashType !== 'double' ? R.specRow('Window Type', fc.sashType === 'triple' ? 'Triple Sash' : 'Double Hung') : ''}
                            ${fc.headType === 'arch' ? R.specRow('Head Type', 'Glazing Arch') : ''}
                            ${fc.splitRatio && fc.sashType === 'triple' ? R.specRow('Split Ratio', fc.splitRatio) : ''}
                            ${item.original_width && item.original_height && (item.original_width !== item.width || item.original_height !== item.height) 
                                ? R.specRow('Window Size (Frame)', `${item.width}mm × ${item.height}mm`) + R.specRow('Structural Opening', `${item.original_width}mm × ${item.original_height}mm`)
                                : R.specRow('Dimensions', `${item.width}mm × ${item.height}mm`)}
                            ${R.specRow('Frame', `${item.frame_type || 'standard'} (164mm)`)}
                            ${R.specRow('Opening', p.openingText)}
                            ${R.specRow('Glass', `${item.glass_type || 'double'}${item.glass_type === 'double' ? ' (4/16/4, U:1.4)' : item.glass_type === 'triple' ? ' (Triple)' : ''}`)}
                            ${item.glass_spec ? R.specRow('Glass Spec', item.glass_spec === 'toughened' ? 'Toughened' : 'Laminated') : ''}
                            ${R.specRow('Spacer Bar', p.spacerText)}
                            ${p.glassFinish !== 'clear' ? R.specRow('Glass Finish', p.glassFinish) : ''}
                            ${p.showFrosted ? R.specRow('Frosted', item.frosted_location === 'both' ? 'Both Sashes' : 'Bottom Only') : ''}
                            ${R.specRow('Colour', p.colorDisplay)}
                            ${item.upper_bars && item.upper_bars !== 'none' ? R.specRow('Georgian Bars', `Upper: ${item.upper_bars}, Lower: ${item.lower_bars || item.upper_bars}`) : R.specRow('Georgian Bars', 'None')}
                            ${fc.fixUpperBars && fc.fixUpperBars !== 'none' ? R.specRow('Fix Panel Bars', `Upper: ${fc.fixUpperBars}, Lower: ${fc.fixLowerBars || fc.fixUpperBars}`) : ''}
                            ${R.specRow('PAS24', item.pas24 ? 'Yes ✓' : 'No')}
                            ${p.horns !== 'none' ? R.specRow('Horns', p.hornsText) : R.specRow('Horns', 'None')}
                            ${p.hardwareFinish ? R.specRow('Hardware Finish', p.hardwareFinish) : ''}
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
    static generateWindowSVG(item) {
        const spec = item.specification ? (typeof item.specification === 'string' ? JSON.parse(item.specification) : item.specification) : {};
        const fc = spec.fullConfig || spec || {};
        const sashType = fc.sashType || 'double';
        const headType = fc.headType || 'flat';
        const splitRatio = fc.splitRatio || '1/4-1/2-1/4';

        const w = item.width || 1000;
        const h = item.height || 1500;
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

            // Bars on panels
            const patternDefs = {'none':{h:0,v:0},'2x2':{h:0,v:1},'3x3':{h:0,v:2},'4x4':{h:1,v:1},'6x6':{h:1,v:2},'9x9':{h:2,v:2}};
            const upperBars = patternDefs[item.upper_bars] || {h:0,v:0};
            const fixBars = patternDefs[fc.fixUpperBars] || {h:0,v:0};

            sections.forEach((sec, i) => {
                const bars = i === 1 ? upperBars : fixBars;
                const glassX = sec.x + 2;
                const glassW = sec.w - 4;
                const upperT = oy + frameW + 1 + (headType === 'arch' ? archRise : 0);
                const upperH = meetingY - frameW - 2 - (headType === 'arch' ? archRise : 0);
                for (let j = 1; j <= bars.v; j++) {
                    const bx = glassX + glassW * j / (bars.v + 1);
                    svg += `<line x1="${bx}" y1="${upperT}" x2="${bx}" y2="${oy + meetingY - 1}" stroke="${light}" stroke-width="1"/>`;
                }
                for (let j = 1; j <= bars.h; j++) {
                    const by = upperT + upperH * j / (bars.h + 1);
                    svg += `<line x1="${glassX}" y1="${by}" x2="${glassX + glassW}" y2="${by}" stroke="${light}" stroke-width="1"/>`;
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

            // Bars
            const patternDefs = {'none':{h:0,v:0},'2x2':{h:0,v:1},'3x3':{h:0,v:2},'4x4':{h:1,v:1},'6x6':{h:1,v:2},'9x9':{h:2,v:2}};
            const upperBars = patternDefs[item.upper_bars] || {h:0,v:0};
            const lowerBars = patternDefs[item.lower_bars] || patternDefs[item.upper_bars] || {h:0,v:0};
            const bUpperT = upperT + (headType === 'arch' ? archRise : 0);
            const bUpperH = meetingY - frameW - 2 - (headType === 'arch' ? archRise : 0);

            for (let i = 1; i <= upperBars.v; i++) {
                const x = glassX + glassW * i / (upperBars.v + 1);
                svg += `<line x1="${x}" y1="${bUpperT}" x2="${x}" y2="${oy + meetingY - 1}" stroke="${light}" stroke-width="1.2"/>`;
            }
            for (let i = 1; i <= upperBars.h; i++) {
                const y = bUpperT + bUpperH * i / (upperBars.h + 1);
                svg += `<line x1="${glassX}" y1="${y}" x2="${glassX + glassW}" y2="${y}" stroke="${light}" stroke-width="1.2"/>`;
            }
            for (let i = 1; i <= lowerBars.v; i++) {
                const x = glassX + glassW * i / (lowerBars.v + 1);
                svg += `<line x1="${x}" y1="${lowerT}" x2="${x}" y2="${lowerT + lowerH}" stroke="${light}" stroke-width="1.2"/>`;
            }
            for (let i = 1; i <= lowerBars.h; i++) {
                const y = lowerT + lowerH * i / (lowerBars.h + 1);
                svg += `<line x1="${glassX}" y1="${y}" x2="${glassX + glassW}" y2="${y}" stroke="${light}" stroke-width="1.2"/>`;
            }

            // Opening arrows
            const arrowX = ox + drawW + 14;
            if (item.opening_type === 'both') {
                svg += `<text x="${arrowX}" y="${oy + meetingY/2 + 3}" font-family="Jost,sans-serif" font-size="10" fill="${stroke}" text-anchor="middle">↑</text>`;
                svg += `<text x="${arrowX}" y="${oy + meetingY + lowerH/2 + 3}" font-family="Jost,sans-serif" font-size="10" fill="${stroke}" text-anchor="middle">↓</text>`;
            } else if (item.opening_type === 'bottom') {
                svg += `<text x="${arrowX}" y="${oy + meetingY + lowerH/2 + 3}" font-family="Jost,sans-serif" font-size="10" fill="${stroke}" text-anchor="middle">↓</text>`;
            } else if (item.opening_type === 'fixed') {
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

    // ─── PDF Window Drawing ───
    static generateWindowPDF(doc, item, ox, oy) {
        const maxW = 50, maxH = 55;
        const w = item.width || 1000;
        const h = item.height || 1500;
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
        const upperDiv = patternDefs[item.upper_bars] || {h:0,v:0};
        const lowerDiv = patternDefs[item.lower_bars] || patternDefs[item.upper_bars] || {h:0,v:0};

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
        if (item.opening_type === 'both') {
            doc.text('↑', arrowX, cy + meetingY / 2 + 1);
            doc.text('↓', arrowX, cy + meetingY + lowerH / 2 + 1);
        } else if (item.opening_type === 'bottom') {
            doc.text('↓', arrowX, cy + meetingY + lowerH / 2 + 1);
        } else if (item.opening_type === 'fixed') {
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

    // ─── Download PDF ───
    static async downloadEstimatePDF(estimate) {
        const R = EstimateRenderer;
        try {
            const jsPDF = (window.jspdf && window.jspdf.jsPDF) || (window.jsPDF) || (typeof jspdf !== 'undefined' && jspdf.jsPDF);
            if (!jsPDF) throw new Error('jsPDF library not loaded. Please refresh the page.');
            const doc = new jsPDF();

            doc.setFontSize(20);
            doc.setTextColor(10, 22, 40);
            doc.text('Prime Sash Windows', 105, 20, { align: 'center' });

            doc.setFontSize(9);
            doc.setTextColor(120, 120, 120);
            doc.text('A trading name of Skylon Joinery LTD', 105, 27, { align: 'center' });

            doc.setFontSize(14);
            doc.setTextColor(10, 22, 40);
            doc.text(`Estimate: ${estimate.estimate_number || ''}`, 105, 38, { align: 'center' });

            let yPos = 50;
            doc.setFontSize(10);
            doc.setTextColor(60, 60, 60);

            // Customer info if available
            const customer = estimate.customers;
            if (customer) {
                doc.text(`Customer: ${customer.full_name || ''} ${customer.customer_code ? '(' + customer.customer_code + ')' : ''}`, 14, yPos);
                yPos += 6;
                if (customer.email) { doc.text(`Email: ${customer.email}`, 14, yPos); yPos += 6; }
                if (customer.phone) { doc.text(`Phone: ${customer.phone}`, 14, yPos); yPos += 6; }
            }

            if (estimate.project_name) { doc.text(`Project: ${estimate.project_name}`, 14, yPos); yPos += 6; }
            if (estimate.delivery_address) { doc.text(`Address: ${estimate.delivery_address}`, 14, yPos); yPos += 6; }
            doc.text(`Date: ${new Date(estimate.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })}`, 14, yPos);
            yPos += 6;
            doc.text(`Status: ${R.getStatusConfig(estimate.status).label}`, 14, yPos);
            yPos += 12;

            // Per-window
            estimate.estimate_items?.forEach((item) => {
                const p = R.parseItemForExport(item);

                if (yPos > 200) { doc.addPage(); yPos = 20; }

                doc.setFontSize(11);
                doc.setTextColor(10, 22, 40);
                doc.text(`Window ${item.window_number} (Qty: ${item.quantity})`, 14, yPos);
                yPos += 3;

                const drawStartY = yPos;
                R.generateWindowPDF(doc, item, 14, yPos);

                const rows = [['Dimensions', `${item.width}mm × ${item.height}mm`]];
                if (item.original_width && item.original_height && (item.original_width !== item.width || item.original_height !== item.height)) {
                    rows[0] = ['Window Size (Frame)', `${item.width}mm × ${item.height}mm`];
                    rows.push(['Structural Opening', `${item.original_width}mm × ${item.original_height}mm`]);
                }
                rows.push(
                    ['Frame', `${item.frame_type || 'standard'} (164mm)`],
                    ['Opening', p.openingText],
                    ['Glass', item.glass_type || 'double'],
                    ['Glass Spec', item.glass_spec || 'standard'],
                    ['Spacer Bar', p.spacerText],
                    ['Colour', p.colorDisplay],
                    ['Georgian Bars', p.barsText],
                    ['PAS24', item.pas24 ? 'Yes' : 'No'],
                    ['Horns', p.hornsText],
                    ['Ironmongery', p.ironText],
                    ['Price', `£${R.formatPrice(item.total_price)} + VAT`]
                );

                doc.autoTable({
                    startY: yPos,
                    body: rows,
                    theme: 'plain',
                    styles: { fontSize: 8, cellPadding: 1.5 },
                    columnStyles: {
                        0: { fontStyle: 'bold', cellWidth: 30, textColor: [100, 100, 100] },
                        1: { cellWidth: 90 }
                    },
                    margin: { left: 72 }
                });

                const tableEndY = doc.lastAutoTable.finalY;
                const drawEndY = drawStartY + 63;
                yPos = Math.max(tableEndY, drawEndY) + 5;

                doc.setDrawColor(200, 200, 200);
                doc.setLineWidth(0.2);
                doc.line(14, yPos, 196, yPos);
                yPos += 5;
            });

            // Totals
            if (yPos > 250) { doc.addPage(); yPos = 20; }

            doc.setDrawColor(10, 22, 40);
            doc.line(14, yPos, 196, yPos);
            yPos += 8;

            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text('Subtotal (excl. VAT):', 140, yPos, { align: 'right' });
            doc.setTextColor(10, 22, 40);
            doc.text(`£${R.formatPrice(estimate.total_price)}`, 196, yPos, { align: 'right' });
            yPos += 6;

            doc.setTextColor(100, 100, 100);
            doc.text('VAT (20%):', 140, yPos, { align: 'right' });
            doc.setTextColor(10, 22, 40);
            doc.text(`£${R.formatPrice(estimate.total_price * 0.2)}`, 196, yPos, { align: 'right' });
            yPos += 8;

            doc.setFontSize(13);
            doc.setTextColor(10, 22, 40);
            doc.text('Total (incl. VAT):', 140, yPos, { align: 'right' });
            doc.text(`£${R.formatPrice(estimate.total_price * 1.2)}`, 196, yPos, { align: 'right' });

            doc.setFontSize(8);
            doc.setTextColor(140, 140, 140);
            doc.text('Prime Sash Windows | A trading name of Skylon Joinery LTD', 105, 282, { align: 'center' });
            doc.text('info@skylonjoinery.co.uk | 07842 510 060 | 01992 450 848', 105, 287, { align: 'center' });
            doc.text('Unit 3, Leaside Industrial Park, Sedge Green, Nazeing, EN9 2BF', 105, 292, { align: 'center' });

            doc.save(`Estimate_${estimate.estimate_number || estimate.id.substring(0, 8)}.pdf`);

        } catch (error) {
            console.error('Error downloading PDF:', error);
            alert('Failed to download PDF: ' + error.message);
        }
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

            wsData.push(['Window', 'Width', 'Height', 'Frame', 'Glass', 'Glass Spec', 'Spacer', 'Opening', 'Colour', 'Bars', 'PAS24', 'Horns', 'Ironmongery', 'Qty', 'Price + VAT']);

            estimate.estimate_items?.forEach(item => {
                const p = R.parseItemForExport(item);
                wsData.push([
                    item.window_number,
                    item.width,
                    item.height,
                    item.frame_type || 'standard',
                    item.glass_type || 'double',
                    item.glass_spec || 'standard',
                    p.spacerText,
                    p.openingText,
                    p.colorDisplay,
                    p.barsText,
                    item.pas24 ? 'Yes' : 'No',
                    p.hornsText,
                    p.ironText,
                    item.quantity,
                    parseFloat(item.total_price) || 0
                ]);
            });

            wsData.push(['']);
            wsData.push(['', '', '', '', '', '', '', '', '', '', '', '', '', 'Subtotal:', parseFloat(estimate.total_price) || 0]);
            wsData.push(['', '', '', '', '', '', '', '', '', '', '', '', '', 'VAT (20%):', (parseFloat(estimate.total_price) || 0) * 0.2]);
            wsData.push(['', '', '', '', '', '', '', '', '', '', '', '', '', 'Total incl. VAT:', (parseFloat(estimate.total_price) || 0) * 1.2]);

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(wsData);

            ws['!cols'] = [
                { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 10 },
                { wch: 10 }, { wch: 12 }, { wch: 8 }, { wch: 14 },
                { wch: 25 }, { wch: 20 }, { wch: 6 }, { wch: 10 },
                { wch: 40 }, { wch: 5 }, { wch: 12 }
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