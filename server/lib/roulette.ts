const DAY_MS = 24 * 60 * 60 * 1000

/** The dance times the roulette can land on, in seconds. */
export const SECONDS = [0, 30, 60, 90, 120, 150, 180]
/** How likely each time is for a regular poster, in percent. They average two minutes. */
const BASE = [2, 4, 10, 18, 26, 22, 18]

/** A member with fewer published nikki than this gets better odds. */
const FEW_POSTS = 5
/** Days without a nikki before the odds start to improve, and when they are at their best. */
const IDLE_FROM_DAYS = 3
const IDLE_FULL_DAYS = 14

/**
 * How much the odds lean towards a short dance, from 0 (the default) to 1.
 * It grows for a member with few nikki, or whose last one was a while ago.
 */
export function luck(posts: number, lastPostAt: number | null, now = Date.now()): number {
  const fewPosts = 1 - posts / FEW_POSTS
  const idle =
    lastPostAt === null
      ? 0
      : ((now - lastPostAt) / DAY_MS - IDLE_FROM_DAYS) / (IDLE_FULL_DAYS - IDLE_FROM_DAYS)
  return Math.min(1, Math.max(0, fewPosts, idle))
}

/** The chance of each of `SECONDS`. At full luck, each shorter time is twice as likely again. */
export function chances(luck: number): number[] {
  const weights = BASE.map((weight, i) => weight * (1 + luck) ** (BASE.length - 1 - i))
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  return weights.map((weight) => weight / total)
}

/** Spins the roulette: the dance time in seconds. `random` is a number from 0 up to 1. */
export function spin(luck: number, random = Math.random()): number {
  let left = random
  for (const [i, chance] of chances(luck).entries()) {
    left -= chance
    if (left < 0) return SECONDS[i]!
  }
  return SECONDS[SECONDS.length - 1]!
}
