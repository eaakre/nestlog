import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatRelative } from '../lib/format'
import type { EntryDescription } from '../lib/describe'

type Props<T extends { id: string }> = {
  table: string
  childId: string
  timeField: keyof T & string
  describe: (row: T) => EntryDescription
  icon: string
  limit?: number
}

export default function SectionHistory<T extends { id: string }>({
  table,
  childId,
  timeField,
  describe,
  icon,
  limit = 3
}: Props<T>) {
  const [rows, setRows] = useState<T[]>([])
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const { data } = await supabase
        .from(table)
        .select('*')
        .eq('child_id', childId)
        .order(timeField, { ascending: false })
        .limit(20)
      if (!cancelled) setRows((data as T[]) ?? [])
    }

    load()
    const channel = supabase
      .channel(`${table}-hist-${childId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, filter: `child_id=eq.${childId}` }, load)
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, childId, timeField])

  if (rows.length === 0) return null

  const visible = expanded ? rows : rows.slice(0, limit)

  return (
    <div className="mt-1 pt-3 border-t border-night-700 flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {visible.map((row) => {
          const { text, sub, barPct } = describe(row)
          return (
            <li key={row.id} className="flex items-center gap-2.5">
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
                <p className="text-parchment-300 text-sm mt-0.5">{formatRelative(row[timeField] as unknown as string)}</p>
              </div>
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
