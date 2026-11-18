// Wake-window suggestions. Pure logic with no imports so the app (Vite) and the
// reminder Edge Function (Deno) share one copy.
//
// Follows Hatch's published guide: a typical wake window by age, and for older
// babies a window per slot of the day (before nap 1, before nap 2, ... before
// bedtime) that grows through the day. The suggestion is a single target time:
// last wake-up + the window for the next slot. General guidance, not medical advice.

export type SleepLike = { start_time: string; end_time: string | null }

type Bracket = {
  label: string
  /** Wake window in hours for each slot of the day; the last one leads into bedtime when hasBedtime. */
  hours: number[]
  hasBedtime: boolean
}

const DAY = 86400000
const HOUR = 3600000

/** Age in days from a "YYYY-MM-DD" birth date, or null. */
export function ageInDays(birthISO: string | null, nowMs: number): number | null {
  if (!birthISO) return null
  const [y, m, d] = birthISO.split('-').map(Number)
  const now = new Date(nowMs)
  const born = new Date(y, m - 1, d).getTime()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return Math.max(0, Math.round((today - born) / DAY))
}

/** Hatch's guide. Ages round to the nearest month (9 months 28 days counts as 10). */
export function bracketFor(ageDays: number | null): Bracket {
  if (ageDays == null) return { label: '6–9 months', hours: [2.5, 3, 3.5], hasBedtime: true }
  if (ageDays < 35) return { label: '0–4 weeks', hours: [0.625], hasBedtime: false } // 30–45 min
  if (ageDays < 112) return { label: '5–15 weeks', hours: [0.875], hasBedtime: false } // 45–60 min
  const months = Math.round(ageDays / 30.4375)
  if (months <= 4) return { label: '4 months', hours: [1.625], hasBedtime: false } // 1h30–1h45
  if (months === 5) return { label: '5 months', hours: [2.25], hasBedtime: false } // 2–2.5h
  if (months <= 9) return { label: '6–9 months', hours: [2.5, 3, 3.5], hasBedtime: true }
  if (months <= 11) return { label: '10–11 months', hours: [2.75, 3.25, 3.75], hasBedtime: true }
  if (months <= 24) return { label: '12–24 months', hours: [5, 4.75], hasBedtime: true } // AM 5h, PM 4.5–5h
  return { label: '25–36 months', hours: [5.75, 5.5], hasBedtime: true } // AM 5.5–6h, PM 5–6h
}

export type Suggestion = {
  kind: 'nap' | 'bedtime'
  lastWakeMs: number
  /** When the next sleep is suggested: last wake-up + this slot's wake window. */
  targetMs: number
  windowMin: number
  /** Daytime sleeps already taken since the last night sleep. */
  napsSoFar: number
  ageLabel: string
}

const NIGHT_MS = 4 * HOUR // a sleep this long counts as night sleep
const MIN_NAP_MS = 15 * 60000

/**
 * The next suggested sleep time, or null when it doesn't apply (baby is asleep,
 * no recent wake-up, or the target falls in the middle of the night).
 * `hourOf` maps a timestamp to the local hour (0-23) so callers pick the timezone.
 */
export function suggestNext(
  sessions: SleepLike[],
  birthISO: string | null,
  nowMs: number,
  hourOf: (ms: number) => number
): Suggestion | null {
  if (sessions.some((s) => !s.end_time)) return null
  const done = sessions
    .map((s) => ({ start: new Date(s.start_time).getTime(), end: new Date(s.end_time as string).getTime() }))
    .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start)
    .sort((a, b) => a.start - b.start)
  if (done.length === 0) return null

  const lastWakeMs = done[done.length - 1].end
  if (lastWakeMs > nowMs || nowMs - lastWakeMs > 14 * HOUR) return null

  // Which slot of the day are we in? Count daytime sleeps since the last night sleep.
  let nightIdx = -1
  for (let i = done.length - 1; i >= 0; i--) {
    if (done[i].end - done[i].start >= NIGHT_MS && nowMs - done[i].end < 30 * HOUR) {
      nightIdx = i
      break
    }
  }
  const sinceNight =
    nightIdx >= 0
      ? done.slice(nightIdx + 1)
      : done.filter((s) => nowMs - s.start < 12 * HOUR && s.end - s.start < NIGHT_MS)
  const napsSoFar = sinceNight.filter((s) => s.end - s.start >= MIN_NAP_MS).length

  const b = bracketFor(ageInDays(birthISO, nowMs))
  const slot = Math.min(napsSoFar, b.hours.length - 1)
  const targetMs = lastWakeMs + b.hours[slot] * HOUR
  const targetHour = hourOf(targetMs)
  if (targetHour >= 23 || targetHour < 5) return null

  const kind = b.hasBedtime ? (napsSoFar >= b.hours.length - 1 ? 'bedtime' : 'nap') : targetHour >= 18 ? 'bedtime' : 'nap'
  return { kind, lastWakeMs, targetMs, windowMin: Math.round(b.hours[slot] * 60), napsSoFar, ageLabel: b.label }
}
