// Helpers for the typed date/time field. Canonical value is "YYYY-MM-DDTHH:mm" (local).

const pad = (n: number) => String(n).padStart(2, '0')

/** Keep digits only and insert slashes: "10142026" -> "10/14/2026". */
export function formatDateText(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}

/** Keep digits only and insert a colon: "855" -> "8:55", "0855" -> "08:55". */
export function formatTimeText(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 4)
  if (d.length <= 2) return d
  return `${d.slice(0, d.length - 2)}:${d.slice(-2)}`
}

/** "10/14/2026" -> "2026-10-14", or null if incomplete or not a real date. */
export function parseDateText(text: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text)
  if (!m) return null
  const mo = Number(m[1]), da = Number(m[2]), yr = Number(m[3])
  const dt = new Date(yr, mo - 1, da)
  if (dt.getFullYear() !== yr || dt.getMonth() !== mo - 1 || dt.getDate() !== da) return null
  return `${yr}-${pad(mo)}-${pad(da)}`
}

/**
 * "8:55" + PM -> { hh: 20, mm: 55 }. Hours 13-23 are read as 24-hour time
 * (and flip the AM/PM toggle). Returns null when incomplete or out of range.
 */
export function parseTimeText(text: string, pm: boolean): { hh: number; mm: number; pm: boolean } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text)
  if (!m) return null
  let h = Number(m[1])
  const mm = Number(m[2])
  if (mm > 59 || h > 23) return null
  if (h >= 13) return { hh: h, mm, pm: true }
  if (h === 0) return { hh: pm ? 12 : 0, mm, pm }
  if (h === 12) return { hh: pm ? 12 : 0, mm, pm }
  return { hh: pm ? h + 12 : h, mm, pm }
}

/** Split a canonical value into display parts. */
export function toParts(value: string): { date: string; time: string; pm: boolean } {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value)
  if (!m) return { date: '', time: '', pm: false }
  const h24 = Number(m[4])
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return { date: `${m[2]}/${m[3]}/${m[1]}`, time: `${h12}:${m[5]}`, pm: h24 >= 12 }
}

/** Combine typed parts into a canonical value, or null if either part is invalid. */
export function fromParts(dateText: string, timeText: string, pm: boolean): string | null {
  const d = parseDateText(dateText)
  const t = parseTimeText(timeText, pm)
  if (!d || !t) return null
  return `${d}T${pad(t.hh)}:${pad(t.mm)}`
}
