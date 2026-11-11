import { usePreferredReducedMotion } from '@vueuse/core'
import { onScopeDispose, ref } from 'vue'

import type { Roll } from '@/lib/api'
import { formatClock } from '@/lib/format'

/** The gap between flickers while the roulette runs at full speed, in ms. */
const FAST_MS = 55
/** The fewest fast flickers, so even an instant answer gets a proper spin. */
const FAST_TICKS = 14
/** The gaps between the last flickers: the roulette slows to a stop. */
const SLOWING_MS = [70, 90, 115, 150, 195, 255, 330, 430]
/** What the song title is scrambled with. */
const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&?!'
const SCRAMBLED_LENGTH = 12

const pick = (from: string) => from[Math.floor(Math.random() * from.length)]
const scramble = (length: number) => Array.from({ length }, () => pick(GLYPHS)).join('')
// Any digits will do: the flicker gives away neither the answer nor what the answers can be.
const randomClock = () => `${pick('0123456789')}:${pick('012345')}${pick('0123456789')}`

/**
 * The roulette's animation: while it spins, `clock` and `title` flicker through nonsense,
 * then slow down and settle on the roll. It never shows the possible results.
 */
export function useRoulette() {
  const spinning = ref(false)
  const clock = ref('')
  const title = ref('')
  const motion = usePreferredReducedMotion()

  let stopped = false
  onScopeDispose(() => (stopped = true))
  /** Waits `ms`, or throws once the page has gone, which ends the spin. */
  const wait = (ms: number) =>
    new Promise<void>((resolve, reject) =>
      setTimeout(() => (stopped ? reject(new Error('Left the page')) : resolve()), ms),
    )

  /**
   * Spins until `result` is in, then lands on it. Resolves with the roll (null when there was
   * nothing to roll) and rejects if `result` does.
   */
  async function spin(result: Promise<Roll | null>): Promise<Roll | null> {
    spinning.value = true
    try {
      if (motion.value === 'reduce') return await result

      const answer: { settled?: { roll: Roll | null } | { error: unknown } } = {}
      result.then(
        (roll) => (answer.settled = { roll }),
        (error: unknown) => (answer.settled = { error }),
      )
      for (let tick = 0; tick < FAST_TICKS || !answer.settled; tick++) {
        clock.value = randomClock()
        title.value = scramble(SCRAMBLED_LENGTH)
        await wait(FAST_MS)
      }
      if ('error' in answer.settled) throw answer.settled.error
      const { roll } = answer.settled
      if (!roll) return null

      // The song comes into focus letter by letter as the clock slows.
      const name = roll.track.title
      for (const [i, gap] of SLOWING_MS.entries()) {
        const shown = Math.floor(((i + 1) / (SLOWING_MS.length + 1)) * name.length)
        clock.value = randomClock()
        title.value = name.slice(0, shown) + scramble(name.length - shown)
        await wait(gap)
      }
      clock.value = formatClock(roll.seconds)
      title.value = name
      navigator.vibrate?.(40)
      return roll
    } finally {
      spinning.value = false
    }
  }

  return { spinning, clock, title, spin }
}
