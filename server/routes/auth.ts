import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'

import { endSession, requireUser, startSession, type AppEnv } from '../lib/session'
import { hashToken } from '../lib/tokens'

const CLAIM_COOKIE = 'claim'
const CLAIM_PATH = '/api/claim'
const MAX_USERNAME = 20

const auth = new Hono<AppEnv>()

// NFC entry point. Always redirects so the token leaves the address bar.
auth.get('/tag', async (c) => {
  const token = c.req.query('t')
  const user = token
    ? await c.env.DB.prepare(
        'SELECT id, username FROM users WHERE token_hash = ? AND revoked_at IS NULL',
      )
        .bind(await hashToken(token))
        .first<{ id: number; username: string | null }>()
    : null
  if (!token || !user) return c.notFound()

  if (user.username === null) {
    setCookie(c, CLAIM_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      path: CLAIM_PATH,
      maxAge: 10 * 60,
    })
    return c.redirect('/claim')
  }

  await c.env.DB.prepare('UPDATE users SET last_login_at = ? WHERE id = ?')
    .bind(Date.now(), user.id)
    .run()
  await startSession(c, user.id)
  return c.redirect('/')
})

auth.post(CLAIM_PATH, async (c) => {
  const token = getCookie(c, CLAIM_COOKIE)
  if (!token) return c.json({ error: 'Tap your tag again' }, 401)

  const body = await c.req.json<{ username?: unknown }>().catch(() => ({ username: undefined }))
  const username = typeof body.username === 'string' ? body.username.trim() : ''
  if (username.length < 1 || username.length > MAX_USERNAME) {
    return c.json({ error: `Use 1 to ${MAX_USERNAME} characters` }, 400)
  }

  let user: { id: number } | null
  try {
    user = await c.env.DB.prepare(
      `UPDATE users SET username = ?1, claimed_at = ?2, last_login_at = ?2
       WHERE token_hash = ?3 AND username IS NULL AND revoked_at IS NULL RETURNING id`,
    )
      .bind(username, Date.now(), await hashToken(token))
      .first<{ id: number }>()
  } catch (err) {
    if (String(err).includes('UNIQUE')) return c.json({ error: 'That name is taken' }, 409)
    throw err
  }
  if (!user) return c.json({ error: 'Tap your tag again' }, 401)

  deleteCookie(c, CLAIM_COOKIE, { path: CLAIM_PATH, secure: true })
  await startSession(c, user.id)
  return c.body(null, 204)
})

auth.get('/api/me', requireUser, (c) => c.json(c.var.user))

auth.post('/api/logout', async (c) => {
  await endSession(c)
  return c.body(null, 204)
})

export default auth
