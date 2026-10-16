import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { notifyPartner } from '../lib/notify'
import { useAuth } from '../contexts/AuthContext'
import { useNow } from '../lib/useNow'
import { formatElapsed, fromDatetimeLocalValue } from '../lib/format'
import DateTimeInput from './DateTimeInput'
import ModeToggle, { localValue, thirtyAgo, type EntryMode } from './ModeToggle'
import { describeFeeding } from '../lib/describe'
import { useRecentRows } from '../lib/useRecentRows'
import { useUnit, mlToUnit, unitToMl } from '../lib/units'
import Modal from './Modal'
import TypeChooser from './TypeChooser'
import SectionHistory from './SectionHistory'
import TrackerCard from './TrackerCard'
import LastSummary from './LastSummary'
import FeedingEditor from './editors/FeedingEditor'
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
  const [editing, setEditing] = useState<Feeding | null>(null)
  const now = useNow()
  const { unit } = useUnit()
  const { rows, reload } = useRecentRows<Feeding>('feedings', childId, 'start_time')

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

  // When did it happen: now (live timer) or already finished (typed in).
  const [mode, setMode] = useState<EntryMode>('live')
  const [startText, setStartText] = useState('')
  // Untouched start fields mean "right now" at the moment you tap start/save, not when the screen opened.
  const startTouched = useRef(false)
  const editStartText = (v: string) => {
    startTouched.current = true
    setStartText(v)
  }
  const liveStartIso = () => (startTouched.current && startText ? fromDatetimeLocalValue(startText) : new Date().toISOString())
  const [leftMin, setLeftMin] = useState('')
  const [rightMin, setRightMin] = useState('')
  const [endSide, setEndSide] = useState<'left' | 'right'>('right')

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
    const startIso = liveStartIso()
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
      notifyPartner(childId, 'feed_breast')
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
    setStartText('')
    startTouched.current = false
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
    reload()
  }

  const saveBottleOrSolid = async () => {
    if (!user) return
    setBusy(true)
    const nowIso = liveStartIso()
    await supabase.from('feedings').insert({
      child_id: childId,
      logged_by: user.id,
      type,
      side: null,
      amount_ml: type === 'bottle' && amount ? unitToMl(Number(amount), unit) : null,
      duration_minutes: null,
      duration_left_minutes: null,
      duration_right_minutes: null,
      start_time: nowIso,
      end_time: nowIso,
      notes: notes || null
    })
    notifyPartner(childId, type === 'bottle' ? 'feed_bottle' : 'feed_solid', type === 'bottle' && amount ? `${amount}${unit}` : undefined)
    setBusy(false)
    setOpen(false)
    setAmount('')
    setNotes('')
    reload()
  }

  const closeModal = () => setOpen(false)

  const changeMode = (m: EntryMode) => {
    setMode(m)
    startTouched.current = m === 'done'
    setStartText(m === 'done' ? thirtyAgo() : localValue(new Date()))
  }

  const doneLeft = Math.max(0, Number(leftMin) || 0)
  const doneRight = Math.max(0, Number(rightMin) || 0)

  // Log a breastfeed that already happened, from typed-in minutes per side.
  const saveFinishedBreast = async () => {
    if (!user || !startText || doneLeft + doneRight <= 0) return
    setBusy(true)
    const startIso = fromDatetimeLocalValue(startText)
    const side: Side = doneLeft > 0 && doneRight > 0 ? endSide : doneLeft > 0 ? 'left' : 'right'
    await supabase.from('feedings').insert({
      child_id: childId,
      logged_by: user.id,
      type: 'breast',
      start_time: startIso,
      end_time: new Date(new Date(startIso).getTime() + (doneLeft + doneRight) * 60000).toISOString(),
      side,
      amount_ml: null,
      duration_minutes: doneLeft + doneRight,
      duration_left_minutes: doneLeft,
      duration_right_minutes: doneRight,
      notes: notes || null
    })
    setBusy(false)
    setOpen(false)
    setLeftMin('')
    setRightMin('')
    setNotes('')
    reload()
  }

  const handleAdd = () => {
    if (activeFeedingId) {
      setType('breast')
      setMode('live')
      setOpen(true)
    } else {
      setShowChooser(true)
    }
  }

  const chooseType = (t: FeedingType) => {
    setType(t)
    setMode('live')
    startTouched.current = false
    setStartText(localValue(new Date()))
    setLeftMin('')
    setRightMin('')
    setShowChooser(false)
    setOpen(true)
  }

  const totalSeconds = liveLeft + liveRight
  const total = fmtMinSec(totalSeconds)
  const leftT = fmtMinSec(liveLeft)
  const rightT = fmtMinSec(liveRight)

  // Tapping a row opens its editor; an in-progress breastfeed resumes the live timer instead.
  const onSelectRow = (r: Feeding) => {
    if (r.type === 'breast' && !r.end_time) {
      handleAdd()
      return
    }
    setEditing(r)
  }

  const lastFeed = rows.find((r) => !(r.type === 'breast' && !r.end_time))
  const summary = (() => {
    if (!lastFeed) return null
    if (lastFeed.type === 'bottle') {
      return lastFeed.amount_ml != null
        ? { value: String(mlToUnit(lastFeed.amount_ml, unit)), sub: unit as string | undefined, icon: '🍼' }
        : { value: 'bottle', sub: undefined, icon: '🍼' }
    }
    if (lastFeed.type === 'breast') return { value: lastFeed.side ?? 'breast', sub: lastFeed.side ? 'last side' : undefined, icon: '🤱' }
    return { value: 'solid', sub: undefined, icon: '🥣' }
  })()

  return (
    <TrackerCard title="Feeding" color="feed" onAdd={handleAdd}>
      {!activeFeedingId && lastFeed && summary && (
        <LastSummary icon={summary.icon} label="Last feeding" time={lastFeed.end_time ?? lastFeed.start_time} value={summary.value} valueSub={summary.sub} />
      )}

      {activeFeedingId ? (
        <>
          <p className="text-4xl font-display tabular-nums">{formatElapsed(new Date(sessionStart ?? Date.now()).toISOString(), now)}</p>
          <button className="btn-primary" onClick={handleAdd}>
            Continue feeding
          </button>
        </>
      ) : (
        <button className="btn-secondary" onClick={handleAdd}>
          Log feeding
        </button>
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
            {type === 'breast' && !activeFeedingId && leftSeconds === 0 && rightSeconds === 0 && (
              <ModeToggle mode={mode} onChange={changeMode} liveLabel="Start now" />
            )}

            {type === 'breast' && mode === 'done' && !activeFeedingId && (
              <>
                <div>
                  <label className="label">Start time</label>
                  <DateTimeInput value={startText} onChange={editStartText} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Left (minutes)</label>
                    <input className="input" type="number" inputMode="decimal" value={leftMin} onChange={(e) => setLeftMin(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Right (minutes)</label>
                    <input className="input" type="number" inputMode="decimal" value={rightMin} onChange={(e) => setRightMin(e.target.value)} />
                  </div>
                </div>
                {doneLeft > 0 && doneRight > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-parchment-300">Ended on</span>
                    <div className="flex rounded-xl overflow-hidden border border-night-700">
                      {(['left', 'right'] as const).map((s) => (
                        <button key={s} type="button" onClick={() => setEndSide(s)} className={`px-4 py-1 capitalize ${endSide === s ? 'bg-dusk-500 text-night-950' : 'bg-night-950 text-parchment-300'}`}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm border-t border-night-700 pt-3">
                  <span className="text-parchment-300">Total time</span>
                  <span className="text-parchment-100">{doneLeft + doneRight}m</span>
                </div>
              </>
            )}

            {type === 'breast' && !(mode === 'done' && !activeFeedingId) && (
              <>
                {!activeFeedingId && leftSeconds === 0 && rightSeconds === 0 && (
                  <div>
                    <label className="label">Started at</label>
                    <DateTimeInput value={startText} onChange={editStartText} />
                  </div>
                )}
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

            {type !== 'breast' && (
              <div>
                <label className="label">Time</label>
                <DateTimeInput value={startText} onChange={editStartText} />
              </div>
            )}

            {type === 'bottle' && (
              <div>
                <label className="label">Amount ({unit})</label>
                <input className="input" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
            )}

            <div>
              <label className="label">Notes</label>
              <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
            </div>

            {type === 'breast' && mode === 'done' && !activeFeedingId ? (
              <button className="btn-primary" onClick={saveFinishedBreast} disabled={busy || !startText || doneLeft + doneRight <= 0}>
                Save feeding
              </button>
            ) : type === 'breast' ? (
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

      <SectionHistory<Feeding> rows={rows} timeField="start_time" describe={describeFeeding} icon="🍽️" onSelect={onSelectRow} />

      {editing && <FeedingEditor entry={editing} onClose={() => setEditing(null)} onChanged={reload} />}
    </TrackerCard>
  )
}
