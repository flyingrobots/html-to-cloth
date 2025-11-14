import { describe, it, expect } from 'vitest'
import { RigidStaticSystem } from '../rigidStaticSystem'
import { EventBus } from '../../events/bus'
import { EventIds } from '../../events/ids'

describe('RigidStaticSystem sleep heuristics', () => {
  it('emits Sleep event and stops integrating a body that stays below the velocity threshold', () => {
    const bus = new EventBus({ capacity: 64, mailboxCapacity: 64 })
    const sys = new RigidStaticSystem({
      bus,
      getAabbs: () => [],
      gravity: 0,
      // Small threshold and short frame window so the test remains fast.
      sleepVelocityThreshold: 0.01,
      sleepFramesThreshold: 4,
    })

    const cur = bus.subscribe('sleep-test', [
      { channel: 'fixedEnd', ids: [EventIds.Sleep] },
    ])

    const body = {
      id: 7,
      center: { x: 0, y: 0 },
      half: { x: 0.1, y: 0.1 },
      angle: 0,
      velocity: { x: 0.005, y: 0 }, // below threshold
      mass: 1,
      restitution: 0.1,
      friction: 0.5,
    }

    sys.addBody(body as any)

    const dt = 1 / 60
    let slept = false

    for (let i = 0; i < 10; i++) {
      sys.fixedUpdate(dt)
      cur.read('fixedEnd', (h, r) => {
        if ((h.id >>> 0) === EventIds.Sleep) {
          const id = r.u32[0] >>> 0
          expect(id).toBe(7)
          slept = true
        }
      })
      if (slept) break
    }

    expect(slept).toBe(true)

    // Once asleep, the body should stop moving substantially.
    const before = { x: body.center.x, y: body.center.y }
    for (let i = 0; i < 10; i++) {
      sys.fixedUpdate(dt)
    }
    const after = body.center
    expect(after.x).toBeCloseTo(before.x, 6)
    expect(after.y).toBeCloseTo(before.y, 6)
  })
})

