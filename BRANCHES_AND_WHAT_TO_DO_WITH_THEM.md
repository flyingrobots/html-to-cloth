# Branches & Newton Merge Plan — 2025‑11‑14

This document tracks:

- What `main` currently owns.
- What’s left from the Newton branches that we still want.
- What we are explicitly **not** going to merge and will treat as reference only.

Checkboxes (`- [ ]`) represent **future work** we intend (or may choose) to do on `main` rather than merging whole branches.

---

## 1. Current `main` state (physics + events + UI)

`main` now includes:

- **Events / Bus**
  - EventBus Phase 0: SoA rings, channels (`frameBegin`, `fixedEnd`, `frameEnd`, `immediate`), mailboxes, backfill, invalidation, metrics, overlays.
  - Typed event helpers for:
    - Pointer: `PointerMove`.
    - Perf: `PerfRow` (with lane IDs).
    - CCD: `CcdHit`.
    - Physics: `CollisionV2`, `Impulse`, `Wake`, `Sleep`, `Pick`.
    - Registry: `RegistryAdd`, `RegistryUpdate`, `RegistryRemove`.
  - EventBusSystem plus:
    - `EventOverlayAdapter` (debug overlay wired to bus).
    - `BusMetricsOverlaySystem` (bus stats overlay).
    - `PerfEmitterSystem` (now multi‑lane via `laneId`).

- **CCD**
  - CCD Phase A demo behind debug toggles:
    - Analytic ray slabs and circle TOI.
    - Swept OBB→AABB/OBB.
    - `CcdStepperSystem` + `CcdProbeOverlaySystem`.
  - CCD still runs as a **separate demo lane**, not integrated into the rigid physics lane.

- **UI / Routes**
  - Mantine v8 TypeScript app shell (`App.tsx`, `main.tsx`) with:
    - Debug drawer (`DebugPalette`) wired to `EngineActions`.
    - Events panel (`EventsPanel`) as a non‑modal overlay (Cmd/Ctrl+E).
    - Wireframe overlay pass.
  - Routes:
    - `/` → “Cloth Playground” hero + single `.cloth-enabled` button.
    - `/sandbox` → “Physics Sandbox” hero:
      - Multiple `.cloth-enabled` buttons.
      - Shared engine/overlay/debug stack with the main route.

- **Engine / Simulation**
  - `EngineWorld` with ordered systems and pause support.
  - `FixedStepLoop` + `SimulationRunner` driving fixed steps and frame updates.
  - `SimulationSystem`:
    - Owns cloth bodies (`SimWorld`), warm‑start queue, sleep thresholds.
    - Exposes immutable snapshots for overlays.
  - `ClothSceneController`:
    - Owns DOM capture, `DOMToWebGL`, `ElementPool`, `CollisionSystem`.
    - Registers:
      - `SimulationSystem`.
      - `CameraSystem`, `WorldRendererSystem`.
      - `DebugOverlaySystem` + `RenderSettingsSystem` + `WireframeOverlaySystem`.
      - `EventBusSystem` + overlays + perf emitters.
      - CCD demo systems.


## 2. Branch inventory at a glance
- Has vs main:
  - `PhysicsRegistry`, SAT helpers/tests, instrumentation, typed event validation.
- Worth merging?
  - Yes, sliced: docs + SAT + tests first; then integrate the registry API directly (no feature flags), keeping it decoupled from UI.
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

---

## 3. What’s DONE (Newton roadmap on `main`)

These items from the original Newton merge plan are effectively complete on `main`:

- [x] Typed event helpers on Phase‑0 bus for collisions, impulses, wake/sleep, registry, picks, and CCD hits.
- [x] SAT helpers + tests (OBB vs AABB).
- [x] `PhysicsRegistry` + unit tests, wired to Phase‑0 `frameEnd` via a registry→bus adapter.
- [x] Static‑first rigid lane with SAT vs static AABBs, restitution + friction, and `CollisionV2` emission.
- [x] `PhysicsSystem` orchestrator that runs rigid before cloth.
- [x] Dynamic–dynamic collision path with:
  - OBB‑aware normals/depth via SAT helper.
  - Normal + friction impulses.
  - `CollisionV2`, `Impulse`, `Wake` events.
- [x] World‑space picking utilities and events:
  - Canonical pointer mapping.
  - Picking over rigid bodies.
  - `Pick` events on the bus.
- [x] Non‑modal Events panel wired to the bus, able to show:
  - `PointerMove`, `PerfRow`, `CcdHit`, `Collision`, `Registry`, `Pick`.
- [x] `/sandbox` route using the same engine stack as `/` with a more complex DOM scene.

---

## 4. Future work checklist (do‑on‑main, not merge‑branches)

These are the remaining Newton‑adjacent tasks we still want, expressed as work to perform on `main`. We’ll mine branches as reference where useful.

### 4.1 Dynamic collisions & neighbor wake

- [ ] Add richer dynamic–dynamic test scenarios:
  - [ ] Head‑on pairs settling to rest without jitter at different restitution/μ.
  - [ ] Simple stacks (e.g., 2–3 boxes) to validate stability.
- [ ] Introduce a per‑body rigid “sleep” heuristic:
  - [ ] Velocity/accumulated motion thresholds per body.
  - [ ] Emit `Sleep` events when rigid bodies go to sleep; confirm via EventsPanel.
- [ ] Wire wake visualization:
  - [ ] Add a small debug system that subscribes to `Wake` events and updates `DebugOverlayState.wakeMarkers` based on body positions.
  - [ ] Implement a simple decay (e.g., a few frames) so markers fade.

### 4.2 Physics perf & budgets

- [ ] Decide on perf lane semantics:
  - [ ] Lane 0: “physics:rigid:fixed”.
  - [ ] Lane 1: “physics:cloth:fixed”.
  - [ ] Lane 2: “render:frame” (optional).
- [ ] Measure actual lane timings instead of just using `frameUpdate` dt:
  - [ ] Wrap rigid and cloth steps in timers (or a simple `performance.now()` delta) to feed `PerfRow`.
  - [ ] Adjust `PerfEmitterSystem` usage to report the real lane values.
- [ ] Update EventsPanel / overlays:
  - [x] Decode `PerfRow` lane IDs into human‑readable labels in the `detail` column.
  - [ ] Optionally show lane perf bars in `DebugOverlaySystem` or a new UI panel.
- [ ] Add perf budget checks:
  - [ ] Flag frames where rigid/cloth exceeds budget (e.g., >1.5ms) for future alerting.

### 4.3 Sleep/neighbor UX & sandbox tooling

- [ ] Integrate wake markers UX:
  - [ ] Toggle is in place; populate `wakeMarkers` from `Wake` events as described above.
- [x] Add E2E tests for `/sandbox`:
  - [x] Playwright test that:
    - Loads `/sandbox`.
    - Opens Debug drawer.
    - Spawns rigid boxes.
    - Clicks in the scene and asserts `Collision` + `Pick` + `Registry` rows in EventsPanel.
  - [ ] Optionally verifies toggling overlay flags (AABBs, Sleep, Wake) changes rendered gizmos.

### 4.4 CCD integration into the rigid lane (optional but high‑value)

- [ ] Decide integration boundaries:
  - [ ] Keep CCD as a separate lane that only affects certain rigid bodies.
  - [ ] Or integrate CCD into the main rigid lane under clearly documented rules (no hidden flags).
- [ ] Wire CCD for rigid bodies (not just the demo probe):
  - [ ] Feed moving rigid bodies into `CcdStepperSystem` based on velocity and thresholds.
  - [ ] Clamp rigid positions to collision TOI and emit combined `CcdHit` + `CollisionV2` events.
- [ ] Add tests:
  - [ ] Extend Thin‑Wall acceptance tests to cover rigid boxes in a real scene using the engine.
  - [ ] Verify no tunneling at 1 substep for representative scenarios.

---

## 5. Branch‑by‑branch decisions (reference vs merge)

### 5.1 `feat/physics-registry`

**Status:** Core ideas merged; branch largely redundant.

- Already on main:
  - `PhysicsRegistry` implementation and tests.
  - SAT helpers and tests.
  - Registry→EventBus mapping (done differently but more robustly).
- Keep branch as:
  - Docs / historical reference only.
- **Decision:** no merge. Only mine very specific docs or tiny code snippets if a future need arises.

### 5.2 `newton/a1-physics-system`

**Status:** Architecture effectively landed; perf extras may remain.

- Already on main:
  - Two‑lane physics concept (`PhysicsSystem` orchestrating rigid → cloth).
  - Static‑first rigid lane with SAT + `CollisionV2`.
  - Dynamic–dynamic path with impulses and `Wake` events.
- Likely remaining on branch:
  - Perf rows for physics lanes.
  - Additional tests around idempotent registration and perf budgets.
- **Decision:** no merge. Implement perf rows and extra tests directly on `main`, using the checklist above.

### 5.3 `newton/a2-worldxform`

**Status:** World xform + picking + sandbox are all on main now.

- Already on main:
  - Canonical world space (`DOMToWebGL` + `WorldBody`).
  - Picking utilities, `Pick` events, pointer‑up → pick flow.
  - `/sandbox` route integrated into the Mantine TS shell.
- Branch likely still holds:
  - Alternative sandbox layout and Playwright scaffolding.
- **Decision:** no merge. If needed, mine Playwright scenarios or specific UX from this branch.

### 5.4 `newton/a3-sleep-neighbor-ux`

**Status:** Core sleep machinery is on main; UX bits are partially replicated.

- Already on main:
  - Sleep thresholds and world‑space sleep guard for cloth.
  - Debug overlay visuals for sleep state.
  - Wake markers toggle + rendering hooks.
- Branch may still contain:
  - Alternative wake visualization.
  - Viewport width controls or extra overlay UX.
- **Decision:** no merge. Use as inspiration when polishing overlay behavior; implement changes on main.

### 5.5 `feat/world-sleep-guard-and-tessellation-options`

**Status:** Largely superseded by engine refactor + tessellation work on main.

- Already on main:
  - Tessellation auto‑logic in `ClothSceneController`.
  - World‑space sleep guard path for cloth.
- Branch contains:
  - Earlier versions of these ideas plus some project docs.
- **Decision:** no merge. Treat as historical; keep only the docs that are still relevant.

### 5.6 `feature/pointer-input-system`

**Status:** High‑risk; we’ve already adopted its ideas in a Phase‑0‑friendly way.

- Already on main:
  - Phase‑0 bus instead of the branch’s minimal bus.
  - Rigid system + dyn‑dyn behavior (with a simpler solver).
  - Registry + bus wiring.
  - Picking + `/sandbox`.
- Branch still holds:
  - Its own `eventBus` implementation (we do not want this).
  - A more aggressive rigid solver and lots of tests.
  - Sandbox‑style UI/overlays and QA scaffolding.
- **Decision:** never merge wholesale. Use as a **test/algorithm quarry**:
  - [ ] When we need more sophisticated manifolds or neighbor‑wake logic, port those pieces into the existing Phase‑0 + EngineWorld architecture.

### 5.7 UI / legacy / misc

- `feat/mantine-migration`:
  - Older Mantine JS app shell, superseded by current TS Mantine v8 app.
  - **Decision:** no merge. Only cherry‑pick specific UI ideas if ever needed.
- `feat/manual-qa-checklist`:
  - Some QA toggles/guards.
  - **Decision:** low priority; mine only if a matching QA task emerges.
- `feat/xforms`:
  - Legacy engine core that conflicts with EngineWorld/SimulationSystem.
  - **Decision:** obsolete; no merge.
- `fix/canonical-mapping`:
  - Small TS/build refactor.
  - **Decision:** revisit only if we hit a matching build issue.
- `chore/impulse-scaling`:
  - Docs/chore.
  - **Decision:** treat as superseded by current physics documentation and tuning.

---

## 6. TL;DR — Remaining Newton work

There is no “giant branch merge” left. The remaining Newton work should happen **directly on `main`**:

- [ ] Improve dynamic–dynamic tests and solver stability (stacks, ramps, jitter‑free rest).
- [ ] Add rigid sleep heuristics and `Sleep` events; surface in EventsPanel.
- [ ] Drive wake markers from `Wake` events and visualize neighbor‑wake chains in overlays.
- [ ] Turn perf rows into true lane metrics (rigid/cloth/render), not just `frame` dt.
- [x] Show lane labels for perf rows in EventsPanel and/or overlays.
- [x] Add `/sandbox` E2E tests (Playwright) to lock in physics/picking/registry behavior.
- [ ] Decide and implement CCD integration into the rigid lane, keeping it default‑off and test‑driven.
