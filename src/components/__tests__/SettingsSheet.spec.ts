import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { stubApi, stubDialog } from '@/__tests__/helpers'
import SettingsSheet from '../SettingsSheet.vue'

const button = (wrapper: VueWrapper, text: string) =>
  wrapper.findAll('button').find((b) => b.text() === text)

function mountSheet() {
  const wrapper = mount(SettingsSheet, {
    props: {
      username: 'nikki',
      open: false,
      'onUpdate:open': (value: boolean) => wrapper.setProps({ open: value }),
    },
    attachTo: document.body,
  })
  return wrapper
}

describe('SettingsSheet', () => {
  beforeAll(stubDialog)
  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('only shows the username field and Log out', async () => {
    const wrapper = mountSheet()
    await wrapper.setProps({ open: true })
    expect(wrapper.get('input').element.value).toBe('nikki')
    expect(wrapper.findAll('button').map((b) => b.text())).toEqual(['✕', 'SAVE', 'Log out'])
    // Nothing to save until the name changes.
    expect(button(wrapper, 'SAVE')!.attributes('disabled')).toBe('')
  })

  it('asks twice before changing the name', async () => {
    const fetch = stubApi({ '/api/me': Response.json({ id: 1, username: 'bloom' }) })
    const wrapper = mountSheet()
    await wrapper.setProps({ open: true })

    await wrapper.get('input').setValue('  bloom ')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.text()).toContain('Change your name to bloom?')
    expect(fetch).not.toHaveBeenCalled()

    await button(wrapper, 'Continue')!.trigger('click')
    expect(wrapper.text()).toContain('everyone in the garden will see bloom')
    expect(fetch).not.toHaveBeenCalled()

    await button(wrapper, 'Change name')!.trigger('click')
    await flushPromises()
    expect(fetch).toHaveBeenCalledWith('/api/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'bloom' }),
    })
    expect(wrapper.emitted('renamed')).toEqual([[{ id: 1, username: 'bloom' }]])
    expect(wrapper.props('open')).toBe(false)
  })

  it('goes back to the field on Cancel at either step', async () => {
    const fetch = stubApi({})
    const wrapper = mountSheet()
    await wrapper.setProps({ open: true })
    await wrapper.get('input').setValue('bloom')

    await wrapper.get('form').trigger('submit')
    await button(wrapper, 'Cancel')!.trigger('click')
    expect(wrapper.find('input').exists()).toBe(true)

    await wrapper.get('form').trigger('submit')
    await button(wrapper, 'Continue')!.trigger('click')
    await button(wrapper, 'Cancel')!.trigger('click')
    expect(wrapper.get('input').element.value).toBe('bloom')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('shows the server error, such as a taken name', async () => {
    stubApi({ '/api/me': Response.json({ error: 'That name is taken' }, { status: 409 }) })
    const wrapper = mountSheet()
    await wrapper.setProps({ open: true })
    await wrapper.get('input').setValue('bob')
    await wrapper.get('form').trigger('submit')
    await button(wrapper, 'Continue')!.trigger('click')
    await button(wrapper, 'Change name')!.trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toBe('That name is taken')
    expect(wrapper.find('input').exists()).toBe(true)
    expect(wrapper.emitted('renamed')).toBeUndefined()
  })

  it('logs out', async () => {
    const fetch = stubApi({ '/api/logout': new Response(null, { status: 204 }) })
    const wrapper = mountSheet()
    await wrapper.setProps({ open: true })
    await button(wrapper, 'Log out')!.trigger('click')
    await flushPromises()

    expect(fetch).toHaveBeenCalledWith('/api/logout', { method: 'POST' })
    expect(wrapper.emitted('loggedOut')).toHaveLength(1)
  })
})
