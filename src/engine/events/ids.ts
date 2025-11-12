export const EventIds = {
  PointerMove: 1,
  PerfRow: 2,
  CcdHit: 3,
} as const

export type EventIdName = keyof typeof EventIds

