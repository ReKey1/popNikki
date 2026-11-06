import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubApi, testPinia } from '@/__tests__/helpers'
import { leaveStep } from '@/lib/navigation'
import { usePendingPostStore } from '@/stores/pendingPost'
import PracticeView from '../PracticeView.vue'

vi.mock('@/lib/navigation', () => ({ leaveStep: vi.fn<() => Promise<void>>() }))
const router = { replace: vi.fn<(to: string) => Promise<void>>() }
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-router')>()),
  useRouter: () => router,
}))

const mountPractice = (props: { id?: string } = { id: '5' }) =>
  mount(PracticeView, { props, global: { stubs: { RouterLink: true } } })

const playButton = (wrapper: VueWrapper) => wrapper.get('.deck__btn')

describe('PracticeView', () => {
  let play: ReturnType<typeof vi.spyOn>
  let pause: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    testPinia()
    router.replace.mockReset()
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

    expect(fetch).toHaveBeenCalledWith(
      '/api/posts/5/start',
      expect.objectContaining({ method: 'POST' }),
    )
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

  describe('with Web Audio', () => {
    /** A stand-in AudioContext whose gain records each scheduled volume change. */
    function stubAudioContext() {
      const ramps: [number, number][] = []
      const gain = {
        value: 1,
        cancelScheduledValues: vi.fn<() => void>(),
        setValueAtTime: vi.fn<(value: number) => void>(),
        linearRampToValueAtTime: (value: number, time: number) => ramps.push([value, time]),
      }
      const node = { gain, connect: (next: unknown) => next }
      class FakeAudioContext {
        currentTime = 10
        destination = {}
        resume = vi.fn<() => Promise<void>>().mockResolvedValue()
        close = vi.fn<() => Promise<void>>().mockResolvedValue()
        createGain = () => node
        createMediaElementSource = () => ({ connect: () => node })
      }
      vi.stubGlobal('AudioContext', FakeAudioContext)
      return { gain, ramps }
    }

    it('fades in on start and fades out to silence as the timer ends', async () => {
      const { gain, ramps } = stubAudioContext()
      stubApi({
        '/api/posts/5/start': Response.json({ track: { id: 2, title: 'beat' } }),
        '/api/posts/5/publish': new Response(null, { status: 204 }),
      })
      const wrapper = mountPractice()
      await playButton(wrapper).trigger('click')
      await flushPromises()
      expect(gain.setValueAtTime).toHaveBeenLastCalledWith(0, 10)
      expect(ramps).toEqual([[1, 11.5]])

      await vi.advanceTimersByTimeAsync(116_000)
      expect(ramps).toHaveLength(1)
      await vi.advanceTimersByTimeAsync(1_000)
      expect(ramps).toHaveLength(2)
      const [volume, end] = ramps[1]!
      expect(volume).toBe(0)
      expect(end - 10).toBeCloseTo(3, 0)

      await vi.advanceTimersByTimeAsync(3_000)
      await flushPromises()
      expect(pause).toHaveBeenCalled()
      expect(wrapper.get('h1').text()).toBe('POSTED')
    })

    it('fades in again on resume', async () => {
      const { ramps } = stubAudioContext()
      stubApi({ '/api/posts/5/start': Response.json({ track: { id: 2, title: 'beat' } }) })
      const wrapper = mountPractice()
      await playButton(wrapper).trigger('click')
      await flushPromises()
      await playButton(wrapper).trigger('click')
      expect(playButton(wrapper).text()).toBe('RESUME')

      await playButton(wrapper).trigger('click')
      await flushPromises()
      expect(ramps).toEqual([
        [1, 11.5],
        [1, 11.5],
      ])
    })
  })

  it('shows an error when the draft is gone', async () => {
    stubApi({})
    const wrapper = mountPractice()
    await playButton(wrapper).trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    expect(playButton(wrapper).text()).toBe('START')
  })

  it('leaves without keeping the timer in the history', async () => {
    const wrapper = mountPractice()
    await wrapper.get('[aria-label="Quit"]').trigger('click')
    expect(leaveStep).toHaveBeenLastCalledWith(router, '/me')

    stubApi({ '/api/posts/5/start': Response.json({ published: true }) })
    await playButton(wrapper).trigger('click')
    await flushPromises()
    const done = wrapper.findAll('.done button')
    await done.find((b) => b.text().startsWith('SEE THE GARDEN'))!.trigger('click')
    expect(leaveStep).toHaveBeenLastCalledWith(router, '/')
    await done.find((b) => b.text() === 'My garden')!.trigger('click')
    expect(leaveStep).toHaveBeenLastCalledWith(router, '/me')
  })

  it('loads the song before START and plays that one', async () => {
    const fetch = stubApi({
      '/api/tracks/next': Response.json({ track: { id: 3, title: 'Get Off' } }),
      '/api/posts/5/start': Response.json({ track: { id: 3, title: 'Get Off' } }),
    })
    const wrapper = mountPractice()
    await flushPromises()
    expect(wrapper.get('audio').attributes('src')).toBe('/api/tracks/3/audio')
    expect(wrapper.text()).toContain('UP NEXT')
    expect(wrapper.text()).toContain('Get Off')
    expect(play).not.toHaveBeenCalled()

    await playButton(wrapper).trigger('click')
    await flushPromises()
    const [, init] = fetch.mock.calls.find(([url]) => url === '/api/posts/5/start')!
    expect(JSON.parse(init!.body as string)).toEqual({ track_id: 3 })
    expect(wrapper.text()).toContain('NOW PLAYING')
    expect(play).toHaveBeenCalled()
  })

  describe('while the photo uploads', () => {
    it('waits for the upload, then takes the post address', async () => {
      stubApi({ '/api/posts/7/start': Response.json({ track: { id: 2, title: 'beat' } }) })
      let finish!: (id: number) => void
      usePendingPostStore().upload = new Promise((resolve) => (finish = resolve))
      const wrapper = mountPractice({})
      await flushPromises()
      expect(playButton(wrapper).text()).toBe('UPLOADING…')
      expect(playButton(wrapper).attributes('disabled')).toBeDefined()

      finish(7)
      await flushPromises()
      expect(router.replace).toHaveBeenCalledWith('/practice/7')
      expect(usePendingPostStore().upload).toBeNull()
      expect(playButton(wrapper).text()).toBe('START')

      await playButton(wrapper).trigger('click')
      await flushPromises()
      expect(playButton(wrapper).text()).toBe('PAUSE')
    })

    it('shows the error and retries the same photo', async () => {
      const pending = usePendingPostStore()
      pending.upload = Promise.reject(new Error('Upload is too large'))
      const again = vi.spyOn(pending, 'again').mockReturnValue(Promise.resolve(8))
      const wrapper = mountPractice({})
      await flushPromises()
      expect(wrapper.get('[role="alert"]').text()).toBe('Upload is too large')
      expect(playButton(wrapper).text()).toBe('RETRY')

      await playButton(wrapper).trigger('click')
      await flushPromises()
      expect(again).toHaveBeenCalled()
      expect(router.replace).toHaveBeenCalledWith('/practice/8')
      expect(playButton(wrapper).text()).toBe('START')
    })

    it('goes to your drafts when there is no upload', async () => {
      stubApi({})
      mountPractice({})
      await flushPromises()
      expect(leaveStep).toHaveBeenLastCalledWith(router, '/me')
    })
  })
})
