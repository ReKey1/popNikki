import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { stubApi, stubDialog, testRouter } from '@/__tests__/helpers'
import ProfileView from '../ProfileView.vue'

const DAY = 24 * 60 * 60 * 1000
const now = Date.now()

const mountProfile = async () => {
  const router = testRouter()
  const wrapper = mount(ProfileView, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return { wrapper, router }
}

function stubProfile(extra: Record<string, Response> = {}) {
  return stubApi({
    '/api/me': Response.json({ id: 3, username: 'nikki' }),
    '/api/users/3/posts': Response.json({
      owner: { id: 3, username: 'nikki' },
      posts: [
        { id: 9, description: 'two', published_at: now, reactions: {}, my_reaction: null },
        {
          id: 8,
          description: 'one',
          published_at: now - 4 * DAY,
          reactions: {},
          my_reaction: null,
        },
      ],
    }),
    '/api/me/drafts': Response.json([{ id: 12, description: 'rainy day', created_at: now }]),
    ...extra,
  })
}

describe('ProfileView', () => {
  beforeAll(stubDialog)
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('shows your name, day and posted thumbnails', async () => {
    stubProfile()
    const { wrapper } = await mountProfile()

    expect(wrapper.get('h2').text()).toBe('nikki')
    expect(wrapper.text()).toContain('DAY 5')
    expect(wrapper.text()).toContain('2 NIKKI')
    expect(wrapper.get('a.btn').attributes('href')).toBe('/new')

    const tiles = wrapper.findAll('.grid li')
    expect(tiles).toHaveLength(2)
    expect(tiles[0]!.get('img').attributes('src')).toBe('/api/posts/9/thumb')
    expect(tiles[0]!.text()).toBe('DAY 5')
    expect(tiles[1]!.text()).toBe('DAY 1')
    expect(tiles[0]!.get('a').attributes('href')).toBe('/plants/3')
  })

  it('lists drafts with practice and delete', async () => {
    const fetch = stubProfile({ '/api/posts/12': new Response(null, { status: 204 }) })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { wrapper } = await mountProfile()

    const tabs = wrapper.findAll('.tab')
    expect(tabs.map((t) => t.text())).toEqual(['POSTED · 2', 'DRAFTS · 1'])
    await tabs[1]!.trigger('click')
    expect(tabs[1]!.attributes('aria-pressed')).toBe('true')

    const draft = wrapper.get('.drafts article')
    expect(draft.text()).toContain('rainy day')
    expect(draft.get('a').attributes('href')).toBe('/practice/12')

    await draft
      .findAll('button')
      .find((b) => b.text() === 'Delete')!
      .trigger('click')
    await flushPromises()
    expect(fetch).toHaveBeenCalledWith('/api/posts/12', { method: 'DELETE' })
    expect(wrapper.find('.drafts').exists()).toBe(false)
    expect(wrapper.text()).toContain('DRAFTS · 0')
  })

  it('keeps a draft when the delete is not confirmed', async () => {
    const fetch = stubProfile()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { wrapper } = await mountProfile()
    await wrapper.findAll('.tab')[1]!.trigger('click')
    await wrapper
      .findAll('.drafts button')
      .find((b) => b.text() === 'Delete')!
      .trigger('click')

    expect(fetch).not.toHaveBeenCalledWith('/api/posts/12', expect.anything())
    expect(wrapper.findAll('.drafts article')).toHaveLength(1)
  })

  it('opens settings from the gear and shows the new name after a rename', async () => {
    stubProfile()
    const { wrapper } = await mountProfile()

    await wrapper.get('button[aria-label="Settings"]').trigger('click')
    expect(wrapper.get('dialog').attributes('open')).toBe('')
    expect(wrapper.get('dialog input').element).toHaveProperty('value', 'nikki')

    wrapper
      .findComponent({ name: 'SettingsSheet' })
      .vm.$emit('renamed', { id: 3, username: 'bloom' })
    await flushPromises()
    expect(wrapper.get('h2').text()).toBe('bloom')
  })

  it('sends a logged-out visitor home', async () => {
    stubApi({ '/api/me': Response.json({ error: 'Not logged in' }, { status: 401 }) })
    const { router } = await mountProfile()
    expect(router.currentRoute.value.path).toBe('/')
  })
})
