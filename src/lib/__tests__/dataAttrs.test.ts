/** @vitest-environment jsdom */
import { describe, test, expect } from 'vitest'

describe('Physics data attributes', () => {
  test('reads data-phys-* attributes from DOM element', () => {
    const button = document.createElement('button')
    button.dataset.physMass = '2.5'
    button.dataset.physRestitution = '0.7'
    button.dataset.physShape = 'obb'
    expect(button.dataset.physMass).toBe('2.5')
    expect(button.dataset.physRestitution).toBe('0.7')
    expect(button.dataset.physShape).toBe('obb')
  })
})

