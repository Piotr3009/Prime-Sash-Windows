// Shared Estimate Renderer — used by both customer-dashboard.js and admin-dashboard.html
// Provides: rendering, SVG drawing, PDF export, Excel export

class EstimateRenderer {

    static formatPrice(price) {
        return new Intl.NumberFormat('en-GB', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(price);
    }

    // Single source of truth for windows deposit/balance.
    // Unlocked (deposit_locked is null): live 50/50 split of windows total.
    // Locked (deposit_locked is a number): deposit frozen at payment time, balance = total - frozen deposit.
    // Custom "with_deposit" / "with_balance" extras are always added on top in both modes.
    static computeDeposit(estimate, totalEx, windowsHalf, customDepositAdd, customBalanceAdd) {
        const raw = estimate ? estimate.deposit_locked : null;
        const locked = (raw !== null && raw !== undefined && raw !== '');
        const lockedVal = locked ? parseFloat(raw) : 0;
        if (locked && !isNaN(lockedVal)) {
            return {
                locked: true,
                depositVal: lockedVal + customDepositAdd,
                balanceVal: (totalEx - lockedVal) + customBalanceAdd
            };
        }
        return {
            locked: false,
            depositVal: windowsHalf + customDepositAdd,
            balanceVal: windowsHalf + customBalanceAdd
        };
    }

    // Natural sort for window numbers: group by letter prefix, then numeric.
    // e.g. GL1, GL2, W1, W2, W3, W10, W11 (not W1, W10, W11, W2).
    static sortWindowItems(items) {
        if (!Array.isArray(items)) return items;
        const parse = (name) => {
            const s = String(name || '');
            const m = s.match(/^([^0-9]*)(\d+)?(.*)$/);
            const prefix = (m && m[1] ? m[1] : '').toUpperCase().trim();
            const num = (m && m[2] !== undefined && m[2] !== '') ? parseInt(m[2], 10) : Infinity;
            return { prefix, num, raw: s.toUpperCase() };
        };
        return [...items].sort((a, b) => {
            const pa = parse(a.window_number);
            const pb = parse(b.window_number);
            if (pa.prefix !== pb.prefix) return pa.prefix < pb.prefix ? -1 : 1;
            if (pa.num !== pb.num) return pa.num - pb.num;
            return pa.raw < pb.raw ? -1 : (pa.raw > pb.raw ? 1 : 0);
        });
    }

    static async deleteItem(itemId, estimateId) {
        if (!confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
            return;
        }
        try {
            const { error: deleteError } = await supabaseClient.from('estimate_items').delete().eq('id', itemId);
            if (deleteError) throw deleteError;
            const { data: remaining } = await supabaseClient.from('estimate_items').select('total_price').eq('estimate_id', estimateId);
            const newTotal = (remaining || []).reduce((s, r) => s + (parseFloat(r.total_price) || 0), 0);
            await supabaseClient.from('estimates').update({ total_price: newTotal, updated_at: new Date().toISOString() }).eq('id', estimateId);
            // Re-render: try dashboard first, fallback to reload
            if (window.dashboard && window.dashboard.viewOrderDetails) {
                if ((remaining || []).length === 0) { window.dashboard.closeModal(); await window.dashboard.loadEstimates(); }
                else { await window.dashboard.viewOrderDetails(estimateId); }
            } else {
                // On online-estimate.html — reload estimate selector and close modal
                if (window.estimateSelectorManager) await window.estimateSelectorManager.loadEstimates();
                const modal = document.querySelector('.estimate-modal-overlay, .modal-overlay');
                if (modal) modal.remove();
                alert('Item deleted successfully.');
            }
        } catch (e) {
            console.error('=== DELETE WINDOW FAILED ===', e);
            alert('Failed to delete item.');
        }
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

    // Framed visual box: navy caption strip + fixed 4:5 stage.
    // Used for both 3D renders and the technical drawing so the card reads as one set.
    static visualBox(caption, inner, bg, pad) {
        return `<div style="min-width:0;border:1px solid rgba(10,22,40,.85);border-radius:2px;overflow:hidden;box-shadow:0 2px 8px rgba(10,22,40,.10);background:#FAFAF8;">
            <div style="background:#0A1628;color:#F3F0EA;font-family:'Jost',sans-serif;font-size:.5rem;letter-spacing:.18em;text-transform:uppercase;padding:5px 6px;text-align:center;">${caption}</div>
            <div style="position:relative;display:flex;align-items:center;justify-content:center;background:${bg || '#A9A69B'};padding:${pad || '0'};">${inner}</div>
        </div>`;
    }

    // Zoomable render inside a visual box
    static visualImage(src) {
        return `<img src="${src}" onclick="EstimateRenderer.zoomImage(this)" style="width:100%;height:auto;display:block;cursor:zoom-in;" />
            <span style="position:absolute;bottom:8px;right:8px;width:22px;height:22px;background:rgba(10,22,40,.78);border-radius:50%;display:flex;align-items:center;justify-content:center;pointer-events:none;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><circle cx="10" cy="10" r="7"/><line x1="15.5" y1="15.5" x2="21" y2="21"/><line x1="10" y1="7" x2="10" y2="13"/><line x1="7" y1="10" x2="13" y2="10"/></svg></span>`;
    }

    // "View in 3D" button under the screenshot (Etap 2).
    // Renders only when: (a) the item carries a saved viewer3d config (Etap 1) AND
    // (b) the viewer modal script is present on this page (window.open3DViewer).
    // online-estimate.html deliberately does NOT load the modal script — the live
    // configurator owns window.update3D there, so no button appears on that page.
    static viewer3dButton(item, p) {
        const v3d = p.spec?.viewer3d;
        if (!v3d || typeof window.open3DViewer !== 'function') return '';
        window.__psw3dConfigs = window.__psw3dConfigs || {};
        window.__psw3dConfigs[item.id] = {
            config: v3d,
            label: (p.windowType === 'door' ? 'Door ' : 'Window ') + (item.window_number || ''),
            dims: (p.width && p.height) ? (p.width + ' \u00d7 ' + p.height + ' mm') : ''
        };
        // Styling lives in js/viewer3d-modal.js so the animated sweep can use
        // keyframes, which inline styles cannot express.
        return `<button type="button" class="psw3d-btn" data-psw3d="${item.id}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/></svg>Rotate in 3D</button>`;
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
        let width = fc.actualFrameWidth || item.width || 1000;
        let height = fc.actualFrameHeight || item.height || 1500;
        const originalWidth = fc.originalWidth || item.original_width || null;
        const originalHeight = fc.originalHeight || item.original_height || null;
        const measurementType = fc.measurementType || item.measurement_type || 'frame';

        // If structural opening was entered, ALWAYS recalculate frame from structural
        // (stored width may be wrong if actualFrameWidth was cleared before save)
        if (measurementType === 'brick-to-brick' && originalWidth && originalHeight) {
          width = originalWidth + 150;
          height = originalHeight + 75;
        }

        // FRAME
        const frameType = fc.frameType || item.frame_type || 'standard';
        // frameText will be updated after glassType is known (triple → 172mm)
        let frameText = frameType === 'slim' ? 'Slim Frame (144mm)' : 'Standard Frame (164mm)';

        // OPENING
        const openingType = fc.openingType || item.opening_type || 'both';
        const openingLabels = { both: 'Both Sashes', bottom: 'Bottom Only', fixed: 'Fixed (Non-opening)' };
        const openingText = openingLabels[openingType] || openingType;

        // GLASS
        const glassType = fc.glassType || item.glass_type || 'double';
        const glassLabels = { 'double': 'Double Glazed (4/16/4, U:1.4)', 'triple': 'Triple Glazed (U:1.2)', 'passive': 'Passive Glass (U:0.8)' };
        const glassText = glassLabels[glassType] || glassType;
        // Triple glazing requires 172mm frame regardless of frameType selection
        if (glassType === 'triple' || frameType === 'triple') {
          frameText = 'Triple Glazing Frame (172mm)';
        }

        // GLASS SPEC
        const glassSpec = fc.glassSpec || item.glass_spec || 'toughened';
        const glassSpecText = glassSpec === 'laminated' ? 'Laminated (Security/Acoustic)' : 'Toughened';

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
        const spacerColor = fc.spacerColor || item.spacer_color || 'white';
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
        if (upperBars !== 'none' || lowerBars !== 'none') {
            const upperText = formatBars(upperBars, upperCustomList);
            const lowerText = formatBars(lowerBars, lowerCustomList);
            if (upperBars === lowerBars && upperBars !== 'custom') {
                barsText = upperText;
            } else {
                barsText = `Upper: ${upperText}, Lower: ${lowerText}`;
            }
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
        let casementSectionsText = '';
        if (['130','131','132','133'].includes(casementLayout) && parseInt(fc.casementMiddleWidth) > 0) {
            const wTotSec = parseInt(fc.actualFrameWidth || fc.width) || 0;
            const midSec = parseInt(fc.casementMiddleWidth) || 0;
            const sideSec = Math.round((wTotSec - midSec) / 2);
            if (wTotSec > 0) casementSectionsText = sideSec + ' | ' + midSec + ' | ' + sideSec + 'mm';
        }
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
        const safetyGlassText = safetyGlass === 'toughened' ? 'Toughened' : safetyGlass === 'laminate' ? 'Laminate (Security/Acoustic)' : 'Standard';
        const glassSpecCasement = fc.glassSpec || 'float';
        const glassSpecCasementText = glassSpecCasement === 'low-e' ? 'Low-E Coated' : 'Float Glass';
        const fanlightHeight = (['021','031','032','052L','052R','022','131','132','133','013','023'].includes(fc.casementLayout || fc.layout || '')) ? (fc.fanlightHeight || 0) : 0; // layout gate: never show fan fields for fan-less layouts (legacy records)

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
        const fixSpacer = fc.spacer || fc.spacerColor || 'white';
        const fixSpacerText = fixSpacer === 'black' ? 'Black' : fixSpacer === 'white' ? 'White' : 'Silver (Stainless Steel)';

        // ═══ DOOR FIELDS ═══
        const doorShape = fc.doorShape || 'standard';
        const doorType = fc.doorType || 'single-external';
        const isSliding = doorType === 'sliding';
        const isBifold = doorType === 'bifold';
        const isSlidingOrBifold = isSliding || isBifold;
        const doorStyle = fc.doorStyle || fc.doorPaneling || 'full-glass';
        const doorSideStyle = fc.sideStyle || 'full-glass';
        const doorHingeSide = fc.hingeSide || 'left';
        const doorOpenDirection = fc.openDirection || 'outward';
        const doorLockType = fc.lockType || 'multipoint';
        const doorThreshold = fc.threshold || 'standard';
        const doorThresholdExtension = fc.thresholdExtension || 0;

        // Sliding-specific
        const slidingPanelCount = fc.panelCount || 2;
        const slidingExtraWidth = fc.extraWidth || false;
        const slidingDirection = fc.slideDirection || 'left-to-right';
        const slidingGlassWidth = fc.glassWidth || 0;
        const slidingPanelWidth = fc.panelWidth || 0;
        const slidingPanelDepth = fc.panelDepth || 57;
        const slidingFrameDepth = fc.frameDepth || 93;
        const slidingDirLabels = { 'left-to-right': 'Left → Right (exterior view)', 'right-to-left': 'Right → Left (exterior view)', 'from-center': 'Open from Center (exterior view)', 'from-sides': 'Open from Sides (exterior view)' };
        const slidingDirText = slidingDirLabels[slidingDirection] || 'Left → Right';
        const slidingTypeText = isSliding ? ('Sliding Door — ' + slidingPanelCount + ' Panels' + (slidingExtraWidth ? ' (Extra Width)' : '')) : '';

        // Bi-fold specific fields
        const bifoldFoldDirection = fc.foldDirection || 'left';
        const bifoldTrafficDoor = fc.trafficDoor || 'no';
        const bifoldOpenDirection = fc.bifoldOpenDirection || fc.openDirection || 'outward';
        const bifoldFoldText = (bifoldFoldDirection === 'left' ? 'Fold Left' : 'Fold Right') + ' (exterior view)';
        const bifoldTrafficText = bifoldTrafficDoor === 'yes' ? 'Yes' : 'No';
        const bifoldOpenText = bifoldOpenDirection === 'outward' ? 'Outward' : 'Inward';
        const bifoldTypeText = isBifold ? ('Bi-Fold Door — ' + (fc.panelCount || 2) + ' Panels') : '';
        const bifoldPanelWidth = fc.panelWidth || 0;
        const bifoldPanelDepth = 65;
        const bifoldFrameDepth = 95;
        const doorSillWider = fc.sillWider || false;
        const doorSidePanels = fc.sidePanels || 'none';
        const doorTransomType = fc.transomType || 'none';
        const doorTransomHeight = fc.transomHeight || 450;
        const doorTransomBars = fc.transomBars || 'none';
        let doorTransomText = '';
        if ((doorType === 'french' || doorType === 'front-door') && doorTransomType !== 'none') {
            doorTransomText = (doorTransomType === 'opening' ? 'Opening (Top-Hung)' : 'Fixed') + ' \u00b7 ' + doorTransomHeight + 'mm'
                + (doorTransomBars === 'match' ? ' \u00b7 Bars: match door' : '');
        }
        const doorSideLeftWidth = fc.sideLeftWidth || 500;
        const doorSideRightWidth = fc.sideRightWidth || 500;
        const doorHBars = fc.hBars || fc.doorHBars || 0;
        const doorVBars = fc.vBars || fc.doorVBars || 0;
        const doorSideHBars = fc.sideHBars || 0;
        const doorSideVBars = fc.sideVBars || 0;

        const doorThresholdLabels = { 'standard': 'Standard Hardwood', 'aluminium': 'Aluminium', 'low-profile': 'Low Profile (Wheelchair)' };
        const doorShapeLabels = { 'standard': 'Standard', 'arched': 'Arched', 'glazed-arch': 'Glazed Arch' };
        const doorStyleLabels = { 'full-glass': 'Full Glass', 'three-quarter': '¾ Glass', 'half-glazed': 'Half Glass' };
        const doorPanelingLabels = { 'flat': 'Flat', 'panel': 'Recessed Panel', 'beading': 'Beading', 'bespoke': 'Bespoke' };
        const doorSideStyleLabels = { 'full-glass': 'Full Glass', 'same': 'Same as Door' };
        const doorShapeText = doorShapeLabels[doorShape] || 'Standard';
        const doorStyleText = doorStyleLabels[doorStyle] || 'Full Glass';
        const doorPaneling = fc.doorPaneling || 'flat';
        const doorPanelingText = doorPanelingLabels[doorPaneling] || 'Flat';
        const doorCenterMullion = fc.centerMullion || false;
        const doorSideStyleText = doorSideStyleLabels[doorSideStyle] || 'Full Glass';

        let doorBarsText = 'None';
        if (doorHBars > 0 || doorVBars > 0) doorBarsText = doorHBars + 'H × ' + doorVBars + 'V';
        let doorSideBarsText = '';
        if (doorSidePanels !== 'none' && (doorSideHBars > 0 || doorSideVBars > 0)) doorSideBarsText = doorSideHBars + 'H × ' + doorSideVBars + 'V';
        let doorPanelsText = '';
        if (doorSidePanels !== 'none') {
            const parts = [];
            if (doorSidePanels === 'left' || doorSidePanels === 'both') parts.push('Left ' + doorSideLeftWidth + 'mm');
            if (doorSidePanels === 'right' || doorSidePanels === 'both') parts.push('Right ' + doorSideRightWidth + 'mm');
            doorPanelsText = parts.join(' + ');
        }
        let doorThresholdText = doorThresholdLabels[doorThreshold] || 'Standard Hardwood';
        if (doorThreshold === 'standard' && doorThresholdExtension > 0) doorThresholdText += ' (+' + doorThresholdExtension + 'mm ext)';
        if (doorSillWider) doorThresholdText += ' (wider)';

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
            casementLayout, casementType, casArchShape, casArchHinge, casementTypeText, casementSectionsText,
            casementHBars, casementVBars, casementBarsText,
            sillExtension, sillText, trickleVent, trickleColour, trickleText,
            sealColour, safetyGlass, safetyGlassText,
            glassSpecCasement, glassSpecCasementText, fanlightHeight,
            casementFanHBars: (['021','031','032','052L','052R','022','131','132','133','013','023'].includes(fc.casementLayout || fc.layout || '')) ? Math.min(2, fc.casementFanHBars || 0) : 0, casementFanVBars: (['021','031','032','052L','052R','022','131','132','133','013','023'].includes(fc.casementLayout || fc.layout || '')) ? Math.min(2, fc.casementFanVBars || 0) : 0,
            casementFan2Height: (['013','023'].includes(fc.casementLayout || fc.layout || '')) ? (parseInt(fc.casementFan2Height) || 0) : 0,
            casementFan2HBars: (['013','023'].includes(fc.casementLayout || fc.layout || '')) ? Math.min(2, fc.casementFan2HBars || 0) : 0, casementFan2VBars: (['013','023'].includes(fc.casementLayout || fc.layout || '')) ? Math.min(2, fc.casementFan2VBars || 0) : 0,
            fixShape, fixType, fixCircleBarPattern, fixCircleOffset, fixTypeText, fixBarsFull, fixSpacer, fixSpacerText,
            doorType, doorHingeSide, doorOpenDirection, doorLockType,
            doorThreshold, doorThresholdExtension, doorSillWider, doorThresholdText,
            doorSidePanels, doorSideLeftWidth, doorSideRightWidth, doorPanelsText, doorTransomText,
            doorHBars, doorVBars, doorBarsText, doorSideHBars, doorSideVBars, doorSideBarsText,
            doorShape, doorShapeText, doorStyle, doorStyleText, doorSideStyle, doorSideStyleText,
            doorPaneling, doorPanelingText, doorCenterMullion,
            isSliding, isBifold, isSlidingOrBifold,
            slidingPanelCount, slidingExtraWidth, slidingDirection, slidingDirText,
            slidingGlassWidth, slidingPanelWidth, slidingPanelDepth, slidingFrameDepth, slidingTypeText,
            bifoldFoldDirection, bifoldTrafficDoor, bifoldOpenDirection,
            bifoldFoldText, bifoldTrafficText, bifoldOpenText, bifoldTypeText,
            bifoldPanelWidth, bifoldPanelDepth, bifoldFrameDepth
        };
    }

    // ─── Render full estimate modal content ───
    // options: { isEditable, isAdmin, adminCallbacks, closeCallback, renameCallback, deleteCallback }
    static renderEstimateHTML(estimate, options = {}) {
        const R = EstimateRenderer;
        if (estimate && estimate.estimate_items) estimate.estimate_items = R.sortWindowItems(estimate.estimate_items);
        const isEditable = options.isEditable ?? (estimate.status === 'sent');
        const isAdmin = options.isAdmin ?? false;
        // Editing a finished order is allowed so 3D can be regenerated, but the
        // window itself must not be removable - it has been made and delivered.
        const hideDelete = options.hideDelete ?? false;

        // Customer info
        const customer = estimate.customers || {};
        const customerName = customer.full_name || 'Valued Client';

        // Read additional services from DB (loaded by dashboard before calling render)
        const extras = estimate.extras || [];
        const installationExtras = extras.filter(e => e.type === 'installation');
        const deliveryExtras = extras.filter(e => e.type === 'delivery');
        const customExtras = extras.filter(e => e.type === 'custom');
        const hasInstallation = installationExtras.length > 0;
        const hasDelivery = deliveryExtras.length > 0;
        const hasAnyExtras = extras.length > 0;

        const items = estimate.estimate_items || [];
        const totalEx = items.reduce((s, i) => s + parseFloat(i.total_price || 0), 0);
        const installationTotal = installationExtras.reduce((s, e) => s + parseFloat(e.total_price || 0), 0);
        const deliveryTotal = deliveryExtras.reduce((s, e) => s + parseFloat(e.total_price || 0), 0);

        // Payment: windows 50/50, installation 50/50 (separate), delivery 100% after
        const windowsHalf = totalEx / 2;
        const installationHalf = installationTotal / 2;

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
                        <span style="font-family:'Jost',sans-serif;font-size:.85rem;font-weight:500;letter-spacing:.15em;text-transform:uppercase;color:#fff;">${p.windowType === 'door' ? 'Door' : 'Window'} ${item.window_number}</span>
                        ${isEditable ? `
                        <button onclick="window.open('online-estimate.html?edit=${item.id}&estimate=${estimate.id}','_blank')" style="background:transparent;border:1px solid rgba(100,180,100,.4);color:rgba(100,180,100,.8);font-family:'Jost',sans-serif;font-size:.55rem;letter-spacing:.1em;text-transform:uppercase;padding:.2rem .5rem;cursor:pointer;border-radius:2px;">Edit</button>
                        ${!isAdmin ? `
                        <button onclick="dashboard.renameWindow('${item.id}','${(item.window_number || '').replace(/'/g, "\\'")}','${estimate.id}')" style="background:transparent;border:1px solid rgba(255,255,255,.25);color:rgba(255,255,255,.6);font-family:'Jost',sans-serif;font-size:.55rem;letter-spacing:.1em;text-transform:uppercase;padding:.2rem .5rem;cursor:pointer;border-radius:2px;">Rename</button>
                        ` : ''}
                        ${hideDelete ? '' : `<button onclick="EstimateRenderer.deleteItem('${item.id}','${estimate.id}')" style="background:transparent;border:1px solid rgba(220,80,80,.4);color:rgba(220,80,80,.7);font-family:'Jost',sans-serif;font-size:.55rem;letter-spacing:.1em;text-transform:uppercase;padding:.2rem .5rem;cursor:pointer;border-radius:2px;">Delete</button>`}
                        <button onclick="EstimateRenderer.refreshEstimate()" style="background:transparent;border:1px solid rgba(100,180,255,.4);color:rgba(100,180,255,.8);font-family:'Jost',sans-serif;font-size:.55rem;letter-spacing:.1em;text-transform:uppercase;padding:.2rem .5rem;cursor:pointer;border-radius:2px;">🔄</button>
                        ` : ''}
                    </div>
                    <span style="font-family:'Jost',sans-serif;font-size:.72rem;color:rgba(255,255,255,.5);">Qty: ${p.quantity} · £${R.formatPrice(item.total_price)}</span>
                </div>

                <div style="padding:1.25rem;">
                ${(() => {
                    const _lblIn = p.windowType === 'door' ? 'Exterior View' : 'Interior View';
                    const _lblEx = p.windowType === 'door' ? 'Interior View' : 'Exterior View';
                    const _boxes = [];
                    const _v3dBtn = R.viewer3dButton(item, p);
                    if (screenshots?.interior) _boxes.push(`<div style="min-width:0;">${R.visualBox(_lblIn, R.visualImage(screenshots.interior))}${_v3dBtn}</div>`);
                    if (screenshots?.exterior) _boxes.push(`<div style="min-width:0;">${R.visualBox(_lblEx, R.visualImage(screenshots.exterior))}${screenshots?.interior ? '' : _v3dBtn}</div>`);
                    const _drawing = R.visualBox('Technical Drawing', svg, '#FAFAF8', '12px');
                    const _rowStyle = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,300px));gap:.9rem;margin-bottom:1rem;justify-content:start;';
                    // 2 renders on top, drawing next to the spec below; with a single
                    // render the drawing moves up so no cell is left empty.
                    if (_boxes.length >= 2) {
                        return `<div style="${_rowStyle}">${_boxes[0]}${_boxes[1]}</div>`
                             + `<div style="display:grid;grid-template-columns:minmax(0,300px) minmax(0,1fr);gap:1.4rem;align-items:start;">${_drawing}`;
                    }
                    if (_boxes.length === 1) {
                        return `<div style="${_rowStyle}">${_boxes[0]}${_drawing}</div>`
                             + `<div style="display:grid;grid-template-columns:minmax(0,1fr);">`;
                    }
                    return `<div style="display:grid;grid-template-columns:minmax(0,300px) minmax(0,1fr);gap:1.4rem;align-items:start;">${_drawing}`;
                })()}
                    <div style="min-width:0;">
                        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.3rem 1.3rem;">
                            ${p.windowType === 'casement' ? `
                            ${R.specRow('Type', p.casementTypeText)}
                            ${R.specRow('Dimensions', p.width + 'mm × ' + p.height + 'mm')}
                            ${p.fanlightHeight > 0 ? R.specRow('Transom Axis (from frame top)', p.fanlightHeight + 'mm') : ''}
                            ${p.casementSectionsText ? R.specRow('Light Sections', p.casementSectionsText) : ''}
                            ${p.casementFan2Height > 0 ? R.specRow('Transom 2 Axis (from frame top)', p.casementFan2Height + 'mm') : ''}
                            ${(p.casementFan2HBars > 0 || p.casementFan2VBars > 0) ? R.specRow('Fanlight 2 Bars', p.casementFan2HBars + ' horizontal, ' + p.casementFan2VBars + ' vertical (per pane)') : ''}
                            ${(p.casementFanHBars > 0 || p.casementFanVBars > 0) ? R.specRow('Fanlight Bars', p.casementFanHBars + ' horizontal, ' + p.casementFanVBars + ' vertical (per fan pane)') : ''}
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
                            ` : p.windowType === 'door' ? `
                            ${R.specRow('Type', p.isSliding ? p.slidingTypeText : (p.isBifold ? p.bifoldTypeText : (p.doorType === 'french' ? 'French Doors' : (p.doorType === 'front-door' ? 'Front Door' : 'Single Patio Door'))))}
                            ${p.isSlidingOrBifold ? '' : R.specRow('Shape', p.doorShapeText)}
                            ${p.isSliding ? '' : R.specRow('Style', p.doorStyleText)}
                            ${p.doorStyle !== 'full-glass' ? R.specRow('Paneling', p.doorPanelingText) : ''}
                            ${p.doorStyle !== 'full-glass' ? R.specRow('Center Mullion', p.doorCenterMullion ? 'Yes' : 'No') : ''}
                            ${R.specRow('Dimensions', p.width + 'mm × ' + p.height + 'mm')}
                            ${!p.isSlidingOrBifold && p.doorPanelsText ? R.specRow('Side Panels', p.doorPanelsText) : ''}
                            ${!p.isSlidingOrBifold && p.doorSidePanels !== 'none' ? R.specRow('Side Panel Style', p.doorSideStyleText) : ''}
                            ${p.doorTransomText ? R.specRow('Transom', p.doorTransomText) : ''}
                            ${p.isSliding ? R.specRow('Slide Direction', p.slidingDirText) : (p.isBifold ? R.specRow('Fold Direction', p.bifoldFoldText) : R.specRow('Open First', p.doorHingeSide === 'right' ? 'Left' : 'Right'))}
                            ${p.isBifold ? R.specRow('Traffic Door', p.bifoldTrafficText) : ''}
                            ${p.isSliding ? R.specRow('Panel Size', p.slidingPanelWidth + 'mm × ' + p.slidingPanelDepth + 'mm') : (p.isBifold ? R.specRow('Panel Size', p.bifoldPanelWidth + 'mm × ' + p.bifoldPanelDepth + 'mm') : R.specRow('Opening', p.doorOpenDirection === 'outward' ? 'Outward' : 'Inward'))}
                            ${p.isBifold ? R.specRow('Opening', p.bifoldOpenText) : ''}
                            ${p.isSliding ? R.specRow('Frame Depth', p.slidingFrameDepth + 'mm') : (p.isBifold ? R.specRow('Frame Depth', p.bifoldFrameDepth + 'mm') : R.specRow('Threshold', p.doorThresholdText))}
                            ${R.specRow('Glass', p.glassText)}
                            ${R.specRow('Glass Finish', p.glassFinishText)}
                            ${R.specRow('Spacer Bar', p.spacerText)}
                            ${R.specRow('Colour', p.colorDisplay)}
                            ${R.specRow('Bars', p.doorBarsText)}
                            ${!p.isSlidingOrBifold && p.doorSideBarsText ? R.specRow('Panel Bars', p.doorSideBarsText) : ''}
                            ${p.isSlidingOrBifold ? '' : R.specRow('Lock', p.doorLockType === 'deadbolt' ? 'Deadbolt' : 'Multipoint Lock')}
                            ${p.hardwareFinish ? R.specRow('Hardware Finish', p.hardwareFinish) : ''}
                            ${R.specRow('Safety Glass', p.safetyGlassText)}
                            ${R.specRow('Seal Colour', p.sealColour.charAt(0).toUpperCase() + p.sealColour.slice(1))}
                            ${R.specRow('Trickle Vent', p.trickleText)}
                            ${p.isSlidingOrBifold && p.sillExtension !== 'none' ? R.specRow('Sill Extension', p.sillText + (p.doorSillWider ? ' (wider)' : '')) : ''}
                            ` : `
                            ${p.sashType !== 'double' ? R.specRow('Window Type', p.sashType === 'triple' ? 'Triple Sash' : p.sashType) : ''}
                            ${p.headType === 'arch' ? R.specRow('Head Type', 'Glazing Arch') : ''}
                            ${p.sashType === 'triple' ? R.specRow('Split Ratio', p.splitRatio) : ''}
                            ${p.measurementType === 'brick-to-brick' 
                                ? R.specRow('Structural Opening', p.originalWidth + 'mm × ' + p.originalHeight + 'mm') + R.specRow('Window Size (Frame)', p.width + 'mm × ' + p.height + 'mm')
                                : R.specRow('Window Size (Frame)', p.width + 'mm × ' + p.height + 'mm')}
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
                            ${p.measurementType === 'brick-to-brick' ? '<div style="margin:10px 0 4px;padding:8px 12px;background:#f0f4ff;border:1px solid #90a4c4;border-radius:4px;font-size:12px;color:#2d3748;line-height:1.4;">ℹ Frame overlaps brickwork by 150mm (W) and 75mm (H). We recommend a visit from a surveyor or contractor before ordering.</div>' : ''}
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
            const typeShort = p.windowType === 'door' ? 'Door'
                : p.windowType === 'casement' ? 'Casement'
                : p.windowType === 'fix-only' ? 'Fix Frame'
                : p.sashType === 'triple' ? 'Triple Sash'
                : p.sashType === 'single' ? 'Single Sash'
                : 'Sash';
            const desc = `${typeShort} · ${p.width}×${p.height}mm · ${p.colorDisplay || '-'}`;
            return `
                <tr>
                    <td style="padding:.6rem 1rem;border-bottom:1px solid ${BORDER};">${it.window_number || String(idx + 1).padStart(2, '0')}</td>
                    <td style="padding:.6rem 1rem;border-bottom:1px solid ${BORDER};">${desc}</td>
                    <td style="padding:.6rem 1rem;border-bottom:1px solid ${BORDER};text-align:center;">${p.quantity || 1}</td>
                    <td style="padding:.6rem 1rem;border-bottom:1px solid ${BORDER};text-align:right;font-weight:500;color:var(--navy);">£${R.formatPrice(it.total_price || 0)}</td>
                </tr>
            `;
        }).join('');

        // Additional Services rows (dynamic from DB extras)
        const extraRow = (label, desc, qty, amount, idx, extraId) => `
            <tr>
                <td style="padding:.6rem 1rem;border-bottom:1px solid ${BORDER};vertical-align:top;">${idx}</td>
                <td style="padding:.6rem 1rem;border-bottom:1px solid ${BORDER};">
                    <div style="font-weight:500;color:var(--navy);">${label}</div>
                    ${desc ? `<div style="font-size:.72rem;color:var(--muted);font-style:italic;margin-top:.15rem;">${desc}</div>` : ''}
                </td>
                <td style="padding:.6rem 1rem;border-bottom:1px solid ${BORDER};text-align:center;vertical-align:top;">${qty}</td>
                <td style="padding:.6rem 1rem;border-bottom:1px solid ${BORDER};text-align:right;font-weight:500;color:var(--navy);vertical-align:top;">£${R.formatPrice(amount)}</td>
                ${isAdmin ? `<td style="padding:.6rem 1rem;border-bottom:1px solid ${BORDER};text-align:center;vertical-align:top;white-space:nowrap;">
                    <button onclick="adminEditExtra('${extraId}')" style="background:transparent;border:1px solid rgba(10,22,40,.3);color:var(--navy);font-family:'Jost',sans-serif;font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;padding:.25rem .6rem;cursor:pointer;border-radius:2px;margin-right:.3rem;">Edit</button>
                    <button onclick="adminDeleteExtra('${extraId}')" style="background:transparent;border:1px solid rgba(220,80,80,.4);color:rgba(220,80,80,.8);font-family:'Jost',sans-serif;font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;padding:.25rem .6rem;cursor:pointer;border-radius:2px;">Delete</button>
                </td>` : ''}
            </tr>
        `;

        let extrasRowIdx = 1;
        const extrasRows = [
            ...installationExtras.map(e => extraRow(e.name, e.description, e.quantity, e.total_price, `I-${String(extrasRowIdx++).padStart(2, '0')}`, e.id)),
            ...deliveryExtras.map(e => extraRow(e.name, e.description, e.quantity, e.total_price, `D-${String(extrasRowIdx++).padStart(2, '0')}`, e.id)),
            ...customExtras.map(e => extraRow(e.name, e.description, e.quantity, e.total_price, `X-${String(extrasRowIdx++).padStart(2, '0')}`, e.id))
        ].join('');

        const extrasTotalAll = installationTotal + deliveryTotal + customExtras.reduce((s, e) => s + parseFloat(e.total_price || 0), 0);

        // Admin: "+ Add Extra" inline form (hidden by default)
        // Installation and delivery are priced per window type, so they are added
        // by the SAME EstimateExtras methods the customer flow uses - typing them
        // by hand would mean maintaining a second set of prices.
        const quickBtn = (label, fn, already) => already
            ? `<button disabled style="background:transparent;border:1px solid ${BORDER};color:var(--muted);padding:.5rem 1rem;font-family:'Jost',sans-serif;font-size:.72rem;letter-spacing:.15em;text-transform:uppercase;border-radius:2px;cursor:default;">${label} — added</button>`
            : `<button onclick="${fn}" style="background:transparent;border:1px solid var(--navy);color:var(--navy);padding:.5rem 1rem;font-family:'Jost',sans-serif;font-size:.72rem;letter-spacing:.15em;text-transform:uppercase;cursor:pointer;border-radius:2px;">+ ${label}</button>`;

        const adminExtrasControlsHTML = isAdmin ? `
            <div style="margin-top:1rem;display:flex;gap:.5rem;flex-wrap:wrap;">
                <button onclick="adminToggleExtraForm(true)" id="admin-add-extra-btn" style="background:var(--navy);color:#fff;border:none;padding:.5rem 1rem;font-family:'Jost',sans-serif;font-size:.72rem;letter-spacing:.15em;text-transform:uppercase;cursor:pointer;border-radius:2px;">+ Add Extra</button>
                ${quickBtn('Installation', 'adminAddInstallation()', hasInstallation)}
                ${quickBtn('Delivery', 'adminAddDelivery()', hasDelivery)}
            </div>
            <div id="admin-extra-form" style="display:none;margin-top:1rem;padding:1.2rem 1.4rem;background:${CREAM_LIGHT};border:1px solid ${BORDER};">
                <h4 style="font-family:'Cormorant Garamond',serif;font-weight:700;color:var(--navy);font-size:1rem;margin:0 0 .8rem;">Add Custom Extra</h4>
                <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:.6rem;margin-bottom:.6rem;">
                    <input id="admin-extra-name" type="text" placeholder="Name (e.g. Crane rental)" style="padding:.5rem .7rem;border:1px solid ${BORDER};font-family:'Jost',sans-serif;font-size:.82rem;" />
                    <input id="admin-extra-qty" type="number" min="1" value="1" placeholder="Qty" style="padding:.5rem .7rem;border:1px solid ${BORDER};font-family:'Jost',sans-serif;font-size:.82rem;" />
                    <input id="admin-extra-price" type="number" min="0" step="0.01" placeholder="Unit price" style="padding:.5rem .7rem;border:1px solid ${BORDER};font-family:'Jost',sans-serif;font-size:.82rem;" />
                </div>
                <div style="display:grid;grid-template-columns:2fr 1fr;gap:.6rem;margin-bottom:.8rem;">
                    <input id="admin-extra-desc" type="text" placeholder="Description (optional)" style="padding:.5rem .7rem;border:1px solid ${BORDER};font-family:'Jost',sans-serif;font-size:.82rem;" />
                    <select id="admin-extra-timing" style="padding:.5rem .7rem;border:1px solid ${BORDER};font-family:'Jost',sans-serif;font-size:.82rem;background:#fff;">
                        <option value="on_completion" selected>Payable on completion</option>
                        <option value="with_deposit">With deposit</option>
                        <option value="with_balance">With balance</option>
                        <option value="on_delivery">On delivery</option>
                    </select>
                </div>
                <div style="display:flex;gap:.6rem;">
                    <button onclick="adminAddExtra()" style="background:var(--navy);color:#fff;border:none;padding:.5rem 1rem;font-family:'Jost',sans-serif;font-size:.72rem;letter-spacing:.15em;text-transform:uppercase;cursor:pointer;border-radius:2px;">Save</button>
                    <button onclick="adminToggleExtraForm(false)" style="background:transparent;border:1px solid ${BORDER};color:var(--muted);padding:.5rem 1rem;font-family:'Jost',sans-serif;font-size:.72rem;letter-spacing:.15em;text-transform:uppercase;cursor:pointer;border-radius:2px;">Cancel</button>
                </div>
            </div>
        ` : '';

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
                            <td style="padding:.7rem 1rem;border-top:2px solid var(--navy);text-align:right;color:var(--navy);font-weight:500;">£${R.formatPrice(totalEx)} <span style="font-size:.7rem;font-weight:400;color:var(--muted);">+ VAT</span></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div style="margin:1.5rem 0;">
                <h3 style="font-family:'Cormorant Garamond',serif;font-weight:700;color:var(--navy);font-size:1.15rem;margin:0 0 .6rem;">Additional Services</h3>
                ${hasAnyExtras ? `
                <table style="width:100%;border-collapse:collapse;font-family:'Jost',sans-serif;font-size:.82rem;">
                    <thead>
                        <tr>
                            <th style="background:var(--navy);color:#fff;font-weight:400;letter-spacing:.15em;text-transform:uppercase;font-size:.65rem;padding:.55rem 1rem;text-align:left;">Item</th>
                            <th style="background:var(--navy);color:#fff;font-weight:400;letter-spacing:.15em;text-transform:uppercase;font-size:.65rem;padding:.55rem 1rem;text-align:left;">Description</th>
                            <th style="background:var(--navy);color:#fff;font-weight:400;letter-spacing:.15em;text-transform:uppercase;font-size:.65rem;padding:.55rem 1rem;text-align:center;">Qty</th>
                            <th style="background:var(--navy);color:#fff;font-weight:400;letter-spacing:.15em;text-transform:uppercase;font-size:.65rem;padding:.55rem 1rem;text-align:right;">Price</th>
                            ${isAdmin ? `<th style="background:var(--navy);color:#fff;font-weight:400;letter-spacing:.15em;text-transform:uppercase;font-size:.65rem;padding:.55rem 1rem;text-align:center;width:1%;">Actions</th>` : ''}
                        </tr>
                    </thead>
                    <tbody>${extrasRows}</tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3" style="padding:.7rem 1rem;border-top:2px solid var(--navy);text-align:right;font-weight:500;color:var(--navy);">Subtotal — Additional Services</td>
                            <td style="padding:.7rem 1rem;border-top:2px solid var(--navy);text-align:right;color:var(--navy);font-weight:500;">£${R.formatPrice(extrasTotalAll)} <span style="font-size:.7rem;font-weight:400;color:var(--muted);">+ VAT</span></td>
                            ${isAdmin ? `<td style="padding:.7rem 1rem;border-top:2px solid var(--navy);"></td>` : ''}
                        </tr>
                    </tfoot>
                </table>
                ` : `
                <div style="padding:1rem 1.3rem;background:${CREAM_LIGHT};border-left:3px solid ${BORDER};font-family:'Jost',sans-serif;font-size:.82rem;color:var(--muted);line-height:1.55;">
                    No additional services selected. Installation and delivery can be added to this estimate.
                </div>
                `}
                ${adminExtrasControlsHTML}
            </div>

            <div style="margin:1rem 0 2rem;padding:.8rem 1.2rem;background:#fff8ed;border-left:3px solid ${GOLD};font-family:'Jost',sans-serif;font-size:.75rem;color:var(--muted);line-height:1.55;">
                <strong style="color:var(--navy);">All prices exclude VAT.</strong> VAT will be applied at the applicable rate (0%, 5%, or 20%) depending on your property status and project type. The correct rate will be confirmed prior to invoicing.
            </div>
        `;

        // Payment Schedule — dynamic cards based on what's selected
        // I. Deposit 50%, II. Balance 50% (both on windows + installation if selected)
        // III. Installation (only if installation selected) — 100% after installation
        // IV. Delivery (only if delivery selected) — 100% on delivery
        const paymentCard = (roman, label, percent, amount, note, highlight = false) => `
            <div style="border:1px solid ${BORDER};padding:1.2rem;position:relative;${highlight ? 'background:#fbfaf7;' : ''}">
                <div style="position:absolute;top:.5rem;right:.8rem;font-family:'Cormorant Garamond',serif;font-weight:700;font-size:2.2rem;color:#D4D4C8;line-height:1;">${roman}</div>
                <div style="font-family:'Jost',sans-serif;font-weight:500;letter-spacing:.2em;text-transform:uppercase;font-size:.6rem;color:var(--muted);margin-bottom:.4rem;">${label}</div>
                <div style="font-family:'Cormorant Garamond',serif;font-weight:700;font-size:1.6rem;color:var(--navy);line-height:1;margin-bottom:.5rem;">${percent}</div>
                <div style="font-family:'Jost',sans-serif;font-weight:500;font-size:.9rem;color:${GOLD};margin-bottom:.5rem;">£${R.formatPrice(amount)} <span style="font-size:.65rem;font-weight:400;color:var(--muted);">+ VAT</span></div>
                <div style="font-family:'Jost',sans-serif;font-weight:300;font-size:.7rem;color:var(--muted);line-height:1.55;">${note}</div>
            </div>
        `;

        // Group custom extras by payment_timing
        const customByTiming = {
            with_deposit: customExtras.filter(e => e.payment_timing === 'with_deposit'),
            with_balance: customExtras.filter(e => e.payment_timing === 'with_balance'),
            on_delivery: customExtras.filter(e => e.payment_timing === 'on_delivery'),
            on_completion: customExtras.filter(e => !e.payment_timing || e.payment_timing === 'on_completion')
        };
        const sumTiming = (list) => list.reduce((s, e) => s + parseFloat(e.total_price || 0), 0);
        const customDepositAdd = sumTiming(customByTiming.with_deposit);
        const customBalanceAdd = sumTiming(customByTiming.with_balance);
        const customDeliveryAdd = sumTiming(customByTiming.on_delivery);

        const listIncludes = (list) => list.length ? ` Includes: ${list.map(e => `${e.name} £${R.formatPrice(e.total_price)}`).join(', ')}.` : '';

        // Windows: 50/50 split (live) OR frozen deposit + flowing balance (after deposit paid).
        const depCalc = R.computeDeposit(estimate, totalEx, windowsHalf, customDepositAdd, customBalanceAdd);
        const depositAmount = depCalc.depositVal;
        const balanceAmount = depCalc.balanceVal;
        const depositLockedHtml = depCalc.locked;
        const deliveryAmount = deliveryTotal + customDeliveryAdd;

        const depositIncludes = listIncludes(customByTiming.with_deposit);
        const balanceIncludes = listIncludes(customByTiming.with_balance);
        const deliveryIncludes = listIncludes(customByTiming.on_delivery);

        // Roman numeral generator
        const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
        let romanIdx = 0;
        const nextRoman = () => romans[romanIdx++] || `${romanIdx}`;

        const paymentCards = [
            paymentCard(nextRoman(), 'Windows Deposit', depositLockedHtml ? 'PAID' : '50%', depositAmount, depositLockedHtml ? `Deposit paid and confirmed. This amount is fixed and will not change.${depositIncludes}` : `Non-refundable deposit upon acceptance. Secures the order and reserves workshop capacity. Calculated on windows only.${depositIncludes}`, depositLockedHtml),
            paymentCard(nextRoman(), 'Windows Balance', depositLockedHtml ? '50% +/- adjustment' : '50%', balanceAmount, depositLockedHtml ? `Due prior to dispatch. Adjusted up or down after the on-site survey. Windows will not leave the workshop until full payment is received.${balanceIncludes}` : `Due prior to dispatch. Windows will not leave the workshop until full payment is received.${balanceIncludes}`),
            hasInstallation ? paymentCard(nextRoman(), 'Installation Deposit', '50%', installationHalf, 'Due before installation begins. Secures the installation date and covers scheduling.') : '',
            hasInstallation ? paymentCard(nextRoman(), 'Installation Balance', '50%', installationHalf, 'Payable after installation is completed on site.', true) : '',
            (hasDelivery || customDeliveryAdd > 0) ? paymentCard(nextRoman(), 'Delivery', '100%', deliveryAmount, `Payable upon delivery to site. Separate from windows schedule.${deliveryIncludes}`, true) : '',
            // Each on_completion custom extra = own card
            ...customByTiming.on_completion.map(e => paymentCard(nextRoman(), e.name, '100%', e.total_price, `${e.description ? e.description + '. ' : ''}Payable on completion.`, true))
        ].filter(Boolean);

        const numCards = paymentCards.length;
        const paymentGridCols = numCards === 1 ? '1fr'
            : numCards === 2 ? '1fr 1fr'
            : numCards === 3 ? '1fr 1fr 1fr'
            : numCards === 4 ? '1fr 1fr 1fr 1fr'
            : 'repeat(auto-fit, minmax(180px, 1fr))';

        const paymentHTML = `
            <div style="margin:2rem 0;">
                <h2 style="font-family:'Cormorant Garamond',serif;font-weight:700;color:var(--navy);font-size:1.5rem;margin:0 0 .8rem;">Payment Schedule</h2>
                <div style="margin:0 0 1rem;padding:.8rem 1.2rem;background:#fff8ed;border-left:3px solid ${GOLD};font-family:'Jost',sans-serif;font-size:.75rem;color:var(--muted);line-height:1.55;">
                    <strong style="color:var(--navy);">This is an estimate based on the measurements you provided.</strong> The final price is confirmed after our on-site survey and may be adjusted up or down.
                </div>
                <div style="display:grid;grid-template-columns:${paymentGridCols};gap:.8rem;">
                    ${paymentCards.join('')}
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

        // Store context for refresh BEFORE returning
        EstimateRenderer._lastEstimate = { id: estimate.id, isAdmin, isEditable };
        EstimateRenderer.setupAutoRefresh();

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
                    <button class="btn-sm btn-download-pdf" style="background:var(--navy);color:#fff;border:none;padding:.5rem 1rem;font-family:'Jost',sans-serif;font-size:.72rem;letter-spacing:.15em;text-transform:uppercase;cursor:pointer;">Download PDF</button>${isAdmin && estimate.share_token ? `<button class="btn-sm" onclick="navigator.clipboard.writeText(location.origin + \'/e/\' + \'${estimate.share_token}\').then(() => { this.textContent = \'Copied \u2713\'; setTimeout(() => this.textContent = \'Copy Client Link\', 1600); })" style="background:transparent;color:var(--navy);border:1px solid var(--navy);padding:.5rem 1rem;font-family:\'Jost\',sans-serif;font-size:.72rem;letter-spacing:.15em;text-transform:uppercase;cursor:pointer;">Copy Client Link</button>` : ''}
                </div>
            </div>

            ${customerHTML}

            ${estimate.delivery_address || estimate.notes ? `
            <div style="background:var(--cream2);padding:1.2rem 1.5rem;margin-bottom:2rem;border-left:3px solid var(--silver);">
                ${estimate.delivery_address ? `<div style="font-family:'Jost',sans-serif;font-size:.82rem;color:var(--muted);"><strong style="color:var(--navy);">Address:</strong> ${estimate.delivery_address}</div>` : ''}
                ${estimate.notes ? `<div style="font-family:'Jost',sans-serif;font-size:.82rem;color:var(--muted);margin-top:.3rem;"><strong style="color:var(--navy);">Notes:</strong> ${estimate.notes}</div>` : ''}
            </div>
            ` : ''}

            <div style="font-family:'Jost',sans-serif;font-size:.55rem;letter-spacing:.4em;text-transform:uppercase;color:var(--silver);margin:2rem 0 1rem;">Windows · ${items.length}</div>
            ${itemsHTML}

            ${summaryHTML}
            ${paymentHTML}
            ${termsHTML}

            ${aboutHTML}
            ${certificationsHTML}

            <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;padding-top:1.5rem;border-top:1px solid rgba(158,158,144,.15);">
                ${adminButtons}
                ${isEditable ? `<button class="btn-sm" onclick="window.open('online-estimate.html?estimate=${estimate.id}','_blank')" style="background:var(--navy);color:#fff;">+ Add Window</button>` : ''}
                <button class="btn-sm" onclick="EstimateRenderer.refreshEstimate()" style="background:#2a5a3a;color:#fff;">🔄 Refresh</button>
                <button class="btn-sm btn-download-pdf">Download PDF</button>
                <button class="btn-sm" id="download-estimate-excel">Download Excel</button>
                ${isAdmin && estimate.share_token ? `<button class="btn-sm" onclick="navigator.clipboard.writeText(location.origin + \'/e/\' + \'${estimate.share_token}\').then(() => { this.textContent = \'Copied \u2713\'; setTimeout(() => this.textContent = \'Copy Client Link\', 1600); })">Copy Client Link</button>` : ''}
                <button class="btn-sm" onclick="${closeAction}">Close</button>
            </div>

            <div style="padding:.9rem 1.2rem;margin:1.5rem 0 0;background:${CREAM_LIGHT};border-left:3px solid ${GOLD};font-family:'Jost',sans-serif;font-size:.78rem;color:var(--muted);line-height:1.55;">
                <strong style="color:var(--navy);font-weight:500;">Prime Sash Windows</strong> is a trading name of <strong style="color:var(--navy);font-weight:500;">Skylon Joinery Ltd</strong> — a London-based bespoke joinery company registered in England and Wales (Company No. 12946103). All contracts, invoices and payments are issued by Skylon Joinery Ltd.
            </div>
        `;
    }

    // ─── Refresh Estimate (re-fetch from DB) ───
    static async refreshEstimate() {
        const ctx = EstimateRenderer._lastEstimate;
        if (!ctx || !ctx.id) { console.warn('No estimate to refresh'); return; }

        try {
            // Fetch fresh estimate + items from Supabase
            const { data: estimate, error } = await window.supabaseClient
                .from('estimates')
                .select('*, estimate_items(*)')
                .eq('id', ctx.id)
                .single();

            if (error) throw error;

            // Try load extras
            try {
                if (typeof EstimateExtras !== 'undefined') {
                    estimate.extras = await EstimateExtras.load(ctx.id);
                }
            } catch (e) { estimate.extras = []; }

            // Find modal body (works for both admin and customer)
            const modalBody = document.getElementById('modal-body') ||
                              document.getElementById('order-detail-content');
            if (!modalBody) return;

            // Re-render
            const editableStatuses = ctx.isAdmin ? ['draft', 'sent', 'quoted', 'survey'] : ['draft', 'sent', 'quoted'];
            const isEditable = editableStatuses.includes(estimate.status);
            modalBody.innerHTML = EstimateRenderer.renderEstimateHTML(estimate, {
                isAdmin: ctx.isAdmin,
                isEditable: isEditable
            });

            // Re-attach export buttons
            EstimateRenderer.attachExportButtons(estimate);

            // Update cached data if admin (allEstimates array)
            if (ctx.isAdmin && typeof allEstimates !== 'undefined') {
                const idx = allEstimates.findIndex(e => e.id === ctx.id);
                if (idx !== -1) allEstimates[idx] = estimate;
            }
        } catch (err) {
            console.error('Refresh error:', err);
        }
    }

    // ─── Auto-refresh on tab focus ───
    static setupAutoRefresh() {
        if (EstimateRenderer._autoRefreshSetup) return;
        EstimateRenderer._autoRefreshSetup = true;

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && EstimateRenderer._lastEstimate) {
                // Check if modal is open
                const modal = document.getElementById('quote-modal') ||
                              document.getElementById('order-modal');
                if (modal && (modal.classList.contains('active') || modal.style.display !== 'none')) {
                    EstimateRenderer.refreshEstimate();
                }
            }
        });
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

    // ═══════════════════════════════════════════════════════════════
    // ═══ SASH SVG v2 — real-mm geometry (ported from Sash-Planner) ══
    // ═══════════════════════════════════════════════════════════════
    // All coordinates in true millimetres; viewBox scales the drawing,
    // so proportions are always correct. Line widths use
    // vector-effect:non-scaling-stroke (constant on screen & in PDF).

    static get SASH_GEO() {
        return {
            // Box frame (from workshop constants)
            jambBot: 86, jambTop: 102, headH: 102,
            sillNose: 33, sillWeatherbar: 46.5, sillDrip: 58,
            sillTop: 68, sillCurveTop: 94, bulge: 0.292123,
            // Sash sections
            stile: 57, topRail: 57, meetRail: 43, botRail: 90,
            // Derived deductions
            sashWDeduct: 178, sashHDeduct: 92, sashHDiff: 33,
            // Georgian bar
            barW: 22,
            // Triple sash mullion
            mullionW: 57,
            // Colours (Prime palette)
            navy: '#0A1628',
            frameFill: 'rgba(10,22,40,0.05)',
            glassFill: 'rgba(174,203,227,0.28)',
            glassStroke: 'rgba(10,22,40,0.25)',
            barFill: '#FAFAF8',
            dimRed: '#0A1628',   // dimension colour — navy (was red, poor legibility on cream)
            // Layout
            margin: 60, dimOffset: 55, refW: 700
        };
    }

    // Bulge arc: SVG path segment for the jamb→sill curve
    static sashBulgeArc(x1, y1, x2, y2, bulge) {
        if (Math.abs(bulge) < 1e-6) return `L ${x2} ${y2}`;
        const dx = x2 - x1, dy = y2 - y1;
        const chord = Math.sqrt(dx * dx + dy * dy);
        const sagitta = Math.abs(bulge) * chord / 2;
        const r = ((chord / 2) ** 2 + sagitta ** 2) / (2 * sagitta);
        const sweep = bulge > 0 ? 0 : 1;
        return `A ${r} ${r} 0 0 ${sweep} ${x2} ${y2}`;
    }

    // Horn profiles — verbatim from 3D HornMesh (types A & D)
    static get SASH_HORN_DEF() {
        return {
            A: { dropRaw: 84, segs: [
                ['M',0,80],['L',40,80],['L',40,68],['L',33,62],
                ['C',44,52,43,34,28,22],['C',16,12,15,6,27,0],
                ['L',22,-4],['L',0,-4],['Z']
            ]},
            D: { dropRaw: 80, segs: [
                ['M',0,80],['L',40,80],['L',40,64],['L',34,64],['L',34,56],
                ['C',34,42,30,16,18,0],['L',0,0],['Z']
            ]}
        };
    }

    static sashHornPath(type, sashX, sashW, topY, side, inset) {
        const def = EstimateRenderer.SASH_HORN_DEF[type] || EstimateRenderer.SASH_HORN_DEF.A;
        const HORN_BBOX_W = 40, HORN_W = 30, HORN_H = 70;
        const sX = HORN_W / HORN_BBOX_W;
        const sY = HORN_H / def.dropRaw;
        const X = (x) => (side === 'L' ? sashX + inset + x * sX : (sashX + sashW - inset) - x * sX);
        const Y = (y) => topY + (80 - y) * sY;
        return def.segs.map(s => {
            switch (s[0]) {
                case 'M': return `M ${X(s[1])} ${Y(s[2])}`;
                case 'L': return `L ${X(s[1])} ${Y(s[2])}`;
                case 'C': return `C ${X(s[1])} ${Y(s[2])} ${X(s[3])} ${Y(s[4])} ${X(s[5])} ${Y(s[6])}`;
                case 'Z': return 'Z';
                default: return '';
            }
        }).join(' ');
    }

    // Georgian bars as real 22mm timber bars (rects), equal division of glass.
    // Custom bars: mm positions measured from glass left (v) / glass top (h).
    static sashBarsSVG(glassX, glassY, glassW, glassH, pattern, customList) {
        const G = EstimateRenderer.SASH_GEO;
        const NS = 'vector-effect="non-scaling-stroke"';
        const barStyle = `fill="${G.barFill}" stroke="${G.navy}" stroke-width="0.6" ${NS}`;
        const defs = {'none':{h:0,v:0},'2x2':{h:0,v:1},'3x3':{h:0,v:2},'4x4':{h:1,v:1},'6x6':{h:1,v:2},'9x9':{h:2,v:2}};
        let svg = '';

        if (pattern === 'custom' && customList && customList.length > 0) {
            customList.forEach(bar => {
                const mm = parseFloat(bar.mm) || 0;
                if (bar.type === 'h' || bar.type === 'horizontal') {
                    const cy = glassY + mm;
                    if (cy > glassY + G.barW/2 && cy < glassY + glassH - G.barW/2) {
                        svg += `<rect x="${glassX}" y="${cy - G.barW/2}" width="${glassW}" height="${G.barW}" ${barStyle}/>`;
                    }
                } else {
                    const cx = glassX + mm;
                    if (cx > glassX + G.barW/2 && cx < glassX + glassW - G.barW/2) {
                        svg += `<rect x="${cx - G.barW/2}" y="${glassY}" width="${G.barW}" height="${glassH}" ${barStyle}/>`;
                    }
                }
            });
            return svg;
        }

        const p = defs[pattern] || defs.none;
        for (let i = 1; i <= p.v; i++) {
            const cx = glassX + glassW * i / (p.v + 1);
            svg += `<rect x="${cx - G.barW/2}" y="${glassY}" width="${G.barW}" height="${glassH}" ${barStyle}/>`;
        }
        for (let j = 1; j <= p.h; j++) {
            const cy = glassY + glassH * j / (p.h + 1);
            svg += `<rect x="${glassX}" y="${cy - G.barW/2}" width="${glassW}" height="${G.barW}" ${barStyle}/>`;
        }
        return svg;
    }

    // Red dimension line — horizontal (below drawing)
    static sashDimH(y, x1, x2, extFrom, label, fs) {
        const G = EstimateRenderer.SASH_GEO;
        const NS = 'vector-effect="non-scaling-stroke"';
        const t = fs * 0.35, over = fs * 0.55, gap = fs * 0.45;
        let svg = '';
        svg += `<line x1="${x1}" y1="${extFrom}" x2="${x1}" y2="${y + over}" stroke="${G.dimRed}" stroke-width="0.6" stroke-dasharray="5,4" ${NS}/>`;
        svg += `<line x1="${x2}" y1="${extFrom}" x2="${x2}" y2="${y + over}" stroke="${G.dimRed}" stroke-width="0.6" stroke-dasharray="5,4" ${NS}/>`;
        svg += `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${G.dimRed}" stroke-width="1.3" ${NS}/>`;
        svg += `<line x1="${x1}" y1="${y - t}" x2="${x1}" y2="${y + t}" stroke="${G.dimRed}" stroke-width="1.3" ${NS}/>`;
        svg += `<line x1="${x2}" y1="${y - t}" x2="${x2}" y2="${y + t}" stroke="${G.dimRed}" stroke-width="1.3" ${NS}/>`;
        svg += `<text x="${(x1 + x2) / 2}" y="${y - gap}" fill="${G.dimRed}" font-family="Jost,sans-serif" font-size="${fs}" text-anchor="middle">${label}</text>`;
        return svg;
    }

    // Red dimension line — vertical (right of drawing)
    static sashDimV(x, y1, y2, extFrom, label, fs) {
        const G = EstimateRenderer.SASH_GEO;
        const NS = 'vector-effect="non-scaling-stroke"';
        const t = fs * 0.35, over = fs * 0.55, off = fs * 1.0;
        const mid = (y1 + y2) / 2;
        let svg = '';
        svg += `<line x1="${extFrom}" y1="${y1}" x2="${x + over}" y2="${y1}" stroke="${G.dimRed}" stroke-width="0.6" stroke-dasharray="5,4" ${NS}/>`;
        svg += `<line x1="${extFrom}" y1="${y2}" x2="${x + over}" y2="${y2}" stroke="${G.dimRed}" stroke-width="0.6" stroke-dasharray="5,4" ${NS}/>`;
        svg += `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${G.dimRed}" stroke-width="1.3" ${NS}/>`;
        svg += `<line x1="${x - t}" y1="${y1}" x2="${x + t}" y2="${y1}" stroke="${G.dimRed}" stroke-width="1.3" ${NS}/>`;
        svg += `<line x1="${x - t}" y1="${y2}" x2="${x + t}" y2="${y2}" stroke="${G.dimRed}" stroke-width="1.3" ${NS}/>`;
        svg += `<text x="${x + off}" y="${mid}" fill="${G.dimRed}" font-family="Jost,sans-serif" font-size="${fs}" text-anchor="middle" transform="rotate(-90,${x + off},${mid})">${label}</text>`;
        return svg;
    }

    // Draws one double-hung unit (frameless — box drawn by caller) inside
    // the given cavity. Returns { svg, meetY } (meetY = meeting-rail centre, SVG coords).
    static sashUnitSVG(cavX, cavY, cavW, cavH, opts) {
        const G = EstimateRenderer.SASH_GEO;
        const NS = 'vector-effect="non-scaling-stroke"';
        const { upperBars, lowerBars, upperCustom, lowerCustom,
                horns, hornType, openingType, archRise } = opts;

        // Sash sizes derived from cavity (cavity ≈ frame inner light)
        const sashW = cavW;
        const totalSashH = cavH + G.meetRail;           // overlap at meeting rail
        const topSashH = (totalSashH - G.sashHDiff) / 2;
        const botSashH = topSashH + G.sashHDiff;

        const sashX = cavX;
        const upperY = cavY;
        const lowerY = upperY + topSashH - G.meetRail;
        const meetY = lowerY + G.meetRail / 2;

        // Glass areas
        const uGlassX = sashX + G.stile, uGlassW = sashW - 2 * G.stile;
        const uGlassY = upperY + G.topRail;
        const uGlassH = topSashH - G.topRail - G.meetRail;
        const lGlassX = uGlassX, lGlassW = uGlassW;
        const lGlassY = lowerY + G.meetRail;
        const lGlassH = botSashH - G.meetRail - G.botRail;

        let svg = '';
        const glassStyle = `fill="${G.glassFill}" stroke="${G.glassStroke}" stroke-width="0.8" ${NS}`;

        // ── Upper glass (arch head: curved top edge) ──
        if (archRise > 0) {
            const gy = uGlassY + archRise;
            const gh = uGlassH - archRise;
            svg += `<path d="M ${uGlassX} ${gy} Q ${uGlassX + uGlassW/2} ${gy - 2*archRise} ${uGlassX + uGlassW} ${gy} L ${uGlassX + uGlassW} ${gy + gh} L ${uGlassX} ${gy + gh} Z" ${glassStyle}/>`;
            svg += EstimateRenderer.sashBarsSVG(uGlassX, gy, uGlassW, gh, upperBars, upperCustom);
        } else {
            svg += `<rect x="${uGlassX}" y="${uGlassY}" width="${uGlassW}" height="${uGlassH}" ${glassStyle}/>`;
            svg += EstimateRenderer.sashBarsSVG(uGlassX, uGlassY, uGlassW, uGlassH, upperBars, upperCustom);
        }

        // ── Lower glass ──
        svg += `<rect x="${lGlassX}" y="${lGlassY}" width="${lGlassW}" height="${lGlassH}" ${glassStyle}/>`;
        svg += EstimateRenderer.sashBarsSVG(lGlassX, lGlassY, lGlassW, lGlassH, lowerBars, lowerCustom);

        // ── Lower-sash bottom rail top edge ──
        svg += `<line x1="${sashX}" y1="${lowerY + botSashH - G.botRail}" x2="${sashX + sashW}" y2="${lowerY + botSashH - G.botRail}" stroke="${G.navy}" stroke-width="0.8" opacity="0.5" ${NS}/>`;

        // ── Meeting rail (band, both edges) ──
        svg += `<rect x="${sashX}" y="${lowerY}" width="${sashW}" height="${G.meetRail}" fill="${G.frameFill}" stroke="${G.navy}" stroke-width="1" ${NS}/>`;

        // ── Horns (upper-sash bottom corners) ──
        if (horns) {
            const hornTopY = upperY + topSashH;
            const inset = (G.stile - 30) / 2;
            const type = EstimateRenderer.SASH_HORN_DEF[hornType] ? hornType : 'A';
            svg += `<path d="${EstimateRenderer.sashHornPath(type, sashX, sashW, hornTopY, 'L', inset)}" fill="${G.frameFill}" stroke="${G.navy}" stroke-width="0.9" ${NS}/>`;
            svg += `<path d="${EstimateRenderer.sashHornPath(type, sashX, sashW, hornTopY, 'R', inset)}" fill="${G.frameFill}" stroke="${G.navy}" stroke-width="0.9" ${NS}/>`;
        }

        // ── Opening arrows (green, halo underlay so they read over bars) ──
        const arrFS = Math.max(60, sashW * 0.12);
        const arrHalo = `fill="none" stroke="${G.barFill}" stroke-width="${arrFS * 0.22}" stroke-linejoin="round" font-family="Jost,sans-serif" font-size="${arrFS}" text-anchor="middle"`;
        const arrFill = `fill="#1E8E3E" font-family="Jost,sans-serif" font-size="${arrFS}" text-anchor="middle"`;
        const arrow = (x, y, ch) =>
            `<text x="${x}" y="${y}" ${arrHalo}>${ch}</text>` +
            `<text x="${x}" y="${y}" ${arrFill}>${ch}</text>`;
        if (openingType === 'both' || openingType === 'bottom') {
            svg += arrow(sashX + sashW/2, lGlassY + lGlassH/2 + 20, '↑');
        }
        if (openingType === 'both' || openingType === 'top') {
            svg += arrow(sashX + sashW/2, uGlassY + uGlassH * 0.4, '↓');
        }

        return { svg, meetY };
    }

    // Layout table — ported VERBATIM from 3D CasementWindow.jsx getLayout()
    // (single source of truth: drawing matches the 3D model exactly)
    static casementLayoutDef(code, innerW, innerH, height, fanlightRatio, fan2Ratio, middleSectionMm = 0) {
        const FRAME_FACE = 57, BOTTOM_FACE = 68, MULLION_W = 68;

      const half = innerW / 2;
      const third = innerW / 3;
      const mullW = MULLION_W;
      const FR = fanlightRatio || 0.3;
      const FR2 = fan2Ratio || 0.3;
    
      switch (code) {
        // ─── SINGLE PANELS ───
        case '040L':
        case '010':
          return {
            panels: [{ x: 0, y: 0, w: innerW, h: innerH, hinge: 'right' }],
          };
        case '040R':
          return {
            panels: [{ x: 0, y: 0, w: innerW, h: innerH, hinge: 'left' }],
          };
        case '010T':
          return {
            panels: [{ x: 0, y: 0, w: innerW, h: innerH, hinge: 'top' }],
          };
        case '040D': {
          const panelW = (innerW - mullW) / 2;
          return {
            mullions: [FRAME_FACE + panelW + mullW / 2],
            panels: [
              { x: -(panelW + mullW) / 2, y: 0, w: panelW, h: innerH, hinge: 'left' },
              { x:  (panelW + mullW) / 2, y: 0, w: panelW, h: innerH, hinge: 'right' },
            ],
          };
        }
    
        // ─── DOUBLE SIDE-BY-SIDE ───
        case '120': {
          const panelW = (innerW - mullW) / 2;
          return {
            mullions: [FRAME_FACE + panelW + mullW / 2],
            panels: [
              { x: -(panelW + mullW) / 2, y: 0, w: panelW, h: innerH, hinge: 'left' },
              { x:  (panelW + mullW) / 2, y: 0, w: panelW, h: innerH, hinge: 'right' },
            ],
          };
        }
        case '051L': {
          const panelW = (innerW - mullW) / 2;
          return {
            mullions: [FRAME_FACE + panelW + mullW / 2],
            panels: [
              { x: -(panelW + mullW) / 2, y: 0, w: panelW, h: innerH, hinge: 'left' },
              { x:  (panelW + mullW) / 2, y: 0, w: panelW, h: innerH, hinge: 'fixed' },
            ],
          };
        }
        case '051R': {
          const panelW = (innerW - mullW) / 2;
          return {
            mullions: [FRAME_FACE + panelW + mullW / 2],
            panels: [
              { x: -(panelW + mullW) / 2, y: 0, w: panelW, h: innerH, hinge: 'fixed' },
              { x:  (panelW + mullW) / 2, y: 0, w: panelW, h: innerH, hinge: 'right' },
            ],
          };
        }
    
        // ─── 052L: Mullion full + transom LEFT only (lufcik lewy) ───
        case '052L': {
          const panelW = (innerW - mullW) / 2;
          const mullX = FRAME_FACE + panelW + mullW / 2;
          const topH = innerH * FR;
          const bottomH = innerH - MULLION_W - topH;
          const transomY = BOTTOM_FACE + bottomH + MULLION_W / 2;
          return {
            mullions: [mullX],
            transoms: [{ y: transomY, width: panelW, offsetX: -(panelW + mullW) / 2 }],
            panels: [
              { x: -(panelW + mullW) / 2, y: (bottomH + MULLION_W) / 2, w: panelW, h: topH, hinge: 'top' },
              { x: -(panelW + mullW) / 2, y: -(topH + MULLION_W) / 2, w: panelW, h: bottomH, hinge: 'left' },
              { x:  (panelW + mullW) / 2, y: 0, w: panelW, h: innerH, hinge: 'right' },
            ],
          };
        }
    
        // ─── 052R: Mullion full + transom RIGHT only (lufcik prawy) ───
        case '052R': {
          const panelW = (innerW - mullW) / 2;
          const mullX = FRAME_FACE + panelW + mullW / 2;
          const topH = innerH * FR;
          const bottomH = innerH - MULLION_W - topH;
          const transomY = BOTTOM_FACE + bottomH + MULLION_W / 2;
          return {
            mullions: [mullX],
            transoms: [{ y: transomY, width: panelW, offsetX: (panelW + mullW) / 2 }],
            panels: [
              { x: -(panelW + mullW) / 2, y: 0, w: panelW, h: innerH, hinge: 'left' },
              { x:  (panelW + mullW) / 2, y: (bottomH + MULLION_W) / 2, w: panelW, h: topH, hinge: 'top' },
              { x:  (panelW + mullW) / 2, y: -(topH + MULLION_W) / 2, w: panelW, h: bottomH, hinge: 'right' },
            ],
          };
        }
        case '180L': {
          const openW = innerW * 0.4;
          const fixedW = innerW - mullW - openW;
          return {
            mullions: [FRAME_FACE + openW + mullW / 2],
            panels: [
              { x: -(fixedW + mullW) / 2, y: 0, w: openW, h: innerH, hinge: 'left' },
              { x:  (openW + mullW) / 2, y: 0, w: fixedW, h: innerH, hinge: 'fixed' },
            ],
          };
        }
        case '180R': {
          const openW = innerW * 0.4;
          const fixedW = innerW - mullW - openW;
          return {
            mullions: [FRAME_FACE + fixedW + mullW / 2],
            panels: [
              { x: -(openW + mullW) / 2, y: 0, w: fixedW, h: innerH, hinge: 'fixed' },
              { x:  (fixedW + mullW) / 2, y: 0, w: openW, h: innerH, hinge: 'right' },
            ],
          };
        }
    
        // ─── WITH FANLIGHT (top-hung top + side-hung bottom) ───
        case '022': {
          const panelW = (innerW - mullW) / 2;
          const mullX = FRAME_FACE + panelW + mullW / 2;
          const topH = innerH * FR;
          const bottomH = innerH - MULLION_W - topH;
          const transomY = BOTTOM_FACE + bottomH + MULLION_W / 2;
          return {
            mullions: [mullX],
            transoms: [
              { y: transomY, width: panelW, offsetX: -(panelW + mullW) / 2 },
              { y: transomY, width: panelW, offsetX: (panelW + mullW) / 2 },
            ],
            panels: [
              { x: -(panelW + mullW) / 2, y: (bottomH + MULLION_W) / 2, w: panelW, h: topH, hinge: 'top' },
              { x: (panelW + mullW) / 2, y: (bottomH + MULLION_W) / 2, w: panelW, h: topH, hinge: 'top' },
              { x: -(panelW + mullW) / 2, y: -(topH + MULLION_W) / 2, w: panelW, h: bottomH, hinge: 'fixed' },
              { x: (panelW + mullW) / 2, y: -(topH + MULLION_W) / 2, w: panelW, h: bottomH, hinge: 'fixed' },
            ],
          };
        }
        case '133': {
          // Custom middle section (mullion-axis setting-out); 0 -> equal thirds
          const eqW = (innerW - mullW * 2) / 3;
          const panelC = middleSectionMm > 0 ? (middleSectionMm - mullW) : eqW;
          const panelS = middleSectionMm > 0 ? (innerW - panelC - mullW * 2) / 2 : eqW;
          const off = panelC / 2 + mullW + panelS / 2;
          const m1 = FRAME_FACE + panelS + mullW / 2;
          const m2 = m1 + panelC + mullW;
          const topH = innerH * FR;
          const bottomH = innerH - MULLION_W - topH;
          const transomY = BOTTOM_FACE + bottomH + MULLION_W / 2;
          return {
            mullions: [m1, m2],
            transoms: [
              { y: transomY, width: panelS, offsetX: -off },
              { y: transomY, width: panelC, offsetX: 0 },
              { y: transomY, width: panelS, offsetX: off },
            ],
            panels: [
              { x: -off, y: (bottomH + MULLION_W) / 2, w: panelS, h: topH, hinge: 'top' },
              { x: 0,                 y: (bottomH + MULLION_W) / 2, w: panelC, h: topH, hinge: 'top' },
              { x:  off, y: (bottomH + MULLION_W) / 2, w: panelS, h: topH, hinge: 'top' },
              { x: -off, y: -(topH + MULLION_W) / 2, w: panelS, h: bottomH, hinge: 'fixed' },
              { x: 0,                 y: -(topH + MULLION_W) / 2, w: panelC, h: bottomH, hinge: 'fixed' },
              { x:  off, y: -(topH + MULLION_W) / 2, w: panelS, h: bottomH, hinge: 'fixed' },
            ],
          };
        }
        case '013': {
          const topH = innerH * FR;
          const botH = innerH * FR2;
          const midH = innerH - topH - botH - MULLION_W * 2;
          const t1Y = BOTTOM_FACE + botH + MULLION_W + midH + MULLION_W / 2;
          const t2Y = BOTTOM_FACE + botH + MULLION_W / 2;
          return {
            mullions: [],
            transoms: [t1Y, t2Y],
            panels: [
              { x: 0, y: (innerH - topH) / 2, w: innerW, h: topH, hinge: 'top' },
              { x: 0, y: -innerH / 2 + botH + MULLION_W + midH / 2, w: innerW, h: midH, hinge: 'left' },
              { x: 0, y: -(innerH - botH) / 2, w: innerW, h: botH, hinge: 'fixed' },
            ],
          };
        }
        case '023': {
          const panelW = (innerW - mullW) / 2;
          const mullX = FRAME_FACE + panelW + mullW / 2;
          const topH = innerH * FR;
          const botH = innerH * FR2;
          const midH = innerH - topH - botH - MULLION_W * 2;
          const t1Y = BOTTOM_FACE + botH + MULLION_W + midH + MULLION_W / 2;
          const t2Y = BOTTOM_FACE + botH + MULLION_W / 2;
          const xL = -(panelW + mullW) / 2, xR = (panelW + mullW) / 2;
          return {
            mullions: [mullX],
            transoms: [
              { y: t1Y, width: panelW, offsetX: xL }, { y: t1Y, width: panelW, offsetX: xR },
              { y: t2Y, width: panelW, offsetX: xL }, { y: t2Y, width: panelW, offsetX: xR },
            ],
            panels: [
              { x: xL, y: (innerH - topH) / 2, w: panelW, h: topH, hinge: 'top' },
              { x: xR, y: (innerH - topH) / 2, w: panelW, h: topH, hinge: 'top' },
              { x: xL, y: -innerH / 2 + botH + MULLION_W + midH / 2, w: panelW, h: midH, hinge: 'left' },
              { x: xR, y: -innerH / 2 + botH + MULLION_W + midH / 2, w: panelW, h: midH, hinge: 'right' },
              { x: xL, y: -(innerH - botH) / 2, w: panelW, h: botH, hinge: 'fixed' },
              { x: xR, y: -(innerH - botH) / 2, w: panelW, h: botH, hinge: 'fixed' },
            ],
          };
        }
        case '021': {
          const fanlightH = innerH * FR;
          const mainH = innerH - MULLION_W - fanlightH;
          const transomY = BOTTOM_FACE + mainH + MULLION_W / 2;
          return {
            transoms: [transomY],
            panels: [
              { x: 0, y: (mainH + MULLION_W) / 2, w: innerW, h: fanlightH, hinge: 'top' },
              { x: 0, y: -(fanlightH + MULLION_W) / 2, w: innerW, h: mainH, hinge: 'fixed' },
            ],
          };
        }
        case '021L': {
          const fanlightH = innerH * FR;
          const mainH = innerH - MULLION_W - fanlightH;
          const transomY = BOTTOM_FACE + mainH + MULLION_W / 2;
          return {
            transoms: [transomY],
            panels: [
              { x: 0, y: (mainH + MULLION_W) / 2, w: innerW, h: fanlightH, hinge: 'top' },
              { x: 0, y: -(fanlightH + MULLION_W) / 2, w: innerW, h: mainH, hinge: 'right' },
            ],
          };
        }
        case '021R': {
          const fanlightH = innerH * FR;
          const mainH = innerH - MULLION_W - fanlightH;
          const transomY = BOTTOM_FACE + mainH + MULLION_W / 2;
          return {
            transoms: [transomY],
            panels: [
              { x: 0, y: (mainH + MULLION_W) / 2, w: innerW, h: fanlightH, hinge: 'top' },
              { x: 0, y: -(fanlightH + MULLION_W) / 2, w: innerW, h: mainH, hinge: 'left' },
            ],
          };
        }
        case '031': {
          const fanlightH = innerH * FR;
          const mainH = innerH - MULLION_W - fanlightH;
          const transomY = BOTTOM_FACE + mainH + MULLION_W / 2;
          const topPanelW = (innerW - mullW) / 2;
          const mullX = FRAME_FACE + topPanelW + mullW / 2;
          const mullStartY = transomY + MULLION_W / 2;
          const mullEndY = height;
          return {
            transoms: [transomY],
            mullions: [{ x: mullX, startY: mullStartY, endY: mullEndY, touchesBottom: false, touchesTop: true }],
            panels: [
              { x: -(topPanelW + mullW) / 2, y: (mainH + MULLION_W) / 2, w: topPanelW, h: fanlightH, hinge: 'top' },
              { x:  (topPanelW + mullW) / 2, y: (mainH + MULLION_W) / 2, w: topPanelW, h: fanlightH, hinge: 'top' },
              { x: 0, y: -(fanlightH + MULLION_W) / 2, w: innerW, h: mainH, hinge: 'fixed' },
            ],
          };
        }
        case '031L': {
          const fanlightH = innerH * FR;
          const mainH = innerH - MULLION_W - fanlightH;
          const transomY = BOTTOM_FACE + mainH + MULLION_W / 2;
          const topPanelW = (innerW - mullW) / 2;
          const mullX = FRAME_FACE + topPanelW + mullW / 2;
          const mullStartY = transomY + MULLION_W / 2;
          const mullEndY = height;
          return {
            transoms: [transomY],
            mullions: [{ x: mullX, startY: mullStartY, endY: mullEndY, touchesBottom: false, touchesTop: true }],
            panels: [
              { x: -(topPanelW + mullW) / 2, y: (mainH + MULLION_W) / 2, w: topPanelW, h: fanlightH, hinge: 'top' },
              { x:  (topPanelW + mullW) / 2, y: (mainH + MULLION_W) / 2, w: topPanelW, h: fanlightH, hinge: 'top' },
              { x: 0, y: -(fanlightH + MULLION_W) / 2, w: innerW, h: mainH, hinge: 'right' },
            ],
          };
        }
        case '031R': {
          const fanlightH = innerH * FR;
          const mainH = innerH - MULLION_W - fanlightH;
          const transomY = BOTTOM_FACE + mainH + MULLION_W / 2;
          const topPanelW = (innerW - mullW) / 2;
          const mullX = FRAME_FACE + topPanelW + mullW / 2;
          const mullStartY = transomY + MULLION_W / 2;
          const mullEndY = height;
          return {
            transoms: [transomY],
            mullions: [{ x: mullX, startY: mullStartY, endY: mullEndY, touchesBottom: false, touchesTop: true }],
            panels: [
              { x: -(topPanelW + mullW) / 2, y: (mainH + MULLION_W) / 2, w: topPanelW, h: fanlightH, hinge: 'top' },
              { x:  (topPanelW + mullW) / 2, y: (mainH + MULLION_W) / 2, w: topPanelW, h: fanlightH, hinge: 'top' },
              { x: 0, y: -(fanlightH + MULLION_W) / 2, w: innerW, h: mainH, hinge: 'left' },
            ],
          };
        }
    
        // ─── 032: Transom full width + mullion ONLY below transom ───
        case '032': {
          const topH = innerH * FR;
          const bottomH = innerH - MULLION_W - topH;
          const transomY = BOTTOM_FACE + bottomH + MULLION_W / 2;
          const bottomPanelW = (innerW - mullW) / 2;
          const mullX = FRAME_FACE + bottomPanelW + mullW / 2;
          const mullEndY = transomY - MULLION_W / 2;
          return {
            transoms: [transomY],
            mullions: [{ x: mullX, startY: 0, endY: mullEndY, touchesBottom: true, touchesTop: false }],
            panels: [
              { x: 0, y: (bottomH + MULLION_W) / 2, w: innerW, h: topH, hinge: 'top' },
              { x: -(bottomPanelW + mullW) / 2, y: -(topH + MULLION_W) / 2, w: bottomPanelW, h: bottomH, hinge: 'left' },
              { x:  (bottomPanelW + mullW) / 2, y: -(topH + MULLION_W) / 2, w: bottomPanelW, h: bottomH, hinge: 'right' },
            ],
          };
        }
    
        // ─── TRIPLE ───
        case '130': {
          // Custom middle section (mullion-axis setting-out); 0 -> equal thirds
          const eqW = (innerW - mullW * 2) / 3;
          const panelC = middleSectionMm > 0 ? (middleSectionMm - mullW) : eqW;
          const panelS = middleSectionMm > 0 ? (innerW - panelC - mullW * 2) / 2 : eqW;
          const off = panelC / 2 + mullW + panelS / 2;
          const m1 = FRAME_FACE + panelS + mullW / 2;
          const m2 = m1 + panelC + mullW;
          return {
            mullions: [m1, m2],
            panels: [
              { x: -off, y: 0, w: panelS, h: innerH, hinge: 'left' },
              { x: 0,                 y: 0, w: panelC, h: innerH, hinge: 'fixed' },
              { x:  off, y: 0, w: panelS, h: innerH, hinge: 'right' },
            ],
          };
        }
    
        // ─── 140L: Quad — left opens, rest fixed ───
        case '140L': {
          const panelW = (innerW - mullW * 3) / 4;
          const m1 = FRAME_FACE + panelW + mullW / 2;
          const m2 = FRAME_FACE + panelW * 2 + mullW + mullW / 2;
          const m3 = FRAME_FACE + panelW * 3 + mullW * 2 + mullW / 2;
          return {
            mullions: [m1, m2, m3],
            panels: [
              { x: -(1.5 * panelW + 1.5 * mullW), y: 0, w: panelW, h: innerH, hinge: 'left' },
              { x: -(0.5 * panelW + 0.5 * mullW), y: 0, w: panelW, h: innerH, hinge: 'fixed' },
              { x:  (0.5 * panelW + 0.5 * mullW), y: 0, w: panelW, h: innerH, hinge: 'fixed' },
              { x:  (1.5 * panelW + 1.5 * mullW), y: 0, w: panelW, h: innerH, hinge: 'fixed' },
            ],
          };
        }
    
        // ─── 140R: Quad — right opens, rest fixed ───
        case '140R': {
          const panelW = (innerW - mullW * 3) / 4;
          const m1 = FRAME_FACE + panelW + mullW / 2;
          const m2 = FRAME_FACE + panelW * 2 + mullW + mullW / 2;
          const m3 = FRAME_FACE + panelW * 3 + mullW * 2 + mullW / 2;
          return {
            mullions: [m1, m2, m3],
            panels: [
              { x: -(1.5 * panelW + 1.5 * mullW), y: 0, w: panelW, h: innerH, hinge: 'fixed' },
              { x: -(0.5 * panelW + 0.5 * mullW), y: 0, w: panelW, h: innerH, hinge: 'fixed' },
              { x:  (0.5 * panelW + 0.5 * mullW), y: 0, w: panelW, h: innerH, hinge: 'fixed' },
              { x:  (1.5 * panelW + 1.5 * mullW), y: 0, w: panelW, h: innerH, hinge: 'right' },
            ],
          };
        }
    
        // ─── 131: Triple + transom ONLY in center ───
        case '131': {
          // Custom middle section (mullion-axis setting-out); 0 -> equal thirds
          const eqW = (innerW - mullW * 2) / 3;
          const panelC = middleSectionMm > 0 ? (middleSectionMm - mullW) : eqW;
          const panelS = middleSectionMm > 0 ? (innerW - panelC - mullW * 2) / 2 : eqW;
          const off = panelC / 2 + mullW + panelS / 2;
          const m1 = FRAME_FACE + panelS + mullW / 2;
          const m2 = m1 + panelC + mullW;
          const topH = innerH * FR;
          const bottomH = innerH - MULLION_W - topH;
          const transomY = BOTTOM_FACE + bottomH + MULLION_W / 2;
          return {
            mullions: [m1, m2],
            transoms: [{ y: transomY, width: panelC }],
            panels: [
              { x: -off, y: 0, w: panelS, h: innerH, hinge: 'left' },
              { x: 0, y: (bottomH + MULLION_W) / 2, w: panelC, h: topH, hinge: 'top' },
              { x: 0, y: -(topH + MULLION_W) / 2, w: panelC, h: bottomH, hinge: 'fixed' },
              { x:  off, y: 0, w: panelS, h: innerH, hinge: 'right' },
            ],
          };
        }
    
        // ─── 132: Triple + transom full width ───
        case '132': {
          // Custom middle section (mullion-axis setting-out); 0 -> equal thirds
          const eqW = (innerW - mullW * 2) / 3;
          const panelC = middleSectionMm > 0 ? (middleSectionMm - mullW) : eqW;
          const panelS = middleSectionMm > 0 ? (innerW - panelC - mullW * 2) / 2 : eqW;
          const off = panelC / 2 + mullW + panelS / 2;
          const m1 = FRAME_FACE + panelS + mullW / 2;
          const m2 = m1 + panelC + mullW;
          const topH = innerH * FR;
          const bottomH = innerH - MULLION_W - topH;
          const transomY = BOTTOM_FACE + bottomH + MULLION_W / 2;
          return {
            mullions: [m1, m2],
            transoms: [
              { y: transomY, width: panelS, offsetX: -off },  // left transom
              { y: transomY, width: panelS, offsetX: off },   // right transom
            ],
            panels: [
              { x: -off, y: (bottomH + MULLION_W) / 2, w: panelS, h: topH, hinge: 'top' },
              { x: 0,                 y: 0, w: panelC, h: innerH, hinge: 'fixed' },
              { x:  off, y: (bottomH + MULLION_W) / 2, w: panelS, h: topH, hinge: 'top' },
              { x: -off, y: -(topH + MULLION_W) / 2, w: panelS, h: bottomH, hinge: 'left' },
              { x:  off, y: -(topH + MULLION_W) / 2, w: panelS, h: bottomH, hinge: 'right' },
            ],
          };
        }
    
        // Default: single left
        default:
          return {
            panels: [{ x: 0, y: 0, w: innerW, h: innerH, hinge: 'left' }],
          };
      }
    }

    // ─── CASEMENT SVG v2 — real-mm geometry, layouts 1:1 from 3D ───
    static generateCasementSVGv2(item, fc) {
        const G = EstimateRenderer.SASH_GEO;   // shared palette / dim helpers
        const NS = 'vector-effect="non-scaling-stroke"';
        const FRAME_FACE = 57, BOTTOM_FACE = 68, MULLION_W = 68, LEAF_FACE = 50;

        const fw = fc.actualFrameWidth || fc.width || item.width || 800;
        const fh = fc.actualFrameHeight || fc.height || item.height || 1200;
        const code = fc.casementLayout || fc.layout || item.casement_layout || '040L';
        const innerW = fw - 2 * FRAME_FACE;
        const innerH = fh - FRAME_FACE - BOTTOM_FACE;
        // Transom AXIS convention: stored value = frame top -> transom centre.
        const fanMm = parseFloat(fc.fanlightHeight) || 0;                                   // axis
        const fanZone = fanMm > 0 ? (fanMm - FRAME_FACE - MULLION_W / 2) : 0;               // panel zone
        const FR = Math.max(0.15, Math.min(0.5, (fanZone || innerH * 0.3) / innerH));
        const fan2Mm = parseFloat(fc.casementFan2Height) || 0;                              // axis (lower transom)
        const fan2Zone = fan2Mm > 0 ? (fh - fan2Mm - BOTTOM_FACE - MULLION_W / 2) : 0;      // bottom panel zone
        const FR2 = Math.max(0.15, Math.min(0.5, (fan2Zone || innerH * 0.3) / innerH));
        const hN = parseInt(fc.hBars || fc.casementHBars) || 0;
        const vN = parseInt(fc.vBars || fc.casementVBars) || 0;
        const fanHN = Math.min(2, parseInt(fc.casementFanHBars) || 0);
        const fanVN = Math.min(2, parseInt(fc.casementFanVBars) || 0);
        const fan2HN = Math.min(2, parseInt(fc.casementFan2HBars) || 0);
        const fan2VN = Math.min(2, parseInt(fc.casementFan2VBars) || 0);
        const FAN2_CODES_P1 = ['013','023'];
        const FAN_LAYOUTS_P1 = ['021','031','032','052L','052R','131','132','133','022','013','023'];

        const midSec = (['130','131','132','133'].includes(code) && parseInt(fc.casementMiddleWidth) > 0) ? parseInt(fc.casementMiddleWidth) : 0;
        const def = EstimateRenderer.casementLayoutDef(code, innerW, innerH, fh, FR, FR2, midSec)
                 || { panels: [{ x: 0, y: 0, w: innerW, h: innerH, hinge: 'fixed' }] };
        // Panel roles from ORIGINAL hinge (before opener overlay) — robust for 3-tier
        if (def.panels) {
            def.panels = def.panels.map(p => ({
                ...p,
                _role: p.hinge === 'top' ? 'fan' : (FAN2_CODES_P1.includes(code) && p.hinge === 'fixed' ? 'fan2' : 'main')
            }));
        }
        // Clickable openers overlay — generic (strings; legacy 022 booleans normalised)
        if (Array.isArray(fc.casementHinges) && def.panels) {
            const H022 = ['top', 'top', 'left', 'right'];
            const norm = fc.casementHinges.map((v, i) => {
                if (v === true) return code === '022' ? H022[i] : (def.panels[i] ? def.panels[i].hinge : 'fixed');
                if (v === false) return 'fixed';
                return v;
            });
            def.panels = def.panels.map((p, i) => {
                const h = norm[i];
                return (h === 'fixed' || h === 'left' || h === 'right' || h === 'top') ? { ...p, hinge: h } : p;
            });
        }

        // Layout (mm canvas)
        const M = Math.max(G.margin * 1.35, Math.max(fw, fh) * 0.085);
        const DM = Math.max(G.dimOffset, Math.max(fw, fh) * 0.07);
        const hasFan = !!(def.transoms && def.transoms.length);
        const leftDM = hasFan ? DM : M * 0.4;           // room for fanlight dim on the left
        const totalW = leftDM + fw + DM + M;
        const totalH = M + fh + DM + M * 0.4;
        const ox = leftDM, oy = M;
        const fs = 21 * (totalW / G.refW);
        const SY = (y) => oy + (fh - y);                 // real-Y (0 = frame bottom) → SVG-Y
        const frameStyle = `fill="${G.frameFill}" stroke="${G.navy}" stroke-width="1.4" ${NS}`;
        const glassStyle = `fill="${G.glassFill}" stroke="${G.glassStroke}" stroke-width="0.8" ${NS}`;

        let svg = '';

        // ── Outer frame (jambs 57, head 57, cill face 68) ──
        svg += `<rect x="${ox}" y="${oy}" width="${FRAME_FACE}" height="${fh}" ${frameStyle}/>`;
        svg += `<rect x="${ox + fw - FRAME_FACE}" y="${oy}" width="${FRAME_FACE}" height="${fh}" ${frameStyle}/>`;
        svg += `<rect x="${ox + FRAME_FACE}" y="${oy}" width="${innerW}" height="${FRAME_FACE}" ${frameStyle}/>`;
        svg += `<rect x="${ox + FRAME_FACE}" y="${SY(BOTTOM_FACE)}" width="${innerW}" height="${BOTTOM_FACE}" ${frameStyle}/>`;

        // ── Mullions (number = full-height x; object = {x,startY,endY} real-Y) ──
        (def.mullions || []).forEach(mu => {
            if (typeof mu === 'number') {
                svg += `<rect x="${ox + mu - MULLION_W / 2}" y="${oy + FRAME_FACE}" width="${MULLION_W}" height="${innerH}" ${frameStyle}/>`;
            } else {
                const y1 = Math.max(mu.startY, BOTTOM_FACE);
                const y2 = Math.min(mu.endY, fh - FRAME_FACE);
                svg += `<rect x="${ox + mu.x - MULLION_W / 2}" y="${SY(y2)}" width="${MULLION_W}" height="${y2 - y1}" ${frameStyle}/>`;
            }
        });

        // ── Transoms (number = full-width y; object = {y,width,offsetX} partial) ──
        let transomAxisRealY = null;   // for fanlight dimension (transom centre = axis)
        (def.transoms || []).forEach(tr => {
            const y = (typeof tr === 'number') ? tr : tr.y;
            transomAxisRealY = Math.max(transomAxisRealY || 0, y);
            if (typeof tr === 'number' || tr.width === undefined) {
                svg += `<rect x="${ox + FRAME_FACE}" y="${SY(y + MULLION_W / 2)}" width="${innerW}" height="${MULLION_W}" ${frameStyle}/>`;
            } else {
                const cx = ox + FRAME_FACE + innerW / 2 + (tr.offsetX || 0);
                svg += `<rect x="${cx - tr.width / 2}" y="${SY(y + MULLION_W / 2)}" width="${tr.width}" height="${MULLION_W}" ${frameStyle}/>`;
            }
        });

        // ── Opening symbol: V converging to the hinge side (joinery convention) ──
        const vSym = (gx, gy, gw, gh, hinge) => {
            let pts;
            if (hinge === 'left')  pts = [[gx + gw, gy], [gx, gy + gh / 2], [gx + gw, gy + gh]];
            else if (hinge === 'right') pts = [[gx, gy], [gx + gw, gy + gh / 2], [gx, gy + gh]];
            else /* top */ pts = [[gx, gy + gh], [gx + gw / 2, gy], [gx + gw, gy + gh]];
            const d = `M ${pts[0][0]} ${pts[0][1]} L ${pts[1][0]} ${pts[1][1]} L ${pts[2][0]} ${pts[2][1]}`;
            return `<path d="${d}" fill="none" stroke="${G.barFill}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round" ${NS}/>`
                 + `<path d="${d}" fill="none" stroke="#1E8E3E" stroke-width="1.6" stroke-linejoin="round" ${NS}/>`;
        };

        const casBars = (gx, gy, gw, gh, bH, bV) => {
            let s = '';
            const barStyle = `fill="${G.barFill}" stroke="${G.navy}" stroke-width="0.6" ${NS}`;
            for (let i = 1; i <= bV; i++) {
                const cx = gx + gw * i / (bV + 1);
                if (gw > G.barW * (bV + 1)) s += `<rect x="${cx - G.barW / 2}" y="${gy}" width="${G.barW}" height="${gh}" ${barStyle}/>`;
            }
            for (let j = 1; j <= bH; j++) {
                const cy = gy + gh * j / (bH + 1);
                if (gh > G.barW * (bH + 1)) s += `<rect x="${gx}" y="${cy - G.barW / 2}" width="${gw}" height="${G.barW}" ${barStyle}/>`;
            }
            return s;
        };

        // ── Panels (x,y = centre offsets from glass-area centre, 3D convention) ──
        const gcx = ox + FRAME_FACE + innerW / 2;
        const gcRealY = BOTTOM_FACE + innerH / 2;
        (def.panels || []).forEach(p => {
            const bH = p._role === 'fan' ? fanHN : p._role === 'fan2' ? fan2HN : hN;
            const bV = p._role === 'fan' ? fanVN : p._role === 'fan2' ? fan2VN : vN;
            const px = gcx + p.x - p.w / 2;
            const py = SY(gcRealY + p.y + p.h / 2);
            if (p.hinge === 'fixed') {
                svg += `<rect x="${px}" y="${py}" width="${p.w}" height="${p.h}" ${glassStyle}/>`;
                svg += casBars(px, py, p.w, p.h, bH, bV);
                const lfs = Math.max(40, Math.min(p.w, p.h) * 0.2);
                svg += `<text x="${px + p.w / 2}" y="${py + p.h / 2 + lfs * 0.35}" fill="${G.navy}" opacity="0.35" font-family="Jost,sans-serif" font-size="${lfs}" text-anchor="middle" letter-spacing="6">FIX</text>`;
            } else {
                // opening leaf: leaf frame + glass inset
                svg += `<rect x="${px}" y="${py}" width="${p.w}" height="${p.h}" ${frameStyle}/>`;
                const gx = px + LEAF_FACE, gy = py + LEAF_FACE;
                const gw = p.w - 2 * LEAF_FACE, gh = p.h - 2 * LEAF_FACE;
                if (gw > 20 && gh > 20) {
                    svg += `<rect x="${gx}" y="${gy}" width="${gw}" height="${gh}" ${glassStyle}/>`;
                    svg += casBars(gx, gy, gw, gh, bH, bV);
                    svg += vSym(gx, gy, gw, gh, p.hinge);
                }
            }
        });

        // ── RED DIMENSIONS ──
        svg += EstimateRenderer.sashDimH(oy + fh + DM * 0.75, ox, ox + fw, oy + fh, `${Math.round(fw)}`, fs);
        svg += EstimateRenderer.sashDimV(ox + fw + DM * 0.75, oy, oy + fh, ox + fw, `${Math.round(fh)}`, fs);
        // Transom axis (left side): frame top → transom centre
        if (hasFan && transomAxisRealY !== null) {
            const fanLabel = Math.round(fanMm || (innerH * FR + FRAME_FACE + MULLION_W / 2));
            svg += EstimateRenderer.sashDimVLeft(ox - DM * 0.55, oy, SY(transomAxisRealY), ox, `${fanLabel}`, fs * 0.9);
        }

        // Section-width caption for triple layouts (matches 3D guides / Light Sections row)
        if (['130','131','132','133'].includes(code)) {
            const capC = midSec > 0 ? midSec : Math.round(fw / 3);
            const capS = Math.round((fw - capC) / 2);
            const capY = oy - Math.max(6, M * 0.3);
            const capFs = fs * 0.85;
            svg += `<text x="${ox + capS / 2}" y="${capY}" font-size="${capFs}" fill="${G.navy}" text-anchor="middle" font-family="sans-serif">${capS}</text>`;
            svg += `<text x="${ox + capS + capC / 2}" y="${capY}" font-size="${capFs}" fill="${G.navy}" text-anchor="middle" font-family="sans-serif">${capC}</text>`;
            svg += `<text x="${ox + capS + capC + capS / 2}" y="${capY}" font-size="${capFs}" fill="${G.navy}" text-anchor="middle" font-family="sans-serif">${capS}</text>`;
        }
        return `<svg viewBox="0 0 ${totalW} ${totalH}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;max-width:340px;max-height:100%;display:block;margin:0 auto;">${svg}</svg>`;
    }

    // Left-side vertical dimension (mirror of sashDimV — text on the left)
    static sashDimVLeft(x, y1, y2, extFrom, label, fs) {
        const G = EstimateRenderer.SASH_GEO;
        const NS = 'vector-effect="non-scaling-stroke"';
        const t = fs * 0.35, over = fs * 0.55, off = fs * 1.0;
        const mid = (y1 + y2) / 2;
        let svg = '';
        svg += `<line x1="${extFrom}" y1="${y1}" x2="${x - over}" y2="${y1}" stroke="${G.dimRed}" stroke-width="0.6" stroke-dasharray="5,4" ${NS}/>`;
        svg += `<line x1="${extFrom}" y1="${y2}" x2="${x - over}" y2="${y2}" stroke="${G.dimRed}" stroke-width="0.6" stroke-dasharray="5,4" ${NS}/>`;
        svg += `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${G.dimRed}" stroke-width="1.3" ${NS}/>`;
        svg += `<line x1="${x - t}" y1="${y1}" x2="${x + t}" y2="${y1}" stroke="${G.dimRed}" stroke-width="1.3" ${NS}/>`;
        svg += `<line x1="${x - t}" y1="${y2}" x2="${x + t}" y2="${y2}" stroke="${G.dimRed}" stroke-width="1.3" ${NS}/>`;
        svg += `<text x="${x - off}" y="${mid}" fill="${G.dimRed}" font-family="Jost,sans-serif" font-size="${fs}" text-anchor="middle" transform="rotate(-90,${x - off},${mid})">${label}</text>`;
        return svg;
    }

    // ─── Main entry: sash front elevation (double / triple, flat / arch) ───
    static generateSashSVG(item, fc) {
        const G = EstimateRenderer.SASH_GEO;
        const NS = 'vector-effect="non-scaling-stroke"';

        const fw = fc.actualFrameWidth || item.width || 1000;
        const fh = fc.actualFrameHeight || item.height || 1500;
        const sashType = fc.sashType || 'double';
        const headType = fc.headType || 'flat';
        const splitRatio = fc.splitRatio || '1/4-1/2-1/4';
        const openingType = fc.openingType || 'both';
        const horns = fc.horns && fc.horns !== 'none';
        const hornType = (typeof fc.horns === 'string' && fc.horns.length === 1) ? fc.horns.toUpperCase() : (fc.hornType || 'A');
        const upperBars = fc.upperBars || 'none';
        const lowerBars = fc.lowerBars || upperBars;
        const upperCustom = fc.upperCustomBars || (fc.customBars && fc.customBars.upper ? [].concat((fc.customBars.upper.horizontal||[]),(fc.customBars.upper.vertical||[])) : []);
        const lowerCustom = (fc.lowerCustomBars && fc.lowerCustomBars.length) ? fc.lowerCustomBars : ((fc.customBars && fc.customBars.lower) ? [].concat((fc.customBars.lower.horizontal||[]),(fc.customBars.lower.vertical||[])) : upperCustom);

        // ── Layout (all mm) ──
        const M = Math.max(G.margin * 1.35, Math.max(fw, fh) * 0.085);
        const DM = Math.max(G.dimOffset, Math.max(fw, fh) * 0.07);
        const totalW = M + fw + DM + M;
        const totalH = M + fh + DM + M * 0.4;
        const ox = M, oy = M;
        const fs = 21 * (totalW / G.refW);   // dim text ≈ constant on screen

        const SY = (y) => oy + (fh - y);     // real-Y (0=sill bottom) → SVG-Y
        const frameStyle = `fill="${G.frameFill}" stroke="${G.navy}" stroke-width="1.4" ${NS}`;

        // Arch rise (visual, glazing arch on upper sash + head follows)
        const archRise = headType === 'arch' ? Math.min(fw * 0.14, 150) : 0;

        let svg = '';

        // ══ BOX FRAME ══
        // Right jamb (with sill-junction curve)
        svg += `<path d="M ${ox + fw - G.jambBot} ${SY(0)} L ${ox + fw - G.jambBot} ${SY(G.sillTop)} ${EstimateRenderer.sashBulgeArc(ox + fw - G.jambBot, SY(G.sillTop), ox + fw - G.jambTop, SY(G.sillCurveTop), G.bulge)} L ${ox + fw - G.jambTop} ${SY(fh)} L ${ox + fw} ${SY(fh)} L ${ox + fw} ${SY(0)} Z" ${frameStyle}/>`;
        // Left jamb (mirrored)
        svg += `<path d="M ${ox + G.jambBot} ${SY(0)} L ${ox + G.jambBot} ${SY(G.sillTop)} ${EstimateRenderer.sashBulgeArc(ox + G.jambBot, SY(G.sillTop), ox + G.jambTop, SY(G.sillCurveTop), -G.bulge)} L ${ox + G.jambTop} ${SY(fh)} L ${ox} ${SY(fh)} L ${ox} ${SY(0)} Z" ${frameStyle}/>`;
        // Head (arch: curved underside)
        if (archRise > 0) {
            svg += `<path d="M ${ox + G.jambTop} ${SY(fh)} L ${ox + fw - G.jambTop} ${SY(fh)} L ${ox + fw - G.jambTop} ${SY(fh - G.headH) + archRise} Q ${ox + fw/2} ${SY(fh - G.headH) - archRise} ${ox + G.jambTop} ${SY(fh - G.headH) + archRise} Z" ${frameStyle}/>`;
        } else {
            svg += `<path d="M ${ox + G.jambTop} ${SY(fh)} L ${ox + fw - G.jambTop} ${SY(fh)} L ${ox + fw - G.jambTop} ${SY(fh - G.headH)} L ${ox + G.jambTop} ${SY(fh - G.headH)} Z" ${frameStyle}/>`;
        }
        // Sill body
        svg += `<path d="M ${ox + G.jambBot} ${SY(0)} L ${ox + fw - G.jambBot} ${SY(0)} L ${ox + fw - G.jambBot} ${SY(G.sillNose)} L ${ox + G.jambBot} ${SY(G.sillNose)} Z" ${frameStyle}/>`;
        // Sill detail lines (weatherbar + drip — below sash, fully visible)
        svg += `<line x1="${ox + G.jambBot}" y1="${SY(G.sillWeatherbar)}" x2="${ox + fw - G.jambBot}" y2="${SY(G.sillWeatherbar)}" stroke="${G.navy}" stroke-width="0.6" opacity="0.55" ${NS}/>`;
        svg += `<line x1="${ox + G.jambBot}" y1="${SY(G.sillDrip)}" x2="${ox + fw - G.jambBot}" y2="${SY(G.sillDrip)}" stroke="${G.navy}" stroke-width="0.6" opacity="0.55" ${NS}/>`;

        // ══ CAVITY (inner light) ══
        const cavTop = SY(fh - G.headH) + (archRise > 0 ? archRise : 0);
        const cavBot = SY(G.sillTop);

        if (sashType === 'triple') {
            // Split ratios
            let lR = 0.25, cR = 0.5;
            if (splitRatio === '1/3-1/3-1/3') { lR = 1/3; cR = 1/3; }
            else if (splitRatio === '1/5-3/5-1/5') { lR = 0.2; cR = 0.6; }

            const innerW = fw - 2 * G.jambTop - 2 * G.mullionW;
            const leftW = innerW * lR, centerW = innerW * cR, rightW = innerW - leftW - centerW;
            const lX = ox + G.jambTop;
            const m1X = lX + leftW, cX = m1X + G.mullionW;
            const m2X = cX + centerW, rX = m2X + G.mullionW;

            // Mullions
            [m1X, m2X].forEach(mx => {
                svg += `<rect x="${mx}" y="${cavTop - (archRise>0?archRise:0)}" width="${G.mullionW}" height="${cavBot - cavTop + (archRise>0?archRise:0)}" ${frameStyle}/>`;
            });

            // Center: full double-hung
            const c = EstimateRenderer.sashUnitSVG(cX, cavTop, centerW, cavBot - cavTop, {
                upperBars, lowerBars, upperCustom, lowerCustom,
                horns, hornType, openingType, archRise
            });
            svg += c.svg;

            // Side FIX panels — split at meeting-rail height, fix bars
            const fixTop = { bars: fc.fixUpperBars || 'none', custom: fc.fixUpperCustomBars || [] };
            const fixBot = { bars: fc.fixLowerBars || fixTop.bars, custom: (fc.fixLowerCustomBars && fc.fixLowerCustomBars.length) ? fc.fixLowerCustomBars : fixTop.custom };
            const glassStyle = `fill="${G.glassFill}" stroke="${G.glassStroke}" stroke-width="0.8" ${NS}`;
            const labelStyle = `fill="${G.navy}" opacity="0.35" font-family="Jost,sans-serif" font-size="${Math.max(50, leftW*0.18)}" text-anchor="middle" letter-spacing="6"`;

            [[lX, leftW], [rX, rightW]].forEach(([px, pw]) => {
                const gX = px + G.stile, gW = pw - 2 * G.stile;
                // upper fix glass
                const ugY = cavTop + G.topRail + (archRise > 0 ? archRise * 0.5 : 0);
                const ugH = c.meetY - G.meetRail/2 - ugY;
                svg += `<rect x="${gX}" y="${ugY}" width="${gW}" height="${ugH}" ${glassStyle}/>`;
                svg += EstimateRenderer.sashBarsSVG(gX, ugY, gW, ugH, fixTop.bars, fixTop.custom);
                // transom line at meeting height
                svg += `<rect x="${px}" y="${c.meetY - G.meetRail/2}" width="${pw}" height="${G.meetRail}" fill="${G.frameFill}" stroke="${G.navy}" stroke-width="0.8" ${NS}/>`;
                // lower fix glass
                const lgY = c.meetY + G.meetRail/2;
                const lgH = cavBot - G.botRail - lgY;
                svg += `<rect x="${gX}" y="${lgY}" width="${gW}" height="${lgH}" ${glassStyle}/>`;
                svg += EstimateRenderer.sashBarsSVG(gX, lgY, gW, lgH, fixBot.bars, fixBot.custom);
                svg += `<text x="${px + pw/2}" y="${lgY + lgH/2}" ${labelStyle}>FIX</text>`;
            });
        } else {
            // ── DOUBLE ──
            const cavX = ox + G.jambTop;
            const cavW = fw - 2 * G.jambTop;
            const u = EstimateRenderer.sashUnitSVG(cavX, cavTop, cavW, cavBot - cavTop, {
                upperBars, lowerBars, upperCustom, lowerCustom,
                horns, hornType, openingType, archRise
            });
            svg += u.svg;
        }

        // ══ RED DIMENSIONS ══
        svg += EstimateRenderer.sashDimH(oy + fh + DM * 0.75, ox, ox + fw, oy + fh, `${Math.round(fw)}`, fs);
        svg += EstimateRenderer.sashDimV(ox + fw + DM * 0.75, oy, oy + fh, ox + fw, `${Math.round(fh)}`, fs);

        return `<svg viewBox="0 0 ${totalW} ${totalH}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;max-width:340px;max-height:100%;display:block;margin:0 auto;">${svg}</svg>`;
    }

    static generateWindowSVG(item) {
        const spec = item.specification ? (typeof item.specification === 'string' ? JSON.parse(item.specification) : item.specification) : {};
        const fc = spec.fullConfig || spec || {};

        // ═══ CASEMENT SVG ═══
        const windowType = fc.windowType || fc.windowCategory || 'sash';
        if (windowType === 'casement') {
            // Arched casement stays on legacy renderer (v2 = stage 2); standard → v2
            if (fc.casementType === 'arched') {
                return EstimateRenderer.generateCasementSVG(item, fc);
            }
            return EstimateRenderer.generateCasementSVGv2(item, fc);
        }

        // ═══ FIX-ONLY SVG ═══
        if (windowType === 'fix-only') {
            return EstimateRenderer.generateFixFrameSVG(item, fc);
        }

        // ═══ DOOR SVG ═══
        if (windowType === 'door') {
            return EstimateRenderer.generateDoorSVG(item, fc);
        }

        // ═══ SASH SVG v2 — real-mm geometry ═══
        return EstimateRenderer.generateSashSVG(item, fc);

        // ═══ SASH SVG (legacy — unreachable, kept pending approval to remove) ═══
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
        const dimColor = '#0A1628';
        const dimFont = 'font-family="Jost,sans-serif" font-size="9" font-weight="500" fill="' + dimColor + '"';

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

            return `<svg width="${svgW}" height="${dimY2 + 18}" viewBox="0 0 ${svgW} ${dimY2 + 18}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;max-height:100%;width:auto;height:auto;display:block;margin:0 auto;">${svg}</svg>`;

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
                svg += `<text x="${arrowX}" y="${oy + sh/2 + 3}" font-family="Jost,sans-serif" font-size="9" font-weight="500" fill="rgba(10,22,40,.3)" text-anchor="middle">FIX</text>`;
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

            return `<svg width="${svgW}" height="${dimY2 + 18}" viewBox="0 0 ${svgW} ${dimY2 + 18}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;max-height:100%;width:auto;height:auto;display:block;margin:0 auto;">${svg}</svg>`;
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
        const fanH = Math.min(2, fc.casementFanHBars || 0);
        const fanV = Math.min(2, fc.casementFanVBars || 0);
        const fan2H = Math.min(2, fc.casementFan2HBars || 0);
        const fan2V = Math.min(2, fc.casementFan2VBars || 0);
        const fanlightHeight = (['021','031','032','052L','052R','022','131','132','133','013','023'].includes(fc.casementLayout || fc.layout || '')) ? (fc.fanlightHeight || 0) : 0; // layout gate: never show fan fields for fan-less layouts (legacy records)
        // Transom AXIS convention: stored value = frame top -> transom centre; zone = axis - 91
        const fanZoneB = fanlightHeight > 0 ? Math.max(fanlightHeight - 91, 0) : 0;
        const FR = fanZoneB > 0 ? fanZoneB / h : 0.25;

        const stroke = 'rgba(10,22,40,.7)';
        const light = 'rgba(10,22,40,.25)';
        const dimColor = '#0A1628';
        const dimFont = `font-family="Jost,sans-serif" font-size="9" font-weight="500" fill="${dimColor}"`;
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
        const FR2 = Math.max(0.15, Math.min(0.5, ((parseFloat(fc.casementFan2Height) > 0 ? (h - parseFloat(fc.casementFan2Height) - 102) : 0) || ih * 0.3) / ih));
        const panels = EstimateRenderer._casementPanels(layout, iw, ih, mW, FR, FR2);
        // Clickable openers overlay — switch2 panel order can differ from the canonical
        // def (e.g. 132), so match panels GEOMETRICALLY, not by index.
        if (Array.isArray(fc.casementHinges) && panels && panels.list) {
            try {
                const cdef = EstimateRenderer.casementLayoutDef(layout, iw, ih, ih + 125, FR, FR2);
                if (cdef && cdef.panels && cdef.panels.length === panels.list.length) {
                    const canon = cdef.panels.map((p, idx) => ({
                        idx, x: iw / 2 + p.x - p.w / 2, y: ih / 2 - p.y - p.h / 2, w: p.w, h: p.h
                    }));
                    const H022 = ['top', 'top', 'left', 'right'];
                    const norm = fc.casementHinges.map((v, i) => {
                        if (v === true) return layout === '022' ? H022[i] : (cdef.panels[i] ? cdef.panels[i].hinge : 'fixed');
                        if (v === false) return 'fixed';
                        return v;
                    });
                    panels.list = panels.list.map(pl => {
                        let best = -1, bd = Infinity;
                        canon.forEach(c => {
                            const d = Math.abs(c.x - pl.x) + Math.abs(c.y - pl.y) + Math.abs(c.w - pl.w) + Math.abs(c.h - pl.h);
                            if (d < bd) { bd = d; best = c.idx; }
                        });
                        const h = bd < 150 ? norm[best] : undefined; // tolerance: 57/68 face asymmetry + half-mullion offsets (max ~70mm); nearest WRONG pane is >=300mm away
                        return (h === 'fixed' || h === 'left' || h === 'right' || h === 'top')
                            ? Object.assign({}, pl, { hinge: h }) : pl;
                    });
                }
            } catch (e) { /* safe fallback: original hinges */ }
        }

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
            if (hBars > 0 || vBars > 0 || fanH > 0 || fanV > 0 || fan2H > 0 || fan2V > 0) {
                if (p.fanlight2) {
                    for (let i = 1; i <= fan2H; i++) {
                        const by = py + (ph / (fan2H + 1)) * i;
                        svg += `<line x1="${px+2}" y1="${by}" x2="${px+pw-2}" y2="${by}" stroke="${stroke}" stroke-width="0.4"/>`;
                    }
                    for (let i = 1; i <= fan2V; i++) {
                        const bx = px + (pw / (fan2V + 1)) * i;
                        svg += `<line x1="${bx}" y1="${py+2}" x2="${bx}" y2="${py+ph-2}" stroke="${stroke}" stroke-width="0.4"/>`;
                    }
                } else if (p.fanlight) {
                    for (let i = 1; i <= fanH; i++) {
                        const by = py + (ph / (fanH + 1)) * i;
                        svg += `<line x1="${px+2}" y1="${by}" x2="${px+pw-2}" y2="${by}" stroke="${stroke}" stroke-width="0.4"/>`;
                    }
                    for (let i = 1; i <= fanV; i++) {
                        const bx = px + (pw / (fanV + 1)) * i;
                        svg += `<line x1="${bx}" y1="${py+2}" x2="${bx}" y2="${py+ph-2}" stroke="${stroke}" stroke-width="0.4"/>`;
                    }
                } else {
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
            const fanSeg = Math.max(fanlightHeight - extFrame - extTransom / 2, 0);  // ext head face -> ext transom face (axis-based)
            const mainH = h - extFrame - extBottom - extTransom - fanSeg;
            hSegs = [extFrame, fanSeg, extTransom, Math.max(mainH, 0), extBottom];
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
            const fhScaled = fanlightHeight * scale;   // frame top -> transom axis
            svg += `<line x1="${fhDimX}" y1="${oy}" x2="${fhDimX}" y2="${oy + fhScaled}" stroke="${dimColor}" stroke-width="0.4"/>`;
            svg += `<line x1="${fhDimX - tickH}" y1="${oy}" x2="${fhDimX + tickH}" y2="${oy}" stroke="${dimColor}" stroke-width="0.4"/>`;
            svg += `<line x1="${fhDimX - tickH}" y1="${oy + fhScaled}" x2="${fhDimX + tickH}" y2="${oy + fhScaled}" stroke="${dimColor}" stroke-width="0.4"/>`;
            svg += `<text x="${fhDimX - 2}" y="${oy + fhScaled/2 + 2}" ${dimFont} transform="rotate(-90,${fhDimX - 2},${oy + fhScaled/2})" font-size="5.5">${fanlightHeight}</text>`;
        }

        const totalH = dimY + (wSegs.length > 1 ? 32 : 18);
        return `<svg width="${svgW}" height="${totalH}" viewBox="0 0 ${svgW} ${totalH}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;max-height:100%;width:auto;height:auto;display:block;margin:0 auto;">${svg}</svg>`;
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
        const dimColor = '#0A1628';
        const dimFont = `font-family="Jost,sans-serif" font-size="9" font-weight="500" fill="${dimColor}"`;
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
        return `<svg width="${svgW}" height="${totalH}" viewBox="0 0 ${svgW} ${totalH}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;max-height:100%;width:auto;height:auto;display:block;margin:0 auto;">${svg}</svg>`;
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
        const dimColor = '#0A1628';
        const dimFont = `font-family="Jost,sans-serif" font-size="9" font-weight="500" fill="${dimColor}"`;

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
            return `<svg width="${svgW}" height="${totalH}" viewBox="0 0 ${svgW} ${totalH}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;max-height:100%;width:auto;height:auto;display:block;margin:0 auto;">${svg}</svg>`;

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
            return `<svg width="${svgW}" height="${totalH}" viewBox="0 0 ${svgW} ${totalH}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;max-height:100%;width:auto;height:auto;display:block;margin:0 auto;">${svg}</svg>`;
        }
    }

    // Panel layout definitions for casement SVG
    static _casementPanels(code, iw, ih, mW, FR, FR2) {
        const half = (iw - mW) / 2;
        const third = (iw - mW * 2) / 3;
        const fH = ih * FR;
        const mainH = ih - mW - fH;
        const f2H = ih * (FR2 || 0.3);
        const tierMidH = ih - fH - f2H - mW * 2;
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
            case '022':
                return {
                    mullions: [iw/2],
                    transoms: [{ y:fH+mW/2, x:0, w:half },{ y:fH+mW/2, x:half+mW, w:half }],
                    list: [
                        { x:0,y:0,w:half,h:fH,hinge:'top',fanlight:true },
                        { x:half+mW,y:0,w:half,h:fH,hinge:'top',fanlight:true },
                        { x:0,y:fH+mW,w:half,h:mainH,hinge:'fixed' },
                        { x:half+mW,y:fH+mW,w:half,h:mainH,hinge:'fixed' }
                    ]
                };
            case '133':
                return {
                    mullions: [third, third*2+mW],
                    transoms: [
                        { y:fH+mW/2, x:0, w:third-mW/2 },
                        { y:fH+mW/2, x:third+mW/2, w:third-mW/2 },
                        { y:fH+mW/2, x:third*2+mW+mW/2, w:third-mW/2 }
                    ],
                    list: [
                        { x:0,y:0,w:third-mW/2,h:fH,hinge:'top',fanlight:true },
                        { x:third+mW/2,y:0,w:third-mW/2,h:fH,hinge:'top',fanlight:true },
                        { x:third*2+mW+mW/2,y:0,w:third-mW/2,h:fH,hinge:'top',fanlight:true },
                        { x:0,y:fH+mW,w:third-mW/2,h:mainH,hinge:'fixed' },
                        { x:third+mW/2,y:fH+mW,w:third-mW/2,h:mainH,hinge:'fixed' },
                        { x:third*2+mW+mW/2,y:fH+mW,w:third-mW/2,h:mainH,hinge:'fixed' }
                    ]
                };
            case '013':
                return {
                    mullions: [],
                    transoms: [fH + mW/2, fH + mW + tierMidH + mW/2],
                    list: [
                        { x:0, y:0, w:iw, h:fH, hinge:'top', fanlight:true },
                        { x:0, y:fH+mW, w:iw, h:tierMidH, hinge:'left' },
                        { x:0, y:fH+mW+tierMidH+mW, w:iw, h:f2H, hinge:'fixed', fanlight2:true }
                    ]
                };
            case '023':
                return {
                    mullions: [half],
                    transoms: [
                        { y:fH+mW/2, x:0, w:half }, { y:fH+mW/2, x:half+mW, w:half },
                        { y:fH+mW+tierMidH+mW/2, x:0, w:half }, { y:fH+mW+tierMidH+mW/2, x:half+mW, w:half }
                    ],
                    list: [
                        { x:0, y:0, w:half, h:fH, hinge:'top', fanlight:true },
                        { x:half+mW, y:0, w:half, h:fH, hinge:'top', fanlight:true },
                        { x:0, y:fH+mW, w:half, h:tierMidH, hinge:'left' },
                        { x:half+mW, y:fH+mW, w:half, h:tierMidH, hinge:'right' },
                        { x:0, y:fH+mW+tierMidH+mW, w:half, h:f2H, hinge:'fixed', fanlight2:true },
                        { x:half+mW, y:fH+mW+tierMidH+mW, w:half, h:f2H, hinge:'fixed', fanlight2:true }
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
                        { x:0,y:0,w:iw,h:fH,hinge:'top' },
                        { x:0,y:fH+mW,w:iw,h:mainH,hinge:'right' }
                    ]
                };
            case '021R':
                return {
                    transoms: [fH + mW/2],
                    list: [
                        { x:0,y:0,w:iw,h:fH,hinge:'top' },
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
                        { x:0,y:0,w:half,h:fH,hinge:'top' },
                        { x:half+mW,y:0,w:half,h:fH,hinge:'top' },
                        { x:0,y:fH+mW,w:iw,h:mainH,hinge:'right' }
                    ]
                };
            case '031R':
                return {
                    transoms: [fH + mW/2],
                    mullions: [iw/2],
                    list: [
                        { x:0,y:0,w:half,h:fH,hinge:'top' },
                        { x:half+mW,y:0,w:half,h:fH,hinge:'top' },
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
            case '140L': {
                const qW = (iw - mW * 3) / 4;
                return {
                    mullions: [qW, qW*2+mW, qW*3+mW*2],
                    list: [
                        { x:0,y:0,w:qW,h:ih,hinge:'left' },
                        { x:qW+mW,y:0,w:qW,h:ih,hinge:'fixed' },
                        { x:qW*2+mW*2,y:0,w:qW,h:ih,hinge:'fixed' },
                        { x:qW*3+mW*3,y:0,w:qW,h:ih,hinge:'fixed' }
                    ]
                };
            }
            case '140R': {
                const qW = (iw - mW * 3) / 4;
                return {
                    mullions: [qW, qW*2+mW, qW*3+mW*2],
                    list: [
                        { x:0,y:0,w:qW,h:ih,hinge:'fixed' },
                        { x:qW+mW,y:0,w:qW,h:ih,hinge:'fixed' },
                        { x:qW*2+mW*2,y:0,w:qW,h:ih,hinge:'fixed' },
                        { x:qW*3+mW*3,y:0,w:qW,h:ih,hinge:'right' }
                    ]
                };
            }
            default:
                return { list: [{ x:0,y:0,w:iw,h:ih,hinge:'right' }] };
        }
    }

    // ─── Door SVG Drawing ───
    static generateDoorSVG(item, fc) {
        const w = fc.actualFrameWidth || item.width || 900;
        const h = fc.actualFrameHeight || item.height || 2100;
        const hingeSide = fc.hingeSide || 'left';
        const sidePanels = fc.sidePanels || 'none';
        const sideLeftW = fc.sideLeftWidth || 500;
        const sideRightW = fc.sideRightWidth || 500;
        const hBars = fc.hBars || fc.doorHBars || 0;
        const vBars = fc.vBars || fc.doorVBars || 0;
        const sideHBars = fc.sideHBars || 0;
        const sideVBars = fc.sideVBars || 0;
        const sideStyle = fc.sideStyle || 'full-glass';
        const doorStyle = fc.doorStyle || 'full-glass';

        // Transom / fanlight (french only) — coupled unit stacked above the doors
        const transomType = fc.transomType || 'none';
        const transomH = parseInt(fc.transomHeight) || 0;
        const transomBars = fc.transomBars || 'none';
        const hasTransom = (fc.doorType === 'french' || fc.doorType === 'front-door') && transomType !== 'none' && transomH > 0;
        const unitH = h + (hasTransom ? transomH : 0);

        // Bottom rail ratio based on door style
        const bottomRailRatio = doorStyle === 'half-glazed' ? 0.50 : doorStyle === 'three-quarter' ? 0.28 : 0;

        const hasLeft = sidePanels === 'left' || sidePanels === 'both';
        const hasRight = sidePanels === 'right' || sidePanels === 'both';
        const totalW = w + (hasLeft ? sideLeftW : 0) + (hasRight ? sideRightW : 0);

        // SVG sizing
        const svgW = 280, svgH = 260;
        const maxDrawW = 240, maxDrawH = 200;
        const scale = Math.min(maxDrawW / totalW, maxDrawH / unitH);
        const drawW = totalW * scale;
        const drawH = h * scale;
        const ox = (svgW - drawW) / 2;
        const oyUnit = 10;                                    // top of the whole unit
        const transomDrawH = hasTransom ? transomH * scale : 0;
        const drawUnitH = drawH + transomDrawH;
        const oy = oyUnit + transomDrawH;                     // top of the door section
        const frameT = 8; // frame thickness in SVG px

        const dark = '#1a2a3a';
        const mid = '#4a5568';
        const light = '#a0aec0';
        const glass = '#dbeafe';
        const panel = '#e8e4dc';

        let svg = `<svg viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}" xmlns="http://www.w3.org/2000/svg" style="font-family:'Jost',sans-serif;">`;

        // Outer frame (full unit — doors + transom share one coupled frame)
        svg += `<rect x="${ox}" y="${oyUnit}" width="${drawW}" height="${drawUnitH}" fill="none" stroke="${dark}" stroke-width="2.5" rx="1"/>`;

        let doorX = ox;
        if (hasLeft) doorX += sideLeftW * scale;
        const doorW = w * scale;

        // Helper: draw side panel (full-glass or same-as-door)
        function drawSidePanel(px, py, pw, ph, shBars, svBars) {
            if (sideStyle === 'same' && bottomRailRatio > 0) {
                // Same as door: glass top + bottom rail
                const brH = ph * bottomRailRatio;
                const glH = ph - brH;
                svg += `<rect x="${px + 4}" y="${py + 4}" width="${pw - 8}" height="${glH - 4}" fill="${glass}" stroke="${mid}" stroke-width="0.8" rx="1"/>`;
                svg += `<rect x="${px}" y="${py + glH}" width="${pw}" height="${brH}" fill="${panel}" stroke="${mid}" stroke-width="0.8" rx="1"/>`;
                // Bars on glass area only
                for (let i = 1; i <= shBars; i++) {
                    const by = py + 4 + (glH - 4) * i / (shBars + 1);
                    svg += `<line x1="${px + 4}" y1="${by}" x2="${px + pw - 4}" y2="${by}" stroke="${light}" stroke-width="1"/>`;
                }
                for (let i = 1; i <= svBars; i++) {
                    const bx = px + 4 + (pw - 8) * i / (svBars + 1);
                    svg += `<line x1="${bx}" y1="${py + 4}" x2="${bx}" y2="${py + glH}" stroke="${light}" stroke-width="1"/>`;
                }
            } else {
                // Full glass
                svg += `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="${glass}" stroke="${mid}" stroke-width="1.5" rx="1"/>`;
                for (let i = 1; i <= shBars; i++) {
                    const by = py + ph * i / (shBars + 1);
                    svg += `<line x1="${px}" y1="${by}" x2="${px + pw}" y2="${by}" stroke="${light}" stroke-width="1"/>`;
                }
                for (let i = 1; i <= svBars; i++) {
                    const bx = px + pw * i / (svBars + 1);
                    svg += `<line x1="${bx}" y1="${py}" x2="${bx}" y2="${py + ph}" stroke="${light}" stroke-width="1"/>`;
                }
            }
        }

        // ── Left side panel ──
        if (hasLeft) {
            drawSidePanel(ox + frameT, oy + frameT, sideLeftW * scale - frameT * 2, drawH - frameT * 2, sideHBars, sideVBars);
        }

        // ── Right side panel ──
        if (hasRight) {
            drawSidePanel(doorX + doorW + frameT, oy + frameT, sideRightW * scale - frameT * 2, drawH - frameT * 2, sideHBars, sideVBars);
        }

        // ── Mullion lines between panels and door ──
        if (hasLeft) {
            const mx = doorX;
            svg += `<line x1="${mx}" y1="${oy}" x2="${mx}" y2="${oy + drawH}" stroke="${dark}" stroke-width="2"/>`;
        }
        if (hasRight) {
            const mx = doorX + doorW;
            svg += `<line x1="${mx}" y1="${oy}" x2="${mx}" y2="${oy + drawH}" stroke="${dark}" stroke-width="2"/>`;
        }

        // ── Transom / fanlight band (french only) ──
        if (hasTransom) {
            const ti = Math.min(frameT, Math.max(2, transomDrawH * 0.22));   // inset inside the band
            // Internal rail: door head = transom cill (one coupled frame)
            svg += `<line x1="${ox}" y1="${oy}" x2="${ox + drawW}" y2="${oy}" stroke="${dark}" stroke-width="2.5"/>`;
            const tPanes = [];
            if (hasLeft) tPanes.push({ x: ox, w: sideLeftW * scale, bars: transomBars === 'match' ? sideVBars : 0 });
            tPanes.push({ x: doorX, w: doorW, bars: transomBars === 'match' ? (vBars > 0 ? vBars * 2 + 1 : 0) : 0, main: true });
            if (hasRight) tPanes.push({ x: doorX + doorW, w: sideRightW * scale, bars: transomBars === 'match' ? sideVBars : 0 });
            tPanes.forEach((pn, pi) => {
                if (pi > 0) {
                    svg += `<line x1="${pn.x}" y1="${oyUnit}" x2="${pn.x}" y2="${oy}" stroke="${dark}" stroke-width="2"/>`;
                }
                const gx = pn.x + ti, gy = oyUnit + ti;
                const gw = pn.w - ti * 2, gh = transomDrawH - ti * 2;
                if (gw <= 0 || gh <= 0) return;
                svg += `<rect x="${gx}" y="${gy}" width="${gw}" height="${gh}" fill="${glass}" stroke="${mid}" stroke-width="0.8" rx="1"/>`;
                for (let bi = 1; bi <= pn.bars; bi++) {
                    const bx = gx + gw * bi / (pn.bars + 1);
                    svg += `<line x1="${bx}" y1="${gy}" x2="${bx}" y2="${gy + gh}" stroke="${light}" stroke-width="1"/>`;
                }
                if (pn.main && transomType === 'opening') {
                    // Top-hung symbol (apex at the bottom edge)
                    svg += `<polyline points="${gx + 1},${gy + 1} ${gx + gw / 2},${gy + gh - 1} ${gx + gw - 1},${gy + 1}" fill="none" stroke="${mid}" stroke-width="0.9" stroke-dasharray="3 2"/>`;
                }
            });
        }

        // ── Door leaf(s) ──
        const doorType = fc.doorType || 'single-external';
        const isFrench = doorType === 'french';
        const isSliding = doorType === 'sliding';
        const isBifold = doorType === 'bifold';
        const leafY = oy + frameT;
        const leafH = drawH - frameT * 2;
        const bottomRailH = bottomRailRatio > 0 ? leafH * bottomRailRatio : 0;
        const glassH = leafH - bottomRailH;

        // Helper: draw one door leaf with glass, bars, handle, hinges
        function drawLeaf(lx, lw, hingeOnLeft) {
            // Leaf outline
            svg += `<rect x="${lx}" y="${leafY}" width="${lw}" height="${leafH}" fill="none" stroke="${mid}" stroke-width="1.5" rx="1"/>`;
            // Glass area
            const gx = lx + 4, gw = lw - 8, gy = leafY;
            svg += `<rect x="${gx}" y="${gy + 4}" width="${gw}" height="${glassH - 4}" fill="${glass}" stroke="${mid}" stroke-width="0.8" rx="1"/>`;
            // Bottom rail
            if (bottomRailH > 0) {
                svg += `<rect x="${lx}" y="${leafY + glassH}" width="${lw}" height="${bottomRailH}" fill="${panel}" stroke="${mid}" stroke-width="0.8" rx="1"/>`;
            }
            // Georgian bars
            for (let i = 1; i <= hBars; i++) {
                const by = gy + 4 + (glassH - 4) * i / (hBars + 1);
                svg += `<line x1="${gx}" y1="${by}" x2="${gx + gw}" y2="${by}" stroke="${light}" stroke-width="1"/>`;
            }
            for (let i = 1; i <= vBars; i++) {
                const bx = gx + gw * i / (vBars + 1);
                svg += `<line x1="${bx}" y1="${gy + 4}" x2="${bx}" y2="${gy + glassH}" stroke="${light}" stroke-width="1"/>`;
            }
            // Handle (opposite side of hinge)
            const hx = hingeOnLeft ? lx + lw - 12 : lx + 12;
            const hy = leafY + leafH * 0.48;
            svg += `<circle cx="${hx}" cy="${hy}" r="4" fill="${dark}" stroke="none"/>`;
            svg += `<line x1="${hx}" y1="${hy - 8}" x2="${hx}" y2="${hy + 8}" stroke="${dark}" stroke-width="2" stroke-linecap="round"/>`;
            // Hinge indicators
            const hix = hingeOnLeft ? lx - 1 : lx + lw + 1;
            const hdir = hingeOnLeft ? -1 : 1;
            [0.12, 0.5, 0.88].forEach(ratio => {
                const hy2 = leafY + leafH * ratio;
                svg += `<polygon points="${hix},${hy2 - 4} ${hix + hdir * 5},${hy2} ${hix},${hy2 + 4}" fill="${mid}"/>`;
            });
        }

        if (isSliding) {
            // ── Sliding door panels ──
            const panelCount = fc.panelCount || 2;
            const slideDir = fc.slideDirection || 'left-to-right';
            const innerW = doorW - frameT * 2;
            const panelW = innerW / panelCount;
            const stileOverlap = 3; // visual overlap between panels

            for (let i = 0; i < panelCount; i++) {
                const px = doorX + frameT + i * panelW;
                const pw = panelW + stileOverlap;
                // Panel outline
                svg += `<rect x="${px}" y="${leafY}" width="${pw}" height="${leafH}" fill="none" stroke="${mid}" stroke-width="1.5" rx="1"/>`;
                // Glass
                const gx = px + 4, gw = pw - 8, gy = leafY;
                svg += `<rect x="${gx}" y="${gy + 4}" width="${gw}" height="${glassH - 4}" fill="${glass}" stroke="${mid}" stroke-width="0.8" rx="1"/>`;
                // Bottom rail
                if (bottomRailH > 0) {
                    svg += `<rect x="${px}" y="${leafY + glassH}" width="${pw}" height="${bottomRailH}" fill="${panel}" stroke="${mid}" stroke-width="0.8" rx="1"/>`;
                }
                // Bars
                for (let b = 1; b <= hBars; b++) {
                    const by = gy + 4 + (glassH - 4) * b / (hBars + 1);
                    svg += `<line x1="${gx}" y1="${by}" x2="${gx + gw}" y2="${by}" stroke="${light}" stroke-width="1"/>`;
                }
                for (let b = 1; b <= vBars; b++) {
                    const bx = gx + gw * b / (vBars + 1);
                    svg += `<line x1="${bx}" y1="${gy + 4}" x2="${bx}" y2="${gy + glassH}" stroke="${light}" stroke-width="1"/>`;
                }
                // Meeting stile lines between panels
                if (i > 0) {
                    svg += `<line x1="${px}" y1="${leafY}" x2="${px}" y2="${leafY + leafH}" stroke="${mid}" stroke-width="1.5"/>`;
                }
            }

            // Handle on first sliding panel
            const isRTL = slideDir === 'right-to-left';
            const handlePanelIdx = isRTL ? panelCount - 1 : 0;
            const hpx = doorX + frameT + handlePanelIdx * panelW;
            const handleX = isRTL ? hpx + 12 : hpx + panelW - 12;
            const handleYPos = leafY + leafH * 0.48;
            svg += `<circle cx="${handleX}" cy="${handleYPos}" r="4" fill="${dark}" stroke="none"/>`;
            svg += `<line x1="${handleX}" y1="${handleYPos - 8}" x2="${handleX}" y2="${handleYPos + 8}" stroke="${dark}" stroke-width="2" stroke-linecap="round"/>`;

            // Slide direction arrows below frame
            const arrowY = leafY + leafH + 6;
            const arrowLen = 18;
            if (slideDir === 'left-to-right' || slideDir === 'right-to-left') {
                const ax = doorX + doorW / 2;
                const dir = slideDir === 'left-to-right' ? 1 : -1;
                svg += `<line x1="${ax - dir * arrowLen}" y1="${arrowY}" x2="${ax + dir * arrowLen}" y2="${arrowY}" stroke="${mid}" stroke-width="1.5"/>`;
                svg += `<polygon points="${ax + dir * arrowLen},${arrowY} ${ax + dir * (arrowLen - 5)},${arrowY - 3} ${ax + dir * (arrowLen - 5)},${arrowY + 3}" fill="${mid}"/>`;
            } else if (slideDir === 'from-center') {
                const cx = doorX + doorW / 2;
                svg += `<line x1="${cx}" y1="${arrowY}" x2="${cx - arrowLen}" y2="${arrowY}" stroke="${mid}" stroke-width="1.5"/>`;
                svg += `<polygon points="${cx - arrowLen},${arrowY} ${cx - arrowLen + 5},${arrowY - 3} ${cx - arrowLen + 5},${arrowY + 3}" fill="${mid}"/>`;
                svg += `<line x1="${cx}" y1="${arrowY}" x2="${cx + arrowLen}" y2="${arrowY}" stroke="${mid}" stroke-width="1.5"/>`;
                svg += `<polygon points="${cx + arrowLen},${arrowY} ${cx + arrowLen - 5},${arrowY - 3} ${cx + arrowLen - 5},${arrowY + 3}" fill="${mid}"/>`;
            } else if (slideDir === 'from-sides') {
                const cx = doorX + doorW / 2;
                svg += `<line x1="${cx - arrowLen}" y1="${arrowY}" x2="${cx}" y2="${arrowY}" stroke="${mid}" stroke-width="1.5"/>`;
                svg += `<polygon points="${cx},${arrowY} ${cx - 5},${arrowY - 3} ${cx - 5},${arrowY + 3}" fill="${mid}"/>`;
                svg += `<line x1="${cx + arrowLen}" y1="${arrowY}" x2="${cx}" y2="${arrowY}" stroke="${mid}" stroke-width="1.5"/>`;
                svg += `<polygon points="${cx},${arrowY} ${cx + 5},${arrowY - 3} ${cx + 5},${arrowY + 3}" fill="${mid}"/>`;
            }
        } else if (isBifold) {
            // ── Bi-fold door panels ──
            const bfPanelCount = fc.panelCount || 4;
            const bfFoldDir = fc.foldDirection || 'left';
            const bfTraffic = fc.trafficDoor || 'no';
            const innerW = doorW - frameT * 2;
            const bfPanelW = innerW / bfPanelCount;

            // Traffic door index — opposite side of fold direction
            let trafficIdx = -1;
            if (bfTraffic === 'yes' && bfPanelCount >= 3) {
                trafficIdx = (bfFoldDir === 'left') ? bfPanelCount - 1 : 0;
            }

            for (let i = 0; i < bfPanelCount; i++) {
                const px = doorX + frameT + i * bfPanelW;
                const isTraffic = (i === trafficIdx);
                // Panel outline
                svg += `<rect x="${px + 1}" y="${leafY}" width="${bfPanelW - 2}" height="${leafH}" fill="none" stroke="${mid}" stroke-width="1.5" rx="1"/>`;
                // Glass area
                const gx = px + 5, gw = bfPanelW - 10;
                svg += `<rect x="${gx}" y="${leafY + 4}" width="${gw}" height="${glassH - 4}" fill="${glass}" stroke="${mid}" stroke-width="0.8" rx="1"/>`;
                if (bottomRailH > 0) {
                    svg += `<rect x="${px + 1}" y="${leafY + glassH}" width="${bfPanelW - 2}" height="${bottomRailH}" fill="${panel}" stroke="${mid}" stroke-width="0.8" rx="1"/>`;
                }
                // Bars
                for (let b = 1; b <= hBars; b++) {
                    const by = leafY + 4 + (glassH - 4) * b / (hBars + 1);
                    svg += `<line x1="${gx}" y1="${by}" x2="${gx + gw}" y2="${by}" stroke="${light}" stroke-width="1"/>`;
                }
                for (let b = 1; b <= vBars; b++) {
                    const bx = gx + gw * b / (vBars + 1);
                    svg += `<line x1="${bx}" y1="${leafY + 4}" x2="${bx}" y2="${leafY + glassH}" stroke="${light}" stroke-width="1"/>`;
                }

                if (isTraffic) {
                    // Traffic door: hinge on frame side (opposite of fold), handle on free edge
                    const hingeX = (bfFoldDir === 'left') ? px + bfPanelW - 1 : px + 1;
                    const handleX = (bfFoldDir === 'left') ? px + 8 : px + bfPanelW - 8;
                    [0.15, 0.5, 0.85].forEach(r => {
                        svg += `<circle cx="${hingeX}" cy="${leafY + leafH * r}" r="2" fill="${mid}"/>`;
                    });
                    svg += `<circle cx="${handleX}" cy="${leafY + leafH * 0.48}" r="3" fill="${dark}"/>`;
                    // TD label
                    svg += `<text x="${px + bfPanelW / 2}" y="${leafY + 12}" text-anchor="middle" font-size="7" fill="${mid}">TD</text>`;
                } else {
                    // Fold hinge dots between panels
                    if (i > 0) {
                        const hx = px + 1;
                        [0.2, 0.5, 0.8].forEach(r => {
                            svg += `<circle cx="${hx}" cy="${leafY + leafH * r}" r="1.5" fill="${light}"/>`;
                        });
                    }
                }
            }

            // Fold direction arrow
            const arrowY = leafY + leafH + 6;
            const arrowDir = (bfFoldDir === 'left') ? -1 : 1;
            const ax = doorX + doorW / 2;
            svg += `<line x1="${ax - arrowDir * 18}" y1="${arrowY}" x2="${ax + arrowDir * 18}" y2="${arrowY}" stroke="${mid}" stroke-width="1.5"/>`;
            svg += `<polygon points="${ax + arrowDir * 18},${arrowY} ${ax + arrowDir * 13},${arrowY - 3} ${ax + arrowDir * 13},${arrowY + 3}" fill="${mid}"/>`;
        } else if (isFrench) {
            // Two leaves, no mullion
            const halfDoorW = (doorW - frameT * 2) / 2;
            const leftLeafX = doorX + frameT;
            const rightLeafX = doorX + frameT + halfDoorW;
            drawLeaf(leftLeafX, halfDoorW, true);    // left leaf: hinge left
            drawLeaf(rightLeafX, halfDoorW, false);   // right leaf: hinge right
            // Meeting stile line
            svg += `<line x1="${rightLeafX}" y1="${leafY}" x2="${rightLeafX}" y2="${leafY + leafH}" stroke="${mid}" stroke-width="1" stroke-dasharray="3,2"/>`;
        } else {
            // Single leaf
            const leafX = doorX + frameT;
            const leafW = doorW - frameT * 2;
            drawLeaf(leafX, leafW, hingeSide === 'left');
        }

        // ── Dimensions ──
        const dimY = oy + drawH + 15;
        const fontSize = '11';
        const dimColor = '#0A1628';

        // Total width
        svg += `<text x="${ox + drawW / 2}" y="${dimY}" text-anchor="middle" font-size="${fontSize}" fill="${dimColor}">${totalW}mm</text>`;

        // Individual widths if panels
        if (hasLeft || hasRight) {
            const dimY2 = dimY + 13;
            let parts = [];
            if (hasLeft) parts.push({ x: ox + sideLeftW * scale / 2, label: sideLeftW });
            parts.push({ x: doorX + doorW / 2, label: w });
            if (hasRight) parts.push({ x: doorX + doorW + sideRightW * scale / 2, label: sideRightW });
            parts.forEach(pt => {
                svg += `<text x="${pt.x}" y="${dimY2}" text-anchor="middle" font-size="8" fill="${dimColor}">${pt.label}</text>`;
            });
        }

        // Height — total unit (doors + transom)
        const hDimY = oyUnit + drawUnitH / 2;
        svg += `<text x="${ox + drawW + 14}" y="${hDimY}" text-anchor="middle" font-size="${fontSize}" fill="${dimColor}" transform="rotate(90,${ox + drawW + 14},${hDimY})">${unitH}mm</text>`;
        if (hasTransom) {
            const tDimY = oyUnit + transomDrawH / 2;
            svg += `<text x="${ox + drawW + 5}" y="${tDimY}" text-anchor="middle" font-size="7" fill="${dimColor}" transform="rotate(90,${ox + drawW + 5},${tDimY})">${transomH}</text>`;
        }

        svg += '</svg>';
        return svg;
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
        if (estimate && estimate.estimate_items) estimate.estimate_items = R.sortWindowItems(estimate.estimate_items);
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
            const updatedAt = estimate.updated_at ? new Date(estimate.updated_at) : createdAt;
            const validUntil = new Date(createdAt);
            validUntil.setDate(validUntil.getDate() + 30);
            const fmtDate = d => d.toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });

            const estimateNumber = estimate.estimate_number || (estimate.id ? estimate.id.substring(0, 8) : 'DRAFT');
            const items = estimate.estimate_items || [];
            const totalEx = items.reduce((s, i) => s + parseFloat(i.total_price || 0), 0);

            // Additional services — read from DB extras (loaded by dashboard before calling downloadPDF)
            const extras = estimate.extras || [];
            const installationExtras = extras.filter(e => e.type === 'installation');
            const deliveryExtras = extras.filter(e => e.type === 'delivery');
            const customExtras = extras.filter(e => e.type === 'custom');
            const hasInstallation = installationExtras.length > 0;
            const hasDelivery = deliveryExtras.length > 0;
            const hasAnyExtras = extras.length > 0;
            const installationTotal = installationExtras.reduce((s, e) => s + parseFloat(e.total_price || 0), 0);
            const deliveryTotal = deliveryExtras.reduce((s, e) => s + parseFloat(e.total_price || 0), 0);
            const customTotal = customExtras.reduce((s, e) => s + parseFloat(e.total_price || 0), 0);
            const extrasTotalAll = installationTotal + deliveryTotal + customTotal;
            // Payment: windows 50/50, installation 50/50 (separate), delivery 100% after
            const windowsHalf = totalEx / 2;
            const installationHalf = installationTotal / 2;

            // ──────── SHARED STYLES ────────
            const pageStyle = `width:210mm;height:297mm;background:#fff;font-family:'Jost',sans-serif;color:#1a1a1a;box-sizing:border-box;overflow:hidden;position:relative;`;
            const serif = `'Cormorant Garamond', Georgia, serif`;

            const headerBar = `
                <div style="background:#0A1628;padding:16mm 10mm 10mm;color:#fff;">
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
                    <div style="padding:0 10mm;">
                        <div style="background:#0A1628;color:#fff;margin:10mm -10mm 0;padding:10mm 10mm;display:flex;justify-content:space-between;align-items:baseline;">
                            <span style="font-family:${serif};font-weight:700;font-size:42px;letter-spacing:.02em;">Quote</span>
                            <span style="font-family:'Jost',sans-serif;font-weight:400;font-size:20px;letter-spacing:.1em;">${estimateNumber}</span>
                        </div>
                        <table style="margin:10mm 0 6mm;border:1px solid #e5e4dd;border-collapse:collapse;width:100%;font-family:'Jost',sans-serif;font-size:12px;">
                            <tr style="border-bottom:1px solid #e5e4dd;">
                                <th style="background:#0A1628;color:#fff;font-weight:400;letter-spacing:.15em;font-size:10px;text-transform:uppercase;text-align:left;padding:10px 14px;width:40mm;">Date</th>
                                <td style="padding:10px 14px;color:#0A1628;font-weight:500;">${fmtDate(createdAt)}</td>
                            </tr>
                            <tr style="border-bottom:1px solid #e5e4dd;">
                                <th style="background:#0A1628;color:#fff;font-weight:400;letter-spacing:.15em;font-size:10px;text-transform:uppercase;text-align:left;padding:10px 14px;width:40mm;">Last updated</th>
                                <td style="padding:10px 14px;color:#0A1628;font-weight:500;">${fmtDate(updatedAt)}</td>
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
                            <tr>
                                <th style="background:#0A1628;color:#fff;font-weight:400;letter-spacing:.15em;font-size:10px;text-transform:uppercase;text-align:left;padding:10px 14px;width:40mm;">Valid until</th>
                                <td style="padding:10px 14px;">${fmtDate(validUntil)} (30 days from issue)</td>
                            </tr>
                        </table>
                    </div>
                </div>
            `;

            // ──────── PAGE: ABOUT (rendered last) ────────
            const pageAbout = `
                <div style="${pageStyle}display:flex;flex-direction:column;">
                    ${headerBar}
                    <div style="padding:0 10mm;flex:1;">
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
                    <div style="padding:0 10mm;">
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
                    if (p.fanlightHeight > 0) specs.push(['Transom Axis (from frame top)', p.fanlightHeight + 'mm']);
                    specs.push(['Glass', p.glassText]);
                    specs.push(['Glass Finish', p.glassFinishText]);
                    specs.push(['Spacer Bar', p.spacerText]);
                    specs.push(['Colour', p.colorDisplay]);
                    specs.push(['Bars', p.casementBarsText]);
                    specs.push(['PAS24', p.pas24 ? 'Yes' : 'No']);
                    if (!p.isSlidingOrBifold && p.hardwareFinish) specs.push(['Hardware Finish', p.hardwareFinish]);
                } else if (p.windowType === 'fix-only') {
                    specs.push(['Type', p.fixTypeText]);
                    specs.push(['Dimensions', `${p.width}mm × ${p.height}mm`]);
                    specs.push(['Glass', p.glassText]);
                    specs.push(['Spacer Bar', p.fixSpacerText]);
                    specs.push(['Glass Finish', p.glassFinishText]);
                    specs.push(['Colour', p.colorDisplay]);
                    specs.push(['Bars', p.fixBarsFull]);
                } else if (p.windowType === 'door') {
                    specs.push(['Type', p.isSliding ? p.slidingTypeText : (p.isBifold ? p.bifoldTypeText : (p.doorType === 'french' ? 'French Doors' : (p.doorType === 'front-door' ? 'Front Door' : 'Single Door')))]);
                    if (!p.isSlidingOrBifold) specs.push(['Shape', p.doorShapeText]);
                    if (!p.isSliding) specs.push(['Style', p.doorStyleText]);
                    if (!p.isSliding && p.doorStyle !== 'full-glass') specs.push(['Paneling', p.doorPanelingText]);
                    if (!p.isSlidingOrBifold && p.doorStyle !== 'full-glass') specs.push(['Center Mullion', p.doorCenterMullion ? 'Yes' : 'No']);
                    specs.push(['Dimensions', `${p.width}mm × ${p.height}mm`]);
                    if (!p.isSlidingOrBifold && p.doorPanelsText) specs.push(['Side Panels', p.doorPanelsText]);
                    if (!p.isSlidingOrBifold && p.doorSidePanels !== 'none') specs.push(['Side Panel Style', p.doorSideStyleText]);
                    if (p.isSliding) { specs.push(['Slide Direction', p.slidingDirText]); specs.push(['Panel Size', p.slidingPanelWidth + 'mm × ' + p.slidingPanelDepth + 'mm']); specs.push(['Frame Depth', p.slidingFrameDepth + 'mm']); } else if (p.isBifold) { specs.push(['Fold Direction', p.bifoldFoldText]); specs.push(['Traffic Door', p.bifoldTrafficText]); specs.push(['Panel Size', p.bifoldPanelWidth + 'mm × ' + p.bifoldPanelDepth + 'mm']); specs.push(['Opening', p.bifoldOpenText]); specs.push(['Frame Depth', p.bifoldFrameDepth + 'mm']); } else { specs.push(['Open First', p.doorHingeSide === 'right' ? 'Left' : 'Right']); }
                    if (!p.isSlidingOrBifold) specs.push(['Opening', p.doorOpenDirection === 'outward' ? 'Outward' : 'Inward']);
                    if (!p.isSlidingOrBifold) specs.push(['Threshold', p.doorThresholdText]);
                    specs.push(['Glass', p.glassText]);
                    specs.push(['Glass Finish', p.glassFinishText]);
                    specs.push(['Spacer Bar', p.spacerText]);
                    specs.push(['Colour', p.colorDisplay]);
                    specs.push(['Bars', p.doorBarsText]);
                    if (!p.isSlidingOrBifold && p.doorSideBarsText) specs.push(['Panel Bars', p.doorSideBarsText]);
                    if (!p.isSlidingOrBifold) specs.push(['Lock', p.doorLockType === 'deadbolt' ? 'Deadbolt' : 'Multipoint Lock']);
                    if (!p.isSlidingOrBifold && p.hardwareFinish) specs.push(['Hardware Finish', p.hardwareFinish]);
                    specs.push(['Safety Glass', p.safetyGlassText]);
                    specs.push(['Seal Colour', p.sealColour.charAt(0).toUpperCase() + p.sealColour.slice(1)]);
                    specs.push(['Trickle Vent', p.trickleText]);
                    if (p.isSlidingOrBifold && p.sillExtension !== 'none') specs.push(['Sill Extension', p.sillText + (p.doorSillWider ? ' (wider)' : '')]);
                } else {
                    if (p.headType === 'arch') specs.push(['Head Type', 'Glazing Arch']);
                    if (p.measurementType === 'brick-to-brick') {
                        specs.push(['Structural Opening', `${p.originalWidth}mm × ${p.originalHeight}mm`]);
                        specs.push(['Window Size (Frame)', `${p.width}mm × ${p.height}mm`]);
                        specs.push(['ℹ Note', 'Frame overlaps brickwork by 150mm (W) and 75mm (H). We recommend a surveyor or contractor visit before ordering.']);
                    } else {
                        specs.push(['Window Size (Frame)', `${p.width}mm × ${p.height}mm`]);
                    }
                    specs.push(['Frame', p.frameText]);
                    specs.push(['Opening', p.openingText]);
                    specs.push(['Glass', p.glassText]);
                    specs.push(['Glass Finish', p.glassFinishText]);
                    specs.push(['Spacer Bar', p.spacerText]);
                    specs.push(['Colour', p.colorDisplay]);
                    specs.push(['Georgian Bars', p.barsText]);
                    specs.push(['PAS24', p.pas24 ? 'Yes' : 'No']);
                    specs.push(['Horns', p.hornsText]);
                    if (!p.isSlidingOrBifold && p.hardwareFinish) specs.push(['Hardware Finish', p.hardwareFinish]);
                }

                const specRows2Col = specs.map(([l, v]) => `
                    <div>
                        <div style="font-family:'Jost',sans-serif;font-weight:700;letter-spacing:.18em;text-transform:uppercase;font-size:10px;color:#6b6b6b;margin-bottom:1.5mm;">${l}</div>
                        <div style="font-family:'Jost',sans-serif;font-size:12px;color:#0A1628;margin-bottom:4mm;line-height:1.4;">${v}</div>
                    </div>
                `).join('');

                const ironItemsHTML = (p.ironList && p.ironList.length > 0)
                    ? p.ironList.map(pr => `
                        <div style="display:flex;align-items:center;gap:3mm;margin-bottom:2mm;">
                            ${pr.img ? `<img src="${pr.img}" crossorigin="anonymous" style="width:12mm;height:12mm;object-fit:cover;border:1px solid #e5e4dd;border-radius:1mm;flex-shrink:0;background:#f5f4f0;" onerror="this.style.visibility='hidden'">` : `<div style="width:12mm;height:12mm;border:1px solid #e5e4dd;background:#f5f4f0;border-radius:1mm;flex-shrink:0;"></div>`}
                            <span style="font-family:'Jost',sans-serif;font-size:11px;color:#0A1628;line-height:1.4;">${pr.qty > 1 ? `<strong>${pr.qty}×</strong> ` : ''}${pr.name}${pr.color ? ` — ${pr.color}` : ''}</span>
                        </div>
                    `).join('')
                    : `<div style="font-family:'Jost',sans-serif;font-size:11px;color:#888;font-style:italic;">No ironmongery specified for this item.</div>`;

                const typeLabel = p.windowType === 'door' ? (p.isSliding ? p.slidingTypeText : (p.isBifold ? p.bifoldTypeText : (p.doorType === 'french' ? 'French Doors' : (p.doorType === 'front-door' ? 'Front Door' : 'Single Door'))))
                    : p.windowType === 'casement' ? 'Casement Window'
                    : p.windowType === 'fix-only' ? 'Fix Frame'
                    : p.sashType === 'triple' ? 'Triple Sash Window'
                    : p.sashType === 'single' ? 'Single Sash Window'
                    : 'Traditional Sash Window';

                const idxStr = String(idx + 1).padStart(2, '0');
                const priceStr = '£' + R.formatPrice(item.total_price || 0);

                return `
                    <div style="border:1px solid #e5e4dd;margin-bottom:5mm;overflow:hidden;">
                        <div style="background:#0A1628;color:#fff;padding:5mm 7mm;display:flex;justify-content:space-between;align-items:center;">
                            <div style="font-family:${serif};font-weight:600;font-size:18px;letter-spacing:.02em;">${item.window_number || typeLabel}${item.window_number && item.window_number !== typeLabel ? `<span style="font-family:'Jost',sans-serif;font-weight:300;font-size:11px;opacity:.65;letter-spacing:.15em;margin-left:10px;">${typeLabel}</span>` : ''}</div>
                            <div style="font-family:'Jost',sans-serif;font-weight:500;font-size:18px;letter-spacing:.02em;">${priceStr}</div>
                        </div>
                        <div style="display:grid;grid-template-columns:92mm 1fr;gap:6mm;padding:6mm;">
                            ${screenshots?.interior ? `
                                <div style="background:#f5f4f0;border:1px solid #e5e4dd;padding:4mm;display:flex;flex-direction:column;gap:3mm;">
                                    <div style="width:100%;height:66mm;display:flex;align-items:center;justify-content:center;"><img src="${screenshots.interior}" crossorigin="anonymous" style="max-width:100%;max-height:100%;object-fit:contain;"/></div>
                                    ${screenshots?.exterior ? `<div style="width:100%;height:66mm;display:flex;align-items:center;justify-content:center;border-top:1px dashed #ccc;padding-top:3mm;"><img src="${screenshots.exterior}" crossorigin="anonymous" style="max-width:100%;max-height:100%;object-fit:contain;"/></div>` : ''}
                                    <div style="width:100%;height:90mm;display:flex;align-items:center;justify-content:center;border-top:1px dashed #ccc;padding-top:3mm;">${svg}</div>
                                </div>
                            ` : `
                                <div style="background:#f5f4f0;border:1px solid #e5e4dd;display:flex;align-items:center;justify-content:center;padding:4mm;">
                                    <div style="width:100%;height:130mm;display:flex;align-items:center;justify-content:center;">${svg}</div>
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
                <div style="font-family:'Jost',sans-serif;padding:10px 14px;background:#fff;">
                    ${buildItemCard(item, idx)}
                </div>
            `);



            // ──────── PAGE -2: SUMMARY + PAYMENT 50/50 ────────
            const summaryRows = items.map((it, idx) => {
                const p = R.parseItem(it);
                const typeShort = p.windowType === 'door' ? 'Door'
                : p.windowType === 'casement' ? 'Casement'
                    : p.windowType === 'fix-only' ? 'Fix Frame'
                    : p.sashType === 'triple' ? 'Triple Sash'
                    : p.sashType === 'single' ? 'Single Sash'
                    : 'Sash';
                const desc = `${typeShort} · ${p.width}×${p.height}mm · ${p.colorDisplay || '-'}`;
                return `
                    <tr>
                        <td style="padding:3.5mm 5mm;border-bottom:1px solid #e5e4dd;">${it.window_number || String(idx + 1).padStart(2, '0')}</td>
                        <td style="padding:3.5mm 5mm;border-bottom:1px solid #e5e4dd;">${desc}</td>
                        <td style="padding:3.5mm 5mm;border-bottom:1px solid #e5e4dd;text-align:center;">${p.quantity || 1}</td>
                        <td style="padding:3.5mm 5mm;border-bottom:1px solid #e5e4dd;text-align:right;font-weight:500;color:#0A1628;">£${R.formatPrice(it.total_price || 0)}</td>
                    </tr>
                `;
            }).join('');

            // PDF Additional Services rows (dynamic from extras)
            const pdfExtraRow = (label, desc, qty, amount, idx) => `
                <tr>
                    <td style="padding:3mm 5mm;border-bottom:1px solid #e5e4dd;vertical-align:top;">${idx}</td>
                    <td style="padding:3mm 5mm;border-bottom:1px solid #e5e4dd;">
                        <div style="font-weight:500;color:#0A1628;">${label}</div>
                        ${desc ? `<div style="font-size:9px;color:#6b6b6b;font-style:italic;margin-top:1mm;">${desc}</div>` : ''}
                    </td>
                    <td style="padding:3mm 5mm;border-bottom:1px solid #e5e4dd;text-align:center;vertical-align:top;">${qty}</td>
                    <td style="padding:3mm 5mm;border-bottom:1px solid #e5e4dd;text-align:right;font-weight:500;color:#0A1628;vertical-align:top;">£${R.formatPrice(amount)}</td>
                </tr>
            `;

            let pdfExtrasIdx = 1;
            const pdfExtrasRows = [
                ...installationExtras.map(e => pdfExtraRow(e.name, e.description, e.quantity, e.total_price, `I-${String(pdfExtrasIdx++).padStart(2, '0')}`)),
                ...deliveryExtras.map(e => pdfExtraRow(e.name, e.description, e.quantity, e.total_price, `D-${String(pdfExtrasIdx++).padStart(2, '0')}`)),
                ...customExtras.map(e => pdfExtraRow(e.name, e.description, e.quantity, e.total_price, `X-${String(pdfExtrasIdx++).padStart(2, '0')}`))
            ].join('');

            const pageSummary = `
                <div style="${pageStyle}">
                    ${headerBar}
                    <div style="padding:0 10mm;">
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
                                    <td style="padding:3mm 5mm;border-top:2px solid #0A1628;text-align:right;color:#0A1628;font-weight:500;">£${R.formatPrice(totalEx)} <span style="font-size:9px;font-weight:400;color:#6b6b6b;">+ VAT</span></td>
                                </tr>
                            </tfoot>
                        </table>

                        <!-- ─── ADDITIONAL SERVICES TABLE ─── -->
                        <h3 style="font-family:${serif};font-weight:700;color:#0A1628;font-size:18px;letter-spacing:.02em;margin:8mm 0 3mm;">Additional Services</h3>
                        ${hasAnyExtras ? `
                        <table style="width:100%;border-collapse:collapse;font-family:'Jost',sans-serif;font-size:10.5px;">
                            <thead>
                                <tr>
                                    <th style="background:#0A1628;color:#fff;font-weight:400;letter-spacing:.15em;text-transform:uppercase;font-size:9px;padding:2.5mm 5mm;text-align:left;">Item</th>
                                    <th style="background:#0A1628;color:#fff;font-weight:400;letter-spacing:.15em;text-transform:uppercase;font-size:9px;padding:2.5mm 5mm;text-align:left;">Description</th>
                                    <th style="background:#0A1628;color:#fff;font-weight:400;letter-spacing:.15em;text-transform:uppercase;font-size:9px;padding:2.5mm 5mm;text-align:center;">Qty</th>
                                    <th style="background:#0A1628;color:#fff;font-weight:400;letter-spacing:.15em;text-transform:uppercase;font-size:9px;padding:2.5mm 5mm;text-align:right;">Price</th>
                                </tr>
                            </thead>
                            <tbody>${pdfExtrasRows}</tbody>
                            <tfoot>
                                <tr>
                                    <td colspan="3" style="padding:3mm 5mm;border-top:2px solid #0A1628;text-align:right;font-weight:500;color:#0A1628;font-size:11px;">Subtotal — Additional Services</td>
                                    <td style="padding:3mm 5mm;border-top:2px solid #0A1628;text-align:right;color:#0A1628;font-weight:500;">£${R.formatPrice(extrasTotalAll)} <span style="font-size:9px;font-weight:400;color:#6b6b6b;">+ VAT</span></td>
                                </tr>
                            </tfoot>
                        </table>
                        ` : `
                        <div style="padding:4mm 5mm;background:#f5f4f0;border-left:3px solid #e5e4dd;font-family:'Jost',sans-serif;font-size:10.5px;color:#6b6b6b;line-height:1.55;">
                            No additional services selected. Installation and delivery can be added to this estimate.
                        </div>
                        `}

                        <!-- ─── VAT NOTE ─── -->
                        <div style="margin-top:6mm;padding:3mm 5mm;background:#fff8ed;border-left:3px solid #c9a96e;font-family:'Jost',sans-serif;font-size:9.5px;color:#6b6b6b;line-height:1.55;">
                            <strong style="color:#0A1628;">All prices exclude VAT.</strong> VAT will be applied at the applicable rate (0%, 5%, or 20%) depending on your property status and project type. The correct rate will be confirmed prior to invoicing.
                        </div>
                    </div>
                </div>
            `;

            // ──────── PAGE: PAYMENT SCHEDULE (own page) ────────
            // PDF Payment card helper
            const pdfPaymentCard = (roman, label, percent, amount, note, highlight = false) => `
                <div style="border:1px solid #e5e4dd;padding:5mm;position:relative;min-height:60mm;${highlight ? 'background:#fbfaf7;' : ''}">
                    <div style="position:absolute;top:3mm;right:4mm;font-family:${serif};font-weight:700;font-size:36px;color:#D4D4C8;line-height:1;">${roman}</div>
                    <div style="font-family:'Jost',sans-serif;font-weight:500;letter-spacing:.2em;text-transform:uppercase;font-size:8.5px;color:#6b6b6b;margin-bottom:1.5mm;">${label}</div>
                    <div style="font-family:${serif};font-weight:700;font-size:24px;color:#0A1628;line-height:1;margin-bottom:2mm;">${percent}</div>
                    <div style="font-family:'Jost',sans-serif;font-weight:500;font-size:13px;color:#c9a96e;margin-bottom:2mm;">£${R.formatPrice(amount)} <span style="font-size:9px;font-weight:400;color:#6b6b6b;">+ VAT</span></div>
                    <div style="font-family:'Jost',sans-serif;font-weight:300;font-size:9px;color:#6b6b6b;line-height:1.5;">${note}</div>
                </div>
            `;

            // PDF — Group custom extras by payment_timing (same hybrid logic as dashboard)
            const pdfCustomByTiming = {
                with_deposit: customExtras.filter(e => e.payment_timing === 'with_deposit'),
                with_balance: customExtras.filter(e => e.payment_timing === 'with_balance'),
                on_delivery: customExtras.filter(e => e.payment_timing === 'on_delivery'),
                on_completion: customExtras.filter(e => !e.payment_timing || e.payment_timing === 'on_completion')
            };
            const pdfSumTiming = (list) => list.reduce((s, e) => s + parseFloat(e.total_price || 0), 0);
            const pdfCustomDepositAdd = pdfSumTiming(pdfCustomByTiming.with_deposit);
            const pdfCustomBalanceAdd = pdfSumTiming(pdfCustomByTiming.with_balance);
            const pdfCustomDeliveryAdd = pdfSumTiming(pdfCustomByTiming.on_delivery);
            const pdfListIncludes = (list) => list.length ? ` Includes: ${list.map(e => `${e.name} £${R.formatPrice(e.total_price)}`).join(', ')}.` : '';

            const pdfDep = R.computeDeposit(estimate, totalEx, windowsHalf, pdfCustomDepositAdd, pdfCustomBalanceAdd);
            const pdfDepositAmount = pdfDep.depositVal;
            const pdfBalanceAmount = pdfDep.balanceVal;
            const pdfDepositLocked = pdfDep.locked;
            const pdfDeliveryAmountTotal = deliveryTotal + pdfCustomDeliveryAdd;

            const pdfDepositIncludes = pdfListIncludes(pdfCustomByTiming.with_deposit);
            const pdfBalanceIncludes = pdfListIncludes(pdfCustomByTiming.with_balance);
            const pdfDeliveryIncludes = pdfListIncludes(pdfCustomByTiming.on_delivery);

            const pdfRomans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
            let pdfRomanIdx = 0;
            const pdfNextRoman = () => pdfRomans[pdfRomanIdx++] || `${pdfRomanIdx}`;

            const pdfPaymentCards = [
                pdfPaymentCard(pdfNextRoman(), 'Windows Deposit', pdfDepositLocked ? 'PAID' : '50%', pdfDepositAmount, pdfDepositLocked ? `Deposit paid and confirmed. This amount is fixed and will not change.${pdfDepositIncludes}` : `Non-refundable deposit payable upon acceptance of this quotation. Secures the order, reserves workshop capacity, and funds material procurement. Calculated on windows only.${pdfDepositIncludes}`),
                pdfPaymentCard(pdfNextRoman(), 'Windows Balance', pdfDepositLocked ? '50% +/- adjustment' : '50%', pdfBalanceAmount, pdfDepositLocked ? `Due prior to dispatch. Adjusted up or down after the on-site survey. Windows will not leave the workshop until full payment is received. Bank transfer to Skylon Joinery Ltd.${pdfBalanceIncludes}` : `Due prior to dispatch. Windows will not leave the workshop until full payment is received. Bank transfer to Skylon Joinery Ltd.${pdfBalanceIncludes}`),
                hasInstallation ? pdfPaymentCard(pdfNextRoman(), 'Installation Deposit', '50%', installationHalf, 'Due before installation begins. Secures the installation date and covers scheduling.') : '',
                hasInstallation ? pdfPaymentCard(pdfNextRoman(), 'Installation Balance', '50%', installationHalf, 'Payable after installation is completed on site. Covers labour and installation services.', true) : '',
                (hasDelivery || pdfCustomDeliveryAdd > 0) ? pdfPaymentCard(pdfNextRoman(), 'Delivery', '100%', pdfDeliveryAmountTotal, `Payable upon delivery to site. Separate from windows payment schedule. Covers transport, logistics, and safe unloading.${pdfDeliveryIncludes}`, true) : '',
                ...pdfCustomByTiming.on_completion.map(e => pdfPaymentCard(pdfNextRoman(), e.name, '100%', e.total_price, `${e.description ? e.description + '. ' : ''}Payable on completion.`, true))
            ].filter(Boolean);

            const pdfNumCards = pdfPaymentCards.length;
            const pdfPaymentGrid = pdfNumCards === 1 ? '1fr'
                : pdfNumCards === 2 ? '1fr 1fr'
                : pdfNumCards === 3 ? '1fr 1fr 1fr'
                : pdfNumCards === 4 ? '1fr 1fr 1fr 1fr'
                : pdfNumCards <= 6 ? '1fr 1fr 1fr'
                : 'repeat(auto-fit, minmax(50mm, 1fr))';
            const pdfIntroText = pdfNumCards === 2
                ? 'Payments are structured as a two-stage deposit and balance, both based on the total for windows.'
                : 'Payments are structured to protect both parties. Windows and installation are each split into a deposit and balance. Additional services are billed separately upon completion.';

            const pagePayment = `
                <div style="${pageStyle}">
                    ${headerBar}
                    <div style="padding:0 10mm;">
                        <h2 style="font-family:${serif};font-weight:700;color:#0A1628;font-size:28px;letter-spacing:.02em;margin:10mm 0 4mm;">Payment Schedule</h2>
                        <p style="font-family:'Jost',sans-serif;font-weight:300;font-size:11px;color:#6b6b6b;line-height:1.65;margin-bottom:8mm;max-width:160mm;">
                            ${pdfIntroText}
                        </p>

                        <div style="margin-bottom:8mm;padding:5mm 6mm;background:#fff8ed;border-left:3px solid #c9a96e;font-family:'Jost',sans-serif;font-size:10.5px;color:#1a1a1a;line-height:1.65;">
                            <strong style="color:#0A1628;">This is an estimate based on the measurements you provided.</strong> The final price is confirmed after our on-site survey and may be adjusted up or down.
                        </div>

                        <div style="display:grid;grid-template-columns:${pdfPaymentGrid};gap:5mm;">
                            ${pdfPaymentCards.join('')}
                        </div>

                        <div style="margin-top:10mm;padding:5mm 6mm;background:#f5f4f0;border-left:3px solid #0A1628;font-family:'Jost',sans-serif;font-size:10.5px;color:#1a1a1a;line-height:1.65;">
                            <strong style="color:#0A1628;">Bank transfer details</strong> are provided on the final Terms &amp; Conditions page. Alternative payment methods may be arranged in writing prior to acceptance.
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
                    <div style="padding:0 10mm;flex:1;">
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
                    <div style="background:#0A1628;color:#fff;padding:8mm 10mm;display:grid;grid-template-columns:auto 1fr 1fr 1fr;gap:8mm;align-items:center;font-family:'Jost',sans-serif;font-size:9.5px;">
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
            async function renderToCanvas(html, width, scale = 2) {
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
                    scale: scale, useCORS: true, allowTaint: true, backgroundColor: '#ffffff',
                    logging: false, width: container.offsetWidth, height: container.offsetHeight
                });
                document.body.removeChild(container);
                return canvas;
            }

            // ──────── ASSEMBLE PDF ────────
            const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
            const pageW = 210, pageH = 297, margin = 8;
            const usableW = pageW - margin * 2;

            // Full A4 page (cover, quote, certs, summary, terms)
            async function addFullPage(html, isFirst = false) {
                if (!isFirst) doc.addPage();
                const canvas = await renderToCanvas(html, '210mm');
                const imgData = canvas.toDataURL('image/jpeg', 0.85);
                doc.addImage(imgData, 'JPEG', 0, 0, pageW, pageH);
            }

            // Smart page-breaking block (items section only)
            let curY = margin;
            async function addBlock(html) {
                const canvas = await renderToCanvas(html, '800px', 1.5);
                const blockH = (canvas.height / canvas.width) * usableW;

                if (curY + blockH > pageH - margin && curY > margin + 1) {
                    doc.addPage();
                    curY = margin;
                }

                const imgData = canvas.toDataURL('image/jpeg', 0.82);
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
            let __itemIdx = 0;
            for (const itemHTML of itemBlocksHTML) {
                // One item per page (first item shares the page with the title block)
                if (__itemIdx > 0) { doc.addPage(); curY = margin; }
                __itemIdx++;
                await addBlock(itemHTML);
            }

            // 5. Summary — jsPDF-AutoTable: native row pagination (a raster page clipped
            // with many windows; vector tables never do). pageSummary template above kept as reference.
            {
                const NAVY = [10, 22, 40], LINE = [229, 228, 221], GREY = [107, 107, 107], GOLD = [201, 169, 110];
                doc.addPage();
                const sumFirstPage = doc.internal.getNumberOfPages();
                const drawSummaryHeader = (data) => {
                    doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
                    doc.rect(0, 0, pageW, 26, 'F');
                    doc.setTextColor(255, 255, 255);
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(11);
                    doc.text('P R I M E   S A S H', 10, 14);
                    doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.2);
                    doc.line(10, 9.5, 62, 9.5); doc.line(10, 16.5, 62, 16.5);
                    doc.setFontSize(6.5);
                    doc.text('W I N D O W S', 10, 21);
                    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
                    doc.setFont('times', 'bold'); doc.setFontSize(19);
                    doc.text(data.pageNumber === sumFirstPage ? 'Summary' : 'Summary (continued)', 10, 36);
                };
                const winBody = items.map((it, idx) => {
                    const p = R.parseItem(it);
                    const typeShort = p.windowType === 'door' ? 'Door'
                        : p.windowType === 'casement' ? 'Casement'
                        : p.windowType === 'fix-only' ? 'Fix Frame'
                        : p.sashType === 'triple' ? 'Triple Sash'
                        : p.sashType === 'single' ? 'Single Sash'
                        : 'Sash';
                    return [
                        it.window_number || String(idx + 1).padStart(2, '0'),
                        `${typeShort} · ${p.width}×${p.height}mm · ${p.colorDisplay || '-'}`,
                        String(p.quantity || 1),
                        '£' + R.formatPrice(it.total_price || 0)
                    ];
                });
                const tableBase = {
                    margin: { left: 10, right: 10, top: 42 },
                    theme: 'striped',
                    styles: { font: 'helvetica', fontSize: 8.5, textColor: NAVY, cellPadding: { top: 2.4, bottom: 2.4, left: 3, right: 3 }, lineWidth: 0 },
                    alternateRowStyles: { fillColor: [247, 246, 242] },
                    headStyles: { fillColor: NAVY, textColor: 255, fontSize: 7, fontStyle: 'normal', cellPadding: { top: 2.4, bottom: 2.4, left: 3, right: 3 } },
                    footStyles: { fillColor: [255, 255, 255], textColor: NAVY, fontStyle: 'bold', fontSize: 8.5, lineWidth: { top: 0.5 }, lineColor: NAVY },
                    columnStyles: { 0: { cellWidth: 22 }, 2: { cellWidth: 12, halign: 'center' }, 3: { cellWidth: 28, halign: 'right' } },
                    didDrawPage: drawSummaryHeader
                };
                doc.autoTable(Object.assign({}, tableBase, {
                    startY: 42,
                    head: [['ITEM', 'DESCRIPTION', 'QTY', 'PRICE']],
                    body: winBody,
                    foot: [[{ content: 'Subtotal — Windows', colSpan: 3, styles: { halign: 'right' } }, { content: '£' + R.formatPrice(totalEx) + '  + VAT', styles: { halign: 'right' } }]]
                }));
                let curSumY = doc.lastAutoTable.finalY + 10;
                const ensureRoom = (need) => {
                    if (curSumY + need > pageH - 12) { doc.addPage(); drawSummaryHeader({ pageNumber: doc.internal.getNumberOfPages() }); curSumY = 44; }
                };
                ensureRoom(20);
                doc.setFont('times', 'bold'); doc.setFontSize(14);
                doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
                doc.text('Additional Services', 10, curSumY);
                curSumY += 3;
                if (hasAnyExtras) {
                    let exIdx = 1;
                    const exBody = [
                        ...installationExtras.map(e => ['I-' + String(exIdx++).padStart(2, '0'), e.name + (e.description ? '\n' + e.description : ''), String(e.quantity), '£' + R.formatPrice(e.total_price)]),
                        ...deliveryExtras.map(e => ['D-' + String(exIdx++).padStart(2, '0'), e.name + (e.description ? '\n' + e.description : ''), String(e.quantity), '£' + R.formatPrice(e.total_price)]),
                        ...customExtras.map(e => ['X-' + String(exIdx++).padStart(2, '0'), e.name + (e.description ? '\n' + e.description : ''), String(e.quantity), '£' + R.formatPrice(e.total_price)])
                    ];
                    doc.autoTable(Object.assign({}, tableBase, {
                        startY: curSumY,
                        head: [['ITEM', 'DESCRIPTION', 'QTY', 'PRICE']],
                        body: exBody,
                        foot: [[{ content: 'Subtotal — Additional Services', colSpan: 3, styles: { halign: 'right' } }, { content: '£' + R.formatPrice(extrasTotalAll) + '  + VAT', styles: { halign: 'right' } }]]
                    }));
                    curSumY = doc.lastAutoTable.finalY + 8;
                } else {
                    ensureRoom(16);
                    doc.setFillColor(245, 244, 240); doc.rect(10, curSumY, usableW, 12, 'F');
                    doc.setFillColor(LINE[0], LINE[1], LINE[2]); doc.rect(10, curSumY, 1.2, 12, 'F');
                    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(GREY[0], GREY[1], GREY[2]);
                    doc.text('No additional services selected. Installation and delivery can be added to this estimate.', 14, curSumY + 7);
                    curSumY += 20;
                }
                // VAT note (gold-bar box, wrapped)
                const vatBold = 'All prices exclude VAT.';
                const vatRest = ' VAT will be applied at the applicable rate (0%, 5%, or 20%) depending on your property status and project type. The correct rate will be confirmed prior to invoicing.';
                doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
                const vatLines = doc.splitTextToSize(vatBold + vatRest, usableW - 10);
                const vatH = vatLines.length * 4 + 6;
                ensureRoom(vatH + 4);
                doc.setFillColor(255, 248, 237); doc.rect(10, curSumY, usableW, vatH, 'F');
                doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]); doc.rect(10, curSumY, 1.2, vatH, 'F');
                doc.setTextColor(GREY[0], GREY[1], GREY[2]);
                doc.text(vatLines, 14, curSumY + 5);
            }
            // 5b. Payment Schedule (own page)
            await addFullPage(pagePayment);
            // 6. Terms
            await addFullPage(pageTerms);
            // 7. About (last page)
            await addFullPage(pageAbout);

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
                if (p.fanlightHeight > 0) specs.push(['Transom Axis (from frame top)', p.fanlightHeight + 'mm']);
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
                if (!p.isSlidingOrBifold && p.hardwareFinish) specs.push(['Hardware Finish', p.hardwareFinish]);
            } else if (p.windowType === 'fix-only') {
                specs.push(['Type', p.fixTypeText]);
                specs.push(['Dimensions', `${p.width}mm × ${p.height}mm`]);
                specs.push(['Glass', p.glassText]);
                specs.push(['Spacer Bar', p.fixSpacerText]);
                specs.push(['Glass Finish', p.glassFinishText]);
                specs.push(['Colour', p.colorDisplay]);
                specs.push(['Bars', p.fixBarsFull]);
            } else if (p.windowType === 'door') {
                specs.push(['Type', p.isSliding ? p.slidingTypeText : (p.isBifold ? p.bifoldTypeText : (p.doorType === 'french' ? 'French Doors' : (p.doorType === 'front-door' ? 'Front Door' : 'Single Patio Door')))]);
                if (!p.isSlidingOrBifold) specs.push(['Shape', p.doorShapeText]);
                if (!p.isSliding) specs.push(['Style', p.doorStyleText]);
                if (!p.isSliding && p.doorStyle !== 'full-glass') specs.push(['Paneling', p.doorPanelingText]);
                if (!p.isSlidingOrBifold && p.doorStyle !== 'full-glass') specs.push(['Center Mullion', p.doorCenterMullion ? 'Yes' : 'No']);
                specs.push(['Dimensions', `${p.width}mm × ${p.height}mm`]);
                if (!p.isSlidingOrBifold && p.doorPanelsText) specs.push(['Side Panels', p.doorPanelsText]);
                if (!p.isSlidingOrBifold && p.doorSidePanels !== 'none') specs.push(['Side Panel Style', p.doorSideStyleText]);
                if (p.isSliding) { specs.push(['Slide Direction', p.slidingDirText]); specs.push(['Panel Size', p.slidingPanelWidth + 'mm × ' + p.slidingPanelDepth + 'mm']); specs.push(['Frame Depth', p.slidingFrameDepth + 'mm']); } else if (p.isBifold) { specs.push(['Fold Direction', p.bifoldFoldText]); specs.push(['Traffic Door', p.bifoldTrafficText]); specs.push(['Panel Size', p.bifoldPanelWidth + 'mm × ' + p.bifoldPanelDepth + 'mm']); specs.push(['Opening', p.bifoldOpenText]); specs.push(['Frame Depth', p.bifoldFrameDepth + 'mm']); } else { specs.push(['Open First', p.doorHingeSide === 'right' ? 'Left' : 'Right']); }
                if (!p.isSlidingOrBifold) specs.push(['Opening', p.doorOpenDirection === 'outward' ? 'Outward' : 'Inward']);
                if (!p.isSlidingOrBifold) specs.push(['Threshold', p.doorThresholdText]);
                specs.push(['Glass', p.glassText]);
                specs.push(['Glass Finish', p.glassFinishText]);
                specs.push(['Spacer Bar', p.spacerText]);
                specs.push(['Colour', p.colorDisplay]);
                specs.push(['Bars', p.doorBarsText]);
                if (!p.isSlidingOrBifold && p.doorSideBarsText) specs.push(['Panel Bars', p.doorSideBarsText]);
                if (!p.isSlidingOrBifold) specs.push(['Lock', p.doorLockType === 'deadbolt' ? 'Deadbolt' : 'Multipoint Lock']);
                if (!p.isSlidingOrBifold && p.hardwareFinish) specs.push(['Hardware Finish', p.hardwareFinish]);
                specs.push(['Safety Glass', p.safetyGlassText]);
                specs.push(['Seal Colour', p.sealColour.charAt(0).toUpperCase() + p.sealColour.slice(1)]);
                specs.push(['Trickle Vent', p.trickleText]);
                if (p.isSlidingOrBifold && p.sillExtension !== 'none') specs.push(['Sill Extension', p.sillText + (p.doorSillWider ? ' (wider)' : '')]);
            } else {
            if (p.sashType !== 'double') specs.push(['Window Type', p.sashType === 'triple' ? 'Triple Sash' : p.sashType]);
            if (p.headType === 'arch') specs.push(['Head Type', 'Glazing Arch']);
            if (p.sashType === 'triple') specs.push(['Split Ratio', p.splitRatio]);
            if (p.measurementType === 'brick-to-brick') {
                specs.push(['Structural Opening', `${p.originalWidth}mm × ${p.originalHeight}mm`]);
                specs.push(['Window Size (Frame)', `${p.width}mm × ${p.height}mm`]);
                specs.push(['ℹ Note', 'Frame overlaps brickwork by 150mm (W) and 75mm (H). We recommend a surveyor or contractor visit before ordering.']);
            } else {
                specs.push(['Window Size (Frame)', `${p.width}mm × ${p.height}mm`]);
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
            if (!p.isSlidingOrBifold && p.hardwareFinish) specs.push(['Hardware Finish', p.hardwareFinish]);
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

            const typeLabel = p.windowType === 'door' ? 'Door' : p.windowType === 'casement' ? 'Casement' : p.windowType === 'fix-only' ? 'Fix Frame' : p.sashType === 'triple' ? 'Triple Sash' : p.sashType === 'single' ? 'Single Sash' : 'Double Sash';
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
                            ${screenshots?.exterior ? `<img src="${screenshots.exterior}" style="width:250px;border:1px solid #ddd;border-radius:2px;" />` : ''}
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
                info@primesashwindows.co.uk | 07842 510 060 | 07842 510 066<br>
                Unit 3, Leaside Industrial Park, Sedge Green, Nazeing, EN9 2BF
            </div>
        `;
    }

    // ─── Download Excel ───
    static downloadEstimateExcel(estimate) {
        const R = EstimateRenderer;
        if (estimate && estimate.estimate_items) estimate.estimate_items = R.sortWindowItems(estimate.estimate_items);
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
                const typeLabel = p.windowType === 'door' ? 'Door' : p.windowType === 'casement' ? 'Casement' : p.windowType === 'fix-only' ? 'Fix Frame' : p.sashType === 'triple' ? 'Triple Sash' : p.sashType === 'single' ? 'Single Sash' : 'Double Sash';
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
    // ─── Image lightbox — click a screenshot on the estimate card to enlarge ───
    static zoomImage(imgOrSrc) {
        const src = typeof imgOrSrc === 'string' ? imgOrSrc : (imgOrSrc && imgOrSrc.src);
        if (!src) return;
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(10,22,40,.92);z-index:99999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;';
        const img = document.createElement('img');
        img.src = src;
        img.style.cssText = 'max-width:92vw;max-height:92vh;border-radius:3px;box-shadow:0 10px 40px rgba(0,0,0,.5);';
        overlay.appendChild(img);
        const onKey = (e) => { if (e.key === 'Escape') close(); };
        const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
        overlay.addEventListener('click', close);
        document.addEventListener('keydown', onKey);
        document.body.appendChild(overlay);
    }

    static attachExportButtons(estimate) {
        const pdfBtns = document.querySelectorAll('.btn-download-pdf');
        pdfBtns.forEach(btn => btn.addEventListener('click', () => EstimateRenderer.downloadEstimatePDF(estimate)));
        const excelBtn = document.getElementById('download-estimate-excel');
        if (excelBtn) excelBtn.addEventListener('click', () => EstimateRenderer.downloadEstimateExcel(estimate));
    }
}

// Make globally available
window.EstimateRenderer = EstimateRenderer;