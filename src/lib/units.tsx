import { createContext, useContext, useState, ReactNode } from 'react'

export type Unit = 'oz' | 'ml'

const KEY = 'nestlog:unit'
const ML_PER_OZ = 29.5735

function initialUnit(): Unit {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'oz' || saved === 'ml') return saved
  } catch {
    /* storage unavailable */
  }
  return typeof navigator !== 'undefined' && navigator.language?.startsWith('en-US') ? 'oz' : 'ml'
}

// Everything is stored in ml; these convert at the edges.
export function mlToUnit(ml: number, unit: Unit): number {
  return unit === 'ml' ? Math.round(ml) : Math.round((ml / ML_PER_OZ) * 10) / 10
}

export function unitToMl(value: number, unit: Unit): number {
  return unit === 'ml' ? value : Math.round(value * ML_PER_OZ * 10) / 10
}

export function formatVolume(ml: number, unit: Unit): string {
  return `${mlToUnit(ml, unit)} ${unit}`
}

type UnitContextValue = { unit: Unit; setUnit: (u: Unit) => void }
const UnitContext = createContext<UnitContextValue | undefined>(undefined)

export function UnitProvider({ children }: { children: ReactNode }) {
  const [unit, setUnitState] = useState<Unit>(initialUnit)
  const setUnit = (u: Unit) => {
    setUnitState(u)
    try {
      localStorage.setItem(KEY, u)
    } catch {
      /* ignore */
    }
  }
  return <UnitContext.Provider value={{ unit, setUnit }}>{children}</UnitContext.Provider>
}

export function useUnit() {
  const ctx = useContext(UnitContext)
  if (!ctx) throw new Error('useUnit must be used within UnitProvider')
  return ctx
}
