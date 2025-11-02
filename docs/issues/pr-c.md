# PR C — Rigid OBB collider + SAT vs AABB (core)

Labels: physics, collision, sat, high-priority, project:newton
Milestone: PROJECT: Newton

## Summary
Implement oriented rectangle (OBB) collider for rigid-dynamic. Use SAT vs static AABB to compute MTV, resolve, apply restitution and basic friction. Draw OBB and MTV in overlay (toggle).

## Acceptance Criteria
- [ ] Deterministic MTV resolution on orthogonal and diagonal hits
- [ ] Restitution within tolerance; tangential component damped by friction
- [ ] Overlay draws OBB and MTV when enabled

## Tests (write first)
- [ ] satObbAabb.test: projection intervals + MTV direction
- [ ] rigidObbIntegration.test: canonical hits reflect/bounce as expected

## Notes
- Keep MODE=test stable (no GSAP in tests)

