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

Appendix A: Initial Shape Set
- OBB: `center:{x,y}, half:{x,y}, angle(rad)`
- Circle: `center:{x,y}, radius`
- Polygon (Phase 2): `points: Vec2[]` (convex)

Appendix B: Ray Conventions
- Rays are parameterized as `origin + t*dir`, `t ≥ 0`, with `dir` normalized; `rayIntersect` returns smallest `t` or `null`.
