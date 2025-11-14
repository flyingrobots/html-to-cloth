import { describe, it, expect } from 'vitest'
import { RigidStaticSystem } from '../rigidStaticSystem'
import { EventBus } from '../../events/bus'
import { EventIds } from '../../events/ids'

describe('RigidStaticSystem dynamic pairs (nudged A1)', () => {
  it('resolves dynamic–dynamic collisions and emits collision/impulse/wake events', () => {
    const bus = new EventBus({ capacity: 128, mailboxCapacity: 128 })
    const sys = new RigidStaticSystem({
      bus,
      getAabbs: () => [],
      gravity: 0,
      enableDynamicPairs: true,
    })

    const cur = bus.subscribe('test', [
      { channel: 'fixedEnd', ids: [EventIds.CollisionV2, EventIds.Impulse, EventIds.Wake] },
    ])

    const bodyA = {
      id: 1,
      center: { x: 0, y: 0.12 },
      half: { x: 0.1, y: 0.1 },
      angle: 0,
      velocity: { x: 0, y: -1 },
      mass: 1,
      restitution: 0.5,
      friction: 0.5,
    }
    const bodyB = {
      id: 2,
      center: { x: 0, y: 0 },
      half: { x: 0.1, y: 0.1 },
      angle: 0,
      velocity: { x: 0, y: 0 },
      mass: 1,
      restitution: 0.5,
      friction: 0.5,
    }

    sys.addBody(bodyA as any)
    sys.addBody(bodyB as any)

    sys.fixedUpdate(1 / 60)

    const seenCollisions: Array<{ a: number; b: number }> = []
    const seenImpulses = new Set<number>()
    const seenWake = new Set<number>()

    cur.read('fixedEnd', (h, r) => {
      const id = h.id >>> 0
      if (id === EventIds.CollisionV2) {
        seenCollisions.push({ a: r.u32[0] >>> 0, b: r.u32[1] >>> 0 })
      } else if (id === EventIds.Impulse) {
        seenImpulses.add(r.u32[0] >>> 0)
      } else if (id === EventIds.Wake) {
        seenWake.add(r.u32[0] >>> 0)
      }
    })

    expect(seenCollisions.length).toBeGreaterThan(0)
    expect(seenCollisions).toContainEqual({ a: 1, b: 2 })
    expect(seenImpulses.has(1)).toBe(true)
    expect(seenImpulses.has(2)).toBe(true)
    expect(seenWake.has(1)).toBe(true)
    expect(seenWake.has(2)).toBe(true)

    // Impulses should adjust velocities for both bodies.
    expect(bodyA.velocity.y).not.toBe(-1)
    expect(bodyB.velocity.y).not.toBe(0)
  })
})
