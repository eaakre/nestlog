import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useNow } from '../lib/useNow'
import Modal from './Modal'
import type { FeedingType, Side, Feeding } from '../types'

type ActiveSide = 'left' | 'right' | null

function fmtMinSec(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
  const s = Math.floor(totalSeconds % 60)
  return { m, s }
}

export default function FeedingCard({ childId }: { childId: string }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<FeedingType>('breast')
  const [busy, setBusy] = useState(false)
  const now = useNow()

  // Breast: two independent accumulators + which one (if any) is currently running
  const [leftSeconds, setLeftSeconds] = useState(0)
  const [rightSeconds, setRightSeconds] = useState(0)
  const [activeSide, setActiveSide] = useState<ActiveSide>(null)
  const [activeSince, setActiveSince] = useState<number | null>(null)
  const [lastSide, setLastSide] = useState<Side | null>(null)
  const [sessionStart, setSessionStart] = useState<number | null>(null)
  const [previousLastSide, setPreviousLastSide] = useState<Side | null>(null)
  const [notes, setNotes] = useState('')

  // Bottle
  const [amount, setAmount] = useState('')

  // Load the side used on the last breastfeed, so you know where to start —
  // same idea as Nara's "last side" badge.
  useEffect(() => {
    if (!open || type !== 'breast') return
    supabase
      .from('feedings')
      .select('side')
      .eq('child_id', childId)
      .eq('type', 'breast')
      .order('start_time', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setPreviousLastSide((data as Pick<Feeding, 'side'> | null)?.side ?? null))
  }, [open, type, childId])

  const runningExtra = activeSide && activeSince ? (now - activeSince) / 1000 : 0
  const liveLeft = leftSeconds + (activeSide === 'left' ? runningExtra : 0)
  const liveRight = rightSeconds + (activeSide === 'right' ? runningExtra : 0)

  const toggleSide = (side: 'left' | 'right') => {
    const nowMs = Date.now()
    if (activeSide === side) {
      // stop this side
      const elapsed = (nowMs - (activeSince ?? nowMs)) / 1000
      if (side === 'left') setLeftSeconds((s) => s + elapsed)
      else setRightSeconds((s) => s + elapsed)
      setActiveSide(null)
      setActiveSince(null)
      return
    }
    // switch from the other side, or start fresh
    if (activeSide) {
      const elapsed = (nowMs - (activeSince ?? nowMs)) / 1000
      if (activeSide === 'left') setLeftSeconds((s) => s + elapsed)
      else setRightSeconds((s) => s + elapsed)
    }
    setActiveSide(side)
    setActiveSince(nowMs)
    setLastSide(side)
    setSessionStart((prev) => prev ?? nowMs)
  }

  const reset = () => {
    setLeftSeconds(0)
    setRightSeconds(0)
    setActiveSide(null)
    setActiveSince(null)
    setLastSide(null)
    setSessionStart(null)
    setNotes('')
    setAmount('')
  }

  const save = async () => {
    if (!user) return
    setBusy(true)

    if (type === 'breast') {
      const finalLeft = liveLeft
      const finalRight = liveRight
      await supabase.from('feedings').insert({
        child_id: childId,
        logged_by: user.id,
        type: 'breast',
        side: lastSide,
        duration_minutes: Math.round(((finalLeft + finalRight) / 60) * 10) / 10,
        duration_left_minutes: Math.round((finalLeft / 60) * 10) / 10,
        duration_right_minutes: Math.round((finalRight / 60) * 10) / 10,
        amount_ml: null,
        start_time: new Date(sessionStart ?? Date.now()).toISOString(),
        notes: notes || null
      })
    } else if (type === 'bottle') {
      await supabase.from('feedings').insert({
        child_id: childId,
        logged_by: user.id,
        type: 'bottle',
        side: null,
        amount_ml: amount ? Number(amount) : null,
        duration_minutes: null,
        duration_left_minutes: null,
        duration_right_minutes: null,
        start_time: new Date().toISOString(),
        notes: notes || null
      })
    } else {
      await supabase.from('feedings').insert({
        child_id: childId,
        logged_by: user.id,
        type: 'solid',
        side: null,
        amount_ml: null,
        duration_minutes: null,
        duration_left_minutes: null,
        duration_right_minutes: null,
        start_time: new Date().toISOString(),
        notes: notes || null
      })
    }

    setBusy(false)
    setOpen(false)
    reset()
  }

  const closeAndReset = () => {
    setOpen(false)
    reset()
  }

  const totalSeconds = liveLeft + liveRight
  const total = fmtMinSec(totalSeconds)
  const leftT = fmtMinSec(liveLeft)
  const rightT = fmtMinSec(liveRight)

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
        <Modal title="Log feeding" onClose={closeAndReset}>
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
                {!activeSide && leftSeconds === 0 && rightSeconds === 0 && previousLastSide && (
                  <div className="rounded-xl bg-night-950 border border-night-700 px-4 py-2 text-sm flex items-center justify-between">
                    <span className="text-parchment-300">Last side</span>
                    <span className="capitalize text-parchment-100 font-semibold">{previousLastSide}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col items-center gap-2">
                    <p className="font-display text-2xl tabular-nums">
                      {leftT.m}
                      <span className="text-sm align-top">m</span> {leftT.s}
                      <span className="text-sm align-top">s</span>
                    </p>
                    <button
                      className={activeSide === 'left' ? 'btn-primary w-full' : 'btn-secondary w-full'}
                      onClick={() => toggleSide('left')}
                    >
                      {activeSide === 'left' ? 'Stop' : 'Start Left'}
                    </button>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <p className="font-display text-2xl tabular-nums">
                      {rightT.m}
                      <span className="text-sm align-top">m</span> {rightT.s}
                      <span className="text-sm align-top">s</span>
                    </p>
                    <button
                      className={activeSide === 'right' ? 'btn-primary w-full' : 'btn-secondary w-full'}
                      onClick={() => toggleSide('right')}
                    >
                      {activeSide === 'right' ? 'Stop' : 'Start Right'}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm border-t border-night-700 pt-3">
                  <span className="text-parchment-300">Total time</span>
                  <span className="text-parchment-100">
                    {total.m}m {total.s}s
                  </span>
                </div>
                {lastSide && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-parchment-300">Last side (this feed)</span>
                    <span className="text-parchment-100 capitalize">{lastSide}</span>
                  </div>
                )}
              </>
            )}

            {type === 'bottle' && (
              <div>
                <label className="label">Amount (ml)</label>
                <input className="input" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
            )}

            <div>
              <label className="label">Notes</label>
              <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
            </div>

            <button className="btn-primary" onClick={save} disabled={busy}>
              Save
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
