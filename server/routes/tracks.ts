import { Hono } from 'hono'

import { requireUser, type AppEnv } from '../lib/session'

/** How many of the dancer's latest tracks to avoid when picking the next one. */
const RECENT_TRACKS = 3

/** A random track, avoiding the dancer's latest few where possible. Null when there are none. */
export function pickTrack(db: D1Database, userId: number) {
  return db
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
    .first<{ id: number; title: string }>()
}

const tracks = new Hono<AppEnv>()

// Picks the song for the next practice, so the page can load it before the dancer taps start.
// The clock only starts with POST /api/posts/:id/start.
tracks.get('/api/tracks/next', requireUser, async (c) => {
  return c.json({ track: await pickTrack(c.env.DB, c.var.user.id) })
})

/** The `bytes start-end/size` value of a Content-Range header for an R2 range. */
function contentRange(range: R2Range, size: number): string {
  if ('suffix' in range && range.suffix !== undefined) {
    return `bytes ${Math.max(0, size - range.suffix)}-${size - 1}/${size}`
  }
  const offset = 'offset' in range && range.offset !== undefined ? range.offset : 0
  const length = 'length' in range && range.length !== undefined ? range.length : size - offset
  return `bytes ${offset}-${Math.min(size, offset + length) - 1}/${size}`
}

// Audio goes through the Worker so R2 stays private. Safari needs Range requests for media,
// so this follows Cloudflare's R2 pattern of passing the request headers as the range.
tracks.get('/api/tracks/:id{[0-9]+}/audio', requireUser, async (c) => {
  const track = await c.env.DB.prepare('SELECT r2_key FROM tracks WHERE id = ?')
    .bind(Number(c.req.param('id')))
    .first<{ r2_key: string }>()
  if (!track) return c.notFound()

  const ranged = c.req.header('Range') !== undefined
  let object: R2ObjectBody | null
  try {
    object = await c.env.FILES.get(track.r2_key, { range: c.req.raw.headers })
  } catch {
    return c.body(null, 416)
  }
  if (!object) return c.notFound()

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('ETag', object.httpEtag)
  headers.set('Accept-Ranges', 'bytes')
  headers.set('Cache-Control', 'private, max-age=86400')
  if (ranged && object.range) headers.set('Content-Range', contentRange(object.range, object.size))
  return new Response(object.body, { status: ranged && object.range ? 206 : 200, headers })
})

export default tracks
