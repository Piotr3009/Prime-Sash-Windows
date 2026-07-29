// ============================================
// PRIME SASH WINDOWS — Create passport (Etap 3)
// ============================================
// Loaded on admin-dashboard.html only. Adds "Create passport" to orders in
// Production and Completed, and builds the whole passport in one go:
//
//   passport_projects   PSW-2026-0031          (one per job/address)
//     └─ window_passports  PSW-2026-0031-W1 …  (one per physical window)
//
// Deliberately NOT available from an estimate: an estimate is an offer, a
// passport records windows that physically exist. QR plates, documents and
// warranty are managed afterwards in Admin Panel → Project Passports.
//
// FROZEN COPY: specification rows are collected from the SAME renderer the
// admin sees, by briefly intercepting EstimateRenderer.specRow. No second
// mapping to drift out of sync, and no change to its 70 call sites.

(function () {
  'use strict';

  const PassportCreate = {
    existing: {},   // estimate_id -> passport_projects row

    // ---------- data ----------

    async load() {
      this.existing = {};
      if (!window.supabaseClient) return;
      try {
        const { data, error } = await window.supabaseClient
          .from('passport_projects')
          .select('id, passport_no, estimate_id');
        if (error) throw error;
        (data || []).forEach(p => { if (p.estimate_id) this.existing[p.estimate_id] = p; });
      } catch (err) {
        console.warn('Passport projects could not be loaded:', err);
      }
    },

    // ---------- row action in Production / Completed ----------

    rowAction(estimateId) {
      const p = this.existing[estimateId];
      if (p) {
        return `<span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#1D6E4E;margin-right:6px;">${this.esc(p.passport_no)}</span>` +
               `<button class="btn-sm neutral" onclick="PassportCreate.openPanel()">Open passport</button>`;
      }
      return `<button class="btn-sm navy" onclick="PassportCreate.start('${estimateId}')">Create passport</button>`;
    },

    openPanel() {
      window.open('admin-panel.html#passports', '_blank');
    },

    // ---------- creation ----------

    async start(estimateId) {
      const est = (window.allEstimates || []).find(e => e.id === estimateId);
      if (!est) return alert('Order not found — please refresh the page.');
      if (this.existing[estimateId]) return alert('This project already has a passport.');

      const items = est.estimate_items || [];
      if (!items.length) return alert('This order has no windows.');

      const units = this.expandUnits(items);
      const customer = est.customers || est.customer || {};
      const passportNo = this.buildProjectNo(est);
      const today = new Date().toISOString().slice(0, 10);

      const rows = units.map(u =>
        `<tr><td style="padding:4px 10px 4px 0;font-family:'JetBrains Mono',monospace;font-size:11px;">${this.esc(passportNo + '-' + u.suffix)}</td>` +
        `<td style="color:#555;">${this.esc(u.label)}</td></tr>`).join('');

      this.modal('Create passport — ' + this.esc(passportNo), `
        <div style="margin-bottom:12px;">
          <div class="pc-lbl">Passport number</div>
          <div class="pc-ro" id="pc-no">${this.esc(passportNo)}</div>
        </div>
        <div style="display:flex;gap:10px;margin-bottom:12px;">
          <div style="flex:1;">
            <div class="pc-lbl">Client</div>
            <input id="pc-client" class="pc-in" value="${this.esc(customer.full_name || customer.company_name || customer.email || '')}">
          </div>
          <div style="flex:1;">
            <div class="pc-lbl">Completed</div>
            <input id="pc-date" type="date" class="pc-in" value="${today}">
          </div>
        </div>
        <div style="margin-bottom:12px;">
          <div class="pc-lbl">Project address</div>
          <input id="pc-addr" class="pc-in" value="${this.esc(est.project_name || '')}" placeholder="e.g. 12 Elm Street, London">
        </div>
        <div class="pc-lbl">Windows to be created (${units.length})</div>
        <div style="max-height:170px;overflow:auto;background:#F3F0EA;border-radius:3px;padding:9px 11px;">
          <table style="width:100%;font-size:12px;">${rows}</table>
        </div>
        <div class="pc-note">Specifications, photos and 3D are copied now and frozen — later edits to the estimate will not change this passport. QR plates, warranty and documents are added afterwards in Admin Panel → Project Passports.</div>
        <div id="pc-err" class="pc-err"></div>
        <div style="display:flex;gap:8px;margin-top:14px;">
          <button class="pc-btn pc-btn--solid" style="flex:1;" onclick="PassportCreate.confirm('${estimateId}')">Create passport</button>
          <button class="pc-btn" onclick="PassportCreate.close()">Cancel</button>
        </div>`);
    },

    // One physical window = one row = one QR plate. A line with Qty 3 therefore
    // becomes W1/1, W1/2, W1/3 — otherwise two of the three windows could never
    // be given a plate of their own.
    expandUnits(items) {
      const units = [];
      items.forEach(item => {
        const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
        const base = String(item.window_number || '').trim() || 'W';
        for (let i = 1; i <= qty; i++) {
          // Display keeps "W2/1"; the serial uses a dash so it stays clean in
          // print and in filenames: PSW-2026-0031-W2-1
          const suffix = (qty > 1 ? base + '-' + i : base).replace(/\s+/g, '-');
          units.push({
            item: item,
            suffix: suffix,
            windowNumber: qty > 1 ? base + '/' + i : base,
            label: this.typeLabel(item) + (qty > 1 ? ' · ' + i + ' of ' + qty : '')
          });
        }
      });
      return units;
    },

    buildProjectNo(est) {
      const raw = String(est.estimate_number || '').trim();
      const num = raw.replace(/^[A-Za-z]+[-_ ]*/, '') || String(est.id || '').slice(0, 8);
      return ('PSW-' + num).replace(/-+$/, '');
    },

    typeLabel(item) {
      const t = String(item.window_type || '').trim();
      return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Window';
    },

    itemSpec(item) {
      let s = item.specification;
      if (typeof s === 'string') { try { s = JSON.parse(s); } catch (e) { s = null; } }
      return (s && typeof s === 'object') ? s : {};
    },

    collectSpecRows(est, item) {
      const rows = [];
      if (!window.EstimateRenderer || typeof EstimateRenderer.specRow !== 'function') return rows;
      const original = EstimateRenderer.specRow;
      try {
        EstimateRenderer.specRow = function (label, value) {
          const v = (value === null || value === undefined) ? '' : String(value);
          const plain = v.replace(/<[^>]*>/g, '').trim();
          if (plain) rows.push({ label: String(label), value: plain });
          return original.apply(this, arguments);
        };
        EstimateRenderer.renderEstimateHTML(
          Object.assign({}, est, { estimate_items: [item] }),
          { isAdmin: false, isEditable: false }
        );
      } catch (err) {
        console.warn('Spec rows could not be collected:', err);
      } finally {
        EstimateRenderer.specRow = original;
      }
      return rows;
    },

    async confirm(estimateId) {
      const est = (window.allEstimates || []).find(e => e.id === estimateId);
      if (!est) return this.err('Order not found — please refresh the page.');

      const btn = document.querySelector('.pc-btn--solid');
      if (btn) { btn.disabled = true; btn.textContent = 'Creating…'; }

      let project = null;
      try {
        const passportNo = document.getElementById('pc-no').textContent.trim();
        const user = (typeof getCurrentUser === 'function') ? await getCurrentUser() : null;

        const { data: proj, error: projErr } = await window.supabaseClient
          .from('passport_projects')
          .insert([{
            passport_no: passportNo,
            estimate_id: est.id,
            client_name: (document.getElementById('pc-client').value || '').trim() || null,
            project_address: (document.getElementById('pc-addr').value || '').trim() || null,
            completed_date: document.getElementById('pc-date').value || new Date().toISOString().slice(0, 10),
            created_by: user ? user.id : null
          }])
          .select()
          .single();
        if (projErr) throw projErr;
        project = proj;

        const units = this.expandUnits(est.estimate_items || []);
        const specCache = {};
        const payload = units.map(u => {
          if (!specCache[u.item.id]) {
            specCache[u.item.id] = {
              rows: this.collectSpecRows(est, u.item),
              spec: this.itemSpec(u.item)
            };
          }
          const c = specCache[u.item.id];
          return {
            project_id: project.id,
            serial_number: passportNo + '-' + u.suffix,
            estimate_id: est.id,
            estimate_item_id: u.item.id,
            window_number: u.windowNumber,
            window_type: this.typeLabel(u.item),
            manufactured_date: project.completed_date,
            specification: {
              rows: c.rows,
              screenshots: c.spec.screenshots || null,
              viewer3d: c.spec.viewer3d || null
            },
            created_by: user ? user.id : null
          };
        });

        const { error: winErr } = await window.supabaseClient
          .from('window_passports')
          .insert(payload);
        if (winErr) throw winErr;

        this.existing[est.id] = project;
        this.close();
        if (confirm('Passport ' + passportNo + ' created with ' + payload.length + ' windows.\n\nOpen Admin Panel to link QR plates now?')) {
          this.openPanel();
        }
        if (typeof window.loadAllData === 'function') window.loadAllData();
      } catch (err) {
        console.error('Passport creation failed:', err);
        // The project row is created first; if the windows fail, remove it so
        // the operation can be retried cleanly instead of leaving an empty shell.
        if (project && project.id) {
          try { await window.supabaseClient.from('passport_projects').delete().eq('id', project.id); } catch (e) { /* leave it */ }
        }
        const dup = String((err && err.message) || '').toLowerCase().includes('duplicate');
        this.err(dup ? 'A passport with this number already exists.' : 'Could not create the passport. Please try again.');
        if (btn) { btn.disabled = false; btn.textContent = 'Create passport'; }
      }
    },

    // ---------- plumbing ----------

    esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[m]));
    },

    err(msg) {
      const el = document.getElementById('pc-err');
      if (el) { el.textContent = msg; el.style.display = 'block'; }
    },

    modal(title, inner) {
      this.close();
      if (!document.getElementById('pc-style')) {
        const st = document.createElement('style');
        st.id = 'pc-style';
        st.textContent =
          '#pc-overlay{position:fixed;inset:0;background:rgba(10,22,40,.82);z-index:99996;display:flex;align-items:center;justify-content:center;padding:20px;}' +
          '#pc-panel{background:#FAFAF8;border-radius:6px;width:min(470px,96vw);max-height:92vh;overflow:auto;}' +
          '#pc-head{padding:13px 18px;border-bottom:1px solid #E5E2DA;font-family:"Cormorant Garamond",serif;font-size:1.1rem;color:#0A1628;}' +
          '#pc-body{padding:16px 18px;font-family:"Jost",sans-serif;font-size:.8rem;color:#0A1628;}' +
          '.pc-lbl{font-size:.55rem;letter-spacing:.16em;text-transform:uppercase;color:#9E9E90;margin-bottom:4px;}' +
          '.pc-in{width:100%;border:1px solid #C9C6BC;border-radius:3px;padding:9px 11px;font-family:"Jost",sans-serif;font-size:.82rem;color:#0A1628;background:#fff;}' +
          '.pc-in:focus{outline:none;border-color:#0A1628;}' +
          '.pc-ro{font-family:"JetBrains Mono",monospace;font-size:.85rem;background:#F3F0EA;padding:9px 11px;border-radius:3px;}' +
          '.pc-note{background:#F3F0EA;border-radius:3px;padding:9px 11px;color:#5F5E5A;font-size:.72rem;line-height:1.5;margin-top:10px;}' +
          '.pc-err{display:none;background:#F9E9E9;color:#A32D2D;border-radius:3px;padding:9px 11px;font-size:.72rem;margin-top:10px;}' +
          '.pc-btn{border:1px solid #0A1628;background:transparent;color:#0A1628;border-radius:3px;padding:10px 16px;cursor:pointer;' +
          'font-family:"Jost",sans-serif;font-size:.6rem;letter-spacing:.18em;text-transform:uppercase;}' +
          '.pc-btn--solid{background:#0A1628;color:#FAFAF8;}' +
          '.pc-btn:disabled{opacity:.6;cursor:default;}';
        document.head.appendChild(st);
      }
      const ov = document.createElement('div');
      ov.id = 'pc-overlay';
      ov.innerHTML = `<div id="pc-panel"><div id="pc-head">${title}</div><div id="pc-body">${inner}</div></div>`;
      ov.addEventListener('click', e => { if (e.target === ov) this.close(); });
      document.body.appendChild(ov);
    },

    close() {
      const ov = document.getElementById('pc-overlay');
      if (ov) ov.remove();
    }
  };

  window.PassportCreate = PassportCreate;
})();
