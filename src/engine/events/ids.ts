export const EventIds = {
  PointerMove: 1,
  PerfRow: 2,
  CcdHit: 3,
  CollisionV2: 4,
  RegistryAdd: 5,
  RegistryUpdate: 6,
  RegistryRemove: 7,
  Wake: 8,
  Sleep: 9,
  Impulse: 10,
  Pick: 11,
  OverlayReady: 12,
  AABBReady: 13,
} as const

export type EventIdName = keyof typeof EventIds
