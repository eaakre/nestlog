import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { notifyPartner } from '../lib/notify'
import { useAuth } from '../contexts/AuthContext'
import { useRecentRows } from '../lib/useRecentRows'
import { describeDiaper } from '../lib/describe'
import SectionHistory from './SectionHistory'
import TrackerCard from './TrackerCard'
import LastSummary from './LastSummary'
import DiaperEditor from './editors/DiaperEditor'
import type { Diaper } from '../types'

function statusWord(d: Diaper) {
  if (d.wet && d.dirty) return 'mix'
  if (d.dirty) return 'dirty'
  if (d.wet) return 'wet'
  return 'dry'
}

export default function DiaperCard({ childId }: { childId: string }) {
  const { user } = useAuth()
  const [quickBusy, setQuickBusy] = useState<'wet' | 'dirty' | 'dry' | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Diaper | null>(null)
  const { rows, reload } = useRecentRows<Diaper>('diapers', childId, 'time')

  // One-tap log with no texture/color detail — for when there's no time to fill out a form.
  const quickLog = async (kind: 'wet' | 'dirty' | 'dry') => {
    if (!user) return
    setQuickBusy(kind)
    await supabase.from('diapers').insert({
      child_id: childId,
      logged_by: user.id,
      wet: kind === 'wet',
      dirty: kind === 'dirty',
      time: new Date().toISOString()
    })
    notifyPartner(childId, 'diaper', kind)
    setQuickBusy(null)
    reload()
  }

  const last = rows[0]

  return (
    <TrackerCard title="Diaper" color="diaper" onAdd={() => setCreating(true)}>
      {last && <LastSummary icon="🧷" label="Last change" time={last.time} value={statusWord(last)} />}

      <div className="grid grid-cols-3 gap-2">
        <button className="btn-secondary" onClick={() => quickLog('wet')} disabled={quickBusy === 'wet'}>
          Wet
        </button>
        <button className="btn-secondary" onClick={() => quickLog('dirty')} disabled={quickBusy === 'dirty'}>
          Dirty
        </button>
        <button className="btn-secondary" onClick={() => quickLog('dry')} disabled={quickBusy === 'dry'}>
          Dry
        </button>
      </div>

      {creating && <DiaperEditor childId={childId} onClose={() => setCreating(false)} onChanged={reload} />}
      {editing && <DiaperEditor childId={childId} entry={editing} onClose={() => setEditing(null)} onChanged={reload} />}

      <SectionHistory<Diaper> rows={rows} timeField="time" describe={describeDiaper} icon="🧷" onSelect={setEditing} />
    </TrackerCard>
  )
}
