import { useMemo, useState } from 'react'
import Wheel from './Wheel'

const pad = (n: number) => String(n).padStart(2, '0')
const toValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
const parse = (v: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v)
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null
}
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const dayDiff = (a: Date, b: Date) => Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86400000)

function dayLabel(d: Date, today: Date) {
  const diff = dayDiff(d, today)
  if (diff === 0) return 'Today'
  if (diff === -1) return 'Yesterday'
  if (diff === 1) return 'Tomorrow'
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1))
const MINUTES = Array.from({ length: 60 }, (_, i) => pad(i))
const AMPM = ['AM', 'PM']

/**
 * Tap-to-open wheel picker (date / hour / minute / AM-PM), iOS style.
 * Value is "YYYY-MM-DDTHH:mm" (local) or "" when `clearable` and unset.
 */
export default function DateTimeInput({
  value,
  onChange,
  clearable = false,
  className = ''
}: {
  value: string
  onChange: (value: string) => void
  clearable?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const today = new Date()
  const current = parse(value)
  const shown = current ?? today

  // Date wheel: 120 days back to 3 days ahead, widened to include the current value.
  const days = useMemo(() => {
    const t = new Date()
    const base = startOfDay(t)
    const lo = Math.min(-120, current ? dayDiff(current, t) - 1 : 0)
    const hi = Math.max(3, current ? dayDiff(current, t) + 1 : 0)
    return Array.from({ length: hi - lo + 1 }, (_, i) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + lo + i))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current ? dayDiff(current, today) : 0])

  const dayIndex = Math.max(0, days.findIndex((d) => dayDiff(d, shown) === 0))
  const h24 = shown.getHours()
  const hourIndex = (h24 % 12 === 0 ? 12 : h24 % 12) - 1
  const pmIndex = h24 >= 12 ? 1 : 0

  const emit = (day: Date, hourIdx: number, minute: number, pmIdx: number) => {
    const h12 = hourIdx + 1
    const hh = (h12 % 12) + pmIdx * 12
    onChange(toValue(new Date(day.getFullYear(), day.getMonth(), day.getDate(), hh, minute)))
  }

  const summary = current
    ? `${dayLabel(current, today)}, ${current.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
    : 'Not set'

  const toggle = () => {
    if (!open && !current) onChange(toValue(new Date()))
    setOpen(!open)
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <button type="button" onClick={toggle} aria-expanded={open} className="input !text-base flex-1 text-left flex items-center justify-between">
          <span className={current ? '' : 'text-parchment-300'}>{summary}</span>
          <span className="text-parchment-300 text-sm">{open ? 'Done' : 'Edit'}</span>
        </button>
        {clearable && current && !open && (
          <button type="button" className="btn-ghost !px-3" onClick={() => onChange('')} aria-label="Clear">
            ×
          </button>
        )}
      </div>

      {open && (
        <div className="relative mt-2 rounded-xl bg-night-950 border border-night-700 overflow-hidden">
          <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-10 rounded-lg bg-night-700/60 pointer-events-none" />
          <div className="relative flex">
            <Wheel className="flex-[3]" label="Date" items={days.map((d) => dayLabel(d, today))} index={dayIndex} onIndex={(i) => emit(days[i], hourIndex, shown.getMinutes(), pmIndex)} />
            <Wheel className="flex-1" label="Hour" items={HOURS} index={hourIndex} onIndex={(i) => emit(days[dayIndex], i, shown.getMinutes(), pmIndex)} />
            <Wheel className="flex-1" label="Minute" items={MINUTES} index={shown.getMinutes()} onIndex={(i) => emit(days[dayIndex], hourIndex, i, pmIndex)} />
            <Wheel className="flex-1" label="AM or PM" items={AMPM} index={pmIndex} onIndex={(i) => emit(days[dayIndex], hourIndex, shown.getMinutes(), i)} />
          </div>
          <button type="button" className="w-full py-2 text-sm text-parchment-100 border-t border-night-700" onClick={() => setOpen(false)}>
            Done
          </button>
        </div>
      )}
    </div>
  )
}
