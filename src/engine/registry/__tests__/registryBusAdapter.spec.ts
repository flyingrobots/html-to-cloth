import { describe, it, expect, beforeEach } from 'vitest'
import { EventBus } from '../../events/bus'
import { EventIds } from '../../events/ids'
import { PhysicsRegistry, type RegistryEvent } from '../PhysicsRegistry'
import { attachRegistryToEventBus } from '../registryBusAdapter'

function mockRect(x: number, y: number, w: number, h: number): DOMRect {
  return {
    x,
    y,
    width: w,
    height: h,
    top: y,
    left: x,
    right: x + w,
    bottom: y + h,
    toJSON() {
      return {}
    },
  } as DOMRect
}

describe('attachRegistryToEventBus', () => {
  let registry: PhysicsRegistry
  let events: RegistryEvent[]

  beforeEach(() => {
    document.body.innerHTML = ''
    registry = new PhysicsRegistry()
    events = []
    registry.on((e) => events.push(e))
  })

  it('publishes registry add/update/remove events onto the bus', () => {
    const bus = new EventBus({ capacity: 64, mailboxCapacity: 64 })
    attachRegistryToEventBus(registry, bus)

    const cursor = bus.subscribe('test', [
      { channel: 'frameEnd', ids: [EventIds.RegistryAdd, EventIds.RegistryUpdate, EventIds.RegistryRemove] },
    ])

    const root = document.createElement('div')
    document.body.appendChild(root)

    const cloth = document.createElement('button')
    cloth.className = 'cloth-enabled'
    ;(cloth as any).getBoundingClientRect = () => mockRect(0, 0, 100, 50)
    root.appendChild(cloth)

    const rigid = document.createElement('div')
    rigid.className = 'rigid-static'
    ;(rigid as any).getBoundingClientRect = () => mockRect(10, 0, 50, 25)
    root.appendChild(rigid)

    registry.discover(document)

    const seenAdds: number[] = []
    cursor.read('frameEnd', (h) => {
      seenAdds.push(h.id >>> 0)
    })

    expect(seenAdds.filter((id) => id === EventIds.RegistryAdd).length).toBeGreaterThanOrEqual(2)

    // Trigger an update and a removal
    events = []
    cloth.dataset.physFriction = '0.1'
    rigid.remove()
    registry.discover(document)

    const seenLater: number[] = []
    cursor.read('frameEnd', (h) => {
      seenLater.push(h.id >>> 0)
    })

    expect(seenLater).toContain(EventIds.RegistryUpdate)
    expect(seenLater).toContain(EventIds.RegistryRemove)
  })
})

