import { describe, it, expect } from 'vitest'
import { EventBus } from '../bus'

describe('EventCursor: read and fast-forward semantics', () => {
  it('read advances watermark; fastForward jumps to head without delivery', () => {
    const bus = new EventBus({ capacity: 8 })
    const ID = 5
    const cur = bus.subscribe('S', [{ channel: 'frameEnd', ids: [ID] }])
    const s0 = bus.publish('frameEnd', ID, () => {})
    const s1 = bus.publish('frameEnd', ID, () => {})
    const seen: number[] = []
    cur.read('frameEnd', (h) => seen.push(h.seq))
    expect(seen).toEqual([s0, s1])

    // Publish two more, but fast-forward skips delivery
    bus.publish('frameEnd', ID, () => {})
    bus.publish('frameEnd', ID, () => {})
    cur.fastForward('frameEnd')
    const later: number[] = []
    cur.read('frameEnd', (h) => later.push(h.seq))
    expect(later).toEqual([])
  })
})

