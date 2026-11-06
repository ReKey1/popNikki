import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

import { createPost } from '@/lib/api'

/**
 * The post being uploaded while its practice page opens. It lives here so the upload carries on
 * from the upload page to the practice page, and can be tried again if it fails.
 */
export const usePendingPostStore = defineStore('pendingPost', () => {
  /** The upload in progress (or finished), resolving to the new post's id. */
  const upload = shallowRef<Promise<number> | null>(null)
  let retry: (() => Promise<number>) | null = null

  /** Starts uploading in the background. */
  function start(photo: Blob, description: string): Promise<number> {
    retry = () => (upload.value = createPost(photo, description))
    return retry()
  }

  /** Sends the same photo again after a failure. Null when there is nothing to send. */
  function again(): Promise<number> | null {
    return retry?.() ?? null
  }

  /** Forgets the upload once the practice has its post. */
  function clear() {
    upload.value = null
    retry = null
  }

  return { upload, start, again, clear }
})
