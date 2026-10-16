import { formatDistanceToNowStrict, format, intervalToDuration, isToday, isYesterday, differenceInCalendarDays } from 'date-fns'

export function formatClock(iso: string) {
  return format(new Date(iso), 'h:mm a')
}

export function formatRelative(iso: string) {
  return formatDistanceToNowStrict(new Date(iso), { addSuffix: true })
}

export function formatElapsed(startIso: string, nowMs: number) {
  const duration = intervalToDuration({ start: new Date(startIso), end: new Date(nowMs) })
  const h = duration.hours ?? 0
  const m = duration.minutes ?? 0
  const s = duration.seconds ?? 0
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function formatDurationMinutes(minutes: number | null) {
  if (minutes == null) return null
  if (minutes < 60) return `${Math.round(minutes)}m`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return `${h}h ${m}m`
}

export function toDatetimeLocalValue(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromDatetimeLocalValue(value: string) {
  return new Date(value).toISOString()
}

/** "4h 12m ago", "23m ago", "1d 3h ago": hours and minutes, for the big readout on a card. */
export function formatAgo(iso: string, nowMs = Date.now()) {
  const mins = Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 60000))
  if (mins < 1) return 'just now'
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  if (d > 0) return `${d}d ${h}h ago`
  if (h > 0) return `${h}h ${m}m ago`
  return `${m}m ago`
}

/** "8:23am" for today; "Yesterday 8:23am", "Wed 8:23am" or "Oct 3 8:23am" for earlier entries. */
export function formatEntryTime(iso: string) {
  const d = new Date(iso)
  const clock = format(d, 'h:mmaaa')
  if (isToday(d)) return clock
  if (isYesterday(d)) return `Yesterday ${clock}`
  if (differenceInCalendarDays(new Date(), d) < 7) return `${format(d, 'EEE')} ${clock}`
  return `${format(d, 'MMM d')} ${clock}`
}
