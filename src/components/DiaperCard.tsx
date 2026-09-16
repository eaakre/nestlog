import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { DiaperType } from '../types'

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
    <div className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base">Diaper</h3>
        <span className="text-2xl">🧷</span>
      </div>
      <p className="text-parchment-300 text-sm">Tap to log</p>
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
    </div>
  )
}
