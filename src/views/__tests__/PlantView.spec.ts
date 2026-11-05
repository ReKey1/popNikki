import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createWebHistory } from 'vue-router'

import { stubApi, stubDialog, testPinia, testRouter } from '@/__tests__/helpers'
import { POLL_MS } from '@/composables/usePolling'
import type { PlantPosts } from '@/lib/api'
import { preloadImages } from '@/lib/preload'
import { useGardenStore } from '@/stores/garden'
import PlantView from '../PlantView.vue'

vi.mock('@/lib/preload', () => ({ preloadImages: vi.fn<(urls: string[]) => void>() }))

const DAY = 86_400_000
const now = Date.now()
const posts = (): PlantPosts => ({
  owner: { id: 2, username: 'けんじ' },
  posts: [
    {
      id: 9,
      description: 'Second leaf!',
      published_at: now,
      reactions: { '💧': 5, '🔥': 3 },
      my_reaction: '🔥',
    },
    {
      id: 4,
      description: 'Seed in.',
      published_at: now - 4 * DAY,
      reactions: { '🌱': 6 },
      my_reaction: null,
    },
  ],
})

async function mountPlant(
  routes: Record<string, Response> = {},
  {
    postId,
    router = testRouter(),
    pinia = testPinia(),
  }: {
    postId?: string
    router?: ReturnType<typeof testRouter>
    pinia?: ReturnType<typeof testPinia>
  } = {},
) {
  const api: Record<string, Response> = {
    '/api/users/2/posts': Response.json(posts()),
    '/api/users/2/seen': new Response(null, { status: 204 }),
    '/api/posts/9/reaction': new Response(null, { status: 204 }),
    ...routes,
  }
  const fetch = stubApi(api)
  const wrapper = mount(PlantView, {
    props: { id: '2', postId },
    global: { plugins: [pinia, router] },
    attachTo: document.body,
  })
  await flushPromises()
  return { api, fetch, router, wrapper }
}

const pills = (wrapper: Awaited<ReturnType<typeof mountPlant>>['wrapper']) =>
  wrapper.findAll('.pill').map((p) => p.text())
const button = (wrapper: Awaited<ReturnType<typeof mountPlant>>['wrapper'], emoji: string) =>
  wrapper.findAll('.bar button').find((b) => b.text() === emoji)!

describe('PlantView', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('shows the newest nikki large, the rest as history, and clears the badge', async () => {
    const { fetch, wrapper } = await mountPlant()

    expect(wrapper.get('h1').text()).toBe('けんじ')
    expect(wrapper.text()).toContain('DAY 5 · 2 NIKKI')
    expect(wrapper.get('.featured img').attributes('src')).toBe('/api/posts/9/photo')
    expect(wrapper.text()).toContain('Second leaf!')
    expect(pills(wrapper)).toEqual(['💧 5', '🔥 3'])

    expect(wrapper.text()).toContain('PREVIOUS NIKKI')
    const history = wrapper.findAll('.row')
    expect(history).toHaveLength(1)
    expect(history[0]!.attributes('href')).toBe('/plants/2/4')
    expect(history[0]!.text()).toContain('DAY 1 ·')
    expect(history[0]!.text()).toContain('🌱 6')

    expect(fetch).toHaveBeenCalledWith('/api/users/2/seen', { method: 'POST' })
  })

  it('shows a plant fetched ahead at once, before its refresh answers', async () => {
    const fetch = stubApi({})
    fetch.mockImplementation(() => new Promise(() => {}))
    const pinia = testPinia()
    useGardenStore().posts[2] = posts()

    const wrapper = mount(PlantView, {
      props: { id: '2' },
      global: { plugins: [pinia, testRouter()] },
    })
    expect(wrapper.get('h1').text()).toBe('けんじ')
    expect(wrapper.get('.featured img').attributes('src')).toBe('/api/posts/9/photo')
    expect(wrapper.get('.featured img').attributes('loading')).toBe('eager')
  })

  it('preloads the full-size photos of every nikki', async () => {
    await mountPlant()
    expect(preloadImages).toHaveBeenCalledWith(['/api/posts/9/photo', '/api/posts/4/photo'])
  })

  it('clears the badge in the cached garden too', async () => {
    const pinia = testPinia()
    const garden = useGardenStore()
    garden.plants = [
      {
        id: 2,
        username: 'けんじ',
        post_id: 9,
        published_at: now,
        post_count: 2,
        first_published_at: now,
        unseen: true,
      },
    ]
    await mountPlant({}, { pinia })
    expect(garden.plants[0]!.unseen).toBe(false)
  })

  it('moves the reaction at once and saves it', async () => {
    const { fetch, wrapper } = await mountPlant()

    await button(wrapper, '💧').trigger('click')
    expect(pills(wrapper)).toEqual(['💧 6', '🔥 2'])
    expect(fetch).toHaveBeenCalledWith(
      '/api/posts/9/reaction',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ emoji: '💧' }) }),
    )

    await flushPromises()
    await button(wrapper, '💧').trigger('click')
    expect(pills(wrapper)).toEqual(['💧 5', '🔥 2'])
    expect(fetch).toHaveBeenLastCalledWith('/api/posts/9/reaction', { method: 'DELETE' })
  })

  it('rolls the reaction back when saving fails', async () => {
    const { wrapper } = await mountPlant({
      '/api/posts/9/reaction': Response.json({ error: 'Not logged in' }, { status: 401 }),
    })

    await button(wrapper, '🕺').trigger('click')
    await flushPromises()

    expect(pills(wrapper)).toEqual(['💧 5', '🔥 3'])
    expect(wrapper.get('[role="alert"]').text()).toBe('Not logged in')
  })

  it('shows the server error for an unknown plant', async () => {
    const { wrapper } = await mountPlant({
      '/api/users/2/posts': Response.json({ error: 'Not Found' }, { status: 404 }),
    })
    expect(wrapper.get('[role="alert"]').text()).toBe('Not Found')
  })

  it('shows an older nikki large when its id is in the URL', async () => {
    const { wrapper } = await mountPlant({}, { postId: '4' })

    expect(wrapper.get('.featured img').attributes('src')).toBe('/api/posts/4/photo')
    expect(wrapper.text()).toContain('Seed in.')
    expect(pills(wrapper)).toEqual(['🌱 6'])
    expect(wrapper.text()).toContain('OTHER NIKKI')
    const rows = wrapper.findAll('.row')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.attributes('href')).toBe('/plants/2/9')
  })

  it('falls back to the newest nikki for an unknown post id', async () => {
    const { wrapper } = await mountPlant({}, { postId: '123' })
    expect(wrapper.get('.featured img').attributes('src')).toBe('/api/posts/9/photo')
    expect(wrapper.text()).toContain('PREVIOUS NIKKI')
  })

  it('refreshes while open and clears the badge again for a new nikki', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const { api, fetch, wrapper } = await mountPlant()
    const newer = posts()
    newer.posts[0]!.reactions = { '💧': 7, '🔥': 3 }
    newer.posts.unshift({
      id: 12,
      description: 'Third leaf',
      published_at: now + 1,
      reactions: {},
      my_reaction: null,
    })
    api['/api/users/2/posts'] = Response.json(newer)

    vi.advanceTimersByTime(POLL_MS)
    await flushPromises()

    expect(wrapper.text()).toContain('Third leaf')
    expect(wrapper.text()).toContain('💧 7 · 🔥 3')
    const seen = fetch.mock.calls.filter(([url]) => url === '/api/users/2/seen')
    expect(seen).toHaveLength(2)
  })

  it('keeps a reaction on screen when a refresh races it', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const { fetch, wrapper } = await mountPlant()
    let release!: () => void
    fetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => (release = () => resolve(new Response(null, { status: 204 })))),
    )

    await button(wrapper, '💧').trigger('click')
    vi.advanceTimersByTime(POLL_MS) // the refresh still has the old counts
    await flushPromises()
    expect(pills(wrapper)).toEqual(['💧 6', '🔥 2'])

    release()
    await flushPromises()
    expect(pills(wrapper)).toEqual(['💧 6', '🔥 2'])
  })

  it('shows who reacted when the counts are held', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    stubDialog()
    const { fetch, wrapper } = await mountPlant({
      '/api/posts/9/reactions': Response.json([
        { emoji: '💧', username: 'nikki' },
        { emoji: '🔥', username: 'bob' },
      ]),
    })

    await wrapper.get('.featured__counts').trigger('pointerdown')
    expect(fetch).not.toHaveBeenCalledWith('/api/posts/9/reactions')
    vi.advanceTimersByTime(500)
    await flushPromises()

    expect(fetch).toHaveBeenCalledWith('/api/posts/9/reactions')
    const dialog = wrapper.get('dialog')
    expect(dialog.attributes('open')).toBeDefined()
    expect(dialog.findAll('li').map((li) => li.text())).toEqual(['Nnikki💧', 'Bbob🔥'])
  })

  it('opens who reacted from the keyboard too', async () => {
    stubDialog()
    const { wrapper } = await mountPlant({
      '/api/posts/9/reactions': Response.json([{ emoji: '💧', username: 'nikki' }]),
    })
    await wrapper.get('.featured__counts').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(wrapper.get('dialog').attributes('open')).toBeDefined()
  })

  it('goes back to the previous page, or home when opened directly', async () => {
    const router = testRouter(createWebHistory())
    await router.push('/me')
    await router.push('/plants/2')
    const { wrapper } = await mountPlant({}, { router })
    await wrapper.get('button[aria-label="Back"]').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/me'))

    const direct = testRouter()
    await direct.push('/plants/2')
    const other = await mountPlant({}, { router: direct })
    await other.wrapper.get('button[aria-label="Back"]').trigger('click')
    await flushPromises()
    expect(direct.currentRoute.value.path).toBe('/')
  })

  it('leaves the plant in one step after looking through its nikki', async () => {
    const router = testRouter(createWebHistory())
    await router.push('/me')
    await router.push('/plants/2')
    const { wrapper } = await mountPlant({}, { router })

    // Switching posts replaces the history entry instead of adding one.
    await wrapper.get('a.row').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/plants/2/4'))
    await wrapper.setProps({ postId: '4' })
    await wrapper.get('a.row').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/plants/2/9'))

    await wrapper.get('button[aria-label="Back"]').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/me'))
  })
})
