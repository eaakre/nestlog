import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { notifyPartner } from '../lib/notify'
import { useAuth } from '../contexts/AuthContext'
import { useNow } from '../lib/useNow'
import { useRecentRows } from '../lib/useRecentRows'
import { formatElapsed, toDatetimeLocalValue, fromDatetimeLocalValue, formatDurationMinutes } from '../lib/format'
import { describeSleep } from '../lib/describe'
import Modal from './Modal'
import SectionHistory from './SectionHistory'
import TrackerCard from './TrackerCard'
import LastSummary from './LastSummary'
import SleepEditor from './editors/SleepEditor'
import type { SleepSession } from '../types'
import DateTimeInput from './DateTimeInput'
import ModeToggle, { localValue, thirtyAgo, type EntryMode } from './ModeToggle'

export default function SleepCard({ childId }: { childId: string }) {
  const { user } = useAuth()
  const [active, setActive] = useState<SleepSession | null>(null)
  const [busy, setBusy] = useState(false)
  const now = useNow()
  const { rows, reload } = useRecentRows<SleepSession>('sleep_sessions', childId, 'start_time')

  const [showModal, setShowModal] = useState(false)
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [mode, setMode] = useState<EntryMode>('live')
  // An untouched start time means "now" at the moment you tap Start, not when the screen opened.
  const startTouched = useRef(false)
  const editStartText = (v: string) => {
    startTouched.current = true
    setEditStart(v)
  }
  const [notes, setNotes] = useState('')
  const [editing, setEditing] = useState<SleepSession | null>(null)

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

  // Quick start: begins timing right now. The + button opens the modal instead.
  const start = async (startIso = new Date().toISOString(), startNotes: string | null = null) => {
    if (!user) return
    setBusy(true)
    await supabase.from('sleep_sessions').insert({
      child_id: childId,
      logged_by: user.id,
      start_time: startIso,
      notes: startNotes
    })
    notifyPartner(childId, 'sleep_start')
    setBusy(false)
    setShowModal(false)
    loadActive()
    reload()
  }

  const openModal = () => {
    startTouched.current = false
    setMode('live')
    setEditEnd('')
    if (active) {
      setEditStart(toDatetimeLocalValue(active.start_time))
      setNotes(active.notes ?? '')
    } else {
      setEditStart(toDatetimeLocalValue(new Date().toISOString()))
      setNotes('')
    }
    setShowModal(true)
  }

  const changeMode = (m: EntryMode) => {
    setMode(m)
    startTouched.current = m === 'done'
    if (m === 'done') {
      setEditEnd(localValue(new Date()))
      setEditStart(thirtyAgo())
    } else {
      setEditEnd('')
      setEditStart(localValue(new Date()))
    }
  }

  // Log a sleep that already happened.
  const saveFinished = async () => {
    if (!user || !editStart || !editEnd) return
    setBusy(true)
    await supabase.from('sleep_sessions').insert({
      child_id: childId,
      logged_by: user.id,
      start_time: fromDatetimeLocalValue(editStart),
      end_time: fromDatetimeLocalValue(editEnd),
      notes: notes || null
    })
    setBusy(false)
    setShowModal(false)
    reload()
  }

  const doneMinutes = editStart && editEnd ? (new Date(fromDatetimeLocalValue(editEnd)).getTime() - new Date(fromDatetimeLocalValue(editStart)).getTime()) / 60000 : 0

  const liveMinutes = editStart ? Math.max(0, (now - new Date(fromDatetimeLocalValue(editStart)).getTime()) / 60000) : 0

  // Save without ending the sleep — the timer keeps counting.
  const saveOnly = async () => {
    if (!active) return
    setBusy(true)
    await supabase
      .from('sleep_sessions')
      .update({ start_time: fromDatetimeLocalValue(editStart), notes: notes || null })
      .eq('id', active.id)
    notifyPartner(childId, 'sleep_end', formatDurationMinutes(liveMinutes) ?? undefined)
    setBusy(false)
    setShowModal(false)
    loadActive()
    reload()
  }

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
    loadActive()
    reload()
  }

  const lastDone = rows.find((r) => r.end_time)
  const lastMinutes = lastDone?.end_time ? (new Date(lastDone.end_time).getTime() - new Date(lastDone.start_time).getTime()) / 60000 : 0

  return (
    <TrackerCard title="Sleep" color="sleep" onAdd={openModal}>
      {!active && lastDone && (
        <LastSummary icon="🌙" label="Woke up" time={lastDone.end_time} value={formatDurationMinutes(lastMinutes) ?? ''} />
      )}

      {active ? (
        <>
          <p className="text-4xl font-display tabular-nums">{formatElapsed(active.start_time, now)}</p>
          <button className="btn-primary" onClick={openModal} disabled={busy}>
            Wake up
          </button>
        </>
      ) : (
        <button className="btn-secondary" onClick={() => start()} disabled={busy}>
          Start sleep
        </button>
      )}

      {showModal && (
        <Modal title="Sleep" onClose={() => setShowModal(false)}>
          <div className="flex flex-col gap-4">
            {!active && <ModeToggle mode={mode} onChange={changeMode} liveLabel="Start now" />}

            <div className="text-center py-2">
              <p className="text-parchment-300 text-sm mb-1">{active ? 'Total time so far' : mode === 'done' ? 'Total sleep' : 'Not started'}</p>
              <p className="text-4xl font-display tabular-nums">
                {active ? formatDurationMinutes(liveMinutes) : mode === 'done' ? (doneMinutes > 0 ? formatDurationMinutes(doneMinutes) : '—') : '0m'}
              </p>
            </div>

            <div>
              <label className="label">Start time</label>
              <DateTimeInput value={editStart} onChange={editStartText} />
            </div>
            {!active && mode === 'done' && (
              <div>
                <label className="label">End time</label>
                <DateTimeInput value={editEnd} onChange={setEditEnd} />
              </div>
            )}
            <div>
              <label className="label">Notes</label>
              <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
            </div>

            {active ? (
              <div className="flex flex-col gap-2">
                <button className="btn-primary" onClick={wakeUp} disabled={busy}>
                  Wake up &amp; stop
                </button>
                <button className="btn-secondary" onClick={saveOnly} disabled={busy}>
                  Save — keep sleeping
                </button>
              </div>
            ) : mode === 'done' ? (
              <button className="btn-primary" onClick={saveFinished} disabled={busy || !(doneMinutes > 0)}>
                Save sleep
              </button>
            ) : (
              <button className="btn-primary" onClick={() => start(startTouched.current ? fromDatetimeLocalValue(editStart) : new Date().toISOString(), notes || null)} disabled={busy || !editStart}>
                Start sleep
              </button>
            )}
          </div>
        </Modal>
      )}

      <SectionHistory<SleepSession> rows={rows} timeField="start_time" describe={describeSleep} icon="🌙" onSelect={setEditing} />

      {editing && (
        <SleepEditor
          entry={editing}
          onClose={() => setEditing(null)}
          onChanged={() => {
            reload()
            loadActive()
          }}
        />
      )}
    </TrackerCard>
  )
}
