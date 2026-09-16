import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useNow } from '../lib/useNow'
import { formatElapsed } from '../lib/format'
import type { SleepSession } from '../types'

export default function SleepCard({ childId }: { childId: string }) {
  const { user } = useAuth()
  const [active, setActive] = useState<SleepSession | null>(null)
  const [busy, setBusy] = useState(false)
  const now = useNow()

  const loadActive = async () => {
    const { data } = await supabase
      .from('sleep_sessions')
      .select('*')
      .eq('child_id', childId)
      .is('end_time', null)
      .order('start_time', { ascending: false })
      .limit(1)
      .maybeSingle()
    setActive((data as SleepSession) ?? null)
  }

  useEffect(() => {
    loadActive()
    const channel = supabase
      .channel(`sleep-${childId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sleep_sessions', filter: `child_id=eq.${childId}` }, loadActive)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId])

  const start = async () => {
    if (!user) return
    setBusy(true)
    await supabase.from('sleep_sessions').insert({
      child_id: childId,
      logged_by: user.id,
      start_time: new Date().toISOString()
    })
    setBusy(false)
  }

  const stop = async () => {
    if (!active) return
    setBusy(true)
    await supabase.from('sleep_sessions').update({ end_time: new Date().toISOString() }).eq('id', active.id)
    setBusy(false)
  }

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base">Sleep</h3>
        <span className="text-2xl">🌙</span>
      </div>
      {active ? (
        <>
          <p className="text-3xl font-display tabular-nums">{formatElapsed(active.start_time, now)}</p>
          <button className="btn-primary" onClick={stop} disabled={busy}>
            Wake up
          </button>
        </>
      ) : (
        <>
          <p className="text-parchment-300 text-sm">Not sleeping</p>
          <button className="btn-secondary" onClick={start} disabled={busy}>
            Start sleep
          </button>
        </>
      )}
    </div>
  )
}
