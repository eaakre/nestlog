import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useNow } from '../lib/useNow'
import { formatElapsed } from '../lib/format'
import Modal from './Modal'
import type { PumpingSession, Side } from '../types'

export default function PumpingCard({ childId }: { childId: string }) {
  const { user } = useAuth()
  const [active, setActive] = useState<PumpingSession | null>(null)
  const [busy, setBusy] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [side, setSide] = useState<Side>('both')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const now = useNow()

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

  const start = async () => {
    if (!user) return
    setBusy(true)
    await supabase.from('pumping_sessions').insert({
      child_id: childId,
      logged_by: user.id,
      start_time: new Date().toISOString()
    })
    setBusy(false)
  }

  const openModal = () => {
    if (!active) return
    setSide(active.side ?? 'both')
    setAmount(active.amount_ml != null ? String(active.amount_ml) : '')
    setNotes(active.notes ?? '')
    setShowModal(true)
  }

  // Save without ending the pump — jots down side/amount so far but leaves
  // end_time null, so the timer on the card keeps counting.
  const saveOnly = async () => {
    if (!active) return
    setBusy(true)
    await supabase
      .from('pumping_sessions')
      .update({ side, amount_ml: amount ? Number(amount) : null, notes: notes || null })
      .eq('id', active.id)
    setBusy(false)
    setShowModal(false)
  }

  const finish = async () => {
    if (!active) return
    setBusy(true)
    await supabase
      .from('pumping_sessions')
      .update({
        end_time: new Date().toISOString(),
        side,
        amount_ml: amount ? Number(amount) : null,
        notes: notes || null
      })
      .eq('id', active.id)
    setBusy(false)
    setShowModal(false)
    setAmount('')
  }

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base">Pumping</h3>
        <span className="text-2xl">🍼</span>
      </div>
      {active ? (
        <>
          <p className="text-3xl font-display tabular-nums">{formatElapsed(active.start_time, now)}</p>
          <button className="btn-primary" onClick={openModal} disabled={busy}>
            Finish
          </button>
        </>
      ) : (
        <>
          <p className="text-parchment-300 text-sm">Not pumping</p>
          <button className="btn-secondary" onClick={start} disabled={busy}>
            Start pumping
          </button>
        </>
      )}

      {showModal && (
        <Modal title="Pumping" onClose={() => setShowModal(false)}>
          <div className="flex flex-col gap-4">
            <div>
              <label className="label">Side</label>
              <div className="flex gap-2">
                {(['left', 'right', 'both'] as Side[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSide(s)}
                    className={side === s ? 'btn-primary flex-1 capitalize' : 'btn-secondary flex-1 capitalize'}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Amount (ml)</label>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                placeholder="e.g. 90"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Notes</label>
              <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
            </div>

            <div className="flex flex-col gap-2">
              <button className="btn-primary" onClick={finish} disabled={busy}>
                Finish pumping
              </button>
              <button className="btn-secondary" onClick={saveOnly} disabled={busy}>
                Save — keep pumping
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
