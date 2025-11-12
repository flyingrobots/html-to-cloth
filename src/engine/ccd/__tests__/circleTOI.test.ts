import { describe, it, expect } from 'vitest'
import { circleCircleTOI } from '../queries/circle'

describe('Circle TOI (analytic)', () => {
  it('computes t for head-on approach with unit velocities', () => {
    // A at 0, radius 0.5; B at 3, radius 0.5; both move toward each other at 1 m/s
    const A = { c: { x: 0, y: 0 }, r: 0.5 }
    const B = { c: { x: 3, y: 0 }, r: 0.5 }
    const va = { x: 1, y: 0 }
    const vb = { x: -1, y: 0 }
    const dt = 1
    // Relative speed = 2; needed closing distance = 3 - (0.5+0.5) = 2 → t = 1
    const res = circleCircleTOI(A, va, B, vb, dt)
    expect(res.hit).toBe(true)
    if (res.hit) expect(Math.abs(res.t - 1)).toBeLessThan(1e-6)
  })

  it('returns false when diverging', () => {
    const A = { c: { x: 0, y: 0 }, r: 0.5 }
    const B = { c: { x: 3, y: 0 }, r: 0.5 }
    const va = { x: -1, y: 0 }
    const vb = { x: 1, y: 0 }
    const dt = 1
    const res = circleCircleTOI(A, va, B, vb, dt)
    expect(res.hit).toBe(false)
  })
})

