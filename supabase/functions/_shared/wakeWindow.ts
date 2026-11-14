// Wake-window suggestions. Pure logic with no imports so the app (Vite) and the
// reminder Edge Function (Deno) share one copy.
//
// Idea: the age gives a typical range; Noah's own recent daytime naps pull the
// suggestion toward what actually works for him, but never outside that range
// (plus a little slack). General guidance only, not medical advice.

export type SleepLike = { start_time: string; end_time: string | null }

// Typical awake stretch between sleeps, in hours, by completed months of age.
const BY_MONTH: [number, [number, number]][] = [
  [0, [0.75, 1.25]],
  [1, [1, 1.5]],
  [2, [1, 1.75]],
  [3, [1.25, 2]],
  [4, [1.5, 2.25]],
  [5, [1.75, 2.5]],
  [6, [2, 3]],
  [7, [2.25, 3]],
  [8, [2.5, 3.25]],
  [9, [2.75, 3.75]],
  [10, [2.75, 3.75]],
  [11, [3, 4]],
  [12, [3, 4]],
  [15, [4, 6]]
]

export function ageInMonths(birthISO: string | null, nowMs: number): number | null {
  if (!birthISO) return null
  const [y, m, d] = birthISO.split('-').map(Number)
  const now = new Date(nowMs)
  let months = (now.getFullYear() - y) * 12 + (now.getMonth() - (m - 1))
  if (now.getDate() < d) months--
  return Math.max(0, months)
}

/** Age range in minutes [min, max]. Unknown age falls back to a mid-infant range. */
export function ageRangeMinutes(months: number | null): [number, number] {
  const m = months ?? 6
  let pick = BY_MONTH[0][1]
  for (const [from, range] of BY_MONTH) if (m >= from) pick = range
  return [Math.round(pick[0] * 60), Math.round(pick[1] * 60)]
}

const DAY_START_HOUR = 7
const DAY_END_HOUR = 19
const LOOKBACK_MS = 14 * 86400000
const MIN_SAMPLES = 6
const HALF_WIDTH_MIN = 15

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export type Suggestion = {
  kind: 'nap' | 'bedtime'
  lastWakeMs: number
  opensMs: number
  closesMs: number
  typicalMin: number
  personalized: boolean
  samples: number
  ageRange: [number, number]
}

/**
 * The next suggested sleep window, or null when it doesn't apply (baby is asleep,
 * no recent wake-up, or the window falls in the middle of the night).
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
  if (lastWakeMs > nowMs || nowMs - lastWakeMs > 14 * 3600000) return null

  const ageRange = ageRangeMinutes(ageInMonths(birthISO, nowMs))

  // Gaps between a wake-up and the next daytime sleep, over the last 14 days.
  const gaps: number[] = []
  for (let i = 1; i < done.length; i++) {
    const s = done[i]
    if (nowMs - s.start > LOOKBACK_MS) continue
    const h = hourOf(s.start)
    if (h < DAY_START_HOUR || h >= DAY_END_HOUR) continue
    if (s.end - s.start < 15 * 60000) continue
    const gap = (s.start - done[i - 1].end) / 60000
    if (gap >= 20 && gap <= 480) gaps.push(gap)
  }

  const personalized = gaps.length >= MIN_SAMPLES
  const typicalMin = personalized
    ? Math.min(ageRange[1] * 1.1, Math.max(ageRange[0] * 0.9, median(gaps)))
    : (ageRange[0] + ageRange[1]) / 2

  const opensMs = lastWakeMs + (typicalMin - HALF_WIDTH_MIN) * 60000
  const closesMs = lastWakeMs + (typicalMin + HALF_WIDTH_MIN) * 60000
  const openHour = hourOf(opensMs)
  if (openHour >= 21 || openHour < 5) return null

  return {
    kind: openHour >= 18 ? 'bedtime' : 'nap',
    lastWakeMs,
    opensMs,
    closesMs,
    typicalMin,
    personalized,
    samples: gaps.length,
    ageRange
  }
}
