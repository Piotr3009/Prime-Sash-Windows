// ═══════════════════════════════════════════════════════════════════
// EstimateExtras — service functions for estimate_extras table
// ═══════════════════════════════════════════════════════════════════
// Usage:
//   EstimateExtras.load(estimateId)                 → returns array of extras
//   EstimateExtras.addInstallation(estimateId, qty) → customer adds Installation
//   EstimateExtras.addDelivery(estimateId)          → customer adds Delivery
//   EstimateExtras.addCustom(estimateId, data)      → admin adds custom extra
//   EstimateExtras.update(extraId, data)            → admin edits extra
//   EstimateExtras.delete(extraId)                  → delete by ID
//   EstimateExtras.removeByType(estimateId, type)   → customer "unclicks" Installation/Delivery
// ═══════════════════════════════════════════════════════════════════

class EstimateExtras {
    // Defaults (same as PDF hardcoded values — PR 1)
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

    // ─── Customer: Add Installation (£400 × totalQty) ───
    static async addInstallation(estimateId, totalQty) {
        if (!estimateId) throw new Error('estimateId required');
        if (!totalQty || totalQty < 1) throw new Error('totalQty must be ≥ 1');

        // Prevent duplicate
        if (await EstimateExtras.hasType(estimateId, 'installation')) {
            throw new Error('Installation already added to this estimate');
        }

        const unitPrice = EstimateExtras.INSTALLATION_UNIT_PRICE;
        const totalPrice = unitPrice * totalQty;

        const { data, error } = await supabaseClient
            .from('estimate_extras')
            .insert({
                estimate_id: estimateId,
                type: 'installation',
                name: 'Installation',
                description: 'Standard rate. Final amount subject to site survey.',
                quantity: totalQty,
                unit_price: unitPrice,
                total_price: totalPrice,
                added_by: 'customer',
                payment_timing: 'on_completion'
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    // ─── Customer: Add Delivery (£300 flat) ───
    static async addDelivery(estimateId) {
        if (!estimateId) throw new Error('estimateId required');

        if (await EstimateExtras.hasType(estimateId, 'delivery')) {
            throw new Error('Delivery already added to this estimate');
        }

        const flatPrice = EstimateExtras.DELIVERY_FLAT_PRICE;

        const { data, error } = await supabaseClient
            .from('estimate_extras')
            .insert({
                estimate_id: estimateId,
                type: 'delivery',
                name: 'Delivery',
                description: 'Standard delivery charge. Subject to location confirmation.',
                quantity: 1,
                unit_price: flatPrice,
                total_price: flatPrice,
                added_by: 'customer',
                payment_timing: 'on_delivery'
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    // ─── Admin: Add custom extra (crane, OC, scaffolding, make good, etc.) ───
    static async addCustom(estimateId, { name, description = null, quantity = 1, unit_price, payment_timing = 'on_completion' }) {
        if (!estimateId) throw new Error('estimateId required');
        if (!name || !name.trim()) throw new Error('name required');
        if (unit_price == null || unit_price < 0) throw new Error('unit_price must be ≥ 0');
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
