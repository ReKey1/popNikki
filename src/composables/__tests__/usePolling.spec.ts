import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import { POLL_MS, usePolling } from '../usePolling'

let visibility: DocumentVisibilityState = 'visible'

function setVisibility(state: DocumentVisibilityState) {
  visibility = state
  document.dispatchEvent(new Event('visibilitychange'))
}

function mountPolling() {
  const fn = vi.fn<() => void>()
  const wrapper = mount(
    defineComponent({
      setup() {
        usePolling(fn)
        return () => null
      },
    }),
  )
  return { fn, wrapper }
}

describe('usePolling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    visibility = 'visible'
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('runs on every interval while the page is visible', () => {
    const { fn } = mountPolling()
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(POLL_MS)
    expect(fn).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(POLL_MS)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('pauses while hidden and catches up as soon as the page is visible again', async () => {
    const { fn } = mountPolling()
    setVisibility('hidden')
    await vi.advanceTimersByTimeAsync(3 * POLL_MS)
    expect(fn).not.toHaveBeenCalled()

    setVisibility('visible')
    await vi.advanceTimersByTimeAsync(0)
    expect(fn).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(POLL_MS)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('stops when the component is gone', () => {
    const { fn, wrapper } = mountPolling()
    wrapper.unmount()
    vi.advanceTimersByTime(3 * POLL_MS)
    expect(fn).not.toHaveBeenCalled()
  })
})
