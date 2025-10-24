# Engine Refactor Plan

Adopt the architecture patterns from `/Users/james/git/caverns` so simulation and rendering are cleanly separated and driven by a reusable engine core.

## 1. Extract Caverns Engine Primitives

- [x] Audit caverns for the minimal set of engine modules we need (`GameLoop`, `World`, system registration, time-stepped updates).
- [x] Copy those modules into a new `src/engine/` namespace, modernizing to ES modules and TypeScript-friendly JSDoc.
- [x] Add unit tests for the ported engine core (fixed-step accumulator, system ordering, lifecycle hooks).

## 2. Register Simulation Systems

- [x] Wrap the existing scheduler/physics update logic in a `SimulationSystem` that plugs into the engine world.
- [x] Move sleep-threshold configuration and warm-start logic into the simulation system so it runs during ticks, not render.
- [x] Ensure `SimWorld` and collision helpers operate on engine snapshots instead of ad-hoc state.

## 3. Introduce Camera System

- [ ] Port the caverns camera spring, updating math/constants to use canonical metres.
- [ ] Expose camera configuration via world actions; keep render-only structures read-only mirrors.
- [ ] Write tests verifying the spring converges and respects damping.

## 4. Convert `ClothSceneController` into a Render System

- [ ] Split render responsibilities into `WorldRenderer` (bridging engine world → DOMToWebGL) and UI adapters.
- [ ] Ensure DOM capture meshes, pointer helpers, and overlays read the camera snapshot without mutating simulation state.
- [ ] Update integration tests to assert render-only systems no longer tick simulation when paused.

## 5. Rewire UI and Presets

- [ ] Route debug drawer interactions through engine actions (sleep thresholds, camera config, pointer toggles).
- [ ] Update presets to dispatch combined physics + camera actions via the world instead of touching controller internals.
- [ ] Verify inspector metrics come from the engine snapshot (world velocities, camera state, etc.).

## 6. Cleanup & Verification

- [ ] Delete legacy render-loop code (old `_animate`, direct RAF usage) once the engine loop drives everything.
- [ ] Run the full test suite and add new coverage where integration boundaries changed.
- [ ] Update docs/README to describe the engine architecture and new extension points.

Nice-to-haves (post-refactor):
- [ ] Evaluate extracting the modernized engine into a standalone npm package.
- [ ] Consider porting additional caverns systems (input, HUD) if they reduce duplication.
