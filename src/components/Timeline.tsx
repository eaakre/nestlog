import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatClock, formatRelative, formatDurationMinutes } from '../lib/format'
import type { TimelineEntry, SleepSession, Feeding, Diaper, PumpingSession } from '../types'

const ICONS: Record<string, string> = {
  sleep: '🌙',
  feeding: '🍽️',
  diaper: '🧷',
  pumping: '🍼'
}

function describe(entry: TimelineEntry): string {
  switch (entry.kind) {
    case 'sleep': {
      const s = entry.data as SleepSession
      if (!s.end_time) return 'Sleep started'
      const mins = (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 60000
      return `Slept ${formatDurationMinutes(mins)}`
    }
    case 'feeding': {
      const f = entry.data as Feeding
      if (f.type === 'bottle') return `Bottle${f.amount_ml ? ` · ${f.amount_ml}ml` : ''}`
      if (f.type === 'breast') {
        const parts: string[] = []
        if (f.duration_left_minutes) parts.push(`L ${formatDurationMinutes(f.duration_left_minutes)}`)
        if (f.duration_right_minutes) parts.push(`R ${formatDurationMinutes(f.duration_right_minutes)}`)
        const breakdown = parts.length ? ` · ${parts.join(' + ')}` : f.duration_minutes ? ` · ${formatDurationMinutes(f.duration_minutes)}` : ''
        return `Breastfed${breakdown}${f.side ? ` · last ${f.side}` : ''}`
      }
      return 'Solid food'
    }
    case 'diaper': {
      const d = entry.data as Diaper
      return `Diaper · ${d.type}`
    }
    case 'pumping': {
      const p = entry.data as PumpingSession
      if (!p.end_time) return 'Pumping started'
      return `Pumped${p.amount_ml ? ` · ${p.amount_ml}ml` : ''}${p.side ? ` · ${p.side}` : ''}`
    }
  }
}

export default function Timeline({ childId }: { childId: string }) {
  const [entries, setEntries] = useState<TimelineEntry[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const since = new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString()
    const [sleep, feedings, diapers, pumping] = await Promise.all([
      supabase.from('sleep_sessions').select('*').eq('child_id', childId).gte('start_time', since),
      supabase.from('feedings').select('*').eq('child_id', childId).gte('start_time', since),
      supabase.from('diapers').select('*').eq('child_id', childId).gte('time', since),
      supabase.from('pumping_sessions').select('*').eq('child_id', childId).gte('start_time', since)
    ])

    const merged: TimelineEntry[] = [
      ...((sleep.data as SleepSession[]) ?? []).map((s) => ({ kind: 'sleep' as const, id: s.id, time: s.end_time ?? s.start_time, data: s })),
      ...((feedings.data as Feeding[]) ?? []).map((f) => ({ kind: 'feeding' as const, id: f.id, time: f.start_time, data: f })),
      ...((diapers.data as Diaper[]) ?? []).map((d) => ({ kind: 'diaper' as const, id: d.id, time: d.time, data: d })),
      ...((pumping.data as PumpingSession[]) ?? []).map((p) => ({ kind: 'pumping' as const, id: p.id, time: p.end_time ?? p.start_time, data: p }))
    ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

    setEntries(merged)
    setLoading(false)
  }

  useEffect(() => {
    load()
    const tables = ['sleep_sessions', 'feedings', 'diapers', 'pumping_sessions']
    const channels = tables.map((table) =>
      supabase
        .channel(`${table}-${childId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table, filter: `child_id=eq.${childId}` }, load)
        .subscribe()
    )
    return () => {
      channels.forEach((c) => supabase.removeChannel(c))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId])

  if (loading) return <p className="text-parchment-300 text-sm">Loading timeline…</p>
  if (entries.length === 0) return <p className="text-parchment-300 text-sm">Nothing logged in the last two days yet.</p>

  return (
    <ul className="flex flex-col gap-2">
      {entries.map((entry) => (
        <li key={`${entry.kind}-${entry.id}`} className="flex items-center gap-3 rounded-xl bg-night-800/60 px-4 py-3">
          <span className="text-xl">{ICONS[entry.kind]}</span>
          <div className="flex-1">
            <p className="text-parchment-100 text-sm">{describe(entry)}</p>
            <p className="text-parchment-300 text-xs">
              {formatClock(entry.time)} · {formatRelative(entry.time)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}
