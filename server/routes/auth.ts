import { Hono, type Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'

import { endSession, requireUser, startSession, type AppEnv } from '../lib/session'
import { hashToken } from '../lib/tokens'

const CLAIM_COOKIE = 'claim'
const CLAIM_PATH = '/api/claim'
const MAX_USERNAME = 20

const auth = new Hono<AppEnv>()

/**
 * Tidies a name so that two names that look the same are the same: compatibility forms are
 * folded (NFKC), invisible and control characters are dropped, and spaces are collapsed.
 */
function cleanUsername(raw: string): string {
  return raw.normalize('NFKC').replace(/\s/g, ' ').replace(/\p{C}/gu, '').replace(/ +/g, ' ').trim()
}

/** Reads a tidied username from a JSON body, or returns null if it is missing or the wrong length. */
async function parseUsername(c: Context<AppEnv>): Promise<string | null> {
  const body = await c.req.json<{ username?: unknown }>().catch(() => ({ username: undefined }))
  const username = typeof body.username === 'string' ? cleanUsername(body.username) : ''
  return username.length >= 1 && username.length <= MAX_USERNAME ? username : null
}

const isUniqueError = (err: unknown) => String(err).includes('UNIQUE')

// NFC entry point. Always redirects so the token leaves the address bar.
auth.get('/tag', async (c) => {
  const token = c.req.query('t')
  // One statement finds the tag and records the tap.
  const user = token
    ? await c.env.DB.prepare(
        `UPDATE users SET last_login_at = ? WHERE token_hash = ? AND revoked_at IS NULL
         RETURNING id, username`,
      )
        .bind(Date.now(), await hashToken(token))
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

  await startSession(c, user.id)
  return c.redirect('/')
})

auth.post(CLAIM_PATH, async (c) => {
  const token = getCookie(c, CLAIM_COOKIE)
  if (!token) return c.json({ error: 'Tap your tag again' }, 401)

  const username = await parseUsername(c)
  if (!username) return c.json({ error: `Use 1 to ${MAX_USERNAME} characters` }, 400)

  let user: { id: number } | null
  try {
    user = await c.env.DB.prepare(
      `UPDATE users SET username = ?1, claimed_at = ?2, last_login_at = ?2
       WHERE token_hash = ?3 AND username IS NULL AND revoked_at IS NULL RETURNING id`,
    )
      .bind(username, Date.now(), await hashToken(token))
      .first<{ id: number }>()
  } catch (err) {
    if (isUniqueError(err)) return c.json({ error: 'That name is taken' }, 409)
    throw err
  }
  if (!user) return c.json({ error: 'Tap your tag again' }, 401)

  deleteCookie(c, CLAIM_COOKIE, { path: CLAIM_PATH, secure: true })
  await startSession(c, user.id)
  return c.body(null, 204)
})

auth.get('/api/me', requireUser, (c) => c.json(c.var.user))

auth.patch('/api/me', requireUser, async (c) => {
  const username = await parseUsername(c)
  if (!username) return c.json({ error: `Use 1 to ${MAX_USERNAME} characters` }, 400)
  try {
    await c.env.DB.prepare('UPDATE users SET username = ? WHERE id = ?')
      .bind(username, c.var.user.id)
      .run()
  } catch (err) {
    if (isUniqueError(err)) return c.json({ error: 'That name is taken' }, 409)
    throw err
  }
  return c.json({ id: c.var.user.id, username })
})

auth.post('/api/logout', async (c) => {
  await endSession(c)
  return c.body(null, 204)
})

export default auth
