import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubApi, testPinia } from '@/__tests__/helpers'
import { leaveStep } from '@/lib/navigation'
import { useGardenStore } from '@/stores/garden'
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
const clock = (wrapper: VueWrapper) => wrapper.get('[role="timer"]').text()

const roll = (seconds = 120, title = 'Pop That Lock') => ({ seconds, track: { id: 2, title } })
/** The roulette has already been spun: the page opens on its result. */
const rolled = (seconds = 120, title = 'Pop That Lock') =>
  Response.json({ roll: roll(seconds, title) })
const notRolled = () => Response.json({ roll: null })
/** Long enough for the roulette to slow down and land. */
const SPIN_MS = 3000

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

  describe('roulette', () => {
    it('waits for a spin in as few words as it can, giving nothing away', async () => {
      stubApi({ '/api/roll': notRolled() })
      const wrapper = mountPractice()
      await flushPromises()

      expect(playButton(wrapper).text()).toBe('SPIN')
      expect(clock(wrapper)).toBe('?:??')
      expect(wrapper.get('.deck').text()).toBe('ROULETTE???SPIN')
      expect(wrapper.get('audio').attributes('src')).toBeUndefined()
    })

    it('spins, hides the result while it turns, then lands on the time and song', async () => {
      const fetch = stubApi({
        'GET /api/roll': notRolled(),
        'POST /api/roll': Response.json({ roll: roll(90, 'Get Off') }),
      })
      const wrapper = mountPractice()
      await flushPromises()

      await playButton(wrapper).trigger('click')
      await vi.advanceTimersByTimeAsync(300)
      expect(fetch).toHaveBeenCalledWith('/api/roll', { method: 'POST' })
      expect(playButton(wrapper).attributes('disabled')).toBeDefined()
      expect(wrapper.find('.ring--spinning').exists()).toBe(true)
      expect(clock(wrapper)).toMatch(/^\d:\d\d$/)
      expect(wrapper.text()).not.toContain('Get Off')
      // The song is already loading.
      expect(wrapper.get('audio').attributes('src')).toBe('/api/tracks/2/audio')

      await vi.advanceTimersByTimeAsync(SPIN_MS)
      expect(clock(wrapper)).toBe('1:30')
      expect(wrapper.text()).toContain('UP NEXT')
      expect(wrapper.text()).toContain('Get Off')
      expect(wrapper.find('.ring--landed').exists()).toBe(true)
      expect(playButton(wrapper).text()).toBe('START')
      expect(play).not.toHaveBeenCalled()
    })

    it('keeps spinning until the server answers', async () => {
      let answer!: (res: Response) => void
      const fetch = stubApi({ 'GET /api/roll': notRolled() })
      const wrapper = mountPractice()
      await flushPromises()
      fetch.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)))

      await playButton(wrapper).trigger('click')
      await vi.advanceTimersByTimeAsync(10_000)
      expect(wrapper.find('.ring--spinning').exists()).toBe(true)

      answer(Response.json({ roll: roll(30) }))
      await vi.advanceTimersByTimeAsync(SPIN_MS)
      expect(clock(wrapper)).toBe('0:30')
    })

    it('shows every result the same plain way, long or short', async () => {
      stubApi({ '/api/roll': rolled(180, 'Get Off') })
      const long = mountPractice()
      await flushPromises()
      expect(long.get('.stage').text()).toBe('3:00UNTIL YOUR NIKKI DROPSQUIT = SAVED TO DRAFTS')
      expect(long.get('.deck').text()).toBe('UP NEXTGet OffSTART')

      stubApi({ '/api/roll': rolled(30, 'Get Off') })
      const short = mountPractice()
      await flushPromises()
      expect(short.get('.stage').text()).toBe('0:30UNTIL YOUR NIKKI DROPSQUIT = SAVED TO DRAFTS')
      expect(short.get('.deck').text()).toBe('UP NEXTGet OffSTART')
    })

    it('opens on the roll the member already has, with nothing to spin', async () => {
      const fetch = stubApi({ '/api/roll': rolled(150, 'Get Off') })
      const wrapper = mountPractice()
      await flushPromises()

      expect(clock(wrapper)).toBe('2:30')
      expect(wrapper.text()).toContain('UP NEXT')
      expect(wrapper.text()).toContain('Get Off')
      expect(wrapper.get('audio').attributes('src')).toBe('/api/tracks/2/audio')
      expect(playButton(wrapper).text()).toBe('START')
      expect(wrapper.find('.ring--landed').exists()).toBe(false)
      expect(fetch).not.toHaveBeenCalledWith('/api/roll', { method: 'POST' })
    })

    it('shows why a spin failed and lets the member spin again', async () => {
      stubApi({
        'GET /api/roll': notRolled(),
        'POST /api/roll': Response.json({ error: 'Down for a moment' }, { status: 500 }),
      })
      const wrapper = mountPractice()
      await flushPromises()
      await playButton(wrapper).trigger('click')
      await vi.advanceTimersByTimeAsync(SPIN_MS)

      expect(wrapper.get('[role="alert"]').text()).toBe('Down for a moment')
      expect(playButton(wrapper).text()).toBe('SPIN')
    })

    it('posts at once on a roll of zero seconds', async () => {
      const fetch = stubApi({
        '/api/roll': rolled(0),
        '/api/posts/5/start': Response.json({ published: true }),
      })
      const wrapper = mountPractice()
      await flushPromises()
      expect(clock(wrapper)).toBe('0:00')
      expect(playButton(wrapper).text()).toBe('POST')

      await playButton(wrapper).trigger('click')
      await flushPromises()
      expect(fetch).toHaveBeenCalledWith('/api/posts/5/start', { method: 'POST' })
      expect(wrapper.get('h1').text()).toBe('POSTED')
      expect(play).not.toHaveBeenCalled()
    })

    it('has nothing to spin for when the playlist is empty, and posts at once', async () => {
      stubApi({
        'GET /api/roll': notRolled(),
        'POST /api/roll': Response.json({ roll: null }),
        '/api/posts/5/start': Response.json({ published: true }),
      })
      const wrapper = mountPractice()
      await flushPromises()
      await playButton(wrapper).trigger('click')
      await vi.advanceTimersByTimeAsync(SPIN_MS)
      expect(wrapper.text()).toContain('Press start and dance')
      expect(playButton(wrapper).text()).toBe('START')

      await playButton(wrapper).trigger('click')
      await flushPromises()
      expect(wrapper.get('h1').text()).toBe('POSTED')
      expect(play).not.toHaveBeenCalled()
    })
  })

  it('plays the song for the rolled time, then publishes', async () => {
    const fetch = stubApi({
      '/api/roll': rolled(90),
      '/api/posts/5/start': Response.json(roll(90)),
      '/api/posts/5/publish': new Response(null, { status: 204 }),
    })
    const wrapper = mountPractice()
    await flushPromises()

    await playButton(wrapper).trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('NOW PLAYING')
    expect(wrapper.text()).toContain('Pop That Lock')
    expect(play).toHaveBeenCalled()
    expect(playButton(wrapper).text()).toBe('PAUSE')

    await vi.advanceTimersByTimeAsync(60_000)
    expect(clock(wrapper)).toBe('0:30')
    expect(fetch).not.toHaveBeenCalledWith('/api/posts/5/publish', expect.anything())

    await vi.advanceTimersByTimeAsync(30_000)
    await flushPromises()
    expect(fetch).toHaveBeenCalledWith('/api/posts/5/publish', { method: 'POST' })
    expect(wrapper.get('h1').text()).toBe('POSTED')
  })

  it('dances to the roll the server starts, should it differ from the one on screen', async () => {
    stubApi({
      '/api/roll': rolled(90),
      '/api/posts/5/start': Response.json({ seconds: 180, track: { id: 7, title: 'Get Off' } }),
    })
    const wrapper = mountPractice()
    await flushPromises()
    await playButton(wrapper).trigger('click')
    await flushPromises()

    expect(clock(wrapper)).toBe('3:00')
    expect(wrapper.text()).toContain('Get Off')
    expect(wrapper.get('audio').attributes('src')).toBe('/api/tracks/7/audio')
  })

  it('brings the garden up to date once the nikki is posted', async () => {
    const fetch = stubApi({
      '/api/roll': rolled(0),
      '/api/posts/5/start': Response.json({ published: true }),
    })
    const garden = useGardenStore()
    garden.drafts = [
      { id: 5, description: '', created_at: 1 },
      { id: 6, description: '', created_at: 2 },
    ]
    const wrapper = mountPractice()
    await flushPromises()
    await playButton(wrapper).trigger('click')
    await flushPromises()

    expect(garden.drafts.map((d) => d.id)).toEqual([6])
    expect(fetch).toHaveBeenCalledWith('/api/plants')
  })

  it('pauses when the page is hidden and resumes on tap', async () => {
    stubApi({ '/api/roll': rolled(), '/api/posts/5/start': Response.json(roll()) })
    const wrapper = mountPractice()
    await flushPromises()
    await playButton(wrapper).trigger('click')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(10_000)

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    await flushPromises()
    expect(pause).toHaveBeenCalled()
    expect(playButton(wrapper).text()).toBe('RESUME')

    await vi.advanceTimersByTimeAsync(30_000)
    expect(clock(wrapper)).toBe('1:50')

    await playButton(wrapper).trigger('click')
    await flushPromises()
    expect(playButton(wrapper).text()).toBe('PAUSE')
    expect(play).toHaveBeenCalledTimes(2)
  })

  it('retries once when the server says to keep dancing', async () => {
    const fetch = stubApi({
      '/api/roll': rolled(),
      '/api/posts/5/start': Response.json(roll()),
      '/api/posts/5/publish': Response.json(
        { error: 'Keep dancing', retry_after: 2 },
        { status: 409 },
      ),
    })
    const wrapper = mountPractice()
    await flushPromises()
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
        '/api/roll': rolled(),
        '/api/posts/5/start': Response.json(roll()),
        '/api/posts/5/publish': new Response(null, { status: 204 }),
      })
      const wrapper = mountPractice()
      await flushPromises()
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
      stubApi({ '/api/roll': rolled(), '/api/posts/5/start': Response.json(roll()) })
      const wrapper = mountPractice()
      await flushPromises()
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
    stubApi({ '/api/roll': rolled() })
    const wrapper = mountPractice()
    await flushPromises()
    await playButton(wrapper).trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    expect(playButton(wrapper).text()).toBe('START')
  })

  it('leaves without keeping the timer in the history', async () => {
    stubApi({ '/api/roll': rolled(0), '/api/posts/5/start': Response.json({ published: true }) })
    const wrapper = mountPractice()
    await flushPromises()
    await wrapper.get('[aria-label="Quit"]').trigger('click')
    expect(leaveStep).toHaveBeenLastCalledWith(router, '/me')

    await playButton(wrapper).trigger('click')
    await flushPromises()
    const done = wrapper.findAll('.done button')
    await done.find((b) => b.text().startsWith('SEE THE GARDEN'))!.trigger('click')
    expect(leaveStep).toHaveBeenLastCalledWith(router, '/')
    await done.find((b) => b.text() === 'My garden')!.trigger('click')
    expect(leaveStep).toHaveBeenLastCalledWith(router, '/me')
  })

  describe('while the photo uploads', () => {
    it('spins meanwhile, then waits for the upload before the start', async () => {
      stubApi({
        'GET /api/roll': notRolled(),
        'POST /api/roll': Response.json({ roll: roll() }),
        '/api/posts/7/start': Response.json(roll()),
      })
      let finish!: (id: number) => void
      usePendingPostStore().upload = new Promise((resolve) => (finish = resolve))
      const wrapper = mountPractice({})
      await flushPromises()
      expect(playButton(wrapper).text()).toBe('SPIN')

      await playButton(wrapper).trigger('click')
      await vi.advanceTimersByTimeAsync(SPIN_MS)
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
      stubApi({ '/api/roll': rolled() })
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
