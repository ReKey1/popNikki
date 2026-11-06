import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { testRouter } from '@/__tests__/helpers'

import BaseAvatar from '../BaseAvatar.vue'
import BaseInfoNote from '../BaseInfoNote.vue'
import BasePhoto from '../BasePhoto.vue'
import BasePill from '../BasePill.vue'
import BaseSeal from '../BaseSeal.vue'
import BaseSectionRule from '../BaseSectionRule.vue'
import BaseSticker from '../BaseSticker.vue'
import BaseWordmark from '../BaseWordmark.vue'
import HistoryRow from '../HistoryRow.vue'
import TimerRing from '../TimerRing.vue'

describe('BasePhoto', () => {
  it('shows the striped placeholder with its label until it has a source', async () => {
    const wrapper = mount(BasePhoto, { props: { label: 'plant photo' } })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toBe('plant photo')

    await wrapper.setProps({ src: '/p.jpg', alt: 'My plant' })
    expect(wrapper.get('img').attributes()).toMatchObject({ src: '/p.jpg', alt: 'My plant' })
    expect(wrapper.text()).toBe('')
  })
})

describe('BaseAvatar', () => {
  it('shows the first character of the name, upper-cased', () => {
    expect(mount(BaseAvatar, { props: { name: 'nikki' } }).text()).toBe('N')
    expect(mount(BaseAvatar, { props: { name: 'けんじ' } }).text()).toBe('け')
    expect(mount(BaseAvatar, { props: { name: '🌱seed' } }).text()).toBe('🌱')
  })
})

describe('BasePill', () => {
  it('marks the selected count pill', () => {
    const wrapper = mount(BasePill, {
      props: { tone: 'count', selected: true },
      slots: { default: '🔥 3' },
    })
    expect(wrapper.classes()).toEqual(['pill', 'pill--count', 'pill--selected'])
    expect(wrapper.text()).toBe('🔥 3')
  })
})

describe('BaseSeal', () => {
  it('is decorative and plays the break animation on demand', async () => {
    const wrapper = mount(BaseSeal)
    expect(wrapper.attributes('aria-hidden')).toBe('true')
    expect(wrapper.text()).toContain('TAP TO OPEN')
    await wrapper.setProps({ breaking: true })
    expect(wrapper.classes()).toContain('seal--breaking')
  })
})

describe('BaseWordmark', () => {
  it('reads as one name and adds the sticker only when stacked', async () => {
    const wrapper = mount(BaseWordmark, { props: { sticker: true } })
    expect(wrapper.attributes()).toMatchObject({ role: 'img', 'aria-label': 'Pop Nikki' })
    expect(wrapper.text()).toBe('POPNIKKI')
    await wrapper.setProps({ layout: 'stacked' })
    expect(wrapper.text()).toBe('POPNIKKI日記')
  })
})

describe('HistoryRow', () => {
  it('shows the day, date, text, meta and actions', () => {
    const wrapper = mount(HistoryRow, {
      props: { day: 19, date: 'OCT 31', text: 'ハロウィン', meta: '🔥 4', card: true },
      slots: { actions: '<button>Delete</button>' },
    })
    expect(wrapper.text()).toContain('DAY 19 · OCT 31')
    expect(wrapper.text()).toContain('ハロウィン')
    expect(wrapper.text()).toContain('🔥 4')
    expect(wrapper.find('button').exists()).toBe(true)
    expect(wrapper.classes()).toContain('row--card')
    expect(wrapper.element.tagName).toBe('ARTICLE')
  })

  it('becomes a link to the post when given a route', () => {
    const wrapper = mount(HistoryRow, {
      props: { day: 3, date: 'NOV 2', text: 'Sprout', to: '/plants/2/4' },
      global: { plugins: [testRouter()] },
    })
    expect(wrapper.element.tagName).toBe('A')
    expect(wrapper.attributes('href')).toBe('/plants/2/4')
    expect(wrapper.text()).toContain('Sprout')
  })
})

describe('TimerRing', () => {
  it('shows the remaining time as m:ss, rounding up', () => {
    expect(
      mount(TimerRing, { props: { remaining: 120 } })
        .get('[role="timer"]')
        .text(),
    ).toBe('2:00')
    expect(
      mount(TimerRing, { props: { remaining: 64.2 } })
        .get('[role="timer"]')
        .text(),
    ).toBe('1:05')
    expect(
      mount(TimerRing, { props: { remaining: -1 } })
        .get('[role="timer"]')
        .text(),
    ).toBe('0:00')
  })

  it('caps its width at size and shrinks with the screen', () => {
    const style = mount(TimerRing, { props: { remaining: 60, size: 200 } })
      .get('.ring')
      .attributes('style')
    expect(style).toContain('min(200px, 70vw, 42dvh)')
  })
})

describe('static pieces', () => {
  it('render their content', () => {
    expect(
      mount(BaseSectionRule, { slots: { default: 'PREVIOUS NIKKI' } })
        .get('h2')
        .text(),
    ).toBe('PREVIOUS NIKKI')
    expect(mount(BaseInfoNote, { slots: { default: 'Note' } }).text()).toBe('♪Note')
    expect(mount(BaseSticker).text()).toBe('日記')
  })
})
