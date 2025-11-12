import { describe, it, expect } from 'vitest'
import { sweepTOI } from '../sweep'

type Vec2 = { x: number; y: number }

type OBB = {
  kind: 'obb'
  center: Vec2
  half: Vec2
  angle: number // radians
}

type AABB = {
  kind: 'aabb'
  min: Vec2
  max: Vec2
}

describe('CCD: OBB↔AABB TOI (axis-aligned)', () => {
  it('returns hit=true with correct t and normal for a rightward sweep', () => {
    const A: OBB = { kind: 'obb', center: { x: 0, y: 0 }, half: { x: 0.5, y: 0.5 }, angle: 0 }
    const B: AABB = { kind: 'aabb', min: { x: 2, y: -0.5 }, max: { x: 3, y: 0.5 } }
    const vRel: Vec2 = { x: 3, y: 0 }
    const dt = 1

    const res = sweepTOI(A, vRel, B, dt)
    expect(res.hit).toBe(true)

    // t = (bMinX - aMaxX) / (vRel.x*dt) = (2 - 0.5) / 3 = 0.5
    if (res.hit) {
      expect(Math.abs(res.t - 0.5)).toBeLessThan(1e-3)
      // Normal opposes motion
      expect(res.normal.x).toBeCloseTo(-1, 3)
      expect(res.normal.y).toBeCloseTo(0, 3)
      // Point near B's left face at y≈0
      if (res.point) {
        expect(Math.abs(res.point.x - 2)).toBeLessThan(5e-2)
        expect(Math.abs(res.point.y - 0)).toBeLessThan(5e-2)
      }
    }
  })
})

