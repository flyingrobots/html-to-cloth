import { describe, it, expect } from 'vitest'

import { EventBus } from '../events/bus'
import { PhysicsSystem } from '../systems/physicsSystem'

function makePhysics(getAabbs: () => any[]) {
  const bus = new EventBus({ capacity: 128, mailboxCapacity: 128 })
  const physics = new PhysicsSystem({
    bus,
    getAabbs,
    gravity: 0,
    enableDynamicPairs: false,
  }) as any
  physics.configureCcd?.({ speedThreshold: 1, epsilon: 1e-4 })
  return { physics, bus }
}

describe('PhysicsSystem CCD stress', () => {
  it('stops at the earliest obstacle when multiple are in range', () => {
    const { physics } = makePhysics(() => [
      { min: { x: 0.3, y: -1 }, max: { x: 0.32, y: 1 } },
      { min: { x: 0.6, y: -1 }, max: { x: 0.62, y: 1 } },
    ])

    physics.addRigidBody({
      id: 1,
      center: { x: 0, y: 0 },
      half: { x: 0.05, y: 0.05 },
      angle: 0,
      velocity: { x: 10, y: 0 },
      restitution: 0,
      friction: 0,
    })

    physics.fixedUpdate(0.05)

    const body = physics.debugGetRigidBodies().find((b: any) => b.id === 1)!
    // Should stop at first obstacle (~0.32) not punch through to second (~0.62).
    expect(body.center.x).toBeLessThanOrEqual(0.32 + body.half.x + 1e-3)
  })

  it('treats shallow grazing hits as collisions (normalized normal)', () => {
    const { physics } = makePhysics(() => [
      { min: { x: 0.4, y: -0.05 }, max: { x: 0.42, y: 0.05 } },
    ])

    physics.addRigidBody({
      id: 1,
      center: { x: 0, y: 0.05 },
      half: { x: 0.05, y: 0.05 },
      angle: 0,
      velocity: { x: 8, y: -0.5 }, // shallow downward graze along +X
      restitution: 0,
      friction: 0,
    })

    physics.fixedUpdate(0.05)

    const body = physics.debugGetRigidBodies().find((b: any) => b.id === 1)!
    // Should have resolved near the obstacle rather than tunneling past.
    expect(body.center.x).toBeLessThanOrEqual(0.42 + body.half.x + 1e-3)
    // Velocity should have non-positive component along normal (≈ +X) after collision.
    expect(body.velocity.x).toBeLessThanOrEqual(0)
  })

  it('keeps slow bodies on SAT path when under threshold', () => {
    const { physics } = makePhysics(() => [
      { min: { x: 0.3, y: -1 }, max: { x: 0.32, y: 1 } },
    ])

    physics.addRigidBody({
      id: 1,
      center: { x: 0, y: 0 },
      half: { x: 0.05, y: 0.05 },
      angle: 0,
      velocity: { x: 0.9, y: 0 }, // below 1 m/s threshold
      restitution: 0,
      friction: 0,
    })

    physics.fixedUpdate(0.8) // large dt to highlight tunneling if CCD triggers

    const body = physics.debugGetRigidBodies().find((b: any) => b.id === 1)!
    // Below threshold: should advance naively and tunnel past the first obstacle.
    expect(body.center.x).toBeGreaterThan(0.65)
  })

  it('respects per-body ccd=false override even if fast', () => {
    const { physics } = makePhysics(() => [
      { min: { x: 0.3, y: -1 }, max: { x: 0.32, y: 1 } },
    ])

    physics.addRigidBody({
      id: 1,
      center: { x: 0, y: 0 },
      half: { x: 0.05, y: 0.05 },
      angle: 0,
      velocity: { x: 10, y: 0 },
      restitution: 0,
      friction: 0,
      ccd: false,
    })

    physics.fixedUpdate(0.05)

    const body = physics.debugGetRigidBodies().find((b: any) => b.id === 1)!
    // CCD disabled per-body: should tunnel past the obstacle.
    expect(body.center.x).toBeGreaterThan(0.32 + body.half.x)
  })
})
