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
  const [showFinish, setShowFinish] = useState(false)
  const [side, setSide] = useState<Side>('both')
  const [amount, setAmount] = useState('')
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

  const finish = async () => {
    if (!active) return
    setBusy(true)
    await supabase
      .from('pumping_sessions')
      .update({
        end_time: new Date().toISOString(),
        side,
        amount_ml: amount ? Number(amount) : null
      })
      .eq('id', active.id)
    setBusy(false)
    setShowFinish(false)
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
          <button className="btn-primary" onClick={() => setShowFinish(true)} disabled={busy}>
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

      {showFinish && (
        <Modal title="Finish pumping" onClose={() => setShowFinish(false)}>
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
            <button className="btn-primary" onClick={finish} disabled={busy}>
              Save
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
