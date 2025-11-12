import { describe, it, expect } from 'vitest'
import { EventBus } from '../bus'

const ID = 77

describe('Ring & Sequence Edge Cases', () => {
  it('Double wrap: fill channel 2× past capacity; seq monotonic; stale reads dropped', () => {
    const cap = 8
    const bus = new EventBus({ capacity: cap, mailboxCapacity: 64 })
    const c = bus.subscribe('S', [{ channel: 'frameBegin', ids: [ID] }])
    const seqs: number[] = []
    for (let i = 0; i < cap * 2; i++) seqs.push(bus.publish('frameBegin', ID, () => {}))
    const seen: number[] = []
    c.read('frameBegin', (h) => seen.push(h.seq))
    // Expect to see only the last `cap` seqs (old ones are stale)
    const tail = seqs.slice(-cap)
    expect(seen).toEqual(tail)
    // Seq monotonic
    for (let i = 1; i < seqs.length; i++) expect(seqs[i]).toBeGreaterThan(seqs[i - 1])
  })

  it('Simultaneous mailbox + channel wrap on publish', () => {
    const cap = 4
    const bus = new EventBus({ capacity: cap, mailboxCapacity: cap })
    const c = bus.subscribe('S', [{ channel: 'fixedEnd', ids: [ID] }])
    for (let i = 0; i < cap - 1; i++) bus.publish('fixedEnd', ID, () => {})
    // Next publish wraps mailbox and, soon after, channel
    const sWrap = bus.publish('fixedEnd', ID, () => {})
    const sNext = bus.publish('fixedEnd', ID, () => {})
    const seen: number[] = []
    c.read('fixedEnd', (h) => seen.push(h.seq))
    expect(seen.at(-2)).toBe(sWrap)
    expect(seen.at(-1)).toBe(sNext)
  })

  it('Off-by-one boundaries: publishing capacity then one more overwrites slot 0', () => {
    const cap = 4
    const bus = new EventBus({ capacity: cap, mailboxCapacity: 16 })
    const c = bus.subscribe('S', [{ channel: 'frameEnd', ids: [ID] }])
    const seqs: number[] = []
    for (let i = 0; i < cap; i++) seqs.push(bus.publish('frameEnd', ID, () => {}))
    const sMore = bus.publish('frameEnd', ID, () => {})
    const seen: number[] = []
    c.read('frameEnd', (h) => seen.push(h.seq))
    expect(seen).toEqual([seqs[1], seqs[2], seqs[3], sMore])
  })

  it('Stale-then-invalidate: stale wins', () => {
    const cap = 2
    const bus = new EventBus({ capacity: cap, mailboxCapacity: 8 })
    const c = bus.subscribe('S', [{ channel: 'frameBegin', ids: [ID] }])
    const s0 = bus.publish('frameBegin', ID, () => {})
    // Overwrite s0 by filling cap
    bus.publish('frameBegin', ID, () => {})
    bus.publish('frameBegin', ID, () => {})
    // Now invalidate s0 explicitly
    bus.invalidate('frameBegin', s0)
    const seen: number[] = []
    c.read('frameBegin', (h) => seen.push(h.seq))
    // We should only see the two newest; s0 was stale (classified as stale, not tombstone delivered)
    expect(seen.length).toBe(2)
    expect(seen[0]).toBeGreaterThan(s0)
  })
})

