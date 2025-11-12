# Magic School Bus — Engine Events Bus Roadmap

We’re going to build the best event bus we have no business owning. This doc tracks the work as an actionable, test‑first checklist, plus design choices tailored to our engine (fixed step + frame systems, snapshot immutability, strict ordering).

## ✅ Goals

- Low‑GC, cache‑friendly, deterministic event delivery
- Typed events (single discriminated union), great DX, superb tests
- Deferred processing by phase (FixedStepEnd, FrameBegin, FrameEnd) to preserve coherency
- Watermark‑based consumption per system — no callbacks, no re‑entrancy
- Batching, back‑pressure, bounded memory, telemetry hooks

---

## [ ] Phase 0 — Foundations (Types + Store)

- [ ] Define `EngineEvent` discriminated union in `src/engine/events/types.ts`
  - [ ] Core: `wake|sleep|activate|deactivate|step|frame` (time/frame indices)
  - [ ] Input: `pointer:move|down|up` (canonical coords)
  - [ ] Physics: `collision`, `impulse`, `ccd:hit`, `pick`
  - [ ] Debug/Perf: `perf:row`, `overlay:*`
- [ ] `EventRing<T>`: bounded ring buffer with monotonic `seq`
  - [ ] API: `push(event)`, `sliceSince(seq)`, `clearTo(seq)`
  - [ ] GC‑light: struct‑of‑arrays or pooled objects
- [ ] `EventStore` with phase channels
  - [ ] Channels: `fixedEnd`, `frameBegin`, `frameEnd`, `immediate` (dev‑only)
  - [ ] Publish API enqueues into a channel; immediate only when explicitly enabled
  - [ ] Sequence generators per channel (u64 counter)
- [ ] `EventCursor` per subscriber (system) with watermarks per channel
  - [ ] API: `read(channel, fn)` processes events since last `seq`
  - [ ] No callbacks from the bus; systems pull during their update slot

## [ ] Phase 1 — Engine Integration

- [ ] Add `EventBusSystem` that advances phase channels:
  - [ ] On `fixedUpdate(dt)`: flush internal `fixedEnd` ring into “ready” for consumers
  - [ ] On `frameUpdate(dt)`: flush `frameBegin` at start and `frameEnd` at end
  - [ ] Expose `getBus()` on `EngineWorld`
- [ ] Add clocks: `frameIndex`, `fixedIndex`, timestamps; stamp events at publish time
- [ ] Telemetry: counters per channel (enqueued, dropped, delivered); histograms of batch sizes

## [ ] Phase 2 — Producers (Publishers)

- [ ] PointerInputSystem → publish `pointer:*` to `frameBegin`
- [ ] Simulation/Physics → publish `wake|sleep` and `impulse|collision` to `fixedEnd`
- [ ] CCD stepper → publish `ccd:hit` to `fixedEnd`
- [ ] Perf wrapper → publish `perf:row` to `frameEnd`

## [ ] Phase 3 — Consumers (Subscribers)

- [ ] DebugOverlaySystem → consumes `pointer`, `perf:row`, `collision`, `ccd:hit`
- [ ] Collision overlay (if present) → consumes `collision`, `impulse`, `ccd:hit`
- [ ] Inspector/Events panel → consumes everything; filterable
- [ ] Future RigidSystem/AI systems → consume `wake|sleep|collision`

## [ ] Phase 4 — UX + Tooling

- [ ] Dev toggle to switch immediate vs deferred (debug only)
- [ ] Bus panel: rates, back‑pressure, dropped counts, per‑type charts
- [ ] Log recorder: ring -> JSON export with replay script

## [ ] Phase 5 — Perf + Robustness

- [ ] Benchmarks: synthetic producers/consumers @ 60Hz & stress scenes
- [ ] Memory budget: cap per channel (evict oldest with counter)
- [ ] Fuzz tests: ordering, watermarks monotonicity, no re‑entrancy

---

## Repo Scan — Where events help most

MUST switch
- Pointer → Simulation/Overlay (src/engine/input/PointerInputSystem.ts, pointer mirroring in controller)
- Physics signals: `wake/sleep/activate/deactivate`, `collision/impulse`, CCD hits (src/lib/clothPhysics.ts, src/lib/simWorld.ts, src/engine/ccd/*)
- Perf rows from engine timings to overlay (timing currently piggybacks; make explicit)

SHOULD switch
- Debug UI → EngineActions: broadcast actions can be events for audit/undo (src/engine/debug/engineActions.ts)
- Controller lifecycle (activate/deactivate cloth) → structured `activate|deactivate` events (src/lib/clothSceneController.ts)

COULD switch
- Render settings toggles → overlay (wireframe/AABBs) as events rather than shared state
- Tessellation changes → event so controller and overlay cohere without direct calls

MEH
- Static AABB registry refreshes (resize/scroll) — current direct calls are fine; low value to eventize

---

## Design Discussion — Coherency vs. Events

Events can shred cache coherency if handled immediately. We’ll default to deferred processing per phase, with opt‑in immediate only in debug.

Recommended model for this engine:

- Publish‑then‑pull (no callbacks): systems publish into the bus; consumers read during their update slot using watermarks.
- Phase‑scoped channels: `fixedEnd` (physics outputs), `frameBegin` (input), `frameEnd` (perf/UI). This keeps hot data local and predictable.
- Watermarks per system per channel: each system remembers `seq` and calls `bus.read('fixedEnd', (ev) => …)` to process only new events.
- Batching: consumers iterate contiguous slices (struct‑of‑arrays or pooled objects) to maximize linear access.
- Immediate mode (dev‑only): a flag that synchronously invokes handlers for quick prototyping; disabled in production to preserve determinism.

Why not single global queue?
- Different coherency needs per phase (input before sim vs collisions after sim). Phase channels express intent and avoid re‑entrancy hazards.

Alternative: per‑domain queues owned by systems
- Viable, but central bus aids tooling (telemetry, logging, replay) and simplifies subscription API.

API sketch
```ts
type EngineEvent =
  | { type: 'pointer:move'; x: number; y: number; frame: number }
  | { type: 'collision'; a: Id; b: Id; n: Vec2; p?: Vec2; time: number }
  | { type: 'ccd:hit'; id: Id; t: number; n: Vec2; frame: number }
  | { type: 'perf:row'; id: string; ms: number; frame: number }

type Channel = 'fixedEnd' | 'frameBegin' | 'frameEnd' | 'immediate'

class EventBus {
  publish(channel: Channel, e: EngineEvent): void
  getCursor(systemId: string): EventCursor
}

class EventCursor {
  read(channel: Channel, fn: (e: EngineEvent) => void): void // advances watermark
}
```

Memory/GC strategy
- Pre‑size rings; reuse structs; avoid per‑event closures.
- Stamp frames/times once; no dynamic lookups on read path.

Determinism
- Bus sequences are monotonic; consumers process in publish order within each channel.
- No cross‑channel ordering guarantees beyond phase boundaries (by design).

---

## Acceptance Checklist

- [ ] All existing overlay/inspector use events; no direct cross‑system reads
- [ ] No re‑entrant callbacks from physics/input
- [ ] ≤ 0.5 ms overhead @ 60 Hz with current scenes
- [ ] Telemetry panel shows event rates, drops, and queue depth
- [ ] Unit + integration tests for ordering, watermarks, and phase boundaries

