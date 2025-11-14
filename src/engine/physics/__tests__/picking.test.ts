import { describe, it, expect } from 'vitest'
import { pickBodyAtPoint, type PickBody } from '../picking'

describe('picking utilities (nudged A2)', () => {
  it('returns null when no body contains the point', () => {
    const bodies: PickBody[] = [
      { id: 1, center: { x: -1, y: 0 }, half: { x: 0.5, y: 0.5 } },
      { id: 2, center: { x: 1, y: 0 }, half: { x: 0.5, y: 0.5 } },
    ]
    const hit = pickBodyAtPoint({ x: 0, y: 2 }, bodies)
    expect(hit).toBeNull()
  })

  it('returns the first body whose AABB contains the point', () => {
    const bodies: PickBody[] = [
      { id: 1, center: { x: 0, y: 0 }, half: { x: 0.5, y: 0.5 } },
      { id: 2, center: { x: 0.25, y: 0.25 }, half: { x: 0.5, y: 0.5 } },
    ]
    const hit = pickBodyAtPoint({ x: 0.1, y: 0.1 }, bodies)
    expect(hit).not.toBeNull()
    expect(hit!.id).toBe(1)
  })
})

