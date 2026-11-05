import { afterEach, describe, expect, it, vi } from 'vitest'

import { preloadImages } from '../preload'

describe('preloadImages', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('starts each image once, at low priority', () => {
    const images: { src: string; fetchPriority: string }[] = []
    vi.stubGlobal(
      'Image',
      class {
        src = ''
        fetchPriority = 'auto'
        constructor() {
          images.push(this)
        }
      },
    )

    preloadImages(['/api/posts/1/photo', '/api/posts/2/photo'])
    preloadImages(['/api/posts/2/photo', '/api/posts/3/photo'])

    expect(images.map((i) => i.src)).toEqual([
      '/api/posts/1/photo',
      '/api/posts/2/photo',
      '/api/posts/3/photo',
    ])
    expect(images.every((i) => i.fetchPriority === 'low')).toBe(true)
  })
})
