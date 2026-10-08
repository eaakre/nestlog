import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

// Loads the most recent rows for one child from one table, kept fresh by realtime.
export function useRecentRows<T extends { id: string }>(table: string, childId: string, timeField: string, limit = 20) {
  const [rows, setRows] = useState<T[]>([])

  const reload = useCallback(async () => {
    const { data } = await supabase
      .from(table)
      .select('*')
      .eq('child_id', childId)
      .order(timeField, { ascending: false })
      .limit(limit)
    setRows((data as T[]) ?? [])
  }, [table, childId, timeField, limit])

  useEffect(() => {
    reload()
    const channel = supabase
      .channel(`${table}-rows-${childId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, filter: `child_id=eq.${childId}` }, reload)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, childId, reload])

  return { rows, reload }
}
