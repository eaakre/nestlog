import { formatClock, formatDurationMinutes } from './format'
import { formatVolume, type Unit } from './units'
import type { SleepSession, Feeding, Diaper, PumpingSession } from '../types'

export type EntryDescription = { text: string; sub?: string; barPct?: number }

const SLEEP_BAR_CAP_MINUTES = 12 * 60 // widest bar represents a 12h stretch

export function describeSleep(s: SleepSession): EntryDescription {
  if (!s.end_time) return { text: 'Sleep started' }
  const mins = (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 60000
  return {
    text: `${formatClock(s.start_time)} – ${formatClock(s.end_time)}`,
    sub: formatDurationMinutes(mins) ?? undefined,
    barPct: Math.min(100, (mins / SLEEP_BAR_CAP_MINUTES) * 100)
  }
}

export function describeFeeding(f: Feeding, unit: Unit): EntryDescription {
  if (f.type === 'bottle') return { text: `Bottle${f.amount_ml ? ` · ${formatVolume(f.amount_ml, unit)}` : ''}` }
  if (f.type === 'breast') {
    if (!f.end_time) return { text: 'Feeding in progress' }
    const parts: string[] = []
    if (f.duration_left_minutes) parts.push(`L ${formatDurationMinutes(f.duration_left_minutes)}`)
    if (f.duration_right_minutes) parts.push(`R ${formatDurationMinutes(f.duration_right_minutes)}`)
    const breakdown = parts.length ? ` · ${parts.join(' + ')}` : f.duration_minutes ? ` · ${formatDurationMinutes(f.duration_minutes)}` : ''
    return { text: `Breastfed${breakdown}${f.side ? ` · last ${f.side}` : ''}` }
  }
  return { text: 'Solid food' }
}

export function describeDiaper(d: Diaper): EntryDescription {
  const status: string[] = []
  if (d.wet) status.push('wet')
  if (d.dirty) status.push('dirty')
  const text = `Diaper · ${status.length ? status.join(' + ') : 'dry'}`

  const extras: string[] = []
  if (d.dirty) {
    const tx = d.textures?.length ? d.textures : d.texture ? [d.texture] : []
    const co = d.colors?.length ? d.colors : d.color ? [d.color] : []
    extras.push(...tx, ...co)
  }
  if (d.blowout) extras.push('blowout')
  if (d.diaper_rash) extras.push('rash')

  return { text, sub: extras.length ? extras.join(', ') : undefined }
}

export function describePumping(p: PumpingSession, unit: Unit): EntryDescription {
  if (!p.end_time) return { text: 'Pumping started' }
  if (p.amount_left_ml != null && p.amount_right_ml != null) {
    return {
      text: `Pumped · ${formatVolume(p.amount_ml ?? p.amount_left_ml + p.amount_right_ml, unit)}`,
      sub: `L ${formatVolume(p.amount_left_ml, unit)} + R ${formatVolume(p.amount_right_ml, unit)}`
    }
  }
  return { text: `Pumped${p.amount_ml ? ` · ${formatVolume(p.amount_ml, unit)}` : ''}${p.side ? ` · ${p.side}` : ''}` }
}
