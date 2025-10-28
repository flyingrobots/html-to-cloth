# Data Flow Notes

## 1. Initialization

1. **ClothSceneController** instantiates:
   - `DOMToWebGL` to capture cloth-enabled elements.
   - `ElementPool` for geometry recycling.
   - `SimWorld`, `SimulationSystem`, and registers the system with an `EngineWorld`.
   - `SimulationRunner`, which owns the fixed-step loop driven by the controller.
2. Each DOM element with `.cloth-enabled` is prepared:
   - Snapshot captured via html2canvas.
   - Mesh created and mounted in the WebGL scene.
   - Static collision bounds registered in `CollisionSystem`.

## 2. Activation Path

1. User clicks a cloth-enabled button; controller:
   - Resets pointer state and removes the element from static collisions.
   - Creates a new `ClothPhysics` instance with options (damping, iterations, gravity).
   - Wraps it in a `ClothBodyAdapter`, registers it with `SimulationSystem.addBody`, and stores it inside an `Entity` managed by `EntityManager` for future component expansion.
2. `SimulationSystem` queues warm-start & sleep configuration which run on the next fixed update.

## 3. Fixed-Step Update Loop (Simulation)

1. `requestAnimationFrame` drives `SimulationRunner.update(delta)`; the underlying `FixedStepLoop` accumulates time.
2. When accumulated time ≥ fixed step:
  - Runner executes `EngineWorld.step(stepSize)` for each configured substep.
  - `SimulationSystem.fixedUpdate(dt)` flushes pending warm-start/sleep queues and calls `SimWorld.step(dt)`.
  - SimWorld delegates body update to `SimulationScheduler`, performs sweep checks, and refreshes snapshots.

## 4. Frame Update Loop (Render)

1. The app calls `engine.frame(delta)` every RAF.
2. `WorldRendererSystem.frameUpdate(delta)` reads the pooled camera snapshot from `CameraSystem`, copies it to
   the orthographic camera owned by `DOMToWebGL`, updates the projection matrix, and calls `render()`.
3. Rendering MUST run while the engine is paused and MUST NOT mutate any simulation state under any
   circumstances. Any attempt to modify world/simulation state during render is a protocol violation
   and results in undefined behaviour.

## 5. Pointer Interaction Flow

1. Pointer move events convert screen coordinates to canonical space.
2. Controller updates pointer velocity and flags impulse needs.
3. `SimulationSystem.notifyPointer` forwards the canonical position to `SimWorld`, waking any sleeping cloth within bounds.
4. On the next `ClothBodyAdapter.update(dt)` call, if an impulse is pending it is applied to `ClothPhysics`.

## 6. Warm Start / Sleep Dependency Injection

- `ClothPhysics` owns a `GravityController` which exposes a temporary override hook.
- Warm-start calls execute `relaxConstraints` under a zero-gravity override (per cloth) without mutating global gravity.
- Sleep thresholds are injected via `SimulationSystem.queueSleepConfiguration` and persisted inside each cloth.

## 7. Offscreen Recycling

1. `ClothBodyAdapter` detects when its cloth's bounding sphere falls below the canonical boundary.
2. Adapter invokes the controller callback which:
   - Removes the body from `SimulationSystem` and destroys the corresponding entity to release components.
   - Recycles geometry back into the pool, restores DOM opacity, and re-registers static collision bounds.

## 8. Snapshot Consumption

- After each fixed update, `SimulationSystem.getSnapshot()` returns immutable body data (position, radius, sleep flag).
- ClothSceneController can use this snapshot to populate UI metrics or future camera/render systems.

## 9. Debug Actions

- UI constructs `EngineActions` by calling getters on `ClothSceneController` to obtain the `runner`,
  `world`, `camera`, and `simulation` references, and then packages controls into that object.
- Actions include real-time toggling, manual stepping, substep adjustments, camera zoom/target, and
  broadcasted changes for gravity/constraint iterations via `SimulationSystem`.
