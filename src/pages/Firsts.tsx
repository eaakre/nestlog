import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useChildren } from '../contexts/ChildContext'
import { useRecentRows } from '../lib/useRecentRows'
import { formatAge, formatDay } from '../lib/age'
import MilestoneEditor from '../components/editors/MilestoneEditor'
import MilestonePhoto from '../components/MilestonePhoto'
import type { Milestone } from '../types'

export default function Firsts() {
  const { activeChild } = useChildren()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Milestone | null>(null)
  const { rows, reload } = useRecentRows<Milestone>('milestones', activeChild?.id ?? '', 'happened_on', 500)

  if (!activeChild) return null

  return (
    <div className="max-w-lg mx-auto px-4 pb-24 pt-8">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/" className="btn-ghost !px-3 !py-2" aria-label="Back">
          ←
        </Link>
        <h1 className="text-2xl flex-1">Baby Firsts</h1>
        <button className="btn-primary !py-2" onClick={() => setCreating(true)}>
          Add
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="card text-parchment-300">
          Nothing saved yet. Tap Add to record {activeChild.name}'s first smile, tooth, or step.
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map((m) => {
            const age = formatAge(activeChild.birth_date, m.happened_on)
            return (
              <li key={m.id}>
                <button className="card w-full text-left flex flex-col gap-2" onClick={() => setEditing(m)}>
                  <h2 className="font-display text-2xl text-parchment-100">{m.title}</h2>
                  {m.photo_path && <MilestonePhoto path={m.photo_path} className="w-full h-52" />}
                  {m.notes && <p className="text-parchment-100 whitespace-pre-wrap">{m.notes}</p>}
                  <p className="text-parchment-300 text-sm">
                    {formatDay(m.happened_on)}
                    {age ? ` • Age ${age}` : ''}
                  </p>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {creating && <MilestoneEditor childId={activeChild.id} onClose={() => setCreating(false)} onChanged={reload} />}
      {editing && <MilestoneEditor childId={activeChild.id} entry={editing} onClose={() => setEditing(null)} onChanged={reload} />}
    </div>
  )
}
