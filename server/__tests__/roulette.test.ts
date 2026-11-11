import { describe, expect, it } from 'vitest'

import { chances, luck, SECONDS, spin } from '../lib/roulette'

const DAY = 24 * 60 * 60 * 1000
const NOW = 1_800_000_000_000

const average = (odds: number[]) => odds.reduce((sum, chance, i) => sum + chance * SECONDS[i]!, 0)

describe('roulette odds', () => {
  it('ranges from no dance to three minutes', () => {
    expect(SECONDS[0]).toBe(0)
    expect(SECONDS[SECONDS.length - 1]).toBe(180)
  })

  it('averages two minutes by default', () => {
    const odds = chances(0)
    expect(odds.reduce((sum, chance) => sum + chance, 0)).toBeCloseTo(1)
    expect(average(odds)).toBeCloseTo(120)
  })

  it('leans further towards short dances the more luck there is', () => {
    expect(average(chances(0.5))).toBeLessThan(average(chances(0)))
    expect(average(chances(1))).toBeLessThan(average(chances(0.5)))
    expect(chances(1)[0]).toBeGreaterThan(chances(0)[0]!)
    expect(chances(1)[6]).toBeLessThan(chances(0)[6]!)
  })

  it('gives a regular poster the default odds', () => {
    expect(luck(5, NOW - DAY, NOW)).toBe(0)
    expect(luck(40, NOW - 3 * DAY, NOW)).toBe(0)
  })

  it('gives a member with few nikki better odds', () => {
    expect(luck(0, null, NOW)).toBe(1)
    expect(luck(2, NOW - DAY, NOW)).toBeCloseTo(0.6)
    expect(luck(4, NOW - DAY, NOW)).toBeCloseTo(0.2)
  })

  it('gives a member who has not posted in a while better odds', () => {
    expect(luck(40, NOW - 8.5 * DAY, NOW)).toBeCloseTo(0.5)
    expect(luck(40, NOW - 14 * DAY, NOW)).toBe(1)
    expect(luck(40, NOW - 90 * DAY, NOW)).toBe(1)
  })

  it('lands on a time for every random number', () => {
    expect(spin(0, 0)).toBe(0)
    // By default 2% + 4% + 10% + 18% fall below two minutes.
    expect(spin(0, 0.33)).toBe(90)
    expect(spin(0, 0.35)).toBe(120)
    expect(spin(0, 0.999999)).toBe(180)
    for (let i = 0; i < 200; i++) expect(SECONDS).toContain(spin(Math.random()))
  })
})
