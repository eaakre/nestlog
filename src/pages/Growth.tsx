import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useChildren } from '../contexts/ChildContext'
import { useRecentRows } from '../lib/useRecentRows'
import { useUnit } from '../lib/units'
import { formatAge, formatDay } from '../lib/age'
import { KINDS, formatMeasurement, kindLabel, sortNewest } from '../lib/growth'
import GrowthEditor from '../components/editors/GrowthEditor'
import type { GrowthKind, GrowthMeasurement } from '../types'

export default function Growth() {
  const { activeChild } = useChildren()
  const { unit } = useUnit()
  const [params, setParams] = useSearchParams()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<GrowthMeasurement | null>(null)
  const { rows, reload } = useRecentRows<GrowthMeasurement>('growth_measurements', activeChild?.id ?? '', 'measured_on', 500)

  if (!activeChild) return null
  const kind: GrowthKind = KINDS.some((k) => k.key === params.get('kind')) ? (params.get('kind') as GrowthKind) : 'weight'
  const list = sortNewest(rows.filter((r) => r.kind === kind))

  return (
    <div className="max-w-lg mx-auto px-4 pb-24 pt-8">
      <div className="flex items-center gap-3 mb-5">
        <Link to="/" className="btn-ghost !px-3 !py-2" aria-label="Back">
          ←
        </Link>
        <h1 className="text-2xl flex-1">Growth</h1>
        <button className="btn-primary !py-2" onClick={() => setCreating(true)}>
          Add
        </button>
      </div>

      <div className="flex gap-2 mb-5">
        {KINDS.map((k) => (
          <button
            key={k.key}
            onClick={() => setParams({ kind: k.key }, { replace: true })}
            className={kind === k.key ? 'btn-primary flex-1 !px-2 !py-2 text-sm' : 'btn-secondary flex-1 !px-2 !py-2 text-sm'}
          >
            {k.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="card text-parchment-300">No {kindLabel(kind).toLowerCase()} entries yet. Tap Add to log {activeChild.name}'s first one.</div>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((m, i) => {
            const prev = list[i + 1]
            const age = formatAge(activeChild.birth_date, m.measured_on)
            const diff = prev ? m.value - prev.value : null
            return (
              <li key={m.id}>
                <button className="card w-full text-left flex items-center gap-3" onClick={() => setEditing(m)}>
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-2xl text-parchment-100">{formatMeasurement(m, unit)}</p>
                    <p className="text-parchment-300 text-sm">
                      {formatDay(m.measured_on)}
                      {age ? ` • Age ${age}` : ''}
                    </p>
                    {m.notes && <p className="text-parchment-200 text-sm mt-1">{m.notes}</p>}
                  </div>
                  {diff !== null && diff !== 0 && (
                    <span className="text-sm text-parchment-300">
                      {diff > 0 ? '+' : '−'}
                      {formatMeasurement({ kind: m.kind, value: Math.abs(diff) }, unit)}
                    </span>
                  )}
                  <span className="text-parchment-300 text-xl">›</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {creating && <GrowthEditor childId={activeChild.id} kind={kind} onClose={() => setCreating(false)} onChanged={reload} />}
      {editing && <GrowthEditor childId={activeChild.id} kind={editing.kind} entry={editing} onClose={() => setEditing(null)} onChanged={reload} />}
    </div>
  )
}
