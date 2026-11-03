import { describe, expect, it } from 'vitest'

import app from '../index'

describe('API', () => {
  it('responds on /api/', async () => {
    const res = await app.request('/api/')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ name: 'Cloudflare' })
  })

  it('sends a no-referrer policy', async () => {
    const res = await app.request('/api/')
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer')
  })

  it('returns 404 for unknown API routes', async () => {
    const res = await app.request('/api/missing')
    expect(res.status).toBe(404)
  })
})
