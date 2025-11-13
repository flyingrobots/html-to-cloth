import type { EventBus, Channel } from './bus'
import { EventIds } from './ids'

export type CollisionV2 = {
  entityAId: number
  entityBId: number
  normal: { x: number; y: number }
  contact: { x: number; y: number }
  depth: number
}

export function publishCollisionV2(bus: EventBus, channel: Channel, m: CollisionV2) {
  return bus.publish(channel, EventIds.CollisionV2, (w) => {
    // u32: entity ids
    w.u32[0] = m.entityAId >>> 0
    w.u32[1] = m.entityBId >>> 0
    // f32: normal.x, normal.y, contact.x, contact.y, depth
    w.f32[0] = m.normal.x
    w.f32[1] = m.normal.y
    w.f32[2] = m.contact.x
    w.f32[3] = m.contact.y
    w.f32[4] = m.depth
  })
}

