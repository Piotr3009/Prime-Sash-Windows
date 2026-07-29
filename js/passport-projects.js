// ============================================
// PRIME SASH WINDOWS — Project Passports (Etap 3)
// ============================================
// Admin Panel tab. Lists project passports created from Production/Completed,
// opens one, and manages its windows: link a pre-engraved QR plate to each,
// set the project warranty, correct details when something was mistyped.
//
// A passport is a permanent document, so edits are possible but logged in
// edit_history and never change the public token — a plate already fixed to a
// window keeps working after a correction.

(function () {
  'use strict';

  const PassportProjects = {
    projects: [],
    current: null,
    windows: [],

    // ---------- list ----------

    async load() {
      const tbody = document.getElementById('pp-tbody');
      if (!tbody) return;
      tbody.innerHTML = '<tr><td colspan="6" style="padding:14px;color:#888;">Loading…</td></tr>';
      try {
        const { data, error } = await window.supabaseClient
          .from('passport_projects')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        this.projects = data || [];

        const ids = this.projects.map(p => p.id);
        const counts = {};
        if (ids.length) {
          const { data: wins } = await window.supabaseClient
            .from('window_passports')
            .select('project_id, plate_code')
            .in('project_id', ids);
          (wins || []).forEach(w => {
            const c = counts[w.project_id] || (counts[w.project_id] = { total: 0, linked: 0 });
            c.total++;
            if (w.plate_code) c.linked++;
          });
        }
        this.render(counts);
      } catch (err) {
        console.error('Project passports failed to load:', err);
        tbody.innerHTML = '<tr><td colspan="6" style="padding:14px;color:#a33;">Could not load passports. Check that db/passport-projects.sql has been run.</td></tr>';
      }
    },

    render(counts) {
      const tbody = document.getElementById('pp-tbody');
      if (!tbody) return;
      if (!this.projects.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding:14px;color:#888;">No passports yet. Create one from Admin Dashboard → Production or Completed.</td></tr>';
        return;
      }
      tbody.innerHTML = this.projects.map(p => {
        const c = counts[p.id] || { total: 0, linked: 0 };
        const done = c.total > 0 && c.linked === c.total;
        return `<tr>
          <td class="pp-mono">${this.esc(p.passport_no)}</td>
          <td>${this.esc(p.client_name || '—')}<div class="pp-sub">${this.esc(p.project_address || '')}</div></td>
          <td class="pp-count">${c.total}</td>
          <td class="pp-count" style="color:${done ? '#1D6E4E' : '#8A4B12'};">${c.linked} / ${c.total}</td>
          <td>${p.warranty_no ? `<span class="pp-mono">${this.esc(p.warranty_no)}</span>` : '<span style="color:#5F5E5A;">—</span>'}</td>
          <td><button class="btn-sm neutral" onclick="PassportProjects.open('${p.id}')">Open</button></td>
        </tr>`;
      }).join('');
    },

    // ---------- project detail ----------

    async open(projectId) {
      const p = this.projects.find(x => x.id === projectId);
      if (!p) return;
      this.current = p;
      this.modal(this.esc(p.passport_no) + ' — ' + this.esc(p.client_name || ''), '<div style="color:#888;">Loading windows…</div>');
      try {
        const { data, error } = await window.supabaseClient
          .from('window_passports')
          .select('*')
          .eq('project_id', projectId)
          .order('serial_number', { ascending: true });
        if (error) throw error;
        this.windows = data || [];
        this.renderDetail();
      } catch (err) {
        console.error('Windows failed to load:', err);
        this.body('<div style="color:#a33;">Could not load the windows for this passport.</div>');
      }
    },

    renderDetail() {
      const p = this.current;
      const rows = this.windows.map(w => `
        <tr>
          <td style="padding:12px 0;">${this.esc(w.window_number || '')}<div style="color:#5F5E5A;font-size:13px;margin-top:2px;">${this.esc(w.window_type || '')}</div></td>
          <td style="font-family:'JetBrains Mono',monospace;font-size:13.5px;">${this.esc(w.serial_number)}</td>
          <td>${w.project_label
                ? this.esc(w.project_label)
                : `<a href="#" onclick="PassportProjects.setLocation('${w.id}');return false;" style="color:#5F5E5A;">— add —</a>`}</td>
          <td>${w.u_value
                ? `<a href="#" onclick="PassportProjects.setUValue('${w.id}');return false;" style="color:#0A1628;">${this.esc(w.u_value)}</a>`
                : `<a href="#" onclick="PassportProjects.setUValue('${w.id}');return false;" style="color:#5F5E5A;">— add —</a>`}</td>
          <td>${w.plate_code
                ? `<span style="font-family:'JetBrains Mono',monospace;font-size:13.5px;color:#1D6E4E;" title="${this.esc(w.plate_code)}">…${this.esc(String(w.plate_code).slice(-6))} &#10003;</span>`
                : '<span style="color:#7A400F;font-size:14px;">not linked</span>'}</td>
          <td style="text-align:right;white-space:nowrap;">
            <button class="btn-sm ${w.plate_code ? 'neutral' : 'navy'}" onclick="PassportProjects.openScan('${w.id}')">${w.plate_code ? 'Re-scan' : 'Scan QR'}</button>
            <button class="btn-sm neutral" onclick="window.open('/p/${w.token}','_blank')">View</button>
          </td>
        </tr>`).join('');

      const linked = this.windows.filter(w => w.plate_code).length;

      this.body(`
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;border-bottom:1px solid #E5E2DA;padding-bottom:11px;margin-bottom:11px;">
          <div style="font-size:15px;color:#3F3F3A;">
            ${this.esc(p.project_address || 'No address')}<br>
            <span style="color:#5F5E5A;">Completed ${this.esc(p.completed_date || '')} · ${linked} of ${this.windows.length} plates linked</span>
          </div>
          <div style="display:flex;gap:6px;">
            <button class="btn-sm neutral" onclick="PassportProjects.openWarranty()">${p.warranty_no ? 'Warranty: ' + this.esc(p.warranty_no) : 'Add warranty'}</button>
            <button class="btn-sm neutral" onclick="PassportProjects.openEdit()">Edit</button>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:15px;">
          <thead><tr style="color:#3F3F3A;font-size:12px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;text-align:left;">
            <th style="padding-bottom:6px;">Window</th><th>Serial</th><th>Location</th><th>U-value</th><th>QR plate</th><th></th>
          </tr></thead>
          <tbody>${rows || '<tr><td colspan="6" style="padding:12px;color:#888;">No windows.</td></tr>'}</tbody>
        </table>
        <div class="pp-note">Specifications, photos and 3D were frozen when this passport was created. Corrections are possible and are logged; the QR link never changes.</div>
        <div id="pp-err" class="pp-err"></div>
        <div style="margin-top:14px;text-align:right;"><button class="pp-btn" onclick="PassportProjects.close()">Close</button></div>`);
    },

    // ---------- location ----------

    // Typed in by hand, per window: a whole-window Uw depends on the
    // frame-to-glass ratio, so it differs between windows in the same job and
    // cannot be derived from the glazing type alone.
    async setUValue(windowId) {
      const w = this.windows.find(x => x.id === windowId);
      if (!w) return;
      const val = prompt('U-value for ' + w.serial_number + '  (W/m\u00b2K, whole window):', w.u_value || '');
      if (val === null) return;
      const clean = String(val).trim();
      if (clean && !/^[0-9]+([.,][0-9]+)?$/.test(clean)) {
        return alert('Enter a number, for example 1.2');
      }
      await this.patchWindow(windowId, { u_value: clean ? clean.replace(',', '.') : null });
    },

    async setLocation(windowId) {
      const w = this.windows.find(x => x.id === windowId);
      if (!w) return;
      const val = prompt('Location on site for ' + w.serial_number + ':', w.project_label || '');
      if (val === null) return;
      await this.patchWindow(windowId, { project_label: val.trim() || null });
    },

    // ---------- QR plate ----------

    openScan(windowId) {
      const w = this.windows.find(x => x.id === windowId);
      if (!w) return;
      this.modal('Link QR plate — ' + this.esc(w.serial_number), `
        ${w.plate_code ? `<div class="pp-warn">This window already has plate <strong>${this.esc(w.plate_code)}</strong>. Scanning a new one replaces it — the old plate stops working.</div>` : ''}
        <div id="pp-cam-wrap" style="background:#000;border-radius:4px;overflow:hidden;display:none;">
          <video id="pp-video" playsinline muted style="width:100%;display:block;max-height:280px;object-fit:cover;"></video>
        </div>
        <div id="pp-cam-msg" class="pp-note">Starting camera…</div>
        <div style="margin-top:14px;">
          <div class="pp-lbl">Type the code from the plate</div>
          <div style="display:flex;align-items:stretch;border:1px solid #A8A59B;border-radius:3px;background:#fff;overflow:hidden;">
            <span style="display:flex;align-items:center;padding:13px 4px 13px 15px;background:#F3F0EA;color:#5F5E5A;
                         font-family:'JetBrains Mono',monospace;font-size:1rem;white-space:nowrap;border-right:1px solid #E5E2DA;">
              primesashwindows.co.uk/q/</span>
            <input id="pp-code" autocomplete="off" placeholder="123456"
                   style="flex:1;min-width:0;border:none;outline:none;padding:13px 15px;background:#fff;
                          font-family:'JetBrains Mono',monospace;font-size:1.05rem;color:#0A1628;">
          </div>
          <div class="pp-note" style="margin-top:8px;">Type only the number. Scanning or pasting the full address also works — the prefix is stripped automatically.</div>
        </div>
        <div id="pp-err" class="pp-err"></div>
        <div style="display:flex;gap:8px;margin-top:14px;">
          <button class="pp-btn pp-btn--solid" style="flex:1;" onclick="PassportProjects.saveCode('${windowId}')">Link plate</button>
          <button class="pp-btn" onclick="PassportProjects.backToDetail()">Cancel</button>
        </div>`);
      this.startCamera(windowId);

      // Cursor lands in the field so the code can be typed straight away, and
      // Enter saves - the same keystrokes a barcode scanner will send later.
      const input = document.getElementById('pp-code');
      if (input) {
        setTimeout(() => input.focus(), 60);
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter') { e.preventDefault(); this.saveCode(windowId); }
        });
      }
    },

    // Accepts whatever the supplier engraved: a full URL on our domain, or a
    // bare code. A URL is reduced to its last path segment so both work.
    normaliseCode(raw) {
      let s = String(raw || '').trim();
      if (!s) return '';
      if (/^https?:\/\//i.test(s)) {
        try {
          const parts = new URL(s).pathname.split('/').filter(Boolean);
          s = parts.length ? parts[parts.length - 1] : '';
        } catch (e) { /* keep raw */ }
      }
      try { s = decodeURIComponent(s); } catch (e) { /* keep raw */ }
      s = s.trim();
      return /^[A-Za-z0-9._-]{1,64}$/.test(s) ? s : '';
    },

    async startCamera(windowId) {
      const msg = document.getElementById('pp-cam-msg');
      const wrap = document.getElementById('pp-cam-wrap');
      const video = document.getElementById('pp-video');
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof jsQR !== 'function') {
        if (msg) msg.textContent = 'Camera scanning is not available here — type the code instead.';
        return;
      }
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } }, audio: false
        });
        video.srcObject = this.stream;
        await video.play();
        wrap.style.display = 'block';
        if (msg) msg.textContent = 'Point the camera at the plate.';

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const tick = () => {
          if (!this.stream) return;
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth; canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const hit = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
            if (hit && hit.data) {
              const code = this.normaliseCode(hit.data);
              const input = document.getElementById('pp-code');
              if (code && input) {
                input.value = code;
                if (msg) msg.textContent = 'Plate read: ' + code;
                this.stopCamera();
                this.saveCode(windowId);
                return;
              }
            }
          }
          this.raf = requestAnimationFrame(tick);
        };
        this.raf = requestAnimationFrame(tick);
      } catch (err) {
        console.warn('Camera unavailable:', err);
        if (msg) msg.textContent = 'Camera unavailable — type the code from the plate instead.';
      }
    },

    stopCamera() {
      if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; }
      if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
    },

    async saveCode(windowId) {
      const input = document.getElementById('pp-code');
      const code = this.normaliseCode(input && input.value);
      if (!code) return this.err('Enter the code from the plate (letters, digits, dots and dashes).');
      this.stopCamera();
      await this.patchWindow(windowId, { plate_code: code, plate_linked_at: new Date().toISOString() }, true);
    },

    async patchWindow(windowId, patch, backToDetail) {
      try {
        const { data, error } = await window.supabaseClient
          .from('window_passports')
          .update(patch)
          .eq('id', windowId)
          .select()
          .single();
        if (error) throw error;
        const i = this.windows.findIndex(w => w.id === windowId);
        if (i >= 0) this.windows[i] = data;
        if (backToDetail) this.backToDetail(); else this.renderDetail();
      } catch (err) {
        console.error('Update failed:', err);
        const dup = String((err && err.message) || '').toLowerCase().includes('duplicate');
        this.err(dup ? 'This plate is already linked to another window.' : 'Could not save. Please try again.');
      }
    },

    backToDetail() {
      this.stopCamera();
      this.modal(this.esc(this.current.passport_no) + ' — ' + this.esc(this.current.client_name || ''), '');
      this.renderDetail();
    },

    // ---------- warranty ----------

    // Warranty numbers are picked from the certificates that already exist -
    // typing them by hand invites a typo on a document that lasts ten years.
    // The expiry comes from the certificate itself, never re-calculated here
    // unless the certificate has none.
    warranties: [],
    warrantyPick: null,

    async openWarranty() {
      const p = this.current;
      this.warrantyPick = p.warranty_no
        ? { warranty_no: p.warranty_no, warranty_expiry: p.warranty_expiry }
        : null;

      this.modal('Warranty — ' + this.esc(p.passport_no), '<div style="color:#888;">Loading certificates…</div>');

      try {
        const { data, error } = await window.supabaseClient
          .from('warranty_certificates')
          .select('warranty_no, client_name, property_address, manufacturing_date, warranty_expiry, order_reference')
          .order('warranty_no', { ascending: false });
        if (error) throw error;
        this.warranties = data || [];
      } catch (err) {
        console.error('Certificates failed to load:', err);
        this.body('<div style="color:#a33;">Could not load warranty certificates.</div>' +
          '<div style="margin-top:14px;text-align:right;"><button class="pp-btn" onclick="PassportProjects.backToDetail()">Back</button></div>');
        return;
      }

      if (!this.warranties.length) {
        this.body('<div class="pp-note">No warranty certificates exist yet. Issue one first in the Warranties tab, then link it here.</div>' +
          '<div style="margin-top:14px;text-align:right;"><button class="pp-btn" onclick="PassportProjects.backToDetail()">Back</button></div>');
        return;
      }

      const years = this.warrantyYears();
      const current = String(new Date().getFullYear());
      const startYear = years.indexOf(current) >= 0 ? current : years[0];

      this.body(`
        <div style="display:flex;gap:10px;margin-bottom:12px;">
          <div style="width:120px;">
            <div class="pp-lbl">Year</div>
            <select id="pp-war-year" class="pp-in" onchange="PassportProjects.renderWarrantyList()">
              ${years.map(y => `<option value="${y}"${y === startYear ? ' selected' : ''}>${y}</option>`).join('')}
              <option value="all">All years</option>
            </select>
          </div>
          <div style="flex:1;">
            <div class="pp-lbl">Search</div>
            <input id="pp-war-q" class="pp-in" placeholder="number or client" autocomplete="off"
                   oninput="PassportProjects.renderWarrantyList()">
          </div>
        </div>
        <div id="pp-war-list" style="border:1px solid #E5E2DA;border-radius:3px;max-height:210px;overflow:auto;background:#fff;"></div>
        <div id="pp-war-sel"></div>
        <div id="pp-err" class="pp-err"></div>
        <div style="display:flex;gap:8px;margin-top:16px;">
          <button class="pp-btn pp-btn--solid" style="flex:1;" onclick="PassportProjects.saveWarranty()">Save warranty</button>
          ${p.warranty_no ? '<button class="pp-btn" onclick="PassportProjects.clearWarranty()">Remove</button>' : ''}
          <button class="pp-btn" onclick="PassportProjects.backToDetail()">Cancel</button>
        </div>`);

      this.renderWarrantyList();
    },

    // Year taken from the number (PSW-2026-00123), falling back to the
    // manufacturing date, so odd numbering never hides a certificate.
    certYear(w) {
      const m = String(w.warranty_no || '').match(/(20\d{2})/);
      if (m) return m[1];
      return String(w.manufacturing_date || '').slice(0, 4) || '—';
    },

    warrantyYears() {
      const set = {};
      this.warranties.forEach(w => { set[this.certYear(w)] = true; });
      return Object.keys(set).sort().reverse();
    },

    renderWarrantyList() {
      const yearEl = document.getElementById('pp-war-year');
      const qEl = document.getElementById('pp-war-q');
      const list = document.getElementById('pp-war-list');
      if (!list) return;
      const year = yearEl ? yearEl.value : 'all';
      const q = (qEl ? qEl.value : '').trim().toLowerCase();

      const rows = this.warranties.filter(w => {
        if (year !== 'all' && this.certYear(w) !== year) return false;
        if (!q) return true;
        return [w.warranty_no, w.client_name, w.property_address, w.order_reference]
          .some(v => String(v || '').toLowerCase().includes(q));
      });

      list.innerHTML = rows.length ? rows.map(w => {
        const on = this.warrantyPick && this.warrantyPick.warranty_no === w.warranty_no;
        return `<div onclick="PassportProjects.pickWarranty('${this.esc(w.warranty_no)}')"
             style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:14px 16px;cursor:pointer;
                    border-top:1px solid #EFEDE7;${on ? 'background:#0A1628;color:#FAFAF8;' : ''}">
          <div style="min-width:0;">
            <div style="font-family:'JetBrains Mono',monospace;font-size:1rem;">${this.esc(w.warranty_no)}</div>
            <div style="font-size:.9rem;color:${on ? 'rgba(255,255,255,.75)' : '#5F5E5A'};margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
              ${this.esc(w.client_name || '')}${w.property_address ? ' · ' + this.esc(w.property_address) : ''}</div>
          </div>
          <div style="font-size:.88rem;color:${on ? 'rgba(255,255,255,.8)' : '#5F5E5A'};white-space:nowrap;">
            ${on ? '&#10003;' : this.esc(this.shortDate(w.manufacturing_date))}</div>
        </div>`;
      }).join('') : '<div style="padding:16px;color:#5F5E5A;font-size:.95rem;">No certificates match.</div>';

      this.renderWarrantySelected();
    },

    shortDate(d) {
      if (!d) return '';
      const dt = new Date(String(d) + 'T00:00:00');
      return isNaN(dt) ? '' : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    },

    longDate(d) {
      if (!d) return '';
      const dt = new Date(String(d) + 'T00:00:00');
      return isNaN(dt) ? '' : dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    },

    pickWarranty(no) {
      const w = this.warranties.find(x => x.warranty_no === no);
      if (!w) return;
      this.warrantyPick = { warranty_no: w.warranty_no, warranty_expiry: w.warranty_expiry || null };
      this.renderWarrantyList();
    },

    // Expiry: from the certificate when it has one, otherwise derived from the
    // project completion date so the client is never shown a blank.
    resolvedExpiry() {
      if (!this.warrantyPick) return null;
      if (this.warrantyPick.warranty_expiry) {
        return { date: this.warrantyPick.warranty_expiry, source: 'from certificate' };
      }
      const p = this.current;
      const base = p.completed_date || new Date().toISOString().slice(0, 10);
      const d = new Date(base + 'T00:00:00');
      d.setFullYear(d.getFullYear() + (p.warranty_years || 10));
      return { date: d.toISOString().slice(0, 10), source: 'calculated from completion date' };
    },

    renderWarrantySelected() {
      const el = document.getElementById('pp-war-sel');
      if (!el) return;
      if (!this.warrantyPick) {
        el.innerHTML = '<div class="pp-note">Select a certificate from the list. Its expiry date is taken automatically.</div>';
        return;
      }
      const exp = this.resolvedExpiry();
      el.innerHTML = `<div style="display:flex;gap:12px;margin-top:14px;background:#F3F0EA;border-radius:3px;padding:12px 14px;">
          <div style="flex:1;">
            <div class="pp-lbl">Selected</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:1.05rem;">${this.esc(this.warrantyPick.warranty_no)}</div>
          </div>
          <div style="flex:1;">
            <div class="pp-lbl">Valid until</div>
            <div style="font-size:1.05rem;">${this.esc(this.longDate(exp.date))}
              <span style="color:#5F5E5A;font-size:.85rem;">· ${exp.source}</span></div>
          </div>
        </div>`;
    },

    async saveWarranty() {
      if (!this.warrantyPick) return this.err('Select a certificate first.');
      const exp = this.resolvedExpiry();
      await this.patchProject({
        warranty_no: this.warrantyPick.warranty_no,
        warranty_expiry: exp ? exp.date : null
      }, 'warranty');
    },

    async clearWarranty() {
      if (!confirm('Remove the warranty from this passport?')) return;
      this.warrantyPick = null;
      await this.patchProject({ warranty_no: null, warranty_expiry: null }, 'warranty removed');
    },

    // ---------- edit with warning ----------

    openEdit() {
      const p = this.current;
      this.modal('Correct passport — ' + this.esc(p.passport_no), `
        <div class="pp-warn">This is a permanent document. The client may already have these windows installed — correct mistakes only. Every change is logged.</div>
        <div style="margin-bottom:12px;">
          <div class="pp-lbl">Client</div>
          <input id="pp-e-client" class="pp-in" value="${this.esc(p.client_name || '')}">
        </div>
        <div style="margin-bottom:12px;">
          <div class="pp-lbl">Project address</div>
          <input id="pp-e-addr" class="pp-in" value="${this.esc(p.project_address || '')}">
        </div>
        <div style="margin-bottom:12px;">
          <div class="pp-lbl">Completed</div>
          <input id="pp-e-date" type="date" class="pp-in" value="${this.esc(p.completed_date || '')}">
        </div>
        <div id="pp-err" class="pp-err"></div>
        <div style="display:flex;gap:8px;margin-top:14px;">
          <button class="pp-btn pp-btn--solid" style="flex:1;" onclick="PassportProjects.saveEdit()">Save correction</button>
          <button class="pp-btn" onclick="PassportProjects.backToDetail()">Cancel</button>
        </div>`);
    },

    async saveEdit() {
      await this.patchProject({
        client_name: (document.getElementById('pp-e-client').value || '').trim() || null,
        project_address: (document.getElementById('pp-e-addr').value || '').trim() || null,
        completed_date: document.getElementById('pp-e-date').value || this.current.completed_date
      }, 'details');
    },

    async patchProject(patch, what) {
      const p = this.current;
      try {
        const user = (typeof getCurrentUser === 'function') ? await getCurrentUser() : null;
        const before = {};
        Object.keys(patch).forEach(k => { before[k] = p[k]; });
        const history = Array.isArray(p.edit_history) ? p.edit_history.slice() : [];
        history.push({
          at: new Date().toISOString(),
          by: user ? (user.email || user.id) : 'unknown',
          what: what,
          before: before
        });

        const { data, error } = await window.supabaseClient
          .from('passport_projects')
          .update(Object.assign({}, patch, { edit_history: history, updated_at: new Date().toISOString() }))
          .eq('id', p.id)
          .select()
          .single();
        if (error) throw error;

        this.current = data;
        const i = this.projects.findIndex(x => x.id === data.id);
        if (i >= 0) this.projects[i] = data;
        this.backToDetail();
        this.load();
      } catch (err) {
        console.error('Save failed:', err);
        this.err('Could not save. Please try again.');
      }
    },

    // ---------- plumbing ----------

    esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[m]));
    },

    err(msg) {
      const el = document.getElementById('pp-err');
      if (el) { el.textContent = msg; el.style.display = 'block'; }
    },

    body(html) {
      const el = document.getElementById('pp-body');
      if (el) el.innerHTML = html;
    },

    modal(title, inner) {
      this.close();
      if (!document.getElementById('pp-style')) {
        const st = document.createElement('style');
        st.id = 'pp-style';
        st.textContent =
          '#pp-overlay{position:fixed;inset:0;background:rgba(10,22,40,.82);z-index:99997;display:flex;align-items:center;justify-content:center;padding:20px;}' +
          '#pp-panel{background:#FAFAF8;border-radius:6px;width:min(1120px,96vw);max-height:92vh;overflow:auto;}' +
          '#pp-head{display:flex;justify-content:space-between;align-items:center;gap:12px;}' +
          '#pp-close{background:none;border:none;font-size:1.6rem;line-height:1;color:#9E9E90;cursor:pointer;padding:0 4px;}' +
          '#pp-close:hover{color:#0A1628;}' +
          '#pp-head{padding:18px 24px;border-bottom:1px solid #E5E2DA;font-family:"Cormorant Garamond",serif;font-size:1.6rem;color:#0A1628;}' +
          '#pp-body{padding:22px 24px;font-family:"Jost",sans-serif;font-size:1.02rem;line-height:1.55;color:#0A1628;}' +
          '.pp-lbl{font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:#5F5E5A;margin-bottom:6px;font-weight:500;}' +
          '.pp-in{width:100%;border:1px solid #A8A59B;border-radius:3px;padding:13px 15px;font-family:"Jost",sans-serif;font-size:1.05rem;color:#0A1628;background:#fff;}' +
          '.pp-in:focus{outline:none;border-color:#0A1628;}' +
          '.pp-note{background:#F3F0EA;border-radius:3px;padding:12px 14px;color:#44443F;font-size:.88rem;line-height:1.55;margin-top:14px;}' +
          '.pp-warn{background:#F7EDE1;color:#7A400F;border-radius:3px;padding:13px 15px;font-size:.92rem;line-height:1.55;margin-bottom:14px;}' +
          '.pp-err{display:none;background:#F9E9E9;color:#8F2020;border-radius:3px;padding:12px 14px;font-size:.92rem;margin-top:12px;}' +
          '.pp-btn{border:1px solid #0A1628;background:transparent;color:#0A1628;border-radius:3px;padding:13px 20px;cursor:pointer;' +
          'font-family:"Jost",sans-serif;font-size:.76rem;letter-spacing:.14em;text-transform:uppercase;font-weight:500;}' +
          '.pp-btn--solid{background:#0A1628;color:#FAFAF8;}';
        document.head.appendChild(st);
      }
      const ov = document.createElement('div');
      ov.id = 'pp-overlay';
      // Closes only via the X or after saving - a stray click on the backdrop
      // must not discard work in progress.
      ov.innerHTML = `<div id="pp-panel"><div id="pp-head"><span>${title}</span>` +
        `<button id="pp-close" type="button" aria-label="Close" onclick="PassportProjects.close()">&times;</button></div>` +
        `<div id="pp-body">${inner}</div></div>`;
      document.body.appendChild(ov);
      if (typeof window.makeDraggable === 'function') {
        window.makeDraggable(document.getElementById('pp-panel'), document.getElementById('pp-head'));
      }
    },

    close() {
      this.stopCamera();
      const ov = document.getElementById('pp-overlay');
      if (ov) ov.remove();
    }
  };

  window.PassportProjects = PassportProjects;
})();
