import { describe, it, expect } from 'vitest'

import { EngineWorld } from '../world'
import { PhysicsSystem } from '../systems/physicsSystem'
import { EventBus } from '../events/bus'
import { EventIds } from '../events/ids'

describe('Drop Box acceptance (engine-level)', () => {
  it('spawns a rigid body aligned to a floor AABB and produces collision + sleep events', () => {
    const bus = new EventBus({ capacity: 256, mailboxCapacity: 256 })
    const world = new EngineWorld()

    // Synthetic floor AABB that mirrors the sandbox textarea behaviour:
    // full-width slab centred at the origin, with a modest height.
    const floor = {
      min: { x: -2, y: -1.5 },
      max: { x: 2, y: -1.0 },
    }

    const physics = new PhysicsSystem({
      bus,
      getAabbs: () => [floor],
      gravity: 9.81,
      enableDynamicPairs: false,
    })

    world.addSystem(physics, { id: 'physics-core', priority: 100 })

    const cursor = bus.subscribe('drop-box', [
      {
        channel: 'fixedEnd',
        ids: [EventIds.CollisionV2],
      },
    ])

    // Mirror the sandbox Drop Box spawn logic: choose the floor centre in X,
    // derive box size from floor extents, and place it just above the floor.
    const centerX = (floor.min.x + floor.max.x) * 0.5
    const width = floor.max.x - floor.min.x
    const height = floor.max.y - floor.min.y
    const halfX = Math.max(width * 0.15, 0.01)
    const halfY = Math.max(height * 0.35, 0.012)
    const centerY = floor.max.y + halfY * 2.2

    const bodyId = 1
    physics.addRigidBody({
      id: bodyId,
      center: { x: centerX, y: centerY },
      half: { x: halfX, y: halfY },
      angle: 0,
      // Start with a small downward velocity so the body reaches the floor
      // within the sleep window used by the rigid system.
      velocity: { x: 0, y: -0.5 },
      mass: 1,
      restitution: 0.2,
      friction: 0.6,
    })

    const dt = 1 / 60
    const totalSteps = 480
    let sawCollision = false

    for (let i = 0; i < totalSteps; i++) {
      world.step(dt)

      cursor.read('fixedEnd', (header, record) => {
        const id = header.id >>> 0
        if (id === EventIds.CollisionV2) {
          const entityA = record.u32[0] >>> 0
          if (entityA === bodyId) {
            sawCollision = true
          }
        }
      })

      if (sawCollision) break
    }

    expect(sawCollision).toBe(true)
  })
})
