import { StorageSerializers, useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'

import type { Me } from '@/lib/api'
import { useGardenStore } from './garden'

/**
 * Who is logged in. The server is asked once per visit, and its last answer is remembered on
 * the device so the next visit can draw at once. That copy is only for display: the session
 * itself is the HttpOnly cookie, which the server checks on every request.
 */
export const useSessionStore = defineStore('session', () => {
  const me = useLocalStorage<Me | null>('popnikki.me', null, {
    serializer: StorageSerializers.object,
  })
  let pending: Promise<Me | null> | null = null

  /** Takes the server's answer. Another member, or none, must not see the last one's garden. */
  function set(next: Me | null) {
    if (next?.id !== me.value?.id) useGardenStore().clear()
    me.value = next
  }

  /** Asks the server who the viewer is once; later calls get the same answer without a request. */
  function load(): Promise<Me | null> {
    pending ??= fetch('/api/me')
      .then(async (res) => {
        if (res.ok) set(await res.json())
        else if (res.status === 401) set(null)
        return me.value
      })
      .catch(() => {
        // Offline: keep what the device remembers, and ask again on the next navigation.
        pending = null
        return me.value
      })
    return pending
  }

  /** Forgets the viewer, so the next load asks the server again (after a claim or a logout). */
  function reset() {
    set(null)
    pending = null
  }

  return { me, load, reset }
})
