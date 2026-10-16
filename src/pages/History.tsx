import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useChildren } from '../contexts/ChildContext'
import { useAuth } from '../contexts/AuthContext'
import { useUnit } from '../lib/units'
import { buildDays } from '../lib/trends'
import { blocksForDay, type Block, type TimelineKind } from '../lib/timeline'
import { useWindowData } from '../lib/useWindowData'
import { useWidth } from '../lib/useWidth'
import { describeDiaper, describeFeeding, describePumping, describeSleep } from '../lib/describe'
import { formatClock } from '../lib/format'
import Modal from '../components/Modal'
import BottomNav from '../components/BottomNav'
import SleepEditor from '../components/editors/SleepEditor'
import FeedingEditor from '../components/editors/FeedingEditor'
import DiaperEditor from '../components/editors/DiaperEditor'
import PumpingEditor from '../components/editors/PumpingEditor'
import Toggle from '../components/Toggle'

const PX_PER_HOUR = 22
const HEIGHT = 24 * PX_PER_HOUR
const AXIS = 38
const COLOR: Record<TimelineKind, string> = { sleep: '#AEE0EF', feeding: '#F0C24C', pumping: '#F2A79E', diaper: '#F2ECD8' }
const FILTERS: { key: TimelineKind; label: string }[] = [
  { key: 'feeding', label: 'Feed' },
  { key: 'diaper', label: 'Diaper' },
  { key: 'sleep', label: 'Sleep' },
  { key: 'pumping', label: 'Pump' }
]
const STORE = 'nestlog.history.filters'

function loadFilters(): Record<TimelineKind, boolean> {
  const all = { sleep: true, feeding: true, diaper: true, pumping: true }
  try {
    return { ...all, ...JSON.parse(localStorage.getItem(STORE) ?? '{}') }
  } catch {
    return all
  }
}

const hourLabel = (h: number) => (h === 0 || h === 24 ? '12AM' : h === 12 ? '12PM' : h < 12 ? `${h}AM` : `${h - 12}PM`)
const HEADER_H = 48
const VISIBLE_DAYS = 7
const MORE = 28 // days added each time you scroll near the oldest loaded day

const Chevron = ({ dir }: { dir: 'left' | 'right' }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
  </svg>
)

const startOf = (b: Block) => (b.kind === 'diaper' ? b.row.time : b.row.start_time)

export default function History() {
  const { activeChild } = useChildren()
  const { user } = useAuth()
  const { unit } = useUnit()
  const [enabled, setEnabled] = useState(loadFilters)
  const [showFilters, setShowFilters] = useState(false)
  const [editing, setEditing] = useState<Block | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  // A continuous strip of days ending today. You scroll it freely; older days load as you approach them.
  const [count, setCount] = useState(56)
  const [firstIdx, setFirstIdx] = useState(0) // leftmost visible day
  const [atEnd, setAtEnd] = useState(true)
  const { ref: scroller, width } = useWidth<HTMLDivElement>(320)
  const colW = width / VISIBLE_DAYS
  const ready = useRef(false)
  const shift = useRef(0)
  const frame = useRef(0)

  const todayKey = new Date().toDateString()
  const days = useMemo(() => buildDays(count), [count, todayKey])
  const { data, reload } = useWindowData(activeChild?.id ?? '', days[0].start, days[days.length - 1].end)

  // Start at the right edge (today). When older days are added on the left, keep the view where it was.
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    if (!ready.current) {
      el.scrollLeft = el.scrollWidth
      ready.current = true
    } else if (shift.current) {
      el.scrollLeft += shift.current
      shift.current = 0
    }
  }, [count, scroller, colW])

  const onScroll = useCallback(() => {
    if (frame.current) return
    frame.current = window.requestAnimationFrame(() => {
      frame.current = 0
      const el = scroller.current
      if (!el || !colW) return
      setFirstIdx(Math.max(0, Math.round(el.scrollLeft / colW)))
      setAtEnd(el.scrollLeft >= el.scrollWidth - el.clientWidth - 2)
      if (el.scrollLeft < colW * 10 && !shift.current && count < 700) {
        shift.current = MORE * colW
        setCount((c) => c + MORE)
      }
    })
  }, [colW, count, scroller])

  const minute = Math.floor(Date.now() / 60000)
  const blocks = useMemo(() => {
    const now = Date.now()
    return days.map((d) => blocksForDay(d, data, enabled, now))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, data, enabled, minute])
  if (!activeChild) return null

  const now = Date.now()
  const hidden = FILTERS.filter((f) => !enabled[f.key]).length
  const selected = days.find((d) => d.key === selectedKey) ?? days.find((d) => d.start <= now && now < d.end) ?? days[days.length - 1]
  const selectedBlocks = [...blocks[days.indexOf(selected)]].sort((a, b) => a.top - b.top)
  const lo = days[Math.min(firstIdx, days.length - 1)]
  const hi = days[Math.min(firstIdx + VISIBLE_DAYS - 1, days.length - 1)]
  const range = `${lo.label.split(', ')[1]} – ${hi.label.split(', ')[1]}`

  const setFilter = (k: TimelineKind, v: boolean) => {
    const next = { ...enabled, [k]: v }
    setEnabled(next)
    try {
      localStorage.setItem(STORE, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }

  const page = (dir: 1 | -1) => scroller.current?.scrollBy({ left: dir * colW * VISIBLE_DAYS, behavior: 'smooth' })
  const toToday = () => scroller.current?.scrollTo({ left: scroller.current.scrollWidth, behavior: 'smooth' })

  const describe = (b: Block) =>
    b.kind === 'sleep' ? describeSleep(b.row) : b.kind === 'feeding' ? describeFeeding(b.row, unit) : b.kind === 'diaper' ? describeDiaper(b.row) : describePumping(b.row, unit)
  const editable = (_b: Block) => true
  const px = PX_PER_HOUR / 60

  return (
    <div className="max-w-lg mx-auto px-2 pb-24 pt-6">
      <div className="flex items-center justify-between px-2 mb-3">
        <div>
          <h1 className="text-2xl">{activeChild.name}</h1>
          <p className="text-parchment-300 text-sm">{range}</p>
        </div>
        <button className="btn-ghost relative !px-3 !py-2 text-sm" onClick={() => setShowFilters(true)}>
          Filters
          {hidden > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-dusk-500 text-xs flex items-center justify-center">{hidden}</span>
          )}
        </button>
      </div>

      <div className="flex items-center justify-between gap-2 mb-2">
        <button className="w-16 h-12 rounded-xl bg-night-800 text-parchment-100 flex items-center justify-center active:bg-night-700" onClick={() => page(-1)} aria-label="Back one week">
          <Chevron dir="left" />
        </button>
        <button className="flex-1 text-sm text-parchment-300 h-12" onClick={toToday} disabled={atEnd}>
          {atEnd ? 'Up to date' : 'Jump to today'}
        </button>
        <button
          className="w-16 h-12 rounded-xl bg-night-800 text-parchment-100 flex items-center justify-center active:bg-night-700 disabled:opacity-30"
          disabled={atEnd}
          onClick={() => page(1)}
          aria-label="Forward one week"
        >
          <Chevron dir="right" />
        </button>
      </div>

      <div className="card !p-2">
        <div className="flex">
          <div className="relative shrink-0" style={{ width: AXIS }}>
            <div style={{ height: HEADER_H }} />
            <div className="relative mt-1" style={{ height: HEIGHT }}>
              {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => (
                <span key={h} className="absolute right-1 text-[10px] text-parchment-300 -translate-y-1/2" style={{ top: h * PX_PER_HOUR }}>
                  {hourLabel(h)}
                </span>
              ))}
            </div>
          </div>

          <div ref={scroller} onScroll={onScroll} className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden no-scrollbar" style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain', overflowAnchor: 'none' }}>
            <div className="flex" style={{ width: `${(days.length * 100) / VISIBLE_DAYS}%` }}>
              {days.map((d, i) => (
                <div key={d.key} className="shrink-0" style={{ width: `${100 / days.length}%` }}>
                  <button
                    onClick={() => setSelectedKey(d.key)}
                    className={`w-full rounded-lg text-center ${d.key === selected.key ? 'bg-night-700' : ''}`}
                    style={{ height: HEADER_H }}
                    aria-label={`Show ${d.label}`}
                  >
                    <div className="text-[11px] text-parchment-300">{d.dom === 1 ? d.label.split(' ')[1] : d.weekday2}</div>
                    <div className="text-sm">{d.dom}</div>
                  </button>
                  <div className="relative mt-1 border-l border-night-700/60" style={{ height: HEIGHT }}>
                    <div className="absolute inset-x-0 top-0 bg-night-950/50" style={{ height: 7 * PX_PER_HOUR }} />
                    <div className="absolute inset-x-0 bottom-0 bg-night-950/50" style={{ height: 5 * PX_PER_HOUR }} />
                    {[3, 6, 9, 12, 15, 18, 21].map((h) => (
                      <div key={h} className="absolute inset-x-0 border-t border-night-700/60" style={{ top: h * PX_PER_HOUR }} />
                    ))}
                    {d.start <= now && now < d.end && (
                      <div className="absolute inset-x-0 h-px bg-red-400 z-20" style={{ top: ((now - d.start) / 60000) * px }} />
                    )}
                    {blocks[i].map((b) => {
                      const h = b.kind === 'diaper' ? 8 : Math.max(8, b.mins * px)
                      const lane = b.kind === 'sleep' ? 'left-0 right-0' : b.kind === 'feeding' ? 'left-0 right-1/2' : 'left-1/2 right-0'
                      return (
                        <button
                          key={b.kind + b.id}
                          onClick={() => setEditing(b)}
                          aria-label={`${b.kind} at ${formatClock(startOf(b))}`}
                          className={`absolute ${lane} rounded-[3px] border border-night-800/80 ${b.kind === 'sleep' ? 'z-0 opacity-60' : 'z-10'}`}
                          style={{ top: b.top * px, height: h, background: COLOR[b.kind], minWidth: 6 }}
                        />
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 px-2 pt-2 text-xs text-parchment-300">
          {FILTERS.map((f) => (
            <span key={f.key} className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: COLOR[f.key] }} /> {f.label}
            </span>
          ))}
        </div>
      </div>

      <h2 className="px-2 mt-5 mb-2 text-lg">{selected.label}</h2>
      <div className="card flex flex-col divide-y divide-night-700 !py-1">
        {selectedBlocks.length === 0 && <p className="py-4 text-parchment-300 text-sm">Nothing logged.</p>}
        {selectedBlocks.map((b) => {
          const desc = describe(b)
          return (
            <button key={b.kind + b.id} className="py-3 flex items-center gap-3 text-left disabled:opacity-70" disabled={!editable(b)} onClick={() => setEditing(b)}>
              <span className="w-2.5 h-9 rounded-full shrink-0" style={{ background: COLOR[b.kind] }} />
              <span className="flex-1 min-w-0">
                <span className="block truncate">{desc.text}</span>
                {desc.sub && <span className="block text-xs text-parchment-300 truncate">{desc.sub}</span>}
              </span>
              <span className="text-xs text-parchment-300">{formatClock(startOf(b))}</span>
            </button>
          )
        })}
      </div>

      {showFilters && (
        <Modal title="Filters" onClose={() => setShowFilters(false)}>
          <div className="flex flex-col gap-2">
            {FILTERS.map((f) => (
              <Toggle key={f.key} label={f.label} checked={enabled[f.key]} onChange={(v) => setFilter(f.key, v)} />
            ))}
          </div>
        </Modal>
      )}

      {editing && editable(editing) && (
        <>
          {editing.kind === 'sleep' && <SleepEditor entry={editing.row} onClose={() => setEditing(null)} onChanged={reload} />}
          {editing.kind === 'feeding' && <FeedingEditor entry={editing.row} onClose={() => setEditing(null)} onChanged={reload} />}
          {editing.kind === 'diaper' && <DiaperEditor childId={activeChild.id} entry={editing.row} onClose={() => setEditing(null)} onChanged={reload} />}
          {editing.kind === 'pumping' && <PumpingEditor entry={editing.row} onClose={() => setEditing(null)} onChanged={reload} />}
        </>
      )}
      <BottomNav />
    </div>
  )
}
