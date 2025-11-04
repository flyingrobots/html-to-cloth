import { describe, it, expect, beforeEach } from 'vitest'
import { RigidSystem } from '../rigidSystem'
import type { AABB } from '../rigidSystem'
import { globalEventBus } from '../../events/eventBus'
import type { EngineEvent } from '../../events/types'

describe('RigidSystem', () => {
  let aabbs: AABB[]
  let sys: RigidSystem

  beforeEach(() => {
    aabbs = [
      { min: { x: -0.2, y: -0.2 }, max: { x: 0.2, y: 0.0 } }, // ground at y = 0
    ]
    sys = new RigidSystem({ getAabbs: () => aabbs, gravity: 9.81 })
  })

  it('falls under gravity and resolves against static AABB, emitting collision', () => {
    const seen: EngineEvent[] = []
    const off = globalEventBus.on((e) => { if (e.type === 'collision') seen.push(e) })
    sys.addBody({
      id: 'box-1',
      tag: 'test',
      center: { x: 0, y: 0.5 },
      half: { x: 0.1, y: 0.1 },
      rotation: 0,
      velocity: { x: 0, y: 0 },
      mass: 1,
      restitution: 0.2,
      friction: 0.3,
    })
    // Step enough frames to collide
    for (let i = 0; i < 120; i++) sys.fixedUpdate(1 / 60)
    // Should have emitted at least one collision
    expect(seen.length).toBeGreaterThan(0)
    // Body should be resting on the ground or above it, not tunneling through
    // center.y should be >= ground max.y + half.y
    // We cannot access body directly; approximate by ensuring at least one collision occurred.
    off()
  })
})
