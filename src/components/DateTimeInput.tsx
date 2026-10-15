import { useEffect, useRef, useState } from 'react'
import { formatDateText, formatTimeText, fromParts, parseTimeText, toParts } from '../lib/datetimeText'

// Typed date + time with an AM/PM toggle. Value is "YYYY-MM-DDTHH:mm" (local),
// the same format as <input type="datetime-local">, so it drops in as a replacement.
export default function DateTimeInput({
  value,
  onChange,
  className = ''
}: {
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  const initial = toParts(value)
  const [date, setDate] = useState(initial.date)
  const [time, setTime] = useState(initial.time)
  const [pm, setPm] = useState(initial.pm)
  const lastEmitted = useRef(value)

  // Pick up changes made from outside (e.g. the editor loading an entry).
  useEffect(() => {
    if (value !== lastEmitted.current) {
      const p = toParts(value)
      setDate(p.date)
      setTime(p.time)
      setPm(p.pm)
      lastEmitted.current = value
    }
  }, [value])

  const commit = (d: string, t: string, isPm: boolean) => {
    const next = fromParts(d, t, isPm)
    if (next) {
      lastEmitted.current = next
      onChange(next)
    }
  }

  const onDate = (raw: string) => {
    const d = formatDateText(raw)
    setDate(d)
    commit(d, time, pm)
  }

  const onTime = (raw: string) => {
    const t = formatTimeText(raw)
    const parsed = parseTimeText(t, pm)
    // Typing 13-23 means 24-hour time: show it as 12-hour with PM selected.
    if (parsed && Number(t.split(':')[0]) >= 13) {
      const h12 = Number(t.split(':')[0]) - 12
      const shown = `${h12}:${t.split(':')[1]}`
      setTime(shown)
      setPm(true)
      commit(date, shown, true)
      return
    }
    setTime(t)
    commit(date, t, pm)
  }

  const onPm = (isPm: boolean) => {
    setPm(isPm)
    commit(date, time, isPm)
  }

  const dateBad = date.length > 0 && fromParts(date, '12:00', false) === null && date.length >= 10
  const timeBad = time.length >= 4 && parseTimeText(time, pm) === null
  const field = 'input !text-base min-w-0'

  return (
    <div className={`flex gap-2 items-stretch ${className}`}>
      <input
        className={`${field} flex-[5] ${dateBad ? '!border-dusk-500' : ''}`}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="MM/DD/YYYY"
        aria-label="Date"
        value={date}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => onDate(e.target.value)}
      />
      <input
        className={`${field} flex-[3] ${timeBad ? '!border-dusk-500' : ''}`}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="h:mm"
        aria-label="Time"
        value={time}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => onTime(e.target.value)}
      />
      <div className="flex rounded-xl overflow-hidden border border-night-700 shrink-0" role="group" aria-label="AM or PM">
        {(['AM', 'PM'] as const).map((label) => {
          const active = (label === 'PM') === pm
          return (
            <button
              key={label}
              type="button"
              onClick={() => onPm(label === 'PM')}
              aria-pressed={active}
              className={`px-3 text-sm font-semibold ${active ? 'bg-dusk-500 text-night-950' : 'bg-night-950 text-parchment-300'}`}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
