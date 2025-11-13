import { describe, it, expect } from 'vitest'
import { EventBus } from '../bus'

describe('EventBus.stats()', () => {
  it('reports channel watermarks and subscriber mailbox lengths', () => {
    const bus = new EventBus({ capacity: 8, mailboxCapacity: 8 })
    // Subscribe to an arbitrary id on frameBegin
    const id = 123 as number
    const cur = bus.subscribe('test-subscriber', [{ channel: 'frameBegin', ids: [id] }])
    // Publish a couple of events
    for (let i = 0; i < 3; i++) {
      bus.publish('frameBegin', id, (w) => { w.f32[0] = i })
    }
    const s = bus.stats()
    expect(s.capacity).toBe(8)
    expect(s.mailboxCapacity).toBe(8)
    // Watermarks advance
    expect(s.channels.frameBegin.seqHead).toBeGreaterThanOrEqual(3)
    // One subscriber exists
    expect(s.subscribers.total).toBe(1)
    expect(s.subscribers.mailboxes.length).toBe(1)
    const mb = s.subscribers.mailboxes[0]
    expect(mb.frameBegin).toBeGreaterThan(0)
    // Read some events to drain mailbox
    cur.read('frameBegin', () => {}, 2)
    const s2 = bus.stats()
    const mb2 = s2.subscribers.mailboxes[0]
    expect(mb2.frameBegin).toBeLessThanOrEqual(mb.frameBegin)
  })
})

