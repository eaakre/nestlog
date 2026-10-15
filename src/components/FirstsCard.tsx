import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useRecentRows } from '../lib/useRecentRows'
import { useChildren } from '../contexts/ChildContext'
import { formatDay } from '../lib/age'
import TrackerCard from './TrackerCard'
import MilestoneEditor from './editors/MilestoneEditor'
import MilestonePhoto from './MilestonePhoto'
import type { Milestone } from '../types'

export default function FirstsCard({ childId }: { childId: string }) {
  const { rows, reload } = useRecentRows<Milestone>('milestones', childId, 'happened_on', 3)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Milestone | null>(null)
  const { activeChild } = useChildren()
  const latest = rows[0]

  return (
    <div className="sm:col-span-2">
      <TrackerCard title="Baby Firsts" color="firsts" onAdd={() => setCreating(true)}>
        {latest ? (
          <button className="flex items-center gap-3 text-left" onClick={() => setEditing(latest)}>
            <MilestonePhoto path={latest.photo_path} className="w-14 h-14 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-display text-xl text-parchment-100 truncate">{latest.title}</p>
              <p className="text-parchment-300 text-sm">{formatDay(latest.happened_on)}</p>
            </div>
            <span className="text-parchment-300 text-xl">›</span>
          </button>
        ) : (
          <p className="text-parchment-300">
            No firsts yet. Tap + to save {activeChild?.name ? `${activeChild.name}'s` : 'a'} first smile, tooth, or step.
          </p>
        )}
        <Link to="/firsts" className="flex items-center justify-between border-t border-night-700 pt-3 text-parchment-100 font-medium">
          Show all <span className="text-parchment-300 text-xl">›</span>
        </Link>
      </TrackerCard>

      {creating && <MilestoneEditor childId={childId} onClose={() => setCreating(false)} onChanged={reload} />}
      {editing && <MilestoneEditor childId={childId} entry={editing} onClose={() => setEditing(null)} onChanged={reload} />}
    </div>
  )
}
