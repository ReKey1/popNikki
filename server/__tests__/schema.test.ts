import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, it } from 'vitest'

const db = env.DB

async function addUser(tokenHash: string, username: string | null = null): Promise<number> {
  const row = await db
    .prepare('INSERT INTO users (token_hash, username, created_at) VALUES (?, ?, ?) RETURNING id')
    .bind(tokenHash, username, Date.now())
    .first<{ id: number }>()
  return row!.id
}

async function count(table: string): Promise<number> {
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>()
  return row!.n
}

describe('D1 schema', () => {
  beforeEach(async () => {
    await db.batch(
      ['rolls', 'reactions', 'plant_views', 'sessions', 'posts', 'tracks', 'users'].map((t) =>
        db.prepare(`DELETE FROM ${t}`),
      ),
    )
  })

  it('creates every table', async () => {
    const { results } = await db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all<{ name: string }>()
    expect(results.map((r) => r.name)).toEqual(
      expect.arrayContaining(['plant_views', 'posts', 'reactions', 'sessions', 'tracks', 'users']),
    )
  })

  it('keeps only an id, title and R2 key for tracks', async () => {
    const { results } = await db.prepare('PRAGMA table_info(tracks)').all<{ name: string }>()
    expect(results.map((r) => r.name)).toEqual(['id', 'title', 'r2_key'])
  })

  it('rejects a duplicate tag token hash', async () => {
    await addUser('hash-a')
    await expect(addUser('hash-a')).rejects.toThrow(/UNIQUE/)
  })

  it('rejects a username that differs only in case', async () => {
    await addUser('hash-a', 'Nikki')
    await expect(addUser('hash-b', 'nikki')).rejects.toThrow(/UNIQUE/)
  })

  it('deletes sessions, posts and views with their user', async () => {
    const alice = await addUser('hash-a', 'alice')
    const bob = await addUser('hash-b', 'bob')
    const now = Date.now()
    await db.batch([
      db
        .prepare(
          'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
        )
        .bind('session-a', alice, now, now + 1000),
      db
        .prepare('INSERT INTO posts (user_id, created_at, published_at) VALUES (?, ?, ?)')
        .bind(alice, now, now),
      db
        .prepare(
          'INSERT INTO plant_views (viewer_id, owner_id, last_viewed_at) VALUES (?, ?, ?), (?, ?, ?)',
        )
        .bind(alice, bob, now, bob, alice, now),
    ])

    await db.prepare('DELETE FROM users WHERE id = ?').bind(alice).run()

    expect(await count('sessions')).toBe(0)
    expect(await count('posts')).toBe(0)
    expect(await count('plant_views')).toBe(0)
    expect(await count('users')).toBe(1)
  })

  it('rejects a post for a user that does not exist', async () => {
    await expect(
      db
        .prepare('INSERT INTO posts (user_id, created_at) VALUES (?, ?)')
        .bind(999, Date.now())
        .run(),
    ).rejects.toThrow(/FOREIGN KEY/)
  })

  it('upserts a plant view instead of adding a second row', async () => {
    const alice = await addUser('hash-a', 'alice')
    const bob = await addUser('hash-b', 'bob')
    const markViewed = (at: number) =>
      db
        .prepare(
          `INSERT INTO plant_views (viewer_id, owner_id, last_viewed_at) VALUES (?, ?, ?)
           ON CONFLICT (viewer_id, owner_id) DO UPDATE SET last_viewed_at = excluded.last_viewed_at`,
        )
        .bind(alice, bob, at)
        .run()

    await markViewed(1000)
    await markViewed(2000)

    const { results } = await db
      .prepare('SELECT last_viewed_at FROM plant_views')
      .all<{ last_viewed_at: number }>()
    expect(results).toEqual([{ last_viewed_at: 2000 }])
  })

  it('keeps one reaction per member per post and deletes it with the post or member', async () => {
    const alice = await addUser('hash-a', 'alice')
    const bob = await addUser('hash-b', 'bob')
    const now = Date.now()
    const post = await db
      .prepare(
        'INSERT INTO posts (user_id, created_at, published_at) VALUES (?, ?, ?) RETURNING id',
      )
      .bind(alice, now, now)
      .first<{ id: number }>()
    const react = (userId: number, emoji: string) =>
      db
        .prepare('INSERT INTO reactions (post_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?)')
        .bind(post!.id, userId, emoji, now)
        .run()

    await react(alice, '🔥')
    await react(bob, '💧')
    await expect(react(bob, '🌱')).rejects.toThrow(/UNIQUE/)

    await db.prepare('DELETE FROM users WHERE id = ?').bind(bob).run()
    expect(await count('reactions')).toBe(1)
    await db.prepare('DELETE FROM posts WHERE id = ?').bind(post!.id).run()
    expect(await count('reactions')).toBe(0)
  })

  it('finds the newest published post per user through the index', async () => {
    const { results } = await db
      .prepare(
        `EXPLAIN QUERY PLAN
         SELECT u.id, (SELECT MAX(p.published_at) FROM posts p WHERE p.user_id = u.id) AS latest
         FROM users u`,
      )
      .all<{ detail: string }>()
    expect(results.map((r) => r.detail).join('\n')).toContain('posts_user_published')
  })
})
