import { usePreferredReducedMotion } from '@vueuse/core'
import { onScopeDispose, ref } from 'vue'

import type { Roll } from '@/lib/api'
import { formatClock } from '@/lib/format'

/** The gap between flickers while the roulette runs at full speed, in ms. */
const FAST_MS = 55
/** The fewest fast flickers of the clock, so even an instant answer gets a proper spin. */
const FAST_TICKS = 14
/** The gaps between the clock's last flickers: it slows to a stop. */
const SLOWING_MS = [70, 90, 115, 150, 195, 255, 330, 430]
/** How long the time stands alone before the song starts to roll. */
const HOLD_MS = 450
/** The song's fast flickers, then the steps in which it comes into focus. */
const SONG_TICKS = 6
const SONG_STEPS = 8
const SONG_STEP_MS = 70
/** What the song title is scrambled with. */
const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&?!'

const pick = (from: string) => from[Math.floor(Math.random() * from.length)]
const scramble = (length: number) => Array.from({ length }, () => pick(GLYPHS)).join('')
// Any digits will do: the flicker gives away neither the answer nor what the answers can be.
const randomClock = () => `${pick('0123456789')}:${pick('012345')}${pick('0123456789')}`

/**
 * The roulette's animation, in two parts. `spin` rolls the time: `clock` flickers through
 * nonsense, slows down and settles on it. `reveal` then rolls the song: `title` is scrambled
 * and comes into focus letter by letter. Neither ever shows the possible results.
 */
export function useRoulette() {
  /** The time is rolling. */
  const spinning = ref(false)
  /** The song is rolling. */
  const revealing = ref(false)
  const clock = ref('')
  const title = ref('')
  const motion = usePreferredReducedMotion()

  let stopped = false
  onScopeDispose(() => (stopped = true))
  /** Waits `ms`, or throws once the page has gone, which ends the animation. */
  const wait = (ms: number) =>
    new Promise<void>((resolve, reject) =>
      setTimeout(() => (stopped ? reject(new Error('Left the page')) : resolve()), ms),
    )

  /**
   * Spins until `result` is in, then lands on its time. Resolves with the roll (null when there
   * was nothing to roll) and rejects if `result` does.
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
        await wait(FAST_MS)
      }
      if ('error' in answer.settled) throw answer.settled.error
      const { roll } = answer.settled
      if (!roll) return null

      for (const gap of SLOWING_MS) {
        clock.value = randomClock()
        await wait(gap)
      }
      clock.value = formatClock(roll.seconds)
      navigator.vibrate?.(roll.seconds ? 40 : [40, 60, 40, 60, 120])
      return roll
    } finally {
      spinning.value = false
    }
  }

  /** Rolls the song once the time has had its moment, and settles on `name`. */
  async function reveal(name: string): Promise<void> {
    revealing.value = true
    title.value = ''
    try {
      if (motion.value === 'reduce') return

      await wait(HOLD_MS)
      for (let tick = 0; tick < SONG_TICKS; tick++) {
        title.value = scramble(name.length)
        await wait(FAST_MS)
      }
      for (let step = 1; step < SONG_STEPS; step++) {
        const shown = Math.floor((step / SONG_STEPS) * name.length)
        title.value = name.slice(0, shown) + scramble(name.length - shown)
        await wait(SONG_STEP_MS)
      }
      navigator.vibrate?.(20)
    } finally {
      title.value = name
      revealing.value = false
    }
  }

  return { spinning, revealing, clock, title, spin, reveal }
}
