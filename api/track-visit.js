// api/track-visit.js — Vercel Serverless Function
// Tracks page visits: hashes IP (GDPR), rate limits, inserts to page_visits
// Uses service_role key (bypasses RLS)

import { createHash } from 'crypto';

const SALT = 'psw-visit-2026';
const rateLimitMap = new Map();
const RATE_LIMIT_MS = 10_000; // 1 request per IP per 10 seconds

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(200).end(); // silent fail

    try {
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!SUPABASE_URL || !SERVICE_KEY) {
            console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
            return res.status(200).json({ ok: true }); // silent fail
        }

        // Get IP
        const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
            .split(',')[0].trim();

        // Rate limit (in-memory, resets on cold start — acceptable)
        const now = Date.now();
        const lastVisit = rateLimitMap.get(ip);
        if (lastVisit && (now - lastVisit) < RATE_LIMIT_MS) {
            return res.status(200).json({ ok: true }); // rate limited, silent
        }
        rateLimitMap.set(ip, now);

        // Clean old entries every 1000 requests
        if (rateLimitMap.size > 1000) {
            for (const [key, time] of rateLimitMap) {
                if (now - time > 60_000) rateLimitMap.delete(key);
            }
        }

        // Hash IP (GDPR — no raw IP stored)
        const ipHash = createHash('sha256').update(SALT + ip).digest('hex');

        // Page from body
        const { page } = req.body || {};
        const safePage = ['landing', 'online-estimate'].includes(page) ? page : 'landing';

        // Insert
        const response = await fetch(`${SUPABASE_URL}/rest/v1/page_visits`, {
            method: 'POST',
            headers: {
                'apikey': SERVICE_KEY,
                'Authorization': `Bearer ${SERVICE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
                page: safePage,
                ip_hash: ipHash,
                user_agent: (req.headers['user-agent'] || '').substring(0, 500),
                referrer: (req.headers['referer'] || '').substring(0, 500)
            })
        });

        if (!response.ok) {
            console.error('Supabase insert error:', response.status, await response.text());
        }
    } catch (err) {
        console.error('track-visit error:', err);
    }

    // Always 200 — fire & forget, never block UX
    return res.status(200).json({ ok: true });
}
