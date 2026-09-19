import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { describeDiaper } from '../lib/describe'
import SectionHistory from './SectionHistory'
import TrackerCard from './TrackerCard'
import TypeChooser from './TypeChooser'
import type { Diaper, DiaperType } from '../types'

export default function DiaperCard({ childId }: { childId: string }) {
  const { user } = useAuth()
  const [busy, setBusy] = useState<DiaperType | null>(null)
  const [showChooser, setShowChooser] = useState(false)

  const log = async (type: DiaperType) => {
    if (!user) return
    setShowChooser(false)
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
    <TrackerCard title="Diaper" color="diaper" onAdd={() => setShowChooser(true)}>
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

      {showChooser && (
        <TypeChooser
          title="Log diaper"
          onClose={() => setShowChooser(false)}
          options={[
            { key: 'wet', label: 'Wet', icon: '💧', onSelect: () => log('wet') },
            { key: 'dirty', label: 'Dirty', icon: '💩', onSelect: () => log('dirty') },
            { key: 'both', label: 'Mix', icon: '🧷', onSelect: () => log('both') }
          ]}
        />
      )}

      <SectionHistory<Diaper> table="diapers" childId={childId} timeField="time" describe={describeDiaper} icon="🧷" />
    </TrackerCard>
  )
}
