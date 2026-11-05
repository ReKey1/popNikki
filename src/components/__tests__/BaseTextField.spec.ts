import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import BaseTextField from '../BaseTextField.vue'

describe('BaseTextField', () => {
  it('binds v-model and passes extra attributes to the input', async () => {
    const wrapper = mount(BaseTextField, {
      props: {
        label: 'NAME',
        modelValue: 'nik',
        'onUpdate:modelValue': (value: string) => wrapper.setProps({ modelValue: value }),
      },
      attrs: { required: true, autocomplete: 'nickname' },
    })
    const input = wrapper.get('input')
    expect(input.element.value).toBe('nik')
    expect(input.attributes()).toMatchObject({ required: '', autocomplete: 'nickname' })
    expect(wrapper.get('label').attributes('required')).toBeUndefined()

    await input.setValue('nikki')
    expect(wrapper.props('modelValue')).toBe('nikki')
  })

  it('shows a character counter on a multiline field', async () => {
    const wrapper = mount(BaseTextField, {
      props: {
        label: 'DESCRIPTION',
        multiline: true,
        maxlength: 280,
        modelValue: '',
        'onUpdate:modelValue': (value: string) => wrapper.setProps({ modelValue: value }),
      },
    })
    expect(wrapper.text()).toContain('0/280')
    await wrapper.get('textarea').setValue('first leaf')
    expect(wrapper.text()).toContain('10/280')
    expect(wrapper.get('textarea').attributes('maxlength')).toBe('280')
  })
})
