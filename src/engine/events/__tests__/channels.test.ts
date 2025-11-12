import { describe, it, expect } from 'vitest'
import { EventBus } from '../bus'

describe('EventBus: channels are independent', () => {
  it('publishes to different channels with independent seq spaces and delivery', () => {
    const bus = new EventBus({ capacity: 8 })
    const ID = 7
    const cur = bus.subscribe('X', [
      { channel: 'frameBegin', ids: [ID] },
      { channel: 'fixedEnd', ids: [ID] },
    ])
    const sFB0 = bus.publish('frameBegin', ID, () => {})
    const sFE0 = bus.publish('fixedEnd', ID, () => {})

    const seenFB: number[] = []
    const seenFE: number[] = []
    cur.read('frameBegin', (h) => seenFB.push(h.seq))
    cur.read('fixedEnd', (h) => seenFE.push(h.seq))

    expect(seenFB).toEqual([sFB0])
    expect(seenFE).toEqual([sFE0])
  })
})

