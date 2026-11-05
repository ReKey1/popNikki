import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { stubApi, stubDialog, testRouter } from '@/__tests__/helpers'
import HomeView from '../HomeView.vue'

const mountHome = () =>
  mount(HomeView, { global: { plugins: [testRouter()] }, attachTo: document.body })

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
  beforeAll(stubDialog)
  afterEach(() => {
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

  it('logs out from the settings sheet', async () => {
    const fetch = stubApi({
      '/api/me': Response.json({ id: 1, username: 'nikki' }),
      '/api/plants': Response.json([plant(1, 'nikki')]),
      '/api/logout': new Response(null, { status: 204 }),
    })
    const wrapper = mountHome()
    await flushPromises()

    await wrapper.get('button[aria-label="Settings"]').trigger('click')
    expect(wrapper.get('dialog').attributes('open')).toBe('')
    expect(wrapper.get('dialog a').attributes('href')).toBe('/plants/1')

    const logOut = wrapper.findAll('dialog button').find((b) => b.text() === 'Log out')!
    await logOut.trigger('click')
    await flushPromises()

    expect(fetch).toHaveBeenCalledWith('/api/logout', { method: 'POST' })
    expect(wrapper.text()).toContain("Tap your plant's tag to log in.")
  })
})
