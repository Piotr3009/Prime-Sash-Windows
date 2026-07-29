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
          <td style="font-family:'JetBrains Mono',monospace;font-size:12px;">${this.esc(p.passport_no)}</td>
          <td>${this.esc(p.client_name || '—')}<div style="color:#888;font-size:11px;">${this.esc(p.project_address || '')}</div></td>
          <td>${c.total}</td>
          <td style="color:${done ? '#1D6E4E' : '#8A4B12'};">${c.linked} / ${c.total}</td>
          <td>${p.warranty_no ? `<span style="font-family:'JetBrains Mono',monospace;font-size:11px;">${this.esc(p.warranty_no)}</span>` : '<span style="color:#888;">—</span>'}</td>
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
          <td style="padding:8px 0;">${this.esc(w.window_number || '')}<div style="color:#888;font-size:11px;">${this.esc(w.window_type || '')}</div></td>
          <td style="font-family:'JetBrains Mono',monospace;font-size:11px;">${this.esc(w.serial_number)}</td>
          <td>${w.project_label
                ? this.esc(w.project_label)
                : `<a href="#" onclick="PassportProjects.setLocation('${w.id}');return false;" style="color:#888;">— add —</a>`}</td>
          <td>${w.plate_code
                ? `<span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#1D6E4E;" title="${this.esc(w.plate_code)}">…${this.esc(String(w.plate_code).slice(-6))} &#10003;</span>`
                : '<span style="color:#8A4B12;font-size:12px;">not linked</span>'}</td>
          <td style="text-align:right;white-space:nowrap;">
            <button class="btn-sm ${w.plate_code ? 'neutral' : 'navy'}" onclick="PassportProjects.openScan('${w.id}')">${w.plate_code ? 'Re-scan' : 'Scan QR'}</button>
            <button class="btn-sm neutral" onclick="window.open('/p/${w.token}','_blank')">View</button>
          </td>
        </tr>`).join('');

      const linked = this.windows.filter(w => w.plate_code).length;

      this.body(`
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;border-bottom:1px solid #E5E2DA;padding-bottom:11px;margin-bottom:11px;">
          <div style="font-size:12px;color:#555;">
            ${this.esc(p.project_address || 'No address')}<br>
            <span style="color:#888;">Completed ${this.esc(p.completed_date || '')} · ${linked} of ${this.windows.length} plates linked</span>
          </div>
          <div style="display:flex;gap:6px;">
            <button class="btn-sm neutral" onclick="PassportProjects.openWarranty()">${p.warranty_no ? 'Warranty: ' + this.esc(p.warranty_no) : 'Add warranty'}</button>
            <button class="btn-sm neutral" onclick="PassportProjects.openEdit()">Edit</button>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
          <thead><tr style="color:#888;font-size:10px;letter-spacing:.1em;text-transform:uppercase;text-align:left;">
            <th style="padding-bottom:6px;">Window</th><th>Serial</th><th>Location</th><th>QR plate</th><th></th>
          </tr></thead>
          <tbody>${rows || '<tr><td colspan="5" style="padding:12px;color:#888;">No windows.</td></tr>'}</tbody>
        </table>
        <div class="pp-note">Specifications, photos and 3D were frozen when this passport was created. Corrections are possible and are logged; the QR link never changes.</div>
        <div id="pp-err" class="pp-err"></div>
        <div style="margin-top:14px;text-align:right;"><button class="pp-btn" onclick="PassportProjects.close()">Close</button></div>`);
    },

    // ---------- location ----------

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
        <div style="margin-top:12px;">
          <div class="pp-lbl">Or type the code from the plate</div>
          <input id="pp-code" class="pp-in" placeholder="e.g. 123455666.44555" autocomplete="off">
        </div>
        <div id="pp-err" class="pp-err"></div>
        <div style="display:flex;gap:8px;margin-top:14px;">
          <button class="pp-btn pp-btn--solid" style="flex:1;" onclick="PassportProjects.saveCode('${windowId}')">Link plate</button>
          <button class="pp-btn" onclick="PassportProjects.backToDetail()">Cancel</button>
        </div>`);
      this.startCamera(windowId);
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

    openWarranty() {
      const p = this.current;
      this.modal('Warranty — ' + this.esc(p.passport_no), `
        <div style="margin-bottom:12px;">
          <div class="pp-lbl">Warranty number</div>
          <input id="pp-war-no" class="pp-in" value="${this.esc(p.warranty_no || '')}" placeholder="PSW-2026-00123">
        </div>
        <div style="display:flex;gap:10px;">
          <div style="flex:1;">
            <div class="pp-lbl">Years</div>
            <input id="pp-war-years" type="number" min="1" max="50" class="pp-in" value="${p.warranty_years || 10}">
          </div>
          <div style="flex:1;">
            <div class="pp-lbl">Expiry</div>
            <input id="pp-war-exp" type="date" class="pp-in" value="${this.esc(p.warranty_expiry || '')}">
          </div>
        </div>
        <div class="pp-note">The warranty applies to the whole project and appears on every window's passport page. Leave the expiry blank to calculate it from the completion date.</div>
        <div id="pp-err" class="pp-err"></div>
        <div style="display:flex;gap:8px;margin-top:14px;">
          <button class="pp-btn pp-btn--solid" style="flex:1;" onclick="PassportProjects.saveWarranty()">Save warranty</button>
          <button class="pp-btn" onclick="PassportProjects.backToDetail()">Cancel</button>
        </div>`);
    },

    async saveWarranty() {
      const p = this.current;
      const no = (document.getElementById('pp-war-no').value || '').trim();
      const years = Math.max(1, parseInt(document.getElementById('pp-war-years').value, 10) || 10);
      let exp = document.getElementById('pp-war-exp').value || '';
      if (no && !exp) {
        const d = new Date((p.completed_date || new Date().toISOString().slice(0, 10)) + 'T00:00:00');
        d.setFullYear(d.getFullYear() + years);
        exp = d.toISOString().slice(0, 10);
      }
      await this.patchProject({
        warranty_no: no || null,
        warranty_years: years,
        warranty_expiry: no ? (exp || null) : null
      }, 'warranty');
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
          '#pp-panel{background:#FAFAF8;border-radius:6px;width:min(720px,96vw);max-height:92vh;overflow:auto;}' +
          '#pp-head{padding:13px 18px;border-bottom:1px solid #E5E2DA;font-family:"Cormorant Garamond",serif;font-size:1.15rem;color:#0A1628;}' +
          '#pp-body{padding:16px 18px;font-family:"Jost",sans-serif;font-size:.82rem;color:#0A1628;}' +
          '.pp-lbl{font-size:.55rem;letter-spacing:.16em;text-transform:uppercase;color:#9E9E90;margin-bottom:4px;}' +
          '.pp-in{width:100%;border:1px solid #C9C6BC;border-radius:3px;padding:9px 11px;font-family:"Jost",sans-serif;font-size:.82rem;color:#0A1628;background:#fff;}' +
          '.pp-in:focus{outline:none;border-color:#0A1628;}' +
          '.pp-note{background:#F3F0EA;border-radius:3px;padding:9px 11px;color:#5F5E5A;font-size:.72rem;line-height:1.5;margin-top:12px;}' +
          '.pp-warn{background:#F7EDE1;color:#8A4B12;border-radius:3px;padding:10px 12px;font-size:.74rem;line-height:1.5;margin-bottom:12px;}' +
          '.pp-err{display:none;background:#F9E9E9;color:#A32D2D;border-radius:3px;padding:9px 11px;font-size:.72rem;margin-top:10px;}' +
          '.pp-btn{border:1px solid #0A1628;background:transparent;color:#0A1628;border-radius:3px;padding:10px 16px;cursor:pointer;' +
          'font-family:"Jost",sans-serif;font-size:.6rem;letter-spacing:.18em;text-transform:uppercase;}' +
          '.pp-btn--solid{background:#0A1628;color:#FAFAF8;}';
        document.head.appendChild(st);
      }
      const ov = document.createElement('div');
      ov.id = 'pp-overlay';
      ov.innerHTML = `<div id="pp-panel"><div id="pp-head">${title}</div><div id="pp-body">${inner}</div></div>`;
      ov.addEventListener('click', e => { if (e.target === ov) this.close(); });
      document.body.appendChild(ov);
    },

    close() {
      this.stopCamera();
      const ov = document.getElementById('pp-overlay');
      if (ov) ov.remove();
    }
  };

  window.PassportProjects = PassportProjects;
})();
