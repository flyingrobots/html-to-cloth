import { describe, it, expect } from 'vitest'
import { EventBus } from '../bus'

describe('Metrics Accuracy', () => {
  it('reports tombstones, channel overflows, and mailbox drops correctly', () => {
    const bus = new EventBus({ capacity: 2, mailboxCapacity: 1 })
    const ID = 1
    const cur = bus.subscribe('S', [{ channel: 'frameBegin', ids: [ID] }])
    // Fill and overflow channel
    const s0 = bus.publish('frameBegin', ID, () => {})
    const s1 = bus.publish('frameBegin', ID, () => {})
    const s2 = bus.publish('frameBegin', ID, () => {}) // overwrites s0
    // Tombstone s1
    bus.invalidate('frameBegin', s1)
    // Mailbox overflow: with capacity=1, publish another without reading
    bus.publish('frameBegin', ID, () => {})
    // Read remaining
    cur.read('frameBegin', () => {})
    const m = bus.metrics()
    expect(m.drops.channel).toBeGreaterThanOrEqual(1)
    expect(m.drops.tombstone).toBeGreaterThanOrEqual(1)
    expect(m.drops.mailbox['S'] ?? 0).toBeGreaterThanOrEqual(1)
  })
})

