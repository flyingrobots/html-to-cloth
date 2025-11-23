# Cloth Portfolio Demo – Test Plan

## Automated Tests
- **DOM Flagging** – Render `App` and assert all key elements have `.cloth-enabled` while remaining visible when the WebGL controller is inactive.
- **Reduced-Motion Opt-Out** – Mock `prefers-reduced-motion: reduce` to verify `ClothSceneController` never initializes and DOM opacity stays at defaults.
- **Mesh Lifecycle** – Stub DOM capture utilities to confirm `captureElement`, `createMesh`, and `disposeMesh` fire appropriately through activation and offscreen cleanup.
- **Pointer Impulse Hook** – Spy on `ClothPhysics.applyPointForce`, dispatch synthetic pointer events, and ensure impulse strength decays frame-to-frame.

## Physics & Collision Unit Tests
- **Constraint Stability** – Run multiple `update` steps on a small cloth grid and assert edge lengths stay within tolerance of `restLength`.
- **Pin / Release** – Pin the top edge, ensure pinned particles remain fixed across updates, then `releaseAllPins` and confirm movement resumes.
- **AABB Collision** – Push particles beyond static body bounds and verify `constrainWithinAABB` clamps positions and adjusts `previous` vectors.

## Integration & Manual QA
- **Initial Render** – In `npm run dev`, confirm the DOM remains crisp pre-activation and WebGL meshes align after capture on resize/scroll.
- **Activation Cycle** – Click each `.cloth-enabled` element; observe pinning, detachment, collisions, and opacity restoration once offscreen.
- **Pointer Gusts** – Sweep the pointer over active cloth to inspect ripple responsiveness and damping once the pointer leaves.
- **Back-to-Back Activations** – Trigger multiple elements in sequence to watch for frame drops or console warnings.
- **Accessibility Regression** – Enable OS-level Reduce Motion and verify the overlay never starts while the DOM stays interactive.
- **Performance Snapshot** – Capture frame timing and network waterfall to document lazy-loaded html2canvas behavior.

## Regression Drills
- **Browser Matrix** – Validate behaviour in Chrome 129, Safari 18 (macOS/iOS), and Firefox 131.
- **Network Throttle** – Test on “Slow 3G” to ensure html2canvas lazy load does not freeze the UI.
- **Memory Cleanup** – Activate, scroll, and refresh multiple times while monitoring for leaked WebGL resources or detached DOM nodes.

### Manual QA Runbook & Results

For the latest cross‑browser manual runbook and results template, see:

- docs/qa/manual-qa-2025-10-29.md

---

## Appendix A — Automated Test Inventory (Vitest)

Current suite (as of 2025-11-23) grouped by area. Tests live under `src/**/__tests__` unless noted.

- **Engine Core & Loop**
  - `engineWorld.test.ts`, `fixedStepLoop.test.ts`, `simulationRunner.test.ts`, `simulationSystem.test.ts`
- **Events & Bus**
  - `channels.test.ts`, `cursor.test.ts`, `metrics.test.ts`, `stats.test.ts`, `mailbox.test.ts`, `mailbox.behavior.test.ts`, `edgecases.ring-seq.test.ts`, `eventRing.test.ts`, `subscription.test.ts`, `subscription.multi-channel.test.ts`, `determinism.test.ts`, `invalidation.test.ts`, `typed.core.test.ts`, `typed.registry.test.ts`, `wakeMarkerSystem.test.ts`, `reentrancy.test.ts`
- **Physics / CCD**
  - CCD kernel: `ccd/thinWall.test.ts`, `ccd/raySlabs.test.ts`, `ccd/circleTOI.test.ts`, `ccd/sweepTOI.*.test.ts`, `ccd/obb-obb-rot.test.ts`
  - PhysicsSystem CCD policy & stress: `physicsSystem.ccdPolicy.test.ts`, `physicsSystem.ccdThinWall.test.ts`, `physicsSystem.ccdResponse.test.ts`, `physicsSystem.ccdStress.test.ts`, `physicsSystem.ccdRotated.test.ts`
  - Rigid collisions/sleep/impulses: `rigidStaticSystem.test.ts`, `rigidStaticSystem.rest.test.ts`, `rigidStaticSystem.impulse.test.ts`, `rigidStaticSystem.dynamic.test.ts`, `rigidStaticSystem.sleep.test.ts`
  - Picking: `physics/__tests__/picking.test.ts`
  - Acceptance: `physicsAcceptanceScenes.test.ts`, `dropBoxAcceptance.test.ts`
- **Cloth & Simulation Helpers**
  - `clothPhysics.test.ts`, `impulse.test.ts`, `simWorld.test.ts`, `simulationScheduler.test.ts`, `units.scale.test.ts`, `satObbAabb.test.ts`, `collisionSystem.worldMapping.test.ts`, `elementPool.test.ts`
- **Render & Camera**
  - `render/worldRendererSystem.test.ts`, `render/debugOverlaySystem.test.ts`, `renderSettingsSystem.test.ts`, `render/overlayWireframe.spec.ts`, `render/pausedRenderIntegration.test.ts`, `render/controllerReinitIdempotent.test.ts`, `render/controllerDisposeRenderSystems.test.ts`
  - Camera: `camera/cameraSystem.test.ts`
- **App / UI Integration**
  - `app/__tests__/sandboxLayout.spec.tsx`, `sandboxScenes.spec.tsx`, `sandboxDropBox.spec.tsx`, `eventsPanel.spec.tsx`, `debugActions.test.tsx`
- **Scenario DSL**
  - `engine/scenarios/__tests__/physicsScenarios.test.ts` (N1 coverage; N2 scenarios currently skipped in `physicsScenarios.n2.test.ts`)
- **CCD Rotations & Stress**
  - Rotated movers vs AABB: `physicsSystem.ccdRotated.test.ts` (two rotated-obstacle gauntlet cases currently skipped until CCD can ingest rotated static obstacles).
  - Speed/threshold/graze/gauntlet: `physicsSystem.ccdStress.test.ts`

## Appendix B — Structured Test Case Descriptions

| ID | Title | Objective | Steps | Expected Result |
| --- | --- | --- | --- | --- |
| TC-CCD-001 | CCD policy clamps fast body at thin wall | Verify PhysicsSystem CCD prevents tunneling against thin static wall | Configure CCD (speedThreshold 1, eps 1e-4); add fast OBB toward thin AABB; `fixedUpdate(0.1)` | Body stops at wall face (x ≤ wall+half+eps) and emits CollisionV2 |
| TC-CCD-002 | CCD policy gates by speed | Ensure slow bodies stay on SAT path | Add two bodies: fast vx=10, slow vx=0.5; set CCD threshold 1; `fixedUpdate(0.2)` | Fast body clamped near wall; slow body advances past 0.5; collision events present |
| TC-CCD-003 | CCD response cancels inward velocity | Heavy fast body restitution 0 stops at wall | Add body mass=2, vx=10 toward wall; CCD on; `fixedUpdate(0.05)` | Position clamped; velocity.x ≤ 0 after response |
| TC-CCD-004 | CCD earliest obstacle wins | Multiple static AABBs; pick first TOI | Fast OBB toward two walls at 0.32 and 0.62; `fixedUpdate(0.05)` | Body stops at first wall (≤0.32+half) |
| TC-CCD-005 | CCD handles grazing hit | Shallow diagonal toward thin AABB | Fast OBB vx=8, vy=-0.5 toward slim wall; `fixedUpdate(0.05)` | Position clamped near wall; velocity.x ≤ 0 |
| TC-CCD-006 | CCD threshold bypass | Slow body below threshold tunnels | OBB vx=0.9 (<1) toward wall; `fixedUpdate(0.8)` | Body advances past 0.65 (no CCD clamp) |
| TC-CCD-007 | CCD per-body disable | Fast body with `ccd:false` skips CCD | Same as TC-CCD-006 but vx=10, ccd:false; `fixedUpdate(0.05)` | Body tunnels past wall (x > wall+half) |
| TC-CCD-008 | Rotated mover vs axis-aligned wall | Rotated OBB uses CCD sweep vs AABB | Rotate mover 15°, fast vx=8 toward thin AABB; `fixedUpdate(0.05)` | Body clamped near wall; velocity.x ≤ 0 |
| TC-CCD-009 | Rotated mover diagonal approach | Rotation + diagonal velocity | Rotate mover 18°, vx=6, vy=-1 toward AABB; `fixedUpdate(0.08)` | Body clamped; velocity.x ≤ 0; |vy| ≤ 2 |
| TC-CCD-010 | Rotation-only does not trigger CCD | Zero linear velocity | Rotate mover 30°, v=0; `fixedUpdate(0.1)` | Position unchanged (≈0.1); no collisions |
| TC-CCD-011 (skipped) | Rotated mover vs rotated obstacle | Future support for static rotated obstacles | Add static rotated obstacle (mass 0); fast rotated mover; `fixedUpdate(0.06)` | Body clamped at first obstacle, vx ≤ 0 |
| TC-CCD-012 (skipped) | Rotated obstacle gauntlet earliest TOI | Future rotated-obstacle feed | Two rotated obstacles; fast mover; `fixedUpdate(0.05)` | Clamp at first obstacle (≤0.28+half) |
| TC-ENG-001 | EngineWorld tick order | Ensure systems run in priority order | Step EngineWorld with mock systems; inspect calls | Systems invoked by priority ascending |
| TC-LOOP-001 | FixedStepLoop catches up | Catch-up with substeps | Advance loop with large dt; count substeps | Substep count matches ceil(dt/step) |
| TC-SIM-001 | SimulationSystem wakes sleeping cloth | Sleep thresholds then wake via event | Put cloth to sleep; publish Wake; tick | Cloth active after wake |
| TC-RENDER-001 | Paused render still draws | Render while real-time off | Disable runner realtime; call frame(dt) | Render system called once |
| TC-APP-001 | Sandbox navigation | Home CTA links to /sandbox | Render App; click Sandbox | Sandbox layout visible |
| TC-APP-002 | Sandbox Drop Box spawns body | UI drives PhysicsSystem | Click “Drop Box”; read overlay state | Rigid body above floor AABB appears |
| TC-UI-001 | Debug preset routes actions | Applying preset fires engine actions | Open debug drawer; pick “Heavy” preset; spy EngineActions | Actions dispatched (gravity, iterations, warm-start, zoom) |
| TC-DOM-001 | DOM capture alignment | Mesh matches DOM bounds | Capture element; inspect mesh dimensions | Mesh size aligns to DOM rect with px↔meter mapping |
| TC-PHYS-001 | Rigid static SAT | OBB vs AABB overlap resolves | Overlap setup; run `fixedUpdate`; inspect MTV | Position separated; collision event emitted |
| TC-PHYS-002 | Sleep heuristic | Body sleeps below threshold | Low velocity over N frames | Sleep event emitted; velocity zeroed |
| TC-CLOTH-001 | Constraint stability | Cloth edges stay near rest length | Step solver for N frames | Edge lengths within tolerance |
| TC-CLOTH-002 | Pin and release | Pinned vertices stay fixed until release | Pin top row; step; release; step | Pinned stay; release restores motion |
| TC-COLL-001 | Cloth AABB constrain | Particles clamped to bounds | Push beyond AABB; step | Positions clamped; previous adjusted |
| TC-SCALE-001 | Units mapping | 1024×768 -> 4m×3m mapping | Convert center/edges via helpers | Center=0, edges=±2/±1.5 |
| TC-DSL-001 | Scenario IDs | DSL contains expected IDs | Read `physicsScenarios` ids | Contains rigid/drop/stack/C1/C2 entries |
| TC-OVERLAY-001 | Overlay wireframe | Wireframe renders bodies | Render overlay snapshot | Wireframe vertices match bodies |
- **Sandbox / DSL Pending**
  - Skipped placeholders: `app/__tests__/sandboxDslScenes.spec.tsx`, `engine/__tests__/clothRigidAcceptance*.test.ts`, `engine/scenarios/__tests__/physicsScenarios.n2.test.ts`
