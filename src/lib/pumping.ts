import { mlToUnit, unitToMl, type Unit } from './units'
import type { PumpingSession, Side } from '../types'

const toMl = (text: string, unit: Unit) => {
  const n = parseFloat(text)
  return Number.isFinite(n) && n > 0 ? unitToMl(n, unit) : 0
}

/** Turn the typed left/right amounts into the columns we store. */
export function buildPumpFields(opts: {
  left: string
  right: string
  unit: Unit
  /** Existing session, so an old total-only entry isn't wiped when nothing is typed. */
  existing?: Pick<PumpingSession, 'side' | 'amount_ml' | 'amount_left_ml' | 'amount_right_ml'> | null
}) {
  const l = toMl(opts.left, opts.unit)
  const r = toMl(opts.right, opts.unit)
  if (l === 0 && r === 0) {
    const e = opts.existing
    const legacyTotalOnly = e && e.amount_ml != null && e.amount_left_ml == null && e.amount_right_ml == null
    if (legacyTotalOnly) return { side: e.side, amount_ml: e.amount_ml, amount_left_ml: null, amount_right_ml: null }
    return { side: null as Side | null, amount_ml: null, amount_left_ml: null, amount_right_ml: null }
  }
  const side: Side = l > 0 && r > 0 ? 'both' : l > 0 ? 'left' : 'right'
  return { side, amount_ml: l + r, amount_left_ml: l > 0 ? l : null, amount_right_ml: r > 0 ? r : null }
}

/** Starting text for the two amount fields. */
export function pumpFieldText(s: Pick<PumpingSession, 'amount_left_ml' | 'amount_right_ml'> | null, unit: Unit) {
  return {
    left: s?.amount_left_ml != null ? String(mlToUnit(s.amount_left_ml, unit)) : '',
    right: s?.amount_right_ml != null ? String(mlToUnit(s.amount_right_ml, unit)) : ''
  }
}

/** Live total for display while typing. */
export function pumpTotalText(left: string, right: string, unit: Unit) {
  const ml = toMl(left, unit) + toMl(right, unit)
  return ml > 0 ? String(mlToUnit(ml, unit)) : '0'
}
