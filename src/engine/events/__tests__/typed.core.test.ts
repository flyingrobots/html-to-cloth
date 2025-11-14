import { describe, it, expect } from 'vitest'
import { EventBus } from '../bus'
import { EventIds } from '../ids'
import { publishWake, publishSleep, publishImpulse, publishPick } from '../typed'

describe('typed event helpers (wake/sleep/impulse)', () => {
  it('publishes wake and sleep events with entity id in u32[0]', () => {
    const bus = new EventBus({ capacity: 16, mailboxCapacity: 16 })
    const cur = bus.subscribe('test', [
      { channel: 'fixedEnd', ids: [EventIds.Wake, EventIds.Sleep] },
    ])

    publishWake(bus, 'fixedEnd', { entityId: 42 })
    publishSleep(bus, 'fixedEnd', { entityId: 7 })

    const seen: Array<{ id: number; entityId: number }> = []
    cur.read('fixedEnd', (h, r) => {
      seen.push({ id: h.id >>> 0, entityId: r.u32[0] >>> 0 })
    })

    expect(seen).toContainEqual({ id: EventIds.Wake, entityId: 42 })
    expect(seen).toContainEqual({ id: EventIds.Sleep, entityId: 7 })
  })

  it('publishes impulse events with entity id and impulse vector', () => {
    const bus = new EventBus({ capacity: 16, mailboxCapacity: 16 })
    const cur = bus.subscribe('test', [
      { channel: 'fixedEnd', ids: [EventIds.Impulse] },
    ])

    publishImpulse(bus, 'fixedEnd', { entityId: 5, impulse: { x: 1.25, y: -0.5 } })

    let count = 0
    cur.read('fixedEnd', (h, r) => {
      expect(h.id >>> 0).toBe(EventIds.Impulse)
      expect(r.u32[0] >>> 0).toBe(5)
      expect(r.f32[0]).toBeCloseTo(1.25)
      expect(r.f32[1]).toBeCloseTo(-0.5)
      count++
    })
    expect(count).toBe(1)
  })

  it('publishes pick events with entity id and hit point', () => {
    const bus = new EventBus({ capacity: 16, mailboxCapacity: 16 })
    const cur = bus.subscribe('test', [
      { channel: 'frameEnd', ids: [EventIds.Pick] },
    ])

    publishPick(bus, 'frameEnd', { entityId: 3, point: { x: 0.25, y: -0.75 } })

    let seen = 0
    cur.read('frameEnd', (h, r) => {
      expect(h.id >>> 0).toBe(EventIds.Pick)
      expect(r.u32[0] >>> 0).toBe(3)
      expect(r.f32[0]).toBeCloseTo(0.25)
      expect(r.f32[1]).toBeCloseTo(-0.75)
      seen++
    })
    expect(seen).toBe(1)
  })
})
