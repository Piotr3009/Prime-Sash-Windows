// api/estimate-view.js — Vercel Serverless Function
// Public, read-only client view of an estimate via share link:
//   /e/<share_token>   (see vercel.json rewrite)
// Data access: Supabase RPC get_shared_estimate (SECURITY DEFINER) called with
// the ANON key — table RLS stays fully locked; the token is the only door.
// Rendering: the page loads the SAME js/estimate-renderer.js the dashboards use,
// so the client sees exactly what you see (and Download PDF works identically).

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rfelsfwjszjdtzuovlal.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmZWxzZndqc3pqZHR6dW92bGFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0Nzc1MTgsImV4cCI6MjA5MDA1MzUxOH0.Ut9EtffoU-L1g6IKiqcaVaoA2sEDoc0so821L1Uxn_A';

const RENDERER_VERSION = '27'; // keep in sync with the ?v= used on dashboards

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

function pageShell(title, bodyHtml, opts = {}) {
  const { withRenderer = false, estimateJson = null } = opts;
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
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Jost:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
  :root {
    --navy: #0A1628;
    --cream: #FAFAF8;
    --cream2: #F3F0EA;
    --silver: #9E9E90;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: var(--cream); font-family: 'Jost', sans-serif; color: var(--navy); }
  .share-topbar { background: var(--navy); padding: 1.1rem 1.5rem; }
  .share-brand { display: inline-block; color: #fff; font-weight: 300; letter-spacing: .4em; font-size: 14px; border-top: 1px solid #fff; border-bottom: 1px solid #fff; padding: 6px 0; }
  .share-brand-sub { color: rgba(255,255,255,.9); font-weight: 300; letter-spacing: .35em; font-size: 9px; margin-top: 4px; }
  .share-wrap { max-width: 1080px; margin: 0 auto; padding: 1.5rem 1rem 4rem; }
  .share-note { font-size: .78rem; color: var(--silver); letter-spacing: .05em; margin: 0 0 1rem; }
  .share-center { max-width: 560px; margin: 12vh auto 0; text-align: center; padding: 0 1.5rem; }
  .share-center h1 { font-family: 'Cormorant Garamond', serif; font-size: 2rem; font-weight: 600; margin-bottom: .8rem; }
  .share-center p { color: #555; line-height: 1.7; font-size: .95rem; }
  .share-sep { width: 60px; height: 1px; margin: 1.2rem auto; background: linear-gradient(90deg, transparent, var(--silver), transparent); }
</style>
${withRenderer ? `
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/3.0.3/jspdf.umd.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/5.0.2/jspdf.plugin.autotable.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
` : ''}
</head>
<body>
  <div class="share-topbar">
    <div class="share-brand">PRIME&nbsp;&nbsp;SASH</div>
    <div class="share-brand-sub">W I N D O W S</div>
  </div>
  ${bodyHtml}
${withRenderer ? `
<script>window.__SHARED_ESTIMATE__ = ${estimateJson};</script>
<script src="/js/viewer3d-modal.js?v=3"></script>
<script src="/js/estimate-renderer.js?v=${RENDERER_VERSION}"></script>
<script>
  (function () {
    var est = window.__SHARED_ESTIMATE__;
    var el = document.getElementById('share-estimate');
    try {
      el.innerHTML = EstimateRenderer.renderEstimateHTML(est, { isEditable: false, isAdmin: false });
      EstimateRenderer.attachExportButtons(est);
    } catch (e) {
      el.innerHTML = '<p style="color:#a33;font-size:.9rem;">Sorry — this estimate could not be displayed. Please contact us at info@primesashwindows.co.uk.</p>';
      console.error(e);
    }
  })();
</script>` : ''}
</body>
</html>`;
}

module.exports = async (req, res) => {
  const token = (req.query && req.query.token) ? String(req.query.token).trim() : '';
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store'); // always the live version

  if (!UUID_RE.test(token)) {
    res.status(404).send(pageShell('Estimate not found', `
      <div class="share-center">
        <h1>Estimate not found</h1>
        <div class="share-sep"></div>
        <p>This link doesn't match any estimate. Please check the link from your email, or contact us at <strong>info@primesashwindows.co.uk</strong>.</p>
      </div>`));
    return;
  }

  let data = null;
  try {
    const resp = await fetch(SUPABASE_URL + '/rest/v1/rpc/get_shared_estimate', {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_token: token })
    });
    if (resp.ok) data = await resp.json();
  } catch (e) {
    data = null;
  }

  if (!data) {
    res.status(404).send(pageShell('Estimate not found', `
      <div class="share-center">
        <h1>Estimate not found</h1>
        <div class="share-sep"></div>
        <p>This link doesn't match any estimate, or it has been revoked. Please contact us at <strong>info@primesashwindows.co.uk</strong> and we'll send you a fresh link.</p>
      </div>`));
    return;
  }

  if (data.preparing) {
    res.status(200).send(pageShell('Estimate in preparation', `
      <div class="share-center">
        <h1>Your estimate is being prepared</h1>
        <div class="share-sep"></div>
        <p>Estimate <strong>${escapeHtml(data.estimate_number || '')}</strong> is currently being finalised by our team. You'll receive an email the moment it's ready — this same link will then open it instantly.</p>
      </div>`));
    return;
  }

  const title = 'Estimate ' + (data.estimate_number || '');
  const body = `
    <div class="share-wrap">
      <p class="share-note">This is a live view of your estimate — it always shows the current version. Use the Download PDF button for a copy.</p>
      <div id="share-estimate"></div>
    </div>`;

  res.status(200).send(pageShell(title, body, {
    withRenderer: true,
    estimateJson: JSON.stringify(data).replace(/</g, '\\u003c')
  }));
};
