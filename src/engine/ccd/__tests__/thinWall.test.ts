import { describe, it, expect } from 'vitest'
import type { OBB, AABB, Vec2 } from '../sweep'
import { advanceWithCCD } from '../engineStepper'

function obb(center: [number, number], half: [number, number], angle = 0): OBB {
  return { kind: 'obb', center: { x: center[0], y: center[1] }, half: { x: half[0], y: half[1] }, angle }
}

function aabb(min: [number, number], max: [number, number]): AABB {
  return { kind: 'aabb', min: { x: min[0], y: min[1] }, max: { x: max[0], y: max[1] } }
}

describe('CCD Acceptance: Thin Wall (no tunneling @ 1 substep)', () => {
  it('stops the moving OBB at the wall face when CCD is enabled', () => {
    const A = obb([0, 0], [0.1, 0.1])
    const wall = aabb([0.25, -1], [0.26, 1]) // very thin wall 0.01m thick
    const v: Vec2 = { x: 20, y: 0 } // fast motion
    const dt = 1 / 60

    // Naive integration would tunnel past the wall
    const naiveCenterX = A.center.x + v.x * dt
    const naiveRightFace = naiveCenterX + A.half.x
    expect(naiveRightFace).toBeGreaterThan(wall.max.x)

    // CCD integration should not tunnel: right face <= wall.min.x + eps
    const out = advanceWithCCD(A, v, dt, [wall])
    expect(out.collided).toBe(true)
    const rightFace = out.center.x + A.half.x
    expect(rightFace).toBeLessThanOrEqual(wall.min.x + 1e-4)
  })
})

