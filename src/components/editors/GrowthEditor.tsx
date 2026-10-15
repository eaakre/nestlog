import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useUnit } from '../../lib/units'
import { todayISO } from '../../lib/age'
import { cmToUnit, gramsToLbOz, isImperial, kindLabel, lbOzToGrams, lengthUnit, unitToCm } from '../../lib/growth'
import EditorShell from '../EditorShell'
import DateInput from '../DateInput'
import type { GrowthKind, GrowthMeasurement } from '../../types'

// Create (no entry) or edit/delete one weight / height / head measurement.
export default function GrowthEditor({
  childId,
  kind,
  entry,
  onClose,
  onChanged
}: {
  childId: string
  kind: GrowthKind
  entry?: GrowthMeasurement
  onClose: () => void
  onChanged: () => void
}) {
  const { user } = useAuth()
  const { unit } = useUnit()
  const imperial = isImperial(unit)

  const initialLbOz = entry && kind === 'weight' ? gramsToLbOz(entry.value) : null
  const [date, setDate] = useState(entry?.measured_on ?? todayISO())
  const [lb, setLb] = useState(initialLbOz ? String(initialLbOz.lb) : '')
  const [oz, setOz] = useState(initialLbOz ? String(initialLbOz.oz) : '')
  const [kg, setKg] = useState(entry && kind === 'weight' ? String(Number((entry.value / 1000).toFixed(2))) : '')
  const [length, setLength] = useState(entry && kind !== 'weight' ? String(cmToUnit(entry.value, unit)) : '')
  const [notes, setNotes] = useState(entry?.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const num = (s: string) => {
    const n = parseFloat(s)
    return Number.isFinite(n) && n >= 0 ? n : 0
  }

  const value =
    kind === 'weight'
      ? imperial
        ? lbOzToGrams(num(lb), num(oz))
        : Math.round(num(kg) * 1000 * 10) / 10
      : unitToCm(num(length), unit)

  const save = async () => {
    if (!user || !(value > 0) || !date) return
    setBusy(true)
    setError(null)
    const fields = { kind, value, measured_on: date, notes: notes.trim() || null }
    const { error } = entry
      ? await supabase.from('growth_measurements').update(fields).eq('id', entry.id)
      : await supabase.from('growth_measurements').insert({ child_id: childId, logged_by: user.id, ...fields })
    if (error) {
      setError(error.message)
      setBusy(false)
      return
    }
    onChanged()
    onClose()
  }

  const remove = async () => {
    if (!entry) return
    setBusy(true)
    const { error } = await supabase.from('growth_measurements').delete().eq('id', entry.id)
    if (error) {
      setError(error.message)
      setBusy(false)
      return
    }
    onChanged()
    onClose()
  }

  const numberInput = (v: string, set: (s: string) => void, placeholder = '0') => (
    <input className="input" type="number" inputMode="decimal" step="any" min="0" placeholder={placeholder} value={v} onChange={(e) => set(e.target.value)} />
  )

  return (
    <EditorShell
      title={kindLabel(kind)}
      onClose={onClose}
      onSave={save}
      onDelete={entry ? remove : undefined}
      busy={busy}
      saveDisabled={!(value > 0) || !date}
      loggedBy={entry?.logged_by}
    >
      <div>
        <label className="label">Date</label>
        <DateInput value={date} onChange={setDate} />
      </div>

      {kind === 'weight' && imperial && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Pounds (lb)</label>
            {numberInput(lb, setLb)}
          </div>
          <div>
            <label className="label">Ounces (oz)</label>
            {numberInput(oz, setOz)}
          </div>
        </div>
      )}
      {kind === 'weight' && !imperial && (
        <div>
          <label className="label">Weight (kg)</label>
          {numberInput(kg, setKg)}
        </div>
      )}
      {kind !== 'weight' && (
        <div>
          <label className="label">
            {kindLabel(kind)} ({lengthUnit(unit)})
          </label>
          {numberInput(length, setLength)}
        </div>
      )}

      <div>
        <label className="label">Notes</label>
        <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
      </div>

      {error && <p className="text-dusk-500 text-sm">{error}</p>}
    </EditorShell>
  )
}
