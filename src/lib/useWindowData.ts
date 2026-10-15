import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { WeekData } from './timeline'
import type { Diaper, Feeding, PumpingSession, SleepSession } from '../types'

const EMPTY: WeekData = { sleep: [], feedings: [], diapers: [], pumping: [] }

// All four trackers for one child over [fromMs, toMs), kept fresh by realtime.
// Sleep and pumping include sessions that merely overlap the window.
export function useWindowData(childId: string, fromMs: number, toMs: number) {
  const [data, setData] = useState<WeekData>(EMPTY)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!childId) return
    const from = new Date(fromMs).toISOString()
    const to = new Date(toMs).toISOString()
    const overlap = `end_time.is.null,end_time.gte.${from}`
    const [sleep, feedings, diapers, pumping] = await Promise.all([
      supabase.from('sleep_sessions').select('*').eq('child_id', childId).lt('start_time', to).or(overlap).limit(2000),
      supabase.from('feedings').select('*').eq('child_id', childId).gte('start_time', from).lt('start_time', to).limit(2000),
      supabase.from('diapers').select('*').eq('child_id', childId).gte('time', from).lt('time', to).limit(2000),
      supabase.from('pumping_sessions').select('*').eq('child_id', childId).lt('start_time', to).or(overlap).limit(2000)
    ])
    setData({
      sleep: (sleep.data as SleepSession[]) ?? [],
      feedings: (feedings.data as Feeding[]) ?? [],
      diapers: (diapers.data as Diaper[]) ?? [],
      pumping: (pumping.data as PumpingSession[]) ?? []
    })
    setLoading(false)
  }, [childId, fromMs, toMs])

  useEffect(() => {
    reload()
    if (!childId) return
    const channel = supabase.channel(`window-${childId}-${fromMs}`)
    for (const table of ['sleep_sessions', 'feedings', 'diapers', 'pumping_sessions']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `child_id=eq.${childId}` }, reload)
    }
    channel.subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [childId, fromMs, reload])

  return { data, loading, reload }
}
