import { describe, it, expect } from 'vitest'

// Spec-first API for CCD: a single entry that returns TOI, normal, and optional contact point.
// Implementation will live in src/engine/ccd/sweep.ts.
// For now this test intentionally fails (module and behaviour not implemented yet).
import { sweepTOI } from '../sweep'

type Vec2 = { x: number; y: number }

type OBB = {
  kind: 'obb'
  center: Vec2
  half: Vec2
  angle: number // radians
}

describe('CCD: OBB↔OBB TOI (axis-aligned)', () => {
  it('returns hit=true with t≈2/3, normal opposing motion, and a plausible contact point', () => {
    // A: 1×1 box at origin
    const A: OBB = { kind: 'obb', center: { x: 0, y: 0 }, half: { x: 0.5, y: 0.5 }, angle: 0 }
    // B: 1×1 box centered at x=3 (left face at x=2.5)
    const B: OBB = { kind: 'obb', center: { x: 3, y: 0 }, half: { x: 0.5, y: 0.5 }, angle: 0 }
    // Relative motion: A moves +x at 3 m/s; dt normalized to 1s window
    const vRel: Vec2 = { x: 3, y: 0 }
    const dt = 1

    const result = sweepTOI(A, vRel, B, dt)

    // Must report a collision this frame
    expect(result.hit).toBe(true)

    // Analytic TOI for axis-aligned slabs: t = ( (Bx - Bh) - (Ax + Ah) ) / v
    // Here: t = (2.5 - 0.5) / 3 = 2/3 ≈ 0.6667
    expect(result.t).toBeGreaterThan(0)
    expect(result.t).toBeLessThan(1)
    expect(Math.abs(result.t - 2 / 3)).toBeLessThan(1e-2)

    // Normal must oppose relative motion: n·vRel ≤ 0 and be unit-length-ish
    const n = result.normal
    expect(n).toBeDefined()
    const dot = n.x * vRel.x + n.y * vRel.y
    expect(dot).toBeLessThanOrEqual(0)
    const len = Math.hypot(n.x, n.y)
    expect(Math.abs(len - 1)).toBeLessThan(1e-3)

    // Contact point should lie near the touching face around (x≈2.5,y≈0)
    if (result.point) {
      expect(Math.abs(result.point.x - 2.5)).toBeLessThan(5e-2)
      expect(Math.abs(result.point.y - 0)).toBeLessThan(5e-2)
    }
  })
})

