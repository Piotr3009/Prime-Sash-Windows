// api/visit-stats.js — Vercel Serverless Function
// Returns visit statistics for admin dashboard
// Protected: requires valid Supabase auth token

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
        return res.status(500).json({ error: 'Server not configured' });
    }

    // Auth check — verify Supabase JWT
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];

    try {
        // Verify token with Supabase
        const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: {
                'apikey': SERVICE_KEY,
                'Authorization': `Bearer ${token}`
            }
        });
        if (!userRes.ok) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        // Run stats queries via Supabase SQL (RPC or direct)
        const stats = {};

        // Total visits
        const totalRes = await supabaseQuery(SUPABASE_URL, SERVICE_KEY,
            'page_visits', 'page,visited_at', '', 'head', true);
        stats.total = totalRes;

        // Today
        const today = new Date().toISOString().split('T')[0];
        const todayRes = await supabaseQuery(SUPABASE_URL, SERVICE_KEY,
            'page_visits', 'page,visited_at', `visited_at=gte.${today}T00:00:00`, 'head', true);
        stats.today = todayRes;

        // Last 7 days
        const d7 = new Date(Date.now() - 7 * 86400000).toISOString();
        const d7Res = await supabaseQuery(SUPABASE_URL, SERVICE_KEY,
            'page_visits', 'page,visited_at', `visited_at=gte.${d7}`, 'head', true);
        stats.last7d = d7Res;

        // Last 30 days
        const d30 = new Date(Date.now() - 30 * 86400000).toISOString();
        const d30Res = await supabaseQuery(SUPABASE_URL, SERVICE_KEY,
            'page_visits', 'page,visited_at', `visited_at=gte.${d30}`, 'head', true);
        stats.last30d = d30Res;

        // Unique visitors 30d (distinct ip_hash)
        const uniqueRes = await supabaseQueryUnique(SUPABASE_URL, SERVICE_KEY, d30);
        stats.unique30d = uniqueRes;

        // Unique visitors all time (distinct ip_hash)
        const uniqueAllRes = await supabaseQueryUnique(SUPABASE_URL, SERVICE_KEY, null);
        stats.uniqueAll = uniqueAllRes;

        // Unique visitors today (distinct ip_hash)
        const uniqueTodayRes = await supabaseQueryUnique(SUPABASE_URL, SERVICE_KEY, `${today}T00:00:00`);
        stats.uniqueToday = uniqueTodayRes;

        // Per-page breakdown — today
        const landingTodayRes = await supabaseQuery(SUPABASE_URL, SERVICE_KEY,
            'page_visits', 'page,visited_at', `visited_at=gte.${today}T00:00:00&page=eq.landing`, 'head', true);
        const estimateTodayRes = await supabaseQuery(SUPABASE_URL, SERVICE_KEY,
            'page_visits', 'page,visited_at', `visited_at=gte.${today}T00:00:00&page=eq.online-estimate`, 'head', true);
        stats.landingToday = landingTodayRes;
        stats.estimateToday = estimateTodayRes;

        // Per-page breakdown (landing vs online-estimate) — last 30d
        const landingRes = await supabaseQuery(SUPABASE_URL, SERVICE_KEY,
            'page_visits', 'page,visited_at', `visited_at=gte.${d30}&page=eq.landing`, 'head', true);
        const estimateRes = await supabaseQuery(SUPABASE_URL, SERVICE_KEY,
            'page_visits', 'page,visited_at', `visited_at=gte.${d30}&page=eq.online-estimate`, 'head', true);
        stats.landing30d = landingRes;
        stats.estimate30d = estimateRes;

        // All-time per-page
        const landingAllRes = await supabaseQuery(SUPABASE_URL, SERVICE_KEY,
            'page_visits', 'page,visited_at', 'page=eq.landing', 'head', true);
        const estimateAllRes = await supabaseQuery(SUPABASE_URL, SERVICE_KEY,
            'page_visits', 'page,visited_at', 'page=eq.online-estimate', 'head', true);
        stats.landingAll = landingAllRes;
        stats.estimateAll = estimateAllRes;

        // First visit date (tracking start)
        const firstRes = await fetch(
            `${SUPABASE_URL}/rest/v1/page_visits?select=visited_at&order=visited_at.asc&limit=1`,
            { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
        );
        if (firstRes.ok) {
            const firstData = await firstRes.json();
            stats.trackingSince = firstData.length > 0 ? firstData[0].visited_at : null;
        }

        return res.status(200).json(stats);

    } catch (err) {
        console.error('visit-stats error:', err);
        return res.status(500).json({ error: 'Internal error' });
    }
}

// Count rows using Prefer: count=exact header
async function supabaseQuery(url, key, table, select, filter, prefer, countOnly) {
    const filterStr = filter ? `&${filter}` : '';
    const response = await fetch(
        `${url}/rest/v1/${table}?select=${select}${filterStr}`,
        {
            method: 'HEAD',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`,
                'Prefer': 'count=exact'
            }
        }
    );
    const contentRange = response.headers.get('content-range');
    // Format: "0-N/total" or "*/total" or "*/0"
    if (contentRange) {
        const match = contentRange.match(/\/(\d+)/);
        return match ? parseInt(match[1]) : 0;
    }
    return 0;
}

// Count unique ip_hash using RPC or manual approach
// If since is null, count all time
async function supabaseQueryUnique(url, key, since) {
    // COUNT(DISTINCT ip_hash) computed server-side via RPC.
    // Avoids the PostgREST 1000-row cap that froze this counter (was stuck at 607).
    const response = await fetch(
        `${url}/rest/v1/rpc/count_unique_visitors`,
        {
            method: 'POST',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ since_ts: since || null })
        }
    );
    if (!response.ok) return 0;
    const data = await response.json();
    return typeof data === 'number' ? data : (parseInt(data) || 0);
}