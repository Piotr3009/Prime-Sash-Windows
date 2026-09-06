// ═══════════════════════════════════════════════════════════════════
// EstimateExtras — service functions for estimate_extras table
// ═══════════════════════════════════════════════════════════════════
// Usage:
//   EstimateExtras.load(estimateId)                 → returns array of extras
//   EstimateExtras.addInstallation(estimateId, items) → per-item pricing by frame area (see INSTALL_RATE / INSTALL_MIN)
//   EstimateExtras.addDelivery(estimateId, totalQty)  → £300 base + £30/window above 10
//   EstimateExtras.addCustom(estimateId, data)      → admin adds custom extra
//   EstimateExtras.update(extraId, data)            → admin edits extra
//   EstimateExtras.delete(extraId)                  → delete by ID
//   EstimateExtras.removeByType(estimateId, type)   → customer "unclicks" Installation/Delivery
// ═══════════════════════════════════════════════════════════════════

class EstimateExtras {
    // Installation per-type pricing
    static INSTALL_PRICE_SASH = 400;
    static INSTALL_PRICE_CASEMENT = 250;
    static INSTALL_PRICE_FIX = 200;
    static INSTALL_PRICE_DOOR = 450;

    // Delivery: base + per-window surcharge above threshold
    static DELIVERY_BASE_PRICE = 300;
    static DELIVERY_SURCHARGE_PER_WINDOW = 30;
    static DELIVERY_SURCHARGE_THRESHOLD = 10;

    // ── Installation by size (owner, 06.09.2026) ───────────────────────────
    // £/m² of FRAME area with a per-type minimum. Replaces the flat per-type
    // rates (kept below as legacy) which charged 65% of a small sash and only
    // 8% of a large bifold. Frame = opening +150 / +75 for brick-to-brick.
    static INSTALL_RATE = { sash: 200, casement: 150, fix: 150, door: 150 };
    static INSTALL_MIN  = { sash: 250, casement: 180, fix: 150, door: 300 };

    static installKind(item) {
        let spec = {};
        try { spec = typeof item.specification === 'string' ? JSON.parse(item.specification) : (item.specification || {}); } catch (e) {}
        const fc = spec.fullConfig || spec;
        const w = String(item.window_type || fc.windowType || fc.windowCategory || 'sash').toLowerCase();
        if (w === 'casement') return 'casement';
        if (w === 'fix-only' || w.includes('fix')) return 'fix';
        if (w === 'door' || w.includes('door')) return 'door';
        return 'sash';
    }

    static installFrameSqm(item) {
        let spec = {};
        try { spec = typeof item.specification === 'string' ? JSON.parse(item.specification) : (item.specification || {}); } catch (e) {}
        const fc = spec.fullConfig || spec;
        let fw = parseFloat(fc.actualFrameWidth), fh = parseFloat(fc.actualFrameHeight);
        if (!(fw > 0 && fh > 0)) {
            const w = parseFloat(item.width || fc.width) || 0, h = parseFloat(item.height || fc.height) || 0;
            const b2b = (item.measurement_type || fc.measurementType || 'brick-to-brick') === 'brick-to-brick';
            fw = w + (b2b ? 150 : 0); fh = h + (b2b ? 75 : 0);
        }
        return (fw / 1000) * (fh / 1000);
    }

    // Price for ONE unit of this item (not multiplied by quantity)
    static installUnitPrice(item) {
        const kind = EstimateExtras.installKind(item);
        const sqm = EstimateExtras.installFrameSqm(item);
        const raw = EstimateExtras.INSTALL_RATE[kind] * sqm;
        return { kind, sqm, price: Math.round(Math.max(EstimateExtras.INSTALL_MIN[kind], raw)) };
    }

    // Legacy compat
    static INSTALLATION_UNIT_PRICE = 400;
    static DELIVERY_FLAT_PRICE = 300;

    // ─── Load all extras for an estimate ───
    static async load(estimateId) {
        if (!estimateId) throw new Error('estimateId required');

        const { data, error } = await supabaseClient
            .from('estimate_extras')
            .select('*')
            .eq('estimate_id', estimateId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data || [];
    }

    // ─── Check if extras of given type already exists ───
    static async hasType(estimateId, type) {
        const { data, error } = await supabaseClient
            .from('estimate_extras')
            .select('id')
            .eq('estimate_id', estimateId)
            .eq('type', type)
            .limit(1);

        if (error) throw error;
        return (data || []).length > 0;
    }

    // ─── Customer: Add Installation (per-type pricing) ───
    static async addInstallation(estimateId, totalQtyOrItems) {
        if (!estimateId) throw new Error('estimateId required');

        // Prevent duplicate
        if (await EstimateExtras.hasType(estimateId, 'installation')) {
            throw new Error('Installation already added to this estimate');
        }

        let totalPrice = 0;
        let totalQty = 0;
        let breakdownParts = [];

        // If array of items passed → per-type pricing
        if (Array.isArray(totalQtyOrItems)) {
            const items = totalQtyOrItems;
            // owner 06.09.2026: priced per item by frame area (see installUnitPrice)
            const totals = { sash: 0, casement: 0, fix: 0, door: 0 };
            const counts = { sash: 0, casement: 0, fix: 0, door: 0 };

            items.forEach(item => {
                const qty = parseInt(item.quantity) || 1;
                const u = EstimateExtras.installUnitPrice(item);
                totals[u.kind] += u.price * qty;
                counts[u.kind] += qty;
            });

            totalQty = counts.sash + counts.casement + counts.fix + counts.door;
            if (totalQty < 1) throw new Error('No windows in estimate');
            totalPrice = totals.sash + totals.casement + totals.fix + totals.door;

            const label = { sash: 'Sash', casement: 'Casement', fix: 'Fix', door: 'Door' };
            ['sash', 'casement', 'fix', 'door'].forEach(k => {
                if (counts[k] > 0) breakdownParts.push(`${counts[k]}× ${label[k]} £${totals[k]}`);
            });

        } else {
            // Legacy fallback: flat rate × qty
            totalQty = totalQtyOrItems;
            if (!totalQty || totalQty < 1) throw new Error('totalQty must be ≥ 1');
            totalPrice = EstimateExtras.INSTALLATION_UNIT_PRICE * totalQty;
        }

        const description = breakdownParts.length > 0
            ? `${breakdownParts.join(' + ')}. Final amount subject to site survey.`
            : 'Standard rate. Final amount subject to site survey.';

        const { data, error } = await supabaseClient
            .from('estimate_extras')
            .insert({
                estimate_id: estimateId,
                type: 'installation',
                name: 'Installation',
                description: description,
                quantity: totalQty,
                unit_price: Math.round((totalPrice / totalQty) * 100) / 100,
                total_price: totalPrice,
                added_by: 'customer',
                payment_timing: 'on_completion'
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    // ─── Customer: Add Delivery (£300 base + £30/window above 10) ───
    static async addDelivery(estimateId, totalQty = 1) {
        if (!estimateId) throw new Error('estimateId required');

        if (await EstimateExtras.hasType(estimateId, 'delivery')) {
            throw new Error('Delivery already added to this estimate');
        }

        const base = EstimateExtras.DELIVERY_BASE_PRICE;
        const threshold = EstimateExtras.DELIVERY_SURCHARGE_THRESHOLD;
        const perWindow = EstimateExtras.DELIVERY_SURCHARGE_PER_WINDOW;
        const extraWindows = Math.max(0, totalQty - threshold);
        const surcharge = extraWindows * perWindow;
        const totalPrice = base + surcharge;

        const description = extraWindows > 0
            ? `Base £${base} + ${extraWindows} extra windows × £${perWindow} = £${totalPrice}. Subject to location confirmation.`
            : 'Standard delivery charge. Subject to location confirmation.';
        const { data, error } = await supabaseClient
            .from('estimate_extras')
            .insert({
                estimate_id: estimateId,
                type: 'delivery',
                name: 'Delivery',
                description: description,
                quantity: 1,
                unit_price: totalPrice,
                total_price: totalPrice,
                added_by: 'customer',
                payment_timing: 'on_delivery'
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    // ─── Admin: Add custom extra (crane, OC, scaffolding, make good, etc.) ───
    static async addCustom(estimateId, { name, description = null, quantity = 1, unit_price, payment_timing = 'on_completion', allowNegative = false }) {
        if (!estimateId) throw new Error('estimateId required');
        if (!name || !name.trim()) throw new Error('name required');
        // allowNegative: only the admin discount button passes it (owner, 06.09.2026);
        // hand-typed extras are still rejected below zero.
        if (unit_price == null || (unit_price < 0 && !allowNegative)) throw new Error('unit_price must be ≥ 0');
        if (quantity < 1) throw new Error('quantity must be ≥ 1');
        if (!['with_deposit', 'with_balance', 'on_completion', 'on_delivery'].includes(payment_timing)) {
            throw new Error('invalid payment_timing');
        }

        const total_price = unit_price * quantity;

        const { data, error } = await supabaseClient
            .from('estimate_extras')
            .insert({
                estimate_id: estimateId,
                type: 'custom',
                name: name.trim(),
                description: description?.trim() || null,
                quantity,
                unit_price,
                total_price,
                added_by: 'admin',
                payment_timing
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    // ─── Admin: Update existing extra ───
    static async update(extraId, { name, description, quantity, unit_price, payment_timing }) {
        if (!extraId) throw new Error('extraId required');

        const updates = {};
        if (name !== undefined) updates.name = name.trim();
        if (description !== undefined) updates.description = description?.trim() || null;
        if (quantity !== undefined) {
            if (quantity < 1) throw new Error('quantity must be ≥ 1');
            updates.quantity = quantity;
        }
        if (unit_price !== undefined) {
            if (unit_price < 0) throw new Error('unit_price must be ≥ 0');
            updates.unit_price = unit_price;
        }
        if (payment_timing !== undefined) {
            if (!['with_deposit', 'with_balance', 'on_completion', 'on_delivery'].includes(payment_timing)) {
                throw new Error('invalid payment_timing');
            }
            updates.payment_timing = payment_timing;
        }

        // Recalculate total_price if quantity or unit_price changed
        if (updates.quantity !== undefined || updates.unit_price !== undefined) {
            const { data: current, error: fetchErr } = await supabaseClient
                .from('estimate_extras')
                .select('quantity, unit_price')
                .eq('id', extraId)
                .single();
            if (fetchErr) throw fetchErr;

            const qty = updates.quantity ?? current.quantity;
            const up = updates.unit_price ?? current.unit_price;
            updates.total_price = qty * up;
        }

        const { data, error } = await supabaseClient
            .from('estimate_extras')
            .update(updates)
            .eq('id', extraId)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    // ─── Delete extra by ID ───
    static async delete(extraId) {
        if (!extraId) throw new Error('extraId required');

        const { error } = await supabaseClient
            .from('estimate_extras')
            .delete()
            .eq('id', extraId);

        if (error) throw error;
        return true;
    }

    // ─── Customer: Remove extras by type (e.g. "unclick Installation") ───
    static async removeByType(estimateId, type) {
        if (!estimateId) throw new Error('estimateId required');
        if (!['installation', 'delivery'].includes(type)) {
            throw new Error('removeByType only supports installation or delivery');
        }

        const { error } = await supabaseClient
            .from('estimate_extras')
            .delete()
            .eq('estimate_id', estimateId)
            .eq('type', type);

        if (error) throw error;
        return true;
    }

    // ─── Helper: Calculate totals from extras array ───
    // Returns: { installation, delivery, customTotal, allExtras }
    static calculateTotals(extras = []) {
        const installation = extras.filter(e => e.type === 'installation').reduce((s, e) => s + parseFloat(e.total_price || 0), 0);
        const delivery = extras.filter(e => e.type === 'delivery').reduce((s, e) => s + parseFloat(e.total_price || 0), 0);
        const customTotal = extras.filter(e => e.type === 'custom').reduce((s, e) => s + parseFloat(e.total_price || 0), 0);
        const allExtras = installation + delivery + customTotal;
        return { installation, delivery, customTotal, allExtras };
    }

    // ─── Helper: Group extras by payment_timing for Payment Schedule ───
    // Returns: { with_deposit: [...], with_balance: [...], on_completion: [...], on_delivery: [...] }
    static groupByPaymentTiming(extras = []) {
        const groups = { with_deposit: [], with_balance: [], on_completion: [], on_delivery: [] };
        extras.forEach(e => {
            const bucket = e.payment_timing || 'on_completion';
            if (groups[bucket]) groups[bucket].push(e);
        });
        return groups;
    }
}

// Make globally available
window.EstimateExtras = EstimateExtras;