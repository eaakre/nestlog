import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { describeDiaper } from '../lib/describe'
import SectionHistory from './SectionHistory'
import TrackerCard from './TrackerCard'
import type { Diaper, DiaperType } from '../types'

export default function DiaperCard({ childId }: { childId: string }) {
  const { user } = useAuth()
  const [busy, setBusy] = useState<DiaperType | null>(null)

  const log = async (type: DiaperType) => {
    if (!user) return
    setBusy(type)
    await supabase.from('diapers').insert({
      child_id: childId,
      logged_by: user.id,
      type,
      time: new Date().toISOString()
    })
    setBusy(null)
  }

  return (
    <TrackerCard title="Diaper" emoji="🧷" color="diaper">
      <p className="text-parchment-200 text-base">Tap to log</p>
      <div className="grid grid-cols-3 gap-2">
        <button className="btn-secondary" onClick={() => log('wet')} disabled={busy === 'wet'}>
          Wet
        </button>
        <button className="btn-secondary" onClick={() => log('dirty')} disabled={busy === 'dirty'}>
          Dirty
        </button>
        <button className="btn-secondary" onClick={() => log('both')} disabled={busy === 'both'}>
          Both
        </button>
      </div>

      <SectionHistory<Diaper> table="diapers" childId={childId} timeField="time" describe={describeDiaper} icon="🧷" />
    </TrackerCard>
  )
}
