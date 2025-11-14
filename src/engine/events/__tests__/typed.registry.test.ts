import { describe, it, expect } from 'vitest'
import { EventBus } from '../bus'
import { EventIds } from '../ids'
import { publishRegistryEvent } from '../typed'

describe('publishRegistryEvent', () => {
  it('publishes add/update/remove events onto the chosen channel', () => {
    const bus = new EventBus({ capacity: 16, mailboxCapacity: 16 })
    const cursor = bus.subscribe('test', [
      { channel: 'frameEnd', ids: [EventIds.RegistryAdd, EventIds.RegistryUpdate, EventIds.RegistryRemove] },
    ])

    publishRegistryEvent(bus, 'frameEnd', 'add')
    publishRegistryEvent(bus, 'frameEnd', 'update')
    publishRegistryEvent(bus, 'frameEnd', 'remove')

    const seen: number[] = []
    cursor.read('frameEnd', (h) => {
      seen.push(h.id >>> 0)
    })

    expect(seen).toContain(EventIds.RegistryAdd)
    expect(seen).toContain(EventIds.RegistryUpdate)
    expect(seen).toContain(EventIds.RegistryRemove)
  })
})

