import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { nextTick } from 'vue'

import { stubApi, testPinia } from '@/__tests__/helpers'
import type { Plant, PlantPosts } from '@/lib/api'
import { useGardenStore } from '../garden'

const plant = (id: number, unseen = false): Plant => ({
  id,
  username: `user${id}`,
  post_id: null,
  published_at: null,
  post_count: 0,
  first_published_at: null,
  unseen,
})
const posts = (): PlantPosts => ({
  owner: { id: 2, username: 'user2' },
  posts: [{ id: 9, description: '', published_at: 1, reactions: { '💧': 1 }, my_reaction: null }],
})

describe('garden store', () => {
  beforeEach(testPinia)
  afterEach(() => vi.unstubAllGlobals())

  it('keeps the garden it has when a refresh fails', async () => {
    const api: Record<string, Response> = { '/api/plants': Response.json([plant(1)]) }
    stubApi(api)
    const garden = useGardenStore()
    await garden.loadPlants()

    api['/api/plants'] = Response.json({ error: 'Down' }, { status: 500 })
    const res = await garden.loadPlants()
    expect(res.ok).toBe(false)
    expect(garden.plants).toEqual([plant(1)])
  })

  it('fetches a plant ahead only when it is not here yet', async () => {
    const fetch = stubApi({ '/api/users/2/posts': Response.json(posts()) })
    const garden = useGardenStore()

    await garden.prefetchPosts(2)
    await garden.prefetchPosts(2)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(garden.posts[2]).toEqual(posts())
  })

  it('rolls a reaction back when the server refuses it', async () => {
    stubApi({
      '/api/users/2/posts': Response.json(posts()),
      '/api/posts/9/reaction': Response.json({ error: 'Nope' }, { status: 400 }),
    })
    const garden = useGardenStore()
    await garden.loadPosts(2)
    const post = garden.posts[2]!.posts[0]!

    const pending = garden.react(post, '🔥')
    expect(post.reactions).toEqual({ '💧': 1, '🔥': 1 })
    expect((await pending).ok).toBe(false)
    expect(post.reactions).toEqual({ '💧': 1 })
    expect(post.my_reaction).toBeNull()
  })

  it('clears the badge in the cached garden once the plant is seen', async () => {
    stubApi({
      '/api/plants': Response.json([plant(2, true)]),
      '/api/users/2/seen': new Response(null, { status: 204 }),
    })
    const garden = useGardenStore()
    await garden.loadPlants()

    await garden.markSeen(2)
    expect(garden.plants![0]!.unseen).toBe(false)
  })

  it('remembers the garden on the device, but not the nikki or drafts', async () => {
    stubApi({
      '/api/plants': Response.json([plant(1)]),
      '/api/users/2/posts': Response.json(posts()),
      '/api/me/drafts': Response.json([{ id: 3, description: '', created_at: 1 }]),
    })
    const garden = useGardenStore()
    await Promise.all([garden.loadPlants(), garden.loadPosts(2), garden.loadDrafts()])
    await nextTick()

    // The next visit: new stores over the same device.
    setActivePinia(createPinia())
    const next = useGardenStore()
    expect(next.plants).toEqual([plant(1)])
    expect(next.posts).toEqual({})
    expect(next.drafts).toBeNull()

    next.clear()
    await nextTick()
    setActivePinia(createPinia())
    expect(useGardenStore().plants).toBeNull()
  })

  it('forgets everything on clear', async () => {
    stubApi({
      '/api/plants': Response.json([plant(1)]),
      '/api/users/2/posts': Response.json(posts()),
      '/api/me/drafts': Response.json([]),
    })
    const garden = useGardenStore()
    await Promise.all([garden.loadPlants(), garden.loadPosts(2), garden.loadDrafts()])

    garden.clear()
    expect(garden.plants).toBeNull()
    expect(garden.posts).toEqual({})
    expect(garden.drafts).toBeNull()
  })
})
