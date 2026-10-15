import { ReactNode } from 'react'

type Color = 'sleep' | 'pump' | 'feed' | 'diaper' | 'firsts'

const HEADER_BG: Record<Color, string> = {
  sleep: 'bg-header-sleep',
  pump: 'bg-header-pump',
  feed: 'bg-header-feed',
  diaper: 'bg-header-diaper',
  firsts: 'bg-header-firsts'
}

export default function TrackerCard({
  title,
  color,
  onAdd,
  children
}: {
  title: string
  color: Color
  onAdd?: () => void
  children: ReactNode
}) {
  return (
    <div className="rounded-card overflow-hidden border border-night-700 bg-night-800">
      <div className={`${HEADER_BG[color]} relative px-5 py-4 flex items-center`}>
        <h3 className="font-display text-3xl text-night-950">{title}</h3>
        {onAdd && (
          <button
            onClick={onAdd}
            aria-label={`Add ${title.toLowerCase()} entry`}
            className="absolute -bottom-5 right-5 w-11 h-11 rounded-full bg-dusk-500 hover:bg-dusk-400 text-night-950 text-2xl leading-none flex items-center justify-center shadow-lg"
          >
            +
          </button>
        )}
      </div>
      <div className="p-5 pt-7 flex flex-col gap-3">{children}</div>
    </div>
  )
}
