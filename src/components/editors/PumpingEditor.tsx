import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { toDatetimeLocalValue, fromDatetimeLocalValue } from '../../lib/format'
import { useUnit } from '../../lib/units'
import { buildPumpFields, pumpFieldText } from '../../lib/pumping'
import PumpAmountFields from '../PumpAmountFields'
import EditorShell from '../EditorShell'
import type { PumpingSession } from '../../types'
import DateTimeInput from '../DateTimeInput'

export default function PumpingEditor({ entry, onClose, onChanged }: { entry: PumpingSession; onClose: () => void; onChanged: () => void }) {
  const { unit } = useUnit()
  const [start, setStart] = useState(toDatetimeLocalValue(entry.start_time))
  const [end, setEnd] = useState(entry.end_time ? toDatetimeLocalValue(entry.end_time) : '')
  const [left, setLeft] = useState(() => pumpFieldText(entry, unit).left)
  const [right, setRight] = useState(() => pumpFieldText(entry, unit).right)
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
        ...buildPumpFields({ left, right, unit, existing: entry }),
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
      <PumpAmountFields unit={unit} left={left} right={right} onLeft={setLeft} onRight={setRight} />
      <div>
        <label className="label">Start time</label>
        <DateTimeInput value={start} onChange={setStart} />
      </div>
      <div>
        <label className="label">End time (blank = still pumping)</label>
        <DateTimeInput value={end} onChange={setEnd} />
      </div>
      <div>
        <label className="label">Notes</label>
        <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
      </div>
    </EditorShell>
  )
}
