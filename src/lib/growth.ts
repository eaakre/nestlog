import type { Unit } from './units'
import type { GrowthKind, GrowthMeasurement } from '../types'

const G_PER_OZ = 28.3495
const CM_PER_IN = 2.54

export const KINDS: { key: GrowthKind; label: string; icon: string }[] = [
  { key: 'weight', label: 'Weight', icon: '⚖️' },
  { key: 'height', label: 'Height', icon: '📏' },
  { key: 'head', label: 'Head Size', icon: '🧢' }
]

export const kindLabel = (k: GrowthKind) => KINDS.find((x) => x.key === k)!.label

// Imperial when the volume setting is oz, metric when it's ml.
export const isImperial = (unit: Unit) => unit === 'oz'
export const lengthUnit = (unit: Unit) => (isImperial(unit) ? 'in' : 'cm')

const trim = (n: number, dp: number) => String(Number(n.toFixed(dp)))

/** Grams -> { lb, oz } with oz to one decimal (carrying 16 oz into a pound). */
export function gramsToLbOz(g: number) {
  const totalOz = Math.round((g / G_PER_OZ) * 10) / 10
  let lb = Math.floor(totalOz / 16)
  let oz = Math.round((totalOz - lb * 16) * 10) / 10
  if (oz >= 16) {
    lb += 1
    oz = 0
  }
  return { lb, oz }
}

export const lbOzToGrams = (lb: number, oz: number) => Math.round((lb * 16 + oz) * G_PER_OZ * 10) / 10

export function formatWeight(g: number, unit: Unit): string {
  if (!isImperial(unit)) return `${trim(g / 1000, 2)} kg`
  const { lb, oz } = gramsToLbOz(g)
  return lb > 0 ? `${lb} lb ${trim(oz, 1)} oz` : `${trim(oz, 1)} oz`
}

export const cmToUnit = (cm: number, unit: Unit) => (isImperial(unit) ? Number((cm / CM_PER_IN).toFixed(2)) : Number(cm.toFixed(1)))
export const unitToCm = (v: number, unit: Unit) => Math.round((isImperial(unit) ? v * CM_PER_IN : v) * 100) / 100

export function formatLength(cm: number, unit: Unit): string {
  return `${cmToUnit(cm, unit)} ${lengthUnit(unit)}`
}

export function formatMeasurement(m: Pick<GrowthMeasurement, 'kind' | 'value'>, unit: Unit): string {
  return m.kind === 'weight' ? formatWeight(m.value, unit) : formatLength(m.value, unit)
}

/** Newest first by measured date, then by when it was saved. */
export function sortNewest<T extends { measured_on: string; created_at: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.measured_on.localeCompare(a.measured_on) || b.created_at.localeCompare(a.created_at))
}
