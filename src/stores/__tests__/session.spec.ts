import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { stubApi, testPinia } from '@/__tests__/helpers'
import { useGardenStore } from '../garden'
import { useSessionStore } from '../session'

/** New stores over what the device remembers, as on the next visit. */
const nextVisit = () => setActivePinia(createPinia())

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

  it('remembers the viewer on the device for the next visit', async () => {
    stubApi({ '/api/me': Response.json({ id: 1, username: 'nikki' }) })
    await useSessionStore().load()

    nextVisit()
    expect(useSessionStore().me).toEqual({ id: 1, username: 'nikki' })
  })

  it('forgets a remembered viewer once the server says the session is over', async () => {
    stubApi({ '/api/me': Response.json({ id: 1, username: 'nikki' }) })
    await useSessionStore().load()

    nextVisit()
    stubApi({ '/api/me': Response.json({ error: 'Not logged in' }, { status: 401 }) })
    expect(await useSessionStore().load()).toBeNull()
    nextVisit()
    expect(useSessionStore().me).toBeNull()
  })

  it('keeps a remembered viewer through a server error or no network', async () => {
    stubApi({ '/api/me': Response.json({ id: 1, username: 'nikki' }) })
    await useSessionStore().load()

    nextVisit()
    stubApi({ '/api/me': Response.json({ error: 'Down' }, { status: 500 }) })
    expect(await useSessionStore().load()).toEqual({ id: 1, username: 'nikki' })

    nextVisit()
    vi.stubGlobal(
      'fetch',
      vi.fn<() => Promise<Response>>().mockRejectedValue(new TypeError('offline')),
    )
    expect(await useSessionStore().load()).toEqual({ id: 1, username: 'nikki' })
  })

  it("never shows one member another's garden", async () => {
    const api: Record<string, Response> = {
      '/api/me': Response.json({ id: 1, username: 'nikki' }),
      '/api/plants': Response.json([]),
    }
    stubApi(api)
    await useSessionStore().load()
    await useGardenStore().loadPlants()
    expect(useGardenStore().plants).toEqual([])

    // Someone else taps their tag on the same phone.
    nextVisit()
    api['/api/me'] = Response.json({ id: 2, username: 'bob' })
    await useSessionStore().load()
    expect(useGardenStore().plants).toBeNull()

    // And logging out leaves nothing behind.
    await useGardenStore().loadPlants()
    useSessionStore().reset()
    await nextTick()
    nextVisit()
    expect(useSessionStore().me).toBeNull()
    expect(useGardenStore().plants).toBeNull()
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
