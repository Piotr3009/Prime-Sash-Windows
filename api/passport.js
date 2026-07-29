// api/passport.js — Vercel Serverless Function
// Public, read-only Window Passport reached by scanning the QR sticker:
//   /p/<token>   (see vercel.json rewrite)
//
// Data access: Supabase RPC get_window_passport (SECURITY DEFINER) called with
// the ANON key — table RLS stays fully locked; the token is the only door.
// Same proven pattern as api/estimate-view.js.
//
// noindex on purpose: thousands of near-identical generated pages would be a
// scaled-content pattern, and an indexed passport would let anyone search a
// property address and read its window security spec. Scanning requires
// physically standing at the window; Google would remove that limit.

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rfelsfwjszjdtzuovlal.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmZWxzZndqc3pqZHR6dW92bGFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0Nzc1MTgsImV4cCI6MjA5MDA1MzUxOH0.Ut9EtffoU-L1g6IKiqcaVaoA2sEDoc0so821L1Uxn_A';

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

// Screenshots are data: URLs written by our own configurator. Anything else
// (javascript:, external http) is dropped rather than rendered.
function safeImageSrc(src) {
  const s = String(src == null ? '' : src);
  return /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=\s]+$/.test(s) ? s : '';
}

// JSON.stringify does NOT escape "</script>", so any value containing it would
// close the inline script block early - a real XSS vector on a public page.
// Escaping the three characters that can break out keeps the payload valid JS.
function jsonForScript(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(String(d) + (String(d).length === 10 ? 'T00:00:00' : ''));
  if (isNaN(dt)) return '';
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

const STYLES = `
  :root { --navy:#0A1628; --cream:#FAFAF8; --cream2:#F3F0EA; --silver:#9E9E90; --line:#E5E2DA; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:var(--cream2); font-family:'Jost',sans-serif; color:var(--navy); -webkit-text-size-adjust:100%; }
  .pp-wrap { max-width:520px; margin:0 auto; background:var(--cream); min-height:100vh; }
  .pp-head { background:var(--navy); padding:14px 16px; text-align:center; display:block; text-decoration:none; }
  .pp-brand { font-family:'Cormorant Garamond',serif; font-size:1rem; color:var(--cream); letter-spacing:.04em; }
  .pp-rule { height:1px; margin:7px auto; background:linear-gradient(90deg,transparent,var(--silver),transparent); }
  .pp-kicker { font-size:.55rem; letter-spacing:.28em; text-transform:uppercase; color:var(--silver); }
  .pp-body { padding:18px 16px 8px; }
  .pp-title { font-family:'Cormorant Garamond',serif; font-size:1.6rem; line-height:1.15; text-align:center; }
  .pp-loc { font-size:.72rem; color:var(--silver); text-align:center; margin-top:4px; }
  .pp-serial { display:block; width:fit-content; margin:9px auto 0; font-family:'JetBrains Mono',ui-monospace,monospace;
               font-size:.72rem; background:var(--cream2); padding:5px 11px; border-radius:3px; }
  .pp-shot { background:var(--cream2); border:1px solid var(--line); border-radius:4px; margin-top:16px;
             min-height:150px; display:flex; align-items:center; justify-content:center; overflow:hidden; }
  .pp-shot img { max-width:100%; max-height:230px; display:block; }
  .pp-btn { display:block; width:100%; text-align:center; text-decoration:none; cursor:pointer;
            border:1px solid var(--navy); border-radius:3px; padding:11px 0; margin-top:7px;
            font-family:'Jost',sans-serif; font-size:.6rem; letter-spacing:.2em; text-transform:uppercase;
            background:transparent; color:var(--navy); }
  .pp-btn--solid { background:var(--navy); color:var(--cream); }
  .pp-btn--sm { padding:8px 0; font-size:.56rem; }
  .pp-sec { font-size:.55rem; letter-spacing:.22em; text-transform:uppercase; color:var(--silver);
            border-bottom:1px solid var(--line); padding-bottom:5px; margin:20px 0 8px; }
  .pp-tab { width:100%; border-collapse:collapse; font-size:.8rem; }
  .pp-tab td { padding:6px 0; vertical-align:top; }
  .pp-tab tr + tr td { border-top:1px solid #EFEDE7; }
  .pp-tab td:first-child { color:#55554F; padding-right:12px; }
  .pp-tab td:last-child { color:#141414; }
  .pp-tab td:last-child { text-align:right; }
  .pp-war { border:1px solid var(--navy); border-radius:4px; padding:11px 13px; margin-top:16px; }
  .pp-war-top { display:flex; justify-content:space-between; align-items:center; gap:10px; }
  .pp-badge { font-size:.55rem; letter-spacing:.1em; text-transform:uppercase; padding:3px 9px; border-radius:2px; }
  .pp-badge--on { color:#1D6E4E; background:#E6F1EB; }
  .pp-badge--off { color:#8A4B12; background:#F7EDE1; }
  .pp-war-no { font-family:'JetBrains Mono',ui-monospace,monospace; font-size:.8rem; margin-top:6px; }
  .pp-war-meta { font-size:.7rem; color:var(--silver); margin-top:3px; line-height:1.5; }
  .pp-doc { display:flex; justify-content:space-between; align-items:center; gap:10px;
            background:var(--cream2); border-radius:3px; padding:10px 12px; margin-bottom:6px;
            font-size:.8rem; color:var(--navy); text-decoration:none; }
  .pp-doc { width:100%; border:0; font-family:'Jost',sans-serif; font-size:.8rem; cursor:pointer; }
  #pp-draw-overlay { position:fixed; inset:0; background:rgba(10,22,40,.9); z-index:9999; display:none;
                     align-items:center; justify-content:center; padding:16px; }
  #pp-draw-overlay.open { display:flex; }
  #pp-draw-box { background:#fff; border-radius:6px; padding:14px; max-width:96vw; max-height:92vh; overflow:auto; }
  #pp-draw-box svg { max-width:100%; height:auto; display:block; }
  #pp-draw-close { display:block; margin:12px auto 0; border:1px solid var(--navy); background:transparent;
                   color:var(--navy); border-radius:3px; padding:9px 20px; cursor:pointer;
                   font-family:'Jost',sans-serif; font-size:.6rem; letter-spacing:.2em; text-transform:uppercase; }
  .pp-foot { background:var(--cream2); border-top:1px solid var(--line); padding:18px 16px; text-align:center; margin-top:22px; }
  .pp-foot-h { font-family:'Cormorant Garamond',serif; font-size:1rem; }
  .pp-foot-p { font-size:.7rem; color:var(--silver); margin:4px 0 11px; }
  .pp-foot-links { font-size:.66rem; color:var(--silver); margin-top:12px; }
  .pp-foot-links a { color:var(--silver); }
  .pp-center { max-width:520px; margin:0 auto; padding:14vh 24px; text-align:center; }
  .pp-center h1 { font-family:'Cormorant Garamond',serif; font-size:1.8rem; margin-bottom:.6rem; }
  .pp-center p { color:#555; line-height:1.7; font-size:.9rem; }
`;

function pageShell(title, bodyHtml, tailHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(title)} — Prime Sash Windows</title>
<link rel="icon" type="image/png" href="/images/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500&family=Jost:wght@300;400;500&family=JetBrains+Mono&display=swap" rel="stylesheet">
<style>${STYLES}</style>
</head>
<body>
${bodyHtml}
${tailHtml || ''}
</body>
</html>`;
}

function notFound(res, msg) {
  res.status(404).send(pageShell('Passport not found', `
    <div class="pp-center">
      <h1>Passport not found</h1>
      <p>${escapeHtml(msg)}</p>
      <p style="margin-top:1rem;"><a href="/" style="color:#0A1628;">primesashwindows.co.uk</a></p>
    </div>`));
}

module.exports = async (req, res) => {
  const token = (req.query && req.query.token) ? String(req.query.token).trim() : '';
  // Plate codes come pre-engraved from the supplier, so the format is theirs:
  // digits, dots, dashes are all fair game. Only length and charset are bounded.
  const plate = (req.query && req.query.plate) ? String(req.query.plate).trim() : '';
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const PLATE_RE = /^[A-Za-z0-9._-]{1,64}$/;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // A passport changes only on a rare correction; short edge cache keeps the
  // page instant on poor site signal without serving stale data for long.
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400');

  const byPlate = plate !== '';
  if (byPlate ? !PLATE_RE.test(plate) : !UUID_RE.test(token)) {
    return notFound(res, "This link doesn't match any window. Please check the QR code on the window, or contact us at info@primesashwindows.co.uk.");
  }

  let data = null;
  try {
    const rpc = byPlate ? 'get_window_passport_by_plate' : 'get_window_passport';
    const resp = await fetch(SUPABASE_URL + '/rest/v1/rpc/' + rpc, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(byPlate ? { p_code: plate } : { p_token: token })
    });
    if (resp.ok) data = await resp.json();
  } catch (e) {
    data = null;
  }

  if (!data || typeof data !== 'object' || !data.serial_number) {
    return notFound(res, "This link doesn't match any window. Please check the QR code on the window, or contact us at info@primesashwindows.co.uk.");
  }

  const spec = (data.specification && typeof data.specification === 'object') ? data.specification : {};
  const rows = Array.isArray(spec.rows) ? spec.rows : [];
  const shots = (spec.screenshots && typeof spec.screenshots === 'object') ? spec.screenshots : {};
  const shot = safeImageSrc(shots.interior || shots.exterior || '');
  const viewer3d = (spec.viewer3d && typeof spec.viewer3d === 'object') ? spec.viewer3d : null;
  const attachments = Array.isArray(data.attachments) ? data.attachments : [];

  const titleText = [data.window_number, data.window_type].filter(Boolean).join(' · ') || 'Window passport';
  const mfg = fmtDate(data.manufactured_date);

  // Timber comes from the project (the configurator never captured species),
  // so it is merged into the frozen rows at display time - placed after Frame
  // to keep the material facts together.
  const cleanRows = rows.filter(r =>
    r && r.label && r.value !== undefined && r.value !== null && String(r.value).trim() !== '');
  if (data.timber) {
    const existing = cleanRows.findIndex(r => String(r.label).toLowerCase() === 'timber');
    if (existing >= 0) {
      // A frozen row already names the timber - the project value wins, so the
      // passport never shows two different species for the same window.
      cleanRows[existing] = { label: 'Timber', value: data.timber };
    } else {
      const at = cleanRows.findIndex(r => String(r.label).toLowerCase() === 'frame');
      cleanRows.splice(at >= 0 ? at + 1 : 0, 0, { label: 'Timber', value: data.timber });
    }
  }
  const specRows = cleanRows
    .map(r => `<tr><td>${escapeHtml(r.label)}</td><td>${escapeHtml(r.value)}</td></tr>`)
    .join('');

  // Whole-window U-value, entered by hand per window (never derived from the
  // glazing type - see db/passport-uvalue.sql).
  const uRow = data.u_value
    ? `<tr><td>U-value</td><td>${escapeHtml(data.u_value)} W/m&sup2;K</td></tr>` : '';
  const mfgRow = mfg ? `<tr><td>Manufactured</td><td>${escapeHtml(mfg)}</td></tr>` : '';

  // Warranty. Expiry drives the badge, so nobody has to maintain it by hand.
  let warrantyHtml = '';
  if (data.warranty_no) {
    const exp = data.warranty_expiry ? new Date(String(data.warranty_expiry) + 'T00:00:00') : null;
    const active = exp ? (exp.getTime() >= Date.now()) : true;
    const years = Number(data.warranty_years) || 10;
    const meta = [
      years + ' years on product',
      exp ? (active ? 'to ' + fmtDate(data.warranty_expiry) : 'expired ' + fmtDate(data.warranty_expiry)) : '',
      'transfers with the property'
    ].filter(Boolean).join(' · ');

    warrantyHtml = `
      <div class="pp-war">
        <div class="pp-war-top">
          <span class="pp-kicker">Warranty</span>
          <span class="pp-badge ${active ? 'pp-badge--on' : 'pp-badge--off'}">${active ? 'Active' : 'Expired'}</span>
        </div>
        <div class="pp-war-no">${escapeHtml(data.warranty_no)}</div>
        <div class="pp-war-meta">${escapeHtml(meta)}</div>
      </div>`;
  }

  const docsHtml = attachments
    .map(a => {
      const url = a && typeof a.url === 'string' && /^https?:\/\//i.test(a.url) ? a.url : '';
      const name = a && a.name ? String(a.name) : 'Document';
      if (!url) return '';
      return `<a class="pp-doc" href="${escapeHtml(url)}" target="_blank" rel="noopener">
                <span>${escapeHtml(name)}</span><span aria-hidden="true">&#8681;</span></a>`;
    })
    .filter(Boolean)
    .join('');

  // Technical drawing is generated and frozen at creation, so it always matches
  // the frozen specification and needs no uploaded file.
  const drawing = (typeof spec.drawing === 'string' && spec.drawing.indexOf('<svg') !== -1)
    ? spec.drawing : '';
  const drawingRow = drawing
    ? `<button type="button" class="pp-doc" id="pp-drawing-btn">
         <span>Technical drawing</span><span aria-hidden="true">&#9707;</span></button>` : '';

  // Care and maintenance is a LIVE link, not a frozen copy: if the guide is
  // improved in 2030, every passport should show the current version.
  const careRow = `<a class="pp-doc" href="/timber-window-maintenance-guide.html" target="_blank" rel="noopener">
      <span>Care and maintenance</span><span aria-hidden="true">&#8599;</span></a>`;

  const docsSection = `<div class="pp-sec">Documents</div>${docsHtml}${drawingRow}${careRow}`;

  // Warranty certificate uses the existing generator page, filled from params.
  const warrantyLink = data.warranty_no
    ? '/warranty-certificate.html?warrantyNo=' + encodeURIComponent(data.warranty_no)
      + '&product=' + encodeURIComponent([data.window_number, data.window_type].filter(Boolean).join(' — '))
      + '&mfgDate=' + encodeURIComponent(data.manufactured_date || '')
      + '&expiry=' + encodeURIComponent(data.warranty_expiry || '')
    : '';

  const body = `
  <div class="pp-wrap">
    <a class="pp-head" href="/">
      <div class="pp-brand">Prime Sash Windows</div>
      <div class="pp-rule"></div>
      <div class="pp-kicker">Window passport</div>
    </a>

    <div class="pp-body">
      <h1 class="pp-title">${escapeHtml(titleText)}</h1>
      ${data.project_label ? `<div class="pp-loc">${escapeHtml(data.project_label)}</div>` : ''}
      <span class="pp-serial">${escapeHtml(data.serial_number)}</span>

      ${shot ? `<div class="pp-shot"><img src="${shot}" alt="${escapeHtml(titleText)}"></div>` : ''}
      ${viewer3d ? `<button type="button" class="pp-btn pp-btn--sm" data-psw3d="passport">View in 3D</button>` : ''}

      ${specRows || uRow || mfgRow ? `<div class="pp-sec">Specification</div>
      <table class="pp-tab"><tbody>${specRows}${uRow}${mfgRow}</tbody></table>` : ''}

      ${warrantyHtml}
      ${docsSection}

      ${warrantyLink ? `<a class="pp-btn pp-btn--solid" href="${escapeHtml(warrantyLink)}">Download warranty</a>` : ''}
      <button type="button" class="pp-btn" id="pp-pdf-btn">Download passport</button>
    </div>

    <div class="pp-foot">
      <div class="pp-foot-h">Design your own in 3D</div>
      <div class="pp-foot-p">Instant online estimate · no obligation</div>
      <a class="pp-btn" href="/online-estimate.html" style="max-width:230px;margin:0 auto;">Online estimate</a>
      <div class="pp-foot-links">
        <a href="/">primesashwindows.co.uk</a>
      </div>
    </div>
  </div>`;

  const pdfPayload = {
    serial: data.serial_number || '',
    title: titleText,
    location: data.project_label || '',
    rows: cleanRows.map(r => [String(r.label), String(r.value)]),
    uValue: data.u_value ? String(data.u_value) + ' W/m\u00b2K' : '',
    manufactured: mfg,
    warrantyNo: data.warranty_no || '',
    warrantyMeta: data.warranty_expiry ? 'Valid until ' + fmtDate(data.warranty_expiry) : '',
    image: shot || ''
  };

  const tail = `
${drawing ? `<div id="pp-draw-overlay"><div><div id="pp-draw-box">${drawing}</div>
  <button type="button" id="pp-draw-close">Close</button></div></div>` : ''}
<script>
  window.__PSW_PASSPORT__ = ${jsonForScript(pdfPayload)};
  ${viewer3d ? `window.__psw3dConfigs = { passport: {
    config: ${jsonForScript(viewer3d)},
    label: ${jsonForScript(titleText)},
    dims: ${jsonForScript(data.serial_number || '')}
  } };` : ''}
</script>
${viewer3d ? '<script src="/js/viewer3d-modal.js?v=2"></script>' : ''}
<script src="/js/passport-page.js?v=1"></script>`;

  res.status(200).send(pageShell(data.serial_number || 'Window passport', body, tail));
};
