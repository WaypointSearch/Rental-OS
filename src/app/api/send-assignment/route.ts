import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { Resend } from 'resend'

/**
 * POST /api/send-assignment
 * Body: { leadId, agentEmail, leadName, budget, moveIn, phone, source, area }
 * Respects agent's alert_preference (email / text / both)
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminProfile } = await supabase
    .from('agent_profiles').select('is_admin, full_name').eq('id', user.id).single()
  if (!adminProfile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { leadId, agentEmail, leadName, budget, moveIn, phone, source, area } = await req.json()
  if (!agentEmail || !leadId) return NextResponse.json({ error: 'agentEmail and leadId required' }, { status: 400 })

  // Look up agent profile for notification preference
  const { data: agentProfile } = await supabase
    .from('agent_profiles').select('alert_preference, alert_phone, full_name').eq('email', agentEmail).single()

  const pref = agentProfile?.alert_preference ?? 'email'
  const agentPhone = agentProfile?.alert_phone
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('RESEND_API_KEY not set')
    return NextResponse.json({ skipped: true })
  }

  const resend = new Resend(apiKey)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const pipelineUrl = `${siteUrl}/pipeline`
  const adminName = adminProfile.full_name ?? user.email?.split('@')[0] ?? 'Admin'
  const results: string[] = []

  // Send email notification (pref = 'email' or 'both')
  if (pref === 'email' || pref === 'both') {
    const { error } = await resend.emails.send({
      from: 'Sun Ocean Realty <noreply@rentalosnoreply.com>',
      to: agentEmail,
      subject: `New Lead: ${leadName ?? 'New Lead'} - ${area ?? ''}`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body{margin:0;padding:0;background:#0a0d14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
    .wrap{max-width:520px;margin:40px auto;padding:0 20px}
    .card{background:#161b22;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden}
    .hdr{background:linear-gradient(135deg,#e87c2a,#f5a623);padding:24px 28px}
    .hdr h1{margin:0;font-size:20px;font-weight:700;color:#fff}
    .hdr p{margin:5px 0 0;font-size:13px;color:rgba(255,255,255,.75)}
    .body{padding:24px 28px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px}
    .field{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:8px;padding:10px 14px}
    .field-l{font-size:10px;color:#6e7681;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px}
    .field-v{font-size:14px;color:#c9d1d9;font-weight:500}
    .btn{display:inline-block;background:linear-gradient(135deg,#e87c2a,#f5a623);color:#fff;text-decoration:none;padding:13px 28px;border-radius:10px;font-size:15px;font-weight:700;box-shadow:0 4px 16px rgba(245,166,35,.3)}
    .footer{padding:14px 28px 20px;border-top:1px solid rgba(255,255,255,.06)}
    .footer p{margin:0;font-size:11px;color:#6e7681}
  </style>
</head>
<body>
  <div class="wrap"><div class="card">
    <div class="hdr">
      <h1>New Lead Assigned</h1>
      <p>Assigned by ${adminName} · Sun Ocean Realty</p>
    </div>
    <div class="body">
      <p style="font-size:20px;font-weight:600;color:#f0f6fc;margin:0 0 16px">${leadName ?? 'New Lead'}</p>
      <div class="grid">
        ${phone ? `<div class="field"><div class="field-l">Phone</div><div class="field-v" style="color:#388bfd">${phone}</div></div>` : ''}
        ${budget ? `<div class="field"><div class="field-l">Budget</div><div class="field-v">${budget}</div></div>` : ''}
        ${moveIn ? `<div class="field"><div class="field-l">Move-in</div><div class="field-v">${moveIn}</div></div>` : ''}
        ${area ? `<div class="field"><div class="field-l">Area</div><div class="field-v">${area}</div></div>` : ''}
      </div>
      <a href="${pipelineUrl}" class="btn">Open Pipeline →</a>
    </div>
    <div class="footer"><p>Sun Ocean Realty · sunoceanrealty.com</p></div>
  </div></div>
</body>
</html>`.trim(),
    })
    if (error) console.error('Email error:', error)
    else results.push('email_sent')
  }

  // Send text notification (pref = 'text' or 'both')
  if ((pref === 'text' || pref === 'both') && agentPhone) {
    // Send short plain-text email to agent's email (shows as push notification)
    // For actual SMS, configure a carrier gateway email or Twilio
    const shortMsg = `New lead: ${leadName ?? '?'} | ${phone ?? ''} | ${area ?? ''} | ${budget ?? ''} | Move: ${moveIn ?? '?'} | Open: ${pipelineUrl}`
    const { error } = await resend.emails.send({
      from: 'Sun Ocean Realty <noreply@rentalosnoreply.com>',
      to: agentEmail, // Goes to their email push notification
      subject: `Lead: ${leadName ?? '?'} ${phone ?? ''} ${budget ?? ''}`,
      text: shortMsg,
    })
    if (error) console.error('Text-style alert error:', error)
    else results.push('text_alert_sent')
  }

  return NextResponse.json({ sent: results })
}
