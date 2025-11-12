import { describe, it, expect } from 'vitest'
import { EventBus } from '../bus'

describe('EventBus: subscription lifecycle', () => {
  it('updateSubscription changes routing; unsubscribe stops delivery', () => {
    const bus = new EventBus({ capacity: 8 })
    const ID_A = 1, ID_B = 2
    const cur = bus.subscribe('C', [{ channel: 'fixedEnd', ids: [ID_A] }])

    const sA = bus.publish('fixedEnd', ID_A, () => {})
    const sB = bus.publish('fixedEnd', ID_B, () => {})
    const seen1: number[] = []
    cur.read('fixedEnd', (h) => seen1.push(h.seq))
    expect(seen1).toEqual([sA])

    // Switch to ID_B only
    bus.updateSubscription('C', [{ channel: 'fixedEnd', ids: [ID_B] }])
    const sA2 = bus.publish('fixedEnd', ID_A, () => {})
    const sB2 = bus.publish('fixedEnd', ID_B, () => {})
    const seen2: number[] = []
    cur.read('fixedEnd', (h) => seen2.push(h.seq))
    expect(seen2).toEqual([sB2])

    // Unsubscribe; no more delivery
    bus.unsubscribe('C')
    const sB3 = bus.publish('fixedEnd', ID_B, () => {})
    const seen3: number[] = []
    cur.read('fixedEnd', (h) => seen3.push(h.seq))
    expect(seen3).toEqual([])
  })
})

