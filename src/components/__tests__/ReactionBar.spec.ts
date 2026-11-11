import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { REACTIONS } from '@/lib/reactions'
import ReactionBar from '../ReactionBar.vue'

describe('ReactionBar', () => {
  it('shows every reaction and marks the selected one', () => {
    const wrapper = mount(ReactionBar, { props: { selected: '💧' } })
    const buttons = wrapper.findAll('button')
    expect(buttons.map((b) => b.text())).toEqual(REACTIONS)
    expect(
      buttons.filter((b) => b.attributes('aria-pressed') === 'true').map((b) => b.text()),
    ).toEqual(['💧'])
  })

  it('emits the picked emoji, or null when the selected one is tapped again', async () => {
    const wrapper = mount(ReactionBar, { props: { selected: '💧' } })
    const button = (emoji: string) => wrapper.findAll('button').find((b) => b.text() === emoji)!

    await button('🔥').trigger('click')
    await button('💧').trigger('click')

    expect(wrapper.emitted('pick')).toEqual([['🔥'], [null]])
  })

  it('sends the picked emoji drifting up, until its animation ends', async () => {
    const wrapper = mount(ReactionBar, { props: { selected: '💧' } })
    const button = (emoji: string) => wrapper.findAll('button').find((b) => b.text() === emoji)!

    // Taking a reaction away sends nothing up.
    await button('💧').trigger('click')
    expect(wrapper.find('.bar__float').exists()).toBe(false)

    await button('🔥').trigger('click')
    expect(wrapper.findAll('.bar__float').map((f) => f.text())).toEqual(['🔥'])

    await wrapper.get('.bar__float').trigger('animationend')
    expect(wrapper.find('.bar__float').exists()).toBe(false)
  })
})
