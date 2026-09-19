/**
 * guide-tips.js — Guided next-step for the online estimate (owner, 19.09.2026)
 *
 * WHAT: a slim progress strip above the options panel ("Step 5 of 7 · Ironmongery · Next: Add to
 *       estimate") plus four one-off tips where people get stuck (ironmongery, custom bars,
 *       arched sash, add-to-estimate). Every tip shows once per browser; "Don't show tips"
 *       switches them all off; a small "Tips: off · Show tips" line in the sidebar turns them back on.
 *
 * REMOVAL: delete the single <script src="js/guide-tips.js"> line in online-estimate.html.
 *          Nothing else references this file. It reads the DOM only — it never writes to
 *          currentConfig, never touches pricing, 3D or any existing handler.
 *
 * KILL SWITCH without redeploy: set window.PSW_GUIDE_OFF = true before this script, or
 *          localStorage.setItem('psw_tips_off','1') in the console.
 */
(function () {
  'use strict';
  if (window.PSW_GUIDE_OFF) return;

  // ─── Config (the only part you should need to edit) ──────────────────────
  var STEP_LABELS = {
    'product-range': 'Window type', 'dim-design': 'Dimensions & design', 'glass': 'Glass',
    'opening': 'Opening', 'colour': 'Colour', 'hardware': 'Ironmongery', 'finalise': 'Add to estimate',
    'door-dimensions': 'Dimensions', 'door-glass': 'Glass', 'door-colour': 'Colour',
    'door-hardware': 'Hardware', 'door-finalise': 'Add to estimate'
  };

  // Tips: id, where to anchor, when to show, copy. `when` returns true when the tip is due.
  var TIPS = [
    {
      id: 'hardware',
      anchor: function () { return visible('.config-section[data-category="hardware"], .config-section[data-category="door-hardware"]'); },
      when: function () { return isActive('hardware') || isActive('door-hardware'); },
      title: 'Set the finish for each item',
      body: 'Pick a finish for the fastener, lifts and stops — the 3D preview updates as you go. When all items are set, move on to <strong>Add to estimate</strong>.'
    },
    {
      id: 'custom-bars',
      anchor: function () { return visible('#upper-bars, #lower-bars'); },
      when: function () {
        var u = document.getElementById('upper-bars'), l = document.getElementById('lower-bars');
        return (u && u.value === 'custom' && u.offsetParent) || (l && l.value === 'custom' && l.offsetParent);
      },
      title: 'Custom glazing bars',
      body: 'Type how many horizontal and vertical bars you want on each sash. Bars are priced per bar and drawn live in the 3D preview.'
    },
    {
      id: 'arched',
      anchor: function () { return visible('#arched-types'); },
      when: function () { var r = document.querySelector('input[name="sash-type"][value="arched-group"]'); return !!(r && r.checked); },
      title: 'Arched sash — set the head here',
      body: 'Choose the arch shape and the glazing-bar pattern for the curved head. The Georgian-bar controls further down are switched off for arched windows.'
    },
    {
      id: 'finalise',
      anchor: function () { return visible('#add-to-estimate'); },
      when: function () { return isActive('finalise') || isActive('door-finalise'); },
      title: 'Almost done',
      body: 'Adding the window saves this design and sends the estimate to your email. Nothing is ordered — a surveyor confirms measurements before any price is final.'
    }
  ];

  var STORE_OFF = 'psw_tips_off', STORE_SEEN = 'psw_tips_seen';
  var ACCENT = '#0A1628';          // navy, on brand — no gold

  // ─── Helpers ────────────────────────────────────────────────────────────
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function visible(sel) { return $$(sel).filter(function (e) { return e.offsetParent !== null; })[0] || null; }
  function isActive(cat) { var b = $('.cat-btn.active'); return !!(b && b.dataset.target === cat); }
  function isPhone() { return !!window.__PSW_isPhone || window.innerWidth < 720; }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function tipsOff() { return lsGet(STORE_OFF) === '1'; }
  function seen() { try { return JSON.parse(lsGet(STORE_SEEN) || '{}'); } catch (e) { return {}; } }
  function markSeen(id) { var s = seen(); s[id] = 1; lsSet(STORE_SEEN, JSON.stringify(s)); }

  // ─── Styles (self-contained, prefixed) ──────────────────────────────────
  function injectStyles() {
    if ($('#psw-guide-css')) return;
    var st = document.createElement('style');
    st.id = 'psw-guide-css';
    st.textContent =
      '.psw-guide-strip{display:flex;align-items:center;gap:12px;padding:6px 14px;margin:0 0 10px;border:1px solid #e6e3dc;border-radius:3px;background:#fff;font-family:Jost,sans-serif;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#6b6b6b;}' +
      '.psw-guide-strip .psw-g-step{white-space:nowrap;}' +
      '.psw-guide-strip .psw-g-bars{display:flex;gap:3px;flex:1;min-width:60px;}' +
      '.psw-guide-strip .psw-g-bars i{display:block;height:3px;flex:1;background:#d9d6ce;border-radius:2px;}' +
      '.psw-guide-strip .psw-g-bars i.done{background:' + ACCENT + ';}' +
      '.psw-guide-strip .psw-g-bars i.cur{background:' + ACCENT + ';opacity:.55;}' +
      '.psw-guide-strip .psw-g-name{color:' + ACCENT + ';font-weight:500;white-space:nowrap;}' +
      '.psw-guide-strip .psw-g-next{margin-left:auto;background:none;border:1px solid ' + ACCENT + ';color:' + ACCENT + ';border-radius:2px;padding:4px 9px;font:inherit;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;white-space:nowrap;}' +
      '.psw-guide-strip .psw-g-next:hover{background:' + ACCENT + ';color:#fff;}' +
      '.psw-guide-strip .psw-g-next[disabled]{opacity:.35;cursor:default;}' +
      '.psw-tip{position:absolute;z-index:60;max-width:340px;background:#fff;border:1px solid ' + ACCENT + ';border-radius:4px;padding:14px 16px 12px;box-shadow:0 12px 28px rgba(10,22,40,.14);font-family:Jost,sans-serif;color:#0A1628;}' +
      '.psw-tip:before{content:"";position:absolute;top:-8px;left:28px;width:14px;height:14px;background:#fff;border-left:1px solid ' + ACCENT + ';border-top:1px solid ' + ACCENT + ';transform:rotate(45deg);}' +
      '.psw-tip.psw-tip-sheet{position:fixed;left:0;right:0;bottom:0;max-width:none;border-radius:0;border-width:1px 0 0;box-shadow:0 -12px 28px rgba(10,22,40,.14);padding:12px 18px 18px;}' +
      '.psw-tip.psw-tip-sheet:before{display:none;}' +
      '.psw-tip .psw-t-grip{width:36px;height:4px;background:#d9d6ce;border-radius:2px;margin:0 auto 10px;}' +
      '.psw-tip .psw-t-h{display:flex;align-items:center;gap:8px;font-family:"Cormorant Garamond",serif;font-size:18px;font-weight:600;margin-bottom:6px;}' +
      '.psw-tip .psw-t-b{font-size:12.5px;line-height:1.55;color:#444;}' +
      '.psw-tip .psw-t-f{display:flex;align-items:center;gap:10px;margin-top:10px;}' +
      '.psw-tip .psw-t-ok{font-family:Jost,sans-serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;background:' + ACCENT + ';color:#fff;border:1px solid ' + ACCENT + ';border-radius:3px;padding:9px 16px;cursor:pointer;min-height:36px;}' +
      '.psw-tip .psw-t-off{font-family:Jost,sans-serif;font-size:11px;letter-spacing:.08em;background:none;border:0;color:#6b6b6b;text-decoration:underline;cursor:pointer;padding:9px 4px;}' +
      '.psw-tip .psw-t-n{margin-left:auto;font-size:10px;letter-spacing:.1em;color:#9a9791;}' +
      '.psw-guide-toggle{padding:10px 20px 12px;border-top:1px solid rgba(255,255,255,.12);display:flex;align-items:center;justify-content:space-between;font-family:Jost,sans-serif;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.55);}' +
      '.psw-guide-toggle a{color:#fff;text-decoration:underline;letter-spacing:.12em;}' +
      '@media (max-width:719px){.psw-guide-strip{margin:0 0 8px;padding:5px 10px;font-size:9px;}.psw-guide-strip .psw-g-next{display:none;}}';
    document.head.appendChild(st);
  }

  // ─── Progress strip ─────────────────────────────────────────────────────
  var strip, stripEls = {};
  function stepList() {
    // visible category buttons, in sidebar order — product-range first if present
    return $$('.cat-btn').filter(function (b) { return b.offsetParent !== null && b.dataset.target; });
  }
  function mountStrip() {
    var host = $('.configurator-options');
    if (!host || strip) return;
    strip = document.createElement('div');
    strip.className = 'psw-guide-strip';
    strip.setAttribute('aria-live', 'polite');
    strip.innerHTML = '<span class="psw-g-step"></span><span class="psw-g-bars"></span><span class="psw-g-name"></span><button type="button" class="psw-g-next"></button>';
    host.insertBefore(strip, host.firstChild);
    stripEls.step = $('.psw-g-step', strip); stripEls.bars = $('.psw-g-bars', strip);
    stripEls.name = $('.psw-g-name', strip); stripEls.next = $('.psw-g-next', strip);
    stripEls.next.addEventListener('click', function () {
      var t = stripEls.next.dataset.target; var b = t && $('.cat-btn[data-target="' + t + '"]');
      if (b) b.click();
    });
    updateStrip();
  }
  function updateStrip() {
    if (!strip) return;
    var steps = stepList(); if (!steps.length) { strip.style.display = 'none'; return; }
    strip.style.display = '';
    var idx = steps.findIndex(function (b) { return b.classList.contains('active'); }); if (idx < 0) idx = 0;
    var cur = steps[idx].dataset.target;
    stripEls.step.textContent = 'Step ' + (idx + 1) + ' of ' + steps.length;
    stripEls.bars.innerHTML = steps.map(function (b, i) { return '<i class="' + (i < idx ? 'done' : i === idx ? 'cur' : '') + '"></i>'; }).join('');
    stripEls.name.textContent = STEP_LABELS[cur] || cur;
    var nxt = steps[idx + 1];
    if (nxt) { stripEls.next.textContent = 'Next: ' + (STEP_LABELS[nxt.dataset.target] || nxt.dataset.target) + ' \u2192'; stripEls.next.dataset.target = nxt.dataset.target; stripEls.next.disabled = false; }
    else { stripEls.next.textContent = 'Last step'; stripEls.next.dataset.target = ''; stripEls.next.disabled = true; }
  }

  // ─── Tips ───────────────────────────────────────────────────────────────
  var openTip = null;
  function closeTip() { if (openTip) { openTip.remove(); openTip = null; } }
  function showTip(tip, n) {
    closeTip();
    var el = document.createElement('div');
    el.className = 'psw-tip' + (isPhone() ? ' psw-tip-sheet' : '');
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', tip.title);
    el.innerHTML = (isPhone() ? '<div class="psw-t-grip"></div>' : '') +
      '<div class="psw-t-h"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="' + ACCENT + '" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"></circle><path d="M8 7 V11.5 M8 4.5 V5"></path></svg><span></span></div>' +
      '<div class="psw-t-b"></div>' +
      '<div class="psw-t-f"><button type="button" class="psw-t-ok">Got it</button><button type="button" class="psw-t-off">Don\u2019t show tips</button><span class="psw-t-n">Tip ' + n + ' of ' + TIPS.length + '</span></div>';
    $('.psw-t-h span', el).textContent = tip.title;
    $('.psw-t-b', el).innerHTML = tip.body;
    $('.psw-t-ok', el).addEventListener('click', function () { markSeen(tip.id); closeTip(); });
    $('.psw-t-off', el).addEventListener('click', function () { lsSet(STORE_OFF, '1'); closeTip(); updateToggle(); });
    if (isPhone()) { document.body.appendChild(el); }
    else {
      var a = tip.anchor(); if (!a) return;
      var host = a.offsetParent || document.body;
      host.style.position = host.style.position || 'relative';
      host.appendChild(el);
      var top = a.offsetTop + Math.min(a.offsetHeight, 96) + 10;
      el.style.top = top + 'px'; el.style.left = Math.max(8, a.offsetLeft) + 'px';
    }
    openTip = el;
  }
  function checkTips() {
    if (tipsOff()) { closeTip(); return; }
    var s = seen();
    for (var i = 0; i < TIPS.length; i++) {
      var t = TIPS[i];
      if (s[t.id]) continue;
      var due = false; try { due = !!t.when(); } catch (e) {}
      if (due) { if (!openTip || openTip.dataset.id !== t.id) { showTip(t, i + 1); if (openTip) openTip.dataset.id = t.id; } return; }
    }
    // nothing due → close a tip whose trigger went away (e.g. user left the category)
    if (openTip) { var cur = TIPS.filter(function (t) { return t.id === openTip.dataset.id; })[0]; var still = false; try { still = cur && cur.when(); } catch (e) {} if (!still) closeTip(); }
  }

  // ─── Sidebar toggle (Tips: off · Show tips) ─────────────────────────────
  var toggle;
  function mountToggle() {
    var side = $('.config-sidebar'); if (!side || toggle) return;
    toggle = document.createElement('div'); toggle.className = 'psw-guide-toggle';
    side.appendChild(toggle); updateToggle();
  }
  function updateToggle() {
    if (!toggle) return;
    var off = tipsOff();
    toggle.innerHTML = '<span>Tips: ' + (off ? 'off' : 'on') + '</span><a href="#">' + (off ? 'Show tips' : 'Hide tips') + '</a>';
    $('a', toggle).addEventListener('click', function (e) {
      e.preventDefault();
      if (tipsOff()) { lsSet(STORE_OFF, '0'); lsSet(STORE_SEEN, '{}'); } else { lsSet(STORE_OFF, '1'); closeTip(); }
      updateToggle(); checkTips();
    });
  }

  // ─── Wiring: observe, never intercept ───────────────────────────────────
  var pending = null;
  function schedule() { updateStrip(); clearTimeout(pending); pending = setTimeout(function () { updateStrip(); checkTips(); }, 250); }
  function init() {
    injectStyles(); mountStrip(); mountToggle();
    document.addEventListener('click', schedule, true);
    document.addEventListener('change', schedule, true);
    window.addEventListener('resize', schedule);
    // category switches toggle .active on .cat-btn — watch that
    var side = $('.config-sidebar');
    if (side && window.MutationObserver) new MutationObserver(schedule).observe(side, { attributes: true, subtree: true, attributeFilter: ['class', 'style'] });
    setTimeout(schedule, 800);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
