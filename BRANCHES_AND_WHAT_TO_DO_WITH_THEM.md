# Branches — Comparison and Merge Plan (SITREP 2025-11-12)

This document summarizes the current state on `main`, compares unmerged branches, and recommends what (and how) to merge, what to keep, and in what order.


## 1) SITREP
- Current main includes:
  - Event Bus Phase 0 (SoA rings, channels, mailboxes) + overlays/metrics.
  - CCD Phase A demo (feature-flagged): ray slabs, circle TOI, swept OBB→AABB/OBB, `CcdStepperSystem` + overlay.
  - Specs for non‑modal Events panel and wireframe overlay pass (tests-only).
- Status: 150/150 unit tests passing after merges. App remains Mantine v7 + TS.
- Outstanding branches ahead of `main` (local):
  - feature/pointer-input-system (ahead 42)
  - feat/physics-registry (ahead 14)
  - newton/a1-physics-system (ahead 16); newton/a2-worldxform (24); newton/a3-sleep-neighbor-ux (28)
  - feat/world-sleep-guard-and-tessellation-options (47)
  - feat/mantine-migration (22); feat/manual-qa-checklist (19)
  - feat/xforms (33)
  - fix/canonical-mapping (4); chore/impulse-scaling (1)


## 2) Feature Matrix (high‑level)

| Branch | Events (bus) | Physics (rigid) | CCD | Registry | UI/Routes | Docs | Tests present | Risk |
|---|---|---|---|---|---|---|---|---|
| main | Phase 0 (channels+mailboxes+metrics) | – | Demo (flag) | – | Mantine v7 TS; no new routes | Yes | Yes (150+) | – |
| feature/pointer-input-system | Minimal global bus + typed events | Yes: OBB impulses, dynamic–dynamic, neighbor‑wake | Swept variant (off) | Yes | Adds sandbox & overlays | Yes | Many rigid/picking/manifold | High |
| feat/physics-registry | Minimal bus + typed registry events | Scaffolding + SAT tests | – | Yes (`PhysicsRegistry`) | – | Yes | Registry+SAT | Medium |
| newton/a1-physics-system | Minimal bus + typed | Yes: `RigidSystem` + `PhysicsSystem` (rigid→cloth) | – (planned later) | Consumed | – | – | Physics system + SAT | High |
| newton/a2-worldxform | Minimal bus + typed | Yes (as A1) | – | Consumed | WorldXform, picking, optional `/sandbox` | – | Some Playwright scaffolding | Med/High |
| newton/a3-sleep-neighbor-ux | Minimal bus + typed | Yes (as A1) + UX | – | Consumed | Overlay/UX tweaks | – | Overlay/UX tests | Medium |
| feat/world-sleep-guard-and-tessellation-options | Uses main’s bus | SAT-ready structure, UX changes | – | – | Overlay/events breadth | Yes | Mixed | High |
| feat/mantine-migration | – | – | – | – | JS Mantine app, legacy controller; replaces TS | Yes | Mixed JS tests | Medium (stale) |
| feat/manual-qa-checklist | – | – | – | – | Small QA toggles/guards | – | Minimal | Low (stale) |
| feat/xforms | – | – | – | – | Legacy engine core | Some | – | High (obsolete) |
| fix/canonical-mapping | – | – | – | – | Minor build/TS refactor | – | – | Low (stale) |
| chore/impulse-scaling | – | – | – | – | Chore/docs | – | – | Low (obsolete) |

Legend: “Minimal bus” = simple pub/sub (no channels/mailboxes). Risk reflects breadth + staleness + conflict likelihood.


## 3) Categories of Changes
- Core Physics/Newton: feat/physics-registry, newton/a1, a2, a3, feat/world-sleep-guard-and-tessellation-options.
- Pointer+Rigid integration slice: feature/pointer-input-system.
- UI/Mantine: feat/mantine-migration, feat/manual-qa-checklist.
- Legacy/Obsolete: feat/xforms, chore/impulse-scaling, fix/canonical-mapping.


## 4) Recommended — What to Bring to Main
- Typed event helpers for Phase 0: thin wrappers to publish `collision-v2`, `impulse`, `wake/sleep`, and `registry:*` onto the Phase‑0 channels.
- Physics foundations (sliced):
  - SAT helpers + unit tests.
  - `PhysicsRegistry` API (feature‑flagged, no UI coupling initially).
  - Static‑first `RigidSystem` (dynamic OBB vs static AABB/OBB), impulses (normal+friction), emit `collision-v2` on `fixedEnd`.
  - `PhysicsSystem` orchestrator (rigid→cloth lane order) once static‑first is stable.
- Optional dev‑only: WorldXform + picking utilities and a gated `/sandbox` route.
- Events Panel UI: implement from the specs already on main; consume Phase 0 mailboxes (Cmd/Ctrl+E).


## 5) Recommended — What to Keep From Main (do not replace)
- EventBus Phase 0 as canonical (channels, mailboxes, metrics, overlays).
- `ClothSceneController`/EngineWorld architecture and system priorities.
- Mantine v7 TypeScript app shell (`App.tsx`, `main.tsx`) and EngineActions wiring.
- CCD demo and toggles (keep CCD off by default until rigid lane lands, then integrate deliberately).
- Test configuration split (Vitest unit vs Playwright e2e), and the passing unit suites.


## 6) Recommended Merge Sequence (sliced) — With Risks and Tests
1) Add typed event helper API atop Phase 0 (no behavior change)
   - Risks: None beyond minor API surface.
   - Tests: Unit tests that map typed structures → Phase‑0 lanes; ensure determinism across channels; mailbox backfill for new subscribers.

2) Cherry‑pick docs + SAT helpers + tests (from feat/physics-registry)
   - Risks: Low.
   - Tests: SAT unit suites run on main; keep independent of controller.

3) Introduce `PhysicsRegistry` (flagged) and map its events via typed helpers
   - Risks: Low/Medium (new API surface, no runtime coupling yet).
   - Tests: Registry add/update/remove validation; event publishing to Phase‑0 `frameEnd`.

4) Static‑first `RigidSystem` + `collision-v2` emitters
   - Risks: Medium (new system + step order).
   - Trouble to expect: priority interactions with SimulationSystem; overlay idempotency; pointer/overlay perf.
   - Tests (before/after):
     - OBB vs static AABB/OBB collision determinism (depth, normal, contact features).
     - No‑jitter rest acceptance (box settling on ramp/floor).
     - Event emission invariants: one `collision-v2` per contact set; no duplicates across frames.

5) `PhysicsSystem` orchestrator (rigid → cloth), keep CCD off
   - Risks: Medium; step ordering.
   - Trouble: pause/step idempotency, perf budgets.
   - Tests: Engine step integration; pausing while overlay renders; real‑time toggle idempotency.

6) Dynamic–dynamic + neighbor‑wake (guarded)
   - Risks: Medium/High; more contacts, wake chains.
   - Trouble: tunneling without CCD; jitter at rest; mailbox pressure.
   - Tests: head‑on OBB pair rest without jitter; wake propagation depth; mailbox drop metrics stay under threshold.

7) Optional world xform + picking + gated `/sandbox`
   - Risks: Medium if route leaks into prod.
   - Tests: route flagging; picking ray tests; Playwright smoke behind flag.

8) Optional CCD integration into rigid lane (keep off by default)
   - Risks: Medium.
   - Tests: Thin‑wall acceptance at 1 substep; mixed rigid/cloth frame stability.


## 7) Branch‑by‑Branch Breakdown

### feature/pointer-input-system (ahead 42) — High risk
- Has vs main:
  - Rigid pipeline (dynamic OBBs, impulses with friction), neighbor‑wake, collision‑v2, simple bus, pointer system, registry, overlays, sandbox/e2e, many tests.
- Worth merging?
  - Not wholesale. Mine: physics narrow‑phase implementations, impulse logic, tests. Replace its bus with Phase 0 and rewire emitters.
- Conflicts/trouble:
  - Duplicates event bus; rewires controller, overlays, and UI; wide surface.
- Tests to write/keep:
  - Keep manifold/impulse tests; add integration on Phase 0 (`fixedEnd`) and mailbox pressure tests.

### feat/physics-registry (ahead 14) — Medium risk
- Has vs main:
  - `PhysicsRegistry`, SAT helpers/tests, instrumentation, typed event validation.
- Worth merging?
  - Yes, sliced: docs + SAT + tests first; then registry API behind a feature flag; no UI coupling.
- Conflicts/trouble:
  - Minimal; ensure no duplicate event bus.
- Tests:
  - Registry validation + publish to Phase 0; SAT suites.

### newton/a1-physics-system (ahead 16) — High risk
- Has vs main:
  - `RigidSystem` and two‑lane `PhysicsSystem` (rigid → cloth), perf rows, collision‑v2 emitters.
- Worth merging?
  - Yes, sliced after registry and static‑first rigid pass (disable dynamic–dynamic initially).
- Conflicts/trouble:
  - Step ordering, overlay priority, EventBus mapping.
- Tests:
  - Rigid–static determinism; event emission; pause/step idempotency; perf budgets.

### newton/a2-worldxform (ahead 24) — Med/High risk
- Has vs main:
  - World transform utilities, rigid picking, optional `/sandbox` route, Playwright scaffolding.
- Worth merging?
  - Utilities yes; route only behind a dev flag. Prefer to keep product routes unchanged.
- Conflicts/trouble:
  - Route/UI churn, controller wiring if not isolated.
- Tests:
  - Route flagging; picking ray tests; Playwright smoke.

### newton/a3-sleep-neighbor-ux (ahead 28) — Medium risk
- Has vs main:
  - Sleep/wake UX overlays; viewport width config; events/overlay changes.
- Worth merging?
  - After A1/A2 land; implement within existing `DebugOverlaySystem` instead of new systems.
- Conflicts/trouble:
  - Overlay duplication; state model drift.
- Tests:
  - Overlay idempotency; wake visualization correctness.

### feat/world-sleep-guard-and-tessellation-options (ahead 47) — High risk
- Has vs main:
  - Project Newton docs + broad UX improvements (overlay/events), SAT‑ready structure.
- Worth merging?
  - Defer; mine docs/specs only. Code surfaces overlap A1/A3.
- Conflicts/trouble:
  - Large UI/overlay surface; likely conflicts with controller/render.
- Tests:
  - N/A unless specific small pieces are cherry‑picked.

### feat/mantine-migration (ahead 22) — Medium risk (stale)
- Has vs main:
  - Older Mantine JS app (`App.jsx`, `main.jsx`), replaces TS configs; legacy controller.
- Worth merging?
  - No. Only cherry‑pick small, self‑contained improvements (if any) and port to TS.
- Conflicts/trouble:
  - Replaces TS app shell, removes tsconfig; breaks current architecture.
- Tests:
  - N/A (skip wholesale merge).

### feat/manual-qa-checklist (ahead 19) — Low risk (stale)
- Has vs main:
  - Small guards and QA toggles.
- Worth merging?
  - Maybe cherry‑pick if still relevant; otherwise close.
- Conflicts/trouble:
  - Minimal; ensure duplicates aren’t reintroduced.
- Tests:
  - Tiny unit tests for any retained guard logic.

### feat/xforms (ahead 33) — High risk (obsolete)
- Has vs main:
  - Legacy engine core (“caverns‑inspired”).
- Worth merging?
  - No. Conflicts with EngineWorld/SimulationSystem architecture.

### fix/canonical-mapping (ahead 4) — Low risk (stale)
- Has vs main:
  - Small TS/build refactor.
- Worth merging?
  - Not urgent. Re‑evaluate only if we hit the specific build issue.

### chore/impulse-scaling (ahead 1) — Low risk (obsolete)
- Has vs main:
  - Chore/docs.
- Worth merging?
  - Close.


## 8) Recommended One‑Pager (if we start merging Newton later)
- Keep Phase 0 bus; add typed wrappers; rip out duplicate buses in branches during rebase.
- Land physics in slices: docs+SAT → registry (flagged) → static‑first rigid → orchestrator → dynamic–dynamic+wake → world xform/picking (flagged) → sleep UX → CCD integration (off by default).
- Build the Events panel now on main; use it to monitor collisions and registry changes once physics lands.

