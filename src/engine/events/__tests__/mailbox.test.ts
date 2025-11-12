import { describe, it, expect } from 'vitest'
import { EventBus } from '../bus'

describe('EventBus: per-subscriber mailboxes', () => {
  it('routes only subscribed event ids to each subscriber mailbox', () => {
    const bus = new EventBus({ capacity: 8, mailboxCapacity: 8 })
    const ID_A = 100
    const ID_B = 200

    const a = bus.subscribe('A', [ { channel: 'fixedEnd', ids: [ID_A] } ])
    const b = bus.subscribe('B', [ { channel: 'fixedEnd', ids: [ID_B] } ])

    const s0 = bus.publish('fixedEnd', ID_A, (w) => { w.i32[0] = 1 })
    const s1 = bus.publish('fixedEnd', ID_B, (w) => { w.i32[0] = 2 })
    const s2 = bus.publish('fixedEnd', ID_A, (w) => { w.i32[0] = 3 })

    const seenA: number[] = []
    a.read('fixedEnd', (h) => seenA.push(h.seq))
    expect(seenA).toEqual([s0, s2])

    const seenB: number[] = []
    b.read('fixedEnd', (h) => seenB.push(h.seq))
    expect(seenB).toEqual([s1])
  })

  it('drops when a subscriber mailbox overflows without affecting others', () => {
    const bus = new EventBus({ capacity: 32, mailboxCapacity: 2 })
    const ID = 10
    const a = bus.subscribe('A', [{ channel: 'frameEnd', ids: [ID] }])
    const b = bus.subscribe('B', [{ channel: 'frameEnd', ids: [ID] }])
    // Publish 3 events; mailboxCapacity=2 → A or B will drop one if not read yet
    const s0 = bus.publish('frameEnd', ID, () => {})
    const s1 = bus.publish('frameEnd', ID, () => {})
    const s2 = bus.publish('frameEnd', ID, () => {})

    const seenA: number[] = []
    a.read('frameEnd', (h) => seenA.push(h.seq))
    const seenB: number[] = []
    b.read('frameEnd', (h) => seenB.push(h.seq))
    // At least one of the mailboxes must have dropped something, but not both necessarily the same
    expect(new Set([seenA.length, seenB.length]).has(2)).toBe(true)
    // Central ring still has all 3 slots; the other subscriber could still receive all 3
    expect(seenA.length + seenB.length).toBeGreaterThanOrEqual(5)
  })
})

