import { describe, it, expect } from 'vitest'

import { EventBus } from '../events/bus'
import { PhysicsSystem } from '../systems/physicsSystem'

/**
 * Failing spec: rotated moving OBB should still use CCD vs axis-aligned static AABB.
 * Current sweep only handles AABB when the moving body is axis-aligned, so rotated bodies tunnel.
 */
describe('PhysicsSystem CCD with rotated moving bodies', () => {
  it('prevents tunneling for a rotated OBB hitting an axis-aligned thin wall', () => {
    const bus = new EventBus({ capacity: 128, mailboxCapacity: 64 })
    const physics = new PhysicsSystem({
      bus,
      getAabbs: () => [{ min: { x: 0.2, y: -1 }, max: { x: 0.22, y: 1 } }],
      gravity: 0,
      enableDynamicPairs: false,
    }) as any

    physics.configureCcd?.({ speedThreshold: 1, epsilon: 1e-4 })

    physics.addRigidBody({
      id: 1,
      center: { x: 0, y: 0 },
      half: { x: 0.05, y: 0.08 },
      angle: Math.PI / 12, // 15°
      velocity: { x: 8, y: 0 },
      restitution: 0,
      friction: 0,
    })

    physics.fixedUpdate(0.05)

    const body = physics.debugGetRigidBodies().find((b: any) => b.id === 1)!
    expect(body.center.x).toBeLessThanOrEqual(0.22 + body.half.x + 1e-3)
    expect(body.velocity.x).toBeLessThanOrEqual(0) // inward velocity should be removed
  })
})
