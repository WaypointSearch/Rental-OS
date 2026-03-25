'use client'

import { useState, useRef, useEffect } from 'react'
import { SOUTH_FLORIDA_CITIES, CityOption } from '@/lib/cities'

interface CityAutocompleteProps {
  value: string[]
  onChange: (cities: string[]) => void
}

const COUNTY_COLORS: Record<CityOption['county'], string> = {
  'Miami-Dade': '#388bfd',
  'Broward':    '#a371f7',
  'Palm Beach': '#3fb950',
}

export function CityAutocomplete({ value, onChange }: CityAutocompleteProps) {
  const [query, setQuery]       = useState('')
  const [open, setOpen]         = useState(false)
  const inputRef                = useRef<HTMLInputElement>(null)
  const containerRef            = useRef<HTMLDivElement>(null)

  const selected = new Set(value)

  const filtered = query.trim()
    ? SOUTH_FLORIDA_CITIES.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) &&
          !selected.has(c.name)
      ).slice(0, 18)
    : SOUTH_FLORIDA_CITIES.filter((c) => !selected.has(c.name)).slice(0, 24)

  // Group results by county
  const grouped = filtered.reduce<Record<string, CityOption[]>>((acc, city) => {
    acc[city.county] = acc[city.county] ?? []
    acc[city.county].push(city)
    return acc
  }, {})

  function addCity(name: string) {
    if (!selected.has(name)) onChange([...value, name])
    setQuery('')
    inputRef.current?.focus()
  }

  function removeCity(name: string) {
    onChange(value.filter((c) => c !== name))
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Tags + input */}
      <div
        onClick={() => { setOpen(true); inputRef.current?.focus() }}
        style={{
          minHeight: 38,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8,
          padding: '5px 8px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 5,
          cursor: 'text',
          transition: 'border-color .15s',
        }}
        onFocus={() => setOpen(true)}
      >
        {value.map((city) => {
          const county = SOUTH_FLORIDA_CITIES.find((c) => c.name === city)?.county
          const color = county ? COUNTY_COLORS[county] : '#6e7681'
          return (
            <span
              key={city}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: `${color}20`,
                border: `0.5px solid ${color}50`,
                borderRadius: 6,
                padding: '2px 7px 2px 8px',
                fontSize: 11,
                color: color,
                fontWeight: 500,
              }}
            >
              {city}
              <button
                onClick={(e) => { e.stopPropagation(); removeCity(city) }}
                style={{
                  background: 'none',
                  border: 'none',
                  color,
                  cursor: 'pointer',
                  padding: '0 0 0 2px',
                  fontSize: 13,
                  lineHeight: 1,
                  opacity: 0.7,
                  fontFamily: 'inherit',
                }}
              >
                ×
              </button>
            </span>
          )
        })}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={value.length === 0 ? 'Search cities…' : ''}
          style={{
            background: 'none',
            border: 'none',
            outline: 'none',
            color: '#e6edf3',
            fontSize: 12,
            minWidth: 100,
            flex: 1,
            fontFamily: 'inherit',
            padding: '2px 2px',
          }}
        />
      </div>

      {/* Dropdown */}
      {open && Object.keys(grouped).length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            background: 'rgba(13,16,28,0.97)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10,
            padding: '6px 0',
            maxHeight: 260,
            overflowY: 'auto',
            zIndex: 100,
            boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
          }}
        >
          {Object.entries(grouped).map(([county, cities]) => (
            <div key={county}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: COUNTY_COLORS[county as CityOption['county']],
                  padding: '5px 12px 3px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.8px',
                }}
              >
                {county}
              </div>
              {cities.map((city) => (
                <button
                  key={city.name}
                  onClick={() => addCity(city.name)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    padding: '6px 12px 6px 20px',
                    fontSize: 13,
                    color: '#c9d1d9',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'background .1s',
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLButtonElement).style.background =
                      'rgba(255,255,255,0.06)')
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLButtonElement).style.background = 'none')
                  }
                >
                  {city.name}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
