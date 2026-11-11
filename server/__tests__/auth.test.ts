import { beforeEach, describe, expect, it } from 'vitest'

import { hashToken } from '../lib/tokens'
import { addUser, cookieFrom, db, logIn, request, resetDb } from './helpers'

const claim = (cookie: string, username: unknown) =>
  request('/api/claim', {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  })

const me = (cookie?: string) =>
  request('/api/me', cookie ? { headers: { Cookie: cookie } } : undefined)

describe('auth', () => {
  beforeEach(resetDb)

  describe('GET /tag', () => {
    it('returns the same 404 for a missing, unknown or revoked token', async () => {
      const revoked = await addUser('gone', { revoked: true })
      const responses = await Promise.all(
        ['/tag', '/tag?t=nope', `/tag?t=${revoked.token}`].map((path) => request(path)),
      )
      const bodies = await Promise.all(responses.map((r) => r.text()))
      expect(responses.map((r) => r.status)).toEqual([404, 404, 404])
      expect(new Set(bodies).size).toBe(1)
    })

    it('sends an unclaimed tag to the username form with a short-lived claim cookie', async () => {
      const { token } = await addUser()
      const res = await request(`/tag?t=${token}`)

      expect(res.status).toBe(302)
      expect(res.headers.get('Location')).toBe('/claim')
      const cookie = res.headers.getSetCookie().find((c) => c.startsWith('claim='))
      expect(cookie).toMatch(/Max-Age=600/)
      expect(cookie).toMatch(/Path=\/api\/claim/)
      expect(cookie).toMatch(/HttpOnly/)
      expect(cookie).toMatch(/Secure/)
      expect(res.headers.getSetCookie().some((c) => c.startsWith('session='))).toBe(false)
    })

    it('logs a claimed tag straight in and stores only the session hash', async () => {
      const { id, token } = await addUser('nikki')
      const res = await request(`/tag?t=${token}`)

      expect(res.status).toBe(302)
      expect(res.headers.get('Location')).toBe('/')
      const header = res.headers.getSetCookie().find((c) => c.startsWith('session='))!
      expect(header).toMatch(/HttpOnly/)
      expect(header).toMatch(/Secure/)
      expect(header).toMatch(/SameSite=Lax/)
      expect(header).toMatch(/Path=\//)

      const session = cookieFrom(res, 'session').slice('session='.length)
      const row = await db
        .prepare('SELECT token_hash, user_id FROM sessions')
        .first<{ token_hash: string; user_id: number }>()
      expect(row).toEqual({ token_hash: await hashToken(session), user_id: id })

      const user = await db
        .prepare('SELECT last_login_at FROM users WHERE id = ?')
        .bind(id)
        .first<{ last_login_at: number | null }>()
      expect(user!.last_login_at).toBeGreaterThan(0)
    })

    it('replaces the session this device had, and clears away expired ones', async () => {
      const { id, token } = await addUser('nikki')
      const first = await logIn(token)
      const otherDevice = await logIn(token)
      await db
        .prepare(
          "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES ('old', ?, 1, 2)",
        )
        .bind(id)
        .run()

      const res = await request(`/tag?t=${token}`, { headers: { Cookie: first } })
      const second = cookieFrom(res, 'session')

      expect(second).not.toBe(first)
      expect((await me(first)).status).toBe(401)
      expect((await me(second)).status).toBe(200)
      expect((await me(otherDevice)).status).toBe(200)
      const { results } = await db.prepare('SELECT token_hash FROM sessions').all()
      expect(results).toHaveLength(2)
    })

    it('is never stored by the browser', async () => {
      const { token } = await addUser('nikki')
      expect((await request(`/tag?t=${token}`)).headers.get('Cache-Control')).toBe('no-store')
    })
  })

  describe('POST /api/claim', () => {
    async function claimCookie() {
      const { token } = await addUser()
      return cookieFrom(await request(`/tag?t=${token}`), 'claim')
    }

    it('sets the username, logs in and clears the claim cookie', async () => {
      const res = await claim(await claimCookie(), '  nikki  ')

      expect(res.status).toBe(204)
      expect(res.headers.getSetCookie().find((c) => c.startsWith('claim='))).toMatch(/Max-Age=0/)
      const meRes = await me(cookieFrom(res, 'session'))
      expect(await meRes.json()).toMatchObject({ username: 'nikki' })
    })

    it('rejects a name that is taken, ignoring case', async () => {
      await addUser('Nikki')
      const res = await claim(await claimCookie(), 'nikki')
      expect(res.status).toBe(409)
    })

    it('rejects an empty or too long name', async () => {
      const cookie = await claimCookie()
      expect((await claim(cookie, '   ')).status).toBe(400)
      expect((await claim(cookie, 'x'.repeat(21))).status).toBe(400)
      expect((await claim(cookie, 42)).status).toBe(400)
      // Nothing is left of a name made of invisible characters.
      expect((await claim(cookie, '\u200b\u202e\u0000')).status).toBe(400)
    })

    it('tidies a name so that look-alikes are the same name', async () => {
      await addUser('nikki')
      // Zero-width and full-width characters would otherwise pass for another member's name.
      expect((await claim(await claimCookie(), 'nik\u200bki')).status).toBe(409)
      expect((await claim(await claimCookie(), '\uff4e\uff49\uff4b\uff4b\uff49')).status).toBe(409)

      const res = await claim(await claimCookie(), ' pop\n\u202enikki  2 ')
      expect(res.status).toBe(204)
      expect(await (await me(cookieFrom(res, 'session'))).json()).toMatchObject({
        username: 'pop nikki 2',
      })
    })

    it('needs a claim cookie', async () => {
      expect((await claim('', 'nikki')).status).toBe(401)
    })

    it('cannot rename a tag that is already claimed', async () => {
      const cookie = await claimCookie()
      expect((await claim(cookie, 'first')).status).toBe(204)
      expect((await claim(cookie, 'second')).status).toBe(401)
    })
  })

  describe('sessions', () => {
    it('returns 401 without a session', async () => {
      expect((await me()).status).toBe(401)
      expect((await me('session=made-up')).status).toBe(401)
    })

    it('returns the logged-in user', async () => {
      const { id, token } = await addUser('nikki')
      const res = await me(await logIn(token))
      expect(await res.json()).toEqual({ id, username: 'nikki' })
    })

    it('rejects an expired session', async () => {
      const { token } = await addUser('nikki')
      const cookie = await logIn(token)
      await db
        .prepare('UPDATE sessions SET expires_at = ?')
        .bind(Date.now() - 1)
        .run()
      expect((await me(cookie)).status).toBe(401)
    })

    it('rejects the session of a revoked user', async () => {
      const { id, token } = await addUser('nikki')
      const cookie = await logIn(token)
      await db.prepare('UPDATE users SET revoked_at = ? WHERE id = ?').bind(Date.now(), id).run()
      expect((await me(cookie)).status).toBe(401)
    })

    it('logs out by deleting the session', async () => {
      const { token } = await addUser('nikki')
      const cookie = await logIn(token)

      const res = await request('/api/logout', {
        method: 'POST',
        headers: { Cookie: cookie, Origin: 'http://localhost' },
      })

      expect(res.status).toBe(204)
      expect(res.headers.getSetCookie().find((c) => c.startsWith('session='))).toMatch(/Max-Age=0/)
      expect((await me(cookie)).status).toBe(401)
      // The photos and data this device kept go with the session.
      expect(res.headers.get('Clear-Site-Data')).toBe('"cache", "storage"')
    })
  })
  describe('PATCH /api/me', () => {
    const rename = (cookie: string, username: unknown) =>
      request('/api/me', {
        method: 'PATCH',
        headers: { Cookie: cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })

    it('changes the username', async () => {
      const { id, token } = await addUser('nikki')
      const cookie = await logIn(token)
      const res = await rename(cookie, '  bloom  ')
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ id, username: 'bloom' })
      expect(await (await me(cookie)).json()).toEqual({ id, username: 'bloom' })
    })

    it('allows a case-only change of your own name', async () => {
      const { token } = await addUser('nikki')
      expect((await rename(await logIn(token), 'Nikki')).status).toBe(200)
    })

    it("rejects someone else's name, ignoring case", async () => {
      await addUser('Bob')
      const { token } = await addUser('nikki')
      const res = await rename(await logIn(token), 'bob')
      expect(res.status).toBe(409)
      expect(await res.json()).toEqual({ error: 'That name is taken' })
    })

    it('rejects an empty or too long name', async () => {
      const { token } = await addUser('nikki')
      const cookie = await logIn(token)
      for (const name of ['  ', 'x'.repeat(21), 42]) {
        expect((await rename(cookie, name)).status).toBe(400)
      }
    })

    it('needs a session', async () => {
      expect((await rename('', 'bloom')).status).toBe(401)
    })
  })
})
