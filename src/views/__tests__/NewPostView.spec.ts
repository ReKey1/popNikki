import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubApi } from '@/__tests__/helpers'
import CameraCapture from '@/components/CameraCapture.vue'
import NewPostView from '../NewPostView.vue'

const push = vi.fn<(to: string) => Promise<void>>()
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-router')>()),
  useRouter: () => ({ push }),
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
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: () => 'blob:preview',
      revokeObjectURL: () => {},
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    push.mockReset()
  })

  it('starts on the camera', () => {
    const wrapper = mount(NewPostView, { global: { stubs: { CameraCapture: true } } })
    expect(wrapper.findComponent(CameraCapture).exists()).toBe(true)
    expect(wrapper.find('form').exists()).toBe(false)
  })

  it('uploads a draft and starts the practice', async () => {
    const fetch = stubApi({ '/api/posts': Response.json({ id: 5 }, { status: 201 }) })
    const wrapper = await mountWithPhoto()
    expect(wrapper.get('img').attributes('src')).toBe('blob:preview')
    expect(wrapper.text()).toContain('2:00 practice')

    await wrapper.get('textarea').setValue('first leaf')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    const form = fetch.mock.calls[0]![1]!.body as FormData
    expect(form.get('description')).toBe('first leaf')
    expect(form.get('photo')).toBeInstanceOf(Blob)
    expect(form.get('thumb')).toBeInstanceOf(Blob)
    expect(push).toHaveBeenCalledWith('/practice/5')
  })

  it('saves to drafts and opens your profile', async () => {
    stubApi({ '/api/posts': Response.json({ id: 5 }, { status: 201 }) })
    const wrapper = await mountWithPhoto()
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Save to drafts')!
      .trigger('click')
    await flushPromises()
    expect(push).toHaveBeenCalledWith('/me')
  })

  it('goes back to the camera on RETAKE', async () => {
    const wrapper = await mountWithPhoto()
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'RETAKE')!
      .trigger('click')
    expect(wrapper.findComponent(CameraCapture).exists()).toBe(true)
  })

  it('shows an upload error', async () => {
    stubApi({ '/api/posts': Response.json({ error: 'Upload is too large' }, { status: 413 }) })
    const wrapper = await mountWithPhoto()
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toBe('Upload is too large')
    expect(push).not.toHaveBeenCalled()
  })
})
