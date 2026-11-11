const DAY_MS = 24 * 60 * 60 * 1000

const parts = (ms: number, options: Intl.DateTimeFormatOptions) =>
  Object.fromEntries(
    new Intl.DateTimeFormat('en-US', options).formatToParts(ms).map((p) => [p.type, p.value]),
  )

/** "NOV 04 2026 · 21:40": the timestamp style used on a nikki. */
export function formatStamp(ms: number): string {
  const p = parts(ms, {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  return `${p.month!.toUpperCase()} ${p.day} ${p.year} · ${p.hour}:${p.minute}`
}

/** "NOV 04": the short date on a history row. */
export function formatShortDate(ms: number): string {
  const p = parts(ms, { month: 'short', day: '2-digit' })
  return `${p.month!.toUpperCase()} ${p.day}`
}

/** "now", "5m", "2h", "3d" or "2w": the time since `ms`. */
export function timeAgo(ms: number, now = Date.now()): string {
  const minutes = Math.floor((now - ms) / 60_000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return `${Math.floor(days / 7)}w`
}

/** "1:30": seconds as a countdown clock. */
export function formatClock(seconds: number): string {
  const sec = Math.max(0, Math.ceil(seconds))
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

const localMidnight = (ms: number) => {
  const d = new Date(ms)
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Day of the plant's diary: day 1 is the calendar day of its first nikki, in local time. */
export function dayNumber(firstMs: number, ms = Date.now()): number {
  return Math.round((localMidnight(ms) - localMidnight(firstMs)) / DAY_MS) + 1
}
