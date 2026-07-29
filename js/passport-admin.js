// ============================================
// PRIME SASH WINDOWS — Passport admin (Etap 2)
// ============================================
// Creates a Window Passport from an estimate item, then links a pre-engraved
// metal QR plate to it by scanning with the device camera.
//
// Loaded on admin-dashboard.html only. estimate-renderer.js calls
// EstimateRenderer.passportControl(), which delegates here and renders nothing
// when this module is absent — so customer/public views are unaffected.
//
// FROZEN COPY: the specification rows written into the passport are collected
// from the SAME renderer the admin sees on screen (by briefly intercepting
// EstimateRenderer.specRow). No second mapping to drift out of sync, and no
// change to the 70 existing specRow call sites.

(function () {
  'use strict';

  const PassportAdmin = {
    byItemId: {},          // estimate_item_id -> passport row
    currentEstimate: null,

    // ---------- data ----------

    async load(estimateId) {
      this.byItemId = {};
      if (!estimateId || !window.supabaseClient) return;
      try {
        const { data, error } = await window.supabaseClient
          .from('window_passports')
          .select('*')
          .eq('estimate_id', estimateId);
        if (error) throw error;
        (data || []).forEach(p => { if (p.estimate_item_id) this.byItemId[p.estimate_item_id] = p; });
      } catch (err) {
        console.warn('Passports could not be loaded:', err);
      }
    },

    // ---------- rendering ----------

    // Rendered inside the dark item header in the admin estimate view.
    control(item, estimate) {
      this.currentEstimate = estimate || this.currentEstimate;
      const p = this.byItemId[item.id];
      const btn = (label, colour, onclick) =>
        `<button onclick="${onclick}" style="background:transparent;border:1px solid ${colour};color:${colour};` +
        `font-family:'Jost',sans-serif;font-size:.55rem;letter-spacing:.1em;text-transform:uppercase;` +
        `padding:.2rem .5rem;cursor:pointer;border-radius:2px;">${label}</button>`;

      if (!p) {
        return btn('+ Passport', 'rgba(255,255,255,.55)',
          `PassportAdmin.openCreate('${item.id}')`);
      }

      const serial = `<span style="font-family:'JetBrains Mono',monospace;font-size:.6rem;color:rgba(120,200,150,.95);">${this.esc(p.serial_number)}</span>`;
      const view = btn('View', 'rgba(255,255,255,.35)', `window.open('/p/${p.token}','_blank')`);
      const plate = p.plate_code
        ? `<span title="Plate ${this.esc(p.plate_code)}" style="font-family:'Jost',sans-serif;font-size:.55rem;letter-spacing:.1em;text-transform:uppercase;color:rgba(120,200,150,.95);">QR ✓</span>`
        : btn('Link QR', 'rgba(255,200,100,.6)', `PassportAdmin.openScan('${p.id}')`);

      return `${serial}${view}${plate}`;
    },

    // ---------- create ----------

    openCreate(itemId) {
      const est = this.currentEstimate;
      const item = est && (est.estimate_items || []).find(i => i.id === itemId);
      if (!item) return alert('Window not found — please reopen the estimate.');
      if (this.byItemId[itemId]) return alert('This window already has a passport.');

      const today = new Date().toISOString().slice(0, 10);
      this.modal('Create passport — ' + (item.window_number || ''), `
        <div style="margin-bottom:12px;">
          <div class="pa-lbl">Serial number</div>
          <div class="pa-ro" id="pa-serial">${this.esc(this.buildSerial(est, item))}</div>
        </div>
        <div style="margin-bottom:12px;">
          <div class="pa-lbl">Location on site</div>
          <input id="pa-loc" class="pa-in" placeholder="e.g. first floor, rear bedroom">
        </div>
        <div style="display:flex;gap:10px;margin-bottom:12px;">
          <div style="flex:1;">
            <div class="pa-lbl">Manufactured</div>
            <input id="pa-date" type="date" class="pa-in" value="${today}">
          </div>
          <div style="flex:1;">
            <div class="pa-lbl">Warranty no. (optional)</div>
            <input id="pa-war" class="pa-in" placeholder="PSW-2026-00123">
          </div>
        </div>
        <div class="pa-note">Specification, photos and 3D are copied from the estimate and frozen — later edits to the estimate will not change this passport.</div>
        <div id="pa-err" class="pa-err"></div>
        <div style="display:flex;gap:8px;margin-top:14px;">
          <button class="pa-btn pa-btn--solid" style="flex:1;" onclick="PassportAdmin.create('${itemId}')">Create passport</button>
          <button class="pa-btn" onclick="PassportAdmin.close()">Cancel</button>
        </div>`);

      this.prefillWarranty(est);
      setTimeout(() => { const el = document.getElementById('pa-loc'); if (el) el.focus(); }, 60);
    },

    // Existing warranty numbers live in warranty_certificates and are matched
    // to the estimate through order_reference. Prefilled only as a convenience.
    async prefillWarranty(est) {
      const ref = est && est.estimate_number;
      if (!ref || !window.supabaseClient) return;
      try {
        const { data } = await window.supabaseClient
          .from('warranty_certificates')
          .select('warranty_no, warranty_expiry')
          .eq('order_reference', ref)
          .order('created_at', { ascending: false })
          .limit(1);
        if (data && data[0]) {
          const el = document.getElementById('pa-war');
          if (el && !el.value) {
            el.value = data[0].warranty_no || '';
            el.dataset.expiry = data[0].warranty_expiry || '';
          }
        }
      } catch (err) {
        console.warn('Warranty prefill skipped:', err);
      }
    },

    buildSerial(est, item) {
      const raw = String((est && est.estimate_number) || '').trim();
      const num = raw.replace(/^[A-Za-z]+[-_ ]*/, '') || String((est && est.id) || '').slice(0, 8);
      const win = String(item.window_number || '').trim().replace(/\s+/g, '-');
      return ('PSW-' + num + '-' + win).replace(/-+$/, '');
    },

    // Collect the exact label/value pairs the admin sees, by intercepting the
    // shared row helper for one render pass. Restored in `finally`.
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
        const single = Object.assign({}, est, { estimate_items: [item] });
        EstimateRenderer.renderEstimateHTML(single, { isAdmin: false, isEditable: false });
      } catch (err) {
        console.warn('Spec rows could not be collected:', err);
      } finally {
        EstimateRenderer.specRow = original;
      }
      return rows;
    },

    async create(itemId) {
      const est = this.currentEstimate;
      const item = est && (est.estimate_items || []).find(i => i.id === itemId);
      if (!item) return this.err('Window not found — please reopen the estimate.');

      const btn = document.querySelector('.pa-btn--solid');
      if (btn) { btn.disabled = true; btn.textContent = 'Creating…'; }

      try {
        const spec = this.itemSpec(item);
        const warNo = (document.getElementById('pa-war').value || '').trim();
        const warEl = document.getElementById('pa-war');
        const mfg = document.getElementById('pa-date').value || new Date().toISOString().slice(0, 10);

        let expiry = (warEl && warEl.dataset.expiry) || '';
        if (warNo && !expiry) {
          const d = new Date(mfg + 'T00:00:00');
          d.setFullYear(d.getFullYear() + 10);
          expiry = d.toISOString().slice(0, 10);
        }

        const user = (typeof getCurrentUser === 'function') ? await getCurrentUser() : null;

        const payload = {
          serial_number: document.getElementById('pa-serial').textContent.trim(),
          estimate_id: est.id,
          estimate_item_id: item.id,
          window_number: item.window_number || null,
          window_type: this.windowTypeLabel(item),
          project_label: (document.getElementById('pa-loc').value || '').trim() || null,
          manufactured_date: mfg,
          warranty_no: warNo || null,
          warranty_expiry: warNo ? (expiry || null) : null,
          specification: {
            rows: this.collectSpecRows(est, item),
            screenshots: spec.screenshots || null,
            viewer3d: spec.viewer3d || null
          },
          created_by: user ? user.id : null
        };

        const { data, error } = await window.supabaseClient
          .from('window_passports')
          .insert([payload])
          .select()
          .single();
        if (error) throw error;

        this.byItemId[item.id] = data;
        this.close();
        this.openScan(data.id, true);
      } catch (err) {
        console.error('Passport create failed:', err);
        const dup = String(err && err.message || '').includes('duplicate');
        this.err(dup ? 'A passport with this serial number already exists.' : 'Could not create the passport. Please try again.');
        if (btn) { btn.disabled = false; btn.textContent = 'Create passport'; }
      }
    },

    itemSpec(item) {
      let s = item.specification;
      if (typeof s === 'string') { try { s = JSON.parse(s); } catch (e) { s = null; } }
      return (s && typeof s === 'object') ? s : {};
    },

    windowTypeLabel(item) {
      const t = String(item.window_type || '').trim();
      if (!t) return null;
      return t.charAt(0).toUpperCase() + t.slice(1);
    },

    // ---------- link a pre-engraved plate ----------

    openScan(passportId, justCreated) {
      const p = Object.values(this.byItemId).find(x => x.id === passportId);
      const known = p ? p.serial_number : '';
      this.modal('Link QR plate' + (known ? ' — ' + known : ''), `
        ${justCreated ? '<div class="pa-ok">Passport created. Now scan the metal plate that goes on this window.</div>' : ''}
        <div id="pa-cam-wrap" style="background:#000;border-radius:4px;overflow:hidden;position:relative;display:none;">
          <video id="pa-video" playsinline muted style="width:100%;display:block;max-height:280px;object-fit:cover;"></video>
        </div>
        <div id="pa-cam-msg" class="pa-note">Starting camera…</div>
        <div style="margin-top:12px;">
          <div class="pa-lbl">Or type the code from the plate</div>
          <input id="pa-code" class="pa-in" placeholder="e.g. 123455666.44555" autocomplete="off">
        </div>
        <div id="pa-err" class="pa-err"></div>
        <div style="display:flex;gap:8px;margin-top:14px;">
          <button class="pa-btn pa-btn--solid" style="flex:1;" onclick="PassportAdmin.saveCode('${passportId}')">Link plate</button>
          <button class="pa-btn" onclick="PassportAdmin.close()">${justCreated ? 'Later' : 'Cancel'}</button>
        </div>`);
      this.startCamera(passportId);
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
      s = decodeURIComponent(s).trim();
      return /^[A-Za-z0-9._-]{1,64}$/.test(s) ? s : '';
    },

    async startCamera(passportId) {
      const msg = document.getElementById('pa-cam-msg');
      const wrap = document.getElementById('pa-cam-wrap');
      const video = document.getElementById('pa-video');
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
              const input = document.getElementById('pa-code');
              if (code && input) {
                input.value = code;
                if (msg) msg.textContent = 'Plate read: ' + code;
                this.stopCamera();
                this.saveCode(passportId);
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

    async saveCode(passportId) {
      const input = document.getElementById('pa-code');
      const code = this.normaliseCode(input && input.value);
      if (!code) return this.err('Enter the code from the plate (letters, digits, dots and dashes).');

      const btn = document.querySelector('.pa-btn--solid');
      if (btn) { btn.disabled = true; btn.textContent = 'Linking…'; }

      try {
        const { data, error } = await window.supabaseClient
          .from('window_passports')
          .update({ plate_code: code, plate_linked_at: new Date().toISOString() })
          .eq('id', passportId)
          .select()
          .single();
        if (error) throw error;

        Object.keys(this.byItemId).forEach(k => {
          if (this.byItemId[k].id === passportId) this.byItemId[k] = data;
        });
        this.stopCamera();
        this.close();
        this.refresh();
        alert('Plate linked. Scanning it now opens this window\'s passport.');
      } catch (err) {
        console.error('Plate link failed:', err);
        const dup = String(err && err.message || '').toLowerCase().includes('duplicate');
        this.err(dup ? 'This plate is already linked to another window.' : 'Could not link the plate. Please try again.');
        if (btn) { btn.disabled = false; btn.textContent = 'Link plate'; }
      }
    },

    // ---------- plumbing ----------

    refresh() {
      if (typeof window.viewEstimate === 'function' && this.currentEstimate) {
        window.viewEstimate(this.currentEstimate.id);
      }
    },

    esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[m]));
    },

    err(msg) {
      const el = document.getElementById('pa-err');
      if (el) { el.textContent = msg; el.style.display = 'block'; }
    },

    modal(title, inner) {
      this.close();
      if (!document.getElementById('pa-style')) {
        const st = document.createElement('style');
        st.id = 'pa-style';
        st.textContent =
          '#pa-overlay{position:fixed;inset:0;background:rgba(10,22,40,.82);z-index:99995;display:flex;align-items:center;justify-content:center;padding:20px;}' +
          '#pa-panel{background:#FAFAF8;border-radius:6px;width:min(430px,96vw);max-height:92vh;overflow:auto;}' +
          '#pa-head{padding:13px 18px;border-bottom:1px solid #E5E2DA;font-family:"Cormorant Garamond",serif;font-size:1.1rem;color:#0A1628;}' +
          '#pa-body{padding:16px 18px;font-family:"Jost",sans-serif;font-size:.8rem;color:#0A1628;}' +
          '.pa-lbl{font-size:.55rem;letter-spacing:.16em;text-transform:uppercase;color:#9E9E90;margin-bottom:4px;}' +
          '.pa-in{width:100%;border:1px solid #C9C6BC;border-radius:3px;padding:9px 11px;font-family:"Jost",sans-serif;font-size:.82rem;color:#0A1628;background:#fff;}' +
          '.pa-in:focus{outline:none;border-color:#0A1628;}' +
          '.pa-ro{font-family:"JetBrains Mono",monospace;font-size:.8rem;background:#F3F0EA;padding:9px 11px;border-radius:3px;}' +
          '.pa-note{background:#F3F0EA;border-radius:3px;padding:9px 11px;color:#5F5E5A;font-size:.72rem;line-height:1.5;margin-top:10px;}' +
          '.pa-ok{background:#E6F1EB;color:#1D6E4E;border-radius:3px;padding:9px 11px;font-size:.72rem;margin-bottom:12px;}' +
          '.pa-err{display:none;background:#F9E9E9;color:#A32D2D;border-radius:3px;padding:9px 11px;font-size:.72rem;margin-top:10px;}' +
          '.pa-btn{border:1px solid #0A1628;background:transparent;color:#0A1628;border-radius:3px;padding:10px 16px;cursor:pointer;' +
          'font-family:"Jost",sans-serif;font-size:.6rem;letter-spacing:.18em;text-transform:uppercase;}' +
          '.pa-btn--solid{background:#0A1628;color:#FAFAF8;}' +
          '.pa-btn:disabled{opacity:.6;cursor:default;}';
        document.head.appendChild(st);
      }
      const ov = document.createElement('div');
      ov.id = 'pa-overlay';
      ov.innerHTML = `<div id="pa-panel"><div id="pa-head">${this.esc(title)}</div><div id="pa-body">${inner}</div></div>`;
      ov.addEventListener('click', e => { if (e.target === ov) this.close(); });
      document.body.appendChild(ov);
    },

    close() {
      this.stopCamera();
      const ov = document.getElementById('pa-overlay');
      if (ov) ov.remove();
    }
  };

  window.PassportAdmin = PassportAdmin;
})();
