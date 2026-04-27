// api/send-email.js — Vercel Serverless Function
// Sends emails via Resend API
// Used by: contact form, appointment notifications, estimate notifications

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
        console.error('RESEND_API_KEY not set');
        return res.status(500).json({ error: 'Email service not configured' });
    }

    const { type, data } = req.body;

    if (!type || !data) {
        return res.status(400).json({ error: 'Missing type or data' });
    }

    const TO_EMAIL = 'info@primesashwindows.co.uk';
    const FROM_EMAIL = 'Prime Sash Windows <info@primesashwindows.co.uk>';

    let subject, html;

    try {
        switch (type) {
            case 'contact':
                if (!data.name || !data.email) {
                    return res.status(400).json({ error: 'Name and email required' });
                }
                subject = `New Contact Message — ${data.name}`;
                html = buildContactEmail(data);
                break;

            case 'appointment':
                if (!data.customer_name || !data.email) {
                    return res.status(400).json({ error: 'Customer name and email required' });
                }
                subject = `New Appointment Request — ${data.customer_name}`;
                html = buildAppointmentEmail(data);
                break;

            case 'estimate':
                subject = `New Estimate Submitted — ${data.customer_name || 'Customer'}`;
                html = buildEstimateEmail(data);
                break;

            default:
                return res.status(400).json({ error: 'Unknown email type' });
        }

        const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: FROM_EMAIL,
                to: [TO_EMAIL],
                reply_to: data.email || undefined,
                subject: subject,
                html: html
            })
        });

        const result = await resendResponse.json();

        if (!resendResponse.ok) {
            console.error('Resend error:', result);
            return res.status(500).json({ error: 'Failed to send email', details: result });
        }

        return res.status(200).json({ success: true, id: result.id });

    } catch (error) {
        console.error('Send email error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

// ── Email Templates ──

function buildContactEmail(data) {
    return `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
        <div style="background:#0A1628;padding:24px 32px;">
            <h1 style="margin:0;font-size:18px;font-weight:400;letter-spacing:.3em;color:rgba(255,255,255,.9);">PRIME SASH WINDOWS</h1>
        </div>
        <div style="padding:32px;background:#ffffff;border:1px solid #e8e4dc;">
            <h2 style="margin:0 0 20px;font-size:22px;color:#0A1628;">New Contact Message</h2>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
                <tr><td style="padding:8px 0;color:#84837C;width:100px;">Name</td><td style="padding:8px 0;font-weight:500;">${esc(data.name)}</td></tr>
                <tr><td style="padding:8px 0;color:#84837C;">Email</td><td style="padding:8px 0;"><a href="mailto:${esc(data.email)}" style="color:#0A1628;">${esc(data.email)}</a></td></tr>
                ${data.phone ? `<tr><td style="padding:8px 0;color:#84837C;">Phone</td><td style="padding:8px 0;"><a href="tel:${esc(data.phone)}" style="color:#0A1628;">${esc(data.phone)}</a></td></tr>` : ''}
            </table>
            ${data.message ? `
            <div style="margin-top:20px;padding:16px;background:#FAFAF8;border-left:3px solid #0A1628;font-size:14px;line-height:1.7;color:#4A4A4A;">
                ${esc(data.message).replace(/\n/g, '<br>')}
            </div>` : ''}
        </div>
        <div style="padding:16px 32px;font-size:11px;color:#84837C;text-align:center;">
            Sent from primesashwindows.co.uk contact form
        </div>
    </div>`;
}

function buildAppointmentEmail(data) {
    const slots = data.preferred_slots || [];
    const slotsHtml = slots.map(s => {
        const d = new Date(s.date);
        const dateStr = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
        return `<li style="padding:4px 0;">${dateStr} — ${s.time}</li>`;
    }).join('');

    return `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
        <div style="background:#0A1628;padding:24px 32px;">
            <h1 style="margin:0;font-size:18px;font-weight:400;letter-spacing:.3em;color:rgba(255,255,255,.9);">PRIME SASH WINDOWS</h1>
        </div>
        <div style="padding:32px;background:#ffffff;border:1px solid #e8e4dc;">
            <h2 style="margin:0 0 20px;font-size:22px;color:#0A1628;">New Appointment Request</h2>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
                <tr><td style="padding:8px 0;color:#84837C;width:100px;">Name</td><td style="padding:8px 0;font-weight:500;">${esc(data.customer_name)}</td></tr>
                <tr><td style="padding:8px 0;color:#84837C;">Email</td><td style="padding:8px 0;"><a href="mailto:${esc(data.email)}" style="color:#0A1628;">${esc(data.email)}</a></td></tr>
                ${data.phone ? `<tr><td style="padding:8px 0;color:#84837C;">Phone</td><td style="padding:8px 0;">${esc(data.phone)}</td></tr>` : ''}
            </table>
            ${slotsHtml ? `
            <div style="margin-top:20px;">
                <strong style="font-size:13px;color:#84837C;text-transform:uppercase;letter-spacing:.1em;">Preferred Slots</strong>
                <ul style="margin:8px 0;padding-left:20px;font-size:14px;line-height:1.8;">${slotsHtml}</ul>
            </div>` : ''}
            ${data.message ? `
            <div style="margin-top:16px;padding:16px;background:#FAFAF8;border-left:3px solid #0A1628;font-size:14px;line-height:1.7;color:#4A4A4A;">
                ${esc(data.message).replace(/\n/g, '<br>')}
            </div>` : ''}
        </div>
        <div style="padding:16px 32px;font-size:11px;color:#84837C;text-align:center;">
            Sent from primesashwindows.co.uk booking form
        </div>
    </div>`;
}

function buildEstimateEmail(data) {
    return `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
        <div style="background:#0A1628;padding:24px 32px;">
            <h1 style="margin:0;font-size:18px;font-weight:400;letter-spacing:.3em;color:rgba(255,255,255,.9);">PRIME SASH WINDOWS</h1>
        </div>
        <div style="padding:32px;background:#ffffff;border:1px solid #e8e4dc;">
            <h2 style="margin:0 0 20px;font-size:22px;color:#0A1628;">New Estimate Submitted</h2>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
                ${data.customer_name ? `<tr><td style="padding:8px 0;color:#84837C;width:120px;">Customer</td><td style="padding:8px 0;font-weight:500;">${esc(data.customer_name)}</td></tr>` : ''}
                ${data.email ? `<tr><td style="padding:8px 0;color:#84837C;">Email</td><td style="padding:8px 0;">${esc(data.email)}</td></tr>` : ''}
                ${data.estimate_number ? `<tr><td style="padding:8px 0;color:#84837C;">Estimate #</td><td style="padding:8px 0;font-weight:500;">${esc(data.estimate_number)}</td></tr>` : ''}
                ${data.total ? `<tr><td style="padding:8px 0;color:#84837C;">Total</td><td style="padding:8px 0;font-weight:500;font-size:16px;color:#0A1628;">£${esc(data.total)}</td></tr>` : ''}
                ${data.windows_count ? `<tr><td style="padding:8px 0;color:#84837C;">Windows</td><td style="padding:8px 0;">${esc(data.windows_count)}</td></tr>` : ''}
            </table>
        </div>
        <div style="padding:16px 32px;font-size:11px;color:#84837C;text-align:center;">
            Sent from primesashwindows.co.uk estimate system
        </div>
    </div>`;
}

function esc(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
