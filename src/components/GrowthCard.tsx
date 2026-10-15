import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useRecentRows } from '../lib/useRecentRows'
import { useUnit } from '../lib/units'
import { formatDay } from '../lib/age'
import { KINDS, formatMeasurement, sortNewest } from '../lib/growth'
import TrackerCard from './TrackerCard'
import TypeChooser from './TypeChooser'
import GrowthEditor from './editors/GrowthEditor'
import type { GrowthKind, GrowthMeasurement } from '../types'

export default function GrowthCard({ childId }: { childId: string }) {
  const { unit } = useUnit()
  const { rows, reload } = useRecentRows<GrowthMeasurement>('growth_measurements', childId, 'measured_on', 200)
  const [chooser, setChooser] = useState(false)
  const [creating, setCreating] = useState<GrowthKind | null>(null)
  const sorted = sortNewest(rows)

  return (
    <div className="sm:col-span-2">
      <TrackerCard title="Growth" color="growth" onAdd={() => setChooser(true)}>
        <div className="flex flex-col -my-1">
          {KINDS.map((k) => {
            const latest = sorted.find((r) => r.kind === k.key)
            return (
              <Link
                key={k.key}
                to={`/growth?kind=${k.key}`}
                className="flex items-center gap-3 py-3 border-b border-night-700 last:border-0"
              >
                <span className="text-3xl w-10 text-center">{k.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-display text-xl text-parchment-100">{k.label}</p>
                  <p className="text-parchment-300 text-sm">{latest ? formatDay(latest.measured_on) : 'Not logged yet'}</p>
                </div>
                {latest && <span className="text-parchment-100 text-lg">{formatMeasurement(latest, unit)}</span>}
                <span className="text-parchment-300 text-xl">›</span>
              </Link>
            )
          })}
        </div>
      </TrackerCard>

      {chooser && (
        <TypeChooser
          title="Log growth"
          onClose={() => setChooser(false)}
          options={KINDS.map((k) => ({
            key: k.key,
            label: k.label,
            icon: k.icon,
            onSelect: () => {
              setChooser(false)
              setCreating(k.key)
            }
          }))}
        />
      )}
      {creating && <GrowthEditor childId={childId} kind={creating} onClose={() => setCreating(null)} onChanged={reload} />}
    </div>
  )
}
