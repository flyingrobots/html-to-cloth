import { describe, it, expect } from 'vitest'
import { EventBus } from '../bus'

describe('Tombstone & Invalidation semantics', () => {
  it('Invalidate before vs after read: watermark semantics', () => {
    const bus = new EventBus({ capacity: 8 })
    const ID = 8
    const c = bus.subscribe('S', [{ channel: 'frameBegin', ids: [ID] }])
    const s0 = bus.publish('frameBegin', ID, () => {})
    const s1 = bus.publish('frameBegin', ID, () => {})

    // Invalidate s1 before read; expect only s0 delivered
    bus.invalidate('frameBegin', s1)
    const seen1: number[] = []
    c.read('frameBegin', (h) => seen1.push(h.seq))
    expect(seen1).toEqual([s0])

    // Publish s2 and read once; then invalidate s2 after read (no retroactive effect)
    const s2 = bus.publish('frameBegin', ID, () => {})
    const seen2: number[] = []
    c.read('frameBegin', (h) => seen2.push(h.seq))
    expect(seen2).toEqual([s2])
    bus.invalidate('frameBegin', s2)
    const seen3: number[] = []
    c.read('frameBegin', (h) => seen3.push(h.seq))
    expect(seen3).toEqual([])
  })

  it('Double invalidation is idempotent', () => {
    const bus = new EventBus({ capacity: 8 })
    const ID = 2
    const s = bus.publish('fixedEnd', ID, () => {})
    bus.invalidate('fixedEnd', s)
    bus.invalidate('fixedEnd', s)
    const c = bus.subscribe('S', [{ channel: 'fixedEnd', ids: [ID] }])
    const seen: number[] = []
    c.read('fixedEnd', (h) => seen.push(h.seq))
    expect(seen).toEqual([])
  })

  it('Invalidating overwritten slot is ignored and does not corrupt current header', () => {
    const cap = 2
    const bus = new EventBus({ capacity: cap })
    const ID = 1
    const c = bus.subscribe('S', [{ channel: 'frameEnd', ids: [ID] }])
    const s0 = bus.publish('frameEnd', ID, () => {})
    const s1 = bus.publish('frameEnd', ID, () => {})
    const s2 = bus.publish('frameEnd', ID, () => {}) // overwrites slot of s0
    bus.invalidate('frameEnd', s0)
    const seen: number[] = []
    c.read('frameEnd', (h) => seen.push(h.seq))
    expect(seen).toEqual([s1, s2])
  })
})

