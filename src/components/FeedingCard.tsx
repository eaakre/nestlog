import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useNow } from '../lib/useNow'
import { formatElapsed } from '../lib/format'
import { describeFeeding } from '../lib/describe'
import Modal from './Modal'
import TypeChooser from './TypeChooser'
import SectionHistory from './SectionHistory'
import TrackerCard from './TrackerCard'
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
  const [showChooser, setShowChooser] = useState(false)
  const [type, setType] = useState<FeedingType>('breast')
  const [busy, setBusy] = useState(false)
  const now = useNow()

  // The DB row for an in-progress breastfeed session — created as soon as a
  // side starts timing, updated on every "Save", finalized (end_time set)
  // when the feed is marked done. While it's set, the card shows a live
  // "feeding in progress" state, resumable from any device.
  const [activeFeedingId, setActiveFeedingId] = useState<string | null>(null)
  const [sessionStart, setSessionStart] = useState<number | null>(null)

  const [leftSeconds, setLeftSeconds] = useState(0)
  const [rightSeconds, setRightSeconds] = useState(0)
  const [activeSide, setActiveSide] = useState<ActiveSide>(null)
  const [activeSince, setActiveSince] = useState<number | null>(null)
  const [lastSide, setLastSide] = useState<Side | null>(null)
  const [previousLastSide, setPreviousLastSide] = useState<Side | null>(null)
  const [notes, setNotes] = useState('')

  const [amount, setAmount] = useState('')

  // Pick up an in-progress breastfeed on load (e.g. you or your partner
  // started one earlier and didn't finish it yet).
  useEffect(() => {
    supabase
      .from('feedings')
      .select('*')
      .eq('child_id', childId)
      .eq('type', 'breast')
      .is('end_time', null)
      .order('start_time', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const f = data as Feeding | null
        if (f && !activeSide) {
          setActiveFeedingId(f.id)
          setSessionStart(new Date(f.start_time).getTime())
          setLeftSeconds((f.duration_left_minutes ?? 0) * 60)
          setRightSeconds((f.duration_right_minutes ?? 0) * 60)
          setLastSide(f.side)
        }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId])

  useEffect(() => {
    if (!open || type !== 'breast' || activeFeedingId) return
    supabase
      .from('feedings')
      .select('side')
      .eq('child_id', childId)
      .eq('type', 'breast')
      .not('end_time', 'is', null)
      .order('start_time', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setPreviousLastSide((data as Pick<Feeding, 'side'> | null)?.side ?? null))
  }, [open, type, childId, activeFeedingId])

  const runningExtra = activeSide && activeSince ? (now - activeSince) / 1000 : 0
  const liveLeft = leftSeconds + (activeSide === 'left' ? runningExtra : 0)
  const liveRight = rightSeconds + (activeSide === 'right' ? runningExtra : 0)

  const ensureRow = async (): Promise<string | null> => {
    if (activeFeedingId) return activeFeedingId
    if (!user) return null
    const startIso = new Date().toISOString()
    const { data } = await supabase
      .from('feedings')
      .insert({
        child_id: childId,
        logged_by: user.id,
        type: 'breast',
        start_time: startIso,
        end_time: null,
        side: null,
        amount_ml: null,
        duration_minutes: 0,
        duration_left_minutes: 0,
        duration_right_minutes: 0
      })
      .select()
      .single()
    if (data) {
      setActiveFeedingId(data.id)
      setSessionStart(new Date(data.start_time).getTime())
      return data.id
    }
    return null
  }

  const toggleSide = async (side: 'left' | 'right') => {
    const nowMs = Date.now()
    if (activeSide === side) {
      const elapsed = (nowMs - (activeSince ?? nowMs)) / 1000
      if (side === 'left') setLeftSeconds((s) => s + elapsed)
      else setRightSeconds((s) => s + elapsed)
      setActiveSide(null)
      setActiveSince(null)
      return
    }
    if (activeSide) {
      const elapsed = (nowMs - (activeSince ?? nowMs)) / 1000
      if (activeSide === 'left') setLeftSeconds((s) => s + elapsed)
      else setRightSeconds((s) => s + elapsed)
    }
    setActiveSide(side)
    setActiveSince(nowMs)
    setLastSide(side)
    await ensureRow()
  }

  const resetLocal = () => {
    setLeftSeconds(0)
    setRightSeconds(0)
    setActiveSide(null)
    setActiveSince(null)
    setLastSide(null)
    setSessionStart(null)
    setActiveFeedingId(null)
    setNotes('')
    setAmount('')
  }

  // Persist current progress but leave the session open — the timer on the
  // card keeps going, and reopening this modal (from any device) resumes it.
  const saveProgress = async () => {
    if (activeSide) {
      // stop the ticking side locally so the saved numbers and the UI agree
      const elapsed = (Date.now() - (activeSince ?? Date.now())) / 1000
      if (activeSide === 'left') setLeftSeconds((s) => s + elapsed)
      else setRightSeconds((s) => s + elapsed)
      setActiveSide(null)
      setActiveSince(null)
    }
    if (activeFeedingId) {
      setBusy(true)
      const finalLeft = liveLeft
      const finalRight = liveRight
      await supabase
        .from('feedings')
        .update({
          side: lastSide,
          duration_minutes: Math.round(((finalLeft + finalRight) / 60) * 10) / 10,
          duration_left_minutes: Math.round((finalLeft / 60) * 10) / 10,
          duration_right_minutes: Math.round((finalRight / 60) * 10) / 10,
          notes: notes || null
        })
        .eq('id', activeFeedingId)
      setBusy(false)
    }
    setOpen(false)
  }

  const finishBreastfeed = async () => {
    if (!user) return
    setBusy(true)
    const finalLeft = liveLeft
    const finalRight = liveRight
    const id = activeFeedingId ?? (await ensureRow())
    if (id) {
      await supabase
        .from('feedings')
        .update({
          side: lastSide,
          duration_minutes: Math.round(((finalLeft + finalRight) / 60) * 10) / 10,
          duration_left_minutes: Math.round((finalLeft / 60) * 10) / 10,
          duration_right_minutes: Math.round((finalRight / 60) * 10) / 10,
          notes: notes || null,
          end_time: new Date().toISOString()
        })
        .eq('id', id)
    }
    setBusy(false)
    setOpen(false)
    resetLocal()
  }

  const saveBottleOrSolid = async () => {
    if (!user) return
    setBusy(true)
    const nowIso = new Date().toISOString()
    await supabase.from('feedings').insert({
      child_id: childId,
      logged_by: user.id,
      type,
      side: null,
      amount_ml: type === 'bottle' && amount ? Number(amount) : null,
      duration_minutes: null,
      duration_left_minutes: null,
      duration_right_minutes: null,
      start_time: nowIso,
      end_time: nowIso,
      notes: notes || null
    })
    setBusy(false)
    setOpen(false)
    setAmount('')
    setNotes('')
  }

  const closeModal = () => setOpen(false)

  const handleAdd = () => {
    if (activeFeedingId) {
      setType('breast')
      setOpen(true)
    } else {
      setShowChooser(true)
    }
  }

  const chooseType = (t: FeedingType) => {
    setType(t)
    setShowChooser(false)
    setOpen(true)
  }

  const totalSeconds = liveLeft + liveRight
  const total = fmtMinSec(totalSeconds)
  const leftT = fmtMinSec(liveLeft)
  const rightT = fmtMinSec(liveRight)

  return (
    <TrackerCard title="Feeding" color="feed" onAdd={handleAdd}>
      {activeFeedingId ? (
        <>
          <p className="text-4xl font-display tabular-nums">{formatElapsed(new Date(sessionStart ?? Date.now()).toISOString(), now)}</p>
          <button className="btn-primary" onClick={handleAdd}>
            Continue feeding
          </button>
        </>
      ) : (
        <>
          <p className="text-parchment-200 text-base">Log a feed</p>
          <button className="btn-secondary" onClick={handleAdd}>
            Log feeding
          </button>
        </>
      )}

      {showChooser && (
        <TypeChooser
          title="Log feeding"
          onClose={() => setShowChooser(false)}
          options={[
            { key: 'breast', label: 'Breastfeed', icon: '🤱', onSelect: () => chooseType('breast') },
            { key: 'bottle', label: 'Bottle Feed', icon: '🍼', onSelect: () => chooseType('bottle') },
            { key: 'solid', label: 'Solid Food', icon: '🥣', onSelect: () => chooseType('solid') }
          ]}
        />
      )}

      {open && (
        <Modal title={type === 'breast' ? 'Breastfeed' : type === 'bottle' ? 'Bottle Feed' : 'Solid Food'} onClose={closeModal}>
          <div className="flex flex-col gap-4">
            {type === 'breast' && (
              <>
                {!activeFeedingId && leftSeconds === 0 && rightSeconds === 0 && previousLastSide && (
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

            {type === 'breast' ? (
              <div className="flex flex-col gap-2">
                <button className="btn-primary" onClick={finishBreastfeed} disabled={busy}>
                  Done feeding
                </button>
                <button className="btn-secondary" onClick={saveProgress} disabled={busy}>
                  Save — keep feeding
                </button>
              </div>
            ) : (
              <button className="btn-primary" onClick={saveBottleOrSolid} disabled={busy}>
                Save
              </button>
            )}
          </div>
        </Modal>
      )}

      <SectionHistory<Feeding> table="feedings" childId={childId} timeField="start_time" describe={describeFeeding} icon="🍽️" />
    </TrackerCard>
  )
}
