import { pumpTotalText } from '../lib/pumping'
import type { Unit } from '../lib/units'

// Left and right amounts for one pumping session, with the running total.
export default function PumpAmountFields({
  unit,
  left,
  right,
  onLeft,
  onRight
}: {
  unit: Unit
  left: string
  right: string
  onLeft: (v: string) => void
  onRight: (v: string) => void
}) {
  const ph = unit === 'oz' ? '0' : '0'
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Left ({unit})</label>
          <input className="input" type="number" inputMode="decimal" step="any" min="0" placeholder={ph} value={left} onChange={(e) => onLeft(e.target.value)} />
        </div>
        <div>
          <label className="label">Right ({unit})</label>
          <input className="input" type="number" inputMode="decimal" step="any" min="0" placeholder={ph} value={right} onChange={(e) => onRight(e.target.value)} />
        </div>
      </div>
      <div className="flex items-center justify-between rounded-xl bg-night-950 border border-night-700 px-4 py-3">
        <span className="text-parchment-300 text-sm">Total</span>
        <span className="text-parchment-100 font-semibold tabular-nums">
          {pumpTotalText(left, right, unit)} {unit}
        </span>
      </div>
    </div>
  )
}
