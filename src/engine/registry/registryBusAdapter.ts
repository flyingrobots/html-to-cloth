import type { Channel, EventBus } from '../events/bus'
import type { PhysicsRegistry, RegistryEvent } from './PhysicsRegistry'
import { publishRegistryEvent } from '../events/typed'

export type RegistryBusAdapterOptions = {
  channel?: Channel
}

/**
 * Wires a PhysicsRegistry onto the Phase‑0 EventBus.
 *
 * The adapter publishes a small typed event for each registry change, allowing
 * tooling (panels, overlays, analytics) to react without coupling to the
 * registry’s internal storage.
 */
export function attachRegistryToEventBus(
  registry: PhysicsRegistry,
  bus: EventBus,
  options: RegistryBusAdapterOptions = {}
) {
  const channel: Channel = options.channel ?? 'frameEnd'
  registry.on((event: RegistryEvent) => {
    switch (event.type) {
      case 'registry:add':
        publishRegistryEvent(bus, channel, 'add')
        break
      case 'registry:update':
        publishRegistryEvent(bus, channel, 'update')
        break
      case 'registry:remove':
        publishRegistryEvent(bus, channel, 'remove')
        break
      default:
        break
    }
  })
}

