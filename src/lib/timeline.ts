import type { DayBucket } from './trends'
import type { Diaper, Feeding, PumpingSession, SleepSession } from '../types'

export type TimelineKind = 'sleep' | 'feeding' | 'diaper' | 'pumping'

export type Block =
  | { kind: 'sleep'; id: string; top: number; mins: number; row: SleepSession }
  | { kind: 'feeding'; id: string; top: number; mins: number; row: Feeding }
  | { kind: 'diaper'; id: string; top: number; mins: number; row: Diaper }
  | { kind: 'pumping'; id: string; top: number; mins: number; row: PumpingSession }

export type WeekData = { sleep: SleepSession[]; feedings: Feeding[]; diapers: Diaper[]; pumping: PumpingSession[] }

const minsFrom = (ms: number, day: DayBucket) => (ms - day.start) / 60000

/** Everything that touches `day`, positioned in minutes from local midnight. */
export function blocksForDay(day: DayBucket, data: WeekData, enabled: Record<TimelineKind, boolean>, now = Date.now()): Block[] {
  const out: Block[] = []

  const span = (startIso: string, endIso: string | null) => {
    const a = new Date(startIso).getTime()
    const b = endIso ? new Date(endIso).getTime() : null
    const lo = Math.max(a, day.start)
    const hi = Math.min(b ?? now, day.end)
    return { a, lo, hi }
  }

  if (enabled.sleep) {
    for (const s of data.sleep) {
      const { lo, hi } = span(s.start_time, s.end_time)
      if (hi > lo) out.push({ kind: 'sleep', id: s.id, top: minsFrom(lo, day), mins: (hi - lo) / 60000, row: s })
    }
  }
  if (enabled.feeding) {
    for (const f of data.feedings) {
      const { a, lo, hi } = span(f.start_time, f.end_time)
      if (f.end_time ? hi > lo : a >= day.start && a < day.end) {
        out.push({ kind: 'feeding', id: f.id, top: minsFrom(Math.max(a, day.start), day), mins: Math.max(0, (hi - lo) / 60000), row: f })
      }
    }
  }
  if (enabled.pumping) {
    for (const p of data.pumping) {
      const { a, lo, hi } = span(p.start_time, p.end_time)
      if (p.end_time ? hi > lo : a >= day.start && a < day.end) {
        out.push({ kind: 'pumping', id: p.id, top: minsFrom(Math.max(a, day.start), day), mins: Math.max(0, (hi - lo) / 60000), row: p })
      }
    }
  }
  if (enabled.diaper) {
    for (const d of data.diapers) {
      const t = new Date(d.time).getTime()
      if (t >= day.start && t < day.end) out.push({ kind: 'diaper', id: d.id, top: minsFrom(t, day), mins: 0, row: d })
    }
  }
  return out
}
