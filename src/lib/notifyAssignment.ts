import { Resend } from 'resend'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ASSIGNMENT_TYPES, AssignmentType, Lead } from '@/types/lead'

/**
 * Emails an agent a branded summary when a lead is assigned to them. Used by the
 * broker's Assign screen / New Lead form (/api/send-assignment) and the AI
 * dispatch API (/api/agent/*). Text messages are sent by the broker's AI agent
 * from its own phone system, so none are sent from here.
 *
 * Env: RESEND_API_KEY (required), NEXT_PUBLIC_SITE_URL (links back to the CRM).
 */

const FROM_EMAIL = process.env.ASSIGNMENT_FROM_EMAIL ?? 'Sun Ocean Realty <noreply@rentalosnoreply.com>'

export type ChannelResult = 'sent' | 'skipped' | 'failed'
export interface NotifyResult { email: ChannelResult; detail: string[] }

interface AgentContact {
  email: string
  full_name: string | null
  alert_phone: string | null
}

function esc(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string
  ))
}

function digits(value: string | null | undefined) {
  return String(value ?? '').replace(/\D/g, '')
}

function firstName(agent: AgentContact) {
  return (agent.full_name?.trim().split(/\s+/)[0]) || agent.email.split('@')[0]
}

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
}

const NEXT_STEP: Record<AssignmentType, string> = {
  full: 'Reach out within the hour, qualify the tenant, and set showings. You own this lead through application, offer and move-in.',
  showing: 'Reach out within the hour to schedule the showing. After the showing, add a note in Rental OS; the brokerage takes it from there.',
}

export function renderAssignmentEmail(lead: Lead, agent: AgentContact, type: AssignmentType | null, assignedBy: string) {
  const info = type ? ASSIGNMENT_TYPES[type] : null
  const url = `${siteUrl()}/pipeline`
  const beds = [lead.bedrooms && `${lead.bedrooms} bd`, lead.bathrooms && `${lead.bathrooms} ba`].filter(Boolean).join(' · ')
  const rows: [string, string | null | undefined][] = [
    ['Phone', lead.phone],
    ['Budget', lead.budget],
    ['Bedrooms', beds || null],
    ['Move-in', lead.move_in],
    ['Area', lead.specific_cities?.length ? lead.specific_cities.join(', ') : lead.area],
    ['Pets', lead.pets],
    ['Credit', lead.credit],
    ['Income', lead.income],
  ]
  const filled = rows.filter(([, v]) => v && String(v).trim())
  const cell = ([label, value]: [string, string | null | undefined]) => `
    <td valign="top" width="50%" style="padding:10px 0 10px 0">
      <div style="font:600 10px/1.4 Arial,Helvetica,sans-serif;letter-spacing:1.6px;text-transform:uppercase;color:#8a7a55">${esc(label)}</div>
      <div style="font:600 15px/1.45 Arial,Helvetica,sans-serif;color:#0b1a2e;padding-top:3px">${label === 'Phone'
        ? `<a href="tel:${esc(digits(value))}" style="color:#0b1a2e;text-decoration:none">${esc(value)}</a>`
        : esc(value)}</div>
    </td>`
  const pairs: string[] = []
  for (let i = 0; i < filled.length; i += 2) {
    pairs.push(`<tr>${cell(filled[i])}${filled[i + 1] ? cell(filled[i + 1]) : '<td></td>'}</tr>`)
  }

  const subject = `${info ? `${info.label}` : 'New lead'}: ${lead.name ?? 'New tenant'}${lead.area ? ` · ${lead.area}` : ''}`
  const preheader = `${lead.name ?? 'A new tenant'}${lead.budget ? `, ${lead.budget}` : ''}${info ? ` · ${info.label}, ${info.pay}` : ''}`

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f3eee4">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3eee4"><tr><td align="center" style="padding:32px 14px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:6px;overflow:hidden;box-shadow:0 8px 30px rgba(11,26,46,.08)">
    <tr><td style="background:#0b1a2e;padding:30px 36px 26px" align="left">
      <div style="font:400 24px/1 Georgia,'Times New Roman',serif;letter-spacing:5px;color:#ffffff">SUN OCEAN</div>
      <div style="font:600 10px/1 Arial,Helvetica,sans-serif;letter-spacing:7px;color:#c4a24e;padding-top:7px">R E A L T Y</div>
    </td></tr>
    <tr><td style="height:3px;background:#c4a24e;font-size:0;line-height:0">&nbsp;</td></tr>
    <tr><td style="padding:34px 36px 8px">
      <div style="font:600 11px/1.4 Arial,Helvetica,sans-serif;letter-spacing:2.4px;text-transform:uppercase;color:#a8883a">New assignment for ${esc(firstName(agent))}</div>
      <h1 style="margin:10px 0 0;font:400 32px/1.15 Georgia,'Times New Roman',serif;color:#0b1a2e">${esc(lead.name ?? 'New tenant lead')}</h1>
    </td></tr>
    ${info ? `<tr><td style="padding:18px 36px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf6ec;border:1px solid #e8dcc0;border-left:4px solid #c4a24e;border-radius:4px"><tr><td style="padding:14px 18px">
        <div style="font:700 13px/1.4 Arial,Helvetica,sans-serif;color:#0b1a2e;letter-spacing:.3px">${esc(info.label.toUpperCase())} &nbsp;·&nbsp; <span style="color:#a8883a">${esc(info.pay)}</span></div>
        <div style="font:400 14px/1.55 Arial,Helvetica,sans-serif;color:#46556a;padding-top:4px">${esc(info.detail)}</div>
      </td></tr></table>
    </td></tr>` : ''}
    <tr><td style="padding:20px 36px 4px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee6d6;border-bottom:1px solid #eee6d6">${pairs.join('')}</table>
    </td></tr>
    ${lead.notes_crm ? `<tr><td style="padding:18px 36px 0">
      <div style="font:600 10px/1.4 Arial,Helvetica,sans-serif;letter-spacing:1.6px;text-transform:uppercase;color:#8a7a55">Summary</div>
      <div style="font:400 14px/1.6 Arial,Helvetica,sans-serif;color:#2d3a4a;padding-top:5px;white-space:pre-line">${esc(lead.notes_crm)}</div>
    </td></tr>` : ''}
    <tr><td style="padding:22px 36px 0">
      <div style="font:600 10px/1.4 Arial,Helvetica,sans-serif;letter-spacing:1.6px;text-transform:uppercase;color:#8a7a55">Your next step</div>
      <div style="font:400 14px/1.6 Arial,Helvetica,sans-serif;color:#2d3a4a;padding-top:5px">${esc(NEXT_STEP[type ?? 'full'])}</div>
    </td></tr>
    <tr><td style="padding:28px 36px 34px" align="left">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="background:#0b1a2e;border-radius:3px"><a href="${esc(url)}" style="display:inline-block;white-space:nowrap;padding:15px 22px;font:700 13px/1 Arial,Helvetica,sans-serif;letter-spacing:1.8px;text-transform:uppercase;color:#ffffff;text-decoration:none">Open in Rental OS</a></td>
        ${lead.phone ? `<td width="10"></td><td style="border:1.5px solid #c4a24e;border-radius:3px"><a href="tel:${esc(digits(lead.phone))}" style="display:inline-block;white-space:nowrap;padding:13.5px 18px;font:700 13px/1 Arial,Helvetica,sans-serif;letter-spacing:1.8px;text-transform:uppercase;color:#a8883a;text-decoration:none">Call now</a></td>` : ''}
      </tr></table>
    </td></tr>
    <tr><td style="background:#faf8f4;border-top:1px solid #eee6d6;padding:20px 36px">
      <div style="font:400 12px/1.6 Arial,Helvetica,sans-serif;color:#8792a2">Assigned by ${esc(assignedBy)} · Sun Ocean Realty LLC, Licensed Florida Real Estate Brokerage.<br>This lead is confidential; please don't forward tenant details outside the brokerage.</div>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`

  const text = [
    `SUN OCEAN REALTY: New assignment for ${firstName(agent)}`,
    '',
    lead.name ?? 'New tenant lead',
    info ? `${info.label} (${info.pay}): ${info.detail}` : '',
    '',
    ...filled.map(([label, value]) => `${label}: ${value}`),
    lead.notes_crm ? `\nSummary: ${lead.notes_crm}` : '',
    '',
    `Next step: ${NEXT_STEP[type ?? 'full']}`,
    `Open in Rental OS: ${url}`,
  ].filter(line => line !== undefined).join('\n')

  return { subject, html, text }
}

export async function notifyAgentOfAssignment({
  supabase, lead, agentEmail, assignmentType, assignedBy,
}: {
  supabase: SupabaseClient
  lead: Lead
  agentEmail: string
  assignmentType: AssignmentType | null
  assignedBy: string
}): Promise<NotifyResult> {
  const result: NotifyResult = { email: 'skipped', detail: [] }

  const { data: profile } = await supabase
    .from('agent_profiles')
    .select('email, full_name, alert_phone')
    .eq('email', agentEmail)
    .maybeSingle()
  const agent: AgentContact = profile ?? { email: agentEmail, full_name: null, alert_phone: null }

  const apiKey = process.env.RESEND_API_KEY
  const resend = apiKey ? new Resend(apiKey) : null

  // ── Email ──
  if (!resend) {
    result.detail.push('email skipped: RESEND_API_KEY not set')
  } else {
    const { subject, html, text } = renderAssignmentEmail(lead, agent, assignmentType, assignedBy)
    const { error } = await resend.emails.send({ from: FROM_EMAIL, to: agent.email, subject, html, text })
    if (error) { result.email = 'failed'; result.detail.push(`email failed: ${error.message}`) }
    else result.email = 'sent'
  }

  return result
}
