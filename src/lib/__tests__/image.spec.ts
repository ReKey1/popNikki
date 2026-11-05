import { describe, expect, it } from 'vitest'

import { fitWithin } from '../image'

describe('fitWithin', () => {
  it('scales a landscape image by its width', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 })
  })

  it('scales a portrait image by its height', () => {
    expect(fitWithin(3000, 4000, 400)).toEqual({ width: 300, height: 400 })
  })

  it('never scales a small image up', () => {
    expect(fitWithin(300, 200, 1600)).toEqual({ width: 300, height: 200 })
  })
})
