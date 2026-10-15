// Pure date-bucketing helpers shared by History (week grid) and Trends (charts).

export type DayBucket = {
  key: string // YYYY-MM-DD (local)
  start: number // local midnight, ms
  end: number // next local midnight, ms
  weekday: string // "Mon"
  weekday2: string // "Mo"
  dom: number // day of month
  short: string // "10/14"
  label: string // "Mon, Oct 14"
}

const pad = (n: number) => String(n).padStart(2, '0')

export function dayBucket(date: Date): DayBucket {
  const s = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 1)
  const weekday = s.toLocaleDateString(undefined, { weekday: 'short' })
  return {
    key: `${s.getFullYear()}-${pad(s.getMonth() + 1)}-${pad(s.getDate())}`,
    start: s.getTime(),
    end: e.getTime(),
    weekday,
    weekday2: weekday.slice(0, 2),
    dom: s.getDate(),
    short: `${s.getMonth() + 1}/${s.getDate()}`,
    label: s.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  }
}

/** `count` consecutive local days ending on `endDay` (inclusive), oldest first. */
export function buildDays(count: number, endDay: Date = new Date()): DayBucket[] {
  const out: DayBucket[] = []
  for (let i = count - 1; i >= 0; i--) {
    out.push(dayBucket(new Date(endDay.getFullYear(), endDay.getMonth(), endDay.getDate() - i)))
  }
  return out
}

/** Minutes of each session that fall inside each day (sessions may cross midnight). */
export function sleepMinutesByDay(days: DayBucket[], sessions: { start_time: string; end_time: string | null }[], now = Date.now()): number[] {
  const out = days.map(() => 0)
  for (const s of sessions) {
    const a = new Date(s.start_time).getTime()
    const b = s.end_time ? new Date(s.end_time).getTime() : now
    days.forEach((d, i) => {
      const lo = Math.max(a, d.start)
      const hi = Math.min(b, d.end)
      if (hi > lo) out[i] += (hi - lo) / 60000
    })
  }
  return out
}

/** counts[seriesIndex][dayIndex]; rows whose series key is null/unknown are skipped. */
export function countByDay<T>(days: DayBucket[], rows: T[], timeOf: (r: T) => string, seriesOf: (r: T) => string | null, keys: string[]): number[][] {
  const out = keys.map(() => days.map(() => 0))
  for (const r of rows) {
    const k = seriesOf(r)
    const si = k == null ? -1 : keys.indexOf(k)
    if (si < 0) continue
    const t = new Date(timeOf(r)).getTime()
    const di = days.findIndex((d) => t >= d.start && t < d.end)
    if (di >= 0) out[si][di] += 1
  }
  return out
}

export function sumByDay<T>(days: DayBucket[], rows: T[], timeOf: (r: T) => string, valueOf: (r: T) => number): number[] {
  const out = days.map(() => 0)
  for (const r of rows) {
    const t = new Date(timeOf(r)).getTime()
    const di = days.findIndex((d) => t >= d.start && t < d.end)
    if (di >= 0) out[di] += valueOf(r)
  }
  return out
}

/** Round a max up to a clean axis top and return evenly spaced tick values. */
export function niceScale(max: number, target = 4): { top: number; ticks: number[] } {
  if (!(max > 0)) return { top: 1, ticks: [0, 1] }
  const rough = max / target
  const pow = Math.pow(10, Math.floor(Math.log10(rough)))
  const f = rough / pow
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow
  const top = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = 0; v <= top + step / 1000; v += step) ticks.push(Number(v.toFixed(6)))
  return { top, ticks }
}

/** Compact axis number: 0, 500, 1K, 1.5K */
export function compact(n: number): string {
  if (Math.abs(n) >= 1000) return `${Number((n / 1000).toFixed(1))}K`
  return String(Number(n.toFixed(1)))
}
