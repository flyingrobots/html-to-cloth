# ROADMAP

Single, unified checklist and milestone tracker for the cloth web demo and the Newton engine/physics work.

- This file is the **only canonical checklist** of work items.
- Other docs (in `docs/`) are narrative specs and design notes; they must not introduce new checklists.
- When something is done, update it here. When new work arises, add it here under the appropriate milestone.

Legend:
- `[x]` = complete on `main`
- `[ ]` = not done yet

---

## Milestone M0 – Cloth Demo Baseline (Complete)

Goal: deliver the original cloth portfolio demo with robust DOM/WebGL integration and tests.

- [x] Scaffold Vite React+TS app and install core deps (`three`, `html2canvas`).
- [x] Build accessible portfolio DOM layout styled for the cloth reveal.
- [x] Implement DOM → WebGL capture layer with orthographic camera alignment.
- [x] Add cloth physics system, collision handling, and activation lifecycle.
- [x] Respect `prefers-reduced-motion` and dispose resources on teardown.
- [x] Wire pointer gusts + damping for interactive fluttering.
- [x] Lazy-load html2canvas to shrink initial bundle size.
- [x] Add mesh pooling / reactivation so elements can re-run the reveal without reload.
- [x] Implement core physics unit tests (Verlet, collisions, sleep/wake).
- [x] Wire simulation scheduler so only awake bodies tick.
- [x] Implement automated DOM-level integration tests (capture alignment, lifecycle).
- [x] Tune pointer impulse strength/radius per element and device type.

Open QA / narrative tasks from this phase:

- [ ] Execute manual browser/network/memory QA passes and log findings.
- [ ] Prep demo script + visuals showing the DOM/WebGL dual-layer architecture.

---

## Milestone N1 – Newton v1 (Unified Core + Sandbox Baseline)

Goal: have a unified engine and physics stack (cloth + rigid + CCD kernel) with acceptance scenes and a basic sandbox.

### N1.1 Engine & Events

- [x] Port engine primitives (`EngineWorld`, `FixedStepLoop`, `SimulationRunner`) and attach them to the demo.
- [x] Wrap the existing cloth scheduler in `SimulationSystem` + `SimWorld` with tests.
- [x] Introduce `CameraSystem` + `WorldRendererSystem` and drive DOMToWebGL via engine frame updates.
- [x] Adopt EventBus Phase 0 with channels (`frameBegin`, `fixedEnd`, `frameEnd`, `immediate`) and mailboxes.
- [x] Add typed event helpers (`CollisionV2`, `Impulse`, `Wake`, `Sleep`, `Pick`, registry events, `CcdHit`) on top of Phase 0.
- [x] Wire `EventOverlayAdapter`, `BusMetricsOverlaySystem`, and `PerfEmitterSystem` into the engine.

### N1.2 Cloth & Rigid Physics

- [x] Keep cloth physics (Verlet, constraints, sleep) running via `SimulationSystem`/`SimWorld`.
- [x] Implement `RigidStaticSystem` with:
  - [x] Dynamic OBB vs static AABB collisions (SAT).
  - [x] Dynamic–dynamic OBB pairs with impulse resolution.
  - [x] Rigid sleep heuristics and `Sleep` events.
- [x] Implement `PhysicsSystem` to run rigid lane before cloth lane.
- [x] Add acceptance tests for:
  - [x] Stack rest jitter bounds (`rigid-stack-rest` DSL + tests).
  - [x] Drop-onto-static jitter bounds (`rigid-drop-onto-static` DSL + tests).

### N1.3 CCD Kernel & Acceptance (R1)

- [x] Implement CCD kernel for swept OBB vs AABB/OBB (thin wall scenario).
- [x] Add R1 thin-wall acceptance test using `advanceWithCCD` (no tunnelling).
- [x] Surface a CCD demo lane in the engine:
  - [x] `CcdStepperSystem` + `CcdProbeOverlaySystem`.
  - [x] CCD-specific debug drawer controls and `CcdHit` event stream.

### N1.4 Sandbox Scenes & Drop Box

- [x] Implement `/sandbox` route with layout, menus, and default scene (Drop Box + rigid-static textarea).
- [x] Wire `ClothSceneController.init()` to:
  - [x] Capture `.cloth-enabled` elements when present.
  - [x] Register `.rigid-static` elements into `CollisionSystem` as static AABBs.
  - [x] Always install the render pipeline (even if no cloth is active) so rigid-only scenes work.
- [x] Wire `PhysicsSystem` snapshots into `DebugOverlayState` for rigid body outlines and static AABBs.
- [x] Add engine-level Drop Box acceptance test mirroring sandbox spawn logic.
- [x] Add DOM/overlay-level Drop Box integration test:
  - [x] Clicking “Drop Box” must spawn a rigid body aligned with the floor AABB and above the floor.

### N1.5 World Scale & Mapping

- [x] Introduce `PX_PER_METER = 256` and define canonical 4m×3m world slice at 1024×768.
- [x] Update `units.ts` helpers (`toCanonical*`, `edgeToCanonical*`) to use `PX_PER_METER`.
- [x] Update `DOMToWebGL` camera frustum to derive extents from viewport size and `PX_PER_METER`.
- [x] Add explicit tests:
  - [x] `units.scale.test.ts` – 1024×768 → 4m×3m, center and edges map to 0/±2/±1.5.
  - [x] Extended `domToWebGL` tests – full-viewport mesh is 4m×3m, centered at origin, camera frustum matches.
  - [x] `collisionSystem.worldMapping.test.ts` – full-viewport rigid-static element → AABB matching 4m×3m slice.

### N1.6 Sandbox ↔ Acceptance Alignment (Remaining v1 tasks)

- [x] Wire C1 (“Cloth Settling / Jitter”) into `/sandbox`:
  - [x] Selecting C1 should create a live cloth body using the DSL and `SimulationSystem`.
  - [x] Sandbox behaviour should qualitatively match the C1 acceptance scene.
- [x] Wire C2 (“Cloth Sleep/Wake via Pointer”) into `/sandbox` in the same way.
- [x] Expose rigid DSL scenarios in sandbox:
  - [x] `rigid-stack-rest` scene selectable and driven by `PhysicsSystem`.
  - [x] `rigid-drop-onto-static` scene selectable.
- [x] Add minimal sandbox-level smoke tests for C1/C2/rigid DSL scenes (scene loads, overlays/events look sane).

---

## Milestone N2 – Newton v2 (CCD & Cloth↔Rigid Integration)

Goal: integrate CCD into the main rigid lane for high-speed bodies, introduce cloth↔rigid coupling, and unify acceptance scenes with sandbox scenarios.

### N2.1 CCD in PhysicsSystem

- [ ] Define a CCD policy for `PhysicsSystem`:
  - [x] Use `CcdSettingsState` or a new config to specify:
    - [x] `speedThreshold` above which CCD must be used.
    - [x] `epsilon` / tolerances for sweeps.
  - [x] (Optional) Per-body flag to force CCD on/off.
- [x] Refactor `RigidStaticSystem` / `PhysicsSystem` integration path:
  - [x] Separate “advance velocities” from “resolve contacts”.
  - [x] For high-speed bodies:
    - [x] Call `advanceWithCCD` against static obstacles to compute TOI and contact normal.
    - [x] Adjust body position/velocity based on that TOI.
  - [x] Run existing SAT + impulse solver on the adjusted state.
- [x] Promote R1 thin-wall into a PhysicsSystem-level acceptance test:
  - [x] Fast OBB vs thin wall in the real rigid lane must not tunnel.
  - [x] At least one `CollisionV2` event must be emitted.
- [x] Keep existing rigid tests green under CCD integration:
  - [x] Stack rest jitter window.
  - [x] Drop-onto-static jitter window.
  - [x] Rigid sleep tests.

### N2.2 Cloth↔Rigid Collisions v1

- [x] Implement cloth particle / rigid body collision model:
  - [x] Treat select cloth vertices or aggregated spheres as particles with radius derived from mesh scale.
  - [x] Broad-phase: particle spheres vs static AABBs + rigid OBBs.
  - [x] Narrow-phase: sphere vs OBB/AABB separation and optional rigid impulse.
- [x] Integrate cloth↔rigid collision step into the engine:
  - [x] After rigid lane resolution, use static AABBs + rigid bodies as obstacles during cloth update.
  - [x] Constrain particles and then run cloth solver iterations.
- [x] Add cloth↔rigid acceptance scenes:
  - [x] CR1: Cloth draping onto a rigid floor box.
  - [x] CR2: Rigid “ball” hitting a hanging cloth patch (deflection + bounded jitter).

### N2.3 Scenario DSL + Sandbox 2.0

- [ ] Extend `physicsScenarios.ts`:
  - [x] Define DSL-backed cloth+rigid combinations (cloth-over-boxes, flags + incoming rigid bodies).
  - [x] Provide optional camera presets and overlay defaults per scenario.
- [x] Make Test/Demo menus map 1:1 to DSL IDs (no ad-hoc sandbox scenes).
- [x] On scene selection:
  - [x] Tear down current entities safely.
  - [x] Invoke the DSL factory for the selected scene.
  - [x] Register all resulting rigid bodies and cloth with `PhysicsSystem`/`SimulationSystem`.
- [x] Add sandbox smoke tests per important DSL scene:
  - [x] Scene loads without errors.
  - [x] Overlays/events show the expected shape of activity (e.g., collisions, wakes).
  - [x] Playwright harness route (`/playwright-tests/:id`) provides UI-free stability for scene assertions.

---

## Milestone N3 – Tooling & Observability Upgrades

Goal: turn the debug UI and event system into a rich toolkit for understanding and tuning physics behaviour.

### N3.1 Inspector & Events Panel

- [ ] Add a body inspector:
  - [ ] Click on a rigid body in the overlay highlights it and shows a detail panel (position, velocity, sleep, mass, friction, restitution).
  - [ ] For cloth entities, show pinned count, average stretch, and bounding sphere radius.
- [ ] Extend EventsPanel:
  - [ ] Support filtering by event type/channel.
  - [ ] Provide a combined view of CollisionV2, Sleep/Wake, CCD hits, Picks.

### N3.2 EventBus UX (Magic School Bus)

- [ ] Add a “bus panel” for EventBus:
  - [ ] Show per-channel rates, queue depth, drops.
  - [ ] Visualize event type distribution (e.g., collision vs wake vs perf rows).
- [ ] Implement a log recorder:
  - [ ] Capture a bounded window of events and inputs per run.
  - [ ] Export as JSON with a simple replay harness.
- [ ] Benchmark the EventBus:
  - [ ] Synthetic producers/consumers @ 60 Hz with stress scenes.
  - [ ] Ensure overhead fits within perf budgets defined in PROJECT_NEWTON.

---

## Milestone N4 – Engine Packaging & v3+ Ideas

Goal: make the engine reusable and explore advanced physics/CCD features over time.

### N4.1 Engine Packaging & API Stabilization

- [ ] Define public engine API surface:
  - [ ] `EngineWorld`, `FixedStepLoop`, `SimulationRunner`.
  - [ ] `SimulationSystem`, `SimWorld`/snapshot types.
  - [ ] `PhysicsSystem` + config.
  - [ ] `CameraSystem`, `WorldRendererSystem`, `DebugOverlayState/System`, `RenderSettingsState/System`.
- [ ] Introduce workspace packages:
  - [ ] `@html-to-cloth/engine-core` (no `three`).
  - [ ] `@html-to-cloth/engine-sim` (no `three`).
  - [ ] `@html-to-cloth/engine-render` (`three` as peer).
- [ ] Set up builds with `tsup` (ESM + d.ts, ESM-only exports, `"sideEffects": false`).
- [ ] Add CI jobs to build packages and run tests against built artifacts.

### N4.2 Longer-Term Physics / CCD (from SWEEPSTAKES)

These are aspirational and not required for Newton v2; treat them as a backlog of ideas:

- [ ] Expand CCD coverage beyond OBB↔AABB/OBB to additional pairs (where useful to the demo):
  - [ ] Selected pairs from AABB/OBB/POLYGON/CIRCLE/RAY/SEGMENT as scenarios demand.
- [ ] Explore contact graph / dynamic sleeping (islands) for rigid scenes with many bodies.
- [ ] Consider additional soft-body types (ropes, soft boxes) built on the cloth constraint engine.
- [ ] (Optional) Scene editor that writes directly to the scenario DSL.

---

## Engine Refactor Follow-ups (from docs/engine-refactor.md)

These are targeted tasks from the engine refactor plan that cut across multiple milestones:

- [ ] Expose camera configuration via world actions; keep render-only structures read-only mirrors.
- [ ] CameraSystem spring acceptance criteria:
  - [ ] Position settles within ±0.5% of target in ≤ 1.0 s at 60 FPS.
  - [ ] Overshoot ≤ 10% for the default damping.
  - [ ] Steady‑state velocity ≤ 1e‑4 units/s after settle window.
- [ ] Ensure DOM capture meshes, pointer helpers, and overlays read the camera snapshot without mutating simulation state.
- [ ] Expose sleep thresholds and warm-start passes via simulation actions; migrate remaining toggles from controller-only APIs.
- [ ] Update presets to dispatch combined physics + camera actions via EngineActions/world instead of touching controller internals.
- [ ] Surface inspector metrics derived from engine snapshots (world velocities, camera state, etc.).
- [ ] Delete any remaining legacy render-loop code (old `_animate`, direct RAF usage) once the engine loop drives everything.
- [ ] Run the full test suite after major refactors and add coverage where integration boundaries changed.
- [ ] Update README/docs to describe the engine architecture and extension points.

---

## PhysicsRegistry / Discovery (from docs/issues/physics-registry.md)

Goal: centralize discovery of physics-relevant DOM nodes and surface descriptors + change events for inspector/activation flows.

- [ ] Implement PhysicsRegistry to:
  - [ ] Discover `.cloth-enabled`, `.rigid-dynamic`, `.rigid-static`, and nodes with `data-phys-*` / `data-cloth-*` attributes.
  - [ ] Produce descriptors containing: `{ id, tag, type, attrs (parsed), origin (rect/world), active state }`.
  - [ ] Emit `registry:add`, `registry:update`, `registry:remove` events with prior/next descriptors.
  - [ ] Diff descriptors so that only changed fields trigger events; keep ids stable across runs.
  - [ ] Allow inspector/activation code to subscribe to registry events.
- [ ] Tests:
  - [ ] `physicsRegistry.spec`: discovery from a test DOM, descriptor diffing, events on resize.
  - [ ] Integration test: inspector or controller subscribes and receives `registry:update` events when DOM changes.

---

## Status Report

This section is an at-a-glance summary of where the project stands and what is happening next. It should be updated regularly as work progresses.

### Current Capabilities

- Cloth Demo:
  - DOM → WebGL capture via `DOMToWebGL`, with cloth overlays driven by Verlet-based `ClothPhysics`.
  - Pointer-based “gusts”, sleep/wake, offscreen recycling.
  - DOM integration tests and unit tests for cloth stability, pins, AABB constraints, sleep.
- Engine & Event Bus:
  - `EngineWorld` with fixed-step loop and `SimulationRunner`.
  - `SimulationSystem` + `SimWorld` drive cloth via fixed updates.
  - `CameraSystem` + `WorldRendererSystem` handle rendering; paused-render invariant is tested.
  - Phase 0 EventBus with typed event helpers for pointer, perf, CCD hits, collisions, impulses, wake/sleep, picks, and registry events.
- Rigid Physics:
  - `RigidStaticSystem` supports dynamic OBB vs static AABB, plus dynamic–dynamic collisions with impulses and friction.
  - `PhysicsSystem` orchestrates rigid-before-cloth.
  - Sleep heuristics and Sleep/Wake events are in place with tests.
- CCD:
  - CCD kernel is implemented and tested for OBB vs AABB/OBB thin-wall scenarios (R1 acceptance scene).
  - PhysicsSystem applies a CCD policy (speed threshold + epsilon, per-body override) so high-speed rigid bodies sweep static obstacles before SAT resolution, emitting `CollisionV2` in thin-wall scenarios.
  - A CCD demo lane with `CcdStepperSystem` + `CcdProbeOverlaySystem` and UI toggles is wired into the engine.
- Sandbox:
  - `/sandbox` route with “SANDBOX” hero, Tests/Demos menus, default Drop Box scene, and textarea floor.
  - Static `.rigid-static` floor is fed into `CollisionSystem` → `PhysicsSystem` → DebugOverlay.
  - C1 and C2 cloth scenarios selectable via Tests menu, wired through the Scenario DSL into `SimulationSystem` with overlay snapshots and pointer wake support.
  - Rigid stack-rest and drop-onto-static DSL scenes selectable and routed through `PhysicsSystem` for overlay visibility.
  - Drop Box:
    - Engine-level acceptance test ensures a floor-aligned body collides with the floor and emits `CollisionV2`.
    - DOM-level test ensures clicking “Drop Box” spawns a rigid overlay body aligned with the floor AABB and above the floor.
- World Scale:
  - `PX_PER_METER = 256` and a canonical 4m×3m world slice at 1024×768 are locked in.
  - Units, domToWebGL, and CollisionSystem tests verify consistent px↔meter mapping.

### Recent Additions

- Promoted CCD policy into `PhysicsSystem`, wiring `advanceWithCCD` sweeps ahead of SAT and enabling PhysicsSystem-level thin-wall + policy specs.
- Added CCD response spec for heavy bodies and corrected impulse math so inward velocity is cancelled even when mass > 1.
- Introduced `ROADMAP.md` as the single source of truth for all tasks and milestones.
- Extended `docs/PROJECT_NEWTON.md` with a detailed roadmap (v1/v2/v3+).
- Added world-scale tests and refactored `units.ts` and `DOMToWebGL` to use `PX_PER_METER = 256`.
- Added engine- and DOM-level acceptance tests for the sandbox Drop Box scenario under the new scale.
- Consolidated legacy checklists into this roadmap and removed outdated branch/UI/physics matrix docs.

### Planned Next Steps

- Short-term (Newton v1 completion):
  - Run and record manual browser/network/memory QA passes; prepare demo script + visuals that explain the engine + DOM capture architecture.
  - Keep sandbox smoke tests green while tuning behaviours and overlays.
- Medium-term (Newton v2):
  - Tune CCD policy thresholds (speed, epsilon) against stress scenes and keep PhysicsSystem R1 thin-wall spec passing.
  - Implement cloth↔rigid collision v1, starting with simple cloth-over-box and ball-into-cloth scenes.
  - Move all sandbox Test/Demo scenes onto the scenario DSL.
- Longer-term:
  - Expand inspector, EventsPanel, and EventBus tooling (bus panel, log recorder, benchmarks).
  - Stabilize the engine API and explore packaging (`engine-core`, `engine-sim`, `engine-render`).
  - Incrementally pursue advanced CCD and physics features from SWEEPSTAKES as needed.

---

## 1–2 Week Tactical Plan

This section highlights the highest-priority tasks for the next 1–2 weeks. It is a slice through the roadmap, not an additional checklist: when updating progress, always update the corresponding items in the milestones above.

### Week 1 – Newton v1 Completion & QA Prep

**Focus:** Finish N1.6 sandbox ↔ acceptance alignment and kick off the remaining M0 QA/narrative work.

- Sandbox integration (N1.6)
  - C1 (“Cloth Settling / Jitter”) is now selectable in `/sandbox`, driven by the C1 DSL via `SimulationSystem` and visible through overlay snapshots.
  - Wire C2 (“Cloth Sleep/Wake via Pointer”) into `/sandbox`:
    - Use the C2 DSL to create a live cloth body that responds to pointer wake/impulse.
  - Expose rigid DSL scenes:
    - Add menu entries for `rigid-stack-rest` and `rigid-drop-onto-static`.
    - Wire them to create rigid bodies via the DSL and `PhysicsSystem`.
  - Add minimal sandbox smoke tests for the above scenes (render, basic overlay/event sanity checks).

- QA / narrative (M0)
  - Run manual browser/network/memory QA passes as per `TEST_PLAN.md` and `docs/qa/manual-qa-2025-10-29.md`.
  - Start drafting the demo script and visuals describing:
    - DOM → WebGL capture.
    - EngineWorld + SimulationSystem/Sandbox architecture.
    - How acceptance scenes map to sandbox scenes.

### Week 2 – CCD Policy Tuning & Cloth↔Rigid Planning (N2 Kickoff)

**Focus:** Validate the new CCD policy under stress scenes and lock the plan for cloth↔rigid v1.

- CCD policy tuning (N2.1)
  - Sweep fast-body stress cases (multiple static obstacles, grazing impacts) to choose stable `speedThreshold`/`epsilon`.
  - Capture any regressions as additional PhysicsSystem-level specs if needed.

- Cloth↔rigid integration planning (N2.2)
  - Finalize the collision model for cloth↔rigid v1:
    - Which cloth vertices/spheres participate in collisions.
    - How to approximate particle radius per scenario.
  - Sketch CR1/CR2 acceptance tests in `docs/qa/physics-acceptance-scenes.md` (or a new cloth↔rigid section) so they can be encoded as engine tests shortly after.

These week-by-week themes should be updated as work lands. When priorities shift, adjust this section and the corresponding milestone items together.

---

## CHANGELOG

This section records changes made to `ROADMAP.md` itself. New entries should be appended to the end, newest first.

- **2025-11-21**
  - Created initial `ROADMAP.md` with milestones M0, N1, N2, N3, N4.
  - Folded cloth demo progress items from `PROGRESS_CHECKLIST.md` into M0.
  - Added Newton v1 and v2 tasks based on `docs/PROJECT_NEWTON.md`, MAGICSCHOOLBUS, SWEEPSTAKES, and Newton acceptance docs.
  - Deleted outdated branch/UI/physics matrix docs and moved any remaining TODOs into this roadmap.
  - Added Engine Refactor follow-ups and PhysicsRegistry/Discovery tasks sourced from `docs/engine-refactor.md` and `docs/issues/physics-registry.md`.
- **2025-11-22**
  - Completed N1.6 sandbox alignment: wired C2 cloth sleep/wake, rigid stack-rest, and rigid drop-onto-static scenes into `/sandbox` with smoke tests.
- **2025-11-23**
  - Marked N2.1 CCD policy tasks complete after integrating CCD sweeps into `PhysicsSystem` and enabling PhysicsSystem-level CCD specs.
- **2025-11-24**
  - Completed N2.2 cloth↔rigid coupling v1: particle-vs-rigid collisions, engine integration, and CR1/CR2 acceptance scenes enabled.
- **2025-11-25**
  - Wired Sandbox Tests menu directly to DSL scene ids (CR1/CR2/thin-wall CCD) with scene teardown/registration and passing smoke e2e; added stable sandbox debug helper for automated scene loading.
- **2025-11-24**
  - Added per-scene sandbox presets for camera zoom and overlay toggles (CR1/CR2 and rigid scenes) and expanded sandbox scene e2e to assert overlays/camera behaviour.
