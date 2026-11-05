import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import HomeView from '../HomeView.vue'

function stubApi(routes: Record<string, Response>) {
  const fetch = vi.fn<(url: string) => Promise<Response>>(
    async (url) => routes[url]?.clone() ?? Response.json({}, { status: 404 }),
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}

const mountHome = () => mount(HomeView, { global: { stubs: { RouterLink: RouterLinkStub } } })

describe('HomeView', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('asks a logged-out visitor to tap their tag', async () => {
    stubApi({ '/api/me': Response.json({ error: 'Not logged in' }, { status: 401 }) })
    const wrapper = mountHome()
    await flushPromises()
    expect(wrapper.text()).toContain("Tap your plant's tag to log in.")
  })

  it('greets the user and lists plants with their newest thumbnail', async () => {
    stubApi({
      '/api/me': Response.json({ id: 1, username: 'nikki' }),
      '/api/plants': Response.json([
        { id: 1, username: 'nikki', post_id: 7, published_at: 1_700_000_000_000 },
        { id: 2, username: 'bob', post_id: null, published_at: null },
      ]),
    })
    const wrapper = mountHome()
    await flushPromises()

    expect(wrapper.text()).toContain('Hi nikki!')
    expect(wrapper.findAll('li')).toHaveLength(2)
    expect(wrapper.find('img').attributes('src')).toBe('/api/posts/7/thumb')
    expect(wrapper.text()).toContain('no posts yet')
  })

  it('logs out', async () => {
    const fetch = stubApi({
      '/api/me': Response.json({ id: 1, username: 'nikki' }),
      '/api/plants': Response.json([]),
      '/api/logout': new Response(null, { status: 204 }),
    })
    const wrapper = mountHome()
    await flushPromises()

    await wrapper.find('button').trigger('click')
    await flushPromises()

    expect(fetch).toHaveBeenCalledWith('/api/logout', { method: 'POST' })
    expect(wrapper.text()).toContain("Tap your plant's tag to log in.")
  })
})
