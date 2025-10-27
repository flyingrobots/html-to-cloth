# Architecture Guide

This document explains how the major subsystems interact after the engine refactor. It complements
the component and data-flow diagrams with additional rationale and extension tips.


## Layers Overview

1. **UI/DOM Layer** – browser-facing code (`clothSceneController`, React components) that captures
   DOM elements, handles pointer input, and exposes debug actions.
2. **Render Layer** – `WorldRendererSystem` copies a camera snapshot into `DOMToWebGL` and renders
   each frame (`EngineWorld.frame(dt)`), running even while simulation is paused.
3. **Simulation Layer** – `SimulationSystem`, `SimWorld`, `SimulationScheduler`, and physics modules
   (`ClothPhysics`, collision helpers). This layer is pure data/logic and exposes snapshots.
4. **Engine Layer** – `EngineWorld`, `SimulationRunner`, fixed-step loop. Responsible for deterministic
   ticking and system ordering.
5. **Entity Layer** – minimal ECS with `EntityManager`, used to track cloth body components today and
   ready for future systems (camera rigs, HUDs, audio emitters, etc.).


## Dependency Injection Strategy

- All core orchestrators accept optional constructor parameters. Tests can inject stubs, and future
  projects can replace pieces without editing the original classes.
- `ClothSceneController` receives `SimulationSystem`, `SimulationRunner`, `SimWorld`, and `EngineWorld`
  instances, and installs `CameraSystem` + `WorldRendererSystem` at init. The controller exposes
  getters so UI code can construct `EngineActions` without reaching into internals.
- Physics primitives (e.g., `ClothPhysics`) receive a `GravityController` so temporary overrides never
  leak outside the body itself.


## Extending the System

- **Adding Camera Systems**: create a new engine system, register it via `SimulationRunner.getEngine()`,
  and feed it data from `SimulationSystem.getSnapshot()`. Our default is `CameraSystem` which provides
  a spring and a read-only snapshot object that is pooled to avoid allocations.
- **Additional Components**: attach new component types to the `Entity` created for each cloth. Since
  adapters already implement the `Component` interface, you can layer additional behaviour (e.g.,
  analytics trackers or debug helpers) without touching simulation code.
- **Alternative Input Sources**: provide your own pointer adapter and call `simulationSystem.notifyPointer`
  as needed. The controller never assumes events come from DOM events specifically.


## API Documentation

Run `npm run docs:api` to generate Markdown API docs in `docs/api/` using TypeDoc. The configuration lives
in `typedoc.json` and includes version and git revision metadata for traceability.


## Testing Notes

- `ClothSceneController` is exercised via DOM integration tests; targeted unit tests can be added by
  injecting mocked `SimulationRunner`/`SimulationSystem` instances. App tests validate that the debug
  palette routes actions into `EngineActions`.
- Entity layer tests live in `src/engine/entity/__tests__/entity.test.ts`.
- The simulation runner owns its own suite (`src/engine/__tests__/simulationRunner.test.ts`) verifying
  real-time toggles, sub-step behaviour, and manual stepping.
