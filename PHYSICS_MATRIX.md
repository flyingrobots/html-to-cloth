# Physics and Collision Feature Matrix (main vs Newton branches)

This report summarizes collision/physics capabilities on `main` and contrasts them with the Newton branches (incl. the pointer slice), then proposes a safe merge plan.

## Matrix

| Capability | main (current) | feat/physics-registry | newton/a1-physics-system | newton/a2-worldxform | newton/a3-sleep-neighbor-ux | feature/pointer-input-system |
|---|---|---|---|---|---|---|
| Cloth simulation | Yes (Verlet, distance constraints via `SimWorld`) | Yes (unchanged; adds registry hooks) | Yes (run as “cloth lane” via `PhysicsSystem` orchestrator) | Yes | Yes | Yes |
| Rigid bodies (dynamic) | No (not integrated) | Partial scaffolding (registry + tests) | Yes (`RigidSystem` with dynamic OBBs, mass, restitution, friction) | Yes | Yes (adds wake UX) | Yes (similar to A1) |
| Static geometry | AABBs (DOM capture → AABBs for cloth collisions only) | AABBs declared in registry | AABBs and static OBB ramps for rigid | AABBs/OBBs | Same | AABBs/OBBs |
| Narrow phase | Cloth-only collisions | SAT helpers and tests (foundation) | SAT OBB↔AABB, OBB↔OBB (discrete), contact features | Same | Same | Same + more tests |
| Broad phase | Simple AABB interactions in `CollisionSystem` (cloth) | Registry can assist | Per‑update checks vs static lists; dynamic–dynamic checks | Same | Same | Same |
| Impulses/resolution | N/A (cloth uses constraint relaxation) | N/A | Yes (normal + friction impulses; dynamic–dynamic and dynamic–static) | Same | Same | Yes |
| Sleep/wake | Cloth thresholds (velocity/frame) with world‑space guard | Adds registry events for activate/deactivate | Adds rigid sleep heuristics; neighbor wake on impulses | Same | Adds UX toggles + visuals | Yes (neighbor wake, tests) |
| CCD | Minimal demo: ray slabs, circle TOI, swept OBB→AABB/OBB; `CcdStepperSystem` (feature flag) | Unused | Expected to integrate later via PhysicsSystem | – | – | Includes a `sweptTOI.ts` variant; CCD default off |
| Picking / world xform | No | No | No | Yes: `WorldXform`, rigid picking, `/sandbox` route | Yes (UX polish) | Yes (picking tests) |
| Registry | No formal registry | `PhysicsRegistry` (add/update/remove events) | Consumed by rigid lane | Consumed | Consumed | Present |
| Event emission | EventBus Phase 0 for pointer only | Typed events: registry + basic | Emits `collision-v2`, `impulse`, state events via typed bus | Same | Same | Same + extensive tests |
| Perf/metrics | Perf emitter rows for rendering; CCD overlay | Adds instrumentation in places | Adds perf rows `physics:rigid:fixed` and tracks steps | – | – | Similar perf monitor and overlay components |
| Tests | 150+ overall; cloth/engine/CCD | Adds SAT and registry unit tests | Adds physics system, rigid system, manifold, spawn separation | Adds Playwright skeleton for sandbox | Adds viewport/overlay UX tests | Many rigid/picking/manifold tests |

## Differences vs main
- main is cloth‑only plus a minimal, opt‑in CCD demo; no unified physics orchestrator and no rigid impulses.
- Newton branches introduce a two‑lane `PhysicsSystem` (rigid → cloth) with SAT narrow phase, impulses, registry, and optional sandbox route/UI.

## Merge Strategy (if we decide to bring Newton work into main)
Principles: keep main stable, land in thin slices, and reuse the existing engine/EventBus/overlay stack.

1) Docs and helpers first
- Cherry‑pick docs (Project Newton overview) and SAT helpers with unit tests only. Do not wire into controller.
- Effort: 0.5–1 day; Risk: low.

2) Registry and typed events
- Add `PhysicsRegistry` (API behind a feature flag) and map its events onto main’s EventBus Phase 0 via typed helper wrappers (see EVENT_MATRIX.md).
- Effort: 1 day; Risk: low/medium (API surface but no runtime coupling yet).

3) Rigid narrow phase (static‑first)
- Introduce `RigidSystem` with dynamic OBB vs static AABB/OBB collisions and impulses (normal + friction). Do not enable dynamic–dynamic initially; gate via feature flag.
- Emit `collision-v2` on `fixedEnd`. Keep CCD off.
- Effort: 2–3 days; Risk: medium (touches engine step order and controller wiring).

4) PhysicsSystem orchestrator
- Add `PhysicsSystem` to run rigid before cloth each fixed step; preserve current `SimulationSystem` IDs/priorities. Validate overlay and pause behavior.
- Effort: 1–2 days; Risk: medium.

5) Dynamic–dynamic + neighbor wake
- Enable dynamic–dynamic impulses and neighbor wake propagation; introduce tests for rest‑without‑jitter and wake chains.
- Effort: 2 days; Risk: medium/high.

6) World transforms + picking (A2)
- Add `WorldXform` and picking utilities; optionally add a dev‑only `/sandbox` route guarded behind an env flag so product routes remain unchanged.
- Effort: 1–2 days; Risk: medium (UI/route churn if not guarded).

7) Sleep UX polish (A3)
- Wire overlay affordances for sleep state and neighbor wake visualization; keep within existing `DebugOverlaySystem` to avoid new UI systems.
- Effort: 1 day; Risk: low/medium.

8) Optional CCD integration
- Replace the demo `CcdStepperSystem` with the branch’s CCD variant once rigid lane is stable; keep CCD off by default; expose toggles.
- Effort: 1–2 days; Risk: medium.

## What to keep vs leave out
- Keep from main: `SimulationSystem`, controller structure, EventBus Phase 0, overlays, and CCD demo (until replaced).
- Keep from Newton: SAT core, `RigidSystem`, `PhysicsSystem`, typed event emissions, registry, picking/world xform, and tests.
- Leave out (initially): New routes in production (keep sandbox behind a flag), any duplicate event bus, and large UI rewrites.

## Expected effort by branch group
- physics‑registry: 1–2 days (docs + registry API + tests; low churn).
- newton/a1: 4–6 days (rigid lane + orchestrator + tests; medium risk).
- newton/a2: 1–2 days (picking/world xform + optional sandbox flag; medium risk if routes change).
- newton/a3: 1 day (overlay UX polish; low/medium risk).
- feature/pointer‑input‑system: 4–7 days if merged instead of A1 (wider surface including duplicate bus and QA scaffolding); higher conflict risk. Prefer mining it for tests and specific implementations rather than merging wholesale.

