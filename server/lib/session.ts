import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'

import { hashToken, newToken } from './tokens'

export type User = { id: number; username: string }
export type AppEnv = { Bindings: Env; Variables: { user: User } }

export const SESSION_COOKIE = 'session'
const SESSION_SECONDS = 400 * 24 * 60 * 60 // the longest Max-Age browsers accept

/** Creates a session row (hash only) and sets the session cookie. */
export async function startSession(c: Context<AppEnv>, userId: number): Promise<void> {
  const token = newToken(32)
  const now = Date.now()
  await c.env.DB.prepare(
    'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
  )
    .bind(await hashToken(token), userId, now, now + SESSION_SECONDS * 1000)
    .run()
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_SECONDS,
  })
}

/** Deletes the current session row and cookie, if any. */
export async function endSession(c: Context<AppEnv>): Promise<void> {
  const token = getCookie(c, SESSION_COOKIE)
  if (token) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?')
      .bind(await hashToken(token))
      .run()
  }
  deleteCookie(c, SESSION_COOKIE, { path: '/', secure: true })
}

/** Rejects the request with 401 unless it carries a valid session of a non-revoked user. */
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE)
  const user = token
    ? await c.env.DB.prepare(
        `SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > ? AND u.revoked_at IS NULL
           AND u.username IS NOT NULL`,
      )
        .bind(await hashToken(token), Date.now())
        .first<User>()
    : null
  if (!user) return c.json({ error: 'Not logged in' }, 401)
  c.set('user', user)
  await next()
})
