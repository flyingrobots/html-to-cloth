import { describe, it, expect } from 'vitest'
import { rayAabbSlabs, rayObbLocalSlabs } from '../queries/ray'
import type { OBB } from '../sweep'

describe('Ray slabs: AABB', () => {
  it('hits through center with symmetric tEnter/tExit for unit dir', () => {
    const origin = { x: 0, y: 0 }
    const dir = { x: 1, y: 0 }
    const min = { x: 2, y: -1 }
    const max = { x: 4, y: 1 }
    const res = rayAabbSlabs(origin, dir, min, max)
    expect(res.hit).toBe(true)
    if (res.hit) {
      expect(res.tEnter).toBeCloseTo(2, 6)
      expect(res.tExit).toBeCloseTo(4, 6)
      expect(res.normal?.x).toBe(-1)
      expect(res.normal?.y).toBe(0)
    }
  })

  it('misses when aiming away', () => {
    const origin = { x: 0, y: 0 }
    const dir = { x: -1, y: 0 }
    const min = { x: 2, y: -1 }
    const max = { x: 4, y: 1 }
    const res = rayAabbSlabs(origin, dir, min, max)
    expect(res.hit).toBe(false)
  })
})

describe('Ray slabs: OBB via local-frame slabs', () => {
  it('hits a rotated box; intersection point lies on the local face', () => {
    const obb: OBB = { kind: 'obb', center: { x: 3, y: 0 }, half: { x: 1, y: 0.5 }, angle: Math.PI / 6 }
    const origin = { x: 0, y: 0 }
    const dir = { x: 1, y: 0 }
    const res = rayObbLocalSlabs(origin, dir, obb)
    expect(res.hit).toBe(true)
    if (res.hit) {
      // Validate the hit point is on the OBB surface in local space
      const theta = Math.PI / 6
      const c = Math.cos(theta), s = Math.sin(theta)
      const px = res.point!.x - obb.center.x
      const py = res.point!.y - obb.center.y
      const pLx = px * c + py * s
      const pLy = px * -s + py * c
      // x should be near -half.x (left face), y within [-half.y, half.y]
      expect(Math.abs(Math.abs(pLx) - obb.half.x)).toBeLessThan(1e-3)
      expect(pLy).toBeLessThanOrEqual(obb.half.y + 1e-3)
      expect(pLy).toBeGreaterThanOrEqual(-obb.half.y - 1e-3)
    }
  })
})
