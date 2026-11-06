import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, it } from 'vitest'

import { addUser, db, logIn, request, resetDb } from './helpers'

const AUDIO = new Uint8Array(Array.from({ length: 100 }, (_, i) => i))

describe('next track', () => {
  beforeEach(resetDb)

  it('needs a session', async () => {
    expect((await request('/api/tracks/next')).status).toBe(401)
  })

  it('picks a track without starting any clock', async () => {
    const cookie = await logIn((await addUser('nikki')).token)
    const get = async () =>
      (await request('/api/tracks/next', { headers: { Cookie: cookie } })).json()
    expect(await get()).toEqual({ track: null })

    const track = await db
      .prepare("INSERT INTO tracks (title, r2_key) VALUES ('beat', 'tracks/beat.mp3') RETURNING id")
      .first<{ id: number }>()
    expect(await get()).toEqual({ track: { id: track!.id, title: 'beat' } })
    const started = await db
      .prepare('SELECT COUNT(*) AS n FROM posts WHERE music_started_at IS NOT NULL')
      .first<{ n: number }>()
    expect(started!.n).toBe(0)
  })
})

describe('track audio', () => {
  let cookie: string
  let path: string

  const get = (range?: string) =>
    request(path, { headers: range ? { Cookie: cookie, Range: range } : { Cookie: cookie } })

  beforeEach(async () => {
    await resetDb()
    cookie = await logIn((await addUser('nikki')).token)
    await env.FILES.put('tracks/test.mp3', AUDIO, { httpMetadata: { contentType: 'audio/mpeg' } })
    const track = await db
      .prepare("INSERT INTO tracks (title, r2_key) VALUES ('test', 'tracks/test.mp3') RETURNING id")
      .first<{ id: number }>()
    path = `/api/tracks/${track!.id}/audio`
  })

  it('needs a session', async () => {
    expect((await request(path)).status).toBe(401)
  })

  it('returns 404 for an unknown track', async () => {
    const res = await request('/api/tracks/999/audio', { headers: { Cookie: cookie } })
    expect(res.status).toBe(404)
  })

  it('serves the whole file', async () => {
    const res = await get()
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('audio/mpeg')
    expect(res.headers.get('Accept-Ranges')).toBe('bytes')
    expect(res.headers.get('Cache-Control')).toMatch(/^private/)
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(AUDIO)
  })

  it('serves a byte range, which Safari needs for media', async () => {
    const res = await get('bytes=10-19')
    expect(res.status).toBe(206)
    expect(res.headers.get('Content-Range')).toBe('bytes 10-19/100')
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(AUDIO.slice(10, 20))
  })

  it('serves open-ended and suffix ranges', async () => {
    const open = await get('bytes=90-')
    expect(open.status).toBe(206)
    expect(open.headers.get('Content-Range')).toBe('bytes 90-99/100')
    await open.arrayBuffer()

    const suffix = await get('bytes=-5')
    expect(suffix.headers.get('Content-Range')).toBe('bytes 95-99/100')
    expect(new Uint8Array(await suffix.arrayBuffer())).toEqual(AUDIO.slice(95))
  })
})
