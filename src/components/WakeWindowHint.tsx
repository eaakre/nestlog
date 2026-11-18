import { useMemo } from 'react'
import { suggestNext, type SleepLike } from '../../supabase/functions/_shared/wakeWindow'
import { useNow } from '../lib/useNow'

const dur = (ms: number) => {
  const m = Math.max(0, Math.round(ms / 60000))
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`
}
const clock = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).replace(' ', '').toLowerCase()

// "Next nap in 38m · 9:36pm" under the Sleep card's last-sleep summary.
export default function WakeWindowHint({ sessions, birthDate }: { sessions: SleepLike[]; birthDate: string | null; name?: string }) {
  const now = useNow(30000)
  const s = useMemo(() => suggestNext(sessions, birthDate, now, (ms) => new Date(ms).getHours()), [sessions, birthDate, now])
  if (!s) return null

  const what = s.kind === 'bedtime' ? 'bedtime' : 'nap'
  const late = now - s.targetMs
  let headline: string
  let tone = 'text-parchment-100'
  if (late < 0) headline = `Next ${what} in ${dur(-late)}`
  else if (late < 5 * 60000) {
    headline = s.kind === 'bedtime' ? 'Time for bed' : 'Time for a nap'
    tone = 'text-sage-400'
  } else {
    headline = `${s.kind === 'bedtime' ? 'Bedtime' : 'Nap'} was due ${dur(late)} ago`
    tone = 'text-amber-400'
  }

  return (
    <div className="rounded-xl bg-night-950 border border-night-700 px-4 py-3">
      <p className={`font-semibold ${tone}`}>{headline}</p>
      <p className="text-parchment-300 text-sm">
        at {clock(s.targetMs)} · awake {dur(now - s.lastWakeMs)}
      </p>
      <p className="text-parchment-300 text-xs mt-1">
        {dur(s.windowMin * 60000)} wake window for {s.ageLabel}. A guide, not a rule.
      </p>
    </div>
  )
}
