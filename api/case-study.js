// api/case-study.js — Vercel Serverless Function
// Server-side rendered Case Studies / Journal pages (SEO-friendly: full HTML, no client-side data fetching).
// Routes (see vercel.json rewrites):
//   /case-studies          -> index page (all published posts, tab filters)
//   /case-study/<slug>     -> single post page
// Data: Supabase tables case_studies + case_study_images (see case-studies-setup.sql).
// Only posts with status = 'published' are visible (enforced both here and by RLS).

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rfelsfwjszjdtzuovlal.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmZWxzZndqc3pqZHR6dW92bGFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0Nzc1MTgsImV4cCI6MjA5MDA1MzUxOH0.Ut9EtffoU-L1g6IKiqcaVaoA2sEDoc0so821L1Uxn_A';

const SITE_URL = 'https://www.primesashwindows.co.uk';

const TYPE_LABELS = {
  'case-study': 'Case Study',
  'workshop': 'Workshop',
  'news': 'News'
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

// Overview text -> paragraphs (blank line = new paragraph)
function textToParagraphs(text) {
  if (!text) return '';
  return String(text)
    .split(/\r?\n\s*\r?\n/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => '<p>' + escapeHtml(p).replace(/\r?\n/g, '<br>') + '</p>')
    .join('\n');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
    });
  } catch (e) {
    return escapeHtml(dateStr);
  }
}

function sortedImages(post) {
  const imgs = (post.case_study_images || []).slice();
  imgs.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  return imgs;
}

function coverImage(post) {
  const imgs = sortedImages(post);
  const cover = imgs.find(i => i.is_cover);
  return cover ? cover.image_url : (imgs[0] ? imgs[0].image_url : null);
}

async function sbGet(path) {
  const resp = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + SUPABASE_ANON_KEY
    }
  });
  if (!resp.ok) throw new Error('Supabase error ' + resp.status);
  return resp.json();
}

// ---------------------------------------------------------------------------
// Shared page chrome (nav/footer copied from site pages, hrefs absolutized
// because /case-study/<slug> is a nested path — relative links would break)
// ---------------------------------------------------------------------------

function pageHead({ title, description, canonical, ogImage, jsonLd }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<!-- Google tag (gtag.js) — GA4 + Google Ads -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-S88RZLHQL2"></script>
<script>
  window.dataLayer=window.dataLayer||[];
  function gtag(){dataLayer.push(arguments);}
  gtag('js',new Date());
  gtag('config','G-S88RZLHQL2');
  gtag('config','AW-3481705735');
</script>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}"/>
  <link rel="canonical" href="${escapeHtml(canonical)}"/>
  <meta property="og:type" content="article"/>
  <meta property="og:title" content="${escapeHtml(title)}"/>
  <meta property="og:description" content="${escapeHtml(description)}"/>
  <meta property="og:url" content="${escapeHtml(canonical)}"/>
${ogImage ? `  <meta property="og:image" content="${escapeHtml(ogImage)}"/>\n` : ''}  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Jost:wght@200;300;400;500&display=swap" rel="stylesheet"/>
  <link rel="stylesheet" href="/css/main.css?v=7"/>
  <link rel="icon" type="image/png" href="/favicon.png"/>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg"/>
  <link rel="apple-touch-icon" href="/apple-touch-icon.png"/>
${jsonLd ? `  <script type="application/ld+json">${jsonLd}</script>\n` : ''}  <style>
    body { padding-top: 0; }
    .page-hero { background: linear-gradient(135deg, #0B1220 0%, #0F1A2E 50%, #0B1628 100%); position: relative; padding: 160px 5vw 90px; text-align: center; }
    .page-hero::before { content:''; position:absolute; inset:0; background: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E"); opacity:0.4; pointer-events:none; }
    .page-hero .eyebrow { font-family:var(--sans); font-size:.6rem; letter-spacing:.45em; text-transform:uppercase; margin-bottom:2rem; color: rgba(212,212,200,.6); text-align: center; }
    .page-hero h1 { font-family: var(--serif); font-size: clamp(2.4rem, 5vw, 4.2rem); font-weight: 500; line-height: 1.12; color: #fff; margin-bottom: 1.2rem; }
    .page-hero .hero-subtitle { font-size: 1.1rem; line-height: 1.9; color: rgba(255,255,255,.5); max-width: 720px; margin: 0 auto; }
    .article-content { max-width: 860px; margin: 0 auto; padding: 4rem 5vw; }
    .article-content h2 { font-family: var(--serif); font-size: clamp(1.8rem, 3vw, 2.6rem); font-weight: 500; line-height: 1.2; color: var(--ink); margin: 3rem 0 1.2rem; }
    .article-content h2:first-child { margin-top: 0; }
    .article-content p { font-size: 1.05rem; line-height: 2; color: var(--muted); margin-bottom: 1.5rem; }
    .cta-band { background: var(--navy); padding: 5rem 5vw; text-align: center; }
    .cta-band h2 { font-family: var(--serif); font-size: clamp(1.8rem, 3vw, 2.8rem); font-weight: 500; color: rgba(255,255,255,.9); margin-bottom: 1.5rem; }
    .cta-band p { font-size: .82rem; color: rgba(255,255,255,.45); margin-bottom: 2.5rem; max-width: 480px; margin-left: auto; margin-right: auto; }
    .cta-band .btn-cta { display:inline-block; background:linear-gradient(135deg,#C0C0C0,#E8E8E8,#B0B0B0); color:var(--navy); padding:.9rem 2.4rem; font-family:var(--sans); font-weight:600; letter-spacing:.2em; text-transform:uppercase; font-size:.72rem; border-radius:2px; text-decoration:none; }
    .cs-type-badge { display:inline-block; font-family:var(--sans); font-size:.58rem; letter-spacing:.3em; text-transform:uppercase; padding:.35rem .9rem; border:1px solid rgba(10,22,40,.25); border-radius:2px; color:var(--muted); }
    .spec-table { width: 100%; border-collapse: collapse; margin: 1rem 0 2.5rem; font-family: var(--sans); }
    .spec-table th { background: var(--navy); color: rgba(255,255,255,.85); padding: 12px 18px; text-align: left; font-size: .68rem; letter-spacing: .15em; text-transform: uppercase; width: 220px; }
    .spec-table td { padding: 12px 18px; border-bottom: 1px solid rgba(10,22,40,.08); font-size: .95rem; color: var(--muted); }
    .cs-photo-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(240px, 1fr)); gap:14px; margin:1rem 0 2.5rem; }
    .cs-photo-grid img { width:100%; height:220px; object-fit:cover; border-radius:4px; cursor:pointer; display:block; }
    .cs-lightbox { display:none; position:fixed; inset:0; background:rgba(5,10,20,.92); z-index:2000; align-items:center; justify-content:center; padding:4vw; cursor:zoom-out; }
    .cs-lightbox img { max-width:100%; max-height:100%; object-fit:contain; }
    .cs-back-link { font-family:var(--sans); font-size:.72rem; letter-spacing:.2em; text-transform:uppercase; color:var(--muted); text-decoration:none; }
    /* Index */
    .cs-tabs { display:flex; flex-wrap:wrap; gap:10px; justify-content:center; margin:0 0 2.5rem; }
    .cs-tab { font-family:var(--sans); font-size:.68rem; letter-spacing:.25em; text-transform:uppercase; padding:.6rem 1.4rem; border:1px solid rgba(10,22,40,.25); background:transparent; color:var(--muted); border-radius:2px; cursor:pointer; }
    .cs-tab.active { background:var(--navy); color:#fff; border-color:var(--navy); }
    .cs-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:28px; }
    .cs-card { border:1px solid rgba(10,22,40,.1); border-radius:6px; overflow:hidden; background:#fff; display:flex; flex-direction:column; }
    .cs-card a.cs-card-link { text-decoration:none; color:inherit; display:flex; flex-direction:column; height:100%; }
    .cs-card img { width:100%; height:210px; object-fit:cover; display:block; }
    .cs-card .cs-card-noimg { width:100%; height:210px; background:linear-gradient(135deg,#0B1220,#0F1A2E); display:flex; align-items:center; justify-content:center; color:rgba(255,255,255,.35); font-family:var(--serif); font-size:1.1rem; }
    .cs-card-body { padding:1.4rem 1.5rem 1.6rem; display:flex; flex-direction:column; gap:.6rem; flex:1; }
    .cs-card-body h2 { font-family:var(--serif); font-size:1.45rem; font-weight:500; color:var(--ink); margin:0; line-height:1.3; }
    .cs-card-meta { font-family:var(--sans); font-size:.68rem; letter-spacing:.15em; text-transform:uppercase; color:var(--muted); }
    .cs-card-excerpt { font-size:.92rem; line-height:1.8; color:var(--muted); margin:0; }
    .cs-index-wrap { max-width:1200px; margin:0 auto; padding:4rem 5vw; }
    @media (max-width: 768px) { .page-hero { padding: 120px 5vw 60px; } }
  </style>
</head>
<body>
`;
}

const NAV_HTML = `<nav id="if-nav">
  <a href="/index.html" class="logo-wrap">
    <div class="silver-line"></div>
    <span class="logo">Prime Sash</span>
    <span class="logo">Windows</span>
    <div class="silver-line"></div>
  </a>
  <div class="nav-rows">
    <ul class="nav-row">
      <li><a href="/index.html" data-page="index">Home</a></li>
      <li><a href="/sash-windows-history.html" data-page="sash-windows-history">Sash Windows History</a></li>
      <li><a href="/why-not-sash-windows.html" data-page="why-not">Why You Shouldn\u2019t Buy</a></li>
      <li><a href="/faq-top-companies.html" data-page="faq-top">FAQ &amp; Top Companies</a></li>
      <li><a href="/certifications.html" data-page="cert">Certifications &amp; Warranty</a></li>
      <li><a href="/online-estimate.html" data-page="online" style="background:linear-gradient(135deg,#C0C0C0,#E8E8E8,#B0B0B0);color:var(--navy);padding:.35rem 1rem;font-weight:600;letter-spacing:.2em;border-radius:2px;">Online Estimate &amp; 3D</a></li>
    </ul>
    <ul class="nav-row" id="nav-row-2">
      <li><a href="/guides.html" data-page="guides">Guides</a></li>
      <li><a href="/measurement-guide.html" data-page="measure">Measurement Guide</a></li>
      <li><a href="/gallery.html" data-page="gallery">Gallery</a></li>
      <li><a href="/case-studies" data-page="journal" class="active">Journal</a></li>
      <li><a href="/contact.html" data-page="contact">Contact</a></li>
      <li><a href="/customer-dashboard.html" data-page="customer">My Account</a></li>
    </ul>
  </div>
  <a href="/customer-dashboard.html" class="nav-user" id="nav-user-btn" title="My Account"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 12 0v1" transform="translate(2,0)"/></svg></a>
  <div class="hamburger" id="ham"><span></span><span></span><span></span></div>
</nav>
<div id="mob-menu">
  <a href="/index.html">Home</a>
  <a href="/sash-windows-history.html">Sash Windows History</a>
  <a href="/why-not-sash-windows.html">Why You Shouldn\u2019t Buy</a>
  <a href="/faq-top-companies.html">FAQ &amp; Top Companies</a>
  <a href="/certifications.html">Certifications &amp; Warranty</a>
  <a href="/online-estimate.html">Online Estimate &amp; 3D</a>
  <a href="/guides.html">Guides</a>
  <a href="/measurement-guide.html">Measurement Guide</a>
  <a href="/gallery.html">Gallery</a>
  <a href="/case-studies">Journal</a>
  <a href="/contact.html">Contact</a>
  <a href="/customer-dashboard.html">My Account</a>
  <a href="tel:07842510060" style="color:rgba(255,255,255,.7);font-size:.85rem;letter-spacing:.1em;">\ud83d\udcde 07842 510 060</a>
  <a href="tel:07842510066" style="color:rgba(255,255,255,.7);font-size:.85rem;letter-spacing:.1em;">\ud83d\udcde 07842 510 066</a>
</div>
<script src="/js/nav.js?v=3"></script>
`;

const FOOTER_HTML = `<footer id="if-footer">
  <div class="ft-top-line"></div>
  <div class="ft-grid">
    <div>
      <div class="ft-logo-block">
        <div class="silver-line"></div>
        <span class="ft-logo">Prime Sash Windows</span>
        <div class="silver-line"></div>
      </div>
      <p class="ft-brand-text">Premium timber sash windows for London\u2019s period homes.<br/>Every window handcrafted. Every project \u2014 unique.</p>
    </div>
    <div class="ft-col"><h4>Navigation</h4><ul>
      <li><a href="/index.html">Home</a></li>
      <li><a href="/sash-windows-history.html">Sash Windows History</a></li>
      <li><a href="/why-not-sash-windows.html">Why You Shouldn\u2019t Buy</a></li>
      <li><a href="/faq-top-companies.html">FAQ &amp; Top Companies</a></li>
      <li><a href="/certifications.html">Certifications &amp; Warranty</a></li>
      <li><a href="/online-estimate.html">Online Estimate &amp; 3D</a></li>
      <li><a href="/guides.html">Guides</a></li>
      <li><a href="/gallery.html">Gallery</a></li>
      <li><a href="/case-studies">Journal</a></li>
      <li><a href="/contact.html">Contact</a></li>
    </ul></div>
    <div class="ft-col"><h4>Services</h4><ul>
      <li><a href="/online-estimate.html">Price Calculator</a></li>
      <li><a href="/guides.html">Guides</a>
  <a href="/measurement-guide.html">Measurement Guide</a></li>
      <li><a href="/contact.html">Book Survey</a></li>
      <li><a href="/gallery.html">Our Projects</a></li>
    </ul></div>
    <div class="ft-col"><h4>Contact</h4><ul>
      <li><a href="tel:+447842510060">07842 510 060</a></li>
      <li><a href="tel:+447842510066">07842 510 066</a></li>
      <li><a href="mailto:info@primesashwindows.co.uk">info@primesashwindows.co.uk</a></li>
      <li>Unit 3, Leaside Industrial Park,<br>Sedge Green, Nazeing, EN9 2BF</li>
    </ul></div>
  </div>
  
  <a class="ft-tmmx" href="https://www.themanufacturer.com/articles/finalists-announced-for-updated-the-manufacturer-mx-awards-2026/" target="_blank" rel="noopener">
    <img src="/img/tmmx/tmmx-smart-factory-finalist.webp" alt="The Manufacturer MX Awards 2026 — Smart Factory Finalist" width="650" height="150" loading="lazy">
  </a>
  <div class="ft-bottom">
    <p>&copy; 2026 Prime Sash Windows. All rights reserved. A trading name of Skylon Joinery LTD</p>
    <p><a href="#" style="color:inherit;text-decoration:none;">Privacy Policy</a></p>
  </div>
</footer>
</body>
</html>`;

// ---------------------------------------------------------------------------
// Detail page
// ---------------------------------------------------------------------------

function renderDetailPage(post) {
  const typeLabel = TYPE_LABELS[post.post_type] || 'Journal';
  const title = post.title + ' | ' + typeLabel + ' | Prime Sash Windows';
  const description = post.meta_description
    || (post.overview ? String(post.overview).replace(/\s+/g, ' ').trim().substring(0, 155) : 'Prime Sash Windows — ' + typeLabel);
  const canonical = SITE_URL + '/case-study/' + encodeURIComponent(post.slug);
  const cover = coverImage(post);
  const images = sortedImages(post);
  const dateText = formatDate(post.published_at);

  const specRows = [
    ['Window Type', post.spec_window_type],
    ['Colour', post.spec_colour],
    ['Georgian Bars', post.spec_bars],
    ['Glazing', post.spec_glass],
    ['Dimensions', post.spec_dimensions],
    ['Ironmongery', post.spec_ironmongery],
    ['Opening', post.spec_opening]
  ].filter(r => r[1] && String(r[1]).trim() !== '');

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    datePublished: post.published_at || undefined,
    image: cover || undefined,
    author: { '@type': 'Organization', name: 'Prime Sash Windows' },
    publisher: { '@type': 'Organization', name: 'Prime Sash Windows', url: SITE_URL },
    mainEntityOfPage: canonical
  }).replace(/</g, '\\u003c'); // prevent </script> breakout inside JSON-LD

  let html = pageHead({ title, description, canonical, ogImage: cover, jsonLd });
  html += NAV_HTML;

  html += `
  <section class="page-hero">
    <p class="eyebrow">${escapeHtml(typeLabel)}${dateText ? ' &mdash; ' + escapeHtml(dateText) : ''}</p>
    <h1>${escapeHtml(post.title)}</h1>
${post.location ? `    <p class="hero-subtitle">${escapeHtml(post.location)}</p>\n` : ''}  </section>

  <article class="article-content">
    <p style="margin-bottom:2.5rem;"><a class="cs-back-link" href="/case-studies">&larr; All Case Studies &amp; Journal</a></p>
${textToParagraphs(post.overview)}
`;

  if (specRows.length > 0) {
    html += `
    <h2>Specification</h2>
    <table class="spec-table">
      <tbody>
${specRows.map(r => `        <tr><th>${escapeHtml(r[0])}</th><td>${escapeHtml(r[1])}</td></tr>`).join('\n')}
      </tbody>
    </table>
`;
  }

  if (images.length > 0) {
    html += `
    <h2>Photos</h2>
    <div class="cs-photo-grid">
${images.map(img => `      <img src="${escapeHtml(img.image_url)}" alt="${escapeHtml(post.title + (img.caption ? ' — ' + img.caption : ''))}" loading="lazy" onclick="csOpenLightbox(this.src)">`).join('\n')}
    </div>
`;
  }

  html += `
  </article>

  <section class="cta-band">
    <h2>Start Your Own Project</h2>
    <p>Design your bespoke timber windows and doors in 3D and get an instant estimate.</p>
    <a class="btn-cta" href="/online-estimate.html">Online Estimate &amp; 3D</a>
  </section>

  <div class="cs-lightbox" id="cs-lightbox" onclick="this.style.display='none'"><img id="cs-lightbox-img" src="" alt=""></div>
  <script>
    function csOpenLightbox(src){
      document.getElementById('cs-lightbox-img').src = src;
      document.getElementById('cs-lightbox').style.display = 'flex';
    }
  </script>
`;
  html += FOOTER_HTML;
  return html;
}

// ---------------------------------------------------------------------------
// Index page
// ---------------------------------------------------------------------------

function renderIndexPage(posts) {
  const title = 'Case Studies & Journal | Prime Sash Windows';
  const description = 'Completed timber window and door projects, workshop technology and company news from Prime Sash Windows — bespoke joinery made in the UK.';
  const canonical = SITE_URL + '/case-studies';
  const firstCover = posts.length ? coverImage(posts[0]) : null;

  let html = pageHead({ title, description, canonical, ogImage: firstCover, jsonLd: null });
  html += NAV_HTML;

  html += `
  <section class="page-hero">
    <p class="eyebrow">Prime Sash Windows</p>
    <h1>Case Studies &amp; Journal</h1>
    <p class="hero-subtitle">Real projects, workshop technology and news from our joinery. Every window handcrafted, every project documented.</p>
  </section>

  <div class="cs-index-wrap">
    <div class="cs-tabs">
      <button class="cs-tab active" data-filter="all" onclick="csFilter(this)">All</button>
      <button class="cs-tab" data-filter="case-study" onclick="csFilter(this)">Case Studies</button>
      <button class="cs-tab" data-filter="workshop" onclick="csFilter(this)">Workshop</button>
      <button class="cs-tab" data-filter="news" onclick="csFilter(this)">News</button>
    </div>
`;

  if (!posts.length) {
    html += `
    <p style="text-align:center;color:var(--muted);font-size:1rem;padding:3rem 0;">Our first case studies are on the way — check back soon.</p>
`;
  } else {
    html += `    <div class="cs-grid">\n`;
    for (const post of posts) {
      const cover = coverImage(post);
      const typeLabel = TYPE_LABELS[post.post_type] || 'Journal';
      const dateText = formatDate(post.published_at);
      const excerpt = post.overview
        ? escapeHtml(String(post.overview).replace(/\s+/g, ' ').trim().substring(0, 140)) + '&hellip;'
        : '';
      const url = '/case-study/' + encodeURIComponent(post.slug);
      html += `      <div class="cs-card" data-type="${escapeHtml(post.post_type)}">
        <a class="cs-card-link" href="${url}">
          ${cover
            ? `<img src="${escapeHtml(cover)}" alt="${escapeHtml(post.title)}" loading="lazy">`
            : `<div class="cs-card-noimg">Prime Sash Windows</div>`}
          <div class="cs-card-body">
            <span class="cs-card-meta">${escapeHtml(typeLabel)}${dateText ? ' &mdash; ' + escapeHtml(dateText) : ''}${post.location ? ' &mdash; ' + escapeHtml(post.location) : ''}</span>
            <h2>${escapeHtml(post.title)}</h2>
${excerpt ? `            <p class="cs-card-excerpt">${excerpt}</p>\n` : ''}          </div>
        </a>
      </div>\n`;
    }
    html += `    </div>\n`;
  }

  html += `
  </div>

  <section class="cta-band">
    <h2>Your Project Could Be Next</h2>
    <p>Design your bespoke timber windows and doors in 3D and get an instant estimate.</p>
    <a class="btn-cta" href="/online-estimate.html">Online Estimate &amp; 3D</a>
  </section>

  <script>
    function csFilter(btn){
      document.querySelectorAll('.cs-tab').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      var f = btn.getAttribute('data-filter');
      document.querySelectorAll('.cs-card').forEach(function(card){
        card.style.display = (f === 'all' || card.getAttribute('data-type') === f) ? '' : 'none';
      });
    }
  </script>
`;
  html += FOOTER_HTML;
  return html;
}

// ---------------------------------------------------------------------------
// 404 / error pages
// ---------------------------------------------------------------------------

function renderSimplePage(heading, message) {
  let html = pageHead({
    title: heading + ' | Prime Sash Windows',
    description: message,
    canonical: SITE_URL + '/case-studies',
    ogImage: null,
    jsonLd: null
  });
  html += NAV_HTML;
  html += `
  <section class="page-hero">
    <p class="eyebrow">Prime Sash Windows</p>
    <h1>${escapeHtml(heading)}</h1>
    <p class="hero-subtitle">${escapeHtml(message)}</p>
  </section>
  <div style="text-align:center;padding:3rem 5vw;">
    <a class="cs-back-link" href="/case-studies">&larr; All Case Studies &amp; Journal</a>
  </div>
`;
  html += FOOTER_HTML;
  return html;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  const slug = (req.query && req.query.slug ? String(req.query.slug) : '').trim();

  try {
    if (slug) {
      // --- Single post ---
      const rows = await sbGet(
        'case_studies?slug=eq.' + encodeURIComponent(slug) +
        '&status=eq.published&select=*,case_study_images(*)&limit=1'
      );
      if (!rows || rows.length === 0) {
        res.setHeader('Cache-Control', 's-maxage=60');
        return res.status(404).send(renderSimplePage('Not Found', 'This post does not exist or is not published yet.'));
      }
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=86400');
      return res.status(200).send(renderDetailPage(rows[0]));
    }

    // --- Index ---
    const posts = await sbGet(
      'case_studies?status=eq.published&select=*,case_study_images(*)' +
      '&order=display_order.asc,published_at.desc'
    );
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=86400');
    return res.status(200).send(renderIndexPage(posts || []));

  } catch (err) {
    console.error('case-study SSR error:', err);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).send(renderSimplePage('Something Went Wrong', 'Please try again in a moment.'));
  }
}
