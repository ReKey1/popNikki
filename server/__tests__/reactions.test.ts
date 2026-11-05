import { beforeEach, describe, expect, it } from 'vitest'

import { addUser, db, logIn, request, resetDb } from './helpers'

describe('reactions', () => {
  let ownerId: number
  let ownerCookie: string
  let cookie: string
  let postId: number

  const react = (id: number, emoji: unknown, as = cookie) =>
    request(`/api/posts/${id}/reaction`, {
      method: 'PUT',
      headers: { Cookie: as, Origin: 'http://localhost', 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji }),
    })
  const unreact = (id: number, as = cookie) =>
    request(`/api/posts/${id}/reaction`, {
      method: 'DELETE',
      headers: { Cookie: as, Origin: 'http://localhost' },
    })
  const listPosts = async (as = cookie) => {
    const res = await request(`/api/users/${ownerId}/posts`, { headers: { Cookie: as } })
    const body = await res.json<{
      posts: { id: number; reactions: Record<string, number>; my_reaction: string | null }[]
    }>()
    return body.posts
  }
  const rows = async () => (await db.prepare('SELECT emoji FROM reactions').all()).results

  beforeEach(async () => {
    await resetDb()
    const owner = await addUser('nikki')
    ownerId = owner.id
    ownerCookie = await logIn(owner.token)
    cookie = await logIn((await addUser('bob')).token)
    const now = Date.now()
    const post = await db
      .prepare(
        'INSERT INTO posts (user_id, created_at, published_at) VALUES (?, ?, ?) RETURNING id',
      )
      .bind(ownerId, now, now)
      .first<{ id: number }>()
    postId = post!.id
  })

  it('needs a session', async () => {
    expect((await react(postId, '🔥', '')).status).toBe(401)
    expect((await unreact(postId, '')).status).toBe(401)
  })

  it('sets, replaces and removes the one reaction of a member', async () => {
    expect((await react(postId, '🔥')).status).toBe(204)
    expect((await react(postId, '💧')).status).toBe(204)
    expect(await rows()).toEqual([{ emoji: '💧' }])

    expect((await unreact(postId)).status).toBe(204)
    expect(await rows()).toEqual([])
    expect((await unreact(postId)).status).toBe(204) // removing twice is fine
  })

  it('rejects an emoji outside the set', async () => {
    for (const emoji of ['👎', '', 1, null]) expect((await react(postId, emoji)).status).toBe(400)
    expect(await rows()).toEqual([])
  })

  it('returns 404 for a missing or unpublished post', async () => {
    const draft = await db
      .prepare('INSERT INTO posts (user_id, created_at) VALUES (?, ?) RETURNING id')
      .bind(ownerId, Date.now())
      .first<{ id: number }>()
    for (const id of [999, draft!.id]) expect((await react(id, '🔥')).status).toBe(404)
    expect(await rows()).toEqual([])
  })

  it("lists each post's counts per emoji and the viewer's own reaction", async () => {
    await react(postId, '🔥')
    await react(postId, '🔥', ownerCookie)
    expect(await listPosts()).toEqual([
      expect.objectContaining({ id: postId, reactions: { '🔥': 2 }, my_reaction: '🔥' }),
    ])

    await react(postId, '💧', ownerCookie)
    await unreact(postId)
    expect(await listPosts()).toEqual([
      expect.objectContaining({ reactions: { '💧': 1 }, my_reaction: null }),
    ])
  })

  describe('who reacted', () => {
    const reactors = (id: number, as = cookie) =>
      request(`/api/posts/${id}/reactions`, { headers: { Cookie: as } })
    const addReaction = (userId: number, emoji: string, at: number) =>
      db
        .prepare('INSERT INTO reactions (post_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?)')
        .bind(postId, userId, emoji, at)
        .run()

    it('needs a session', async () => {
      expect((await reactors(postId, '')).status).toBe(401)
    })

    it('lists names and emoji, oldest first, without revoked members', async () => {
      const gone = await addUser('gone', { revoked: true })
      const bob = await db
        .prepare("SELECT id FROM users WHERE username = 'bob'")
        .first<{ id: number }>()
      await addReaction(bob!.id, '💧', 300)
      await addReaction(ownerId, '🔥', 100)
      await addReaction(gone.id, '🌱', 200)

      const res = await reactors(postId)
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual([
        { emoji: '🔥', username: 'nikki' },
        { emoji: '💧', username: 'bob' },
      ])
    })

    it('returns 404 for a missing or unpublished post', async () => {
      const draft = await db
        .prepare('INSERT INTO posts (user_id, created_at) VALUES (?, ?) RETURNING id')
        .bind(ownerId, Date.now())
        .first<{ id: number }>()
      for (const id of [999, draft!.id]) expect((await reactors(id)).status).toBe(404)
    })
  })
})
