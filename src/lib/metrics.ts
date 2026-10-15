// Trend metrics (Feed / Diaper / Sleep / Pump). Each metric yields a per-day
// series {v, w}: v = that day's value, w = weight (1 for per-day totals on days
// with any activity; the number of events for averages). The headline is the
// weighted mean over the window, so "4.1 sessions per day" only counts days
// you actually logged on.
import { mlToUnit, type Unit } from './units'
import type { DayBucket } from './trends'
import type { WeekData } from './timeline'

export type Section = 'feed' | 'diaper' | 'sleep' | 'pump'
export type Daily = { v: number[]; w: number[] }
export type Kind = 'duration' | 'count' | 'volume'

type Compute = (d: WeekData, days: DayBucket[], now: number, logged: boolean[]) => Daily

export type Metric = {
  key: string
  section: Section
  title: string
  icon: string
  suffix: 'per day' | 'average'
  kind: Kind
  compute: Compute
  breakdown?: { key: string; label: string; compute: Compute }[]
  /** Breakdown parts add up to the total, so the detail chart can stack them. */
  stacked?: boolean
}

export const SECTION_COLOR: Record<Section, string> = {
  feed: '#F0C24C',
  diaper: '#F2ECD8',
  sleep: '#AEE0EF',
  pump: '#F2A79E'
}
export const SECTIONS: { key: Section; title: string }[] = [
  { key: 'feed', title: 'Feed' },
  { key: 'diaper', title: 'Diaper' },
  { key: 'sleep', title: 'Sleep' },
  { key: 'pump', title: 'Pump' }
]

// Validated categorical slots (dark surface) for breakdown parts.
export const PART_COLORS = ['#3987e5', '#d95926', '#199e70']

export const DAY_START_HOUR = 7
export const DAY_END_HOUR = 19

const ms = (iso: string) => new Date(iso).getTime()
const zeros = (n: number) => Array.from({ length: n }, () => 0)
const dayOf = (days: DayBucket[], t: number) => days.findIndex((d) => t >= d.start && t < d.end)

function windowOf(day: DayBucket, fromHour: number, toHour: number) {
  const s = new Date(day.start)
  return [new Date(s.getFullYear(), s.getMonth(), s.getDate(), fromHour).getTime(), new Date(s.getFullYear(), s.getMonth(), s.getDate(), toHour).getTime()]
}

const overlapMin = (a: number, b: number, lo: number, hi: number) => Math.max(0, Math.min(b, hi) - Math.max(a, lo)) / 60000

/** Which days have any activity at all (so averages ignore empty days). */
export function loggedDays(d: WeekData, days: DayBucket[]): boolean[] {
  const out = days.map(() => false)
  const mark = (t: number) => {
    const i = dayOf(days, t)
    if (i >= 0) out[i] = true
  }
  d.sleep.forEach((s) => {
    mark(ms(s.start_time))
    if (s.end_time) mark(ms(s.end_time))
  })
  d.feedings.forEach((f) => mark(ms(f.start_time)))
  d.diapers.forEach((x) => mark(ms(x.time)))
  d.pumping.forEach((p) => mark(ms(p.start_time)))
  return out
}

const perDay = (logged: boolean[], v: number[]): Daily => ({ v, w: logged.map((l) => (l ? 1 : 0)) })

function averages(days: DayBucket[], samples: { t: number; x: number }[]): Daily {
  const sum = zeros(days.length)
  const cnt = zeros(days.length)
  for (const s of samples) {
    const i = dayOf(days, s.t)
    if (i >= 0) {
      sum[i] += s.x
      cnt[i] += 1
    }
  }
  return { v: sum.map((x, i) => (cnt[i] ? x / cnt[i] : 0)), w: cnt }
}

export const headline = (d: Daily): number | null => {
  const w = d.w.reduce((a, b) => a + b, 0)
  return w > 0 ? d.v.reduce((a, v, i) => a + v * d.w[i], 0) / w : null
}

// ── sleep helpers ───────────────────────────────────────────────────────────
function sleepMinutes(d: WeekData, days: DayBucket[], now: number, part: 'all' | 'day' | 'night'): number[] {
  const out = zeros(days.length)
  for (const s of d.sleep) {
    const a = ms(s.start_time)
    const b = s.end_time ? ms(s.end_time) : now
    days.forEach((day, i) => {
      const total = overlapMin(a, b, day.start, day.end)
      if (total <= 0) return
      if (part === 'all') out[i] += total
      else {
        const [lo, hi] = windowOf(day, DAY_START_HOUR, DAY_END_HOUR)
        const dayPart = overlapMin(a, b, lo, hi)
        out[i] += part === 'day' ? dayPart : total - dayPart
      }
    })
  }
  return out
}

const isDaytime = (t: number) => {
  const h = new Date(t).getHours()
  return h >= DAY_START_HOUR && h < DAY_END_HOUR
}

const breastMinutes = (f: { duration_left_minutes: number | null; duration_right_minutes: number | null; duration_minutes: number | null; start_time: string; end_time: string | null }) => {
  const l = f.duration_left_minutes ?? 0
  const r = f.duration_right_minutes ?? 0
  if (l + r > 0) return l + r
  if (f.duration_minutes) return f.duration_minutes
  return f.end_time ? Math.max(0, (ms(f.end_time) - ms(f.start_time)) / 60000) : 0
}

const countRows = <T,>(days: DayBucket[], rows: T[], timeOf: (r: T) => number, pick: (r: T) => boolean = () => true) => {
  const out = zeros(days.length)
  for (const r of rows) {
    if (!pick(r)) continue
    const i = dayOf(days, timeOf(r))
    if (i >= 0) out[i] += 1
  }
  return out
}

const sumRows = <T,>(days: DayBucket[], rows: T[], timeOf: (r: T) => number, valueOf: (r: T) => number) => {
  const out = zeros(days.length)
  for (const r of rows) {
    const i = dayOf(days, timeOf(r))
    if (i >= 0) out[i] += valueOf(r)
  }
  return out
}

export const METRICS: Metric[] = [
  // ── Feed ──
  {
    key: 'feed-sessions', section: 'feed', title: 'Feed Sessions', icon: '🍽️', suffix: 'per day', kind: 'count', stacked: true,
    compute: (d, days, _n, lg) => perDay(lg, countRows(days, d.feedings, (f) => ms(f.start_time))),
    breakdown: [
      { key: 'breast', label: 'Breastfeed', compute: (d, days, _n, lg) => perDay(lg, countRows(days, d.feedings, (f) => ms(f.start_time), (f) => f.type === 'breast')) },
      { key: 'bottle', label: 'Bottle Feed', compute: (d, days, _n, lg) => perDay(lg, countRows(days, d.feedings, (f) => ms(f.start_time), (f) => f.type === 'bottle')) },
      { key: 'solid', label: 'Solid Food', compute: (d, days, _n, lg) => perDay(lg, countRows(days, d.feedings, (f) => ms(f.start_time), (f) => f.type === 'solid')) }
    ]
  },
  {
    key: 'bf-time', section: 'feed', title: 'Total BF Time', icon: '🤱', suffix: 'per day', kind: 'duration', stacked: true,
    compute: (d, days, _n, lg) => perDay(lg, sumRows(days, d.feedings.filter((f) => f.type === 'breast'), (f) => ms(f.start_time), breastMinutes)),
    breakdown: [
      { key: 'left', label: 'Left', compute: (d, days, _n, lg) => perDay(lg, sumRows(days, d.feedings.filter((f) => f.type === 'breast'), (f) => ms(f.start_time), (f) => f.duration_left_minutes ?? 0)) },
      { key: 'right', label: 'Right', compute: (d, days, _n, lg) => perDay(lg, sumRows(days, d.feedings.filter((f) => f.type === 'breast'), (f) => ms(f.start_time), (f) => f.duration_right_minutes ?? 0)) }
    ]
  },
  {
    key: 'bf-length', section: 'feed', title: 'BF Session Length', icon: '⏱️', suffix: 'average', kind: 'duration',
    compute: (d, days) =>
      averages(days, d.feedings.filter((f) => f.type === 'breast' && breastMinutes(f) > 0).map((f) => ({ t: ms(f.start_time), x: breastMinutes(f) })))
  },
  {
    key: 'bottle-amount', section: 'feed', title: 'Amount Bottlefed', icon: '🍼', suffix: 'per day', kind: 'volume',
    compute: (d, days, _n, lg) => perDay(lg, sumRows(days, d.feedings.filter((f) => f.type === 'bottle'), (f) => ms(f.start_time), (f) => f.amount_ml ?? 0))
  },
  {
    key: 'bottle-size', section: 'feed', title: 'Bottle Size', icon: '🥛', suffix: 'average', kind: 'volume',
    compute: (d, days) => averages(days, d.feedings.filter((f) => f.type === 'bottle' && (f.amount_ml ?? 0) > 0).map((f) => ({ t: ms(f.start_time), x: f.amount_ml as number })))
  },
  {
    key: 'feed-gap', section: 'feed', title: 'Time Between Feedings', icon: '🕒', suffix: 'average', kind: 'duration',
    compute: (d, days) => {
      const t = d.feedings.map((f) => ms(f.start_time)).sort((a, b) => a - b)
      const samples: { t: number; x: number }[] = []
      for (let i = 1; i < t.length; i++) {
        const gap = (t[i] - t[i - 1]) / 60000
        if (gap > 0 && gap <= 12 * 60) samples.push({ t: t[i], x: gap })
      }
      return averages(days, samples)
    }
  },

  // ── Diaper ──
  {
    key: 'diaper-total', section: 'diaper', title: 'Total Diapers', icon: '🧷', suffix: 'per day', kind: 'count',
    compute: (d, days, _n, lg) => perDay(lg, countRows(days, d.diapers, (x) => ms(x.time))),
    breakdown: [
      { key: 'dirty', label: 'Dirty', compute: (d, days, _n, lg) => perDay(lg, countRows(days, d.diapers, (x) => ms(x.time), (x) => x.dirty)) },
      { key: 'wet', label: 'Wet', compute: (d, days, _n, lg) => perDay(lg, countRows(days, d.diapers, (x) => ms(x.time), (x) => x.wet)) }
    ]
  },
  {
    key: 'diaper-day', section: 'diaper', title: 'Daytime Diapers', icon: '☀️', suffix: 'per day', kind: 'count',
    compute: (d, days, _n, lg) => perDay(lg, countRows(days, d.diapers, (x) => ms(x.time), (x) => isDaytime(ms(x.time))))
  },
  {
    key: 'diaper-night', section: 'diaper', title: 'Nighttime Diapers', icon: '🌙', suffix: 'per day', kind: 'count',
    compute: (d, days, _n, lg) => perDay(lg, countRows(days, d.diapers, (x) => ms(x.time), (x) => !isDaytime(ms(x.time))))
  },

  // ── Sleep ──
  {
    key: 'sleep-total', section: 'sleep', title: 'Total Sleep', icon: '🌙', suffix: 'per day', kind: 'duration',
    compute: (d, days, now, lg) => perDay(lg, sleepMinutes(d, days, now, 'all'))
  },
  {
    key: 'sleep-day', section: 'sleep', title: 'Daytime Sleep', icon: '🌤️', suffix: 'per day', kind: 'duration',
    compute: (d, days, now, lg) => perDay(lg, sleepMinutes(d, days, now, 'day'))
  },
  {
    key: 'sleep-night', section: 'sleep', title: 'Nighttime Sleep', icon: '✨', suffix: 'per day', kind: 'duration',
    compute: (d, days, now, lg) => perDay(lg, sleepMinutes(d, days, now, 'night'))
  },
  {
    key: 'sleep-longest', section: 'sleep', title: 'Longest Sleep', icon: '🛌', suffix: 'average', kind: 'duration',
    compute: (d, days, now) => {
      const best = zeros(days.length)
      const has = zeros(days.length)
      for (const s of d.sleep) {
        const a = ms(s.start_time)
        const i = dayOf(days, a)
        if (i < 0) continue
        const mins = ((s.end_time ? ms(s.end_time) : now) - a) / 60000
        best[i] = Math.max(best[i], mins)
        has[i] = 1
      }
      return { v: best, w: has }
    }
  },
  {
    key: 'naps', section: 'sleep', title: 'Daytime Naps', icon: '💤', suffix: 'per day', kind: 'count',
    compute: (d, days, _n, lg) => perDay(lg, countRows(days, d.sleep, (s) => ms(s.start_time), (s) => isDaytime(ms(s.start_time))))
  },
  {
    key: 'nap-length', section: 'sleep', title: 'Daytime Nap Length', icon: '⏳', suffix: 'average', kind: 'duration',
    compute: (d, days, now) =>
      averages(days, d.sleep.filter((s) => isDaytime(ms(s.start_time))).map((s) => ({ t: ms(s.start_time), x: ((s.end_time ? ms(s.end_time) : now) - ms(s.start_time)) / 60000 })))
  },
  {
    key: 'wake-window', section: 'sleep', title: 'Wake Window', icon: '🕰️', suffix: 'average', kind: 'duration',
    compute: (d, days) => {
      const done = d.sleep.filter((s) => s.end_time).sort((a, b) => ms(a.start_time) - ms(b.start_time))
      const samples: { t: number; x: number }[] = []
      for (let i = 1; i < done.length; i++) {
        const prevEnd = ms(done[i - 1].end_time as string)
        const gap = (ms(done[i].start_time) - prevEnd) / 60000
        if (gap > 0 && gap <= 8 * 60 && isDaytime(prevEnd)) samples.push({ t: prevEnd, x: gap })
      }
      return averages(days, samples)
    }
  },

  // ── Pump ──
  {
    key: 'pump-sessions', section: 'pump', title: 'Pump Sessions', icon: '🍼', suffix: 'per day', kind: 'count',
    compute: (d, days, _n, lg) => perDay(lg, countRows(days, d.pumping, (p) => ms(p.start_time)))
  },
  {
    key: 'pump-amount', section: 'pump', title: 'Amount Pumped', icon: '💧', suffix: 'per day', kind: 'volume',
    compute: (d, days, _n, lg) => perDay(lg, sumRows(days, d.pumping, (p) => ms(p.start_time), (p) => p.amount_ml ?? 0)),
    breakdown: [
      { key: 'left', label: 'Left', compute: (d, days, _n, lg) => perDay(lg, sumRows(days, d.pumping, (p) => ms(p.start_time), (p) => p.amount_left_ml ?? 0)) },
      { key: 'right', label: 'Right', compute: (d, days, _n, lg) => perDay(lg, sumRows(days, d.pumping, (p) => ms(p.start_time), (p) => p.amount_right_ml ?? 0)) }
    ]
  },
  {
    key: 'pump-time', section: 'pump', title: 'Total Pump Time', icon: '⏱️', suffix: 'per day', kind: 'duration',
    compute: (d, days, now, lg) => perDay(lg, sumRows(days, d.pumping, (p) => ms(p.start_time), (p) => ((p.end_time ? ms(p.end_time) : now) - ms(p.start_time)) / 60000))
  }
]

// ── formatting ──────────────────────────────────────────────────────────────
export function fmtDuration(minutes: number): string {
  const total = Math.round(minutes * 60)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return s ? `${m}m ${s}s` : `${m}m`
  return `${s}s`
}

export function fmtMetric(kind: Kind, v: number, unit: Unit): string {
  if (kind === 'duration') return fmtDuration(v)
  if (kind === 'volume') return `${mlToUnit(v, unit)} ${unit}`
  return String(Number(v.toFixed(1)))
}

export function windowDays(days: DayBucket[], count: number) {
  return { current: days.slice(days.length - count), previous: days.slice(days.length - 2 * count, days.length - count) }
}
