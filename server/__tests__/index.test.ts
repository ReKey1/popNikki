import { describe, expect, it } from 'vitest'

import { request } from './helpers'

describe('app', () => {
  it('sends a no-referrer policy', async () => {
    const res = await request('/api/missing')
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer')
  })

  it('lets its responses load nothing and be framed nowhere', async () => {
    const res = await request('/api/missing')
    expect(res.headers.get('Content-Security-Policy')).toBe(
      "default-src 'none'; frame-ancestors 'none'",
    )
    expect(res.headers.get('X-Frame-Options')).toBe('DENY')
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(res.headers.get('Strict-Transport-Security')).toMatch(/max-age=\d+/)
  })

  it('keeps data out of caches unless a route says otherwise', async () => {
    expect((await request('/api/me')).headers.get('Cache-Control')).toBe('no-store')
    expect((await request('/tag?t=nope')).headers.get('Cache-Control')).toBe('no-store')
  })

  it('returns 404 for unknown API routes', async () => {
    const res = await request('/api/missing')
    expect(res.status).toBe(404)
  })

  it('rejects a cross-site form post', async () => {
    const res = await request('/api/posts', {
      method: 'POST',
      headers: { Origin: 'https://evil.example' },
      body: new URLSearchParams({ description: 'x' }),
    })
    expect(res.status).toBe(403)
  })
})
