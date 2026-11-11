import { env } from 'cloudflare:workers'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_SECONDS, LIMITS } from '../routes/posts'
import { addUser, db, logIn, request, resetDb } from './helpers'

/** A file of the given size that starts with the JPEG signature. */
function jpeg(bytes = 10, type = 'image/jpeg') {
  const data = new Uint8Array(bytes)
  data.set([0xff, 0xd8, 0xff].slice(0, bytes))
  return new File([data], 'x.jpg', { type })
}

function upload(cookie: string, fields: Record<string, string | File>) {
  const form = new FormData()
  for (const [name, value] of Object.entries(fields)) form.append(name, value)
  return request('/api/posts', {
    method: 'POST',
    headers: { Cookie: cookie, Origin: 'http://localhost' },
    body: form,
  })
}

let clock = Date.now() - 60 * 60 * 1000

/** Uploads a post and publishes it directly in D1, a second after the previous one. */
async function uploadPublished(cookie: string, fields: Record<string, string | File> = {}) {
  const res = await upload(cookie, { photo: jpeg(), thumb: jpeg(), ...fields })
  const { id } = await res.json<{ id: number }>()
  clock += 1000
  await db.prepare('UPDATE posts SET published_at = ? WHERE id = ?').bind(clock, id).run()
  return { id }
}

describe('posts', () => {
  let cookie: string
  let userId: number

  beforeEach(async () => {
    await resetDb()
    const user = await addUser('nikki')
    userId = user.id
    cookie = await logIn(user.token)
  })

  it('needs a session for every route', async () => {
    const paths = [
      '/api/plants',
      `/api/users/${userId}/posts`,
      '/api/posts/1/photo',
      '/api/me/drafts',
    ]
    for (const path of paths) expect((await request(path)).status).toBe(401)
    for (const path of ['/api/posts/1/start', '/api/posts/1/publish']) {
      const res = await request(path, { method: 'POST', headers: { Origin: 'http://localhost' } })
      expect(res.status).toBe(401)
    }
    expect(
      (await request('/api/posts/1', { method: 'DELETE', headers: { Origin: 'http://localhost' } }))
        .status,
    ).toBe(401)
    const seen = await request(`/api/users/${userId}/seen`, {
      method: 'POST',
      headers: { Origin: 'http://localhost' },
    })
    expect(seen.status).toBe(401)
    expect((await upload('', { photo: jpeg(), thumb: jpeg() })).status).toBe(401)
  })

  it('stores both images in R2 and saves the post as a draft', async () => {
    const res = await upload(cookie, {
      photo: jpeg(100),
      thumb: jpeg(20),
      description: ' first leaf ',
    })
    expect(res.status).toBe(201)
    const { id } = await res.json<{ id: number }>()

    const post = await db
      .prepare('SELECT * FROM posts WHERE id = ?')
      .bind(id)
      .first<Record<string, unknown>>()
    expect(post).toMatchObject({ user_id: userId, description: 'first leaf' })
    expect(post!.published_at).toBeNull()
    expect((await env.FILES.head(post!.photo_key as string))?.size).toBe(100)
    expect((await env.FILES.head(post!.thumb_key as string))?.size).toBe(20)

    const photo = await request(`/api/posts/${id}/photo`, { headers: { Cookie: cookie } })
    expect(photo.status).toBe(200)
    expect(photo.headers.get('Content-Type')).toBe('image/jpeg')
    expect(photo.headers.get('Cache-Control')).toMatch(/^private/)
    expect((await photo.arrayBuffer()).byteLength).toBe(100)

    const thumb = await request(`/api/posts/${id}/thumb`, { headers: { Cookie: cookie } })
    expect((await thumb.arrayBuffer()).byteLength).toBe(20)
  })

  it('rejects missing, wrong-type and oversized images and long descriptions', async () => {
    const bad: Record<string, string | File>[] = [
      { photo: jpeg() },
      { photo: jpeg(10, 'image/png'), thumb: jpeg() },
      { photo: jpeg(), thumb: jpeg(LIMITS.thumb + 1) },
      { photo: jpeg(), thumb: jpeg(0) },
      // Called a JPEG, but the bytes aren't one.
      { photo: new File([new Uint8Array(10)], 'x.jpg', { type: 'image/jpeg' }), thumb: jpeg() },
      { photo: jpeg(), thumb: new File(['<svg/>'], 'x.jpg', { type: 'image/jpeg' }) },
      { photo: jpeg(), thumb: jpeg(), description: 'x'.repeat(LIMITS.description + 1) },
    ]
    for (const fields of bad) expect((await upload(cookie, fields)).status).toBe(400)
    expect((await db.prepare('SELECT COUNT(*) AS n FROM posts').first<{ n: number }>())!.n).toBe(0)
  })

  it('rejects an upload over the body limit', async () => {
    const res = await upload(cookie, {
      photo: jpeg(LIMITS.photo + LIMITS.thumb + 128 * 1024),
      thumb: jpeg(),
    })
    expect(res.status).toBe(413)
  })

  it('stops taking uploads once there are too many drafts', async () => {
    await uploadPublished(cookie) // published posts don't count
    await db.batch(
      Array.from({ length: LIMITS.drafts }, () =>
        db.prepare('INSERT INTO posts (user_id, created_at) VALUES (?, ?)').bind(userId, 1),
      ),
    )
    const res = await upload(cookie, { photo: jpeg(), thumb: jpeg() })
    expect(res.status).toBe(409)

    await db.prepare('DELETE FROM posts WHERE id = (SELECT MAX(id) FROM posts)').run()
    expect((await upload(cookie, { photo: jpeg(), thumb: jpeg() })).status).toBe(201)
  })

  it("returns 404 for a photo of an unknown post or someone else's draft", async () => {
    const res = await upload(cookie, { photo: jpeg(), thumb: jpeg() })
    const { id: draft } = await res.json<{ id: number }>()
    const bobCookie = await logIn((await addUser('bob')).token)
    for (const id of [999, draft]) {
      const photo = await request(`/api/posts/${id}/photo`, { headers: { Cookie: bobCookie } })
      expect(photo.status).toBe(404)
    }
  })

  it('lists every claimed plant with its newest published post', async () => {
    const bob = await addUser('bob')
    await addUser() // unclaimed tags are not plants yet
    await uploadPublished(cookie)
    const newest = await uploadPublished(cookie)
    await upload(cookie, { photo: jpeg(), thumb: jpeg() }) // drafts don't count

    const res = await request('/api/plants', { headers: { Cookie: cookie } })
    expect(await res.json()).toEqual([
      {
        id: userId,
        username: 'nikki',
        post_id: newest.id,
        published_at: expect.any(Number),
        post_count: 2,
        first_published_at: expect.any(Number),
        unseen: false, // never for your own plant
      },
      {
        id: bob.id,
        username: 'bob',
        post_id: null,
        published_at: null,
        post_count: 0,
        first_published_at: null,
        unseen: false,
      },
    ])
  })

  it('marks a plant unseen until the viewer opens it', async () => {
    const bob = await addUser('bob')
    const bobCookie = await logIn(bob.token)
    const unseen = async () => {
      const res = await request('/api/plants', { headers: { Cookie: bobCookie } })
      const plants = await res.json<{ id: number; unseen: boolean }[]>()
      return plants.find((p) => p.id === userId)!.unseen
    }
    const seen = (id: number) =>
      request(`/api/users/${id}/seen`, {
        method: 'POST',
        headers: { Cookie: bobCookie, Origin: 'http://localhost' },
      })

    await uploadPublished(cookie)
    expect(await unseen()).toBe(true)

    expect((await seen(userId)).status).toBe(204)
    expect(await unseen()).toBe(false)

    // Only a newer post brings the badge back.
    await db
      .prepare('UPDATE posts SET published_at = ? WHERE user_id = ?')
      .bind(Date.now() + 60_000, userId)
      .run()
    expect(await unseen()).toBe(true)

    expect((await seen(999)).status).toBe(404)
  })

  it("lists a user's posts, newest first", async () => {
    await uploadPublished(cookie, { description: 'one' })
    await uploadPublished(cookie, { description: 'two' })
    await upload(cookie, { photo: jpeg(), thumb: jpeg(), description: 'draft' })

    const res = await request(`/api/users/${userId}/posts`, { headers: { Cookie: cookie } })
    const body = await res.json<{ owner: unknown; posts: { description: string }[] }>()
    expect(body.owner).toEqual({ id: userId, username: 'nikki' })
    expect(body.posts.map((p) => p.description)).toEqual(['two', 'one'])

    const missing = await request('/api/users/999/posts', { headers: { Cookie: cookie } })
    expect(missing.status).toBe(404)
  })

  describe('dance flow', () => {
    const post = (path: string, as = cookie) =>
      request(path, { method: 'POST', headers: { Cookie: as, Origin: 'http://localhost' } })
    const draft = async () =>
      (await upload(cookie, { photo: jpeg(), thumb: jpeg() })).json<{ id: number }>()
    const row = (id: number) =>
      db
        .prepare(
          'SELECT track_id, music_started_at, dance_seconds, published_at FROM posts WHERE id = ?',
        )
        .bind(id)
        .first<{
          track_id: number | null
          music_started_at: number | null
          dance_seconds: number | null
          published_at: number | null
        }>()
    const addTrack = async (title: string) => {
      const track = await db
        .prepare('INSERT INTO tracks (title, r2_key) VALUES (?, ?) RETURNING id')
        .bind(title, `tracks/${title}.mp3`)
        .first<{ id: number }>()
      return track!.id
    }
    /** Gives the member a roll, as if the roulette had landed on it. */
    const setRoll = (seconds: number, trackId: number) =>
      db
        .prepare('INSERT INTO rolls (user_id, seconds, track_id, created_at) VALUES (?, ?, ?, ?)')
        .bind(userId, seconds, trackId, Date.now())
        .run()
    const rolls = async () =>
      (await db.prepare('SELECT COUNT(*) AS n FROM rolls').first<{ n: number }>())!.n
    /** Moves the start of a draft's music back, as if it had played for `seconds`. */
    const danceFor = (id: number, seconds: number) =>
      db
        .prepare('UPDATE posts SET music_started_at = ? WHERE id = ?')
        .bind(Date.now() - seconds * 1000, id)
        .run()

    afterEach(() => vi.restoreAllMocks())

    it('lists only your own drafts, newest first', async () => {
      await draft()
      const { id } = await draft()
      await uploadPublished(cookie)
      await upload(await logIn((await addUser('bob')).token), { photo: jpeg(), thumb: jpeg() })

      const res = await request('/api/me/drafts', { headers: { Cookie: cookie } })
      const drafts = await res.json<{ id: number }[]>()
      expect(drafts).toHaveLength(2)
      expect(drafts[0]).toEqual({ id, description: '', created_at: expect.any(Number) })
    })

    it('shows a draft photo to its owner', async () => {
      const { id } = await draft()
      const res = await request(`/api/posts/${id}/thumb`, { headers: { Cookie: cookie } })
      expect(res.status).toBe(200)
    })

    it('deletes your own draft and its files', async () => {
      const { id } = await draft()
      const keys = await db
        .prepare('SELECT photo_key, thumb_key FROM posts WHERE id = ?')
        .bind(id)
        .first<{ photo_key: string; thumb_key: string }>()

      const res = await request(`/api/posts/${id}`, {
        method: 'DELETE',
        headers: { Cookie: cookie, Origin: 'http://localhost' },
      })
      expect(res.status).toBe(204)
      expect(await row(id)).toBeNull()
      expect(await env.FILES.head(keys!.photo_key)).toBeNull()
      expect(await env.FILES.head(keys!.thumb_key)).toBeNull()
    })

    it("won't delete a published post or someone else's draft", async () => {
      const published = await uploadPublished(cookie)
      const { id: mine } = await draft()
      const bobCookie = await logIn((await addUser('bob')).token)
      const attempts: [number, string][] = [
        [published.id, cookie],
        [mine, bobCookie],
      ]
      for (const [id, as] of attempts) {
        const res = await request(`/api/posts/${id}`, {
          method: 'DELETE',
          headers: { Cookie: as, Origin: 'http://localhost' },
        })
        expect(res.status).toBe(404)
      }
      expect(await row(mine)).not.toBeNull()
    })

    it('publishes at once when there are no tracks', async () => {
      const { id } = await draft()
      const res = await post(`/api/posts/${id}/start`)
      expect(await res.json()).toEqual({ published: true })
      expect((await row(id))!.published_at).toBeGreaterThan(0)
    })

    it('starts the clock for the rolled time and song', async () => {
      await addTrack('other')
      const trackId = await addTrack('beat')
      await setRoll(90, trackId)
      const { id } = await draft()
      const res = await post(`/api/posts/${id}/start`)
      expect(await res.json()).toEqual({ seconds: 90, track: { id: trackId, title: 'beat' } })
      expect(await row(id)).toMatchObject({
        track_id: trackId,
        dance_seconds: 90,
        published_at: null,
      })
      expect((await row(id))!.music_started_at).toBeGreaterThan(0)
    })

    it('spins the roulette at the start if the page never did', async () => {
      const trackId = await addTrack('beat')
      // Halfway through the odds of a member with no nikki yet: one minute.
      vi.spyOn(Math, 'random').mockReturnValue(0.5)
      const { id } = await draft()
      const res = await post(`/api/posts/${id}/start`)
      expect(await res.json()).toEqual({ seconds: 60, track: { id: trackId, title: 'beat' } })
      expect(await rolls()).toBe(1)
    })

    it('publishes at once on a roll of zero seconds, which uses the roll up', async () => {
      await setRoll(0, await addTrack('beat'))
      const { id } = await draft()
      const res = await post(`/api/posts/${id}/start`)
      expect(await res.json()).toEqual({ published: true })
      expect((await row(id))!.published_at).toBeGreaterThan(0)
      expect(await rolls()).toBe(0)
    })

    it('refuses to publish before the rolled time is over', async () => {
      await setRoll(150, await addTrack('beat'))
      const { id } = await draft()
      expect((await post(`/api/posts/${id}/publish`)).status).toBe(409)

      await post(`/api/posts/${id}/start`)
      const early = await post(`/api/posts/${id}/publish`)
      expect(early.status).toBe(409)
      const body = await early.json<{ retry_after: number }>()
      expect(body.retry_after).toBeGreaterThan(140)
      expect(body.retry_after).toBeLessThanOrEqual(150)

      await danceFor(id, 149)
      expect((await post(`/api/posts/${id}/publish`)).status).toBe(409)
      expect((await row(id))!.published_at).toBeNull()
    })

    it('publishes once the rolled time has passed, which uses the roll up', async () => {
      await setRoll(30, await addTrack('beat'))
      const { id } = await draft()
      await post(`/api/posts/${id}/start`)
      await danceFor(id, 30)

      expect((await post(`/api/posts/${id}/publish`)).status).toBe(204)
      expect((await row(id))!.published_at).toBeGreaterThan(0)
      expect(await rolls()).toBe(0)
      // No longer a draft.
      expect((await post(`/api/posts/${id}/publish`)).status).toBe(404)
    })

    it('keeps the roll when a draft is quit or deleted, so it cannot be rolled again', async () => {
      await setRoll(180, await addTrack('beat'))
      const first = await draft()
      await post(`/api/posts/${first.id}/start`)
      await request(`/api/posts/${first.id}`, {
        method: 'DELETE',
        headers: { Cookie: cookie, Origin: 'http://localhost' },
      })

      const second = await draft()
      const res = await post(`/api/posts/${second.id}/start`)
      expect((await res.json<{ seconds: number }>()).seconds).toBe(180)
      // Starting over only resets the clock.
      await post(`/api/posts/${second.id}/start`)
      expect((await row(second.id))!.dance_seconds).toBe(180)
      expect(await rolls()).toBe(1)
    })

    it('asks for two minutes from a draft started before the roulette', async () => {
      await addTrack('beat')
      const { id } = await draft()
      await danceFor(id, DEFAULT_SECONDS - 1)
      expect((await post(`/api/posts/${id}/publish`)).status).toBe(409)
      await danceFor(id, DEFAULT_SECONDS)
      expect((await post(`/api/posts/${id}/publish`)).status).toBe(204)
    })

    it("can't start or publish someone else's draft", async () => {
      await addTrack('beat')
      const { id } = await draft()
      const bobCookie = await logIn((await addUser('bob')).token)
      expect((await post(`/api/posts/${id}/start`, bobCookie)).status).toBe(404)
      expect((await post(`/api/posts/${id}/publish`, bobCookie)).status).toBe(404)
    })
  })
})
