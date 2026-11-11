import { env } from 'cloudflare:workers'

import app from '../index'
import { hashToken, newToken } from '../lib/tokens'

export const db = env.DB

/** Sends a request to the app with the test bindings. */
export const request = (path: string, init?: RequestInit) => app.request(path, init, env)

export async function resetDb(): Promise<void> {
  await db.batch(
    ['rolls', 'reactions', 'plant_views', 'sessions', 'posts', 'tracks', 'users'].map((t) =>
      db.prepare(`DELETE FROM ${t}`),
    ),
  )
}

/** Adds a user with a fresh tag token and returns both. */
export async function addUser(
  username: string | null = null,
  { revoked = false } = {},
): Promise<{ id: number; token: string }> {
  const token = newToken()
  const row = await db
    .prepare(
      'INSERT INTO users (token_hash, username, created_at, revoked_at) VALUES (?, ?, ?, ?) RETURNING id',
    )
    .bind(await hashToken(token), username, Date.now(), revoked ? Date.now() : null)
    .first<{ id: number }>()
  return { id: row!.id, token }
}

/** Returns the `name=value` pair of a Set-Cookie header, for sending back as a Cookie header. */
export function cookieFrom(res: Response, name: string): string {
  const header = res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`))
  if (!header) throw new Error(`No ${name} cookie set`)
  return header.split(';')[0]!
}

/** Taps the tag of a claimed user and returns their session Cookie header. */
export async function logIn(token: string): Promise<string> {
  return cookieFrom(await request(`/tag?t=${token}`), 'session')
}
