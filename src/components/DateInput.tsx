import { useEffect, useRef, useState } from 'react'
import { formatDateText, parseDateText } from '../lib/datetimeText'
import { todayISO } from '../lib/age'

// Typed MM/DD/YYYY date. Value is "YYYY-MM-DD".
export default function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const fromISO = (v: string) => (v ? `${v.slice(5, 7)}/${v.slice(8, 10)}/${v.slice(0, 4)}` : '')
  const [text, setText] = useState(fromISO(value))
  const last = useRef(value)

  useEffect(() => {
    if (value !== last.current) {
      setText(fromISO(value))
      last.current = value
    }
  }, [value])

  const set = (raw: string) => {
    const t = formatDateText(raw)
    setText(t)
    const iso = parseDateText(t)
    if (iso) {
      last.current = iso
      onChange(iso)
    }
  }

  const bad = text.length >= 10 && !parseDateText(text)
  return (
    <div className="flex gap-2">
      <input
        className={`input !text-base min-w-0 flex-1 ${bad ? '!border-dusk-500' : ''}`}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="MM/DD/YYYY"
        aria-label="Date"
        value={text}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => set(e.target.value)}
      />
      <button type="button" className="btn-secondary shrink-0" onClick={() => set(fromISO(todayISO()))}>
        Today
      </button>
    </div>
  )
}
