/**
 * guide-tips.js — Guided next-step for the online estimate (owner, 19.09.2026)
 *
 * WHAT: step numbers on the left-hand category menu (1..N, done = tick, current = ring) plus one
 *       tip per step, shown in order the first time the customer opens that step (Dimensions,
 *       Glass & colour, Ironmongery, Add to estimate) and an extra un-numbered tip for arched sash.
 *       Every tip shows once per browser; "Don't show tips" switches them all off; a small
 *       "Tips: off · Show tips" line in the sidebar turns them back on.
 *       (v1 had a progress strip above the options panel — dropped 19.09.2026, numbers in the menu
 *       read better and take no space.)
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
  // One tip per step, in menu order. `step` = the category it belongs to; numbered tips are
  // shown as "Tip n of N" where N counts only the numbered ones. `when` = the step is open.
  var TIPS = [
    {
      id: 'dimensions', step: ['dim-design', 'door-dimensions'], numbered: true,
      anchor: function () { return visible('.config-section[data-category="dim-design"], .config-section[data-category="door-dimensions"]'); },
      when: function () { return isActive('dim-design') || isActive('door-dimensions'); },
      title: 'Size and design',
      body: 'Pick your size from the list, or choose <strong>Custom</strong> to type exact millimetres. Georgian bars are set here too — the 3D preview updates as you go.'
    },
    {
      id: 'glass-colour', step: ['glass', 'colour', 'door-glass', 'door-colour'], numbered: true,
      anchor: function () { return visible('.config-section[data-category="glass"], .config-section[data-category="colour"], .config-section[data-category="door-glass"], .config-section[data-category="door-colour"]'); },
      when: function () { return isActive('glass') || isActive('colour') || isActive('door-glass') || isActive('door-colour'); },
      title: 'Glass and colour',
      body: 'Standard double glazing suits most homes; slim heritage units are for conservation areas. Any RAL or Farrow &amp; Ball colour can be chosen in the Colour step.'
    },
    {
      id: 'hardware', step: ['hardware', 'door-hardware'], numbered: true,
      anchor: function () { return visible('.config-section[data-category="hardware"], .config-section[data-category="door-hardware"]'); },
      when: function () { return isActive('hardware') || isActive('door-hardware'); },
      title: 'Set the finish for each item',
      body: 'Pick a finish for the fastener, lifts and stops — the 3D preview updates as you go. When all items are set, move on to <strong>Add to estimate</strong>.'
    },
    {
      id: 'finalise', step: ['finalise', 'door-finalise'], numbered: true,
      anchor: function () { return visible('#estimate-selector') || visible('#add-to-estimate'); },
      when: function () { return isActive('finalise') || isActive('door-finalise'); },
      title: 'Save this window to an estimate',
      body: 'First choose where it goes: pick one of your estimates from the list, or leave <strong>+ Create New Estimate</strong> and press the button below. You\u2019ll need a free account to save it. Nothing is ordered \u2014 a surveyor confirms measurements before any price is final.'
    },
    {
      id: 'arched', numbered: false,
      anchor: function () { return visible('#arched-types'); },
      when: function () { var r = document.querySelector('input[name="sash-type"][value="arched-group"]'); return !!(r && r.checked); },
      title: 'Arched sash — set the head here',
      body: 'Choose the arch shape and the glazing-bar pattern for the curved head. The Georgian-bar controls further down are switched off for arched windows.'
    }
  ];

  var VERSION = 4;
  var STORE_OFF = 'psw_tips_off', STORE_SEEN = 'psw_tips_seen_v' + VERSION;   // versioned: new tip set = fresh start
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
  // Categories the customer has actually opened in THIS session (not restored state)
  function visitedList() { try { return JSON.parse(sessionStorage.getItem('psw_tips_visited') || '[]'); } catch (e) { return []; } }
  function visited(cat) { return visitedList().indexOf(cat) !== -1; }
  function markVisited(cat) { var v = visitedList(); if (cat && v.indexOf(cat) === -1) { v.push(cat); try { sessionStorage.setItem('psw_tips_visited', JSON.stringify(v)); } catch (e) {} } }
  var interacted = false;   // no tip before the customer's first click/change
  function seen() { try { return JSON.parse(lsGet(STORE_SEEN) || '{}'); } catch (e) { return {}; } }
  function markSeen(id) { var s = seen(); s[id] = 1; lsSet(STORE_SEEN, JSON.stringify(s)); }

  // ─── Styles (self-contained, prefixed) ──────────────────────────────────
  function injectStyles() {
    if ($('#psw-guide-css')) return;
    var st = document.createElement('style');
    st.id = 'psw-guide-css';
    st.textContent =
      '.cat-btn .psw-num{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;margin-right:9px;border-radius:50%;border:1px solid rgba(255,255,255,.35);font-size:9px;letter-spacing:0;color:rgba(255,255,255,.55);vertical-align:1px;flex-shrink:0;}' +
      '.cat-btn.psw-done .psw-num{border-color:transparent;background:rgba(255,255,255,.14);color:#fff;}' +
      '.cat-btn.active .psw-num{border-color:#fff;color:#fff;background:transparent;}' +
      '.cat-btn .psw-num svg{display:block;}' +
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
      '.psw-guide-toggle{padding:10px 20px 12px;border-top:1px solid rgba(255,255,255,.12);display:flex;align-items:center;justify-content:space-between;font-family:Jost,sans-serif;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.55);}' +
      '.psw-guide-toggle a{color:#fff;text-decoration:underline;letter-spacing:.12em;}' +
      '.psw-tip .psw-t-n{margin-left:auto;font-size:10px;letter-spacing:.1em;color:#9a9791;}';
    document.head.appendChild(st);
  }

  // ─── Step numbers in the left menu ──────────────────────────────────────
  function stepList() {
    return $$('.cat-btn').filter(function (b) { return b.offsetParent !== null && b.dataset.target; });
  }
  var TICK = '<svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#fff" stroke-width="2"><path d="M2 6.5 L5 9 L10 3"></path></svg>';
  function updateMenuNumbers() {
    var steps = stepList();
    var idx = steps.findIndex(function (b) { return b.classList.contains('active'); }); if (idx < 0) idx = 0;
    steps.forEach(function (b, i) {
      var n = b.querySelector('.psw-num');
      if (!n) { n = document.createElement('span'); n.className = 'psw-num'; n.setAttribute('aria-hidden', 'true'); b.insertBefore(n, b.firstChild); }
      var done = i < idx;
      b.classList.toggle('psw-done', done);
      n.innerHTML = done ? TICK : String(i + 1);
    });
  }
  function updateStrip() { updateMenuNumbers(); }

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
      '<div class="psw-t-f"><button type="button" class="psw-t-ok">Got it</button><button type="button" class="psw-t-off">Don\u2019t show tips</button>' + (n ? '<span class="psw-t-n">Tip ' + n + ' of ' + TIPS.filter(function (t) { return t.numbered; }).length + '</span>' : '') + '</div>';
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
    if (tipsOff() || !interacted) { closeTip(); return; }
    var s = seen();
    for (var i = 0; i < TIPS.length; i++) {
      var t = TIPS[i];
      if (s[t.id]) continue;
      var due = false; try { due = !!t.when(); } catch (e) {}
      if (due) {
        if (!openTip || openTip.dataset.id !== t.id) {
          var num = t.numbered ? TIPS.slice(0, i + 1).filter(function (x) { return x.numbered; }).length : 0;
          showTip(t, num); if (openTip) openTip.dataset.id = t.id;
        }
        return;
      }
    }
    // nothing due → close a tip whose trigger went away (e.g. user left the category)
    if (openTip) { var cur = TIPS.filter(function (t) { return t.id === openTip.dataset.id; })[0]; var still = false; try { still = cur && cur.when(); } catch (e) {} if (!still) closeTip(); }
  }

  // ─── Sidebar toggle (Tips: off · Show tips) ─────────────────────────────
  var toggle;
  function mountToggle() {
    var side = $('.config-sidebar'); if (!side || toggle) return;
    toggle = document.createElement('div'); toggle.className = 'psw-guide-toggle'; toggle.title = 'guide-tips v' + VERSION;
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
    try { console.info('[guide-tips] v' + VERSION + ' loaded'); } catch (e) {}
    injectStyles(); updateMenuNumbers(); mountToggle();
    document.addEventListener('click', function (e) {
      interacted = true;
      var btn = e.target && e.target.closest ? e.target.closest('.cat-btn') : null;
      if (btn) markVisited(btn.dataset.target);
      schedule();
    }, true);
    document.addEventListener('change', function () { interacted = true; schedule(); }, true);
    window.addEventListener('resize', schedule);
    // category switches toggle .active on .cat-btn — watch that
    var side = $('.config-sidebar');
    if (side && window.MutationObserver) new MutationObserver(schedule).observe(side, { attributes: true, subtree: true, attributeFilter: ['class', 'style'] });
    setTimeout(schedule, 800);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
