import { formatAgo } from '../lib/format'
import { useNow } from '../lib/useNow'

// The big "last feeding · 5m ago · 6.5 oz" readout at the top of each card.
export default function LastSummary({
  icon,
  label,
  time,
  value,
  valueSub
}: {
  icon: string
  label: string
  time: string | null
  value: string
  valueSub?: string
}) {
  const now = useNow(30000)
  return (
    <div className="flex items-center gap-4 py-1">
      <span className="text-5xl shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="font-display text-xl text-parchment-100 leading-tight">{label}</p>
        <p className="text-parchment-300 text-base">{time ? formatAgo(time, now) : ''}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-display text-4xl text-parchment-100 leading-none capitalize">{value}</p>
        {valueSub && <p className="text-parchment-300 text-sm mt-1">{valueSub}</p>}
      </div>
    </div>
  )
}
