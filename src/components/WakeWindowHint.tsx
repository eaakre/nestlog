import { useMemo } from 'react'
import { suggestNext, ageInMonths, type SleepLike } from '../../supabase/functions/_shared/wakeWindow'
import { useNow } from '../lib/useNow'

const dur = (ms: number) => {
  const m = Math.max(0, Math.round(ms / 60000))
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`
}
const clock = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).replace(' ', '').toLowerCase()

// "Next nap window in 1h 33m" under the Sleep card's last-sleep summary.
export default function WakeWindowHint({ sessions, birthDate, name }: { sessions: SleepLike[]; birthDate: string | null; name: string }) {
  const now = useNow(30000)
  const s = useMemo(() => suggestNext(sessions, birthDate, now, (ms) => new Date(ms).getHours()), [sessions, birthDate, now])
  if (!s) return null

  const label = s.kind === 'bedtime' ? 'Bedtime' : 'Nap'
  const awake = dur(now - s.lastWakeMs)
  let headline: string
  let tone = 'text-parchment-100'
  if (now < s.opensMs) headline = `${label} window opens in ${dur(s.opensMs - now)}`
  else if (now <= s.closesMs) {
    headline = `${label} window is open`
    tone = 'text-sage-400'
  } else {
    headline = `Past the usual ${label.toLowerCase()} window`
    tone = 'text-amber-400'
  }

  const months = ageInMonths(birthDate, now)
  const basis = s.personalized ? `${name}'s last 2 weeks` : months != null ? `typical for ${months} month${months === 1 ? '' : 's'}` : 'typical for his age'

  return (
    <div className="rounded-xl bg-night-950 border border-night-700 px-4 py-3">
      <p className={`font-semibold ${tone}`}>{headline}</p>
      <p className="text-parchment-300 text-sm">
        {clock(s.opensMs)}–{clock(s.closesMs)} · awake {awake}
      </p>
      <p className="text-parchment-300 text-xs mt-1">Based on {basis}. A guide, not a rule.</p>
    </div>
  )
}
