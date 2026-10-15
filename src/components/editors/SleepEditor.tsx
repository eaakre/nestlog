import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { toDatetimeLocalValue, fromDatetimeLocalValue, formatDurationMinutes } from '../../lib/format'
import EditorShell from '../EditorShell'
import type { SleepSession } from '../../types'
import DateTimeInput from '../DateTimeInput'

export default function SleepEditor({ entry, onClose, onChanged }: { entry: SleepSession; onClose: () => void; onChanged: () => void }) {
  const [start, setStart] = useState(toDatetimeLocalValue(entry.start_time))
  const [end, setEnd] = useState(entry.end_time ? toDatetimeLocalValue(entry.end_time) : '')
  const [notes, setNotes] = useState(entry.notes ?? '')
  const [busy, setBusy] = useState(false)

  const startIso = start ? fromDatetimeLocalValue(start) : null
  const endIso = end ? fromDatetimeLocalValue(end) : null
  const minutes = startIso && endIso ? (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000 : null
  const invalid = !startIso || (minutes !== null && minutes < 0)

  const save = async () => {
    if (!startIso) return
    setBusy(true)
    await supabase.from('sleep_sessions').update({ start_time: startIso, end_time: endIso, notes: notes || null }).eq('id', entry.id)
    setBusy(false)
    onChanged()
    onClose()
  }

  const remove = async () => {
    setBusy(true)
    await supabase.from('sleep_sessions').delete().eq('id', entry.id)
    setBusy(false)
    onChanged()
    onClose()
  }

  return (
    <EditorShell title="Sleep" onClose={onClose} onSave={save} onDelete={remove} busy={busy} saveDisabled={invalid} loggedBy={entry.logged_by}>
      <div className="text-center py-1">
        <p className="text-parchment-300 text-sm mb-1">Total time</p>
        <p className="text-4xl font-display tabular-nums">{minutes !== null && minutes >= 0 ? formatDurationMinutes(minutes) : endIso ? '—' : 'Still sleeping'}</p>
      </div>
      <div>
        <label className="label">Start time</label>
        <DateTimeInput value={start} onChange={setStart} />
      </div>
      <div>
        <label className="label">End time (blank = still sleeping)</label>
        <DateTimeInput value={end} onChange={setEnd} />
      </div>
      <div>
        <label className="label">Notes</label>
        <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
      </div>
    </EditorShell>
  )
}
