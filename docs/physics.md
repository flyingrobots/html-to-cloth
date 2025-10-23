# Physics Refactor Checklist

## World-Space Transform Layer
- [x] Introduce `WorldBody` abstraction with local mesh, world transform (4×4), mass/inertia, velocity/acceleration.
- [x] Update cloth activation path to instantiate `WorldBody` and pass it into `ClothPhysics`.
- [x] Sync `DOMToWebGL` rendering with each body's world transform.

## Sleep Heuristic Rewrite
- [x] Track world-space linear velocity per body (angular velocity pending rigid body support).
- [x] Replace per-particle delta sleep check with world velocity thresholds + deformation fallback.
- [x] Expose sleep thresholds (velocity, frames) in the debug drawer.
- [x] Add unit/integration tests covering free-fall vs. deformation cases.

## Camera & Viewport Integration
- [x] Create `WorldCamera` with position/rotation, orthographic + perspective projections.
- [x] Implement critically damped spring for look-at/target blending.
- [x] Teach `DOMToWebGL` to consume the camera matrices and render the DOM as a billboarded quad.
- [x] Update pointer collider/AABB helpers to operate in world space.

## Extended Goals
- [ ] World scene registry for bodies, gravity, and cameras.
- [ ] Support full-page cloth/rigid transitions (DOM quad as a physics body).
- [ ] Document new architecture (scene graph, transforms, camera) in this file.
