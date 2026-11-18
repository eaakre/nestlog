import { useState } from 'react'

const KEY = 'nestlog:wakeWindows'

// Show the next-nap suggestion on the Sleep card? Per device, on by default.
export function useWakeWindowSetting(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState<boolean>(() => {
    try {
      return localStorage.getItem(KEY) !== 'off'
    } catch {
      return true
    }
  })
  const set = (v: boolean) => {
    setOn(v)
    try {
      localStorage.setItem(KEY, v ? 'on' : 'off')
    } catch {
      /* storage unavailable */
    }
  }
  return [on, set]
}
