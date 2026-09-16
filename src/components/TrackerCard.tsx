import { ReactNode } from 'react'

type Color = 'sleep' | 'pump' | 'feed' | 'diaper'

const HEADER_BG: Record<Color, string> = {
  sleep: 'bg-header-sleep',
  pump: 'bg-header-pump',
  feed: 'bg-header-feed',
  diaper: 'bg-header-diaper'
}

export default function TrackerCard({
  title,
  emoji,
  color,
  children
}: {
  title: string
  emoji: string
  color: Color
  children: ReactNode
}) {
  return (
    <div className="rounded-card overflow-hidden border border-night-700 bg-night-800">
      <div className={`${HEADER_BG[color]} px-5 py-4 flex items-center justify-between`}>
        <h3 className="font-display text-lg text-night-950">{title}</h3>
        <span className="text-2xl">{emoji}</span>
      </div>
      <div className="p-5 flex flex-col gap-3">{children}</div>
    </div>
  )
}
