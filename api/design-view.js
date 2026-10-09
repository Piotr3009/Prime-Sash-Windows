// api/design-view.js — Vercel Serverless Function (owner, 08.10.2026)
// Public 3D view of a window shared from the configurator ("Share 3D link"):
//   /d/<code>   (see vercel.json rewrite)
//
// Data access: Supabase RPC get_shared_design (SECURITY DEFINER) called with the
// ANON key — the shared_designs table stays fully locked; the code is the only door.
// Same proven pattern as api/estimate-view.js and api/passport.js.
//
// The page loads the SAME 3D engine bundle as the configurator and replays the
// saved engine config (window.get3DConfig() at the moment of sharing), exactly as
// the "View in 3D" viewer on estimates does. No prices, no personal data.
// Text on the page is generated from the config; only the owner's (admin) links
// carry a title, and every piece of text is escaped.
//
// noindex on purpose: generated near-identical pages must never be indexed.

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rfelsfwjszjdtzuovlal.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmZWxzZndqc3pqZHR6dW92bGFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0Nzc1MTgsImV4cCI6MjA5MDA1MzUxOH0.Ut9EtffoU-L1g6IKiqcaVaoA2sEDoc0so821L1Uxn_A';

// Keep in sync with the ?v= of 3d/assets/window3d.js used by online-estimate.html
const BUNDLE_URL = '/3d/assets/window3d.js?v=113';

// Links on the page point at our own site only — never at whatever Host header arrived.
const OUR_HOSTS = ['primesashwindows.co.uk', 'www.primesashwindows.co.uk', 'sashwindowsquote.co.uk', 'www.sashwindowsquote.co.uk'];

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

// JSON.stringify does NOT escape "</script>", so a value containing it would close
// the inline script block early — escaping the characters that can break out keeps
// the payload valid JS (same helper as api/passport.js).
function jsonForScript(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function siteHost(req) {
  const raw = String((req.headers && (req.headers['x-forwarded-host'] || req.headers.host)) || '').toLowerCase().split(':')[0].trim();
  const host = OUR_HOSTS.indexOf(raw) > -1 ? raw : 'www.primesashwindows.co.uk';
  return { host: host, label: host.replace(/^www\./, '') };
}

// One line describing the window — built from numbers and fixed words only
function describe(cfg) {
  const n = (v) => { const x = Math.round(Number(v)); return Number.isFinite(x) && x > 0 ? x : null; };
  const W = n(cfg.extWidth), H = n(cfg.extHeight);
  const size = (W && H) ? W + ' × ' + H + ' mm' : '';
  const cat = cfg.windowCategory;
  const units = Array.isArray(cfg.multiUnits) ? cfg.multiUnits : null;
  if (cat === 'sash') {
    if (cfg.windowLayout === 'square-bay' && units && units.length >= 1) {
      const parts = ['Square bay'];
      if (W) parts.push(units.length === 1 ? 'front ' + W + ' mm' : 'front ' + units.length + ' windows, ' + W + ' mm');
      if (n(cfg.baySideWidth)) parts.push('sides 2 × ' + n(cfg.baySideWidth) + ' mm');
      if (H) parts.push('height ' + H + ' mm');
      return parts.join(' · ');
    }
    if (units && units.length >= 2) return 'Multi-part sash window · ' + units.length + ' units · ' + size;
    const kind = cfg.sashType === 'triple' ? 'Triple sash window' : cfg.sashType === 'arched' ? 'Arched sash window' : 'Sash window';
    return kind + (size ? ' · ' + size : '');
  }
  if (cat === 'casement') return 'Casement window' + (size ? ' · ' + size : '');
  if (cat === 'fix-only') return 'Fixed window' + (size ? ' · ' + size : '');
  if (cat === 'door') return 'Timber door' + (size ? ' · ' + size : '');
  return 'Timber window' + (size ? ' · ' + size : '');
}

const STYLES = `
  :root { --navy:#0A1628; --cream:#FAFAF8; --stage:#F3F0EA; --muted:#4b5563; --silver:#6b7280; --line:#E5E2DA; }
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { background:var(--cream); }
  body { font-family:'Jost',sans-serif; color:var(--navy); -webkit-text-size-adjust:100%; }
  a { color:var(--navy); }
  .dv-top { background:var(--navy); height:70px; display:flex; align-items:center; padding:0 40px; }
  .dv-brand { text-decoration:none; display:inline-flex; flex-direction:column; align-items:flex-start; gap:4px; }
  .dv-brand-main { color:#fff; font-weight:300; letter-spacing:.4em; font-size:14px; border-top:1px solid #fff; border-bottom:1px solid #fff; padding:5px 0; }
  .dv-brand-sub { color:rgba(255,255,255,.9); font-weight:300; letter-spacing:.35em; font-size:9px; }
  .dv-site { margin-left:auto; color:#fff; text-decoration:none; font-size:13px; letter-spacing:.08em; display:inline-flex; align-items:center; gap:8px; }
  .dv-site:hover { text-decoration:underline; }
  .dv-wrap { max-width:1280px; margin:0 auto; padding:22px 40px 28px; }
  .dv-kicker { font-size:11px; letter-spacing:.28em; color:var(--silver); text-transform:uppercase; }
  .dv-title { font-family:'Cormorant Garamond',Georgia,serif; font-size:34px; font-weight:600; line-height:1.1; margin-top:4px; overflow-wrap:anywhere; }
  .dv-sub { font-size:14px; color:var(--muted); margin-top:4px; }
  .dv-stage { position:relative; margin-top:16px; height:clamp(380px, 62vh, 600px); background:var(--stage); border-radius:4px; overflow:hidden; }
  .dv-stage #root-3d { position:absolute; inset:0; }
  .dv-stage .app-shell { width:100%; height:100%; display:block; }
  .dv-stage .viewport { width:100%; height:100%; }
  .dv-stage canvas { display:block; }
  .dv-loading { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; text-align:center; padding:0 20px; font-size:12px; letter-spacing:.2em; text-transform:uppercase; color:var(--silver); background:var(--stage); z-index:2; }
  .dv-hint { margin-top:10px; font-size:12px; letter-spacing:.14em; color:var(--silver); text-align:center; text-transform:uppercase; }
  .dv-foot { margin-top:22px; display:flex; align-items:center; justify-content:space-between; gap:20px; flex-wrap:wrap; }
  .dv-tag { font-size:13px; color:var(--muted); }
  .dv-actions { display:flex; align-items:center; gap:18px; flex-wrap:wrap; }
  .dv-own { font-size:13px; display:inline-flex; align-items:center; gap:6px; }
  .dv-btn { min-height:46px; padding:0 22px; display:inline-flex; align-items:center; justify-content:center; background:var(--navy); color:#fff; text-decoration:none; font-size:13px; letter-spacing:.08em; border-radius:2px; }
  .dv-btn:hover { background:#132441; }
  .dv-center { max-width:560px; margin:12vh auto 0; text-align:center; padding:0 20px; }
  .dv-center h1 { font-family:'Cormorant Garamond',Georgia,serif; font-size:2rem; font-weight:600; margin-bottom:.8rem; }
  .dv-center p { color:#555; line-height:1.7; font-size:.95rem; }
  .dv-center .dv-actions { justify-content:center; margin-top:1.6rem; }
  @media (max-width:600px) {
    .dv-top { justify-content:center; padding:0 16px; height:64px; }
    .dv-brand { align-items:center; }
    .dv-brand-main { font-size:13px; padding-left:.4em; }
    .dv-brand-sub { font-size:8px; padding-left:.35em; }
    .dv-site { display:none; }
    .dv-wrap { padding:16px 0 26px; }
    .dv-kicker, .dv-title, .dv-sub, .dv-hint, .dv-foot { padding-left:18px; padding-right:18px; }
    .dv-kicker { font-size:10px; }
    .dv-title { font-size:26px; }
    .dv-sub { font-size:12px; }
    .dv-stage { margin-top:12px; height:min(470px, 62vh); border-radius:0; }
    .dv-hint { font-size:10px; }
    .dv-foot { flex-direction:column-reverse; align-items:stretch; gap:12px; margin-top:16px; }
    .dv-actions { flex-direction:column; align-items:stretch; gap:12px; }
    .dv-btn { width:100%; min-height:48px; }
    .dv-own { justify-content:center; order:2; }
    .dv-tag { text-align:center; font-size:12px; }
    .dv-stage .viewport-controls { max-width:170px !important; padding:4px !important; gap:4px !important; top:8px !important; left:8px !important; transform:scale(.9); transform-origin:top left; }
  }
`;

const ARROW = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>';

function pageShell(site, title, bodyHtml, opts) {
  opts = opts || {};
  const og = opts.og || null;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(title)} — Prime Sash Windows</title>
${og ? `<meta property="og:type" content="website">
<meta property="og:site_name" content="Prime Sash Windows">
<meta property="og:title" content="${escapeHtml(og.title)}">
<meta property="og:description" content="${escapeHtml(og.description)}">
<meta property="og:url" content="${escapeHtml(og.url)}">` : ''}
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Jost:wght@300;400;500&display=swap" rel="stylesheet">
<style>${STYLES}</style>
</head>
<body>
  <header class="dv-top">
    <a class="dv-brand" href="https://${escapeHtml(site.host)}/" aria-label="Prime Sash Windows — home">
      <span class="dv-brand-main">PRIME&nbsp;&nbsp;SASH</span>
      <span class="dv-brand-sub">W I N D O W S</span>
    </a>
    <a class="dv-site" href="https://${escapeHtml(site.host)}/">${escapeHtml(site.label)} ${ARROW}</a>
  </header>
  ${bodyHtml}
</body>
</html>`;
}

function linksBlock(site) {
  return `<div class="dv-actions">
      <a class="dv-own" href="https://${escapeHtml(site.host)}/online-estimate.html">Design your own window ${ARROW}</a>
      <a class="dv-btn" href="https://${escapeHtml(site.host)}/">Visit ${escapeHtml(site.label)}</a>
    </div>`;
}

function messagePage(site, heading, text) {
  return pageShell(site, heading, `
  <main class="dv-center">
    <h1>${escapeHtml(heading)}</h1>
    <p>${escapeHtml(text)}</p>
    ${linksBlock(site)}
  </main>`);
}

module.exports = async (req, res) => {
  const site = siteHost(req);
  const code = (req.query && req.query.code) ? String(req.query.code).trim() : '';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const notFound = () => res.status(404).send(messagePage(site, 'Link not found',
    "This link doesn't match any window design. Please check the link, or design your own window in 3D on our website."));

  if (!/^[A-Za-z0-9]{6,16}$/.test(code)) { notFound(); return; }

  let data = null;
  try {
    const resp = await fetch(SUPABASE_URL + '/rest/v1/rpc/get_shared_design', {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_code: code })
    });
    if (resp.ok) data = await resp.json();
  } catch (e) {
    data = null;
  }

  if (!data) { notFound(); return; }

  if (data.expired) {
    res.status(410).send(messagePage(site, 'This link has expired',
      'Shared window designs stay online for 30 days. You can design the window again in 3D on our website — it only takes a few minutes.'));
    return;
  }

  const cfg = (data.config && typeof data.config === 'object' && !Array.isArray(data.config)) ? data.config : null;
  if (!cfg) { notFound(); return; }

  const title = (typeof data.title === 'string' && data.title.trim()) ? data.title.trim() : 'Your window design';
  const sub = describe(cfg);
  const pageUrl = 'https://' + site.host + '/d/' + code;

  const body = `
  <main class="dv-wrap">
    <div class="dv-kicker">Your window in 3D</div>
    <h1 class="dv-title">${escapeHtml(title)}</h1>
    <div class="dv-sub">${escapeHtml(sub)}</div>
    <div class="dv-stage" id="dv-stage">
      <div id="root-3d"></div>
      <div class="dv-loading" id="dv-loading">Loading 3D&hellip;</div>
    </div>
    <div class="dv-hint" id="dv-hint">Drag to rotate · scroll to zoom · sliders open the sashes</div>
    <div class="dv-foot">
      <div class="dv-tag">Prime Sash Windows — bespoke timber sash windows, made in the UK</div>
      ${linksBlock(site)}
    </div>
  </main>
  <script>window.__PSW_DESIGN__ = ${jsonForScript(cfg)};</script>
  <script>
  (function () {
    var cfg = window.__PSW_DESIGN__;
    var loading = document.getElementById('dv-loading');
    var hint = document.getElementById('dv-hint');
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) hint.textContent = 'Drag to rotate · pinch to zoom';
    var failed = false;
    function fail() { failed = true; loading.style.display = 'flex'; loading.textContent = '3D preview unavailable in this browser'; }
    var s = document.createElement('script');
    s.type = 'module';
    s.src = ${jsonForScript(BUNDLE_URL)};
    s.onerror = fail;
    document.head.appendChild(s);
    var t0 = Date.now();
    (function poll() {
      if (failed) return;
      if (typeof window.update3D === 'function') {
        try {
          // The exact saved config, presented closed and without dimension lines;
          // the sliders in the viewport still let the visitor open the sashes.
          window.update3D(Object.assign({}, cfg, { showGuides: false, autoRotate: false, opening: 0, upperOpening: 0, doorOpening: 0 }));
        } catch (e) { fail(); return; }
        setTimeout(function () { loading.style.display = 'none'; }, 600);
        return;
      }
      if (Date.now() - t0 > 30000) { fail(); return; }
      setTimeout(poll, 100);
    })();
  })();
  </script>`;

  res.status(200).send(pageShell(site, title === 'Your window design' ? 'Your window in 3D' : title, body, {
    og: { title: title === 'Your window design' ? 'A window design in 3D — Prime Sash Windows' : title + ' — in 3D', description: sub, url: pageUrl }
  }));
};

// exported for tests
module.exports.describe = describe;
module.exports.jsonForScript = jsonForScript;
