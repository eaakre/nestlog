import { formatDistanceToNowStrict, format, intervalToDuration } from 'date-fns'

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
