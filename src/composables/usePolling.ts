import { useDocumentVisibility, useIntervalFn } from '@vueuse/core'
import { watch } from 'vue'

/** How often pages refresh their data. */
export const POLL_MS = 10_000

/**
 * Runs `fn` every `ms` while the page is visible, and once more as soon as it becomes
 * visible again, so a phone coming back from the lock screen catches up at once.
 */
export function usePolling(fn: () => unknown, ms = POLL_MS) {
  const visibility = useDocumentVisibility()
  const { pause, resume } = useIntervalFn(fn, ms, { immediate: visibility.value === 'visible' })
  watch(visibility, (state) => {
    if (state === 'visible') {
      fn()
      resume()
    } else {
      pause()
    }
  })
}
