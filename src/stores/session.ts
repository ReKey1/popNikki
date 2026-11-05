import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { Me } from '@/lib/api'

/** Who is logged in. Asked of the server once per visit, then shared by every page. */
export const useSessionStore = defineStore('session', () => {
  const me = ref<Me | null>(null)
  let pending: Promise<Me | null> | null = null

  /** Loads the viewer once; later calls get the same answer without a request. */
  function load(): Promise<Me | null> {
    pending ??= fetch('/api/me')
      .then(async (res) => (me.value = res.ok ? await res.json() : null))
      .catch(() => {
        // Offline: ask again on the next navigation.
        pending = null
        return (me.value = null)
      })
    return pending
  }

  /** Forgets the viewer, so the next load asks the server again (after a claim or a logout). */
  function reset() {
    me.value = null
    pending = null
  }

  return { me, load, reset }
})
