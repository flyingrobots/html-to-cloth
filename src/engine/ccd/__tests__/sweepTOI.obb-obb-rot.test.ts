import { describe, it, expect } from 'vitest'
import { sweepTOI } from '../sweep'

type Vec2 = { x: number; y: number }
type OBB = { kind: 'obb'; center: Vec2; half: Vec2; angle: number }

function deg(n: number) { return (n * Math.PI) / 180 }

describe('CCD: OBB↔OBB TOI (rotated A, axis-aligned B)', () => {
  it('computes TOI via swept SAT; normal opposes motion', () => {
    const A: OBB = { kind: 'obb', center: { x: 0, y: 0 }, half: { x: 0.5, y: 0.5 }, angle: deg(30) }
    const B: OBB = { kind: 'obb', center: { x: 3, y: 0 }, half: { x: 0.5, y: 0.5 }, angle: 0 }
    const vRel: Vec2 = { x: 3, y: 0 }
    const dt = 1

    const res = sweepTOI(A, vRel, B, dt)
    expect(res.hit).toBe(true)

    // Expected t from X-axis slabs using rotated A radius along X
    const cos = Math.cos(deg(30))
    const sin = Math.sin(deg(30))
    const rAx = Math.abs(cos) * 0.5 + Math.abs(-sin) * 0.5
    const rBx = 0.5
    const expectedT = (3 - (rAx + rBx)) / 3
    expect(Math.abs(res.t - expectedT)).toBeLessThan(1e-3)

    const n = res.normal
    const dot = n.x * vRel.x + n.y * vRel.y
    expect(dot).toBeLessThanOrEqual(0)
    const len = Math.hypot(n.x, n.y)
    expect(Math.abs(len - 1)).toBeLessThan(1e-3)
  })
})

