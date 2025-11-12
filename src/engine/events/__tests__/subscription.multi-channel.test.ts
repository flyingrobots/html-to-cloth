import { describe, it, expect } from 'vitest'
import { EventBus } from '../bus'

describe('Subscription lifecycle (multi-channel, dedup)', () => {
  it('multiple channels per subscriber with separate watermarks; dedup pairs', () => {
    const bus = new EventBus({ capacity: 16 })
    const ID = 10
    const cur = bus.subscribe('S', [
      { channel: 'frameBegin', ids: [ID] },
      { channel: 'frameEnd', ids: [ID] },
      { channel: 'frameBegin', ids: [ID] }, // duplicate on purpose
    ])
    const fb0 = bus.publish('frameBegin', ID, () => {})
    const fe0 = bus.publish('frameEnd', ID, () => {})
    const a: number[] = []
    const b: number[] = []
    cur.read('frameBegin', (h) => a.push(h.seq))
    cur.read('frameEnd', (h) => b.push(h.seq))
    expect(a).toEqual([fb0])
    expect(b).toEqual([fe0])
  })
})

