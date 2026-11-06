import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubApi, testPinia } from '@/__tests__/helpers'
import CameraCapture from '@/components/CameraCapture.vue'
import { usePendingPostStore } from '@/stores/pendingPost'
import NewPostView from '../NewPostView.vue'

const replace = vi.fn<(to: string) => Promise<void>>()
const back = vi.fn<() => void>()
/** The history entry before the upload page. */
const state = { back: null as string | null }
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-router')>()),
  useRouter: () => ({ replace, back, options: { history: { state } } }),
}))
vi.mock('@/lib/image', () => ({
  resizeToJpeg: async () => new Blob(['jpeg'], { type: 'image/jpeg' }),
}))

async function mountWithPhoto() {
  const wrapper = mount(NewPostView, {
    global: { stubs: { RouterLink: true, CameraCapture: true } },
  })
  wrapper.findComponent(CameraCapture).vm.$emit('picked', new Blob(['x'], { type: 'image/jpeg' }))
  await flushPromises()
  return wrapper
}

describe('NewPostView', () => {
  beforeEach(() => {
    testPinia()
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: () => 'blob:preview',
      revokeObjectURL: () => {},
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    replace.mockReset()
    back.mockReset()
    state.back = null
  })

  it('starts on the camera', () => {
    const wrapper = mount(NewPostView, { global: { stubs: { CameraCapture: true } } })
    expect(wrapper.findComponent(CameraCapture).exists()).toBe(true)
    expect(wrapper.find('form').exists()).toBe(false)
  })

  it('opens the practice at once and uploads in the background', async () => {
    const fetch = stubApi({ '/api/posts': Response.json({ id: 5 }, { status: 201 }) })
    const wrapper = await mountWithPhoto()
    expect(wrapper.get('img').attributes('src')).toBe('blob:preview')
    expect(wrapper.text()).toContain('2:00 practice')

    await wrapper.get('textarea').setValue('first leaf')
    await wrapper.get('form').trigger('submit')
    // The practice takes the upload page's place in the history.
    expect(replace).toHaveBeenCalledWith('/practice')
    expect(await usePendingPostStore().upload).toBe(5)

    const form = fetch.mock.calls[0]![1]!.body as FormData
    expect(form.get('description')).toBe('first leaf')
    expect(form.get('photo')).toBeInstanceOf(Blob)
    expect(form.get('thumb')).toBeInstanceOf(Blob)
  })

  const saveDraft = async () => {
    stubApi({ '/api/posts': Response.json({ id: 5 }, { status: 201 }) })
    const wrapper = await mountWithPhoto()
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Save to drafts')!
      .trigger('click')
    await flushPromises()
  }

  it('saves to drafts and opens your profile in place of the upload page', async () => {
    await saveDraft()
    expect(replace).toHaveBeenCalledWith('/me')
    expect(back).not.toHaveBeenCalled()
  })

  it('saves to drafts and goes back when it was opened from your profile', async () => {
    state.back = '/me'
    await saveDraft()
    expect(back).toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
  })

  it('goes back to the camera on RETAKE', async () => {
    const wrapper = await mountWithPhoto()
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'RETAKE')!
      .trigger('click')
    expect(wrapper.findComponent(CameraCapture).exists()).toBe(true)
  })

  it('shows an error when saving to drafts fails', async () => {
    stubApi({ '/api/posts': Response.json({ error: 'Upload is too large' }, { status: 413 }) })
    const wrapper = await mountWithPhoto()
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Save to drafts')!
      .trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toBe('Upload is too large')
    expect(replace).not.toHaveBeenCalled()
  })
})
