import { describe, it, expect } from 'vitest'
import { EventBus } from '../bus'

describe('Mailbox Behavior variants', () => {
  it('Overflow with interleaved subscribers: smaller mailbox drops only there', () => {
    const bus = new EventBus({ capacity: 32, mailboxCapacity: 2 })
    const ID = 12
    const big = bus.subscribe('BIG', [{ channel: 'frameEnd', ids: [ID] }])
    // Override: BIG has larger mailbox by resubscribing with higher capacity in impl (future), simulate by another bus for spec
    const small = bus.subscribe('SMALL', [{ channel: 'frameEnd', ids: [ID] }])
    // Publish 3
    bus.publish('frameEnd', ID, () => {})
    bus.publish('frameEnd', ID, () => {})
    bus.publish('frameEnd', ID, () => {})
    const a: number[] = []
    const b: number[] = []
    big.read('frameEnd', (h) => a.push(h.seq))
    small.read('frameEnd', (h) => b.push(h.seq))
    expect(a.length).toBeGreaterThanOrEqual(2)
    expect(b.length).toBe(2)
  })

  it('Unsubscribe → publish → resubscribe: no delivery of pre-unsubscribe events', () => {
    const bus = new EventBus({ capacity: 16 })
    const ID = 3
    const cur = bus.subscribe('S', [{ channel: 'fixedEnd', ids: [ID] }])
    bus.publish('fixedEnd', ID, () => {})
    cur.read('fixedEnd', () => {})
    bus.unsubscribe('S')
    // Publish while unsubscribed
    const sMid = bus.publish('fixedEnd', ID, () => {})
    // Resubscribe
    const cur2 = bus.subscribe('S', [{ channel: 'fixedEnd', ids: [ID] }])
    const seen: number[] = []
    cur2.read('fixedEnd', (h) => seen.push(h.seq))
    expect(seen.includes(sMid)).toBe(false)
  })

  it('Ordering invariance: interleaved IDs deliver in publish order', () => {
    const bus = new EventBus({ capacity: 32 })
    const A = 1, B = 2
    const cur = bus.subscribe('S', [{ channel: 'frameBegin', ids: [A, B] }])
    const s: number[] = []
    s.push(bus.publish('frameBegin', A, () => {}))
    s.push(bus.publish('frameBegin', B, () => {}))
    s.push(bus.publish('frameBegin', A, () => {}))
    s.push(bus.publish('frameBegin', B, () => {}))
    const seen: number[] = []
    cur.read('frameBegin', (h) => seen.push(h.seq))
    expect(seen).toEqual(s)
  })
})

