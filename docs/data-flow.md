# Data Flow Notes

## 1. Initialization

1. **ClothSceneController** instantiates:
   - `DOMToWebGL` to capture cloth-enabled elements.
   - `ElementPool` for geometry recycling.
   - `ClothSimulationController`, which internally wires `EngineWorld`, `FixedStepLoop`, and `SimulationSystem` (with a shared `SimWorld`).
2. Each DOM element with `.cloth-enabled` is prepared:
   - Snapshot captured via html2canvas.
   - Mesh created and mounted in the WebGL scene.
   - Static collision bounds registered in `CollisionSystem`.

## 2. Activation Path

1. User clicks a cloth-enabled button; controller:
   - Resets pointer state and removes the element from static collisions.
   - Creates a new `ClothPhysics` instance with options (damping, iterations, gravity).
   - Wraps it in a `ClothBodyAdapter` and registers with `ClothSimulationController.addBody`.
2. `ClothSimulationController` queues warm-start & sleep configuration which run on the next fixed update.

## 3. Fixed-Step Update Loop

1. `requestAnimationFrame` drives `ClothSimulationController.update(delta)`; internal `FixedStepLoop` accumulates time.
2. When accumulated time ≥ fixed step:
   - Loop triggers `ClothSimulationController.stepSimulation(dt)` which forwards to `EngineWorld.step(stepSize)` for each substep.
   - `SimulationSystem.fixedUpdate(dt)` flushes pending warm-start/sleep queues and calls `SimWorld.step(dt)`.
   - SimWorld delegates body update to `SimulationScheduler`, performs sweep checks, and refreshes snapshots.

## 4. Pointer Interaction Flow

1. Pointer move events convert screen coordinates to canonical space.
2. Controller updates pointer velocity and flags impulse needs.
3. `ClothSimulationController.notifyPointer` forwards the canonical position to `SimWorld`, waking any sleeping cloth within bounds.
4. On the next `ClothBodyAdapter.update(dt)` call, if an impulse is pending it is applied to `ClothPhysics`.

## 5. Warm Start / Sleep Dependency Injection

- `ClothPhysics` owns a `GravityController` which exposes a temporary override hook.
- Warm-start calls execute `relaxConstraints` under a zero-gravity override (per cloth) without mutating global gravity.
- Sleep thresholds are injected via `ClothSimulationController.queueSleepConfiguration` and persisted inside each cloth.

## 6. Offscreen Recycling

1. `ClothBodyAdapter` detects when its cloth's bounding sphere falls below the canonical boundary.
2. Adapter invokes the controller callback which:
   - Removes the body from `ClothSimulationController`.
   - Recycles geometry back into the pool, restores DOM opacity, and re-registers static collision bounds.

## 7. Snapshot Consumption

- After each fixed update, `ClothSimulationController.getSnapshot()` returns immutable body data (position, radius, sleep flag).
- ClothSceneController can use this snapshot to populate UI metrics or future camera/render systems.
