import { useMemo, useState } from 'react'
import { useChildren } from '../contexts/ChildContext'
import { useUnit, mlToUnit } from '../lib/units'
import { buildDays } from '../lib/trends'
import { useWindowData } from '../lib/useWindowData'
import { headline, loggedDays, fmtMetric, fmtDuration, METRICS, PART_COLORS, SECTIONS, SECTION_COLOR, DAY_START_HOUR, DAY_END_HOUR, type Metric } from '../lib/metrics'
import BarChart from '../components/charts/BarChart'
import BottomNav from '../components/BottomNav'

const PERIODS = [1, 7, 14, 30]

export default function Trends() {
  const { activeChild } = useChildren()
  const { unit } = useUnit()
  const [count, setCount] = useState(7)
  const [open, setOpen] = useState<string | null>(null)

  const todayKey = new Date().toDateString()
  const days = useMemo(() => buildDays(count * 2), [count, todayKey])
  const { data, loading } = useWindowData(activeChild?.id ?? '', days[0].start, days[days.length - 1].end)
  if (!activeChild) return null

  const now = Date.now()
  const logged = loggedDays(data, days)
  const cur = days.slice(count)
  const sliceCur = <T,>(a: T[]) => a.slice(count)
  const sliceOld = <T,>(a: T[]) => a.slice(0, count)
  const hasData = logged.some(Boolean)

  const delta = (c: number | null, p: number | null) => {
    if (c === null || p === null || p === 0) return null
    const pct = Math.round(((c - p) / p) * 100)
    return pct === 0 ? null : pct
  }

  const row = (m: { title: string; icon: string; suffix: string; kind: Metric['kind'] }, daily: { v: number[]; w: number[] }, indent = false, onClick?: () => void, expanded?: boolean) => {
    const c = headline({ v: sliceCur(daily.v), w: sliceCur(daily.w) })
    const p = headline({ v: sliceOld(daily.v), w: sliceOld(daily.w) })
    const d = delta(c, p)
    const Tag = onClick ? 'button' : 'div'
    return (
      <Tag
        onClick={onClick}
        aria-expanded={onClick ? expanded : undefined}
        className={`w-full flex items-center gap-3 py-3 text-left ${indent ? 'pl-9 text-sm' : ''}`}
      >
        {!indent && <span className="text-xl w-6 text-center" aria-hidden>{m.icon}</span>}
        <span className="flex-1 min-w-0">
          <span className="block">{m.title}</span>
          <span className="block text-xs text-parchment-300">{c === null ? '—' : `${fmtMetric(m.kind, c, unit)} ${m.suffix}`}</span>
        </span>
        {d !== null && (
          <span className="text-xs px-2 py-1 rounded-full bg-night-700 text-parchment-100" title="vs previous period">
            {d > 0 ? '↑' : '↓'} {Math.abs(d)}%
          </span>
        )}
        {onClick && <span className="text-parchment-300">{expanded ? '⌃' : '⌄'}</span>}
      </Tag>
    )
  }

  const chartFor = (m: Metric) => {
    const parts = m.stacked && m.breakdown ? m.breakdown : null
    const series = parts ? parts.map((p, i) => ({ key: p.key, label: p.label, color: PART_COLORS[i] })) : [{ key: m.key, label: m.title, color: SECTION_COLOR[m.section] }]
    const calcs = parts ? parts.map((p) => p.compute(data, days, now, logged)) : [m.compute(data, days, now, logged)]
    const conv = (n: number) => (m.kind === 'volume' ? Number(mlToUnit(n, unit)) : n)
    const values = calcs.map((c) => sliceCur(c.v).map(conv))
    const fmt = (n: number) => (m.kind === 'duration' ? fmtDuration(n) : m.kind === 'volume' ? `${Number(n.toFixed(1))} ${unit}` : String(Number(n.toFixed(1))))
    return (
      <BarChart
        title={m.title}
        subtitle={m.suffix === 'average' ? 'Daily average' : 'Per day'}
        days={cur}
        series={series}
        values={values}
        fmt={fmt}
        axisFmt={m.kind === 'duration' ? (n) => (n >= 60 ? `${Number((n / 60).toFixed(1))}h` : `${n}m`) : undefined}
        labelMode={count <= 7 ? 'weekday' : 'short'}
      />
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 pb-24 pt-8">
      <h1 className="text-2xl mb-1">Trends</h1>
      <p className="text-parchment-300 text-sm mb-4">{activeChild.name} · compared with the previous {count === 1 ? 'day' : `${count} days`}</p>

      <div className="flex gap-2 mb-5" role="group" aria-label="Period">
        {PERIODS.map((p) => (
          <button key={p} onClick={() => setCount(p)} className={`flex-1 rounded-full py-2 text-sm ${p === count ? 'bg-dusk-500 text-parchment-100' : 'bg-night-800 text-parchment-300'}`} aria-pressed={p === count}>
            {p}d
          </button>
        ))}
      </div>

      {!loading && !hasData && <p className="text-parchment-300 text-sm mb-4">No entries in this period yet.</p>}

      {SECTIONS.map((s) => (
        <section key={s.key} className="mb-6">
          <h2 className="text-lg mb-2" style={{ color: SECTION_COLOR[s.key] }}>{s.title}</h2>
          <div className="card !py-1 divide-y divide-night-700">
            {METRICS.filter((m) => m.section === s.key).map((m) => {
              const daily = m.compute(data, days, now, logged)
              const isOpen = open === m.key
              return (
                <div key={m.key}>
                  {row(m, daily, false, () => setOpen(isOpen ? null : m.key), isOpen)}
                  {m.breakdown?.map((b) => (
                    <div key={b.key}>{row({ title: b.label, icon: '', suffix: m.suffix, kind: m.kind }, b.compute(data, days, now, logged), true)}</div>
                  ))}
                  {isOpen && <div className="pb-3">{chartFor(m)}</div>}
                </div>
              )
            })}
          </div>
        </section>
      ))}

      <p className="text-xs text-parchment-300">
        Daytime is {DAY_START_HOUR > 12 ? DAY_START_HOUR - 12 : DAY_START_HOUR}AM–{DAY_END_HOUR - 12}PM. Averages only count days with entries.
      </p>
      <BottomNav />
    </div>
  )
}
