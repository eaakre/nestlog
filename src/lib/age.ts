const pad = (n: number) => String(n).padStart(2, '0')
const daysInMonth = (y: number, m0: number) => new Date(y, m0 + 1, 0).getDate()

export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const parse = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m: m - 1, d }
}

/** Age on a given day as "8m 3w 3d" (zero parts left out). "" if before birth. */
export function formatAge(birthISO: string | null, onISO: string): string {
  if (!birthISO) return ''
  const b = parse(birthISO)
  const o = parse(onISO)
  const birth = new Date(b.y, b.m, b.d).getTime()
  const on = new Date(o.y, o.m, o.d).getTime()
  if (on < birth) return ''

  let months = (o.y - b.y) * 12 + (o.m - b.m)
  if (o.d < b.d) months--
  // Anchor = the birthday-of-the-month that many months after birth (clamped to month length).
  const am = b.m + months
  const ay = b.y + Math.floor(am / 12)
  const amo = ((am % 12) + 12) % 12
  const anchor = new Date(ay, amo, Math.min(b.d, daysInMonth(ay, amo))).getTime()
  const days = Math.round((on - anchor) / 86400000)
  const weeks = Math.floor(days / 7)
  const rest = days % 7

  const parts = []
  if (months > 0) parts.push(`${months}m`)
  if (weeks > 0) parts.push(`${weeks}w`)
  if (rest > 0) parts.push(`${rest}d`)
  return parts.length ? parts.join(' ') : 'Birth day'
}

/** "Oct 14, 2026" from "2026-10-14" without timezone surprises. */
export function formatDay(iso: string): string {
  const { y, m, d } = parse(iso)
  return new Date(y, m, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
