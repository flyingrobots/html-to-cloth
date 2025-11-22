import { beforeEach, describe, it, expect } from 'vitest'
import { CollisionSystem } from '../collisionSystem'

const makeRect = (left: number, top: number, width: number, height: number): DOMRect => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
  x: left,
  y: top,
  toJSON() {
    return {}
  },
}) as DOMRect

describe('CollisionSystem world-scale mapping', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 })
    document.body.innerHTML = ''
  })

  it('maps a full-viewport rigid-static element to a 4m×3m world AABB at the 1024×768 baseline', () => {
    const element = document.createElement('textarea')
    element.className = 'rigid-static'
    document.body.appendChild(element)
    element.getBoundingClientRect = () => makeRect(0, 0, 1024, 768)

    const system = new CollisionSystem()
    system.setViewportDimensions(1024, 768)
    system.addStaticBody(element)

    const aabbs = system.getStaticAABBs()
    expect(aabbs).toHaveLength(1)
    const { min, max } = aabbs[0]

    const width = max.x - min.x
    const height = max.y - min.y
    const centerX = (min.x + max.x) * 0.5
    const centerY = (min.y + max.y) * 0.5

    // Full viewport should span 4m×3m with the world origin at its center.
    expect(width).toBeCloseTo(4, 3)
    expect(height).toBeCloseTo(3, 3)
    expect(centerX).toBeCloseTo(0, 6)
    expect(centerY).toBeCloseTo(0, 6)
  })
})

