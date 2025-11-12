import { describe, it, expect } from 'vitest'
import { EventBus } from '../bus'

describe('EventBus: reentrancy guard (dev immediate semantics)', () => {
  it('publish inside read() does not synchronously deliver into the same read cycle', () => {
    const bus = new EventBus({ capacity: 16 })
    const ID = 9
    const cur = bus.subscribe('S', [{ channel: 'frameBegin', ids: [ID] }])
    const s0 = bus.publish('frameBegin', ID, () => {})
    const seen: number[] = []
    cur.read('frameBegin', (h) => {
      seen.push(h.seq)
      // Publishing here should not cause nested delivery into this same read
      bus.publish('frameBegin', ID, () => {})
    })
    // Only s0 seen in this cycle; the nested publish appears in the next read
    expect(seen).toEqual([s0])
    const later: number[] = []
    cur.read('frameBegin', (h) => later.push(h.seq))
    expect(later.length).toBe(1)
  })
})

