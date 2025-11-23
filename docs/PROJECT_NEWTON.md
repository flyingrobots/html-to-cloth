# Project: Newton — Unified Physics Spec (Draft)

Status: Draft
Owner: @flyingrobots
Branch: feat/physics-registry (PR #44)
Milestone: PROJECT: Newton

## 1. Goals (What/Why)
- Unify physics under a single Engine system: `PhysicsSystem`.
- Support realistic 2D rigid dynamics (OBB collider first; circle/polygon next).
- Integrate cloth with rigid bodies via particle–shape collisions.
- Provide picking (ray cast) for inspection and tooling.
- Add first‑class performance visibility (per‑lane budgets + FPS trendline).

Rationale: The demo needs believable rigid interactions, robust cloth, and a clean mental model. A single system with two lanes (rigid + cloth) makes order and perf explicit and testable.

## 2. Scope / Out of Scope
- In scope
  - PhysicsSystem (rigid + cloth lanes)
  - WorldXform component (world transforms + world-space bounds)
  - PhysicsBody abstraction (local‑space collider + props + APIs)
  - Collisions: broad‑phase (AABB/sphere), narrow‑phase SAT for true shapes
  - Cloth↔Rigid particle collisions (ON by default; toggleable)
  - Picking (raycast via camera → body rayIntersect in local space)
  - Events + Perf overlay with budgets + FPS trendline
- Out of scope (phase 1)
  - Dynamic–dynamic rigid contact graph optimization (sleep islands)
  - Convex hull/polygon colliders (phase 2+)
  - 3D rotation/inertia (2D only)

## 3. Coordinate System & Time
- World units: canonical meters (existing convention). +Y is up; gravity = (0, −g, 0).
- Screen scale: `PX_PER_METER = 256` — one world-space meter corresponds to 256 CSS pixels.
- Canonical viewport: at 1024×768 the visible world slice is 4m×3m (`[-2, 2] × [-1.5, 1.5]`) before camera zoom is applied.
- Fixed step dt = 1/60 by default; substeps configurable (2–4 typical).
- Cloth constraint iterations independent from substeps (slider‑controlled).

## 4. System Architecture

### 4.1 PhysicsSystem (EngineSystem)
- Always registered; runs every fixed update.
- Two lanes in order:
  1) Rigid lane
  2) Cloth lane
- Pseudocode per substep:
```
// External forces
for each rigid body: v += g*dt; for cloth particle: v += g*dt

// Rigid lane
integrateRigid();
broadPhaseRigid();
for each (rigid vs static/rigid) overlap: narrowPhaseSAT(); resolveImpulses();

// Cloth lane
broadPhaseParticles();
for each particle vs static/rigid overlap: resolveSphereVsShape();
for i=1..constraintIterations: projectClothConstraints();
updateClothVelocitiesFromPositions();
```

### 4.2 WorldXform (Component)
- Purpose: World transform snapshot per entity + world‑space bounds.
- API
  - `GetPosition(): Vector3`
  - `GetRotationMat3(): Matrix3x3`
  - `GetRotationQuat(): Quat`
  - `As4x4(): Matrix4` (GPU‑friendly)
  - `WorldToLocal(p: Vector3): Vector3`
  - `LocalToWorld(p: Vector3): Vector3`
  - `ComputeWorldAABB(colliderLocal): AABB2` (cached each step)
  - `ComputeWorldSphere(colliderLocal): { center: Vec2, radius: number }` (cached each step)

### 4.3 PhysicsBody (Local Space)
- Shape: `collider: { kind: 'obb'|'circle'|'polygon', ...local params }`
- Props: `{ mass, friction, restitution, density?, centerOfMass? }`
- Kinematics: `position, angle, velocity, angularVelocity, invMass, invInertia`
- APIs
  - `rayIntersect(localRay): number | null` (t along ray)
  - `applyImpulse(impulse: Vec2, localContactPoint?: Vec2): void`
  - `getExtents(): [axisX: Vec2, axisY: Vec2]` (SAT axes; polygon returns axes set)
- World bounds live on WorldXform, not the body.

### 4.4 CollisionSystem (Service)
- Maintains static bodies from DOM (AABBs) and updates on resize/scroll.
- Provides world AABB/sphere for broad‑phase.
- PhysicsSystem consumes this each fixed step.

## 5. Rigid Dynamics (OBB v1)
- Narrow‑phase: SAT, axes = OBB local axes + AABB axes; choose minimum overlap axis → MTV + collision normal (pointing from rigid to obstacle).
- Impulses at contact point:
  - `j = -(1+e) * v_rel·n / (Σ(invMass + (r×n)^2 * invInertia))`
  - Coulomb friction: clamp tangential impulse `jt` to `|jt| ≤ μ·j`.
- Inertia (2D box): `I = m*(w^2+h^2)/12`; `invInertia = 1/I` (0 for infinite).

## 6. Cloth ↔ Rigid Collisions
- Default ON; Debug toggle provided.
- Particle as sphere (radius from cloth resolution/scale).
- Broad‑phase: particle sphere vs world AABBs/spheres.
- Narrow‑phase: sphere vs OBB (analytic), apply separation + opposite impulse to rigid.
- Then run cloth constraint solver for stability.
- Self‑collision: OFF by default; toggle to enable. Implement via uniform grid/BVH, neighbor exclusion, pair budget.

## 7. Picking
- CameraSystem → world ray (eye, dir).
- For each candidate (broad‑phase cull): transform ray to local via `WorldToLocal`.
- `PhysicsBody.rayIntersect(localRay)`; pick nearest `t`.
- Emit `pick` event; overlay marker; inspector shows body props.

## 8. Events
- `collision` (rigid contacts; later cloth sphere contacts optionally):
  - `{ time, type:'collision', a:{id,tag?}, b:{id,tag?}, normal, mtv, impulse, restitution, friction }`
- `wake|sleep|activate|deactivate` (per body)
- `pick` `{ time, type:'pick', id, tag?, rayWorld:{origin,dir}, hitLocal:{x,y}, t }`
- Registry events retained for DOM lifecycle.

## 9. Perf & FPS
- Perf rows (averages + rolling 120 samples):
  - `physics:rigid:fixed`, `physics:cloth:fixed`, `render:frame`, `overlay:frame`.
- Budgets (initial):
  - physics:rigid ≤ 1.5 ms @ 20 bodies; cloth lane per current target; overlay ≤ 0.8 ms.
- FPS trendline (Canvas2D):
  - Lines: FPS, physics total ms, render ms; small legend; unobtrusive top‑right.

## 10. UI / Debug
- Toggles: perf overlay, particle collisions ON/OFF (default ON), cloth self‑collision ON/OFF (default OFF).
- Picking: on click, highlight + open inspector panel.
- Mantine‑only surfaces; no Tailwind/custom CSS.

## 11. Testing
- Unit
  - SAT OBB vs AABB: contact normals, MTV depth, rotated cases.
  - Impulse correctness (normal/friction bounds).
  - RayIntersect for OBB/circle.
- Integration
  - Engine re‑init idempotency (no duplicate systems).
  - Cloth draping over static/rigid OBB; particle collision corrections.
  - Perf wrapper installed once; rows present.
- E2E smoke
  - Picking selects body; Events panel logs pick/collision.

## 12. Milestones (Issues, all under PROJECT: Newton)
- A1: PhysicsSystem (two lanes) refactor; idempotent install; perf rows.
- A2: WorldXform + PhysicsBody scaffolding; RigidBody2D (OBB).
- A3: Cloth↔Rigid particle collisions (default ON) + Debug toggle.
- A4: Picking (raycast) + inspector basics.
- A5: Perf overlay: FPS trendline + lane ms + budgets.
- A6: Docs & acceptance checklist; final review/merge.

## 13. Acceptance Criteria
- One PhysicsSystem registered; no duplicate systems after init→dispose→init in tests.
- Rigid OBB resolves collisions with impulses and friction; angular velocity updated.
- Cloth collides with rigid/static via particle spheres; constraints stabilize the mesh.
- Picking returns nearest hit; inspector shows collider/props.
- Perf overlay shows physics lanes + FPS trendline; budgets flag overages.
- All tests green; CI policy satisfied.

---

## 14. Roadmap (Beyond v1)

This section captures the longer-term vision for the Newton stack. It is intentionally broader than the current milestone; each phase should be driven by tests-as-spec, the same way C1/C2/R1 were.

### 14.1 Newton v1 – Unified Core (Current Milestone)

Newton v1 is the first “complete” slice of the system:

- Engine
  - `EngineWorld` + fixed-step loop (`FixedStepLoop`, `SimulationRunner`).
  - `SimulationSystem` + `SimWorld` for cloth.
  - `CameraSystem` + `WorldRendererSystem` for render.
  - Render-only systems: `DebugOverlaySystem`, `RenderSettingsSystem`, wireframe overlay, perf emitters.
- Physics
  - Cloth physics (Verlet) with pins, sleep, offscreen recycling.
  - Rigid OBB vs static AABB + dynamic–dynamic pairs via `RigidStaticSystem`.
  - CCD kernel (`advanceWithCCD`) plus the R1 thin-wall acceptance scene at the kernel level.
  - Event bus with typed events (CollisionV2, Wake/Sleep, Impulse, Pick, registry events).
- Acceptance scenes
  - C1: Cloth settling / jitter.
  - C2: Cloth sleep/wake via point.
  - R1: CCD thin wall (no tunnelling at the kernel).
- Sandbox
  - `/sandbox` route with menus and default scenes (e.g., Drop Box).
  - Debug drawer + Events panel + overlays for AABBs, sleep states, wake markers, rigid outlines.
  - DOM↔world mapping pinned to `PX_PER_METER = 256` and the 4m×3m canonical slice at 1024×768, with tests for units/domToWebGL/collisionSystem.

Newton v1 is considered “done” when:

- C1/C2/R1 acceptance tests are green at the engine level.
- Key sandbox scenes (at least C1/C2-equivalents and a rigid Drop Box/stack scene) map to those acceptance behaviours.
- Engine refactor tasks in `docs/engine-refactor.md` are complete enough that simulation/render separation and debug actions are stable.
- The world-scale tests and acceptance docs remain in sync with the implementation.

### 14.2 Newton v2 – CCD & Cloth↔Rigid Integration

Newton v2 deepens the physics layer while keeping the existing v1 behaviour as a baseline. The main themes are: integrate CCD into the main lane by policy, add cloth↔rigid coupling, and unify scene definitions across engine and sandbox.

#### 14.2.1 CCD in PhysicsSystem

Goal: CCD stops being an isolated demo lane and becomes part of the main rigid lane for fast-moving bodies.

- Policy
  - Extend `CcdSettingsState` (or introduce a PhysicsSystem CCD config) with:
    - `speedThreshold` for enabling CCD per body.
    - `epsilon`/tolerances for sweeps.
  - Optionally a per-body flag for CCD-sensitive bodies in future (e.g., bullets).
- Integration
  - Refactor `RigidStaticSystem` / `PhysicsSystem` to separate:
    - Velocity integration.
    - Collision resolution.
  - For high-speed bodies:
    - Use `advanceWithCCD` to find time-of-impact (TOI) and contact normal against static obstacles.
    - Adjust the body’s effective integration step and/or position/velocity accordingly.
  - Run the existing SAT + impulse solver on the adjusted state so stacks, friction, and sleep behaviour remain controlled.
- Specs
  - Promote the R1 thin-wall scene into a PhysicsSystem-level test:
    - Fast OBB vs thin wall in the real rigid lane (not just the kernel).
    - Assert no tunnelling and at least one `CollisionV2` event.
  - Keep existing rigid tests green:
    - `rigid-stack-rest` jitter window.
    - `rigid-drop-onto-static` jitter window.
    - Sleep heuristic tests.

#### 14.2.2 Cloth↔Rigid Collisions v1

Goal: cloth and rigid bodies interact in the same world-space coordinate system.

- Collision model
  - Treat cloth vertices (or aggregate spheres) as particles with a radius derived from cloth resolution and scale.
  - Broad-phase: particle spheres vs static AABBs and rigid OBBs.
  - Narrow-phase: sphere vs OBB/AABB:
    - Separate the cloth particle.
    - Apply a reaction impulse to the rigid body (initially optional, configurable).
- Integration point
  - After the rigid lane resolves contact:
    - Use static AABBs and rigid bodies as obstacles when updating cloth.
    - Constrain particles, then run cloth constraint solver.
- Specs
  - Scene CR1: Cloth draping onto a rigid floor box (settles without exploding; offscreen/sleep still behave).
  - Scene CR2: Rigid “ball” impacting a hanging cloth patch (cloth deflects; rigid slows/bounces; jitter within a defined window).

### 14.3 Scenario DSL + Sandbox 2.0

Goal: `/sandbox` becomes a true “physics lab” that mirrors engine acceptance scenes via a shared DSL.

- DSL enhancements
  - Extend `physicsScenarios.ts` with cloth, rigid, and cloth↔rigid scenes beyond C1/C2/R1:
    - Rigid stacks, slopes, seesaws.
    - Cloth-over-boxes, flags with incoming rigid bodies.
    - Optional camera presets and overlay defaults per scene.
- Sandbox integration
  - Map Tests/Demos menus 1:1 to DSL IDs (no ad-hoc scenes).
  - Scene selection:
    - Tears down current entities.
    - Calls the DSL factory.
    - Registers resulting rigid bodies and cloth with `PhysicsSystem`/`SimulationSystem`.
  - Ensure debug overlays and Events panel reflect the same bodies/events the acceptance tests rely on.
- Specs
  - For each important scene:
    - Engine-level acceptance test (existing pattern).
    - Sandbox-level smoke test that loads the scene, steps the engine, and asserts on a small number of overlay/event properties.

### 14.4 Tooling & Observability Upgrades

Goal: elevate the debug UI from a collection of sliders into an inspector-grade tool for understanding and tuning physics behaviour.

- Inspector
  - Clicking a body in the overlay:
    - Highlights the body in the scene.
    - Opens an inspector panel showing position, velocity, sleep state, mass, friction, restitution, etc.
  - For cloth bodies:
    - Show pinned vertex count, average stretch, bounding sphere radius.
- Event timeline
  - Scrollable list of events (CollisionV2, Sleep/Wake, CCD hits, picks).
  - Filters by type/channel, small timeline indicator.
- Record/replay
  - Record:
    - Input actions (spawns, clicks).
    - RNG seeds and relevant configuration.
  - Replay:
    - Deterministically re-run a scenario to reproduce bugs and regressions.
- Perf
  - Visualize per-lane perf budgets per frame:
    - `physics:rigid:fixed`, `physics:cloth:fixed`, CCD sweeps, render.
  - Highlight over-budget lanes in the overlay and/or Events panel.

### 14.5 Engine Packaging & API Stabilization

Goal: extract a reusable engine surface while keeping the demo as the primary “living spec”.

- Public API
  - Consolidate and document the primary exports:
    - `EngineWorld`, `FixedStepLoop`, `SimulationRunner`.
    - `SimulationSystem`, `SimWorld`/snapshot types.
    - `PhysicsSystem` + configuration types.
    - `CameraSystem`, `WorldRendererSystem`, `DebugOverlayState`/`System`, `RenderSettingsState`/`System`.
  - Mark internal modules as implementation details.
- Packaging (as evaluated in `docs/engine/package-eval.md`)
  - `@html-to-cloth/engine-core`: world/loop/types/entity, no `three`.
  - `@html-to-cloth/engine-sim`: SimulationSystem + SimWorld interfaces, no `three`.
  - `@html-to-cloth/engine-render`: camera + render-only systems, `three` as a peer dependency.
  - Use `tsup` to build ESM + d.ts bundles; ESM-only `exports` with `"sideEffects": false`.
- CI
  - Build each package, run tests against built artifacts.
  - Optionally publish `0.x` preview versions for downstream experiments.

### 14.6 Longer-Term (v3+ Ideas)

The following items are explicitly not part of Newton v2, but are natural follow-ons:

- Rigid contact graph & dynamic sleeping (islands).
- Additional collider types (circles, convex polygons), compound bodies.
- More soft bodies (ropes/strings, soft boxes) built on the same constraint engine.
- Scene editor:
  - Visual authoring tool for scenarios that writes back to the DSL.
- Advanced input (multi-touch, gamepad) and scripted scenarios/events.

Each of these should follow the same pattern as v1/v2: define the behaviour via acceptance scenes and tests first, then wire the implementation into the engine and sandbox.

---

Appendix A: Initial Shape Set
- OBB: `center:{x,y}, half:{x,y}, angle(rad)`
- Circle: `center:{x,y}, radius`
- Polygon (Phase 2): `points: Vec2[]` (convex)

Appendix B: Ray Conventions
- Rays are parameterized as `origin + t*dir`, `t ≥ 0`, with `dir` normalized; `rayIntersect` returns smallest `t` or `null`.
