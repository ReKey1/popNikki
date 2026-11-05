import { flushPromises, mount } from '@vue/test-utils'
import { getActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { stubApi, testPinia, testRouter } from '@/__tests__/helpers'
import { POLL_MS } from '@/composables/usePolling'
import { useGardenStore } from '@/stores/garden'
import HomeView from '../HomeView.vue'

const mountHome = () =>
  mount(HomeView, { global: { plugins: [testPinia(), testRouter()] }, attachTo: document.body })

const plant = (id: number, username: string, extra = {}) => ({
  id,
  username,
  post_id: null,
  published_at: null,
  post_count: 0,
  first_published_at: null,
  unseen: false,
  ...extra,
})

describe('HomeView', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('asks a logged-out visitor to tap their tag', async () => {
    stubApi({ '/api/me': Response.json({ error: 'Not logged in' }, { status: 401 }) })
    const wrapper = mountHome()
    await flushPromises()
    expect(wrapper.text()).toContain("No seed, no entry. Tap your plant's tag to log in.")
  })

  it('shows every plant as a tile and counts the fresh ones', async () => {
    const now = Date.now()
    stubApi({
      '/api/me': Response.json({ id: 1, username: 'nikki' }),
      '/api/plants': Response.json([
        plant(2, 'けんじ', {
          post_id: 7,
          published_at: now - 2 * 3_600_000,
          post_count: 9,
          first_published_at: now,
          unseen: true,
        }),
        plant(1, 'nikki'),
      ]),
    })
    const wrapper = mountHome()
    await flushPromises()

    expect(wrapper.text()).toContain('2 plants,growing on beat.')
    expect(wrapper.text()).toContain('1 FRESH')
    const tiles = wrapper.findAll('li')
    expect(tiles).toHaveLength(2)
    expect(tiles[0]!.get('img').attributes('src')).toBe('/api/posts/7/thumb')
    expect(tiles[0]!.text()).toContain('2h')
    expect(tiles[0]!.text()).toContain('DAY 1 · 9 NIKKI')
    expect(tiles[0]!.find('.seal').exists()).toBe(true)
    expect(tiles[1]!.text()).toContain('no nikki yet')
    expect(tiles[1]!.find('.seal').exists()).toBe(false)
    expect(wrapper.get('a.fab').attributes('href')).toBe('/new')
  })

  it('links to your profile instead of a settings sheet', async () => {
    stubApi({
      '/api/me': Response.json({ id: 1, username: 'nikki' }),
      '/api/plants': Response.json([plant(1, 'nikki')]),
    })
    const wrapper = mountHome()
    await flushPromises()

    const profile = wrapper.get('a[aria-label="My profile"]')
    expect(profile.attributes('href')).toBe('/me')
    expect(profile.text()).toBe('N')
    expect(wrapper.find('button[aria-label="Settings"]').exists()).toBe(false)
    expect(wrapper.find('dialog').exists()).toBe(false)
  })

  it('picks up new nikki without a reload', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const api: Record<string, Response> = {
      '/api/me': Response.json({ id: 1, username: 'nikki' }),
      '/api/plants': Response.json([plant(2, 'けんじ')]),
    }
    stubApi(api)
    const wrapper = mountHome()
    await flushPromises()
    expect(wrapper.text()).not.toContain('FRESH')

    api['/api/plants'] = Response.json([
      plant(2, 'けんじ', { post_id: 7, published_at: Date.now(), post_count: 1, unseen: true }),
    ])
    vi.advanceTimersByTime(POLL_MS)
    await flushPromises()

    expect(wrapper.text()).toContain('1 FRESH')
    expect(wrapper.get('li img').attributes('src')).toBe('/api/posts/7/thumb')
  })

  it('shows the garden from the last visit at once, with no loading state', async () => {
    const fetch = stubApi({
      '/api/me': Response.json({ id: 1, username: 'nikki' }),
      '/api/plants': Response.json([plant(2, 'けんじ')]),
    })
    mountHome().unmount()
    await flushPromises()

    fetch.mockImplementation(() => new Promise(() => {}))
    const again = mount(HomeView, { global: { plugins: [getActivePinia()!, testRouter()] } })
    expect(again.text()).not.toContain('LOADING')
    expect(again.findAll('li')).toHaveLength(1)
    expect(again.text()).toContain('1 plant,growing on beat.')
  })

  it('fetches every plant’s nikki ahead, once', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const fetch = stubApi({
      '/api/me': Response.json({ id: 1, username: 'nikki' }),
      '/api/plants': Response.json([plant(2, 'けんじ'), plant(1, 'nikki')]),
      '/api/users/2/posts': Response.json({ owner: { id: 2, username: 'けんじ' }, posts: [] }),
      '/api/users/1/posts': Response.json({ owner: { id: 1, username: 'nikki' }, posts: [] }),
    })
    mountHome()
    await flushPromises()
    vi.advanceTimersByTime(POLL_MS)
    await flushPromises()

    const calls = fetch.mock.calls.map(([url]) => url)
    expect(calls.filter((u) => u === '/api/users/2/posts')).toHaveLength(1)
    expect(calls.filter((u) => u === '/api/users/1/posts')).toHaveLength(1)
    expect(useGardenStore().posts[2]).toBeDefined()
  })

  it('does not poll for a logged-out visitor', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const fetch = stubApi({ '/api/me': Response.json({}, { status: 401 }) })
    mountHome()
    await flushPromises()
    vi.advanceTimersByTime(3 * POLL_MS)
    await flushPromises()
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
