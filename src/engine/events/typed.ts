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

export type RegistryEventKind = 'add' | 'update' | 'remove'

/**
 * Publishes a lightweight registry event onto the Phase‑0 bus.
 *
 * Registry descriptors live in PhysicsRegistry; this event acts as a signal
 * that callers can use to refresh or inspect the registry state.
 */
export function publishRegistryEvent(bus: EventBus, channel: Channel, kind: RegistryEventKind) {
  const id =
    kind === 'add'
      ? EventIds.RegistryAdd
      : kind === 'update'
        ? EventIds.RegistryUpdate
        : EventIds.RegistryRemove

  return bus.publish(channel, id, () => {
    // Payload intentionally left empty for now; consumers rely on descriptors
    // from PhysicsRegistry and treat this as a change signal.
  })
}

export type WakeSleepEvent = {
  entityId: number
}

export function publishWake(bus: EventBus, channel: Channel, m: WakeSleepEvent) {
  return bus.publish(channel, EventIds.Wake, (w) => {
    w.u32[0] = m.entityId >>> 0
  })
}

export function publishSleep(bus: EventBus, channel: Channel, m: WakeSleepEvent) {
  return bus.publish(channel, EventIds.Sleep, (w) => {
    w.u32[0] = m.entityId >>> 0
  })
}

export type ImpulseEvent = {
  entityId: number
  impulse: { x: number; y: number }
}

export function publishImpulse(bus: EventBus, channel: Channel, m: ImpulseEvent) {
  return bus.publish(channel, EventIds.Impulse, (w) => {
    w.u32[0] = m.entityId >>> 0
    w.f32[0] = m.impulse.x
    w.f32[1] = m.impulse.y
  })
}

export type PickEvent = {
  entityId: number
  point: { x: number; y: number }
}

export function publishPick(bus: EventBus, channel: Channel, m: PickEvent) {
  return bus.publish(channel, EventIds.Pick, (w) => {
    w.u32[0] = m.entityId >>> 0
    w.f32[0] = m.point.x
    w.f32[1] = m.point.y
  })
}

