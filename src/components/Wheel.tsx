import { useEffect, useRef } from 'react'

const ITEM = 40
const VISIBLE = 5

// One iOS-style snapping column. Controlled by `index`; reports the centered item.
export default function Wheel({
  items,
  index,
  onIndex,
  label,
  className = ''
}: {
  items: string[]
  index: number
  onIndex: (i: number) => void
  label: string
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<number>()
  const settled = useRef(index)

  // Move the wheel when the value changes from outside.
  useEffect(() => {
    const el = ref.current
    if (el && Math.abs(el.scrollTop - index * ITEM) > 1) el.scrollTop = index * ITEM
    settled.current = index
  }, [index, items.length])

  const onScroll = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const el = ref.current
      if (!el) return
      const i = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ITEM)))
      if (i !== settled.current) {
        settled.current = i
        onIndex(i)
      }
    }, 90)
  }

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label={label}
      tabIndex={0}
      onScroll={onScroll}
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown' && index < items.length - 1) onIndex(index + 1)
        if (e.key === 'ArrowUp' && index > 0) onIndex(index - 1)
      }}
      className={`overflow-y-scroll snap-y snap-mandatory no-scrollbar ${className}`}
      style={{ height: ITEM * VISIBLE, paddingBlock: ITEM * ((VISIBLE - 1) / 2), scrollbarWidth: 'none' }}
    >
      {items.map((t, i) => (
        <div
          key={i}
          role="option"
          aria-selected={i === index}
          onClick={() => {
            ref.current?.scrollTo({ top: i * ITEM, behavior: 'smooth' })
          }}
          className={`snap-center flex items-center justify-center whitespace-nowrap text-lg transition-opacity ${
            i === index ? 'text-parchment-100' : 'text-parchment-300 opacity-60'
          }`}
          style={{ height: ITEM }}
        >
          {t}
        </div>
      ))}
    </div>
  )
}
