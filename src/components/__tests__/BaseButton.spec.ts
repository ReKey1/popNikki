import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { testRouter } from '@/__tests__/helpers'
import BaseButton from '../BaseButton.vue'
import BaseFab from '../BaseFab.vue'
import BaseIconButton from '../BaseIconButton.vue'

describe('BaseButton', () => {
  it('renders a button with variant and size classes', () => {
    const wrapper = mount(BaseButton, {
      props: { variant: 'accent', size: 'sm', type: 'submit', disabled: true },
      slots: { default: 'HIT IT', trailing: '→' },
    })
    const button = wrapper.get('button')
    expect(button.attributes()).toMatchObject({ type: 'submit', disabled: '' })
    expect(button.classes()).toEqual(
      expect.arrayContaining(['btn--accent', 'btn--sm', 'btn--full', 'btn--split']),
    )
    expect(button.text()).toBe('HIT IT→')
  })

  it('renders a link when given a route', async () => {
    const router = testRouter()
    const wrapper = mount(BaseButton, {
      props: { to: '/new' },
      slots: { default: 'New' },
      global: { plugins: [router] },
    })
    await router.isReady()
    expect(wrapper.get('a').attributes('href')).toBe('/new')
    expect(wrapper.find('button').exists()).toBe(false)
  })
})

describe('BaseIconButton', () => {
  it('uses the label as its accessible name and hides the glyph', () => {
    const wrapper = mount(BaseIconButton, { props: { label: 'Settings' }, slots: { default: '⚙' } })
    expect(wrapper.get('button').attributes('aria-label')).toBe('Settings')
    expect(wrapper.get('span').attributes('aria-hidden')).toBe('true')
  })
})

describe('BaseFab', () => {
  it('links to its route with the default label', async () => {
    const router = testRouter()
    const wrapper = mount(BaseFab, { props: { to: '/new' }, global: { plugins: [router] } })
    await router.isReady()
    expect(wrapper.get('a').attributes('href')).toBe('/new')
    expect(wrapper.text()).toBe('+NEW NIKKI')
  })
})
