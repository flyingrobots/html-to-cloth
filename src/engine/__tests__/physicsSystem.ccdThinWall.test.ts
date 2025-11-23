import { describe, it, expect } from 'vitest'

import { EventBus } from '../events/bus'
import { PhysicsSystem } from '../systems/physicsSystem'

/**
 * Acceptance: High-speed rigid body must not tunnel through a thin static wall when CCD policy is enabled.
 * The current PhysicsSystem lacks CCD integration, so this test should fail until CCD policy + swept TOI are wired in.
 */
describe('PhysicsSystem CCD thin wall (R1 promoted to PhysicsSystem)', () => {
  it('stops a fast body at a thin wall and emits at least one CollisionV2 event', () => {
    const bus = new EventBus({ capacity: 128, mailboxCapacity: 128 })
    const physics = new PhysicsSystem({
      bus,
      getAabbs: () => [{ min: { x: 0, y: -1 }, max: { x: 0.02, y: 1 } }],
      gravity: 0,
      enableDynamicPairs: false,
    }) as any

    // Future CCD policy hook (expected to exist once implemented).
    if (typeof physics.configureCcd === 'function') {
      physics.configureCcd({ speedThreshold: 1, epsilon: 1e-4 })
    }

    physics.addRigidBody({
      id: 1,
      center: { x: -0.5, y: 0 },
      half: { x: 0.1, y: 0.1 },
      angle: 0,
      velocity: { x: 10, y: 0 },
      mass: 1,
      restitution: 0.2,
      friction: 0.4,
    })

    // One coarse step that would otherwise teleport through the wall without CCD.
    physics.fixedUpdate(0.1)

    const bodies = physics.debugGetRigidBodies()
    expect(bodies[0].center.x).toBeLessThanOrEqual(0.02 + bodies[0].half.x + 1e-3)

    const cursor = bus.subscribe('ccd-thin-wall', [{ channel: 'fixedEnd', ids: [4 /* CollisionV2 */] }])
    const received: Array<{ id: number }> = []
    cursor.read('fixedEnd', (h) => { received.push({ id: h.id }) })
    expect(received.length).toBeGreaterThan(0)
  })
})
