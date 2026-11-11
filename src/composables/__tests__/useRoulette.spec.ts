import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

import type { Roll } from '@/lib/api'
import { useRoulette } from '../useRoulette'

const roll: Roll = { seconds: 150, track: { id: 2, title: 'Pop That Lock' } }

/** Runs the composable in a scope of its own, as a component would. */
function setup() {
  const scope = effectScope()
  return { scope, roulette: scope.run(useRoulette)! }
}

describe('useRoulette', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('flickers through nonsense, then settles on the roll', async () => {
    const { roulette } = setup()
    const landed = roulette.spin(Promise.resolve(roll))
    expect(roulette.spinning.value).toBe(true)

    // At full speed nothing of the result shows.
    await vi.advanceTimersByTimeAsync(400)
    expect(roulette.clock.value).toMatch(/^\d:[0-5]\d$/)
    expect(roulette.title.value).not.toContain('Pop')

    // As it slows, the song comes into focus from its first letter.
    await vi.advanceTimersByTimeAsync(1400)
    expect(roulette.spinning.value).toBe(true)
    expect(roulette.title.value).toMatch(/^Pop/)
    expect(roulette.title.value).toHaveLength(roll.track.title.length)

    await vi.advanceTimersByTimeAsync(1500)
    expect(await landed).toEqual(roll)
    expect(roulette.spinning.value).toBe(false)
    expect(roulette.clock.value).toBe('2:30')
    expect(roulette.title.value).toBe('Pop That Lock')
  })

  it('stops and passes the error on when the roll fails', async () => {
    const { roulette } = setup()
    const failure = roulette.spin(Promise.reject(new Error('Down'))).catch((err: unknown) => err)
    await vi.advanceTimersByTimeAsync(3000)
    expect(await failure).toEqual(new Error('Down'))
    expect(roulette.spinning.value).toBe(false)
  })

  it('has nothing to land on when there was nothing to roll', async () => {
    const { roulette } = setup()
    const landed = roulette.spin(Promise.resolve(null))
    await vi.advanceTimersByTimeAsync(3000)
    expect(await landed).toBeNull()
    expect(roulette.spinning.value).toBe(false)
  })

  it('skips the show for people who ask for less motion', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('reduce'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    const { roulette } = setup()
    expect(await roulette.spin(Promise.resolve(roll))).toEqual(roll)
    expect(roulette.spinning.value).toBe(false)
  })

  it('ends the spin when the page is left', async () => {
    const { scope, roulette } = setup()
    const failure = roulette.spin(new Promise(() => {})).catch((err: unknown) => err)
    scope.stop()
    await vi.advanceTimersByTimeAsync(200)
    expect(await failure).toEqual(new Error('Left the page'))
    expect(vi.getTimerCount()).toBe(0)
  })
})
