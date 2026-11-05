import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { stubApi } from '@/__tests__/helpers'
import NewPostView from '../NewPostView.vue'

const push = vi.fn<(to: string) => Promise<void>>()
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-router')>()),
  useRouter: () => ({ push }),
}))
vi.mock('@/lib/image', () => ({
  resizeToJpeg: async () => new Blob(['jpeg'], { type: 'image/jpeg' }),
}))

describe('NewPostView', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    push.mockReset()
  })

  it('previews the picked photo, uploads it and opens your plant', async () => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: () => 'blob:preview',
      revokeObjectURL: () => {},
    })
    const fetch = stubApi({
      '/api/posts': Response.json({ id: 5 }, { status: 201 }),
      '/api/me': Response.json({ id: 3, username: 'nikki' }),
    })
    const wrapper = mount(NewPostView, { global: { stubs: { RouterLink: true } } })
    const submit = wrapper.get('button[type="submit"]')
    expect(submit.attributes('disabled')).toBe('')

    const input = wrapper.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', {
      value: [new File(['x'], 'leaf.jpg', { type: 'image/jpeg' })],
    })
    await input.trigger('change')
    expect(wrapper.get('img').attributes('src')).toBe('blob:preview')
    expect(wrapper.text()).toContain('RETAKE')

    await wrapper.get('textarea').setValue('first leaf')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    const form = fetch.mock.calls[0]![1]!.body as FormData
    expect(form.get('description')).toBe('first leaf')
    expect(form.get('photo')).toBeInstanceOf(Blob)
    expect(push).toHaveBeenCalledWith('/plants/3')
  })
})
