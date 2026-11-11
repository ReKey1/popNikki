import { afterEach, describe, expect, it } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import { usePageColor, type PageColor } from '../usePageColor'

describe('usePageColor', () => {
  afterEach(() => (document.head.innerHTML = ''))

  it('marks the document with the page colour while the page is open', async () => {
    const color = ref<PageColor>('night')
    const scope = effectScope()
    scope.run(() => usePageColor(color))
    expect(document.documentElement.dataset.page).toBe('night')

    color.value = 'moss'
    await nextTick()
    expect(document.documentElement.dataset.page).toBe('moss')

    // Leaving the page hands the browser back to paper.
    scope.stop()
    expect(document.documentElement.dataset.page).toBeUndefined()
  })

  it('gives the browser toolbar the colour of the body', () => {
    document.head.innerHTML = '<meta name="theme-color" content="#f4f1ea">'
    document.body.style.backgroundColor = 'rgb(22, 21, 18)'
    const scope = effectScope()
    scope.run(() => usePageColor('night'))
    expect(document.querySelector('meta[name="theme-color"]')!.getAttribute('content')).toBe(
      'rgb(22, 21, 18)',
    )
    scope.stop()
    document.body.style.backgroundColor = ''
  })
})
