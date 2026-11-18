import { useState } from 'react'
import { todayISO } from '../lib/age'

const pad = (n: number) => String(n).padStart(2, '0')
const toISO = (y: number, m0: number, d: number) => `${y}-${pad(m0 + 1)}-${pad(d)}`
const parts = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m0: m - 1, d }
}
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/**
 * Tap-to-open calendar date picker with a Today shortcut.
 * Value is "YYYY-MM-DD"; days after today are not selectable.
 */
export default function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const today = todayISO()
  const [open, setOpen] = useState(false)
  const start = parts(value || today)
  const [view, setView] = useState({ y: start.y, m0: start.m0 })

  const summary = value
    ? (() => {
        const { y, m0, d } = parts(value)
        return new Date(y, m0, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
      })()
    : 'Pick a date'

  const shift = (delta: number) => {
    const d = new Date(view.y, view.m0 + delta, 1)
    setView({ y: d.getFullYear(), m0: d.getMonth() })
  }

  const toggle = () => {
    if (!open) {
      const p = parts(value || today)
      setView({ y: p.y, m0: p.m0 })
    }
    setOpen(!open)
  }

  const pick = (iso: string) => {
    onChange(iso)
    setOpen(false)
  }

  const firstDow = new Date(view.y, view.m0, 1).getDay()
  const daysInMonth = new Date(view.y, view.m0 + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  const t = parts(today)
  const atCurrentMonth = view.y === t.y && view.m0 === t.m0
  const monthLabel = new Date(view.y, view.m0, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  return (
    <div>
      <div className="flex gap-2">
        <button type="button" onClick={toggle} aria-expanded={open} className="input !text-base min-w-0 flex-1 text-left flex items-center justify-between gap-3">
          <span className={value ? '' : 'text-parchment-300'}>{summary}</span>
          <span className="text-parchment-300 text-sm">{open ? 'Close' : 'Edit'}</span>
        </button>
        <button type="button" className="btn-secondary shrink-0" onClick={() => pick(today)}>
          Today
        </button>
      </div>

      {open && (
        <div className="mt-2 rounded-xl bg-night-950 border border-night-700 p-3">
          <div className="flex items-center justify-between mb-2">
            <button type="button" className="btn-ghost !px-4 !py-2 text-xl" onClick={() => shift(-1)} aria-label="Previous month">
              ‹
            </button>
            <p className="text-parchment-100 font-medium">{monthLabel}</p>
            <button type="button" className="btn-ghost !px-4 !py-2 text-xl disabled:opacity-30" onClick={() => shift(1)} disabled={atCurrentMonth} aria-label="Next month">
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 text-center text-xs text-parchment-300 mb-1">
            {DOW.map((d, i) => (
              <span key={i} className="py-1">
                {d}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((d, i) => {
              if (d === null) return <span key={i} />
              const iso = toISO(view.y, view.m0, d)
              const selected = iso === value
              const future = iso > today
              const isToday = iso === today
              return (
                <button
                  key={i}
                  type="button"
                  disabled={future}
                  aria-label={iso}
                  aria-pressed={selected}
                  onClick={() => pick(iso)}
                  className={`mx-auto h-10 w-10 rounded-full text-base transition-colors ${
                    selected
                      ? 'bg-dusk-500 text-night-950 font-semibold'
                      : future
                        ? 'text-parchment-300 opacity-30'
                        : `text-parchment-100 active:bg-night-700 ${isToday ? 'border border-dusk-500' : ''}`
                  }`}
                >
                  {d}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
