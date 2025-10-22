# Physics Refactor Checklist

## World-Space Transform Layer
- [ ] Introduce `WorldBody` abstraction with local mesh, world transform (4×4), mass/inertia, velocity/acceleration.
- [ ] Update cloth activation path to instantiate `WorldBody` and pass it into `ClothPhysics`.
- [ ] Sync `DOMToWebGL` rendering with each body's world transform.

## Sleep Heuristic Rewrite
- [ ] Track world-space linear/angular velocity per body.
- [ ] Replace per-particle delta sleep check with world velocity thresholds + deformation fallback.
- [ ] Expose sleep thresholds (velocity, frames) in the debug drawer.
- [ ] Add unit/integration tests covering free-fall vs. deformation cases.

## Camera & Viewport Integration
- [ ] Create `WorldCamera` with position/rotation, orthographic + perspective projections.
- [ ] Implement critically damped spring for look-at/target blending.
- [ ] Teach `DOMToWebGL` to consume the camera matrices and render the DOM as a billboarded quad.
- [ ] Update pointer collider/AABB helpers to operate in world space.

## Extended Goals
- [ ] World scene registry for bodies, gravity, and cameras.
- [ ] Support full-page cloth/rigid transitions (DOM quad as a physics body).
- [ ] Document new architecture (scene graph, transforms, camera) in this file.
