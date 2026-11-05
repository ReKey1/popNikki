import { describe, expect, it } from 'vitest'

import { request } from './helpers'

describe('app', () => {
  it('sends a no-referrer policy', async () => {
    const res = await request('/api/missing')
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer')
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
