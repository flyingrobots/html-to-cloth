# Physics Acceptance Scenes (Cloth & Rigid)

This document defines a small suite of “engine test map” style scenarios for the current cloth/rigid stack. Each scene has:

- A concrete setup (bodies, gravity, time horizon).
- A measurable pass/fail rule.
- A corresponding automated test.

Today these live purely as engine-level tests; the `/sandbox` route is where we manually visualize and poke at similar setups.

## Scene C1 — Cloth Settling / Jitter

Goal: ensure a cloth patch with an initial perturbation converges to a stable rest state instead of chattering forever.

- Setup
  - 5×5 cloth grid (`PlaneGeometry(1,1,4,4)`).
  - Gravity: `(0, 0, 0)` — no ongoing acceleration.
  - One-time turbulence applied with amplitude `0.01` meters.
  - Simulated for 240 steps at `dt = 0.016` seconds (~4 seconds).
- Measurements
  - Sample the cloth’s world-space bounding sphere center (`y` component) each step.
  - After the run, compute the spread over the last 60 samples: `maxY - minY`.
  - Check `cloth.isSleeping()` after the run.
- Pass criteria
  - `cloth.isSleeping()` is `true` (sleep state reached).
  - The vertical jitter of the center in the last 60 frames is effectively zero:
    - `maxY - minY < 1e-4` meters.
- Automated test
  - `src/engine/__tests__/physicsAcceptanceScenes.test.ts`
  - Test: `"Cloth patch with initial turbulence settles without jitter once asleep"`.

Notes:
- The scene deliberately uses zero gravity so the only motion comes from the initial turbulence and constraint relaxation.
- Once asleep, `update()` early-outs and the bounding sphere should remain stable across further steps.

## Scene C2 — Cloth Sleep/Wake via Pointer

Goal: validate that a sleeping cloth patch wakes when a point enters its bounds and that it responds to a localized impulse.

- Setup
  - 3×3 cloth grid (`PlaneGeometry(1,1,2,2)`).
  - Gravity: `(0, 0, 0)` to make the sleep transition purely velocity-driven.
  - Simulated for 160 steps at `dt = 0.016` seconds to allow auto-sleep.
- Measurements
  - Verify `cloth.isSleeping()` is `true` after the initial run.
  - Query the cloth’s 2D bounding sphere (`center`, `radius`).
  - Pick a point strictly inside the sphere (center is sufficient in this scene).
  - Call `wakeIfPointInside(point)` and then apply a point force at that point.
  - Step the simulation once more and compare a reference vertex before/after.
- Pass criteria
  - Before wake: `cloth.isSleeping()` is `true`.
  - After `wakeIfPointInside`: `cloth.isSleeping()` is `false`.
  - After applying a point force and stepping:
    - At least one vertex position changes measurably:
      - The test samples vertex `0` and asserts `after.x` is not ~=`before.x`.
- Automated test
  - `src/engine/__tests__/physicsAcceptanceScenes.test.ts`
  - Test: `"Cloth patch falls asleep and reliably wakes when a point enters its bounds"`.

Notes:
- This scene is the cloth-side acceptance check for wake behavior; it uses the same primitives the controller and `SimWorld` rely on.
- In `/sandbox`, similar behavior can be exercised by letting the cloth settle, then using pointer interactions to wake it.

## Scene R1 — CCD Thin Wall (No Tunneling)

Goal: ensure continuous collision detection prevents a fast-moving rigid OBB from tunneling through a very thin wall at one substep.

- Setup
  - Moving body:
    - Kind: OBB.
    - Center: `(0, 0)`.
    - Half extents: `(0.1, 0.1)` meters.
    - Angle: `0`.
    - Velocity: `(20, 0)` meters/second to the right.
  - Static obstacle:
    - Kind: AABB.
    - Min: `(0.25, -1)`, Max: `(0.26, 1)` — a 0.01 m thick wall.
  - Time step: `dt = 1/60` seconds.
- Baseline check
  - Naive integration (no CCD) would move the center to `x + v.x * dt` and the right face to `centerX + half.x`.
  - The test asserts that this naive right face lies strictly beyond `wall.max.x`, confirming that tunneling would occur without CCD.
- CCD step
  - Use `advanceWithCCD` to integrate the OBB against the wall for the same `dt`.
  - Result provides `collided` flag and an updated `center`.
  - Compute the new right face: `center.x + half.x`.
- Pass criteria
  - `collided` is `true`.
  - The right face stops at (or just inside) the wall’s entry face within a small epsilon:
    - `rightFace <= wall.min.x + 1e-4`.
- Automated test
  - `src/engine/ccd/__tests__/thinWall.test.ts`
  - Test: `"stops the moving OBB at the wall face when CCD is enabled"`.

Notes:
- This scene is the rigid-side acceptance check for tunneling. It is intentionally independent of the higher-level `PhysicsSystem` so it can be maintained as the CCD kernel evolves.
- In `/sandbox`, the CCD demo lane and debug drawer will be used to approximate this “thin wall” scenario visually.

---

Future work:

- Add rigid-body rest/jitter scenes once the static/dynamic solver is tuned for stable stacks.
- Expose these named scenes directly in the `/sandbox` UI (e.g., a “Scene” dropdown that picks C1/C2/R1 presets).
- Wire Playwright flows that load `/sandbox`, select a scene, and assert high-level overlay/event behavior matches these engine-level specs.

