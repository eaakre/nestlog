import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useNow } from '../lib/useNow'
import { formatElapsed, toDatetimeLocalValue, fromDatetimeLocalValue, formatDurationMinutes } from '../lib/format'
import Modal from './Modal'
import type { SleepSession } from '../types'

export default function SleepCard({ childId }: { childId: string }) {
  const { user } = useAuth()
  const [active, setActive] = useState<SleepSession | null>(null)
  const [busy, setBusy] = useState(false)
  const now = useNow()

  const [showFinish, setShowFinish] = useState(false)
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [notes, setNotes] = useState('')

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

  const openFinish = () => {
    if (!active) return
    setEditStart(toDatetimeLocalValue(active.start_time))
    setEditEnd(toDatetimeLocalValue(new Date().toISOString()))
    setNotes(active.notes ?? '')
    setShowFinish(true)
  }

  const totalMinutes =
    editStart && editEnd
      ? Math.max(0, (new Date(fromDatetimeLocalValue(editEnd)).getTime() - new Date(fromDatetimeLocalValue(editStart)).getTime()) / 60000)
      : 0

  const finish = async () => {
    if (!active) return
    setBusy(true)
    await supabase
      .from('sleep_sessions')
      .update({
        start_time: fromDatetimeLocalValue(editStart),
        end_time: fromDatetimeLocalValue(editEnd),
        notes: notes || null
      })
      .eq('id', active.id)
    setBusy(false)
    setShowFinish(false)
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
          <button className="btn-primary" onClick={openFinish} disabled={busy}>
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

      {showFinish && (
        <Modal title="Sleep" onClose={() => setShowFinish(false)}>
          <div className="flex flex-col gap-4">
            <div className="text-center py-2">
              <p className="text-parchment-300 text-sm mb-1">Total time</p>
              <p className="text-4xl font-display tabular-nums">{formatDurationMinutes(totalMinutes)}</p>
            </div>

            <div>
              <label className="label">Start time</label>
              <input className="input" type="datetime-local" value={editStart} onChange={(e) => setEditStart(e.target.value)} />
            </div>
            <div>
              <label className="label">End time</label>
              <input className="input" type="datetime-local" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} />
            </div>
            <div>
              <label className="label">Notes</label>
              <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
            </div>

            <button className="btn-primary" onClick={finish} disabled={busy}>
              Save
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
