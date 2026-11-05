import { mount } from '@vue/test-utils'
import { beforeAll, describe, expect, it } from 'vitest'

import { stubDialog } from '@/__tests__/helpers'
import BaseSheet from '../BaseSheet.vue'

describe('BaseSheet', () => {
  beforeAll(stubDialog)

  function mountSheet(open: boolean) {
    const wrapper = mount(BaseSheet, {
      props: {
        title: 'SETTINGS',
        open,
        'onUpdate:open': (value: boolean) => wrapper.setProps({ open: value }),
      },
      slots: { default: '<p>Body</p>' },
      attachTo: document.body,
    })
    return wrapper
  }

  it('opens and closes the dialog with v-model:open', async () => {
    const wrapper = mountSheet(false)
    const dialog = wrapper.get('dialog')
    expect(dialog.attributes('open')).toBeUndefined()

    await wrapper.setProps({ open: true })
    expect(dialog.attributes('open')).toBe('')
    expect(dialog.text()).toContain('SETTINGS')
    expect(dialog.text()).toContain('Body')

    await wrapper.get('button[aria-label="Close"]').trigger('click')
    expect(wrapper.props('open')).toBe(false)
    expect(dialog.attributes('open')).toBeUndefined()
    wrapper.unmount()
  })

  it('closes on a backdrop click but not on a click inside', async () => {
    const wrapper = mountSheet(true)
    await wrapper.get('p').trigger('click')
    expect(wrapper.props('open')).toBe(true)

    await wrapper.get('dialog').trigger('click')
    expect(wrapper.props('open')).toBe(false)
    wrapper.unmount()
  })
})
