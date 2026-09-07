import { Lead } from '@/types/lead'

/**
 * Converts the leads array to a CSV string and triggers a browser download.
 * All original GAS columns are included, plus stage, agent, and note count.
 */
export function exportLeadsToCSV(leads: Lead[], filename = 'sun-ocean-leads.csv') {
  const HEADERS = [
    'ID',
    'Source',
    'Name',
    'Phone',
    'Area',
    'Bedrooms',
    'Budget',
    'Move-in',
    'Pets',
    'Credit',
    'Income',
    'MLS Codes',
    'Listing URLs',
    'Craigslist URL',
    'Stage',
    'Assigned Agent',
    'Notes Count',
    'Latest Note',
    'Created At',
  ]

  function escape(val: string | number | null | undefined): string {
    if (val == null) return ''
    const s = String(val).replace(/"/g, '""')
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s}"`
      : s
  }

  const rows = leads.map((lead) => {
    const notes = lead.notes ?? []
    const latestNote = notes.length > 0 ? `${notes[0].ts} – ${notes[0].text}` : ''

    return [
      lead.id,
      lead.source,
      lead.name,
      lead.phone,
      lead.area,
      lead.bedrooms,
      lead.budget,
      lead.move_in,
      lead.pets,
      lead.credit,
      lead.income,
      lead.mls_codes,
      lead.urls,
      lead.cl_url,
      lead.stage,
      lead.assigned_agent,
      notes.length,
      latestNote,
      lead.created_at,
    ]
      .map(escape)
      .join(',')
  })

  const csv = [HEADERS.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()

  URL.revokeObjectURL(url)
}

export function exportStageToCSV(leads: Lead[], stage: string) {
  const stageName = stage.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
  exportLeadsToCSV(
    leads.filter((lead) => lead.stage === stage),
    `sun-ocean-${stageName}.csv`
  )
}
