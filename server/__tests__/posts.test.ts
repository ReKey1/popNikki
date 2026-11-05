import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, it } from 'vitest'

import { LIMITS } from '../routes/posts'
import { addUser, db, logIn, request, resetDb } from './helpers'

const jpeg = (bytes = 10, type = 'image/jpeg') =>
  new File([new Uint8Array(bytes)], 'x.jpg', { type })

function upload(cookie: string, fields: Record<string, string | File>) {
  const form = new FormData()
  for (const [name, value] of Object.entries(fields)) form.append(name, value)
  return request('/api/posts', {
    method: 'POST',
    headers: { Cookie: cookie, Origin: 'http://localhost' },
    body: form,
  })
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
    const paths = ['/api/plants', `/api/users/${userId}/posts`, '/api/posts/1/photo']
    for (const path of paths) expect((await request(path)).status).toBe(401)
    const seen = await request(`/api/users/${userId}/seen`, {
      method: 'POST',
      headers: { Origin: 'http://localhost' },
    })
    expect(seen.status).toBe(401)
    expect((await upload('', { photo: jpeg(), thumb: jpeg() })).status).toBe(401)
  })

  it('stores both images in R2 and publishes the post', async () => {
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
    expect(post!.published_at).toBeGreaterThan(0)
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

  it('returns 404 for a photo of an unknown or unpublished post', async () => {
    const draft = await db
      .prepare(
        "INSERT INTO posts (user_id, photo_key, created_at) VALUES (?, 'photos/x.jpg', ?) RETURNING id",
      )
      .bind(userId, Date.now())
      .first<{ id: number }>()
    for (const id of [999, draft!.id]) {
      const res = await request(`/api/posts/${id}/photo`, { headers: { Cookie: cookie } })
      expect(res.status).toBe(404)
    }
  })

  it('lists every claimed plant with its newest published post', async () => {
    const bob = await addUser('bob')
    await addUser() // unclaimed tags are not plants yet
    await upload(cookie, { photo: jpeg(), thumb: jpeg() })
    const newest = await (
      await upload(cookie, { photo: jpeg(), thumb: jpeg() })
    ).json<{
      id: number
    }>()

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

    await upload(cookie, { photo: jpeg(), thumb: jpeg() })
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
    await upload(cookie, { photo: jpeg(), thumb: jpeg(), description: 'one' })
    await upload(cookie, { photo: jpeg(), thumb: jpeg(), description: 'two' })

    const res = await request(`/api/users/${userId}/posts`, { headers: { Cookie: cookie } })
    const body = await res.json<{ owner: unknown; posts: { description: string }[] }>()
    expect(body.owner).toEqual({ id: userId, username: 'nikki' })
    expect(body.posts.map((p) => p.description)).toEqual(['two', 'one'])

    const missing = await request('/api/users/999/posts', { headers: { Cookie: cookie } })
    expect(missing.status).toBe(404)
  })
})
