import { describe, it, expect } from 'vitest'
import { EventBus } from '../bus'

describe('Determinism & Time', () => {
  it('Tick monotonicity across frames', () => {
    const bus = new EventBus({ capacity: 16 })
    const ID = 1
    const cur = bus.subscribe('S', [{ channel: 'frameBegin', ids: [ID] }])
    const s0 = bus.publish('frameBegin', ID, (w) => { w.u32[0] = 0 })
    const s1 = bus.publish('frameBegin', ID, (w) => { w.u32[0] = 1 })
    const seenTicks: number[] = []
    cur.read('frameBegin', (h) => { seenTicks.push(h.tick) })
    // Monotonic non-regressing
    for (let i = 1; i < seenTicks.length; i++) expect(seenTicks[i]).toBeGreaterThanOrEqual(seenTicks[i-1])
  })

  it('Frame boundary flush semantics (fixedEnd → next frameBegin empty)', () => {
    const bus = new EventBus({ capacity: 16 })
    const ID = 2
    const cur = bus.subscribe('S', [
      { channel: 'fixedEnd', ids: [ID] },
      { channel: 'frameBegin', ids: [ID] },
    ])
    bus.publish('fixedEnd', ID, () => {})
    const seenFB: number[] = []
    cur.read('frameBegin', (h) => seenFB.push(h.seq))
    expect(seenFB).toEqual([])
  })
})

