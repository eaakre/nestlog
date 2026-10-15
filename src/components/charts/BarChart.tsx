import { useId, useState } from 'react'
import { useWidth } from '../../lib/useWidth'
import { compact, niceScale, type DayBucket } from '../../lib/trends'

export type Series = { key: string; label: string; color: string }

const H = 190
const M = { top: 10, right: 8, bottom: 24, left: 34 }
const MAX_BAR = 24 // thin marks: never fill the slot
const GAP = 2 // surface-colored gap between stacked segments
const SURFACE = '#242C3F' // card surface (night-800) — the gap / ring color

// Top corners rounded, square at the baseline.
function roundedTop(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h)
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`
}

/**
 * Per-day columns. One series = plain columns; several = stacked.
 * values[seriesIndex][dayIndex]. `fmt` formats a value for tooltip/table.
 */
export default function BarChart({
  title,
  subtitle,
  days,
  series,
  values,
  fmt,
  axisFmt = compact,
  labelMode
}: {
  title: string
  subtitle?: string
  days: DayBucket[]
  series: Series[]
  values: number[][]
  fmt: (n: number) => string
  axisFmt?: (n: number) => string
  labelMode: 'weekday' | 'short'
}) {
  const { ref, width } = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const [table, setTable] = useState(false)
  const uid = useId()

  const n = days.length
  const totals = days.map((_, d) => series.reduce((sum, _s, s) => sum + (values[s][d] || 0), 0))
  const { top, ticks } = niceScale(Math.max(...totals, 0))
  const innerW = Math.max(40, width - M.left - M.right)
  const innerH = H - M.top - M.bottom
  const slot = innerW / n
  const barW = Math.max(3, Math.min(MAX_BAR, slot * 0.62))
  const y = (v: number) => M.top + innerH - (v / top) * innerH
  const empty = totals.every((t) => t === 0)

  const labelEvery = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(innerW / (labelMode === 'weekday' ? 34 : 40)))))

  const tipLeft = hover === null ? 0 : Math.min(Math.max(M.left + slot * hover + slot / 2, 80), Math.max(80, width - 80))

  return (
    <section className="card !p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h2 className="font-display text-xl text-parchment-100">{title}</h2>
          {subtitle && <p className="text-parchment-300 text-xs">{subtitle}</p>}
        </div>
        <button className="text-xs text-parchment-300 underline underline-offset-2 shrink-0" onClick={() => setTable((t) => !t)}>
          {table ? 'View chart' : 'View table'}
        </button>
      </div>

      {series.length > 1 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 mb-2" aria-label="Legend">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5 text-xs text-parchment-200">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </li>
          ))}
        </ul>
      )}

      {table ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-parchment-300 text-xs">
              <tr>
                <th className="py-1 pr-3 font-medium">Day</th>
                {series.map((s) => (
                  <th key={s.key} className="py-1 pr-3 font-medium">
                    {s.label}
                  </th>
                ))}
                {series.length > 1 && <th className="py-1 font-medium">Total</th>}
              </tr>
            </thead>
            <tbody className="text-parchment-100">
              {days.map((d, i) => (
                <tr key={d.key} className="border-t border-night-700">
                  <td className="py-1 pr-3 text-parchment-300">{d.label}</td>
                  {series.map((s, si) => (
                    <td key={s.key} className="py-1 pr-3 tabular-nums">
                      {fmt(values[si][i] || 0)}
                    </td>
                  ))}
                  {series.length > 1 && <td className="py-1 tabular-nums">{fmt(totals[i])}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={ref} className="relative" onPointerLeave={() => setHover(null)}>
          <svg width={width} height={H} role="img" aria-label={`${title}. ${subtitle ?? ''}`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? '#4A5570' : '#323C54'} strokeWidth={1} />
                <text x={M.left - 6} y={y(t) + 4} textAnchor="end" className="fill-parchment-300" style={{ fontSize: 11, opacity: 0.75 }}>
                  {axisFmt(t)}
                </text>
              </g>
            ))}

            {days.map((d, i) => {
              const cx = M.left + slot * i + slot / 2
              const x = cx - barW / 2
              let acc = 0
              const lastNonZero = series.reduce((last, _s, si) => ((values[si][i] || 0) > 0 ? si : last), -1)
              const dim = hover !== null && hover !== i
              return (
                <g key={d.key} opacity={dim ? 0.45 : 1}>
                  {series.map((s, si) => {
                    const v = values[si][i] || 0
                    if (v <= 0) return null
                    const y0 = y(acc + v)
                    const y1 = y(acc)
                    acc += v
                    const h = Math.max(2, y1 - y0 - (si > 0 && acc - v > 0 ? GAP : 0))
                    return si === lastNonZero ? (
                      <path key={s.key} d={roundedTop(x, y0, barW, h, 4)} fill={s.color} />
                    ) : (
                      <rect key={s.key} x={x} y={y0} width={barW} height={h} fill={s.color} />
                    )
                  })}
                  {i % labelEvery === 0 && (
                    <text x={cx} y={H - 7} textAnchor="middle" className="fill-parchment-300" style={{ fontSize: 11, opacity: 0.75 }}>
                      {labelMode === 'weekday' ? d.weekday : d.short}
                    </text>
                  )}
                </g>
              )
            })}

            {/* Hit targets: the whole column, so the pointer never has to land on a thin bar. */}
            {days.map((d, i) => (
              <rect
                key={`hit-${d.key}`}
                x={M.left + slot * i}
                y={0}
                width={slot}
                height={H}
                fill="transparent"
                tabIndex={0}
                role="img"
                aria-label={`${d.label}: ${series.map((s, si) => `${s.label} ${fmt(values[si][i] || 0)}`).join(', ')}`}
                onPointerEnter={() => setHover(i)}
                onPointerMove={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                style={{ outline: 'none' }}
              />
            ))}
            {hover !== null && (
              <rect x={M.left + slot * hover} y={M.top} width={slot} height={innerH} fill="none" stroke={SURFACE} strokeWidth={0} id={`${uid}-hover`} />
            )}
          </svg>

          {empty && (
            <p className="absolute inset-0 flex items-center justify-center text-parchment-300 text-sm pointer-events-none" style={{ paddingBottom: M.bottom }}>
              Nothing logged in this period
            </p>
          )}

          {hover !== null && (
            <div
              className="absolute z-10 pointer-events-none rounded-xl bg-night-950 border border-night-600 px-3 py-2 shadow-lg text-xs"
              style={{ left: tipLeft, top: 0, transform: 'translateX(-50%)', minWidth: 120 }}
            >
              <p className="text-parchment-300 mb-1">{days[hover].label}</p>
              {series.map((s, si) => (
                <p key={s.key} className="flex items-center gap-2 text-parchment-100">
                  <span className="inline-block w-3 h-0.5 rounded" style={{ background: s.color, height: 3 }} />
                  <span className="font-semibold tabular-nums">{fmt(values[si][hover] || 0)}</span>
                  {series.length > 1 && <span className="text-parchment-300">{s.label}</span>}
                </p>
              ))}
              {series.length > 1 && (
                <p className="flex items-center gap-2 text-parchment-100 border-t border-night-700 mt-1 pt-1">
                  <span className="font-semibold tabular-nums">{fmt(totals[hover])}</span>
                  <span className="text-parchment-300">Total</span>
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
