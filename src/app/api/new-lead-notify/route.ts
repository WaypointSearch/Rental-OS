import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

/**
 * POST /api/new-lead-notify
 *
 * Called by a Supabase Database Webhook whenever a new row is
 * inserted into the `leads` table. Sends the admin an email
 * with the lead's full criteria and a "Open Dispatch" link.
 *
 * Supabase Webhook setup (Dashboard → Database → Webhooks):
 *   Name:    new-lead-admin-notify
 *   Table:   leads
 *   Events:  INSERT
 *   URL:     https://your-domain.vercel.app/api/new-lead-notify
 *   Headers: { "x-webhook-secret": "<WEBHOOK_SECRET>" }
 *
 * Required env vars:
 *   RESEND_API_KEY          — Resend API key
 *   WEBHOOK_SECRET          — random string you set in the webhook header
 *   ADMIN_EMAIL             — your email address
 *   NEXT_PUBLIC_SITE_URL    — https://your-domain.vercel.app
 */
export async function POST(req: NextRequest) {
  // ── Verify the webhook secret ──────────────────────────────────────────
  const secret = req.headers.get('x-webhook-secret')
  if (process.env.WEBHOOK_SECRET && secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()

  // Supabase sends: { type: 'INSERT', table: 'leads', record: {...}, ... }
  const lead = body.record ?? body

  // Only notify on new unassigned leads (skip re-upserts from GAS)
  if (
    body.type && body.type !== 'INSERT' ||
    (lead.assigned_agent && lead.assigned_agent !== 'Unassigned')
  ) {
    return NextResponse.json({ skipped: true })
  }

  const apiKey     = process.env.RESEND_API_KEY
  const adminEmail = process.env.ADMIN_EMAIL
  const siteUrl    = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  if (!apiKey || !adminEmail) {
    console.warn('new-lead-notify: RESEND_API_KEY or ADMIN_EMAIL not set — skipping')
    return NextResponse.json({ skipped: true })
  }

  const resend     = new Resend(apiKey)
  const dispatchUrl = `${siteUrl}/pipeline`
  const leadName   = lead.name ?? 'Unknown'
  const source     = lead.source ?? 'Unknown'
  const isFb       = source.toLowerCase().includes('facebook')

  const rows = [
    ['Phone',   lead.phone],
    ['Area',    lead.area || (lead.specific_cities?.join(', '))],
    ['Budget',  lead.budget],
    ['Move-in', lead.move_in],
    ['Beds',    lead.bedrooms ? `${lead.bedrooms} bd` : null],
    ['Pets',    lead.pets],
    ['Credit',  lead.credit],
    ['Income',  lead.income],
    ['MLS',     lead.mls_codes],
  ].filter(([, v]) => v)

  const tableRows = rows.map(([label, value]) => `
    <tr>
      <td style="padding:6px 14px 6px 0;font-size:12px;color:#6e7681;white-space:nowrap;vertical-align:top;">${label}</td>
      <td style="padding:6px 0;font-size:13px;color:#c9d1d9;font-weight:500;">${value}</td>
    </tr>`).join('')

  const { error } = await resend.emails.send({
    from: 'Sun Ocean Realty <noreply@rentalosnoreply.com>', // update to your verified domain
    to:   adminEmail,
    subject: `⚡ New ${isFb ? 'FB' : 'GV'} Lead: ${leadName}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body{margin:0;padding:0;background:#0a0d14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
    .wrap{max-width:520px;margin:40px auto;padding:0 20px}
    .card{background:#161b22;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden}
    .hdr{padding:22px 28px;background:linear-gradient(135deg,${isFb ? '#1a3a6e,#1877f2' : '#1a3a2e,#34a853'})}
    .hdr-badge{display:inline-block;background:rgba(255,255,255,0.2);color:#fff;font-size:11px;font-weight:700;letter-spacing:.5px;padding:3px 10px;border-radius:20px;margin-bottom:10px}
    .hdr h1{margin:0;font-size:22px;font-weight:700;color:#fff;letter-spacing:-.4px}
    .hdr p{margin:5px 0 0;font-size:13px;color:rgba(255,255,255,.7)}
    .body{padding:24px 28px}
    .criteria{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:14px 16px;margin-bottom:20px}
    .btn{display:inline-block;background:linear-gradient(135deg,#e87c2a,#f5a623);color:#fff;text-decoration:none;padding:13px 28px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:-.2px;box-shadow:0 4px 16px rgba(245,166,35,.3)}
    .footer{padding:14px 28px 20px;border-top:1px solid rgba(255,255,255,.06)}
    .footer p{margin:0;font-size:11px;color:#6e7681}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="hdr">
        <div class="hdr-badge">${isFb ? 'FACEBOOK' : 'GOOGLE VOICE'}</div>
        <h1>${leadName}</h1>
        <p>New unassigned lead · Sun Ocean Realty</p>
      </div>
      <div class="body">
        <div class="criteria">
          <table style="border-collapse:collapse;width:100%">
            ${tableRows}
          </table>
        </div>
        <p style="font-size:13px;color:#8b949e;margin:0 0 18px;line-height:1.6">
          This lead is <strong style="color:#e3b341">unassigned</strong>. Open the pipeline to assign it to an available agent.
        </p>
        <a href="${dispatchUrl}" class="btn">⚡ Open Pipeline →</a>
      </div>
      <div class="footer">
        <p>Sun Ocean Realty · sunoceanrealty.com</p>
      </div>
    </div>
  </div>
</body>
</html>`.trim(),
  })

  if (error) {
    console.error('new-lead-notify resend error:', error)
    return NextResponse.json({ error: 'Email failed' }, { status: 500 })
  }

  return NextResponse.json({ sent: true, to: adminEmail })
}
