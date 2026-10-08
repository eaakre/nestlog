import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { toDatetimeLocalValue, fromDatetimeLocalValue } from '../../lib/format'
import { useUnit, mlToUnit, unitToMl } from '../../lib/units'
import EditorShell from '../EditorShell'
import type { PumpingSession, Side } from '../../types'

export default function PumpingEditor({ entry, onClose, onChanged }: { entry: PumpingSession; onClose: () => void; onChanged: () => void }) {
  const { unit } = useUnit()
  const [start, setStart] = useState(toDatetimeLocalValue(entry.start_time))
  const [end, setEnd] = useState(entry.end_time ? toDatetimeLocalValue(entry.end_time) : '')
  const [side, setSide] = useState<Side>(entry.side ?? 'both')
  const [amount, setAmount] = useState(entry.amount_ml != null ? String(mlToUnit(entry.amount_ml, unit)) : '')
  const [notes, setNotes] = useState(entry.notes ?? '')
  const [busy, setBusy] = useState(false)

  const startIso = start ? fromDatetimeLocalValue(start) : null
  const endIso = end ? fromDatetimeLocalValue(end) : null
  const invalid = !startIso || (!!endIso && new Date(endIso) < new Date(startIso!))

  const save = async () => {
    if (!startIso) return
    setBusy(true)
    await supabase
      .from('pumping_sessions')
      .update({
        start_time: startIso,
        end_time: endIso,
        side,
        amount_ml: amount ? unitToMl(Number(amount), unit) : null,
        notes: notes || null
      })
      .eq('id', entry.id)
    setBusy(false)
    onChanged()
    onClose()
  }

  const remove = async () => {
    setBusy(true)
    await supabase.from('pumping_sessions').delete().eq('id', entry.id)
    setBusy(false)
    onChanged()
    onClose()
  }

  return (
    <EditorShell title="Pumping" onClose={onClose} onSave={save} onDelete={remove} busy={busy} saveDisabled={invalid} loggedBy={entry.logged_by}>
      <div>
        <label className="label">Side</label>
        <div className="flex gap-2">
          {(['left', 'right', 'both'] as Side[]).map((s) => (
            <button key={s} onClick={() => setSide(s)} className={side === s ? 'btn-primary flex-1 capitalize' : 'btn-secondary flex-1 capitalize'}>
              {s}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="label">Amount ({unit})</label>
        <input className="input" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div>
        <label className="label">Start time</label>
        <input className="input" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
      </div>
      <div>
        <label className="label">End time (blank = still pumping)</label>
        <input className="input" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
      </div>
      <div>
        <label className="label">Notes</label>
        <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
      </div>
    </EditorShell>
  )
}
