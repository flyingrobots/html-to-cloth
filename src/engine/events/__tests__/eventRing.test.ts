import { describe, it, expect } from 'vitest'

import { EventBus, type Channel } from '../bus'

// Phase 0 spec tests — failing until bus core is implemented

describe('EventBus: Rings & Tombstones', () => {
  it('publishes to a channel ring and returns increasing seq; invalidation tombstones the slot', () => {
    const bus = new EventBus({ capacity: 8 })
    const id = 1 // test event id
    const seq0 = bus.publish('frameBegin', id, (w) => {
      w.f32[0] = 1.23
    })
    const seq1 = bus.publish('frameBegin', id, (w) => {
      w.f32[0] = 4.56
    })
    expect(seq1).toBeGreaterThan(seq0)

    // Subscribe a reader and verify both are delivered
    const cur = bus.subscribe('S', [{ channel: 'frameBegin', ids: [id] }])
    const delivered: number[] = []
    cur.read('frameBegin', (h, r) => {
      delivered.push(h.seq)
      expect(h.valid).toBe(true)
    })
    expect(delivered).toEqual([seq0, seq1])

    // Invalidate the last, publish a third; reader should skip the tombstone
    bus.invalidate('frameBegin', seq1)
    const seq2 = bus.publish('frameBegin', id, (w) => { w.f32[0] = 7.89 })
    const delivered2: number[] = []
    cur.read('frameBegin', (h, r) => { delivered2.push(h.seq) })
    expect(delivered2).toEqual([seq2])
  })
})

