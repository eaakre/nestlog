import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { toDatetimeLocalValue, fromDatetimeLocalValue, formatDurationMinutes } from '../../lib/format'
import { useUnit, mlToUnit, unitToMl } from '../../lib/units'
import { usePhotoField } from '../PhotoField'
import EditorShell from '../EditorShell'
import type { Feeding, Side } from '../../types'
import DateTimeInput from '../DateTimeInput'

const TITLES = { breast: 'Breastfeed', bottle: 'Bottle Feed', solid: 'Solid Food' }

export default function FeedingEditor({ entry, onClose, onChanged }: { entry: Feeding; onClose: () => void; onChanged: () => void }) {
  const { unit } = useUnit()
  const [start, setStart] = useState(toDatetimeLocalValue(entry.start_time))
  const [left, setLeft] = useState(String(entry.duration_left_minutes ?? 0))
  const [right, setRight] = useState(String(entry.duration_right_minutes ?? 0))
  const [lastSide, setLastSide] = useState<Side | null>(entry.side)
  const [amount, setAmount] = useState(entry.amount_ml != null ? String(mlToUnit(entry.amount_ml, unit)) : '')
  const [notes, setNotes] = useState(entry.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const photo = usePhotoField(entry.child_id, entry.photo_path)

  const startIso = start ? fromDatetimeLocalValue(start) : null
  const leftMin = Math.max(0, Number(left) || 0)
  const rightMin = Math.max(0, Number(right) || 0)

  const save = async () => {
    if (!startIso) return
    setBusy(true)
    setError(null)
    try {
      const photo_path = await photo.resolve()
      const res = entry.type === 'breast'
        ? await supabase
        .from('feedings')
        .update({
          start_time: startIso,
          duration_left_minutes: leftMin,
          duration_right_minutes: rightMin,
          duration_minutes: leftMin + rightMin,
          side: lastSide,
          notes: notes || null,
          photo_path
        })
        .eq('id', entry.id)
        : await supabase
        .from('feedings')
        .update({
          start_time: startIso,
          end_time: startIso,
          amount_ml: entry.type === 'bottle' && amount ? unitToMl(Number(amount), unit) : null,
          notes: notes || null,
          photo_path
        })
        .eq('id', entry.id)
      if (res.error) throw new Error(res.error.message)
      await photo.cleanup(photo_path)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.')
      setBusy(false)
      return
    }
    setBusy(false)
    onChanged()
    onClose()
  }

  const remove = async () => {
    setBusy(true)
    await supabase.from('feedings').delete().eq('id', entry.id)
    setBusy(false)
    onChanged()
    onClose()
  }

  return (
    <EditorShell title={TITLES[entry.type]} onClose={onClose} onSave={save} onDelete={remove} busy={busy} saveDisabled={!startIso} loggedBy={entry.logged_by} error={error}>
      {entry.type === 'breast' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Left (minutes)</label>
              <input className="input" type="number" inputMode="decimal" value={left} onChange={(e) => setLeft(e.target.value)} />
            </div>
            <div>
              <label className="label">Right (minutes)</label>
              <input className="input" type="number" inputMode="decimal" value={right} onChange={(e) => setRight(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-parchment-300">Total time</span>
            <span className="text-parchment-100">{formatDurationMinutes(leftMin + rightMin)}</span>
          </div>
          <div>
            <label className="label">Last side</label>
            <div className="flex gap-2">
              {(['left', 'right'] as Side[]).map((s) => (
                <button key={s} onClick={() => setLastSide(lastSide === s ? null : s)} className={lastSide === s ? 'btn-primary flex-1 capitalize' : 'btn-secondary flex-1 capitalize'}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
      {entry.type === 'bottle' && (
        <div>
          <label className="label">Amount ({unit})</label>
          <input className="input" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
      )}
      <div>
        <label className="label">Start time</label>
        <DateTimeInput value={start} onChange={setStart} />
      </div>
      <div>
        <label className="label">Notes</label>
        <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
      </div>
      {photo.node}
    </EditorShell>
  )
}
