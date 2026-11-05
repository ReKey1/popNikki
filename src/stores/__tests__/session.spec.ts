import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubApi, testPinia } from '@/__tests__/helpers'
import { useSessionStore } from '../session'

describe('session store', () => {
  beforeEach(testPinia)
  afterEach(() => vi.unstubAllGlobals())

  it('asks the server who is logged in only once', async () => {
    const fetch = stubApi({ '/api/me': Response.json({ id: 1, username: 'nikki' }) })
    const session = useSessionStore()

    const [a, b] = await Promise.all([session.load(), session.load()])
    await session.load()

    expect(a).toEqual({ id: 1, username: 'nikki' })
    expect(b).toBe(a)
    expect(session.me).toEqual({ id: 1, username: 'nikki' })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('has no viewer when the server says not logged in', async () => {
    stubApi({ '/api/me': Response.json({ error: 'Not logged in' }, { status: 401 }) })
    const session = useSessionStore()
    expect(await session.load()).toBeNull()
    expect(session.me).toBeNull()
  })

  it('asks again after a reset', async () => {
    const fetch = stubApi({ '/api/me': Response.json({ id: 1, username: 'nikki' }) })
    const session = useSessionStore()
    await session.load()

    session.reset()
    expect(session.me).toBeNull()
    await session.load()
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(session.me).toEqual({ id: 1, username: 'nikki' })
  })

  it('asks again after a network failure', async () => {
    const fetch = vi.fn<() => Promise<Response>>().mockRejectedValueOnce(new TypeError('offline'))
    fetch.mockResolvedValue(Response.json({ id: 1, username: 'nikki' }))
    vi.stubGlobal('fetch', fetch)
    const session = useSessionStore()

    expect(await session.load()).toBeNull()
    expect(await session.load()).toEqual({ id: 1, username: 'nikki' })
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
