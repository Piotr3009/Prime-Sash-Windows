/**
 * share-design.js — "Share 3D link" in the Finalise step (owner, 08.10.2026)
 *
 * Saves the window's 3D engine config (window.get3DConfig() — the same object the
 * estimate stores for "View in 3D") through the Supabase RPC create_shared_design and
 * shows a short link /d/<code> to a page with this window in 3D (api/design-view.js).
 *
 * For every visitor (advertising). No prices, no personal data are sent.
 * The database decides the rest (db/shared-designs.sql): visitors' links expire after
 * 30 days, the owner's (logged in as admin) never; only the owner's link keeps the
 * window name as its title; validation and anti-spam limits live there too.
 *
 * REMOVAL: delete the <script>/<link> lines, the #share3d-block and #share3d-overlay markup.
 */
(function () {
  'use strict';

  var busy = false;
  var lastUrl = '';

  function $(id) { return document.getElementById(id); }

  function fmtDate(iso) {
    try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); }
    catch (e) { return ''; }
  }

  function setBusy(on) {
    var b = $('share3d-btn'); if (!b) return;
    b.disabled = on;
    b.setAttribute('aria-busy', on ? 'true' : 'false');
    var t = b.querySelector('.share3d-btn-text');
    if (t) t.textContent = on ? 'Creating link\u2026' : 'Share 3D link';
  }

  function showError(msg) {
    var e = $('share3d-error'); if (!e) return;
    e.textContent = msg || '';
    e.hidden = !msg;
  }

  function errorText(err) {
    var m = String((err && (err.message || err.details || err.hint)) || '');
    if (/too many links/i.test(m)) return 'Too many links from this connection \u2014 please try again later.';
    if (/busy/i.test(m)) return 'Lots of links are being made right now \u2014 please try again in a minute.';
    if (/too large|invalid design/i.test(m)) return 'This window could not be shared. Please check its dimensions and try again.';
    return 'Sorry \u2014 the link could not be created. Please check your connection and try again.';
  }

  function createLink() {
    if (busy) return;
    showError('');
    var cfg = (typeof window.get3DConfig === 'function') ? window.get3DConfig() : null;
    if (!cfg) { showError('The 3D view is still loading \u2014 please try again in a moment.'); return; }
    var client = window.supabaseClient;
    if (!client || typeof client.rpc !== 'function') { showError(errorText(null)); return; }

    var nameEl = $('window-custom-name');
    var title = nameEl ? String(nameEl.value || '').trim() : '';
    busy = true; setBusy(true);
    Promise.resolve(client.rpc('create_shared_design', { p_config: cfg, p_title: title || null }))
      .then(function (res) {
        if (!res || res.error) throw (res && res.error) || new Error('no response');
        var data = res.data || {};
        if (!data.code || !/^[A-Za-z0-9]{6,16}$/.test(data.code)) throw new Error('no code');
        openModal(window.location.origin + '/d/' + data.code, data.expires_at || null);
      })
      .catch(function (err) {
        if (window.console) console.warn('Share 3D link:', err);
        showError(errorText(err));
      })
      .then(function () { busy = false; setBusy(false); });
  }

  function onKey(e) { if (e.key === 'Escape') closeModal(); }

  function openModal(url, expiresAt) {
    var ov = $('share3d-overlay'); if (!ov) return;
    lastUrl = url;
    $('share3d-url').value = url;
    var msg = 'My window design in 3D \u2014 Prime Sash Windows: ' + url;
    $('share3d-whatsapp').href = 'https://wa.me/?text=' + encodeURIComponent(msg);
    $('share3d-email').href = 'mailto:?subject=' + encodeURIComponent('A window design in 3D')
      + '&body=' + encodeURIComponent('Have a look at this window in 3D:\n' + url + '\n\nPrime Sash Windows');
    $('share3d-open').href = url;
    $('share3d-expiry').textContent = expiresAt
      ? 'The link works for 30 days, until ' + fmtDate(expiresAt) + '.'
      : 'This link does not expire.';
    $('share3d-copy').textContent = 'Copy link';
    ov.hidden = false;
    document.addEventListener('keydown', onKey);
    setTimeout(function () { var i = $('share3d-url'); if (i) { i.focus(); i.select(); } }, 30);
  }

  function closeModal() {
    var ov = $('share3d-overlay'); if (ov) ov.hidden = true;
    document.removeEventListener('keydown', onKey);
    var b = $('share3d-btn'); if (b) b.focus();
  }

  function copyLink() {
    var btn = $('share3d-copy');
    function done() {
      btn.textContent = 'Copied \u2713';
      setTimeout(function () { btn.textContent = 'Copy link'; }, 2000);
    }
    function fallback() {
      var i = $('share3d-url'); if (!i) return;
      i.focus(); i.select();
      try { if (document.execCommand('copy')) done(); } catch (e) { /* the text stays selected for a manual copy */ }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(lastUrl).then(done, fallback);
    else fallback();
  }

  function init() {
    var b = $('share3d-btn'); if (!b) return;
    b.addEventListener('click', createLink);
    var ov = $('share3d-overlay');
    if (ov) ov.addEventListener('click', function (e) { if (e.target === ov) closeModal(); });
    var c = $('share3d-close'); if (c) c.addEventListener('click', closeModal);
    var cp = $('share3d-copy'); if (cp) cp.addEventListener('click', copyLink);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
