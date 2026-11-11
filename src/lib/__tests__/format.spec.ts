import { describe, expect, it } from 'vitest'

import { dayNumber, formatClock, formatShortDate, formatStamp, timeAgo } from '../format'
import { reactionSummary } from '../reactions'

// Local-time dates, so the tests pass in any time zone.
const at = (month: number, day: number, hour = 12, minute = 0) =>
  new Date(2026, month - 1, day, hour, minute).getTime()

describe('formatStamp', () => {
  it('formats as upper-case month, day, year and 24-hour time', () => {
    expect(formatStamp(at(11, 4, 21, 40))).toBe('NOV 04 2026 · 21:40')
    expect(formatStamp(at(1, 9, 0, 5))).toBe('JAN 09 2026 · 00:05')
  })
})

describe('formatClock', () => {
  it('formats seconds as m:ss, rounding up and never below zero', () => {
    expect(formatClock(180)).toBe('3:00')
    expect(formatClock(64.2)).toBe('1:05')
    expect(formatClock(30)).toBe('0:30')
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(-1)).toBe('0:00')
  })
})

describe('formatShortDate', () => {
  it('formats as upper-case month and day', () => {
    expect(formatShortDate(at(10, 31))).toBe('OCT 31')
  })
})

describe('timeAgo', () => {
  const now = at(11, 5, 12)
  it.each([
    [now - 30_000, 'now'],
    [now - 5 * 60_000, '5m'],
    [now - 2 * 3_600_000, '2h'],
    [now - 3 * 86_400_000, '3d'],
    [now - 15 * 86_400_000, '2w'],
  ])('shows %i as %s', (ms, text) => {
    expect(timeAgo(ms, now)).toBe(text)
  })
})

describe('dayNumber', () => {
  it('counts calendar days from the first nikki, starting at 1', () => {
    expect(dayNumber(at(11, 1, 23, 59), at(11, 1, 0, 1))).toBe(1)
    expect(dayNumber(at(11, 1, 23, 59), at(11, 2, 0, 1))).toBe(2)
    expect(dayNumber(at(10, 14), at(11, 5))).toBe(23)
  })
})

describe('reactionSummary', () => {
  it('lists emoji counts, most popular first', () => {
    expect(reactionSummary({ '💧': 3, '🔥': 4, '🕺': 2 })).toBe('🔥 4 · 💧 3 · 🕺 2')
    expect(reactionSummary({})).toBe('')
  })
})
