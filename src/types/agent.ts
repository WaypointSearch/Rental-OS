export interface DayAvailability {
  active: boolean
  start: string
  end: string
}

export interface Availability {
  monday: DayAvailability
  tuesday: DayAvailability
  wednesday: DayAvailability
  thursday: DayAvailability
  friday: DayAvailability
  saturday: DayAvailability
  sunday: DayAvailability
}

export const DAYS = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
] as const

export type DayKey = (typeof DAYS)[number]

export const DAY_LABELS: Record<DayKey, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
}

export interface AgentProfile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  alert_phone: string | null
  alert_preference: 'email' | 'text' | 'both'
  alert_carrier?: string | null
  is_admin: boolean
  availability: Availability
  created_at: string

  // Current production profile fields. Optional keeps older environments compatible.
  license_number?: string | null
  showing_areas?: string | null
  lead_preference?: 'showing_only' | 'full_service' | 'both' | string | null
  mls_affiliation?: 'beaches_mls' | 'miami_mls' | 'no_mls' | string | null
}

export const DEFAULT_AVAILABILITY: Availability = {
  monday: { active: false, start: '09:00', end: '17:00' },
  tuesday: { active: false, start: '09:00', end: '17:00' },
  wednesday: { active: false, start: '09:00', end: '17:00' },
  thursday: { active: false, start: '09:00', end: '17:00' },
  friday: { active: false, start: '09:00', end: '17:00' },
  saturday: { active: false, start: '09:00', end: '17:00' },
  sunday: { active: false, start: '09:00', end: '17:00' },
}
