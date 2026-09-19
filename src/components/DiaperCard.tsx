import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { describeDiaper } from '../lib/describe'
import { toDatetimeLocalValue, fromDatetimeLocalValue } from '../lib/format'
import SectionHistory from './SectionHistory'
import TrackerCard from './TrackerCard'
import Modal from './Modal'
import Toggle from './Toggle'
import type { Diaper, DiaperTexture, DiaperColor } from '../types'

const TEXTURES: { key: DiaperTexture; label: string; icon: string }[] = [
  { key: 'runny', label: 'Runny', icon: '💦' },
  { key: 'mucousy', label: 'Mucousy', icon: '🫧' },
  { key: 'mushy', label: 'Mushy', icon: '🟤' },
  { key: 'solid', label: 'Solid', icon: '💩' },
  { key: 'pebbles', label: 'Pebbles', icon: '⚫' }
]

const COLORS: { key: DiaperColor; label: string; swatch: string }[] = [
  { key: 'black', label: 'Black', swatch: '#2b1a10' },
  { key: 'green', label: 'Green', swatch: '#7CB342' },
  { key: 'yellow', label: 'Yellow', swatch: '#F2C94C' },
  { key: 'brown', label: 'Brown', swatch: '#8B5A2B' },
  { key: 'red', label: 'Red', swatch: '#E05B4F' },
  { key: 'gray', label: 'Gray', swatch: '#C7C7C7' }
]

function CircleToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`h-24 w-24 rounded-full border-2 flex items-center justify-center font-semibold capitalize transition-colors ${
        active ? 'bg-dusk-500 border-dusk-500 text-night-950' : 'border-night-600 text-parchment-200'
      }`}
    >
      {label}
    </button>
  )
}

export default function DiaperCard({ childId }: { childId: string }) {
  const { user } = useAuth()
  const [quickBusy, setQuickBusy] = useState<'wet' | 'dirty' | 'dry' | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [busy, setBusy] = useState(false)

  const [time, setTime] = useState('')
  const [wet, setWet] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [texture, setTexture] = useState<DiaperTexture | null>(null)
  const [color, setColor] = useState<DiaperColor | null>(null)
  const [blowout, setBlowout] = useState(false)
  const [diaperRash, setDiaperRash] = useState(false)
  const [notes, setNotes] = useState('')

  const openModal = () => {
    setTime(toDatetimeLocalValue(new Date().toISOString()))
    setWet(false)
    setDirty(false)
    setTexture(null)
    setColor(null)
    setBlowout(false)
    setDiaperRash(false)
    setNotes('')
    setShowModal(true)
  }

  // Quick one-tap log with no texture/color detail — for when there's no time to fill out a form.
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
    setQuickBusy(null)
  }

  const save = async () => {
    if (!user) return
    setBusy(true)
    await supabase.from('diapers').insert({
      child_id: childId,
      logged_by: user.id,
      wet,
      dirty,
      texture: dirty ? texture : null,
      color: dirty ? color : null,
      blowout,
      diaper_rash: diaperRash,
      time: fromDatetimeLocalValue(time),
      notes: notes || null
    })
    setBusy(false)
    setShowModal(false)
  }

  const isDry = !wet && !dirty

  return (
    <TrackerCard title="Diaper" color="diaper" onAdd={openModal}>
      <p className="text-parchment-200 text-base">Tap to log</p>
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

      {showModal && (
        <Modal title="Diaper" onClose={() => setShowModal(false)}>
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-parchment-300">Time</span>
              <input
                className="input w-auto text-right"
                type="datetime-local"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>

            <div className="flex justify-center gap-4">
              <CircleToggle label="wet" active={wet} onClick={() => setWet((w) => !w)} />
              <CircleToggle label="dirty" active={dirty} onClick={() => setDirty((d) => !d)} />
              <CircleToggle
                label="dry"
                active={isDry}
                onClick={() => {
                  setWet(false)
                  setDirty(false)
                }}
              />
            </div>

            {dirty && (
              <div className="flex flex-col gap-3 border-t border-night-700 pt-4">
                <p className="text-parchment-100 font-display text-lg">Texture &amp; Color</p>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {TEXTURES.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setTexture(texture === t.key ? null : t.key)}
                      className={`flex flex-col items-center gap-1 shrink-0 w-16 ${
                        texture === t.key ? 'text-dusk-400' : 'text-parchment-300'
                      }`}
                    >
                      <span className="text-3xl">{t.icon}</span>
                      <span className="text-xs">{t.label}</span>
                    </button>
                  ))}
                </div>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {COLORS.map((c) => (
                    <button
                      key={c.key}
                      onClick={() => setColor(color === c.key ? null : c.key)}
                      className="flex flex-col items-center gap-1 shrink-0 w-16"
                    >
                      <span
                        className={`w-9 h-9 rounded-full ${
                          color === c.key ? 'ring-2 ring-dusk-400 ring-offset-2 ring-offset-night-800' : ''
                        }`}
                        style={{ backgroundColor: c.swatch }}
                      />
                      <span className="text-xs text-parchment-300">{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1 border-t border-night-700 pt-3">
              <Toggle label="Blowout" checked={blowout} onChange={setBlowout} />
              <Toggle label="Diaper Rash" checked={diaperRash} onChange={setDiaperRash} />
            </div>

            <div>
              <label className="label">Notes</label>
              <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
            </div>

            <button className="btn-primary" onClick={save} disabled={busy}>
              Save
            </button>
          </div>
        </Modal>
      )}

      <SectionHistory<Diaper> table="diapers" childId={childId} timeField="time" describe={describeDiaper} icon="🧷" />
    </TrackerCard>
  )
}
