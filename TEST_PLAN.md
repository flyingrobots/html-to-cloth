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
- **Sandbox / DSL Pending**
  - Skipped placeholders: `app/__tests__/sandboxDslScenes.spec.tsx`, `engine/__tests__/clothRigidAcceptance*.test.ts`, `engine/scenarios/__tests__/physicsScenarios.n2.test.ts`
