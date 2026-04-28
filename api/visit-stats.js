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

        // Per-page breakdown (landing vs online-estimate) — last 30d
        const landingRes = await supabaseQuery(SUPABASE_URL, SERVICE_KEY,
            'page_visits', 'page,visited_at', `visited_at=gte.${d30}&page=eq.landing`, 'head', true);
        const estimateRes = await supabaseQuery(SUPABASE_URL, SERVICE_KEY,
            'page_visits', 'page,visited_at', `visited_at=gte.${d30}&page=eq.online-estimate`, 'head', true);
        stats.landing30d = landingRes;
        stats.estimate30d = estimateRes;

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

// Count unique ip_hash in last 30d using RPC or manual approach
async function supabaseQueryUnique(url, key, since) {
    // Use PostgREST select with distinct — get all unique hashes then count
    // More efficient: use RPC if available, but for now fetch ip_hash list
    const response = await fetch(
        `${url}/rest/v1/page_visits?select=ip_hash&visited_at=gte.${since}`,
        {
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`
            }
        }
    );
    if (!response.ok) return 0;
    const data = await response.json();
    const unique = new Set(data.map(r => r.ip_hash));
    return unique.size;
}
