# Event Systems Feature Matrix and Merge Strategy

This report compares event systems across the codebase and active branches, then proposes a merge strategy that preserves the robust event architecture now on `main`.

## Matrix

| Capability | main (EventBus Phase 0) | feature/pointer-input-system | feat/physics-registry | newton/a1–a3 (PhysicsSystem epics) | feat/world-sleep-guard-and-tessellation-options |
|---|---|---|---|---|---|
| Bus model | SoA ring per channel with fixed-capacity slots | Simple global pub/sub (Set<listener>) | Simple global pub/sub | Simple global pub/sub | Uses Phase 0 bus from main (no new bus) |
| Channels | `frameBegin`, `fixedEnd`, `frameEnd`, `immediate` | None (single stream) | None | None | Same as main |
| Per-subscriber mailboxes | Yes (bounded ring per subscriber) | No | No | No | Yes |
| Backfill on subscribe | Yes (epoch-based, safe dedup) | No | No | No | Yes |
| Invalidation/tombstones | Yes (slot validity + tombstone metrics) | No | No | No | Yes |
| Deterministic ordering | Yes (seq/tick per channel) | Best-effort (listener iteration order) | Best-effort | Best-effort | Yes |
| Reentrancy guard on read | Yes | No | No | No | Yes |
| Metrics | Channel drops, tombstones, mailbox drops; overlay bars | None | None | None | Same as main |
| Overlay adapters | `EventOverlayAdapter`, `BusMetricsOverlaySystem`, `PerfEmitterSystem` | None | None | Some ad-hoc overlays in epics | Same as main |
| Pointer events | Published via bus (`EventIds.PointerMove` on `frameBegin`) | N/A (pointer system emits through local logic) | N/A | N/A | Same as main |
| Event typing/validation | IDs + payload lanes (Phase 0 fixed lanes) | Strong runtime validator for typed `EngineEvent` (collision, wake/sleep, registry, pick, impulse, collision‑v2) | Runtime validator for typed `EngineEvent` (subset) | Uses the same typed `EngineEvent` as pointer slice | Same as main |
| Tests | Determinism, invalidation, stale overwrite, mailbox, reentrancy, metrics, multi‑channel dedup | Bus basic + payload validation (subset) | Validation + basic bus emit/on | Emits events from RigidSystem tests (collision‑v2, impulses) | N/A |

Notes
- main: `EventBusSystem` + `EventBus` (`src/engine/events/bus.ts`) provide SoA buffers per channel, per‑subscriber mailboxes, backfill, invalidation, and metrics overlay systems. Pointer move is published each frame from `ClothSceneController`.
- pointer/physics‑registry/newton: ship a minimal global bus + rich typed payloads for physics/registry events; no channels/backfill/metrics.

## Comparison vs current main
- Robustness: main’s bus guarantees determinism, bounded memory, and backfill semantics; others favor simplicity and typed payloads.
- Observability: main includes perf emitter + metrics overlay; others do not.
- Integration surface: main is already wired into the controller, overlays, and tests; the other buses would duplicate functionality and fragment consumers.

## Merge Strategy
Goal: keep main’s Phase 0 bus as the single source of truth; map the typed physics/registry events onto it via adapters.

1) Adopt typed payloads on top of Phase 0
- Add a thin `events/typed.ts` utility on `main` that exposes helpers like `publishCollisionV2(bus, channel, manifold)` and `publishWake(bus, id)`; these pack into Phase‑0 lanes.
- Benefit: preserves Phase 0 determinism/metrics while gaining ergonomics and consistency for physics events.

2) Replace duplicate buses
- In pointer/newton/physics‑registry branches, delete their `src/engine/events/eventBus.ts` and rewire emitters to use `EventBusSystem.getBus()` from main.
- Map event types to channels: `collision/collision‑v2/impulse` → `fixedEnd`, `registry:*` → `frameEnd`, interactive control → `immediate`.

3) Keep overlays and metrics from main
- Retain `EventOverlayAdapter`, `PerfEmitterSystem`, and `BusMetricsOverlaySystem`; extend adapter to show physics event counters (by type) if useful.

4) Order of operations
- Step A: land the typed helpers on main (no behavior change).
- Step B: rebase pointer/newton/physics‑registry to import typed helpers; remove their global bus.
- Step C: enable per‑subscriber mailboxes where consumers benefit (UI panels, analytics).

5) Effort estimate
- Step A: 0.5–1 day (API + unit tests mapping typed events to lanes).
- Step B: 1–2 days per branch to replace imports and fix compile/tests; pointer/newton first since they emit most events.
- Step C: 0.5 day for overlay/metrics polish.

6) Risks and mitigations
- Risk: event flooding into mailboxes → rely on bus capacity and metrics to tune; add IDs per event kind to dedup where necessary.
- Risk: implicit ordering differences → channel mapping keeps physics emissions on `fixedEnd` after integration to match expectations.

## What to keep vs leave out
- Keep: main’s `EventBusSystem`, SoA channels, mailboxes, overlays, metrics, pointer publishing.
- Keep (from branches): typed `EngineEvent` shapes (collision‑v2, registry, impulse) and their tests; emit sites in rigid/registry code.
- Leave out: duplicate `eventBus.ts` implementations and any bespoke “global bus” usages in branches.

