import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { notifyPartner } from '../lib/notify'
import { useAuth } from '../contexts/AuthContext'
import { useNow } from '../lib/useNow'
import { useRecentRows } from '../lib/useRecentRows'
import { formatElapsed, toDatetimeLocalValue, fromDatetimeLocalValue } from '../lib/format'
import DateTimeInput from './DateTimeInput'
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
                <div className="text-center py-2">
                  <p className="text-parchment-300 text-sm mb-1">Not started</p>
                  <p className="text-4xl font-display tabular-nums">0m</p>
                </div>
                <div>
                  <label className="label">Start time</label>
                  <DateTimeInput value={editStart} onChange={setEditStart} />
                </div>
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
            ) : (
              <button className="btn-primary" onClick={() => start(fromDatetimeLocalValue(editStart), notes || null)} disabled={busy || !editStart}>
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
