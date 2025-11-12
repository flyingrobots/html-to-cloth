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
  it('hits a rotated box; tEnter equals projected distance', () => {
    const obb: OBB = { kind: 'obb', center: { x: 3, y: 0 }, half: { x: 1, y: 0.5 }, angle: Math.PI / 6 }
    const origin = { x: 0, y: 0 }
    const dir = { x: 1, y: 0 }
    const res = rayObbLocalSlabs(origin, dir, obb)
    expect(res.hit).toBe(true)
    // Assert tEnter around 3 - radiusAlongX
    const c = Math.cos(Math.PI / 6), s = Math.sin(Math.PI / 6)
    const rX = Math.abs(c) * obb.half.x + Math.abs(-s) * obb.half.y
    const expected = obb.center.x - rX - origin.x
    if (res.hit) expect(Math.abs(res.tEnter - expected)).toBeLessThan(1e-6)
  })
})

