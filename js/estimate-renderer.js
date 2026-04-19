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
        const casementType = fc.casementType || 'standard';
        const casArchShape = fc.casArchShape || null;
        const casArchHinge = fc.casArchHinge || null;
        const fixSemiBarPattern = fc.fixSemiBarPattern || 'none';
        const fixGothicBars = fc.fixGothicBars || 'none';
        const casementHBars = fc.casementHBars || fc.hBars || 0;
        const casementVBars = fc.casementVBars || fc.vBars || 0;

        // Build type text
        const shapeNames = { 'gothic-arch': 'Gothic Arch', 'semi-circle': 'Semi-Circle', 'segmental-arch': 'Segmental Arch', 'elliptical-arch': 'Elliptical Arch' };
        const hingeNames = { 'left': 'Right Hinge', 'right': 'Left Hinge' };
        let casementTypeText;
        if (casementType === 'arched' && casArchShape) {
            casementTypeText = 'Arched Casement — ' + (shapeNames[casArchShape] || casArchShape);
            if (casArchHinge) casementTypeText += ' (' + (hingeNames[casArchHinge] || casArchHinge) + ')';
        } else {
            casementTypeText = 'Casement — Layout ' + casementLayout;
        }

        // Build bars text with pattern
        const patNames = { 'half-hub': 'Half Hub', 'hub-spoke': 'Hub & Spoke', 'double-hub-spoke': 'Double Hub', 'triple-hub-spoke': 'Triple Hub', 'intersecting': 'Intersecting' };
        let casementBarsText = 'None';
        if (casementHBars > 0 || casementVBars > 0) {
            casementBarsText = casementHBars + ' horizontal, ' + casementVBars + ' vertical';
        }
        let patternText = '';
        if (fixSemiBarPattern !== 'none' && patNames[fixSemiBarPattern]) patternText = ' + ' + patNames[fixSemiBarPattern];
        if (fixGothicBars !== 'none' && patNames[fixGothicBars]) patternText = ' + ' + patNames[fixGothicBars];
        if (patternText) {
            casementBarsText = (casementBarsText === 'None' ? '' : casementBarsText) + patternText;
            if (casementBarsText.startsWith(' + ')) casementBarsText = casementBarsText.substring(3);
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

        // ═══ FIX-ONLY FIELDS ═══
        const fixShape = fc.fixShape || 'rectangle';
        const fixType = fc.fixType || 'standard';
        const fixCircleBarPattern = fc.fixCircleBarPattern || 'none';
        const fixCircleOffset = fc.fixCircleOffset || 200;
        const fixShapeNames = { 'rectangle': 'Rectangle', 'gothic-arch': 'Gothic Arch', 'semi-circle': 'Semi-Circle', 'segmental-arch': 'Segmental Arch', 'elliptical-arch': 'Elliptical Arch', 'circle': 'Circle' };
        const fixTypeNames = { 'standard': 'Standard', 'fd30': 'FD30 Fire Rated', 'fd60': 'FD60 Fire Rated' };
        const fixTypeText = 'Fix Frame — ' + (fixShapeNames[fixShape] || fixShape) + ' (' + (fixTypeNames[fixType] || fixType) + ')';

        // Fix bars with ALL patterns
        let fixBarsFull = 'None';
        const fxH = casementHBars, fxV = casementVBars;
        if (fxH > 0 || fxV > 0) fixBarsFull = fxH + ' horizontal, ' + fxV + ' vertical';
        let fxPattern = '';
        const fxPatNames = { 'half-hub': 'Half Hub', 'hub-spoke': 'Hub & Spoke', 'double-hub-spoke': 'Double Hub', 'triple-hub-spoke': 'Triple Hub', 'intersecting': 'Intersecting', 'sunburst': 'Sunburst' };
        if (fixSemiBarPattern !== 'none' && fxPatNames[fixSemiBarPattern]) fxPattern = ' + ' + fxPatNames[fixSemiBarPattern];
        if (fixGothicBars !== 'none' && fxPatNames[fixGothicBars]) fxPattern = ' + ' + fxPatNames[fixGothicBars];
        if (fixCircleBarPattern !== 'none' && fxPatNames[fixCircleBarPattern]) fxPattern = ' + ' + fxPatNames[fixCircleBarPattern];
        if (fixCircleBarPattern === 'sunburst') fxPattern += ' (Offset: ' + fixCircleOffset + 'mm)';
        if (fxPattern) {
            fixBarsFull = (fixBarsFull === 'None' ? '' : fixBarsFull) + fxPattern;
            if (fixBarsFull.startsWith(' + ')) fixBarsFull = fixBarsFull.substring(3);
        }

        // Fix spacer (uses 'spacer' key not 'spacerColor')
        const fixSpacer = fc.spacer || fc.spacerColor || 'silver';
        const fixSpacerText = fixSpacer === 'black' ? 'Black' : fixSpacer === 'white' ? 'White' : 'Silver (Stainless Steel)';

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
            casementLayout, casementType, casArchShape, casArchHinge, casementTypeText,
            casementHBars, casementVBars, casementBarsText,
            sillExtension, sillText, trickleVent, trickleColour, trickleText,
            sealColour, safetyGlass, safetyGlassText,
            glassSpecCasement, glassSpecCasementText, fanlightHeight,
            fixShape, fixType, fixCircleBarPattern, fixCircleOffset, fixTypeText, fixBarsFull, fixSpacer, fixSpacerText
        };
    }

    // ─── Render full estimate modal content ───
    // options: { isEditable, isAdmin, adminCallbacks, closeCallback, renameCallback, deleteCallback }
    static renderEstimateHTML(estimate, options = {}) {
        const R = EstimateRenderer;
        const isEditable = options.isEditable ?? (estimate.status === 'sent');
        const isAdmin = options.isAdmin ?? false;

        // Customer info
        const customer = estimate.customers || {};
        const customerName = customer.full_name || 'Valued Client';

        // Additional services calculations (same as PDF)
        const INSTALLATION_RATE = 400;
        const DELIVERY_FLAT = 300;
        const items = estimate.estimate_items || [];
        const totalQty = items.reduce((s, i) => {
            const p = R.parseItem(i);
            return s + (p.quantity || 1);
        }, 0);
        const totalEx = items.reduce((s, i) => s + parseFloat(i.total_price || 0), 0);
        const installationCost = INSTALLATION_RATE * totalQty;
        const deliveryCost = DELIVERY_FLAT;
        const totalWindowsPlusInstallation = totalEx + installationCost;
        const grandTotal = totalEx + installationCost + deliveryCost;
        const depositHalf = totalWindowsPlusInstallation / 2;

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
            <div style="background:var(--cream2);border:1px solid rgba(158,158,144,.15);margin-bottom:1.5rem;padding:0;border-radius:2px;overflow:hidden;break-inside:avoid;page-break-inside:avoid;">
                <div style="background:var(--navy);padding:.8rem 1.5rem;display:flex;justify-content:space-between;align-items:center;">
                    <div style="display:flex;align-items:center;gap:.8rem;">
                        <span style="font-family:'Jost',sans-serif;font-size:.85rem;font-weight:500;letter-spacing:.15em;text-transform:uppercase;color:#fff;">Window ${item.window_number}</span>
                        ${isEditable && !isAdmin ? `
                        <button onclick="dashboard.renameWindow('${item.id}','${(item.window_number || '').replace(/'/g, "\\'")}','${estimate.id}')" style="background:transparent;border:1px solid rgba(255,255,255,.25);color:rgba(255,255,255,.6);font-family:'Jost',sans-serif;font-size:.55rem;letter-spacing:.1em;text-transform:uppercase;padding:.2rem .5rem;cursor:pointer;border-radius:2px;">Rename</button>
                        <button onclick="dashboard.deleteWindow('${item.id}','${estimate.id}')" style="background:transparent;border:1px solid rgba(220,80,80,.4);color:rgba(220,80,80,.7);font-family:'Jost',sans-serif;font-size:.55rem;letter-spacing:.1em;text-transform:uppercase;padding:.2rem .5rem;cursor:pointer;border-radius:2px;">Delete</button>
                        ` : ''}
                    </div>
                    <span style="font-family:'Jost',sans-serif;font-size:.72rem;color:rgba(255,255,255,.5);">Qty: ${p.quantity} · £${R.formatPrice(item.total_price)}</span>
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
                            ${R.specRow('Type', p.casementTypeText)}
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
                            ${R.specRow('Trickle Vent', p.trickleText)}
                            ${p.hardwareFinish ? R.specRow('Hardware Finish', p.hardwareFinish) : ''}
                            ` : p.windowType === 'fix-only' ? `
                            ${R.specRow('Type', p.fixTypeText)}
                            ${R.specRow('Dimensions', p.width + 'mm × ' + p.height + 'mm')}
                            ${R.specRow('Glass', p.glassText)}
                            ${R.specRow('Spacer Bar', p.fixSpacerText)}
                            ${R.specRow('Glass Finish', p.glassFinishText)}
                            ${R.specRow('Colour', p.colorDisplay)}
                            ${R.specRow('Bars', p.fixBarsFull)}
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

        // ─── Shared HTML fragments (match PDF content) ───
        const GOLD = '#c9a96e';
        const CREAM_LIGHT = '#f5f4f0';
        const BORDER = '#e5e4dd';

        // Banner (compact, ~P1b)
        const bannerHTML = `
            <div style="background:var(--navy);padding:2rem 2rem 1.6rem;margin:-2rem -2rem 1.5rem;color:#fff;text-align:center;">
                <div style="font-family:'Jost',sans-serif;font-weight:300;letter-spacing:.4em;font-size:1rem;border-top:1px solid #fff;border-bottom:1px solid #fff;padding:.4rem 0;display:inline-block;">PRIME&nbsp;&nbsp;SASH</div>
                <div style="font-family:'Jost',sans-serif;font-weight:300;letter-spacing:.35em;font-size:.65rem;margin-top:.3rem;opacity:.9;">W I N D O W S</div>
                <div style="font-family:'Cormorant Garamond',serif;font-style:italic;font-size:1.1rem;margin-top:.8rem;opacity:.85;">for ${customerName}</div>
            </div>
        `;

        // About section
        const aboutHTML = `
            <div style="margin:2rem 0;padding:1.5rem 0;border-top:1px solid ${BORDER};border-bottom:1px solid ${BORDER};">
                <h2 style="font-family:'Cormorant Garamond',serif;font-weight:700;color:var(--navy);font-size:1.5rem;margin:0 0 .8rem;">About Prime Sash Windows</h2>
                <p style="font-family:'Jost',sans-serif;font-weight:300;font-size:.85rem;color:#1a1a1a;line-height:1.7;margin-bottom:.7rem;">Welcome to Prime Sash Windows, where craftsmanship meets functionality. We specialise in creating high-quality timber windows and doors that enhance both the aesthetic appeal and energy efficiency of your home.</p>
                <p style="font-family:'Jost',sans-serif;font-weight:300;font-size:.85rem;color:#1a1a1a;line-height:1.7;margin-bottom:.7rem;">Serving London and surrounding areas, we bring over a decade of expertise in bespoke timber window and door manufacturing and installation. As members of The Joinery Network and FENSA registered installers, we offer free site surveys within 25 miles of London.</p>
                <p style="font-family:'Jost',sans-serif;font-weight:300;font-size:.85rem;color:#1a1a1a;line-height:1.7;margin-bottom:1rem;">Every window is produced in our in-house workshop using the Lignum engineered timber system — hardwood only, PAS24 security certified, finished with premium Sikkens coatings. Traditional appearance, modern performance.</p>
                <div style="padding:.9rem 1.2rem;background:${CREAM_LIGHT};border-left:3px solid ${GOLD};font-family:'Jost',sans-serif;font-size:.78rem;color:var(--muted);line-height:1.55;">
                    <strong style="color:var(--navy);font-weight:500;">Prime Sash Windows</strong> is a trading name of <strong style="color:var(--navy);font-weight:500;">Skylon Joinery Ltd</strong> — a London-based bespoke joinery company registered in England and Wales (Company No. 12946103). All contracts, invoices and payments are issued by Skylon Joinery Ltd.
                </div>
            </div>
        `;

        // Certifications (P2a: 4 in row)
        const certCard = (title, text) => `
            <div style="border:1px solid ${BORDER};padding:1rem;background:#fff;">
                <h3 style="font-family:'Cormorant Garamond',serif;font-weight:600;font-size:.95rem;color:var(--navy);margin:0 0 .3rem;">${title}</h3>
                <p style="font-family:'Jost',sans-serif;font-weight:300;font-size:.72rem;color:var(--muted);line-height:1.5;margin:0;">${text}</p>
            </div>
        `;
        const certificationsHTML = `
            <div style="margin:2rem 0;">
                <h2 style="font-family:'Cormorant Garamond',serif;font-weight:700;color:var(--navy);font-size:1.5rem;margin:0 0 .4rem;">Certifications &amp; Technology</h2>
                <p style="font-family:'Jost',sans-serif;font-weight:300;font-size:.82rem;color:var(--muted);line-height:1.65;margin:0 0 1.2rem;">Every Prime Sash window is backed by independently verified certifications — legally recognised standards that protect your investment, your safety, and the value of your property.</p>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:.8rem;">
                    ${certCard('FENSA Registered', 'Installer certified under the UK Government\u2011approved FENSA scheme. Compliance with Building Regulations for replacement windows and doors.')}
                    ${certCard('PAS 24:2022', 'Enhanced security performance tested to PAS 24 standard. Required under Document Q for new dwellings; available as upgrade for retrofit.')}
                    ${certCard('Made in Britain', 'Hardwood frames and sashes fabricated in our London workshop. Licensed member of the Made in Britain campaign.')}
                    ${certCard('Lignum Timber System', 'Engineered hardwood with Sikkens factory\u2011applied finish. Superior dimensional stability, thermal performance, and 10\u2011year coating warranty.')}
                </div>
            </div>
        `;

        // Summary — Windows table
        const summaryWindowsRows = items.map((it, idx) => {
            const p = R.parseItem(it);
            const typeShort = p.windowType === 'casement' ? 'Casement'
                : p.windowType === 'fix-only' ? 'Fix Frame'
                : p.sashType === 'triple' ? 'Triple Sash'
                : p.sashType === 'single' ? 'Single Sash'
                : 'Sash';
            const desc = `${typeShort} · ${p.width}×${p.height}mm · ${p.colorDisplay || '-'}`;
            return `
                <tr>
                    <td style="padding:.6rem 1rem;border-bottom:1px solid ${BORDER};">${String(idx + 1).padStart(2, '0')}</td>
                    <td style="padding:.6rem 1rem;border-bottom:1px solid ${BORDER};">${desc}</td>
                    <td style="padding:.6rem 1rem;border-bottom:1px solid ${BORDER};text-align:center;">${p.quantity || 1}</td>
                    <td style="padding:.6rem 1rem;border-bottom:1px solid ${BORDER};text-align:right;font-weight:500;color:var(--navy);">£${R.formatPrice(it.total_price || 0)}</td>
                </tr>
            `;
        }).join('');

        const summaryHTML = `
            <div style="margin:2.5rem 0 1.5rem;">
                <h2 style="font-family:'Cormorant Garamond',serif;font-weight:700;color:var(--navy);font-size:1.6rem;margin:0 0 1rem;">Summary</h2>
                <table style="width:100%;border-collapse:collapse;font-family:'Jost',sans-serif;font-size:.82rem;">
                    <thead>
                        <tr>
                            <th style="background:var(--navy);color:#fff;font-weight:400;letter-spacing:.15em;text-transform:uppercase;font-size:.65rem;padding:.55rem 1rem;text-align:left;">Item</th>
                            <th style="background:var(--navy);color:#fff;font-weight:400;letter-spacing:.15em;text-transform:uppercase;font-size:.65rem;padding:.55rem 1rem;text-align:left;">Description</th>
                            <th style="background:var(--navy);color:#fff;font-weight:400;letter-spacing:.15em;text-transform:uppercase;font-size:.65rem;padding:.55rem 1rem;text-align:center;">Qty</th>
                            <th style="background:var(--navy);color:#fff;font-weight:400;letter-spacing:.15em;text-transform:uppercase;font-size:.65rem;padding:.55rem 1rem;text-align:right;">Price</th>
                        </tr>
                    </thead>
                    <tbody>${summaryWindowsRows}</tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3" style="padding:.7rem 1rem;border-top:2px solid var(--navy);text-align:right;font-weight:500;color:var(--navy);">Subtotal — Windows</td>
                            <td style="padding:.7rem 1rem;border-top:2px solid var(--navy);text-align:right;color:var(--navy);font-weight:500;">£${R.formatPrice(totalEx)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div style="margin:1.5rem 0;">
                <h3 style="font-family:'Cormorant Garamond',serif;font-weight:700;color:var(--navy);font-size:1.15rem;margin:0 0 .6rem;">Additional Services</h3>
                <table style="width:100%;border-collapse:collapse;font-family:'Jost',sans-serif;font-size:.82rem;">
                    <thead>
                        <tr>
                            <th style="background:var(--navy);color:#fff;font-weight:400;letter-spacing:.15em;text-transform:uppercase;font-size:.65rem;padding:.55rem 1rem;text-align:left;">Item</th>
                            <th style="background:var(--navy);color:#fff;font-weight:400;letter-spacing:.15em;text-transform:uppercase;font-size:.65rem;padding:.55rem 1rem;text-align:left;">Description</th>
                            <th style="background:var(--navy);color:#fff;font-weight:400;letter-spacing:.15em;text-transform:uppercase;font-size:.65rem;padding:.55rem 1rem;text-align:center;">Qty</th>
                            <th style="background:var(--navy);color:#fff;font-weight:400;letter-spacing:.15em;text-transform:uppercase;font-size:.65rem;padding:.55rem 1rem;text-align:right;">Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="padding:.6rem 1rem;border-bottom:1px solid ${BORDER};vertical-align:top;">I-01</td>
                            <td style="padding:.6rem 1rem;border-bottom:1px solid ${BORDER};">
                                <div style="font-weight:500;color:var(--navy);">Installation</div>
                                <div style="font-size:.72rem;color:var(--muted);font-style:italic;margin-top:.15rem;">£${INSTALLATION_RATE} per unit · standard rate · final amount subject to site survey</div>
                            </td>
                            <td style="padding:.6rem 1rem;border-bottom:1px solid ${BORDER};text-align:center;vertical-align:top;">${totalQty}</td>
                            <td style="padding:.6rem 1rem;border-bottom:1px solid ${BORDER};text-align:right;font-weight:500;color:var(--navy);vertical-align:top;">£${R.formatPrice(installationCost)}</td>
                        </tr>
                        <tr>
                            <td style="padding:.6rem 1rem;border-bottom:1px solid ${BORDER};vertical-align:top;">D-01</td>
                            <td style="padding:.6rem 1rem;border-bottom:1px solid ${BORDER};">
                                <div style="font-weight:500;color:var(--navy);">Delivery</div>
                                <div style="font-size:.72rem;color:var(--muted);font-style:italic;margin-top:.15rem;">Standard delivery charge · subject to location confirmation</div>
                            </td>
                            <td style="padding:.6rem 1rem;border-bottom:1px solid ${BORDER};text-align:center;vertical-align:top;">1</td>
                            <td style="padding:.6rem 1rem;border-bottom:1px solid ${BORDER};text-align:right;font-weight:500;color:var(--navy);vertical-align:top;">£${R.formatPrice(deliveryCost)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div style="margin:1.5rem 0;padding:1rem 1.3rem;background:${CREAM_LIGHT};border-top:2px solid var(--navy);">
                <div style="display:flex;justify-content:space-between;font-family:'Jost',sans-serif;font-size:.82rem;color:var(--muted);padding:.3rem 0;">
                    <span>Subtotal — Windows</span><span>£${R.formatPrice(totalEx)}</span>
                </div>
                <div style="display:flex;justify-content:space-between;font-family:'Jost',sans-serif;font-size:.82rem;color:var(--muted);padding:.3rem 0;">
                    <span>Installation (${totalQty} × £${INSTALLATION_RATE})</span><span>£${R.formatPrice(installationCost)}</span>
                </div>
                <div style="display:flex;justify-content:space-between;font-family:'Jost',sans-serif;font-size:.82rem;color:var(--muted);padding:.3rem 0;border-bottom:1px solid ${BORDER};">
                    <span>Delivery</span><span>£${R.formatPrice(deliveryCost)}</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:baseline;font-family:'Cormorant Garamond',serif;font-weight:700;font-size:1.5rem;color:var(--navy);padding:.6rem 0 0;">
                    <span>Total <span style="font-family:'Jost',sans-serif;font-size:.65rem;font-weight:400;color:var(--muted);letter-spacing:.1em;">(EXCL. VAT)</span></span>
                    <span>£${R.formatPrice(grandTotal)}</span>
                </div>
            </div>

            <div style="margin:1rem 0 2rem;padding:.8rem 1.2rem;background:#fff8ed;border-left:3px solid ${GOLD};font-family:'Jost',sans-serif;font-size:.75rem;color:var(--muted);line-height:1.55;">
                <strong style="color:var(--navy);">All prices exclude VAT.</strong> VAT will be applied at the applicable rate (0%, 5%, or 20%) depending on your property status and project type. The correct rate will be confirmed prior to invoicing.
            </div>
        `;

        // Payment Schedule (3 cards like PDF)
        const paymentCard = (roman, label, percent, amount, note, highlight = false) => `
            <div style="border:1px solid ${BORDER};padding:1.2rem;position:relative;${highlight ? 'background:#fbfaf7;' : ''}">
                <div style="position:absolute;top:.5rem;right:.8rem;font-family:'Cormorant Garamond',serif;font-weight:700;font-size:2.2rem;color:#D4D4C8;line-height:1;">${roman}</div>
                <div style="font-family:'Jost',sans-serif;font-weight:500;letter-spacing:.2em;text-transform:uppercase;font-size:.6rem;color:var(--muted);margin-bottom:.4rem;">${label}</div>
                <div style="font-family:'Cormorant Garamond',serif;font-weight:700;font-size:1.6rem;color:var(--navy);line-height:1;margin-bottom:.5rem;">${percent}</div>
                <div style="font-family:'Jost',sans-serif;font-weight:500;font-size:.9rem;color:${GOLD};margin-bottom:.5rem;">£${R.formatPrice(amount)}</div>
                <div style="font-family:'Jost',sans-serif;font-weight:300;font-size:.7rem;color:var(--muted);line-height:1.55;">${note}</div>
            </div>
        `;
        const paymentHTML = `
            <div style="margin:2rem 0;">
                <h2 style="font-family:'Cormorant Garamond',serif;font-weight:700;color:var(--navy);font-size:1.5rem;margin:0 0 .8rem;">Payment Schedule</h2>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.8rem;">
                    ${paymentCard('I', 'Initial Deposit', '50%', depositHalf, 'Non-refundable deposit upon acceptance. Secures the order and reserves workshop capacity. Calculated on windows + installation only.')}
                    ${paymentCard('II', 'Balance', '50%', depositHalf, 'Due prior to dispatch or installation. Windows will not leave the workshop until full payment is received. Calculated on windows + installation only.')}
                    ${paymentCard('III', 'Delivery', '100%', deliveryCost, 'Payable upon delivery to site. Separate from windows payment schedule.', true)}
                </div>
            </div>
        `;

        // Terms
        const term = (num, title, body) => `
            <li style="list-style:none;margin-bottom:1rem;padding-left:1.8rem;position:relative;line-height:1.6;">
                <span style="position:absolute;left:0;top:0;font-family:'Cormorant Garamond',serif;font-weight:700;font-size:.95rem;color:var(--navy);">${num}.</span>
                <h4 style="font-family:'Cormorant Garamond',serif;font-weight:600;font-size:.9rem;color:var(--navy);margin:0 0 .2rem;letter-spacing:.02em;">${title}</h4>
                <p style="font-weight:300;font-family:'Jost',sans-serif;font-size:.8rem;color:#1a1a1a;margin:0;">${body}</p>
            </li>
        `;
        const termsHTML = `
            <div style="margin:2rem 0;">
                <h2 style="font-family:'Cormorant Garamond',serif;font-weight:700;color:var(--navy);font-size:1.5rem;margin:0 0 1rem;">Terms &amp; Conditions</h2>
                <ol style="padding:0;margin:0;">
                    ${term(1, 'Validity', 'This quotation is valid for a period of 30 (thirty) days from the date of issuance. After this period, the terms, pricing, and availability of the quoted items and services are subject to change without prior notice.')}
                    ${term(2, 'Basis of Quotation', 'This quotation has been prepared based on the specifications, dimensions and project details provided at the time of request. Any changes — including scope of work, materials, site measurements taken at survey, or schedule — may result in an updated quotation and revised pricing.')}
                    ${term(3, 'Exclusions', 'Unless otherwise stated, all prices are exclusive of VAT. Additional costs for scaffolding, making good, redecoration, electrical alterations, or removal of non-standard existing windows (stained glass, leaded lights) will be invoiced separately where applicable.')}
                    ${term(4, 'Acceptance', 'Acceptance of this quotation constitutes an agreement to proceed under the terms outlined herein. Written confirmation (via email or signed acceptance) and the initial deposit are required to initiate the order and scheduling process.')}
                    ${term(5, 'Amendments', 'Any modifications, additions, or extra services requested after acceptance will require a written change order and may result in additional charges. Once fabrication drawings are approved, no further changes can be accepted.')}
                    ${term(6, 'Lead Time', 'Within 1 (one) week from acceptance, fabrication drawings will be issued for your approval. From the approval of drawings, the production and delivery timeline is estimated at 8 to 10 weeks. Lead time may vary depending on order size and complexity.')}
                </ol>
            </div>
            <div style="margin:1.5rem 0 2rem;padding:1rem 1.3rem;background:${CREAM_LIGHT};border-left:3px solid var(--navy);font-family:'Jost',sans-serif;font-size:.78rem;color:#1a1a1a;line-height:1.65;">
                <strong style="color:var(--navy);">Payment:</strong> Payable to Skylon Joinery Ltd · Sort code <strong>20-25-19</strong> · Account <strong>43982947</strong>. Alternative payment methods may be arranged in writing prior to acceptance.
            </div>
        `;

        return `
            ${bannerHTML}

            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:1px solid rgba(158,158,144,.2);gap:1rem;flex-wrap:wrap;">
                <div style="flex:1;min-width:200px;">
                    <div style="font-family:'Jost',sans-serif;font-size:.50rem;letter-spacing:.5em;text-transform:uppercase;color:var(--silver);margin-bottom:.5rem;">Estimate</div>
                    <div style="font-family:'Cormorant Garamond',serif;font-size:1.8rem;color:var(--navy);">${estimate.estimate_number || ''}</div>
                    <div style="font-family:'Jost',sans-serif;font-size:.78rem;color:var(--muted);margin-top:.3rem;">
                        Created ${new Date(estimate.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })}
                        ${estimate.project_name ? ` · ${estimate.project_name}` : ''}
                    </div>
                </div>
                <div style="display:flex;gap:.6rem;align-items:center;flex-wrap:wrap;">
                    <span class="estimate-status status-${estimate.status}" style="font-size:.65rem;letter-spacing:.2em;text-transform:uppercase;padding:.4rem 1rem;">${R.getStatusConfig(estimate.status).label}</span>
                    <button class="btn-sm btn-download-pdf" style="background:var(--navy);color:#fff;border:none;padding:.5rem 1rem;font-family:'Jost',sans-serif;font-size:.72rem;letter-spacing:.15em;text-transform:uppercase;cursor:pointer;">Download PDF</button>
                </div>
            </div>

            ${customerHTML}

            ${estimate.delivery_address || estimate.notes ? `
            <div style="background:var(--cream2);padding:1.2rem 1.5rem;margin-bottom:2rem;border-left:3px solid var(--silver);">
                ${estimate.delivery_address ? `<div style="font-family:'Jost',sans-serif;font-size:.82rem;color:var(--muted);"><strong style="color:var(--navy);">Address:</strong> ${estimate.delivery_address}</div>` : ''}
                ${estimate.notes ? `<div style="font-family:'Jost',sans-serif;font-size:.82rem;color:var(--muted);margin-top:.3rem;"><strong style="color:var(--navy);">Notes:</strong> ${estimate.notes}</div>` : ''}
            </div>
            ` : ''}

            ${aboutHTML}
            ${certificationsHTML}

            <div style="font-family:'Jost',sans-serif;font-size:.55rem;letter-spacing:.4em;text-transform:uppercase;color:var(--silver);margin:2rem 0 1rem;">Windows · ${items.length}</div>
            ${itemsHTML}

            ${summaryHTML}
            ${paymentHTML}
            ${termsHTML}

            <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;padding-top:1.5rem;border-top:1px solid rgba(158,158,144,.15);">
                ${adminButtons}
                <button class="btn-sm btn-download-pdf">Download PDF</button>
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

        // ═══ FIX-ONLY SVG ═══
        if (windowType === 'fix-only') {
            return EstimateRenderer.generateFixFrameSVG(item, fc);
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
        const boxLeft = 100, boxRight = 100, mullionW = 50;
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
        // Route arched casement to dedicated renderer
        if (fc.casementType === 'arched') {
            return EstimateRenderer.generateArchedCasementSVG(item, fc);
        }
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
        const svgW = 260, drawW = 160;
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

        // ─── DIMENSIONS (EXTERIOR VIEW) ───
        const dimY = oy + drawH + 8;
        const tickH = 3;
        // Exterior visible face dimensions
        const extFrame = 36;    // frame stile/top rail ext face
        const extBottom = 36;   // bottom rail ext face
        const extMullion = 26;  // mullion ext face
        const extTransom = 26;  // transom ext face

        // Count mullions and transoms for dimension calculation
        const nMullions = panels.mullions ? panels.mullions.length : 0;
        const hasTransom = panels.transoms && panels.transoms.length > 0;

        // === WIDTH BREAKDOWN (bottom) ===
        let wSegs = [];
        if (nMullions === 0) {
            wSegs = [extFrame, w - extFrame * 2, extFrame];
        } else if (layout === '180L') {
            const inner = w - extFrame * 2 - extMullion;
            const openW = Math.round(inner * 0.4);
            wSegs = [extFrame, openW, extMullion, inner - openW, extFrame];
        } else if (layout === '180R') {
            const inner = w - extFrame * 2 - extMullion;
            const openW = Math.round(inner * 0.4);
            wSegs = [extFrame, inner - openW, extMullion, openW, extFrame];
        } else if (nMullions === 1) {
            const panelW = Math.round((w - extFrame * 2 - extMullion) / 2);
            wSegs = [extFrame, panelW, extMullion, w - extFrame * 2 - extMullion - panelW, extFrame];
        } else if (nMullions === 2) {
            const panelW = Math.round((w - extFrame * 2 - extMullion * 2) / 3);
            const lastP = w - extFrame * 2 - extMullion * 2 - panelW * 2;
            wSegs = [extFrame, panelW, extMullion, panelW, extMullion, lastP, extFrame];
        }

        // Overall width line
        svg += `<line x1="${ox}" y1="${dimY}" x2="${ox + drawW}" y2="${dimY}" stroke="${dimColor}" stroke-width="0.5"/>`;
        svg += `<line x1="${ox}" y1="${dimY - tickH}" x2="${ox}" y2="${dimY + tickH}" stroke="${dimColor}" stroke-width="0.5"/>`;
        svg += `<line x1="${ox + drawW}" y1="${dimY - tickH}" x2="${ox + drawW}" y2="${dimY + tickH}" stroke="${dimColor}" stroke-width="0.5"/>`;
        svg += `<text x="${ox + drawW/2}" y="${dimY + 12}" ${dimFont} text-anchor="middle">${w}mm</text>`;

        // Width breakdown segments
        if (wSegs.length > 1) {
            const dimY2 = dimY + 18;
            let cx2 = ox;
            wSegs.forEach(seg => {
                const sw = seg * scale;
                svg += `<line x1="${cx2}" y1="${dimY2 - tickH}" x2="${cx2}" y2="${dimY2 + tickH}" stroke="${dimColor}" stroke-width="0.4"/>`;
                if (sw > 8) {
                    svg += `<text x="${cx2 + sw/2}" y="${dimY2 + 3}" ${dimFont} text-anchor="middle" font-size="5.5">${seg}</text>`;
                }
                cx2 += sw;
            });
            svg += `<line x1="${cx2}" y1="${dimY2 - tickH}" x2="${cx2}" y2="${dimY2 + tickH}" stroke="${dimColor}" stroke-width="0.4"/>`;
        }

        // === HEIGHT BREAKDOWN (right side) ===
        let hSegs = [];
        if (hasTransom && fanlightHeight > 0) {
            const mainH = h - extFrame - extBottom - extTransom - fanlightHeight;
            hSegs = [extFrame, fanlightHeight, extTransom, Math.max(mainH, 0), extBottom];
        } else {
            hSegs = [extFrame, h - extFrame - extBottom, extBottom];
        }

        // Overall height line
        const hDimX = ox + drawW + 12;
        svg += `<line x1="${hDimX}" y1="${oy}" x2="${hDimX}" y2="${oy + drawH}" stroke="${dimColor}" stroke-width="0.5"/>`;
        svg += `<line x1="${hDimX - tickH}" y1="${oy}" x2="${hDimX + tickH}" y2="${oy}" stroke="${dimColor}" stroke-width="0.5"/>`;
        svg += `<line x1="${hDimX - tickH}" y1="${oy + drawH}" x2="${hDimX + tickH}" y2="${oy + drawH}" stroke="${dimColor}" stroke-width="0.5"/>`;
        svg += `<text x="${hDimX + 3}" y="${oy + drawH/2 + 2}" ${dimFont} transform="rotate(90,${hDimX + 3},${oy + drawH/2})">${h}mm</text>`;

        // Height breakdown segments
        if (hSegs.length > 1) {
            const hDimX2 = hDimX + 16;
            let cy2 = oy;
            hSegs.forEach(seg => {
                const sh = seg * scale;
                svg += `<line x1="${hDimX2 - tickH}" y1="${cy2}" x2="${hDimX2 + tickH}" y2="${cy2}" stroke="${dimColor}" stroke-width="0.4"/>`;
                if (sh > 8) {
                    svg += `<text x="${hDimX2 + 3}" y="${cy2 + sh/2 + 2}" ${dimFont} transform="rotate(90,${hDimX2 + 3},${cy2 + sh/2})" font-size="5.5">${seg}</text>`;
                }
                cy2 += sh;
            });
            svg += `<line x1="${hDimX2 - tickH}" y1="${cy2}" x2="${hDimX2 + tickH}" y2="${cy2}" stroke="${dimColor}" stroke-width="0.4"/>`;
        }

        // Fanlight height annotation (left side, if applicable)
        if (fanlightHeight > 0 && hasTransom) {
            const fhDimX = ox - 12;
            const fhScaled = fanlightHeight * scale;
            svg += `<line x1="${fhDimX}" y1="${iy}" x2="${fhDimX}" y2="${iy + fhScaled}" stroke="${dimColor}" stroke-width="0.4"/>`;
            svg += `<line x1="${fhDimX - tickH}" y1="${iy}" x2="${fhDimX + tickH}" y2="${iy}" stroke="${dimColor}" stroke-width="0.4"/>`;
            svg += `<line x1="${fhDimX - tickH}" y1="${iy + fhScaled}" x2="${fhDimX + tickH}" y2="${iy + fhScaled}" stroke="${dimColor}" stroke-width="0.4"/>`;
            svg += `<text x="${fhDimX - 2}" y="${iy + fhScaled/2 + 2}" ${dimFont} transform="rotate(-90,${fhDimX - 2},${iy + fhScaled/2})" font-size="5.5">${fanlightHeight}</text>`;
        }

        const totalH = dimY + (wSegs.length > 1 ? 32 : 18);
        return `<svg width="${svgW}" height="${totalH}" viewBox="0 0 ${svgW} ${totalH}" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
    }

    // ─── Arched Casement SVG ───
    static generateArchedCasementSVG(item, fc) {
        const w = fc.width || item.width || 1000;
        const h = fc.height || item.height || 1500;
        const shape = fc.casArchShape || 'semi-circle';
        const hinge = fc.casArchHinge || 'right';
        const hBars = fc.casementHBars || fc.hBars || 0;
        const vBars = fc.casementVBars || fc.vBars || 0;
        const semiPat = fc.fixSemiBarPattern || 'none';
        const gothPat = fc.fixGothicBars || 'none';

        const stroke = 'rgba(10,22,40,.7)';
        const barStroke = 'rgba(10,22,40,.5)';
        const dimColor = 'rgba(10,22,40,.45)';
        const dimFont = `font-family="Jost,sans-serif" font-size="7" fill="${dimColor}"`;
        const gold = 'rgba(200,162,78,.5)';

        const svgW = 260, drawW = 160;
        const scale = drawW / w;
        const drawH = Math.round(h * scale);
        const ox = 50, oy = 10;
        const fT = Math.max(57 * scale, 4);

        const centerX = ox + drawW / 2;
        const ix = ox + fT;
        const ixR = ox + drawW - fT;
        const iBottom = oy + drawH - fT;
        const innerW = drawW - fT * 2;

        // ── Arch geometry per shape ──
        let archRise, springY, outerPath, innerPath;
        // archYAtX: returns SVG Y of inner arch at horizontal offset dx from centerX
        let archYInner;

        if (shape === 'gothic-arch') {
            archRise = drawW * Math.sqrt(3) / 2;
            springY = oy + archRise;
            const R = drawW; // outer arc radius
            const Ri = drawW - fT; // inner arc radius
            const peakY = oy;
            // Inner peak Y
            const dxI = drawW / 2 - fT;
            const sqI = Ri * Ri - dxI * dxI;
            const innerPeakY = sqI > 0 ? springY - Math.sqrt(sqI) : springY;

            outerPath = `M ${ox} ${oy + drawH} L ${ox} ${springY} A ${R} ${R} 0 0 1 ${centerX} ${peakY} A ${R} ${R} 0 0 1 ${ox + drawW} ${springY} L ${ox + drawW} ${oy + drawH} Z`;
            innerPath = `M ${ix} ${iBottom} L ${ix} ${springY} A ${Ri} ${Ri} 0 0 1 ${centerX} ${innerPeakY} A ${Ri} ${Ri} 0 0 1 ${ixR} ${springY} L ${ixR} ${iBottom} Z`;

            archYInner = function(dx) {
                // Gothic: two arcs, centers at ±drawW/2 from center
                const absDx = Math.abs(dx);
                const cx = dx >= 0 ? -(drawW / 2 - fT) : (drawW / 2 - fT); // relative center
                const ddx = dx - cx; // not useful... let me use absolute coords
                // Left arc center at ixR (right springing inner), right arc center at ix
                if (dx <= 0) {
                    const adx = dx + (drawW / 2 - fT); // distance from right inner springing
                    const sq = Ri * Ri - adx * adx;
                    return sq > 0 ? springY - Math.sqrt(sq) : springY;
                } else {
                    const adx = dx - (drawW / 2 - fT); // distance from left inner springing  
                    const sq = Ri * Ri - adx * adx;
                    return sq > 0 ? springY - Math.sqrt(sq) : springY;
                }
            };

        } else if (shape === 'segmental-arch') {
            const riseMm = Math.round(w * 0.2);
            archRise = riseMm * scale;
            springY = oy + archRise;
            // Circular arc: R = (chord²/4 + rise²) / (2*rise)
            const R = ((drawW / 2) * (drawW / 2) + archRise * archRise) / (2 * archRise);
            const Ri = R - fT; // approximate inner radius
            const innerRise = archRise - fT;

            outerPath = `M ${ox} ${oy + drawH} L ${ox} ${springY} A ${R} ${R} 0 0 1 ${ox + drawW} ${springY} L ${ox + drawW} ${oy + drawH} Z`;
            innerPath = `M ${ix} ${iBottom} L ${ix} ${springY} A ${Ri} ${Ri} 0 0 1 ${ixR} ${springY} L ${ixR} ${iBottom} Z`;

            archYInner = function(dx) {
                const iRise = innerRise > 0 ? innerRise : archRise - fT;
                const iR = ((innerW / 2) * (innerW / 2) + iRise * iRise) / (2 * iRise);
                const sq = iR * iR - dx * dx;
                if (sq <= 0) return springY;
                return springY + iR - iRise - Math.sqrt(sq);
            };

        } else if (shape === 'elliptical-arch') {
            const riseMm = Math.round(w * 0.325);
            archRise = riseMm * scale;
            springY = oy + archRise;
            const rx = drawW / 2, ry = archRise;
            const irx = innerW / 2, iry = Math.max(archRise - fT, 2);

            outerPath = `M ${ox} ${oy + drawH} L ${ox} ${springY} A ${rx} ${ry} 0 0 1 ${ox + drawW} ${springY} L ${ox + drawW} ${oy + drawH} Z`;
            innerPath = `M ${ix} ${iBottom} L ${ix} ${springY} A ${irx} ${iry} 0 0 1 ${ixR} ${springY} L ${ixR} ${iBottom} Z`;

            archYInner = function(dx) {
                const ratio = dx / (innerW / 2);
                if (Math.abs(ratio) >= 1) return springY;
                return springY - (archRise - fT) * Math.sqrt(1 - ratio * ratio);
            };

        } else {
            // semi-circle (default)
            const archR = drawW / 2;
            archRise = archR;
            springY = oy + archRise;
            const innerR = archR - fT;

            outerPath = `M ${ox} ${oy + drawH} L ${ox} ${springY} A ${archR} ${archR} 0 0 1 ${ox + drawW} ${springY} L ${ox + drawW} ${oy + drawH} Z`;
            innerPath = `M ${ix} ${iBottom} L ${ix} ${springY} A ${innerR} ${innerR} 0 0 1 ${ixR} ${springY} L ${ixR} ${iBottom} Z`;

            archYInner = function(dx) {
                const sq = innerR * innerR - dx * dx;
                return sq > 0 ? springY - Math.sqrt(sq) : springY;
            };
        }

        let svg = '';

        // ── Frame paths ──
        svg += `<path d="${outerPath}" fill="none" stroke="${stroke}" stroke-width="1.5"/>`;
        svg += `<path d="${innerPath}" fill="none" stroke="${stroke}" stroke-width="0.5"/>`;

        // ── Hub & Spoke patterns (semi-circle only) ──
        const isHub = semiPat === 'half-hub' || semiPat === 'hub-spoke' || semiPat === 'double-hub-spoke' || semiPat === 'triple-hub-spoke';
        const isHalf = semiPat === 'half-hub';
        const isDouble = semiPat === 'double-hub-spoke';
        const isTriple = semiPat === 'triple-hub-spoke';
        const innerR = (drawW / 2) - fT;

        if (isHub && shape === 'semi-circle') {
            const spokeCount = isTriple ? 8 : isDouble ? 6 : 4;
            const hubR1 = innerR * 0.3;
            const hubR2 = (isDouble || isTriple) ? innerR * 0.6 : null;
            const hubR3 = isTriple ? innerR * 0.8 : null;

            // Spokes
            for (let i = 0; i < spokeCount; i++) {
                const a = (i / (spokeCount - 1)) * Math.PI;
                const ex = centerX - innerR * Math.cos(a);
                const ey = springY - innerR * Math.sin(a);
                svg += `<line x1="${centerX}" y1="${springY}" x2="${ex}" y2="${ey}" stroke="${barStroke}" stroke-width="0.6"/>`;
            }

            // Hub rings
            [hubR1, hubR2, hubR3].forEach(r => {
                if (!r) return;
                svg += `<path d="M ${centerX - r} ${springY} A ${r} ${r} 0 0 1 ${centerX + r} ${springY}" fill="none" stroke="${barStroke}" stroke-width="0.6"/>`;
            });

            // Vertical bars below springing from ring intersections
            if (!isHalf) {
                [hubR1, hubR2, hubR3].forEach(r => {
                    if (!r) return;
                    svg += `<line x1="${centerX - r}" y1="${springY}" x2="${centerX - r}" y2="${iBottom}" stroke="${barStroke}" stroke-width="0.4"/>`;
                    svg += `<line x1="${centerX + r}" y1="${springY}" x2="${centerX + r}" y2="${iBottom}" stroke="${barStroke}" stroke-width="0.4"/>`;
                });
            }

            // Half hub: horizontal bar at springing
            if (isHalf) {
                svg += `<line x1="${ix}" y1="${springY}" x2="${ixR}" y2="${springY}" stroke="${barStroke}" stroke-width="0.6"/>`;
            }
        }

        // ── Gothic Intersecting pattern ──
        if (gothPat === 'intersecting' && shape === 'gothic-arch') {
            const peakY = archYInner(0);
            // Main vertical from springing to peak
            svg += `<line x1="${centerX}" y1="${peakY}" x2="${centerX}" y2="${iBottom}" stroke="${barStroke}" stroke-width="0.5"/>`;
            // Two diagonal lines from bottom corners to peak
            svg += `<line x1="${ix + 2}" y1="${springY}" x2="${centerX}" y2="${peakY}" stroke="${barStroke}" stroke-width="0.5"/>`;
            svg += `<line x1="${ixR - 2}" y1="${springY}" x2="${centerX}" y2="${peakY}" stroke="${barStroke}" stroke-width="0.5"/>`;
            // Horizontal at springing
            svg += `<line x1="${ix}" y1="${springY}" x2="${ixR}" y2="${springY}" stroke="${barStroke}" stroke-width="0.4"/>`;
        }

        // ── Regular bars (non-hub shapes) ──
        if (!isHub || shape !== 'semi-circle') {
            if (!(gothPat === 'intersecting' && shape === 'gothic-arch')) {
                const belowH = iBottom - springY;
                if (belowH > 0) {
                    // Horizontal bars below springing
                    for (let i = 1; i <= hBars; i++) {
                        const by = springY + (belowH / (hBars + 1)) * i;
                        svg += `<line x1="${ix}" y1="${by}" x2="${ixR}" y2="${by}" stroke="${barStroke}" stroke-width="0.4"/>`;
                    }
                    // Vertical bars — clip to arch curve
                    for (let i = 1; i <= vBars; i++) {
                        const bx = ix + (innerW / (vBars + 1)) * i;
                        const dx = bx - centerX;
                        const barTop = archYInner(dx);
                        svg += `<line x1="${bx}" y1="${barTop}" x2="${bx}" y2="${iBottom}" stroke="${barStroke}" stroke-width="0.4"/>`;
                    }
                }
            }
        }

        // ── Hinge indicator ──
        const hingeSide = hinge === 'right' ? 'left' : 'right';
        const hx = hingeSide === 'left' ? ix + 2 : ixR - 2;
        const hxOpp = hingeSide === 'left' ? ixR - 2 : ix + 2;
        const hMidY = springY + (iBottom - springY) / 2;
        svg += `<line x1="${hxOpp}" y1="${springY + 2}" x2="${hx}" y2="${hMidY}" stroke="${gold}" stroke-width="0.7"/>`;
        svg += `<line x1="${hxOpp}" y1="${iBottom - 2}" x2="${hx}" y2="${hMidY}" stroke="${gold}" stroke-width="0.7"/>`;

        // ── Dimensions ──
        const dimY = oy + drawH + 8;
        const tickH = 3;

        // Width (bottom)
        svg += `<line x1="${ox}" y1="${dimY}" x2="${ox + drawW}" y2="${dimY}" stroke="${dimColor}" stroke-width="0.5"/>`;
        svg += `<line x1="${ox}" y1="${dimY - tickH}" x2="${ox}" y2="${dimY + tickH}" stroke="${dimColor}" stroke-width="0.5"/>`;
        svg += `<line x1="${ox + drawW}" y1="${dimY - tickH}" x2="${ox + drawW}" y2="${dimY + tickH}" stroke="${dimColor}" stroke-width="0.5"/>`;
        svg += `<text x="${ox + drawW / 2}" y="${dimY + 12}" ${dimFont} text-anchor="middle">${w}mm</text>`;

        // Height (right)
        const hDimX = ox + drawW + 8;
        svg += `<line x1="${hDimX}" y1="${oy}" x2="${hDimX}" y2="${oy + drawH}" stroke="${dimColor}" stroke-width="0.5"/>`;
        svg += `<line x1="${hDimX - tickH}" y1="${oy}" x2="${hDimX + tickH}" y2="${oy}" stroke="${dimColor}" stroke-width="0.5"/>`;
        svg += `<line x1="${hDimX - tickH}" y1="${oy + drawH}" x2="${hDimX + tickH}" y2="${oy + drawH}" stroke="${dimColor}" stroke-width="0.5"/>`;
        svg += `<text x="${hDimX + 3}" y="${oy + drawH / 2 + 2}" ${dimFont} transform="rotate(-90,${hDimX + 3},${oy + drawH / 2})">${h}mm</text>`;

        // Arch rise (left)
        const archRiseMm = shape === 'gothic-arch' ? Math.round(w * Math.sqrt(3) / 2) :
                           shape === 'segmental-arch' ? Math.round(w * 0.2) :
                           shape === 'elliptical-arch' ? Math.round(w * 0.325) :
                           Math.round(w / 2);
        const riseDimX = ox - 8;
        svg += `<line x1="${riseDimX}" y1="${oy}" x2="${riseDimX}" y2="${springY}" stroke="${dimColor}" stroke-width="0.4"/>`;
        svg += `<line x1="${riseDimX - tickH}" y1="${oy}" x2="${riseDimX + tickH}" y2="${oy}" stroke="${dimColor}" stroke-width="0.4"/>`;
        svg += `<line x1="${riseDimX - tickH}" y1="${springY}" x2="${riseDimX + tickH}" y2="${springY}" stroke="${dimColor}" stroke-width="0.4"/>`;
        svg += `<text x="${riseDimX - 2}" y="${oy + archRise / 2 + 2}" ${dimFont} transform="rotate(-90,${riseDimX - 2},${oy + archRise / 2})" font-size="5.5">${archRiseMm}</text>`;

        const totalH = dimY + 18;
        return `<svg width="${svgW}" height="${totalH}" viewBox="0 0 ${svgW} ${totalH}" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
    }
    // ─── Fix Frame SVG ───
    static generateFixFrameSVG(item, fc) {
        const w = fc.width || item.width || 1000;
        const h = fc.height || item.height || 1500;
        const shape = fc.fixShape || 'rectangle';
        const hBars = fc.casementHBars || 0;
        const vBars = fc.casementVBars || 0;
        const semiPat = fc.fixSemiBarPattern || 'none';
        const gothPat = fc.fixGothicBars || 'none';
        const circlePat = fc.fixCircleBarPattern || 'none';

        // Arch shapes → reuse arched casement SVG (no hinge)
        if (shape === 'gothic-arch' || shape === 'semi-circle' || shape === 'segmental-arch' || shape === 'elliptical-arch') {
            const fakeFc = Object.assign({}, fc, { casArchShape: shape, casArchHinge: null, casementHBars: hBars, casementVBars: vBars });
            return EstimateRenderer.generateArchedCasementSVG(item, fakeFc);
        }

        const stroke = 'rgba(10,22,40,.7)';
        const barStroke = 'rgba(10,22,40,.5)';
        const dimColor = 'rgba(10,22,40,.45)';
        const dimFont = `font-family="Jost,sans-serif" font-size="7" fill="${dimColor}"`;

        const svgW = 260, drawW = 160;
        const scale = drawW / w;
        const drawH = Math.round(h * scale);
        const ox = 50, oy = 10;
        const fT = Math.max(57 * scale, 4);
        const centerX = ox + drawW / 2;
        const centerY = oy + drawH / 2;

        let svg = '';

        if (shape === 'circle') {
            // ── Circle frame ──
            const outerR = drawW / 2;
            const innerR = outerR - fT;
            const cy = oy + outerR; // center Y (circle fits in width)

            svg += `<circle cx="${centerX}" cy="${cy}" r="${outerR}" fill="none" stroke="${stroke}" stroke-width="1.5"/>`;
            svg += `<circle cx="${centerX}" cy="${cy}" r="${innerR}" fill="none" stroke="${stroke}" stroke-width="0.5"/>`;

            // Sunburst pattern
            if (circlePat === 'sunburst') {
                const spokeCount = 12;
                for (let i = 0; i < spokeCount; i++) {
                    const a = (i / spokeCount) * Math.PI * 2;
                    const ex = centerX + innerR * Math.cos(a);
                    const ey = cy + innerR * Math.sin(a);
                    svg += `<line x1="${centerX}" y1="${cy}" x2="${ex}" y2="${ey}" stroke="${barStroke}" stroke-width="0.5"/>`;
                }
                // Inner ring
                const ringR = innerR * 0.4;
                svg += `<circle cx="${centerX}" cy="${cy}" r="${ringR}" fill="none" stroke="${barStroke}" stroke-width="0.5"/>`;
            }

            // Regular bars (cross pattern)
            if (circlePat === 'none') {
                for (let i = 1; i <= hBars; i++) {
                    const by = cy - innerR + (2 * innerR / (hBars + 1)) * i;
                    const dx = Math.sqrt(Math.max(0, innerR * innerR - (by - cy) * (by - cy)));
                    svg += `<line x1="${centerX - dx}" y1="${by}" x2="${centerX + dx}" y2="${by}" stroke="${barStroke}" stroke-width="0.4"/>`;
                }
                for (let i = 1; i <= vBars; i++) {
                    const bx = centerX - innerR + (2 * innerR / (vBars + 1)) * i;
                    const dy = Math.sqrt(Math.max(0, innerR * innerR - (bx - centerX) * (bx - centerX)));
                    svg += `<line x1="${bx}" y1="${cy - dy}" x2="${bx}" y2="${cy + dy}" stroke="${barStroke}" stroke-width="0.4"/>`;
                }
            }

            // Dimensions
            const dimY = oy + outerR * 2 + 8;
            const tickH = 3;
            svg += `<line x1="${ox}" y1="${dimY}" x2="${ox + drawW}" y2="${dimY}" stroke="${dimColor}" stroke-width="0.5"/>`;
            svg += `<line x1="${ox}" y1="${dimY - tickH}" x2="${ox}" y2="${dimY + tickH}" stroke="${dimColor}" stroke-width="0.5"/>`;
            svg += `<line x1="${ox + drawW}" y1="${dimY - tickH}" x2="${ox + drawW}" y2="${dimY + tickH}" stroke="${dimColor}" stroke-width="0.5"/>`;
            svg += `<text x="${centerX}" y="${dimY + 12}" ${dimFont} text-anchor="middle">${w}mm</text>`;

            const totalH = dimY + 18;
            return `<svg width="${svgW}" height="${totalH}" viewBox="0 0 ${svgW} ${totalH}" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;

        } else {
            // ── Rectangle frame ──
            const ix = ox + fT, iy = oy + fT;
            const iw = drawW - fT * 2, ih = drawH - fT * 2;

            svg += `<rect x="${ox}" y="${oy}" width="${drawW}" height="${drawH}" fill="none" stroke="${stroke}" stroke-width="1.5"/>`;
            svg += `<rect x="${ix}" y="${iy}" width="${iw}" height="${ih}" fill="none" stroke="${stroke}" stroke-width="0.5"/>`;

            // X cross (fixed window indicator)
            svg += `<line x1="${ix + 2}" y1="${iy + 2}" x2="${ix + iw - 2}" y2="${iy + ih - 2}" stroke="rgba(10,22,40,.15)" stroke-width="0.5"/>`;
            svg += `<line x1="${ix + iw - 2}" y1="${iy + 2}" x2="${ix + 2}" y2="${iy + ih - 2}" stroke="rgba(10,22,40,.15)" stroke-width="0.5"/>`;

            // Bars
            for (let i = 1; i <= hBars; i++) {
                const by = iy + (ih / (hBars + 1)) * i;
                svg += `<line x1="${ix}" y1="${by}" x2="${ix + iw}" y2="${by}" stroke="${barStroke}" stroke-width="0.4"/>`;
            }
            for (let i = 1; i <= vBars; i++) {
                const bx = ix + (iw / (vBars + 1)) * i;
                svg += `<line x1="${bx}" y1="${iy}" x2="${bx}" y2="${iy + ih}" stroke="${barStroke}" stroke-width="0.4"/>`;
            }

            // Dimensions
            const dimY = oy + drawH + 8;
            const tickH = 3;
            svg += `<line x1="${ox}" y1="${dimY}" x2="${ox + drawW}" y2="${dimY}" stroke="${dimColor}" stroke-width="0.5"/>`;
            svg += `<line x1="${ox}" y1="${dimY - tickH}" x2="${ox}" y2="${dimY + tickH}" stroke="${dimColor}" stroke-width="0.5"/>`;
            svg += `<line x1="${ox + drawW}" y1="${dimY - tickH}" x2="${ox + drawW}" y2="${dimY + tickH}" stroke="${dimColor}" stroke-width="0.5"/>`;
            svg += `<text x="${centerX}" y="${dimY + 12}" ${dimFont} text-anchor="middle">${w}mm</text>`;

            const hDimX = ox + drawW + 8;
            svg += `<line x1="${hDimX}" y1="${oy}" x2="${hDimX}" y2="${oy + drawH}" stroke="${dimColor}" stroke-width="0.5"/>`;
            svg += `<line x1="${hDimX - tickH}" y1="${oy}" x2="${hDimX + tickH}" y2="${oy}" stroke="${dimColor}" stroke-width="0.5"/>`;
            svg += `<line x1="${hDimX - tickH}" y1="${oy + drawH}" x2="${hDimX + tickH}" y2="${oy + drawH}" stroke="${dimColor}" stroke-width="0.5"/>`;
            svg += `<text x="${hDimX + 3}" y="${oy + drawH / 2 + 2}" ${dimFont} transform="rotate(-90,${hDimX + 3},${oy + drawH / 2})">${h}mm</text>`;

            const totalH = dimY + 18;
            return `<svg width="${svgW}" height="${totalH}" viewBox="0 0 ${svgW} ${totalH}" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
        }
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
                return { list: [{ x:0,y:0,w:iw,h:ih,hinge:'top' }] };
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
                    ]
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

    // ─── Download Professional PDF (6-page: Cover, Quote+About, Certs, Items, Summary, Terms) ───
    static async downloadEstimatePDF(estimate) {
        const R = EstimateRenderer;
        try {
            const jsPDF = (window.jspdf && window.jspdf.jsPDF) || (window.jsPDF) || (typeof jspdf !== 'undefined' && jspdf.jsPDF);
            if (!jsPDF) throw new Error('jsPDF library not loaded. Please refresh the page.');
            if (!window.html2canvas) throw new Error('html2canvas library not loaded. Please refresh the page.');

            // ──────── DATA PREP ────────
            const customer = estimate.customers || {};
            const customerName = customer.full_name || 'Valued Client';
            const customerFirstLine = [customer.full_name, customer.company_name, customer.customer_code].filter(Boolean).join(' · ');
            const customerContact = [customer.email, customer.phone].filter(Boolean).join(' · ');
            const customerAddress = estimate.delivery_address || '';
            const projectName = estimate.project_name || '';

            const createdAt = estimate.created_at ? new Date(estimate.created_at) : new Date();
            const validUntil = new Date(createdAt);
            validUntil.setDate(validUntil.getDate() + 30);
            const fmtDate = d => d.toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });

            const estimateNumber = estimate.estimate_number || (estimate.id ? estimate.id.substring(0, 8) : 'DRAFT');
            const items = estimate.estimate_items || [];
            const totalEx = items.reduce((s, i) => s + parseFloat(i.total_price || 0), 0);

            // Additional services (PR 1: hardcoded; PR 2 will move to DB)
            const INSTALLATION_RATE = 400;   // per item quantity
            const DELIVERY_FLAT = 300;       // flat charge
            const totalQty = items.reduce((s, i) => {
                const p = R.parseItem(i);
                return s + (p.quantity || 1);
            }, 0);
            const installationCost = INSTALLATION_RATE * totalQty;
            const deliveryCost = DELIVERY_FLAT;
            const totalWindowsPlusInstallation = totalEx + installationCost;
            const grandTotal = totalEx + installationCost + deliveryCost;
            const depositHalf = totalWindowsPlusInstallation / 2;

            // ──────── SHARED STYLES ────────
            const pageStyle = `width:210mm;height:297mm;background:#fff;font-family:'Jost',sans-serif;color:#1a1a1a;box-sizing:border-box;overflow:hidden;position:relative;`;
            const serif = `'Cormorant Garamond', Georgia, serif`;

            const headerBar = `
                <div style="background:#0A1628;padding:16mm 20mm 10mm;color:#fff;">
                    <div style="font-family:'Jost',sans-serif;font-weight:300;letter-spacing:.4em;font-size:14px;border-top:1px solid #fff;border-bottom:1px solid #fff;padding:6px 0;display:inline-block;">PRIME&nbsp;&nbsp;SASH</div>
                    <div style="font-family:'Jost',sans-serif;font-weight:300;letter-spacing:.35em;font-size:9px;margin-top:4px;opacity:.9;">W I N D O W S</div>
                </div>
            `;

            // ──────── PAGE 1: COVER ────────
            const pageCover = `
                <div style="${pageStyle}background:#0A1628;display:flex;align-items:center;justify-content:center;">
                    <div style="background:#fff;width:140mm;height:180mm;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16mm;text-align:center;">
                        <div style="font-family:'Jost',sans-serif;font-weight:300;letter-spacing:.45em;font-size:42px;color:#0A1628;border-top:2px solid #0A1628;border-bottom:2px solid #0A1628;padding:22px 0;margin-bottom:14px;white-space:nowrap;">PRIME&nbsp;&nbsp;SASH</div>
                        <div style="font-family:'Jost',sans-serif;font-weight:300;letter-spacing:.6em;font-size:18px;color:#0A1628;">W I N D O W S</div>
                        <div style="margin-top:22mm;font-family:${serif};font-style:italic;font-weight:500;font-size:14px;color:#9E9E90;letter-spacing:.08em;">London</div>
                        <div style="margin-top:4mm;font-family:${serif};font-style:italic;font-weight:600;font-size:19px;color:#0A1628;letter-spacing:.03em;">for ${customerName}</div>
                    </div>
                </div>
            `;

            // ──────── PAGE 2: QUOTE + ABOUT ────────
            const customerLine = customerFirstLine || 'Client details to confirm';
            const addressLine = customerAddress || customerContact || '';
            const pageQuote = `
                <div style="${pageStyle}">
                    ${headerBar}
                    <div style="padding:0 20mm;">
                        <div style="background:#0A1628;color:#fff;margin:10mm -20mm 0;padding:10mm 20mm;display:flex;justify-content:space-between;align-items:baseline;">
                            <span style="font-family:${serif};font-weight:700;font-size:42px;letter-spacing:.02em;">Quote</span>
                            <span style="font-family:'Jost',sans-serif;font-weight:400;font-size:20px;letter-spacing:.1em;">${estimateNumber}</span>
                        </div>
                        <table style="margin:10mm 0 6mm;border:1px solid #e5e4dd;border-collapse:collapse;width:100%;font-family:'Jost',sans-serif;font-size:12px;">
                            <tr style="border-bottom:1px solid #e5e4dd;">
                                <th style="background:#0A1628;color:#fff;font-weight:400;letter-spacing:.15em;font-size:10px;text-transform:uppercase;text-align:left;padding:10px 14px;width:40mm;">Date</th>
                                <td style="padding:10px 14px;color:#0A1628;font-weight:500;">${fmtDate(createdAt)}</td>
                            </tr>
                            <tr style="border-bottom:1px solid #e5e4dd;">
                                <th style="background:#0A1628;color:#fff;font-weight:400;letter-spacing:.15em;font-size:10px;text-transform:uppercase;text-align:left;padding:10px 14px;width:40mm;">Requested by</th>
                                <td style="padding:10px 14px;">${customerLine}${addressLine ? ' · ' + addressLine : ''}</td>
                            </tr>
                            ${projectName ? `
                            <tr style="border-bottom:1px solid #e5e4dd;">
                                <th style="background:#0A1628;color:#fff;font-weight:400;letter-spacing:.15em;font-size:10px;text-transform:uppercase;text-align:left;padding:10px 14px;width:40mm;">Project</th>
                                <td style="padding:10px 14px;">${projectName}</td>
                            </tr>` : ''}
                            <tr style="border-bottom:1px solid #e5e4dd;">
                                <th style="background:#0A1628;color:#fff;font-weight:400;letter-spacing:.15em;font-size:10px;text-transform:uppercase;text-align:left;padding:10px 14px;width:40mm;">Made by</th>
                                <td style="padding:10px 14px;color:#0A1628;font-weight:500;">Piotr Tarasek</td>
                            </tr>
                            <tr>
                                <th style="background:#0A1628;color:#fff;font-weight:400;letter-spacing:.15em;font-size:10px;text-transform:uppercase;text-align:left;padding:10px 14px;width:40mm;">Valid until</th>
                                <td style="padding:10px 14px;">${fmtDate(validUntil)} (30 days from issue)</td>
                            </tr>
                        </table>
                        <h2 style="font-family:${serif};font-weight:700;color:#0A1628;font-size:28px;letter-spacing:.02em;margin:10mm 0 5mm;">About Prime Sash Windows</h2>
                        <p style="font-family:'Jost',sans-serif;font-weight:300;font-size:11.5px;color:#1a1a1a;line-height:1.75;margin-bottom:3.5mm;">Welcome to Prime Sash Windows, where craftsmanship meets functionality. We specialise in creating high-quality timber windows and doors that enhance both the aesthetic appeal and energy efficiency of your home.</p>
                        <p style="font-family:'Jost',sans-serif;font-weight:300;font-size:11.5px;color:#1a1a1a;line-height:1.75;margin-bottom:3.5mm;">Serving London and surrounding areas, we bring over a decade of expertise in bespoke timber window and door manufacturing and installation. As members of The Joinery Network and FENSA registered installers, we offer free site surveys within 25 miles of London.</p>
                        <p style="font-family:'Jost',sans-serif;font-weight:300;font-size:11.5px;color:#1a1a1a;line-height:1.75;margin-bottom:3.5mm;">Every window is produced in our in-house workshop using the Lignum engineered timber system — hardwood only, PAS24 security certified, finished with premium Sikkens coatings. Traditional appearance, modern performance.</p>
                        <div style="margin-top:6mm;padding:6mm;background:#f5f4f0;border-left:3px solid #c9a96e;font-family:'Jost',sans-serif;font-size:10.5px;color:#6b6b6b;line-height:1.65;">
                            <strong style="color:#0A1628;font-weight:500;">Prime Sash Windows</strong> is a trading name of <strong style="color:#0A1628;font-weight:500;">Skylon Joinery Ltd</strong> — a London-based bespoke joinery company registered in England and Wales (Company No. 12946103). All contracts, invoices and payments are issued by Skylon Joinery Ltd.
                        </div>
                    </div>
                </div>
            `;

            // ──────── PAGE 3: CERTIFICATIONS ────────
            const certCard = (imgSrc, title, text) => `
                <div style="border:1px solid #e5e4dd;padding:8mm;display:flex;gap:6mm;align-items:flex-start;background:#fff;">
                    <img src="${imgSrc}" alt="${title}" crossorigin="anonymous" style="width:24mm;height:24mm;object-fit:contain;flex-shrink:0;">
                    <div>
                        <h3 style="font-family:${serif};font-weight:600;font-size:15px;color:#0A1628;margin:0 0 3px;letter-spacing:.01em;">${title}</h3>
                        <p style="font-family:'Jost',sans-serif;font-weight:300;font-size:10px;color:#6b6b6b;line-height:1.55;margin:0;">${text}</p>
                    </div>
                </div>
            `;

            const pageCerts = `
                <div style="${pageStyle}">
                    ${headerBar}
                    <div style="padding:0 20mm;">
                        <h2 style="font-family:${serif};font-weight:700;color:#0A1628;font-size:28px;letter-spacing:.02em;margin:10mm 0 5mm;">Certifications &amp; Technology</h2>
                        <p style="font-family:'Jost',sans-serif;font-weight:300;font-size:12px;color:#6b6b6b;line-height:1.7;margin:8mm 0 10mm;max-width:160mm;">Every Prime Sash window is backed by independently verified certifications. These are not marketing badges — they are legally recognised standards that protect your investment, your safety, and the value of your property.</p>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8mm;">
                            ${certCard('img/MIB/fensa.webp', 'FENSA Registered', 'Government-authorised scheme ensuring compliance with UK Building Regulations. Every installation automatically registered with your local authority — essential for property sales.')}
                            ${certCard('img/MIB/PAS24.webp', 'PAS24 Security', 'Enhanced security performance standard. Tested against manipulation, cutting, and forced entry. Specified by Secured by Design and required for new-build.')}
                            ${certCard('img/MIB/mib-colour.webp', 'Made in Britain', 'Every window manufactured in the UK. Short supply chain, full traceability, and support for British craftsmanship and manufacturing.')}
                            ${certCard('img/MIB/lignum.webp', 'Lignum System', 'Engineered timber window system — hardwood only, certified components, lead-weight balanced, passive glass technology. Built to last decades.')}
                        </div>
                        <div style="margin-top:10mm;padding:8mm;background:#0A1628;color:#fff;">
                            <h3 style="font-family:${serif};font-weight:600;font-size:18px;margin:0 0 3mm;letter-spacing:.02em;">Crafting a Greener Future</h3>
                            <p style="font-family:'Jost',sans-serif;font-weight:300;font-size:10.5px;line-height:1.6;opacity:.9;margin:0;">Timber is a renewable resource — when sourced responsibly, it is one of the most sustainable building materials available. Our commitment goes beyond compliance.</p>
                            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6mm;margin-top:5mm;">
                                <div>
                                    <h4 style="font-family:'Jost',sans-serif;font-weight:500;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;margin:0 0 2mm;color:#D4D4C8;">FSC Certified Timber</h4>
                                    <p style="font-family:'Jost',sans-serif;font-weight:300;font-size:9.5px;line-height:1.6;opacity:.9;margin:0;">All timber from sustainably managed forests with full chain-of-custody documentation.</p>
                                </div>
                                <div>
                                    <h4 style="font-family:'Jost',sans-serif;font-weight:500;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;margin:0 0 2mm;color:#D4D4C8;">Sustainable Manufacturing</h4>
                                    <p style="font-family:'Jost',sans-serif;font-weight:300;font-size:9.5px;line-height:1.6;opacity:.9;margin:0;">Low-VOC Sikkens coatings, waste-heat recovery, and closed-loop spray booth systems.</p>
                                </div>
                                <div>
                                    <h4 style="font-family:'Jost',sans-serif;font-weight:500;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;margin:0 0 2mm;color:#D4D4C8;">Minimising Waste</h4>
                                    <p style="font-family:'Jost',sans-serif;font-weight:300;font-size:9.5px;line-height:1.6;opacity:.9;margin:0;">Offcuts used for smaller components. All timber waste recycled or used as biofuel.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // ──────── PAGES 4+: ITEMS (max 2 per page) ────────
            const buildItemCard = (item, idx) => {
                const p = R.parseItem(item);
                const svg = R.generateWindowSVG(item);
                const screenshots = p.fc.screenshots || p.spec.screenshots || item.screenshots || null;

                const specs = [];
                if (p.windowType === 'casement') {
                    specs.push(['Type', p.casementTypeText]);
                    specs.push(['Dimensions', `${p.width}mm × ${p.height}mm`]);
                    if (p.fanlightHeight > 0) specs.push(['Fanlight Height', p.fanlightHeight + 'mm']);
                    specs.push(['Glass', p.glassText]);
                    specs.push(['Glass Finish', p.glassFinishText]);
                    specs.push(['Spacer Bar', p.spacerText]);
                    specs.push(['Colour', p.colorDisplay]);
                    specs.push(['Bars', p.casementBarsText]);
                    specs.push(['PAS24', p.pas24 ? 'Yes' : 'No']);
                    if (p.hardwareFinish) specs.push(['Hardware Finish', p.hardwareFinish]);
                } else if (p.windowType === 'fix-only') {
                    specs.push(['Type', p.fixTypeText]);
                    specs.push(['Dimensions', `${p.width}mm × ${p.height}mm`]);
                    specs.push(['Glass', p.glassText]);
                    specs.push(['Spacer Bar', p.fixSpacerText]);
                    specs.push(['Glass Finish', p.glassFinishText]);
                    specs.push(['Colour', p.colorDisplay]);
                    specs.push(['Bars', p.fixBarsFull]);
                } else {
                    if (p.sashType !== 'double') specs.push(['Window Type', p.sashType === 'triple' ? 'Triple Sash' : p.sashType]);
                    if (p.headType === 'arch') specs.push(['Head Type', 'Glazing Arch']);
                    specs.push(['Dimensions', `${p.width}mm × ${p.height}mm`]);
                    specs.push(['Frame', p.frameText]);
                    specs.push(['Opening', p.openingText]);
                    specs.push(['Glass', p.glassText]);
                    specs.push(['Glass Finish', p.glassFinishText]);
                    specs.push(['Spacer Bar', p.spacerText]);
                    specs.push(['Colour', p.colorDisplay]);
                    specs.push(['Georgian Bars', p.barsText]);
                    specs.push(['PAS24', p.pas24 ? 'Yes' : 'No']);
                    specs.push(['Horns', p.hornsText]);
                    if (p.hardwareFinish) specs.push(['Hardware Finish', p.hardwareFinish]);
                }

                const specRows2Col = specs.map(([l, v]) => `
                    <div>
                        <div style="font-family:'Jost',sans-serif;font-weight:500;letter-spacing:.18em;text-transform:uppercase;font-size:8px;color:#6b6b6b;margin-bottom:1mm;">${l}</div>
                        <div style="font-family:'Jost',sans-serif;font-size:10px;color:#0A1628;margin-bottom:3mm;line-height:1.35;">${v}</div>
                    </div>
                `).join('');

                const ironItemsHTML = (p.ironList && p.ironList.length > 0)
                    ? p.ironList.map(pr => `
                        <div style="display:flex;align-items:center;gap:3mm;margin-bottom:2mm;">
                            ${pr.img ? `<img src="${pr.img}" crossorigin="anonymous" style="width:10mm;height:10mm;object-fit:cover;border:1px solid #e5e4dd;border-radius:1mm;flex-shrink:0;background:#f5f4f0;" onerror="this.style.visibility='hidden'">` : `<div style="width:10mm;height:10mm;border:1px solid #e5e4dd;background:#f5f4f0;border-radius:1mm;flex-shrink:0;"></div>`}
                            <span style="font-family:'Jost',sans-serif;font-size:9.5px;color:#0A1628;line-height:1.4;">${pr.qty > 1 ? `<strong>${pr.qty}×</strong> ` : ''}${pr.name}${pr.color ? ` — ${pr.color}` : ''}</span>
                        </div>
                    `).join('')
                    : `<div style="font-family:'Jost',sans-serif;font-size:9.5px;color:#888;font-style:italic;">No ironmongery specified for this item.</div>`;

                const typeLabel = p.windowType === 'casement' ? 'Casement Window'
                    : p.windowType === 'fix-only' ? 'Fix Frame'
                    : p.sashType === 'triple' ? 'Triple Sash Window'
                    : p.sashType === 'single' ? 'Single Sash Window'
                    : 'Traditional Sash Window';

                const idxStr = String(idx + 1).padStart(2, '0');
                const priceStr = '£' + R.formatPrice(item.total_price || 0);

                return `
                    <div style="border:1px solid #e5e4dd;margin-bottom:5mm;overflow:hidden;">
                        <div style="background:#0A1628;color:#fff;padding:5mm 7mm;display:flex;justify-content:space-between;align-items:center;">
                            <div style="font-family:${serif};font-weight:600;font-size:18px;letter-spacing:.02em;"><span style="font-family:'Jost',sans-serif;font-weight:300;font-size:11px;opacity:.65;letter-spacing:.25em;margin-right:10px;">ITEM ${idxStr}</span>${typeLabel}</div>
                            <div style="font-family:'Jost',sans-serif;font-weight:500;font-size:18px;letter-spacing:.02em;">${priceStr}</div>
                        </div>
                        <div style="display:grid;grid-template-columns:70mm 1fr;gap:6mm;padding:6mm;">
                            ${screenshots?.interior ? `
                                <div style="background:#f5f4f0;border:1px solid #e5e4dd;padding:4mm;display:flex;flex-direction:column;gap:3mm;">
                                    <div style="width:100%;height:48mm;display:flex;align-items:center;justify-content:center;"><img src="${screenshots.interior}" crossorigin="anonymous" style="max-width:100%;max-height:100%;object-fit:contain;"/></div>
                                    <div style="width:100%;height:48mm;display:flex;align-items:center;justify-content:center;border-top:1px dashed #ccc;padding-top:3mm;">${svg}</div>
                                </div>
                            ` : `
                                <div style="background:#f5f4f0;border:1px solid #e5e4dd;display:flex;align-items:center;justify-content:center;padding:4mm;">
                                    <div style="width:100%;max-height:100mm;">${svg}</div>
                                </div>
                            `}
                            <div>
                                <h4 style="font-family:'Jost',sans-serif;font-weight:500;letter-spacing:.18em;text-transform:uppercase;font-size:9px;color:#6b6b6b;margin:0 0 3mm;border-bottom:1px solid #e5e4dd;padding-bottom:2mm;">Specification</h4>
                                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 6mm;">${specRows2Col}</div>
                                <h4 style="font-family:'Jost',sans-serif;font-weight:500;letter-spacing:.18em;text-transform:uppercase;font-size:9px;color:#6b6b6b;margin:4mm 0 3mm;border-top:1px solid #e5e4dd;border-bottom:1px solid #e5e4dd;padding:3mm 0 2mm;">Ironmongery</h4>
                                ${ironItemsHTML}
                            </div>
                        </div>
                    </div>
                `;
            };

            // ──────── ITEMS: title block + per-item blocks (for smart page-breaking) ────────
            const titleBlockHTML = items.length > 0 ? `
                <div style="font-family:'Jost',sans-serif;padding:20px 30px;background:#fff;">
                    <h2 style="font-family:${serif};font-weight:700;color:#0A1628;font-size:30px;letter-spacing:.02em;margin:0;display:flex;justify-content:space-between;align-items:baseline;">
                        Your Estimate
                        <span style="font-family:'Jost',sans-serif;font-weight:300;font-size:14px;letter-spacing:.2em;text-transform:uppercase;color:#6b6b6b;">${items.length} Item${items.length !== 1 ? 's' : ''}</span>
                    </h2>
                </div>
            ` : `
                <div style="font-family:'Jost',sans-serif;padding:20px 30px;background:#fff;">
                    <h2 style="font-family:${serif};font-weight:700;color:#0A1628;font-size:28px;letter-spacing:.02em;margin:0 0 5mm;">Your Estimate</h2>
                    <p style="font-family:'Jost',sans-serif;font-weight:300;font-size:12px;color:#6b6b6b;">No items added to this estimate yet.</p>
                </div>
            `;

            const itemBlocksHTML = items.map((item, idx) => `
                <div style="font-family:'Jost',sans-serif;padding:10px 30px;background:#fff;">
                    ${buildItemCard(item, idx)}
                </div>
            `);



            // ──────── PAGE -2: SUMMARY + PAYMENT 50/50 ────────
            const summaryRows = items.map((it, idx) => {
                const p = R.parseItem(it);
                const typeShort = p.windowType === 'casement' ? 'Casement'
                    : p.windowType === 'fix-only' ? 'Fix Frame'
                    : p.sashType === 'triple' ? 'Triple Sash'
                    : p.sashType === 'single' ? 'Single Sash'
                    : 'Sash';
                const desc = `${typeShort} · ${p.width}×${p.height}mm · ${p.colorDisplay || '-'}`;
                return `
                    <tr>
                        <td style="padding:3.5mm 5mm;border-bottom:1px solid #e5e4dd;">${String(idx + 1).padStart(2, '0')}</td>
                        <td style="padding:3.5mm 5mm;border-bottom:1px solid #e5e4dd;">${desc}</td>
                        <td style="padding:3.5mm 5mm;border-bottom:1px solid #e5e4dd;text-align:center;">${p.quantity || 1}</td>
                        <td style="padding:3.5mm 5mm;border-bottom:1px solid #e5e4dd;text-align:right;font-weight:500;color:#0A1628;">£${R.formatPrice(it.total_price || 0)}</td>
                    </tr>
                `;
            }).join('');

            const pageSummary = `
                <div style="${pageStyle}">
                    ${headerBar}
                    <div style="padding:0 20mm;">
                        <h2 style="font-family:${serif};font-weight:700;color:#0A1628;font-size:26px;letter-spacing:.02em;margin:8mm 0 4mm;">Summary</h2>

                        <!-- ─── WINDOWS TABLE ─── -->
                        <table style="width:100%;border-collapse:collapse;margin:0 0 5mm;font-family:'Jost',sans-serif;font-size:10.5px;">
                            <thead>
                                <tr>
                                    <th style="background:#0A1628;color:#fff;font-weight:400;letter-spacing:.15em;text-transform:uppercase;font-size:9px;padding:2.5mm 5mm;text-align:left;">Item</th>
                                    <th style="background:#0A1628;color:#fff;font-weight:400;letter-spacing:.15em;text-transform:uppercase;font-size:9px;padding:2.5mm 5mm;text-align:left;">Description</th>
                                    <th style="background:#0A1628;color:#fff;font-weight:400;letter-spacing:.15em;text-transform:uppercase;font-size:9px;padding:2.5mm 5mm;text-align:center;">Qty</th>
                                    <th style="background:#0A1628;color:#fff;font-weight:400;letter-spacing:.15em;text-transform:uppercase;font-size:9px;padding:2.5mm 5mm;text-align:right;">Price</th>
                                </tr>
                            </thead>
                            <tbody>${summaryRows}</tbody>
                            <tfoot>
                                <tr>
                                    <td colspan="3" style="padding:3mm 5mm;border-top:2px solid #0A1628;text-align:right;font-weight:500;color:#0A1628;font-size:11px;">Subtotal — Windows</td>
                                    <td style="padding:3mm 5mm;border-top:2px solid #0A1628;text-align:right;color:#0A1628;font-weight:500;">£${R.formatPrice(totalEx)}</td>
                                </tr>
                            </tfoot>
                        </table>

                        <!-- ─── ADDITIONAL SERVICES TABLE ─── -->
                        <h3 style="font-family:${serif};font-weight:700;color:#0A1628;font-size:18px;letter-spacing:.02em;margin:8mm 0 3mm;">Additional Services</h3>
                        <table style="width:100%;border-collapse:collapse;font-family:'Jost',sans-serif;font-size:10.5px;">
                            <thead>
                                <tr>
                                    <th style="background:#0A1628;color:#fff;font-weight:400;letter-spacing:.15em;text-transform:uppercase;font-size:9px;padding:2.5mm 5mm;text-align:left;">Item</th>
                                    <th style="background:#0A1628;color:#fff;font-weight:400;letter-spacing:.15em;text-transform:uppercase;font-size:9px;padding:2.5mm 5mm;text-align:left;">Description</th>
                                    <th style="background:#0A1628;color:#fff;font-weight:400;letter-spacing:.15em;text-transform:uppercase;font-size:9px;padding:2.5mm 5mm;text-align:center;">Qty</th>
                                    <th style="background:#0A1628;color:#fff;font-weight:400;letter-spacing:.15em;text-transform:uppercase;font-size:9px;padding:2.5mm 5mm;text-align:right;">Price</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style="padding:3mm 5mm;border-bottom:1px solid #e5e4dd;vertical-align:top;">I-01</td>
                                    <td style="padding:3mm 5mm;border-bottom:1px solid #e5e4dd;">
                                        <div style="font-weight:500;color:#0A1628;">Installation</div>
                                        <div style="font-size:9px;color:#6b6b6b;font-style:italic;margin-top:1mm;">£${INSTALLATION_RATE} per unit · standard rate · final amount subject to site survey</div>
                                    </td>
                                    <td style="padding:3mm 5mm;border-bottom:1px solid #e5e4dd;text-align:center;vertical-align:top;">${totalQty}</td>
                                    <td style="padding:3mm 5mm;border-bottom:1px solid #e5e4dd;text-align:right;font-weight:500;color:#0A1628;vertical-align:top;">£${R.formatPrice(installationCost)}</td>
                                </tr>
                                <tr>
                                    <td style="padding:3mm 5mm;border-bottom:1px solid #e5e4dd;vertical-align:top;">D-01</td>
                                    <td style="padding:3mm 5mm;border-bottom:1px solid #e5e4dd;">
                                        <div style="font-weight:500;color:#0A1628;">Delivery</div>
                                        <div style="font-size:9px;color:#6b6b6b;font-style:italic;margin-top:1mm;">Standard delivery charge · subject to location confirmation</div>
                                    </td>
                                    <td style="padding:3mm 5mm;border-bottom:1px solid #e5e4dd;text-align:center;vertical-align:top;">1</td>
                                    <td style="padding:3mm 5mm;border-bottom:1px solid #e5e4dd;text-align:right;font-weight:500;color:#0A1628;vertical-align:top;">£${R.formatPrice(deliveryCost)}</td>
                                </tr>
                            </tbody>
                        </table>

                        <!-- ─── GRAND TOTAL ─── -->
                        <div style="margin-top:6mm;padding:4mm 6mm;background:#f5f4f0;border-top:2px solid #0A1628;">
                            <div style="display:flex;justify-content:space-between;font-family:'Jost',sans-serif;font-size:10.5px;color:#6b6b6b;padding:1.5mm 0;">
                                <span>Subtotal — Windows</span><span>£${R.formatPrice(totalEx)}</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;font-family:'Jost',sans-serif;font-size:10.5px;color:#6b6b6b;padding:1.5mm 0;">
                                <span>Installation (${totalQty} × £${INSTALLATION_RATE})</span><span>£${R.formatPrice(installationCost)}</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;font-family:'Jost',sans-serif;font-size:10.5px;color:#6b6b6b;padding:1.5mm 0;border-bottom:1px solid #e5e4dd;">
                                <span>Delivery</span><span>£${R.formatPrice(deliveryCost)}</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;align-items:baseline;font-family:${serif};font-weight:700;font-size:22px;color:#0A1628;padding:3mm 0 0;">
                                <span>Total <span style="font-family:'Jost',sans-serif;font-size:10px;font-weight:400;color:#6b6b6b;letter-spacing:.1em;">(EXCL. VAT)</span></span>
                                <span>£${R.formatPrice(grandTotal)}</span>
                            </div>
                        </div>

                        <!-- ─── VAT NOTE ─── -->
                        <div style="margin-top:4mm;padding:3mm 5mm;background:#fff8ed;border-left:3px solid #c9a96e;font-family:'Jost',sans-serif;font-size:9.5px;color:#6b6b6b;line-height:1.55;">
                            <strong style="color:#0A1628;">All prices exclude VAT.</strong> VAT will be applied at the applicable rate (0%, 5%, or 20%) depending on your property status and project type. The correct rate will be confirmed prior to invoicing.
                        </div>
                    </div>
                </div>
            `;

            // ──────── PAGE: PAYMENT SCHEDULE (own page) ────────
            const pagePayment = `
                <div style="${pageStyle}">
                    ${headerBar}
                    <div style="padding:0 20mm;">
                        <h2 style="font-family:${serif};font-weight:700;color:#0A1628;font-size:28px;letter-spacing:.02em;margin:10mm 0 4mm;">Payment Schedule</h2>
                        <p style="font-family:'Jost',sans-serif;font-weight:300;font-size:11px;color:#6b6b6b;line-height:1.65;margin-bottom:8mm;max-width:160mm;">
                            Payments are structured to protect both parties. Deposit secures the order, balance is required prior to dispatch, and delivery is billed separately upon site arrival.
                        </p>

                        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:5mm;">
                            <div style="border:1px solid #e5e4dd;padding:6mm;position:relative;min-height:85mm;">
                                <div style="position:absolute;top:4mm;right:5mm;font-family:${serif};font-weight:700;font-size:46px;color:#D4D4C8;line-height:1;">I</div>
                                <div style="font-family:'Jost',sans-serif;font-weight:500;letter-spacing:.2em;text-transform:uppercase;font-size:9.5px;color:#6b6b6b;margin-bottom:2mm;">Initial Deposit</div>
                                <div style="font-family:${serif};font-weight:700;font-size:30px;color:#0A1628;line-height:1;margin-bottom:3mm;">50%</div>
                                <div style="font-family:'Jost',sans-serif;font-weight:500;font-size:15px;color:#c9a96e;margin-bottom:3mm;">£${R.formatPrice(depositHalf)}</div>
                                <div style="font-family:'Jost',sans-serif;font-weight:300;font-size:10px;color:#6b6b6b;line-height:1.55;">Non-refundable deposit payable upon acceptance of this quotation. Secures the order, reserves workshop capacity, and funds material procurement. Calculated on windows + installation only.</div>
                            </div>
                            <div style="border:1px solid #e5e4dd;padding:6mm;position:relative;min-height:85mm;">
                                <div style="position:absolute;top:4mm;right:5mm;font-family:${serif};font-weight:700;font-size:46px;color:#D4D4C8;line-height:1;">II</div>
                                <div style="font-family:'Jost',sans-serif;font-weight:500;letter-spacing:.2em;text-transform:uppercase;font-size:9.5px;color:#6b6b6b;margin-bottom:2mm;">Balance</div>
                                <div style="font-family:${serif};font-weight:700;font-size:30px;color:#0A1628;line-height:1;margin-bottom:3mm;">50%</div>
                                <div style="font-family:'Jost',sans-serif;font-weight:500;font-size:15px;color:#c9a96e;margin-bottom:3mm;">£${R.formatPrice(depositHalf)}</div>
                                <div style="font-family:'Jost',sans-serif;font-weight:300;font-size:10px;color:#6b6b6b;line-height:1.55;">Due prior to dispatch or installation. Windows will not leave the workshop until full payment is received. Bank transfer to Skylon Joinery Ltd. Calculated on windows + installation only.</div>
                            </div>
                            <div style="border:1px solid #e5e4dd;padding:6mm;position:relative;min-height:85mm;background:#fbfaf7;">
                                <div style="position:absolute;top:4mm;right:5mm;font-family:${serif};font-weight:700;font-size:46px;color:#D4D4C8;line-height:1;">III</div>
                                <div style="font-family:'Jost',sans-serif;font-weight:500;letter-spacing:.2em;text-transform:uppercase;font-size:9.5px;color:#6b6b6b;margin-bottom:2mm;">Delivery</div>
                                <div style="font-family:${serif};font-weight:700;font-size:30px;color:#0A1628;line-height:1;margin-bottom:3mm;">100%</div>
                                <div style="font-family:'Jost',sans-serif;font-weight:500;font-size:15px;color:#c9a96e;margin-bottom:3mm;">£${R.formatPrice(deliveryCost)}</div>
                                <div style="font-family:'Jost',sans-serif;font-weight:300;font-size:10px;color:#6b6b6b;line-height:1.55;">Payable upon delivery to site. Separate from windows payment schedule. Covers transport, logistics, and safe unloading.</div>
                            </div>
                        </div>

                        <div style="margin-top:10mm;padding:5mm 6mm;background:#f5f4f0;border-left:3px solid #0A1628;font-family:'Jost',sans-serif;font-size:10.5px;color:#1a1a1a;line-height:1.65;">
                            <strong style="color:#0A1628;">Bank transfer details</strong> are provided on the final Terms & Conditions page. Alternative payment methods may be arranged in writing prior to acceptance.
                        </div>
                    </div>
                </div>
            `;

            // ──────── PAGE -1: TERMS + FOOTER ────────
            const term = (num, title, body) => `
                <li style="list-style:none;margin-bottom:5mm;padding-left:10mm;position:relative;line-height:1.6;">
                    <span style="position:absolute;left:0;top:0;font-family:${serif};font-weight:700;font-size:14px;color:#0A1628;">${num}.</span>
                    <h4 style="font-family:${serif};font-weight:600;font-size:13px;color:#0A1628;margin:0 0 1.5mm;letter-spacing:.02em;">${title}</h4>
                    <p style="font-weight:300;color:#1a1a1a;margin:0;">${body}</p>
                </li>
            `;

            const pageTerms = `
                <div style="${pageStyle}display:flex;flex-direction:column;">
                    ${headerBar}
                    <div style="padding:0 20mm;flex:1;">
                        <h2 style="font-family:${serif};font-weight:700;color:#0A1628;font-size:28px;letter-spacing:.02em;margin:10mm 0 5mm;">Terms and Conditions</h2>
                        <ol style="font-family:'Jost',sans-serif;font-size:10.5px;color:#1a1a1a;margin:6mm 0 0;padding:0;">
                            ${term(1, 'Validity', 'This quotation is valid for a period of 30 (thirty) days from the date of issuance. After this period, the terms, pricing, and availability of the quoted items and services are subject to change without prior notice.')}
                            ${term(2, 'Basis of Quotation', 'This quotation has been prepared based on the specifications, dimensions and project details provided at the time of request. Any changes — including scope of work, materials, site measurements taken at survey, or schedule — may result in an updated quotation and revised pricing.')}
                            ${term(3, 'Exclusions', 'Unless otherwise stated, all prices are exclusive of VAT. Additional costs for scaffolding, making good, redecoration, electrical alterations, or removal of non-standard existing windows (stained glass, leaded lights) will be invoiced separately where applicable.')}
                            ${term(4, 'Acceptance', 'Acceptance of this quotation constitutes an agreement to proceed under the terms outlined herein. Written confirmation (via email or signed acceptance) and the initial deposit are required to initiate the order and scheduling process.')}
                            ${term(5, 'Amendments', 'Any modifications, additions, or extra services requested after acceptance will require a written change order and may result in additional charges. Once fabrication drawings are approved, no further changes can be accepted.')}
                            ${term(6, 'Lead Time', 'Within 1 (one) week from acceptance, fabrication drawings will be issued for your approval. From the approval of drawings, the production and delivery timeline is estimated at 8 to 10 weeks. Lead time may vary depending on order size and complexity.')}
                        </ol>
                        <div style="margin-top:8mm;padding:6mm;background:#f5f4f0;border-left:3px solid #c9a96e;font-family:'Jost',sans-serif;font-weight:300;font-size:10.5px;color:#1a1a1a;line-height:1.65;">
                            <strong style="color:#0A1628;font-weight:500;">Payment Terms — Prime Sash Windows.</strong> A two-stage payment structure applies: 50% non-refundable deposit upon acceptance, and 50% final payment due prior to dispatch or installation. All payments by bank transfer to <strong style="color:#0A1628;font-weight:500;">Skylon Joinery Ltd</strong>. Late payments may be subject to interest charges in accordance with the Late Payment of Commercial Debts (Interest) Act 1998.
                        </div>
                        <div style="margin-top:8mm;padding-top:5mm;border-top:1px solid #e5e4dd;font-family:'Jost',sans-serif;font-size:9.5px;color:#6b6b6b;line-height:1.7;">
                            <strong style="color:#0A1628;font-weight:500;">Bank Details:</strong> Skylon Joinery Ltd · Sort Code: 20-25-19 · Account Number: 43982947<br>
                            <strong style="color:#0A1628;font-weight:500;">Company:</strong> Skylon Joinery Limited · Registered in England and Wales No. 12946103 · Registered office: 31 Roe Hill Close, Hatfield, AL10 9JE
                        </div>
                    </div>
                    <div style="background:#0A1628;color:#fff;padding:8mm 20mm;display:grid;grid-template-columns:auto 1fr 1fr 1fr;gap:8mm;align-items:center;font-family:'Jost',sans-serif;font-size:9.5px;">
                        <div style="font-weight:300;letter-spacing:.3em;font-size:11px;border-top:1px solid #fff;border-bottom:1px solid #fff;padding:4px 0;white-space:nowrap;">PRIME&nbsp;SASH</div>
                        <div style="display:flex;flex-direction:column;gap:2px;">
                            <span style="font-size:10px;color:#D4D4C8;letter-spacing:.15em;text-transform:uppercase;">Web</span>
                            <span style="font-size:9.5px;font-weight:300;">www.primesashwindows.co.uk</span>
                        </div>
                        <div style="display:flex;flex-direction:column;gap:2px;">
                            <span style="font-size:10px;color:#D4D4C8;letter-spacing:.15em;text-transform:uppercase;">Email</span>
                            <span style="font-size:9.5px;font-weight:300;">info@primesashwindows.co.uk</span>
                        </div>
                        <div style="display:flex;flex-direction:column;gap:2px;">
                            <span style="font-size:10px;color:#D4D4C8;letter-spacing:.15em;text-transform:uppercase;">Phone</span>
                            <span style="font-size:9.5px;font-weight:300;">+44 7842 510060</span>
                        </div>
                    </div>
                </div>
            `;

            // ──────── RENDER HELPERS ────────
            async function renderToCanvas(html, width) {
                const container = document.createElement('div');
                container.style.cssText = `position:fixed;left:-9999px;top:0;width:${width};background:#fff;`;
                container.innerHTML = html;
                document.body.appendChild(container);

                const imgs = container.querySelectorAll('img');
                if (imgs.length > 0) {
                    await Promise.all([...imgs].map(img => {
                        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
                        return new Promise(res => {
                            img.onload = res;
                            img.onerror = res;
                            setTimeout(res, 3000);
                        });
                    }));
                }

                const canvas = await window.html2canvas(container, {
                    scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff',
                    logging: false, width: container.offsetWidth, height: container.offsetHeight
                });
                document.body.removeChild(container);
                return canvas;
            }

            // ──────── ASSEMBLE PDF ────────
            const doc = new jsPDF('p', 'mm', 'a4');
            const pageW = 210, pageH = 297, margin = 8;
            const usableW = pageW - margin * 2;

            // Full A4 page (cover, quote, certs, summary, terms)
            async function addFullPage(html, isFirst = false) {
                if (!isFirst) doc.addPage();
                const canvas = await renderToCanvas(html, '210mm');
                const imgData = canvas.toDataURL('image/jpeg', 0.92);
                doc.addImage(imgData, 'JPEG', 0, 0, pageW, pageH);
            }

            // Smart page-breaking block (items section only)
            let curY = margin;
            async function addBlock(html) {
                const canvas = await renderToCanvas(html, '800px');
                const blockH = (canvas.height / canvas.width) * usableW;

                if (curY + blockH > pageH - margin && curY > margin + 1) {
                    doc.addPage();
                    curY = margin;
                }

                const imgData = canvas.toDataURL('image/jpeg', 0.92);
                doc.addImage(imgData, 'JPEG', margin, curY, usableW, blockH);
                curY += blockH + 4;
            }

            // 1. Cover
            await addFullPage(pageCover, true);
            // 2. Quote
            await addFullPage(pageQuote);
            // 3. Certifications
            await addFullPage(pageCerts);

            // 4. Items — new page + smart page-breaking
            doc.addPage();
            curY = margin;
            await addBlock(titleBlockHTML);
            for (const itemHTML of itemBlocksHTML) {
                await addBlock(itemHTML);
            }

            // 5. Summary (windows + additional services + grand total + VAT note)
            await addFullPage(pageSummary);
            // 5b. Payment Schedule (own page)
            await addFullPage(pagePayment);
            // 6. Terms
            await addFullPage(pageTerms);

            doc.save(`PrimeSashWindows_Quote_${estimateNumber}.pdf`);

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
            if (p.windowType === 'casement') {
                specs.push(['Type', p.casementTypeText]);
                specs.push(['Dimensions', `${p.width}mm × ${p.height}mm`]);
                if (p.fanlightHeight > 0) specs.push(['Fanlight Height', p.fanlightHeight + 'mm']);
                specs.push(['Glass', p.glassText]);
                specs.push(['Glass Spec', p.glassSpecCasementText]);
                specs.push(['Glass Finish', p.glassFinishText]);
                specs.push(['Spacer Bar', p.spacerText]);
                specs.push(['Colour', p.colorDisplay]);
                specs.push(['Bars', p.casementBarsText]);
                specs.push(['PAS24', p.pas24 ? 'Yes' : 'No']);
                specs.push(['Safety Glass', p.safetyGlassText]);
                specs.push(['Seal Colour', p.sealColour.charAt(0).toUpperCase() + p.sealColour.slice(1)]);
                if (p.sillExtension !== 'none') specs.push(['Sill Projection', p.sillText]);
                specs.push(['Trickle Vent', p.trickleText]);
                if (p.hardwareFinish) specs.push(['Hardware Finish', p.hardwareFinish]);
            } else if (p.windowType === 'fix-only') {
                specs.push(['Type', p.fixTypeText]);
                specs.push(['Dimensions', `${p.width}mm × ${p.height}mm`]);
                specs.push(['Glass', p.glassText]);
                specs.push(['Spacer Bar', p.fixSpacerText]);
                specs.push(['Glass Finish', p.glassFinishText]);
                specs.push(['Colour', p.colorDisplay]);
                specs.push(['Bars', p.fixBarsFull]);
            } else {
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
            }

            const ironText = p.ironList.length > 0 
                ? p.ironList.map(pr => `${pr.qty > 1 ? pr.qty + 'x ' : ''}${pr.name}`).join(', ')
                : '-';

            const specRowsHTML = specs.map(([label, value]) => `
                <div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #f0f0f0;">
                    <span style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;">${label}</span>
                    <span style="font-size:12px;color:#0a1628;text-align:right;max-width:60%;">${value}</span>
                </div>
            `).join('');

            const typeLabel = p.windowType === 'casement' ? 'Casement' : p.windowType === 'fix-only' ? 'Fix Frame' : p.sashType === 'triple' ? 'Triple Sash' : p.sashType === 'single' ? 'Single Sash' : 'Double Sash';
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
                const typeLabel = p.windowType === 'casement' ? 'Casement' : p.windowType === 'fix-only' ? 'Fix Frame' : p.sashType === 'triple' ? 'Triple Sash' : p.sashType === 'single' ? 'Single Sash' : 'Double Sash';
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
        const pdfBtns = document.querySelectorAll('.btn-download-pdf');
        pdfBtns.forEach(btn => btn.addEventListener('click', () => EstimateRenderer.downloadEstimatePDF(estimate)));
        const excelBtn = document.getElementById('download-estimate-excel');
        if (excelBtn) excelBtn.addEventListener('click', () => EstimateRenderer.downloadEstimateExcel(estimate));
    }
}

// Make globally available
window.EstimateRenderer = EstimateRenderer;