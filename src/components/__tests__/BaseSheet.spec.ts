import { mount } from '@vue/test-utils'
import { beforeAll, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { stubDialog } from '@/__tests__/helpers'
import BaseSheet from '../BaseSheet.vue'

describe('BaseSheet', () => {
  beforeAll(stubDialog)

  function mountSheet(open: boolean, draggable = false) {
    const wrapper = mount(BaseSheet, {
      props: {
        title: 'SETTINGS',
        open,
        draggable,
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

  it('shows no drag grip unless it can be dragged', () => {
    const plain = mountSheet(true)
    expect(plain.find('.sheet__grip').exists()).toBe(false)
    expect(plain.get('dialog').attributes('data-snap')).toBeUndefined()
    expect(plain.get('.sheet__content').text()).toBe('Body')
    plain.unmount()

    const draggable = mountSheet(true, true)
    expect(draggable.find('.sheet__grip').exists()).toBe(true)
    draggable.unmount()
  })

  describe('dragging', () => {
    beforeAll(() => {
      // jsdom has no pointer capture.
      HTMLElement.prototype.setPointerCapture = () => {}
      HTMLElement.prototype.releasePointerCapture = () => {}
    })

    // usePointerSwipe only reads the mouse fields. Its listeners attach a tick after mounting.
    async function pointer(
      wrapper: ReturnType<typeof mountSheet>,
      type: string,
      y: number,
      buttons = 1,
    ) {
      await nextTick()
      const event = new MouseEvent(type, { clientX: 0, clientY: y, buttons, bubbles: true })
      wrapper.get('.sheet__handle').element.dispatchEvent(event)
      await nextTick()
    }

    async function drag(wrapper: ReturnType<typeof mountSheet>, dy: number) {
      await pointer(wrapper, 'pointerdown', 400)
      await pointer(wrapper, 'pointermove', 400 + dy)
      await pointer(wrapper, 'pointerup', 400 + dy, 0)
    }

    it('grows to full height when dragged up and back to half when dragged down', async () => {
      const wrapper = mountSheet(true, true)
      const dialog = wrapper.get('dialog')
      expect(dialog.attributes('data-snap')).toBe('half')

      await drag(wrapper, -120)
      expect(dialog.attributes('data-snap')).toBe('full')
      expect(dialog.attributes('style')).toBeUndefined()

      await drag(wrapper, 120)
      expect(dialog.attributes('data-snap')).toBe('half')
      expect(wrapper.props('open')).toBe(true)
      wrapper.unmount()
    })

    it('follows the finger while dragging', async () => {
      const wrapper = mountSheet(true, true)
      await pointer(wrapper, 'pointerdown', 400)
      await pointer(wrapper, 'pointermove', 300)
      // jsdom lays nothing out, so the sheet starts at 0px and grows by the 100px dragged.
      expect(wrapper.get('dialog').attributes('style')).toContain('height: 100px')
      wrapper.unmount()
    })

    it('closes when dragged down from half height', async () => {
      const wrapper = mountSheet(true, true)
      await drag(wrapper, 120)
      expect(wrapper.props('open')).toBe(false)
      expect(wrapper.get('dialog').attributes('open')).toBeUndefined()
      wrapper.unmount()
    })

    it('opens at half height again after being closed full', async () => {
      const wrapper = mountSheet(true, true)
      await drag(wrapper, -120)
      await wrapper.setProps({ open: false })
      await wrapper.setProps({ open: true })
      expect(wrapper.get('dialog').attributes('data-snap')).toBe('half')
      wrapper.unmount()
    })

    it('ignores drags on a sheet that is not draggable', async () => {
      const wrapper = mountSheet(true)
      await drag(wrapper, 120)
      expect(wrapper.props('open')).toBe(true)
      wrapper.unmount()
    })
  })
})
