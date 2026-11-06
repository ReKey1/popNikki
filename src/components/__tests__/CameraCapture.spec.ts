import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { goBack } from '@/lib/navigation'
import CameraCapture from '../CameraCapture.vue'

vi.mock('@/lib/navigation', () => ({ goBack: vi.fn<() => void>() }))

const mountCamera = () => mount(CameraCapture, { global: { stubs: { RouterLink: true } } })

/** A fake camera stream whose tracks record being stopped. */
function fakeStream() {
  const track = { stop: vi.fn<() => void>() }
  return { track, stream: { getTracks: () => [track] } as unknown as MediaStream }
}

function stubCamera(impl: (constraints: MediaStreamConstraints) => Promise<MediaStream>) {
  const getUserMedia = vi.fn<typeof impl>(impl)
  vi.stubGlobal('navigator', { ...navigator, mediaDevices: { getUserMedia } })
  return getUserMedia
}

describe('CameraCapture', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('opens the back camera at its sharpest size and stops it on unmount', async () => {
    const { track, stream } = fakeStream()
    const getUserMedia = stubCamera(async () => stream)
    const wrapper = mountCamera()
    await flushPromises()

    expect(getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: 'environment', width: { ideal: 4096 }, height: { ideal: 4096 } },
      audio: false,
    })
    expect(wrapper.get('video').element.srcObject).toBe(stream)
    expect(wrapper.get('button[aria-label="Capture"]').attributes('disabled')).toBeUndefined()

    wrapper.unmount()
    expect(track.stop).toHaveBeenCalled()
  })

  it('flips to the front camera', async () => {
    const first = fakeStream()
    const getUserMedia = stubCamera(async () => first.stream)
    const wrapper = mountCamera()
    await flushPromises()

    await wrapper.get('button[aria-label="Flip camera"]').trigger('click')
    await flushPromises()
    expect(first.track.stop).toHaveBeenCalled()
    expect(getUserMedia).toHaveBeenLastCalledWith({
      video: expect.objectContaining({ facingMode: 'user' }),
      audio: false,
    })
  })

  it('emits a JPEG of the current frame', async () => {
    stubCamera(async () => fakeStream().stream)
    const photo = new Blob(['jpeg'], { type: 'image/jpeg' })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn<() => void>(),
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((done) => done(photo))
    const wrapper = mountCamera()
    await flushPromises()
    Object.defineProperty(wrapper.get('video').element, 'videoWidth', { value: 640 })
    Object.defineProperty(wrapper.get('video').element, 'videoHeight', { value: 480 })

    await wrapper.get('button[aria-label="Capture"]').trigger('click')
    expect(wrapper.emitted('picked')).toEqual([[photo]])
  })

  it("offers the phone's own camera, which still works without camera access", async () => {
    stubCamera(async () => {
      throw new DOMException('denied', 'NotAllowedError')
    })
    const wrapper = mountCamera()
    await flushPromises()

    expect(wrapper.text()).toContain('No camera here.')
    expect(wrapper.get('button[aria-label="Capture"]').attributes('disabled')).toBe('')

    const file = new File(['x'], 'leaf.jpg', { type: 'image/jpeg' })
    const input = wrapper.get('input[type="file"]')
    expect(input.attributes('capture')).toBe('environment')
    expect(input.attributes('accept')).toBe('image/*')
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')
    expect(wrapper.emitted('picked')).toEqual([[file]])
  })

  it('closes back to where it was opened from', async () => {
    stubCamera(async () => fakeStream().stream)
    const wrapper = mountCamera()
    await wrapper.get('[aria-label="Close"]').trigger('click')
    expect(goBack).toHaveBeenCalled()
  })
})
