import { describe, it, expect } from 'vitest'

import { EventBus } from '../events/bus'
import { PhysicsSystem } from '../systems/physicsSystem'

/**
 * Failing spec: CCD response should zero-out inward velocity regardless of mass.
 * Current impulse math divides by mass instead of invMass, so heavy bodies keep moving into the wall.
 */
describe('PhysicsSystem CCD response', () => {
  it('removes inward normal velocity for heavy fast bodies (restitution 0)', () => {
    const bus = new EventBus({ capacity: 64, mailboxCapacity: 64 })
    const physics = new PhysicsSystem({
      bus,
      getAabbs: () => [{ min: { x: 0, y: -1 }, max: { x: 0.02, y: 1 } }],
      gravity: 0,
      enableDynamicPairs: false,
    }) as any

    physics.configureCcd?.({ speedThreshold: 1, epsilon: 1e-4 })

    physics.addRigidBody({
      id: 1,
      center: { x: -0.2, y: 0 },
      half: { x: 0.05, y: 0.05 },
      angle: 0,
      velocity: { x: 10, y: 0 },
      mass: 2,
      restitution: 0,
      friction: 0,
    })

    physics.fixedUpdate(0.05)

    const body = physics.debugGetRigidBodies().find((b: any) => b.id === 1)!
    expect(body.center.x).toBeLessThanOrEqual(0.02 + body.half.x + 1e-3)
    // Inward velocity should be cancelled (vx <= 0) after CCD response with restitution 0.
    expect(body.velocity.x).toBeLessThanOrEqual(0)
  })
})
