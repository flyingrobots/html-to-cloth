import { describe, it, expect } from 'vitest'
import { EventBus } from '../bus'

// Overwrite detection: mailbox seq points to a slot that has since been overwritten by ring wrap
// Reader must treat it as stale and drop it (advance mailbox head, watermark unchanged for that slot)

describe('EventBus: stale detection on overwrite', () => {
  it('drops stale mailbox entries when channel ring overwrites old slots', () => {
    const cap = 4 // tiny to force wrap
    const bus = new EventBus({ capacity: cap, mailboxCapacity: 16 })
    const ID = 42
    const cur = bus.subscribe('S', [{ channel: 'frameBegin', ids: [ID] }])

    // Publish cap events so mailbox has [0..cap-1]
    const seqs: number[] = []
    for (let i = 0; i < cap; i++) seqs.push(bus.publish('frameBegin', ID, () => {}))

    // Do NOT read yet; now publish one more to overwrite slot 0
    const seqWrap = bus.publish('frameBegin', ID, () => {})

    // Read: expect to receive the last cap events except the stale first one
    const seen: number[] = []
    cur.read('frameBegin', (h) => seen.push(h.seq))

    // Since capacity=4 and we published 5, the oldest (seqs[0]) is stale
    const expected = [seqs[1], seqs[2], seqs[3], seqWrap]
    expect(seen).toEqual(expected)
  })
})

