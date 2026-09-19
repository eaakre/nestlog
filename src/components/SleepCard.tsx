import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useNow } from '../lib/useNow'
import { formatElapsed, toDatetimeLocalValue, fromDatetimeLocalValue, formatDurationMinutes } from '../lib/format'
import { describeSleep } from '../lib/describe'
import Modal from './Modal'
import SectionHistory from './SectionHistory'
import TrackerCard from './TrackerCard'
import type { SleepSession } from '../types'

export default function SleepCard({ childId }: { childId: string }) {
  const { user } = useAuth()
  const [active, setActive] = useState<SleepSession | null>(null)
  const [busy, setBusy] = useState(false)
  const now = useNow()

  const [showModal, setShowModal] = useState(false)
  const [editStart, setEditStart] = useState('')
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

  const openModal = () => {
    if (!active) return
    setEditStart(toDatetimeLocalValue(active.start_time))
    setNotes(active.notes ?? '')
    setShowModal(true)
  }

  const liveMinutes = editStart
    ? Math.max(0, (now - new Date(fromDatetimeLocalValue(editStart)).getTime()) / 60000)
    : 0

  // Save without ending the sleep — just updates the start time / notes on the
  // still-open session. The timer keeps counting.
  const saveOnly = async () => {
    if (!active) return
    setBusy(true)
    await supabase
      .from('sleep_sessions')
      .update({ start_time: fromDatetimeLocalValue(editStart), notes: notes || null })
      .eq('id', active.id)
    setBusy(false)
    setShowModal(false)
  }

  // Actually ends the sleep session.
  const wakeUp = async () => {
    if (!active) return
    setBusy(true)
    await supabase
      .from('sleep_sessions')
      .update({
        start_time: fromDatetimeLocalValue(editStart),
        end_time: new Date().toISOString(),
        notes: notes || null
      })
      .eq('id', active.id)
    setBusy(false)
    setShowModal(false)
  }

  return (
    <TrackerCard title="Sleep" color="sleep" onAdd={active ? openModal : start}>
      {active ? (
        <>
          <p className="text-4xl font-display tabular-nums">{formatElapsed(active.start_time, now)}</p>
          <button className="btn-primary" onClick={openModal} disabled={busy}>
            Wake up
          </button>
        </>
      ) : (
        <>
          <p className="text-parchment-200 text-base">Not sleeping</p>
          <button className="btn-secondary" onClick={start} disabled={busy}>
            Start sleep
          </button>
        </>
      )}

      {showModal && (
        <Modal title="Sleep" onClose={() => setShowModal(false)}>
          <div className="flex flex-col gap-4">
            <div className="text-center py-2">
              <p className="text-parchment-300 text-sm mb-1">Total time so far</p>
              <p className="text-4xl font-display tabular-nums">{formatDurationMinutes(liveMinutes)}</p>
            </div>

            <div>
              <label className="label">Start time</label>
              <input className="input" type="datetime-local" value={editStart} onChange={(e) => setEditStart(e.target.value)} />
            </div>
            <div>
              <label className="label">Notes</label>
              <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
            </div>

            <div className="flex flex-col gap-2">
              <button className="btn-primary" onClick={wakeUp} disabled={busy}>
                Wake up &amp; stop
              </button>
              <button className="btn-secondary" onClick={saveOnly} disabled={busy}>
                Save — keep sleeping
              </button>
            </div>
          </div>
        </Modal>
      )}

      <SectionHistory<SleepSession> table="sleep_sessions" childId={childId} timeField="start_time" describe={describeSleep} icon="🌙" />
    </TrackerCard>
  )
}
