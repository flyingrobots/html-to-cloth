# Cloth Portfolio Demo – Test Plan

## Automated Tests
- **DOM Flagging** – Render `App` and assert all key elements have `.cloth-enabled` while remaining visible when the WebGL controller is inactive.
- **Reduced-Motion Opt-Out** – Mock `prefers-reduced-motion: reduce` to verify `PortfolioWebGL` never initializes and DOM opacity stays at defaults.
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
