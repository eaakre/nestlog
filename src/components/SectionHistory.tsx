import { useState } from 'react'
import { formatEntryTime } from '../lib/format'
import { useUnit, type Unit } from '../lib/units'
import { useChildren } from '../contexts/ChildContext'
import type { EntryDescription } from '../lib/describe'

type Props<T extends { id: string; logged_by: string }> = {
  rows: T[]
  timeField: keyof T & string
  describe: (row: T, unit: Unit) => EntryDescription
  icon: string
  limit?: number
  onSelect?: (row: T) => void
  canSelect?: (row: T) => boolean
}

export default function SectionHistory<T extends { id: string; logged_by: string }>({
  rows,
  timeField,
  describe,
  icon,
  limit = 3,
  onSelect,
  canSelect
}: Props<T>) {
  const [expanded, setExpanded] = useState(false)
  const { unit } = useUnit()
  const { members } = useChildren()
  const showNames = Object.keys(members).length > 1

  if (rows.length === 0) return null

  const visible = expanded ? rows : rows.slice(0, limit)

  return (
    <div className="mt-1 pt-3 border-t border-night-700 flex flex-col gap-2">
      <ul className="flex flex-col gap-1">
        {visible.map((row) => {
          const { text, sub, barPct } = describe(row, unit)
          const selectable = !!onSelect && (canSelect ? canSelect(row) : true)
          const who = showNames ? members[row.logged_by] : undefined

          const content = (
            <>
              <span className="text-xl shrink-0">{icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-parchment-100 text-base truncate">{text}</p>
                  {sub && <p className="text-parchment-100 text-sm font-semibold shrink-0">{sub}</p>}
                </div>
                {barPct != null && (
                  <div className="h-1 rounded-full bg-night-700 mt-1 overflow-hidden">
                    <div className="h-full rounded-full bg-night-600" style={{ width: `${Math.max(4, barPct)}%` }} />
                  </div>
                )}
                <p className="text-parchment-300 text-sm mt-0.5">
                  {formatEntryTime(row[timeField] as unknown as string)}
                  {who ? ` · ${who}` : ''}
                </p>
              </div>
              {selectable && <span className="text-parchment-300 text-2xl shrink-0">›</span>}
            </>
          )

          return (
            <li key={row.id}>
              {selectable ? (
                <button
                  type="button"
                  onClick={() => onSelect!(row)}
                  className="w-full flex items-center gap-2.5 text-left rounded-xl px-1 py-1.5 hover:bg-night-700/50"
                >
                  {content}
                </button>
              ) : (
                <div className="flex items-center gap-2.5 px-1 py-1.5">{content}</div>
              )}
            </li>
          )
        })}
      </ul>
      {rows.length > limit && (
        <button className="text-sm font-medium text-dusk-400 hover:text-dusk-300 text-left" onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Show less' : `Show ${rows.length - limit} more`}
        </button>
      )}
    </div>
  )
}
