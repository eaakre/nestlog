import { useMemo, useRef, useState } from 'react'
import { useChildren } from '../contexts/ChildContext'
import { useAuth } from '../contexts/AuthContext'
import { useUnit } from '../lib/units'
import { buildDays } from '../lib/trends'
import { blocksForDay, type Block, type TimelineKind } from '../lib/timeline'
import { useWindowData } from '../lib/useWindowData'
import { useWidth } from '../lib/useWidth'
import type { DayBucket } from '../lib/trends'
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

const Chevron = ({ dir }: { dir: 'left' | 'right' }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
  </svg>
)

// One week of columns (no axis: that stays put while weeks slide past it).
function WeekPanel({
  days,
  blocks,
  now,
  selectedKey,
  onSelectDay,
  onOpen
}: {
  days: DayBucket[]
  blocks: Block[][]
  now: number
  selectedKey: string
  onSelectDay: (k: string) => void
  onOpen: (b: Block) => void
}) {
  const px = PX_PER_HOUR / 60
  const startOf = (b: Block) => (b.kind === 'diaper' ? b.row.time : b.row.start_time)
  return (
    <div className="w-1/3 shrink-0">
      <div className="flex" style={{ height: HEADER_H }}>
        {days.map((d) => (
          <button
            key={d.key}
            onClick={() => onSelectDay(d.key)}
            className={`flex-1 rounded-lg text-center ${d.key === selectedKey ? 'bg-night-700' : ''}`}
            aria-label={`Show ${d.label}`}
          >
            <div className="text-[11px] text-parchment-300">{d.weekday2}</div>
            <div className="text-sm">{d.dom}</div>
          </button>
        ))}
      </div>
      <div className="relative mt-1 flex" style={{ height: HEIGHT }}>
        <div className="absolute inset-x-0 top-0 bg-night-950/50" style={{ height: 7 * PX_PER_HOUR }} />
        <div className="absolute inset-x-0 bottom-0 bg-night-950/50" style={{ height: 5 * PX_PER_HOUR }} />
        {[3, 6, 9, 12, 15, 18, 21].map((h) => (
          <div key={h} className="absolute inset-x-0 border-t border-night-700/60" style={{ top: h * PX_PER_HOUR }} />
        ))}
        {days.map((d, i) => (
          <div key={d.key} className="relative flex-1 border-l border-night-700/60">
            {d.start <= now && now < d.end && (
              <div className="absolute inset-x-0 h-px bg-red-400 z-20" style={{ top: ((now - d.start) / 60000) * px }} />
            )}
            {blocks[i].map((b) => {
              const h = b.kind === 'diaper' ? 8 : Math.max(8, b.mins * px)
              const lane = b.kind === 'sleep' ? 'left-0 right-0' : b.kind === 'feeding' ? 'left-0 right-1/2' : 'left-1/2 right-0'
              return (
                <button
                  key={b.kind + b.id}
                  onClick={() => onOpen(b)}
                  aria-label={`${b.kind} at ${formatClock(startOf(b))}`}
                  className={`absolute ${lane} rounded-[3px] border border-night-800/80 ${b.kind === 'sleep' ? 'z-0 opacity-60' : 'z-10'}`}
                  style={{ top: b.top * px, height: h, background: COLOR[b.kind], minWidth: 6 }}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function History() {
  const { activeChild } = useChildren()
  const { user } = useAuth()
  const { unit } = useUnit()
  const [offset, setOffset] = useState(0) // weeks back
  const [enabled, setEnabled] = useState(loadFilters)
  const [showFilters, setShowFilters] = useState(false)
  const [editing, setEditing] = useState<Block | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  // Swipe state: dx follows the finger; the previous / next weeks sit either side.
  const { ref: viewport, width } = useWidth<HTMLDivElement>(320)
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [instant, setInstant] = useState(false)
  const touch = useRef<{ id: number; x: number; y: number; lastX: number; lastT: number; v: number; intent: 'h' | 'v' | null } | null>(null)
  const dragged = useRef(false)
  const busy = useRef(false)

  const todayKey = new Date().toDateString()
  const weeks = useMemo(() => {
    const t = new Date()
    const week = (o: number) => buildDays(7, new Date(t.getFullYear(), t.getMonth(), t.getDate() - o * 7))
    return [week(offset + 1), week(offset), week(offset - 1)] // earlier, current, later
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, todayKey])
  const days = weeks[1]
  const { data, reload } = useWindowData(activeChild?.id ?? '', weeks[0][0].start, weeks[2][6].end)
  if (!activeChild) return null

  const now = Date.now()
  const hidden = FILTERS.filter((f) => !enabled[f.key]).length
  const selected = days.find((d) => d.key === selectedKey) ?? days.find((d) => d.start <= now && now < d.end) ?? days[6]
  const setFilter = (k: TimelineKind, v: boolean) => {
    const next = { ...enabled, [k]: v }
    setEnabled(next)
    try {
      localStorage.setItem(STORE, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }

  const blocks = weeks.map((w) => w.map((d) => blocksForDay(d, data, enabled, now)))
  const selectedBlocks = [...blocks[1][days.indexOf(selected)]].sort((a, b) => a.top - b.top)
  const range = `${days[0].label.split(', ')[1]} – ${days[6].label.split(', ')[1]}`

  // Slide a week in (dir +1 = earlier week, -1 = later week), then re-center on it.
  const go = (dir: 1 | -1) => {
    if (busy.current || (dir === -1 && offset === 0)) {
      setDx(0)
      return
    }
    busy.current = true
    setDx(dir * width)
    window.setTimeout(() => {
      setInstant(true)
      setOffset((o) => o + dir)
      setSelectedKey(null)
      setDx(0)
      window.requestAnimationFrame(() =>
        window.requestAnimationFrame(() => {
          setInstant(false)
          busy.current = false
        })
      )
    }, 220)
  }

  const onDown = (e: React.PointerEvent) => {
    if (busy.current) return
    touch.current = { id: e.pointerId, x: e.clientX, y: e.clientY, lastX: e.clientX, lastT: e.timeStamp, v: 0, intent: null }
  }
  const onMove = (e: React.PointerEvent) => {
    const t = touch.current
    if (!t || t.id !== e.pointerId) return
    const ddx = e.clientX - t.x
    const ddy = e.clientY - t.y
    if (!t.intent && (Math.abs(ddx) > 8 || Math.abs(ddy) > 8)) {
      t.intent = Math.abs(ddx) > Math.abs(ddy) * 1.2 ? 'h' : 'v'
      if (t.intent === 'h') {
        viewport.current?.setPointerCapture(e.pointerId)
        setDragging(true)
      }
    }
    if (t.intent !== 'h') return
    const dt = Math.max(1, e.timeStamp - t.lastT)
    t.v = (e.clientX - t.lastX) / dt
    t.lastX = e.clientX
    t.lastT = e.timeStamp
    // Can't go past this week: resist instead of moving freely.
    setDx(offset === 0 && ddx < 0 ? ddx * 0.25 : ddx)
  }
  const onUp = (e: React.PointerEvent) => {
    const t = touch.current
    touch.current = null
    if (!t || t.intent !== 'h') return
    dragged.current = true
    window.setTimeout(() => (dragged.current = false), 0)
    setDragging(false)
    const flick = Math.abs(t.v) > 0.5
    const dir = dx > 0 ? 1 : -1
    if (Math.abs(dx) > width * 0.25 || (flick && Math.sign(t.v) === dir)) go(dir)
    else setDx(0)
    try {
      viewport.current?.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
  }

  const describe = (b: Block) =>
    b.kind === 'sleep' ? describeSleep(b.row) : b.kind === 'feeding' ? describeFeeding(b.row, unit) : b.kind === 'diaper' ? describeDiaper(b.row) : describePumping(b.row, unit)
  const startOf = (b: Block) => (b.kind === 'diaper' ? b.row.time : b.row.start_time)
  const editable = (b: Block) => b.kind !== 'pumping' || b.row.logged_by === user?.id

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
        <button className="w-16 h-12 rounded-xl bg-night-800 text-parchment-100 flex items-center justify-center active:bg-night-700" onClick={() => go(1)} aria-label="Previous week">
          <Chevron dir="left" />
        </button>
        <button
          className="flex-1 text-sm text-parchment-300 h-12 disabled:opacity-100"
          onClick={() => {
            setOffset(0)
            setSelectedKey(null)
          }}
          disabled={offset === 0}
        >
          {offset === 0 ? 'This week' : 'Back to this week'}
        </button>
        <button
          className="w-16 h-12 rounded-xl bg-night-800 text-parchment-100 flex items-center justify-center active:bg-night-700 disabled:opacity-30"
          disabled={offset === 0}
          onClick={() => go(-1)}
          aria-label="Next week"
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
          <div
            ref={viewport}
            className="flex-1 min-w-0 overflow-hidden select-none"
            style={{ touchAction: 'pan-y' }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onClickCapture={(e) => {
              if (dragged.current) {
                e.stopPropagation()
                e.preventDefault()
              }
            }}
          >
            <div
              className="flex"
              style={{
                width: '300%',
                transform: `translateX(calc(-33.3333% + ${dx}px))`,
                transition: dragging || instant ? 'none' : 'transform 220ms ease-out',
                willChange: 'transform'
              }}
            >
              {weeks.map((w, wi) => (
                <WeekPanel
                  key={w[0].key}
                  days={w}
                  blocks={blocks[wi]}
                  now={now}
                  selectedKey={wi === 1 ? selected.key : ''}
                  onSelectDay={setSelectedKey}
                  onOpen={setEditing}
                />
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
