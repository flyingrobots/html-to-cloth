import { describe, it, expect } from 'vitest'
import { RigidStaticSystem } from '../rigidStaticSystem'
import { EventBus } from '../../events/bus'
import { EventIds } from '../../events/ids'

describe('RigidStaticSystem (static-first)', () => {
  it('emits CollisionV2 on fixedEnd when dynamic OBB hits static AABB', () => {
    const bus = new EventBus({ capacity: 64, mailboxCapacity: 64 })
    const sys = new RigidStaticSystem({
      bus,
      getAabbs: () => [{ min: { x: -1, y: -0.1 }, max: { x: 1, y: 0 } }],
      gravity: 9.81,
    })
    // Subscribe to collision-v2
    const cur = bus.subscribe('test', [{ channel: 'fixedEnd', ids: [EventIds.CollisionV2] }])
    // One dynamic body just above the ground moving down
    sys.addBody({ id: 42, center: { x: 0, y: 0.05 }, half: { x: 0.1, y: 0.1 }, angle: 0, velocity: { x: 0, y: -0.1 }, restitution: 0.2, friction: 0.3 })
    sys.fixedUpdate(1 / 60)
    let count = 0
    cur.read('fixedEnd', (h, r) => {
      expect(h.id >>> 0).toBe(EventIds.CollisionV2)
      const depth = r.f32[4]
      expect(typeof depth).toBe('number')
      count++
    })
    expect(count).toBeGreaterThan(0)
  })

  it('exposes a debug snapshot of rigid bodies', () => {
    const bus = new EventBus({ capacity: 64, mailboxCapacity: 64 })
    const sys = new RigidStaticSystem({
      bus,
      getAabbs: () => [],
      gravity: 0,
    })

    sys.addBody({
      id: 1,
      center: { x: 1, y: 2 },
      half: { x: 0.5, y: 0.25 },
      angle: 0,
      velocity: { x: 0, y: 0 },
      restitution: 0.1,
      friction: 0.5,
    } as any)

    const bodies = sys.debugGetBodies()
    expect(bodies).toHaveLength(1)
    expect(bodies[0]).toMatchObject({
      id: 1,
      center: { x: 1, y: 2 },
      half: { x: 0.5, y: 0.25 },
    })
  })
})
