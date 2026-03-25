import { Lead } from '@/types/lead'

/**
 * Converts the leads array to a CSV string and triggers a browser download.
 * All 12 original GAS columns are included, plus stage, agent, and note count.
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

  function escape(val: string | null | undefined): string {
    if (val == null) return ''
    const s = String(val).replace(/"/g, '""')
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s}"`
      : s
  }

  const rows = leads.map((l) => {
    const latestNote =
      l.notes.length > 0 ? `${l.notes[0].ts} – ${l.notes[0].text}` : ''

    return [
      l.id,
      l.source,
      l.name,
      l.phone,
      l.area,
      l.bedrooms,
      l.budget,
      l.move_in,
      l.pets,
      l.credit,
      l.income,
      l.mls_codes,
      l.urls,
      l.cl_url,
      l.stage,
      l.assigned_agent,
      l.notes.length,
      latestNote,
      l.created_at,
    ]
      .map(escape)
      .join(',')
  })

  const csv = [HEADERS.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()

  URL.revokeObjectURL(url)
}

/**
 * Filters leads to a specific stage and exports just that column.
 */
export function exportStageToCSV(leads: Lead[], stage: string) {
  const stageName = stage.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
  exportLeadsToCSV(
    leads.filter((l) => l.stage === stage),
    `sun-ocean-${stageName}.csv`
  )
}
