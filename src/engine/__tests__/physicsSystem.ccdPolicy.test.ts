import { describe, it, expect } from 'vitest'

import { EventBus } from '../events/bus'
import { PhysicsSystem } from '../systems/physicsSystem'

/**
 * Failing spec: CCD policy should gate CCD by speed and allow per-body override.
 * Current PhysicsSystem lacks CCD, so fast bodies tunnel and no events are emitted.
 */
describe('PhysicsSystem CCD policy', () => {
  it('applies CCD to fast bodies and leaves slow bodies on SAT path', () => {
    const bus = new EventBus({ capacity: 128, mailboxCapacity: 64 })
    const physics = new PhysicsSystem({
      bus,
      getAabbs: () => [{ min: { x: 0.5, y: -1 }, max: { x: 0.52, y: 1 } }],
      gravity: 0,
      enableDynamicPairs: false,
    }) as any

    physics.addRigidBody({
      id: 1,
      center: { x: 0, y: 0 },
      half: { x: 0.05, y: 0.05 },
      angle: 0,
      velocity: { x: 10, y: 0 },
      mass: 1,
      restitution: 0,
      friction: 0,
    })

    physics.addRigidBody({
      id: 2,
      center: { x: 0, y: -0.5 },
      half: { x: 0.05, y: 0.05 },
      angle: 0,
      velocity: { x: 0.5, y: 0 },
      mass: 1,
      restitution: 0,
      friction: 0,
    })

    if (typeof physics.configureCcd === 'function') {
      physics.configureCcd({ speedThreshold: 1, epsilon: 1e-4 })
    }

    physics.fixedUpdate(0.2)

    const bodies = physics.debugGetRigidBodies()
    const fast = bodies.find((b) => b.id === 1)!
    const slow = bodies.find((b) => b.id === 2)!

    // Fast body should have been clamped near the wall, not tunneled beyond it.
    expect(fast.center.x).toBeLessThanOrEqual(0.52 + fast.half.x + 1e-3)
    // Slow body should follow the naive integration path (no CCD clamp).
    expect(slow.center.x).toBeCloseTo(0.5 * 0.2, 1e-6)

    const cursor = bus.subscribe('ccd-policy', [{ channel: 'fixedEnd', ids: [4 /* CollisionV2 */] }])
    const collisions: number[] = []
    cursor.read('fixedEnd', (h) => { collisions.push(h.id) })
    expect(collisions.length).toBeGreaterThan(0)
  })
})
