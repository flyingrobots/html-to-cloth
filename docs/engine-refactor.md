# Engine Refactor Plan

Adopt the architecture patterns from the Caverns project so simulation and rendering are cleanly separated and driven by a reusable engine core.

## 1. Extract Caverns Engine Primitives

- [x] Audit caverns for the minimal set of engine modules we need (`GameLoop`, `World`, system registration, time-stepped updates).
- [x] Copy those modules into a new `src/engine/` namespace, modernizing to ES modules and TypeScript-friendly JSDoc.
- [x] Add unit tests for the ported engine core (fixed-step accumulator, system ordering, lifecycle hooks).

## 2. Register Simulation Systems

- [x] Wrap the existing scheduler/physics update logic in a `SimulationSystem` that plugs into the engine world.
- [x] Move sleep-threshold configuration and warm-start logic into the simulation system so it runs during ticks, not render.
- [x] Ensure `SimWorld` and collision helpers operate on engine snapshots instead of ad-hoc state.

## 3. Introduce Camera System

- [x] Port the caverns camera spring, updating math/constants to use canonical metres.
- [ ] Expose camera configuration via world actions; keep render-only structures read-only mirrors.
- [ ] Acceptance criteria (spring):
  - [ ] Position settles within ±0.5% of target in ≤ 1.0 s at 60 FPS.
  - [ ] Overshoot ≤ 10% for the default damping.
  - [ ] Steady‑state velocity ≤ 1e‑4 units/s after settle window.

## 4. Convert `ClothSceneController` into a Render System

- [x] Split render responsibilities into `WorldRenderer` (bridging engine world → DOMToWebGL) and UI adapters.
- [ ] Ensure DOM capture meshes, pointer helpers, and overlays read the camera snapshot without mutating simulation state.
- [x] Paused-render invariant (acceptance test): when `SimulationRunner.setRealTime(false)` is active, assert:
  - `EngineWorld.isPaused()` returns true
  - Calling `engine.frame(dt)` triggers `WorldRendererSystem.frameUpdate` and view.render()
  - No `fixedUpdate` occurs during the same interval

Notes: The renderer runs during `engine.frame(dt)` and applies the camera snapshot each frame. Controller no longer calls `render()` directly.

## 5. Rewire UI and Presets

- [x] Route debug drawer interactions through engine actions (runner, camera zoom, gravity, constraint iterations).
- [ ] Expose sleep thresholds and warm-start passes via simulation actions; migrate remaining toggles.
- [ ] Update presets to dispatch combined physics + camera actions via the world instead of touching controller internals.
- [ ] Inspector metrics from engine snapshot (world velocities, camera state, etc.).

### Snapshot Immutability (acceptance test)
- Attempt to mutate a camera snapshot (position/zoom) returned by `CameraSystem.getSnapshot()` and verify:
  - Mutation is ignored (no side-effects on subsequent reads), or
  - The method throws; either behaviour must be explicitly enforced to prevent state leaks.

## 6. Cleanup & Verification

- [ ] Delete legacy render-loop code (old `_animate`, direct RAF usage) once the engine loop drives everything.
- [ ] Run the full test suite and add new coverage where integration boundaries changed.
- [ ] Update docs/README to describe the engine architecture and new extension points.

Nice-to-haves (post-refactor):
- [ ] Evaluate extracting the modernized engine into a standalone npm package.
- [ ] Consider porting additional caverns systems (input, HUD) if they reduce duplication.
