import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { stubApi, testRouter } from '@/__tests__/helpers'
import PlantView from '../PlantView.vue'

const DAY = 86_400_000
const now = Date.now()
const posts = () => ({
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

async function mountPlant(routes: Record<string, Response> = {}) {
  const fetch = stubApi({
    '/api/users/2/posts': Response.json(posts()),
    '/api/users/2/seen': new Response(null, { status: 204 }),
    '/api/posts/9/reaction': new Response(null, { status: 204 }),
    ...routes,
  })
  const wrapper = mount(PlantView, { props: { id: '2' }, global: { plugins: [testRouter()] } })
  await flushPromises()
  return { fetch, wrapper }
}

const pills = (wrapper: Awaited<ReturnType<typeof mountPlant>>['wrapper']) =>
  wrapper.findAll('.pill').map((p) => p.text())
const button = (wrapper: Awaited<ReturnType<typeof mountPlant>>['wrapper'], emoji: string) =>
  wrapper.findAll('.bar button').find((b) => b.text() === emoji)!

describe('PlantView', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the newest nikki large, the rest as history, and clears the badge', async () => {
    const { fetch, wrapper } = await mountPlant()

    expect(wrapper.get('h1').text()).toBe('けんじ')
    expect(wrapper.text()).toContain('DAY 5 · 2 NIKKI')
    expect(wrapper.get('.latest img').attributes('src')).toBe('/api/posts/9/photo')
    expect(wrapper.text()).toContain('Second leaf!')
    expect(pills(wrapper)).toEqual(['💧 5', '🔥 3'])

    const history = wrapper.findAll('article.row')
    expect(history).toHaveLength(1)
    expect(history[0]!.text()).toContain('DAY 1 ·')
    expect(history[0]!.text()).toContain('🌱 6')

    expect(fetch).toHaveBeenCalledWith('/api/users/2/seen', { method: 'POST' })
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
})
