import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubApi, testPinia } from '@/__tests__/helpers'
import router from '../index'

describe('router', () => {
  beforeEach(async () => {
    testPinia()
    // Start every test from home with a fresh session store.
    stubApi({ '/api/me': Response.json({}, { status: 401 }) })
    await router.push('/')
  })
  afterEach(() => vi.unstubAllGlobals())

  it('sends a logged-out visitor home before a members page renders', async () => {
    testPinia()
    stubApi({ '/api/me': Response.json({ error: 'Not logged in' }, { status: 401 }) })
    for (const path of ['/me', '/new', '/plants/2', '/practice/3']) {
      await router.push(path)
      expect(router.currentRoute.value.path).toBe('/')
    }
  })

  it('lets a member in and checks the session only once', async () => {
    testPinia()
    const fetch = stubApi({ '/api/me': Response.json({ id: 1, username: 'nikki' }) })

    await router.push('/me')
    expect(router.currentRoute.value.path).toBe('/me')
    await router.push('/plants/2/4')
    expect(router.currentRoute.value.path).toBe('/plants/2/4')

    expect(fetch.mock.calls.filter(([url]) => url === '/api/me')).toHaveLength(1)
  })

  it('opens the claim page without a session', async () => {
    testPinia()
    stubApi({ '/api/me': Response.json({}, { status: 401 }) })
    await router.push('/claim')
    expect(router.currentRoute.value.path).toBe('/claim')
  })
})
