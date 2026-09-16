import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Modal from './Modal'
import type { FeedingType, Side } from '../types'

export default function FeedingCard({ childId }: { childId: string }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<FeedingType>('bottle')
  const [side, setSide] = useState<Side>('left')
  const [amount, setAmount] = useState('')
  const [duration, setDuration] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!user) return
    setBusy(true)
    await supabase.from('feedings').insert({
      child_id: childId,
      logged_by: user.id,
      type,
      side: type === 'breast' ? side : null,
      amount_ml: type === 'bottle' && amount ? Number(amount) : null,
      duration_minutes: type === 'breast' && duration ? Number(duration) : null,
      start_time: new Date().toISOString()
    })
    setBusy(false)
    setOpen(false)
    setAmount('')
    setDuration('')
  }

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base">Feeding</h3>
        <span className="text-2xl">🍽️</span>
      </div>
      <p className="text-parchment-300 text-sm">Log a feed</p>
      <button className="btn-secondary" onClick={() => setOpen(true)}>
        Log feeding
      </button>

      {open && (
        <Modal title="Log feeding" onClose={() => setOpen(false)}>
          <div className="flex flex-col gap-4">
            <div>
              <label className="label">Type</label>
              <div className="flex gap-2">
                {(['breast', 'bottle', 'solid'] as FeedingType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={type === t ? 'btn-primary flex-1 capitalize' : 'btn-secondary flex-1 capitalize'}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {type === 'breast' && (
              <>
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
                  <label className="label">Duration (minutes)</label>
                  <input className="input" type="number" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} />
                </div>
              </>
            )}

            {type === 'bottle' && (
              <div>
                <label className="label">Amount (ml)</label>
                <input className="input" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
            )}

            <button className="btn-primary" onClick={save} disabled={busy}>
              Save
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
