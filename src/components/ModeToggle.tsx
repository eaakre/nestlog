// Two-way segmented control used by the add screens: "Happening now" vs "Already finished".
export type EntryMode = 'live' | 'done'

export default function ModeToggle({ mode, onChange, liveLabel = 'Happening now' }: { mode: EntryMode; onChange: (m: EntryMode) => void; liveLabel?: string }) {
  const opts: { key: EntryMode; label: string }[] = [
    { key: 'live', label: liveLabel },
    { key: 'done', label: 'Already finished' }
  ]
  return (
    <div className="flex rounded-xl overflow-hidden border border-night-700" role="group" aria-label="When did this happen">
      {opts.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={mode === o.key}
          onClick={() => onChange(o.key)}
          className={`flex-1 py-2 text-sm font-semibold ${mode === o.key ? 'bg-dusk-500 text-night-950' : 'bg-night-950 text-parchment-300'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const pad = (n: number) => String(n).padStart(2, '0')
/** "YYYY-MM-DDTHH:mm" for a Date, local time. */
export const localValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
/** A sensible past start when switching to "Already finished": 30 minutes ago. */
export const thirtyAgo = () => localValue(new Date(Date.now() - 30 * 60000))
