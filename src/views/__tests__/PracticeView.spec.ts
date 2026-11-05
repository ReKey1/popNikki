import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubApi } from '@/__tests__/helpers'
import PracticeView from '../PracticeView.vue'

const mountPractice = () =>
  mount(PracticeView, { props: { id: '5' }, global: { stubs: { RouterLink: true } } })

const playButton = (wrapper: VueWrapper) => wrapper.get('.deck__btn')

describe('PracticeView', () => {
  let play: ReturnType<typeof vi.spyOn>
  let pause: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers()
    play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('publishes at once when there is no track', async () => {
    const fetch = stubApi({ '/api/posts/5/start': Response.json({ published: true }) })
    const wrapper = mountPractice()
    await playButton(wrapper).trigger('click')
    await flushPromises()

    expect(fetch).toHaveBeenCalledWith('/api/posts/5/start', { method: 'POST' })
    expect(wrapper.get('h1').text()).toBe('POSTED')
    expect(play).not.toHaveBeenCalled()
  })

  it('plays the track for two minutes, then publishes', async () => {
    const fetch = stubApi({
      '/api/posts/5/start': Response.json({ track: { id: 2, title: 'Pop That Lock' } }),
      '/api/posts/5/publish': new Response(null, { status: 204 }),
    })
    const wrapper = mountPractice()
    expect(playButton(wrapper).text()).toBe('START')

    await playButton(wrapper).trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('NOW PLAYING')
    expect(wrapper.text()).toContain('Pop That Lock')
    expect(wrapper.get('audio').attributes('src')).toBe('/api/tracks/2/audio')
    expect(play).toHaveBeenCalled()
    expect(playButton(wrapper).text()).toBe('PAUSE')

    await vi.advanceTimersByTimeAsync(60_000)
    expect(wrapper.get('[role="timer"]').text()).toBe('1:00')
    expect(fetch).not.toHaveBeenCalledWith('/api/posts/5/publish', expect.anything())

    await vi.advanceTimersByTimeAsync(60_000)
    await flushPromises()
    expect(fetch).toHaveBeenCalledWith('/api/posts/5/publish', { method: 'POST' })
    expect(wrapper.get('h1').text()).toBe('POSTED')
  })

  it('pauses when the page is hidden and resumes on tap', async () => {
    stubApi({ '/api/posts/5/start': Response.json({ track: { id: 2, title: 'beat' } }) })
    const wrapper = mountPractice()
    await playButton(wrapper).trigger('click')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(10_000)

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    await flushPromises()
    expect(pause).toHaveBeenCalled()
    expect(playButton(wrapper).text()).toBe('RESUME')

    await vi.advanceTimersByTimeAsync(30_000)
    expect(wrapper.get('[role="timer"]').text()).toBe('1:50')

    await playButton(wrapper).trigger('click')
    await flushPromises()
    expect(playButton(wrapper).text()).toBe('PAUSE')
    expect(play).toHaveBeenCalledTimes(2)
  })

  it('retries once when the server says to keep dancing', async () => {
    const fetch = stubApi({
      '/api/posts/5/start': Response.json({ track: { id: 2, title: 'beat' } }),
      '/api/posts/5/publish': Response.json(
        { error: 'Keep dancing', retry_after: 2 },
        { status: 409 },
      ),
    })
    const wrapper = mountPractice()
    await playButton(wrapper).trigger('click')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(wrapper.text()).toContain('Posting…')

    await vi.advanceTimersByTimeAsync(2_000)
    await flushPromises()
    const publishes = fetch.mock.calls.filter(([url]) => url === '/api/posts/5/publish')
    expect(publishes).toHaveLength(2)
    expect(wrapper.get('[role="alert"]').text()).toBe('Keep dancing')
  })

  it('shows an error when the draft is gone', async () => {
    stubApi({})
    const wrapper = mountPractice()
    await playButton(wrapper).trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    expect(playButton(wrapper).text()).toBe('START')
  })
})
