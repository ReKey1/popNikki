import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SECONDS } from '../lib/roulette'
import { addUser, db, logIn, request, resetDb } from './helpers'

type Roll = { seconds: number; track: { id: number; title: string } }

describe('roulette', () => {
  let cookie: string
  let userId: number

  /** The rolls the server is holding, as (member, seconds) pairs. */
  const saved = async () =>
    (await db.prepare('SELECT user_id, seconds FROM rolls ORDER BY user_id').all()).results
  const spin = async (as = cookie) =>
    (
      await request('/api/roll', {
        method: 'POST',
        headers: { Cookie: as, Origin: 'http://localhost' },
      })
    ).json<{ roll: Roll | null }>()
  const addTrack = async (title: string) => {
    const track = await db
      .prepare('INSERT INTO tracks (title, r2_key) VALUES (?, ?) RETURNING id')
      .bind(title, `tracks/${title}.mp3`)
      .first<{ id: number }>()
    return track!.id
  }
  const addPublished = (count: number, at: number) =>
    db.batch(
      Array.from({ length: count }, () =>
        db
          .prepare('INSERT INTO posts (user_id, created_at, published_at) VALUES (?, ?, ?)')
          .bind(userId, at, at),
      ),
    )

  beforeEach(async () => {
    await resetDb()
    const user = await addUser('nikki')
    userId = user.id
    cookie = await logIn(user.token)
  })

  afterEach(() => vi.restoreAllMocks())

  it('needs a session', async () => {
    const res = await request('/api/roll', {
      method: 'POST',
      headers: { Origin: 'http://localhost' },
    })
    expect(res.status).toBe(401)
  })

  it('can only be spun, never looked up', async () => {
    await addTrack('beat')
    const res = await request('/api/roll', { headers: { Cookie: cookie } })
    expect(res.status).toBe(404)
    expect(await saved()).toEqual([])
  })

  it('lands on a dance time and a song', async () => {
    const trackId = await addTrack('beat')
    const { roll } = await spin()
    expect(SECONDS).toContain(roll!.seconds)
    expect(roll!.track).toEqual({ id: trackId, title: 'beat' })
    expect(await saved()).toEqual([{ user_id: userId, seconds: roll!.seconds }])
  })

  it('keeps the same roll however often the member spins', async () => {
    for (const title of ['a', 'b', 'c', 'd', 'e', 'f']) await addTrack(title)
    const { roll } = await spin()
    for (let i = 0; i < 10; i++) expect((await spin()).roll).toEqual(roll)
    expect((await db.prepare('SELECT COUNT(*) AS n FROM rolls').first<{ n: number }>())!.n).toBe(1)
  })

  it('gives every member their own roll', async () => {
    await addTrack('beat')
    await db
      .prepare(
        'INSERT INTO rolls (user_id, seconds, track_id, created_at) SELECT ?, 150, id, 1 FROM tracks',
      )
      .bind(userId)
      .run()
    const bob = await addUser('bob')
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    expect((await spin(await logIn(bob.token))).roll!.seconds).toBe(60)
    expect((await spin()).roll!.seconds).toBe(150)
    expect(await saved()).toEqual([
      { user_id: userId, seconds: 150 },
      { user_id: bob.id, seconds: 60 },
    ])
  })

  it('has nothing to roll when the playlist is empty', async () => {
    expect(await spin()).toEqual({ roll: null })
    expect((await db.prepare('SELECT COUNT(*) AS n FROM rolls').first<{ n: number }>())!.n).toBe(0)
  })

  it('avoids the three tracks the member danced to last', async () => {
    const ids = [await addTrack('a'), await addTrack('b'), await addTrack('c'), await addTrack('d')]
    await db.batch(
      ids.slice(0, 3).map((trackId, i) =>
        db
          .prepare(
            `INSERT INTO posts (user_id, created_at, published_at, track_id, music_started_at)
             VALUES (?, ?, ?, ?, ?)`,
          )
          .bind(userId, 1000 + i, 1000 + i, trackId, 1000 + i),
      ),
    )
    expect((await spin()).roll!.track.id).toBe(ids[3])
  })

  it('forgets a roll whose song left the playlist', async () => {
    const trackId = await addTrack('beat')
    await spin()
    await db.prepare('DELETE FROM tracks WHERE id = ?').bind(trackId).run()
    expect(await saved()).toEqual([])
  })

  it('rolls shorter for a new member than for a regular, and tells neither', async () => {
    await addTrack('beat')
    // The same spot on the roulette: a minute with a new member's odds, two with a regular's.
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    expect((await spin()).roll!.seconds).toBe(60)

    const bob = await addUser('bob')
    userId = bob.id
    await addPublished(6, Date.now())
    const bobCookie = await logIn(bob.token)
    const res = await request('/api/roll', {
      method: 'POST',
      headers: { Cookie: bobCookie, Origin: 'http://localhost' },
    })
    const body = await res.json<{ roll: Roll }>()
    expect(body.roll.seconds).toBe(120)

    // Nothing in either answer says what the odds were.
    expect(Object.keys(body)).toEqual(['roll'])
    expect(Object.keys(body.roll).sort()).toEqual(['seconds', 'track'])
  })

  it('rolls shorter again for a regular who has been away', async () => {
    await addTrack('beat')
    await addPublished(6, Date.now() - 30 * 24 * 60 * 60 * 1000)
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    expect((await spin()).roll!.seconds).toBe(60)
  })
})
