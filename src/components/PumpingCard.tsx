import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { notifyPartner } from '../lib/notify'
import { useAuth } from '../contexts/AuthContext'
import { useNow } from '../lib/useNow'
import { useRecentRows } from '../lib/useRecentRows'
import { formatElapsed, toDatetimeLocalValue, fromDatetimeLocalValue, formatDurationMinutes } from '../lib/format'
import DateTimeInput from './DateTimeInput'
import ModeToggle, { localValue, thirtyAgo, type EntryMode } from './ModeToggle'
import { describePumping } from '../lib/describe'
import { useUnit, mlToUnit } from '../lib/units'
import { buildPumpFields, pumpFieldText } from '../lib/pumping'
import PumpAmountFields from './PumpAmountFields'
import Modal from './Modal'
import SectionHistory from './SectionHistory'
import TrackerCard from './TrackerCard'
import LastSummary from './LastSummary'
import PumpingEditor from './editors/PumpingEditor'
import type { PumpingSession } from '../types'

export default function PumpingCard({ childId }: { childId: string }) {
  const { user } = useAuth()
  const { unit } = useUnit()
  const [active, setActive] = useState<PumpingSession | null>(null)
  const [busy, setBusy] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [left, setLeft] = useState('')
  const [right, setRight] = useState('')
  const [notes, setNotes] = useState('')
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [mode, setMode] = useState<EntryMode>('live')
  // An untouched start time means "now" at the moment you tap Start, not when the screen opened.
  const startTouched = useRef(false)
  const editStartText = (v: string) => {
    startTouched.current = true
    setEditStart(v)
  }
  const [editing, setEditing] = useState<PumpingSession | null>(null)
  const now = useNow()
  const { rows, reload } = useRecentRows<PumpingSession>('pumping_sessions', childId, 'start_time')

  const loadActive = async () => {
    if (!user) return
    const { data } = await supabase
      .from('pumping_sessions')
      .select('*')
      .eq('logged_by', user.id)
      .is('end_time', null)
      .order('start_time', { ascending: false })
      .limit(1)
      .maybeSingle()
    setActive((data as PumpingSession) ?? null)
  }

  useEffect(() => {
    loadActive()
    if (!user) return
    const channel = supabase
      .channel(`pumping-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pumping_sessions', filter: `logged_by=eq.${user.id}` }, loadActive)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // Quick start: begins timing right now. The + button opens the modal instead.
  const start = async (startIso = new Date().toISOString(), startNotes: string | null = null) => {
    if (!user) return
    setBusy(true)
    await supabase.from('pumping_sessions').insert({
      child_id: childId,
      logged_by: user.id,
      start_time: startIso,
      notes: startNotes
    })
    notifyPartner(childId, 'pump_start')
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
      const t = pumpFieldText(active, unit)
      setLeft(t.left)
      setRight(t.right)
      setNotes(active.notes ?? '')
    } else {
      setLeft('')
      setRight('')
      setNotes('')
      setEditStart(toDatetimeLocalValue(new Date().toISOString()))
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

  // Log a pump that already happened, with its amounts.
  const saveFinished = async () => {
    if (!user || !editStart || !editEnd) return
    setBusy(true)
    await supabase.from('pumping_sessions').insert({
      child_id: childId,
      logged_by: user.id,
      start_time: fromDatetimeLocalValue(editStart),
      end_time: fromDatetimeLocalValue(editEnd),
      ...buildPumpFields({ left, right, unit }),
      notes: notes || null
    })
    setBusy(false)
    setShowModal(false)
    setLeft('')
    setRight('')
    reload()
  }

  const doneMinutes = editStart && editEnd ? (new Date(fromDatetimeLocalValue(editEnd)).getTime() - new Date(fromDatetimeLocalValue(editStart)).getTime()) / 60000 : 0

  // Save without ending the pump — the timer keeps counting.
  const saveOnly = async () => {
    if (!active) return
    setBusy(true)
    await supabase
      .from('pumping_sessions')
      .update({ ...buildPumpFields({ left, right, unit, existing: active }), notes: notes || null })
      .eq('id', active.id)
    setBusy(false)
    setShowModal(false)
    reload()
  }

  const finish = async () => {
    if (!active) return
    setBusy(true)
    await supabase
      .from('pumping_sessions')
      .update({
        end_time: new Date().toISOString(),
        ...buildPumpFields({ left, right, unit, existing: active }),
        notes: notes || null
      })
      .eq('id', active.id)
    setBusy(false)
    setShowModal(false)
    setLeft('')
    setRight('')
    loadActive()
    reload()
  }

  const lastDone = rows.find((r) => r.end_time)

  return (
    <TrackerCard title="Pumping" color="pump" onAdd={openModal}>
      {!active && lastDone && (
        <LastSummary
          icon="🍼"
          label="Last pump"
          time={lastDone.end_time}
          value={lastDone.amount_ml != null ? String(mlToUnit(lastDone.amount_ml, unit)) : '—'}
          valueSub={lastDone.amount_ml != null ? unit : undefined}
        />
      )}

      {active ? (
        <>
          <p className="text-4xl font-display tabular-nums">{formatElapsed(active.start_time, now)}</p>
          <button className="btn-primary" onClick={openModal} disabled={busy}>
            Finish
          </button>
        </>
      ) : (
        <button className="btn-secondary" onClick={() => start()} disabled={busy}>
          Start pumping
        </button>
      )}

      {showModal && (
        <Modal title="Pumping" onClose={() => setShowModal(false)}>
          <div className="flex flex-col gap-4">
            {active ? (
              <PumpAmountFields unit={unit} left={left} right={right} onLeft={setLeft} onRight={setRight} />
            ) : (
              <>
                <ModeToggle mode={mode} onChange={changeMode} liveLabel="Start now" />
                <div className="text-center py-2">
                  <p className="text-parchment-300 text-sm mb-1">{mode === 'done' ? 'Total time' : 'Not started'}</p>
                  <p className="text-4xl font-display tabular-nums">{mode === 'done' ? (doneMinutes > 0 ? formatDurationMinutes(doneMinutes) : '—') : '0m'}</p>
                </div>
                <div>
                  <label className="label">Start time</label>
                  <DateTimeInput value={editStart} onChange={editStartText} />
                </div>
                {mode === 'done' && (
                  <>
                    <div>
                      <label className="label">End time</label>
                      <DateTimeInput value={editEnd} onChange={setEditEnd} />
                    </div>
                    <PumpAmountFields unit={unit} left={left} right={right} onLeft={setLeft} onRight={setRight} />
                  </>
                )}
              </>
            )}
            <div>
              <label className="label">Notes</label>
              <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
            </div>

            {active ? (
              <div className="flex flex-col gap-2">
                <button className="btn-primary" onClick={finish} disabled={busy}>
                  Finish pumping
                </button>
                <button className="btn-secondary" onClick={saveOnly} disabled={busy}>
                  Save — keep pumping
                </button>
              </div>
            ) : mode === 'done' ? (
              <button className="btn-primary" onClick={saveFinished} disabled={busy || !(doneMinutes > 0)}>
                Save pump
              </button>
            ) : (
              <button className="btn-primary" onClick={() => start(startTouched.current ? fromDatetimeLocalValue(editStart) : new Date().toISOString(), notes || null)} disabled={busy || !editStart}>
                Start pumping
              </button>
            )}
          </div>
        </Modal>
      )}

      {/* Pumping is per-person: you can edit your own sessions, not your partner's. */}
      <SectionHistory<PumpingSession>
        rows={rows}
        timeField="start_time"
        describe={describePumping}
        icon="🍼"
        onSelect={setEditing}
        canSelect={(r) => r.logged_by === user?.id}
      />

      {editing && (
        <PumpingEditor
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
