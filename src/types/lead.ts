export interface Note {
  ts: string
  by: string
  text: string
}

export interface LeadDocument {
  name: string
  url: string
  type: string
  uploaded_at: string
  uploaded_by: string
}

export interface Lead {
  id: string
  source: string | null
  name: string | null
  phone: string | null
  area: string | null
  specific_cities: string[] | null
  bedrooms: string | null
  bathrooms: string | null
  budget: string | null
  move_in: string | null
  pets: string | null
  credit: string | null
  income: string | null
  mls_codes: string | null
  urls: string | null
  cl_url: string | null
  criminal_eviction_status: string | null
  notes_crm: string | null
  cosigner_info: string | null
  documents: LeadDocument[]
  stage: string
  assigned_agent: string
  notes: Note[]
  created_at: string
}

export const STAGES = [
  'Waiting for contact',
  'Made Contact',
  'Set showings',
  'Showings complete',
  'Completed Rentspree',
  'Offer Sent',
  'Offer Approved',
  'HOA Approved',
  'Move in / Deposit',
] as const

export type Stage = (typeof STAGES)[number]

export const STAGE_COLORS: Record<string, string> = {
  'Waiting for contact':  '#6e7681',
  'Made Contact':         '#388bfd',
  'Set showings':         '#a371f7',
  'Showings complete':    '#d29922',
  'Completed Rentspree':  '#e3b341',
  'Offer Sent':           '#f0883e',
  'Offer Approved':       '#3fb950',
  'HOA Approved':         '#1f883d',
  'Move in / Deposit':    '#0d6e29',
}

// Parse a budget string like "$1,400/mo" → 1400
export function parseBudget(budget: string | null): number {
  if (!budget) return 0
  const digits = budget.replace(/[$,]/g, '').match(/\d+/)
  return digits ? parseInt(digits[0], 10) : 0
}

// Format number as currency shorthand
export function formatCommission(n: number): string {
  if (n === 0) return '$0'
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${n}`
}
