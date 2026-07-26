// api/journal-sitemap.js — Vercel Serverless Function
// Dynamic XML sitemap for Case Studies / Journal.
// Route (see vercel.json rewrites): /sitemap-journal.xml -> this function.
// Registered in robots.txt alongside the static /sitemap.xml (which stays untouched).
// Lists /case-studies index + every published post, straight from Supabase —
// so a post published in the admin panel appears here automatically, no manual edits.

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rfelsfwjszjdtzuovlal.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmZWxzZndqc3pqZHR6dW92bGFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0Nzc1MTgsImV4cCI6MjA5MDA1MzUxOH0.Ut9EtffoU-L1g6IKiqcaVaoA2sEDoc0so821L1Uxn_A';

const SITE_URL = 'https://www.primesashwindows.co.uk';

// Keep lastmod as YYYY-MM-DD (works for both date and timestamp columns)
function toLastmod(value) {
  if (!value) return null;
  const s = String(value);
  const m = s.match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : null;
}

function urlEntry(loc, lastmod) {
  return '  <url>\n'
    + '    <loc>' + loc + '</loc>\n'
    + (lastmod ? '    <lastmod>' + lastmod + '</lastmod>\n' : '')
    + '  </url>\n';
}

export default async function handler(req, res) {
  try {
    const resp = await fetch(
      SUPABASE_URL + '/rest/v1/case_studies'
        + '?status=eq.published'
        + '&select=slug,published_at'
        + '&order=published_at.desc',
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: 'Bearer ' + SUPABASE_ANON_KEY
        }
      }
    );
    if (!resp.ok) throw new Error('Supabase error ' + resp.status);
    const posts = await resp.json();

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Index page — lastmod = date of the newest post (if any)
    const newest = (posts && posts.length) ? toLastmod(posts[0].published_at) : null;
    xml += urlEntry(SITE_URL + '/case-studies', newest);

    // One entry per published post
    for (const p of (posts || [])) {
      if (!p.slug) continue;
      xml += urlEntry(
        SITE_URL + '/case-study/' + encodeURIComponent(p.slug),
        toLastmod(p.published_at)
      );
    }

    xml += '</urlset>\n';

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).send(xml);

  } catch (err) {
    console.error('journal-sitemap error:', err);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).send('');
  }
}
