# Engine Event Bus — Spec (Phase 0)

Status: Draft (tests-first)
Scope: Types + rings + bus core (no producers/consumers wired yet)

## Design Goals

- Deterministic, zero-reentrancy publish → consume model
- Low-GC, cache-friendly delivery via struct-of-arrays rings
- Deferred processing by phase: `frameBegin`, `fixedEnd`, `frameEnd` (plus `immediate` debug)
- Per-subscriber watermarks, mailbox index rings; skip invalidated tombstones and detect stale overwrites
- Preallocated buffers; bounded memory; drop metrics

## Core Concepts

- Channel: logical phase sink; each channel owns a central SoA EventRing
- Event slot: fixed-size header + numeric lanes (f32/i32/u32) + string indices
- Header flags: `valid` bit; tombstoned events are skipped by readers
- Mailbox: per-subscriber u32 ring of event seq indices for each channel
- Watermark: per-subscriber, per-channel last delivered seq index

## Public API (Phase 0)

```ts
// Channels
export type Channel = 'frameBegin' | 'fixedEnd' | 'frameEnd' | 'immediate'

// Event identifiers (opaque numeric)
export type EventId = number

// Ring capacity options
export type BusOptions = {
  capacity?: number // per-channel slots
  mailboxCapacity?: number // per-subscriber index slots
}

// Bus
export class EventBus {
  constructor(opts?: BusOptions)
  publish(channel: Channel, id: EventId, pack: (w: EventWriter) => void): number // returns seq
  invalidate(channel: Channel, seq: number): void
  subscribe(subscriberId: string, wants: { channel: Channel; ids: EventId[] }[]): EventCursor
  getCursor(subscriberId: string): EventCursor | null
  metrics(): BusMetrics
}

export class EventCursor {
  // Process events for a channel since watermark; returns count delivered
  read(channel: Channel, fn: (h: EventHeaderView, r: EventReader) => void): number
  // Move watermark to head (fast-forward; test helper)
  fastForward(channel: Channel): void
}

// Writer/Reader over lanes for the current slot
export interface EventWriter {
  f32: Float32Array // view over this slot
  i32: Int32Array
  u32: Uint32Array
  s: Uint32Array // string table indices
}

export interface EventReader {
  f32: Float32Array
  i32: Int32Array
  u32: Uint32Array
  s: Uint32Array
}

export interface EventHeaderView {
  id: EventId
  seq: number        // f64 logical sequence for the channel
  frame: number      // u32 frame index
  tick: number       // u32 deterministic tick (phase‑relative)
  valid: boolean     // false => tombstone, MUST be skipped
}
```

## Behaviour Rules

- Publish writes one slot in the channel ring (payload first, header last), sets `valid=1`, returns seq
- Delivery uses mailboxes:
  - Bus appends `seq` to each subscribed mailbox for the event id/channel
  - Cursor.read iterates mailbox indices in publish order
  - If slot header.seq !== mailbox seq (stale/overwritten), drop for this subscriber (overflow), advance mailbox head; watermark unchanged
  - If slot is invalid (`valid=0`), drop (tombstone), advance mailbox head; watermark unchanged
- Invalidate: sets header `valid=0` for the slot (tombstone)
- Overflows:
  - Channel ring: overwrite policy; metrics.drops.channel++ (future: guard by frame boundary)
  - Mailbox ring: drop for that subscriber only; metrics.drops.mailbox[subscriberId]++

## Capacities & Indexing

- Channel ring capacities are powers of two; ring index = (seq & (capacity - 1))
- Mailbox capacities are powers of two as well

## Lanes (Phase 0 constants)

- f32 lane length: 16
- i32 lane length: 8
- u32 lane length: 8
- s lane length: 4

## Tests (Phase 0)

- Rings
  - Push/wrap returns increasing seq; header.valid default true
  - Invalidate then read skips slot
  - Overwrite while unread → stale detection drops the old mailbox entry
- Mailboxes
  - Subscribe A,B; publish one id; both mailboxes receive seq
  - Unrelated id does not enter mailbox
  - Mailbox overflow drops for that subscriber only
- Update/unsubscribe: updateSubscription/unsubscribe change routing and stop delivery
- Bus read
  - read() delivers only subscribed ids in order; advances watermark
  - Skips tombstones
  - Fast-forward jumps to head without delivering
  - Channels are independent (seq spaces per channel)
  - Reentrancy guard: publish inside read does not synchronously deliver to the same read call

## Deferred work

- String table intern + dev hydration
- Perf panel events
- Immediate mode (dev only; guarded to avoid reentrancy) 
- Backpressure policies (frame-bounded delivery limits)
