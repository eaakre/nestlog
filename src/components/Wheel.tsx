import { useEffect, useRef } from 'react'

const ITEM = 40
const VISIBLE = 5
const REPS = 9 // copies of the list when looping; we always rest in the middle one
const MID = Math.floor(REPS / 2)

// One iOS-style snapping column. Controlled by `index`; reports the centered item.
// With `loop`, the list repeats endlessly (12 sits above 1, 59 above 00).
export default function Wheel({
  items,
  index,
  onIndex,
  label,
  loop = false,
  className = ''
}: {
  items: string[]
  index: number
  onIndex: (i: number) => void
  label: string
  loop?: boolean
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<number>()
  const settled = useRef(index)
  const n = items.length
  const reps = loop ? REPS : 1
  const home = (i: number) => ((loop ? MID * n : 0) + i) * ITEM

  // Move the wheel when the value changes from outside.
  useEffect(() => {
    const el = ref.current
    if (el) {
      const cur = Math.round(el.scrollTop / ITEM)
      const curIdx = loop ? ((cur % n) + n) % n : cur
      if (curIdx !== index || Math.abs(el.scrollTop - cur * ITEM) > 1) el.scrollTop = home(index)
    }
    settled.current = index
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, n, loop])

  const onScroll = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const el = ref.current
      if (!el) return
      const raw = Math.round(el.scrollTop / ITEM)
      const i = loop ? ((raw % n) + n) % n : Math.max(0, Math.min(n - 1, raw))
      // Silently jump back to the middle copy (looks identical) so we never run out of list.
      if (loop && raw !== MID * n + i) el.scrollTop = home(i)
      if (i !== settled.current) {
        settled.current = i
        onIndex(i)
      }
    }, 90)
  }

  const step = (d: number) => {
    const next = loop ? (index + d + n) % n : index + d
    if (next >= 0 && next < n) onIndex(next)
  }

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label={label}
      tabIndex={0}
      onScroll={onScroll}
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown') step(1)
        if (e.key === 'ArrowUp') step(-1)
      }}
      className={`overflow-y-scroll snap-y snap-mandatory no-scrollbar ${className}`}
      style={{ height: ITEM * VISIBLE, paddingBlock: ITEM * ((VISIBLE - 1) / 2), scrollbarWidth: 'none' }}
    >
      {Array.from({ length: n * reps }, (_, k) => {
        const i = k % n
        return (
          <div
            key={k}
            role="option"
            aria-selected={i === index}
            onClick={() => {
              ref.current?.scrollTo({ top: k * ITEM, behavior: 'smooth' })
            }}
            className={`snap-center flex items-center justify-center whitespace-nowrap text-lg transition-opacity ${
              i === index ? 'text-parchment-100' : 'text-parchment-300 opacity-60'
            }`}
            style={{ height: ITEM }}
          >
            {items[i]}
          </div>
        )
      })}
    </div>
  )
}
