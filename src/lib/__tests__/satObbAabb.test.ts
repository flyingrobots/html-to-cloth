import { describe, it, expect } from 'vitest'

import { obbVsAabb, type OBB, type AABB, applyRestitutionFriction } from '../collision/satObbAabb'

function makeOBB(cx: number, cy: number, hx: number, hy: number, rad: number): OBB {
  return { center: { x: cx, y: cy }, half: { x: hx, y: hy }, rotation: rad }
}

function makeAABB(minx: number, miny: number, maxx: number, maxy: number): AABB {
  return { min: { x: minx, y: miny }, max: { x: maxx, y: maxy } }
}

describe('SAT OBB vs AABB', () => {
  it('detects no contact when separated', () => {
    const obb = makeOBB(0, 0, 1, 0.5, 0)
    const box = makeAABB(1.4, -0.2, 2.2, 0.2)
    const res = obbVsAabb(obb, box)
    expect(res.collided).toBe(false)
  })

  it('returns MTV for overlapping shapes (axis-aligned)', () => {
    const obb = makeOBB(0, 0, 1, 0.5, 0)
    const box = makeAABB(0.8, -0.3, 1.6, 0.3)
    const res = obbVsAabb(obb, box)
    expect(res.collided).toBe(true)
    // MTV should push OBB minimally along +X (since overlap on right side is smaller)
    expect(Math.abs(res.mtv.x) + Math.abs(res.mtv.y)).toBeGreaterThan(0)
    expect(Math.abs(res.mtv.x)).toBeGreaterThan(Math.abs(res.mtv.y))
    // Normal should be axis-aligned, unit, and X-dominant when |mtv.x| > |mtv.y|
    const mag1 = Math.abs(res.normal.x) + Math.abs(res.normal.y)
    expect(mag1).toBeCloseTo(1, 3)
    expect(Math.abs(res.normal.x)).toBeGreaterThan(Math.abs(res.normal.y))
  })

  it('handles rotated OBB collisions with AABB', () => {
    const obb = makeOBB(0.9, 0.1, 1, 0.5, Math.PI / 6)
    const box = makeAABB(0.8, -0.3, 1.6, 0.3)
    const res = obbVsAabb(obb, box)
    expect(res.collided).toBe(true)
    expect(res.depth).toBeGreaterThan(0)
  })

  it('applies restitution and friction to velocity along contact', () => {
    const normal = { x: 1, y: 0 } // contact normal to the right
    const v = { x: -2, y: 1 } // incoming from left, with upward tangent
    const out = applyRestitutionFriction(v, normal, 0.5, 0.2)
    // Normal component should flip and be scaled by restitution
    expect(out.x).toBeCloseTo(1, 3) // 0.5 * 2 = 1
    // Tangential component should be reduced by friction factor
    expect(out.y).toBeCloseTo(0.8, 3)
  })
})
