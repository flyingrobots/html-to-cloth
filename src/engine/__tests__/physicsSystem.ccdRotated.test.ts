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

  it('handles diagonal approach with rotation (normal remains normalized)', () => {
    const bus = new EventBus({ capacity: 128, mailboxCapacity: 64 })
    const physics = new PhysicsSystem({
      bus,
      getAabbs: () => [{ min: { x: 0.35, y: -0.2 }, max: { x: 0.37, y: 0.2 } }],
      gravity: 0,
      enableDynamicPairs: false,
    }) as any

    physics.configureCcd?.({ speedThreshold: 1, epsilon: 1e-4 })

    physics.addRigidBody({
      id: 1,
      center: { x: 0, y: 0.1 },
      half: { x: 0.06, y: 0.06 },
      angle: Math.PI / 10, // 18°
      velocity: { x: 6, y: -1 }, // diagonal downward
      restitution: 0,
      friction: 0,
    })

    physics.fixedUpdate(0.08)

    const body = physics.debugGetRigidBodies().find((b: any) => b.id === 1)!
    expect(body.center.x).toBeLessThanOrEqual(0.37 + body.half.x + 1e-3)
    // X velocity should have flipped or zeroed; Y should not explode.
    expect(body.velocity.x).toBeLessThanOrEqual(0)
    expect(Math.abs(body.velocity.y)).toBeLessThanOrEqual(2)
  })

  it('keeps rotation-only (no translation) from falsely triggering CCD', () => {
    const bus = new EventBus({ capacity: 128, mailboxCapacity: 64 })
    const physics = new PhysicsSystem({
      bus,
      getAabbs: () => [{ min: { x: 0.3, y: -1 }, max: { x: 0.32, y: 1 } }],
      gravity: 0,
      enableDynamicPairs: false,
    }) as any

    physics.configureCcd?.({ speedThreshold: 1, epsilon: 1e-4 })

    physics.addRigidBody({
      id: 1,
      center: { x: 0.1, y: 0 },
      half: { x: 0.05, y: 0.05 },
      angle: Math.PI / 6, // 30°
      velocity: { x: 0, y: 0 }, // rotational only in a future angular CCD model; here should not move
      restitution: 0,
      friction: 0,
    })

    physics.fixedUpdate(0.1)

    const body = physics.debugGetRigidBodies().find((b: any) => b.id === 1)!
    // No translation: should remain in place (within epsilon) and never collide.
    expect(body.center.x).toBeCloseTo(0.1, 6)
  })

  it('handles rotated mover against rotated obstacle (swept SAT path)', () => {
    const bus = new EventBus({ capacity: 128, mailboxCapacity: 64 })
    const physics = new PhysicsSystem({
      bus,
      getAabbs: () => [],
      gravity: 0,
      enableDynamicPairs: false,
    }) as any

    physics.configureCcd?.({ speedThreshold: 1, epsilon: 1e-4 })

    physics.addRigidBody({
      id: 99,
      center: { x: 0.35, y: 0 },
      half: { x: 0.08, y: 0.2 },
      angle: Math.PI / 8, // ~22.5°
      velocity: { x: 0, y: 0 },
      mass: 0,
      restitution: 0,
      friction: 0,
    })

    physics.addRigidBody({
      id: 1,
      center: { x: 0, y: 0.05 },
      half: { x: 0.06, y: 0.06 },
      angle: Math.PI / 12, // 15°
      velocity: { x: 7, y: -0.3 },
      restitution: 0,
      friction: 0,
    })

    physics.fixedUpdate(0.06)

    const body = physics.debugGetRigidBodies().find((b: any) => b.id === 1)!
    expect(body.center.x).toBeLessThanOrEqual(0.35 + body.half.x + 1e-3)
  })

  it('earliest TOI wins in a rotated obstacle gauntlet (no leapfrog)', () => {
    const bus = new EventBus({ capacity: 256, mailboxCapacity: 128 })
    const physics = new PhysicsSystem({
      bus,
      getAabbs: () => [],
      gravity: 0,
      enableDynamicPairs: false,
    }) as any

    physics.configureCcd?.({ speedThreshold: 1, epsilon: 1e-4 })

    const obstacles = [
      { id: 201, center: { x: 0.28, y: 0 }, half: { x: 0.05, y: 0.18 }, angle: Math.PI / 16 },
      { id: 202, center: { x: 0.55, y: 0.02 }, half: { x: 0.05, y: 0.18 }, angle: -Math.PI / 10 },
    ]
    for (const o of obstacles) {
      physics.addRigidBody({
        id: o.id,
        center: o.center,
        half: o.half,
        angle: o.angle,
        velocity: { x: 0, y: 0 },
        mass: 0,
        restitution: 0,
        friction: 0,
      })
    }

    physics.addRigidBody({
      id: 1,
      center: { x: -0.05, y: 0 },
      half: { x: 0.06, y: 0.06 },
      angle: Math.PI / 14,
      velocity: { x: 9, y: 0.1 },
      restitution: 0,
      friction: 0,
    })

    physics.fixedUpdate(0.05)

    const body = physics.debugGetRigidBodies().find((b: any) => b.id === 1)!
    expect(body.center.x).toBeLessThanOrEqual(0.28 + body.half.x + 1e-3)
  })

  it('handles rotated moving obstacle (relative motion CCD)', () => {
    const bus = new EventBus({ capacity: 256, mailboxCapacity: 128 })
    const physics = new PhysicsSystem({
      bus,
      getAabbs: () => [],
      gravity: 0,
      enableDynamicPairs: false,
    }) as any

    physics.configureCcd?.({ speedThreshold: 1, epsilon: 1e-4 })

    // Moving rotated obstacle (treated as dynamic for now).
    physics.addRigidBody({
      id: 301,
      center: { x: 0.3, y: 0 },
      half: { x: 0.06, y: 0.18 },
      angle: Math.PI / 9,
      velocity: { x: -2, y: 0 }, // moving left toward mover
      mass: 5, // dynamic, not static
      restitution: 0,
      friction: 0,
    })

    physics.addRigidBody({
      id: 1,
      center: { x: 0, y: 0.05 },
      half: { x: 0.06, y: 0.06 },
      angle: Math.PI / 11,
      velocity: { x: 8, y: -0.2 },
      restitution: 0,
      friction: 0,
    })

    physics.fixedUpdate(0.05)

    const body = physics.debugGetRigidBodies().find((b: any) => b.id === 1)!
    expect(body.center.x).toBeLessThanOrEqual(0.3 + body.half.x + 1e-3)
    expect(body.velocity.x).toBeLessThanOrEqual(0)
  })
})
