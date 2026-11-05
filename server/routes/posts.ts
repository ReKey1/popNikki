import { Hono, type Context } from 'hono'
import { bodyLimit } from 'hono/body-limit'

import { requireUser, type AppEnv } from '../lib/session'

const MB = 1024 * 1024
export const LIMITS = { photo: 3 * MB, thumb: 512 * 1024, description: 1000 }
/** How long the dance lasts before a post can be published. */
export const DANCE_MS = 120_000
/** How many of the dancer's latest tracks to avoid when picking the next one. */
const RECENT_TRACKS = 3

const posts = new Hono<AppEnv>()

// One row per plant (claimed user): their newest published post, how many they have published
// since the first one, and whether that newest post is unseen by the viewer.
posts.get('/api/plants', requireUser, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT u.id, u.username, p.id AS post_id, p.published_at,
       (SELECT COUNT(*) FROM posts WHERE user_id = u.id AND published_at IS NOT NULL) AS post_count,
       (SELECT MIN(published_at) FROM posts WHERE user_id = u.id AND published_at IS NOT NULL)
         AS first_published_at,
       COALESCE(u.id != ?1 AND p.published_at > COALESCE(v.last_viewed_at, 0), 0) AS unseen
     FROM users u
     LEFT JOIN posts p ON p.id = (
       SELECT id FROM posts
       WHERE user_id = u.id AND published_at IS NOT NULL
       ORDER BY published_at DESC LIMIT 1)
     LEFT JOIN plant_views v ON v.viewer_id = ?1 AND v.owner_id = u.id
     WHERE u.username IS NOT NULL AND u.revoked_at IS NULL
     ORDER BY p.published_at IS NULL, p.published_at DESC, u.username`,
  )
    .bind(c.var.user.id)
    .all<{ unseen: number }>()
  return c.json(results.map((plant) => ({ ...plant, unseen: plant.unseen === 1 })))
})

// Opening a plant clears its update badge for the viewer.
posts.post('/api/users/:id{[0-9]+}/seen', requireUser, async (c) => {
  const { meta } = await c.env.DB.prepare(
    `INSERT INTO plant_views (viewer_id, owner_id, last_viewed_at)
     SELECT ?1, id, ?3 FROM users
     WHERE id = ?2 AND username IS NOT NULL AND revoked_at IS NULL
     ON CONFLICT (viewer_id, owner_id) DO UPDATE SET last_viewed_at = excluded.last_viewed_at`,
  )
    .bind(c.var.user.id, Number(c.req.param('id')), Date.now())
    .run()
  if (meta.changes === 0) return c.notFound()
  return c.body(null, 204)
})

posts.get('/api/users/:id{[0-9]+}/posts', requireUser, async (c) => {
  const owner = await c.env.DB.prepare(
    'SELECT id, username FROM users WHERE id = ? AND username IS NOT NULL AND revoked_at IS NULL',
  )
    .bind(Number(c.req.param('id')))
    .first<{ id: number; username: string }>()
  if (!owner) return c.notFound()

  const [list, counts] = await c.env.DB.batch([
    c.env.DB.prepare(
      `SELECT id, description, published_at FROM posts
       WHERE user_id = ? AND published_at IS NOT NULL
       ORDER BY published_at DESC`,
    ).bind(owner.id),
    c.env.DB.prepare(
      `SELECT r.post_id, r.emoji, COUNT(*) AS n, MAX(r.user_id = ?2) AS mine
       FROM reactions r JOIN posts p ON p.id = r.post_id
       WHERE p.user_id = ?1 AND p.published_at IS NOT NULL
       GROUP BY r.post_id, r.emoji`,
    ).bind(owner.id, c.var.user.id),
  ])

  const byPost = new Map<
    number,
    { reactions: Record<string, number>; my_reaction: string | null }
  >()
  for (const row of counts!.results as {
    post_id: number
    emoji: string
    n: number
    mine: number
  }[]) {
    const entry = byPost.get(row.post_id) ?? { reactions: {}, my_reaction: null }
    entry.reactions[row.emoji] = row.n
    if (row.mine) entry.my_reaction = row.emoji
    byPost.set(row.post_id, entry)
  }
  const result = (list!.results as { id: number }[]).map((post) => ({
    ...post,
    ...(byPost.get(post.id) ?? { reactions: {}, my_reaction: null }),
  }))
  return c.json({ owner, posts: result })
})

function isJpeg(value: unknown, maxSize: number): value is File {
  return (
    value instanceof File && value.type === 'image/jpeg' && value.size > 0 && value.size <= maxSize
  )
}

posts.post(
  '/api/posts',
  requireUser,
  bodyLimit({
    maxSize: LIMITS.photo + LIMITS.thumb + 64 * 1024,
    onError: (c) => c.json({ error: 'Upload is too large' }, 413),
  }),
  async (c) => {
    const body = await c.req.parseBody()
    const { photo, thumb } = body
    const description = typeof body.description === 'string' ? body.description.trim() : ''
    if (!isJpeg(photo, LIMITS.photo) || !isJpeg(thumb, LIMITS.thumb)) {
      return c.json({ error: 'Send a JPEG photo and thumbnail' }, 400)
    }
    if (description.length > LIMITS.description) {
      return c.json({ error: `Keep the description under ${LIMITS.description} characters` }, 400)
    }

    const id = crypto.randomUUID()
    const photoKey = `photos/${id}.jpg`
    const thumbKey = `thumbs/${id}.jpg`
    const httpMetadata = { contentType: 'image/jpeg' }
    await Promise.all([
      c.env.FILES.put(photoKey, photo.stream(), { httpMetadata }),
      c.env.FILES.put(thumbKey, thumb.stream(), { httpMetadata }),
    ])

    // A draft until the dance is done (see /start and /publish).
    const post = await c.env.DB.prepare(
      `INSERT INTO posts (user_id, description, photo_key, thumb_key, created_at)
       VALUES (?, ?, ?, ?, ?) RETURNING id`,
    )
      .bind(c.var.user.id, description, photoKey, thumbKey, Date.now())
      .first<{ id: number }>()
    return c.json(post, 201)
  },
)

posts.get('/api/me/drafts', requireUser, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, description, created_at FROM posts
     WHERE user_id = ? AND published_at IS NULL
     ORDER BY created_at DESC`,
  )
    .bind(c.var.user.id)
    .all()
  return c.json(results)
})

/** The viewer's own draft with the given id, or null. */
function ownDraft(c: Context<AppEnv>) {
  return c.env.DB.prepare(
    `SELECT id, photo_key, thumb_key, music_started_at FROM posts
     WHERE id = ? AND user_id = ? AND published_at IS NULL`,
  )
    .bind(Number(c.req.param('id')), c.var.user.id)
    .first<{
      id: number
      photo_key: string | null
      thumb_key: string | null
      music_started_at: number | null
    }>()
}

posts.delete('/api/posts/:id{[0-9]+}', requireUser, async (c) => {
  const draft = await ownDraft(c)
  if (!draft) return c.notFound()
  const keys = [draft.photo_key, draft.thumb_key].filter((k): k is string => k !== null)
  if (keys.length) await c.env.FILES.delete(keys)
  await c.env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(draft.id).run()
  return c.body(null, 204)
})

// Starts the music: picks a track the dancer hasn't had lately and starts the server-side clock.
// With no tracks on the playlist there is nothing to dance to, so the post is published at once.
posts.post('/api/posts/:id{[0-9]+}/start', requireUser, async (c) => {
  const draft = await ownDraft(c)
  if (!draft) return c.notFound()

  const track = await c.env.DB.prepare(
    `SELECT id, title FROM tracks
     ORDER BY id IN (
       SELECT track_id FROM posts
       WHERE user_id = ? AND track_id IS NOT NULL AND music_started_at IS NOT NULL
       ORDER BY music_started_at DESC LIMIT ?
     ), RANDOM()
     LIMIT 1`,
  )
    .bind(c.var.user.id, RECENT_TRACKS)
    .first<{ id: number; title: string }>()

  const now = Date.now()
  if (!track) {
    await c.env.DB.prepare('UPDATE posts SET published_at = ? WHERE id = ?')
      .bind(now, draft.id)
      .run()
    return c.json({ published: true })
  }
  await c.env.DB.prepare('UPDATE posts SET track_id = ?, music_started_at = ? WHERE id = ?')
    .bind(track.id, now, draft.id)
    .run()
  return c.json({ track })
})

// Publishes only once the full dance time has passed on the server's clock.
posts.post('/api/posts/:id{[0-9]+}/publish', requireUser, async (c) => {
  const draft = await ownDraft(c)
  if (!draft) return c.notFound()
  if (!draft.photo_key || draft.music_started_at === null) {
    return c.json({ error: 'Start the music first' }, 409)
  }
  const now = Date.now()
  const left = draft.music_started_at + DANCE_MS - now
  if (left > 0) {
    return c.json({ error: 'Keep dancing', retry_after: Math.ceil(left / 1000) }, 409)
  }
  await c.env.DB.prepare('UPDATE posts SET published_at = ? WHERE id = ?').bind(now, draft.id).run()
  return c.body(null, 204)
})

// Photos are looked up by post id, so a client can never ask for an arbitrary R2 key.
// A draft's photo is visible to its owner only.
posts.get('/api/posts/:id{[0-9]+}/:size{photo|thumb}', requireUser, async (c) => {
  const column = c.req.param('size') === 'photo' ? 'photo_key' : 'thumb_key'
  const row = await c.env.DB.prepare(
    `SELECT ${column} AS key FROM posts
     WHERE id = ? AND (published_at IS NOT NULL OR user_id = ?)`,
  )
    .bind(Number(c.req.param('id')), c.var.user.id)
    .first<{ key: string | null }>()
  const object = row?.key ? await c.env.FILES.get(row.key) : null
  if (!object) return c.notFound()

  return c.body(object.body, 200, {
    'Content-Type': 'image/jpeg',
    'Cache-Control': 'private, max-age=31536000, immutable',
    ETag: object.httpEtag,
  })
})

export default posts
