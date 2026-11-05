import { defineStore } from 'pinia'
import { ref } from 'vue'

import { setReaction, type Draft, type Plant, type PlantPosts, type Post } from '@/lib/api'

/**
 * The garden, each plant's nikki and the viewer's drafts, kept between pages.
 * Pages draw what is here at once and refresh it in the background.
 */
export const useGardenStore = defineStore('garden', () => {
  const plants = ref<Plant[] | null>(null)
  const posts = ref<Record<number, PlantPosts>>({})
  const drafts = ref<Draft[] | null>(null)

  /** Bumped by every reaction, so a refresh that raced one doesn't undo it on screen. */
  let reactionVersion = 0
  let reactionsInFlight = 0

  // A failed refresh keeps what is already here; the caller gets the response to report it.
  async function loadPlants(): Promise<Response> {
    const res = await fetch('/api/plants')
    if (res.ok) plants.value = await res.json()
    return res
  }

  async function loadPosts(userId: number): Promise<Response> {
    const version = reactionVersion
    const res = await fetch(`/api/users/${userId}/posts`)
    if (!res.ok) return res
    const fresh: PlantPosts = await res.json()
    if (!reactionsInFlight && version === reactionVersion) posts.value[userId] = fresh
    return res
  }

  /** Loads a plant's nikki ahead of time, unless they are already here. */
  async function prefetchPosts(userId: number): Promise<void> {
    if (!posts.value[userId]) await loadPosts(userId)
  }

  async function loadDrafts(): Promise<Response> {
    const res = await fetch('/api/me/drafts')
    if (res.ok) drafts.value = await res.json()
    return res
  }

  /** Moves the viewer's reaction on `post` to `emoji` (or removes it) in the local counts. */
  function applyReaction(post: Post, emoji: string | null) {
    const old = post.my_reaction
    if (old) {
      post.reactions[old] = (post.reactions[old] ?? 1) - 1
      if (!post.reactions[old]) delete post.reactions[old]
    }
    if (emoji) post.reactions[emoji] = (post.reactions[emoji] ?? 0) + 1
    post.my_reaction = emoji
  }

  /** Updates the counts at once, and rolls back if the server says no. */
  async function react(post: Post, emoji: string | null): Promise<Response> {
    const old = post.my_reaction
    applyReaction(post, emoji)
    reactionVersion++
    reactionsInFlight++
    try {
      const res = await setReaction(post.id, emoji)
      if (!res.ok) applyReaction(post, old)
      return res
    } finally {
      reactionsInFlight--
    }
  }

  /** Clears a plant's update badge, on the server and in the cached garden. */
  async function markSeen(userId: number): Promise<void> {
    const res = await fetch(`/api/users/${userId}/seen`, { method: 'POST' })
    const plant = plants.value?.find((p) => p.id === userId)
    if (res.ok && plant) plant.unseen = false
  }

  /** Forgets everything, for a logout. */
  function clear() {
    plants.value = null
    posts.value = {}
    drafts.value = null
  }

  return {
    plants,
    posts,
    drafts,
    loadPlants,
    loadPosts,
    prefetchPosts,
    loadDrafts,
    react,
    markSeen,
    clear,
  }
})
