import { describe, it, expect } from 'vitest'
import { RigidStaticSystem } from '../rigidStaticSystem'
import { EventBus } from '../../events/bus'
import { EventIds } from '../../events/ids'

describe('RigidStaticSystem impulses (static-first)', () => {
  it('applies restitution impulse on normal and reduces tangential velocity with friction', () => {
    const bus = new EventBus({ capacity: 64, mailboxCapacity: 64 })
    const sys = new RigidStaticSystem({
      bus,
      getAabbs: () => [{ min: { x: -1, y: -0.1 }, max: { x: 1, y: 0 } }],
      gravity: 0,
    })
    // Subscribe to collision-v2
    const cur = bus.subscribe('test', [{ channel: 'fixedEnd', ids: [EventIds.CollisionV2] }])

    // Body heading down and to the right; expect Y velocity to flip up (>=0) and X to reduce due to friction
    const body = { id: 7, center: { x: 0, y: 0.01 }, half: { x: 0.1, y: 0.1 }, angle: 0, velocity: { x: 1, y: -1 }, mass: 1, restitution: 0.5, friction: 0.5 }
    sys.addBody(body as any)
    sys.fixedUpdate(1 / 60)

    // Drain one collision
    let collisions = 0
    cur.read('fixedEnd', (h, r) => {
      expect(h.id >>> 0).toBe(EventIds.CollisionV2)
      collisions++
    })
    expect(collisions).toBeGreaterThan(0)
    // After impulse, Y velocity should be non-negative; X velocity should be reduced
    expect(body.velocity.y).toBeGreaterThanOrEqual(0 - 1e-6)
    expect(Math.abs(body.velocity.x)).toBeLessThan(1)
  })
})

