import { Hono } from 'hono'

import { luck, spin } from '../lib/roulette'
import { requireUser, type AppEnv } from '../lib/session'

/** How many of the dancer's latest tracks to avoid when picking the next one. */
const RECENT_TRACKS = 3

export type Track = { id: number; title: string }
/** What the roulette landed on: how long to dance, and to which song. */
export type Roll = { seconds: number; track: Track }

type RollRow = { seconds: number; id: number; title: string }
type StatsRow = { posts: number; last_post_at: number | null }

const rollQuery = (db: D1Database, userId: number) =>
  db
    .prepare(
      `SELECT r.seconds, t.id, t.title FROM rolls r JOIN tracks t ON t.id = r.track_id
       WHERE r.user_id = ?`,
    )
    .bind(userId)

/** How many nikki the member has published, and when the last one was. */
const statsQuery = (db: D1Database, userId: number) =>
  db
    .prepare(
      `SELECT COUNT(*) AS posts, MAX(published_at) AS last_post_at FROM posts
       WHERE user_id = ? AND published_at IS NOT NULL`,
    )
    .bind(userId)

/** A random track, avoiding the dancer's latest few where possible. */
const trackQuery = (db: D1Database, userId: number) =>
  db
    .prepare(
      `SELECT id, title FROM tracks
       ORDER BY id IN (
         SELECT track_id FROM posts
         WHERE user_id = ? AND track_id IS NOT NULL AND music_started_at IS NOT NULL
         ORDER BY music_started_at DESC LIMIT ?
       ), RANDOM()
       LIMIT 1`,
    )
    .bind(userId, RECENT_TRACKS)

const toRoll = (row: RollRow | undefined): Roll | null =>
  row ? { seconds: row.seconds, track: { id: row.id, title: row.title } } : null

/**
 * The member's roll for their next nikki, spinning the roulette only if they have none.
 * Null when the playlist is empty: there is nothing to dance to.
 */
export async function takeRoll(db: D1Database, userId: number): Promise<Roll | null> {
  const [rolled, stats, picked] = (await db.batch([
    rollQuery(db, userId),
    statsQuery(db, userId),
    trackQuery(db, userId),
  ])) as [D1Result<RollRow>, D1Result<StatsRow>, D1Result<Track>]
  const track = picked.results[0]
  if (rolled.results[0] || !track) return toRoll(rolled.results[0])

  // If two spins race, the first one stands and both get it.
  const { posts, last_post_at } = stats.results[0]!
  const [, saved] = (await db.batch([
    db
      .prepare(
        `INSERT INTO rolls (user_id, seconds, track_id, created_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (user_id) DO NOTHING`,
      )
      .bind(userId, spin(luck(posts, last_post_at)), track.id, Date.now()),
    rollQuery(db, userId),
  ])) as [D1Result, D1Result<RollRow>]
  return toRoll(saved.results[0])
}

const roll = new Hono<AppEnv>()

// Spins the roulette. The page spins every time it opens, and until a nikki is published every
// spin gets the same roll. The odds are never sent: a member isn't told when theirs are better
// than the default.
roll.post('/api/roll', requireUser, async (c) => {
  return c.json({ roll: await takeRoll(c.env.DB, c.var.user.id) })
})

export default roll
