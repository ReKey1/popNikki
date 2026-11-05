import { Hono } from 'hono'

import { requireUser, type AppEnv } from '../lib/session'

/** The emoji a member can react with. Keep in sync with `src/lib/reactions.ts`. */
export const REACTIONS = ['🔥', '💧', '🌱', '🕺', '😮', '❤️']

const reactions = new Hono<AppEnv>()

// Sets or replaces the member's one reaction on a published post.
reactions.put('/api/posts/:id{[0-9]+}/reaction', requireUser, async (c) => {
  const body = await c.req.json<{ emoji?: unknown }>().catch(() => ({ emoji: undefined }))
  if (typeof body.emoji !== 'string' || !REACTIONS.includes(body.emoji)) {
    return c.json({ error: 'Pick one of the reaction emoji' }, 400)
  }

  const { meta } = await c.env.DB.prepare(
    `INSERT INTO reactions (post_id, user_id, emoji, created_at)
     SELECT id, ?2, ?3, ?4 FROM posts WHERE id = ?1 AND published_at IS NOT NULL
     ON CONFLICT (post_id, user_id) DO UPDATE
       SET emoji = excluded.emoji, created_at = excluded.created_at`,
  )
    .bind(Number(c.req.param('id')), c.var.user.id, body.emoji, Date.now())
    .run()
  if (meta.changes === 0) return c.notFound()
  return c.body(null, 204)
})

// Who reacted to a published post, oldest first.
reactions.get('/api/posts/:id{[0-9]+}/reactions', requireUser, async (c) => {
  const id = Number(c.req.param('id'))
  const [post, list] = await c.env.DB.batch([
    c.env.DB.prepare('SELECT 1 FROM posts WHERE id = ? AND published_at IS NOT NULL').bind(id),
    c.env.DB.prepare(
      `SELECT r.emoji, u.username FROM reactions r JOIN users u ON u.id = r.user_id
       WHERE r.post_id = ? AND u.username IS NOT NULL AND u.revoked_at IS NULL
       ORDER BY r.created_at, u.username`,
    ).bind(id),
  ])
  if (!post!.results.length) return c.notFound()
  return c.json(list!.results)
})

reactions.delete('/api/posts/:id{[0-9]+}/reaction', requireUser, async (c) => {
  await c.env.DB.prepare('DELETE FROM reactions WHERE post_id = ? AND user_id = ?')
    .bind(Number(c.req.param('id')), c.var.user.id)
    .run()
  return c.body(null, 204)
})

export default reactions
