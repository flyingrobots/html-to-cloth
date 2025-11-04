
# PhysicsRegistry — discovery, descriptors, and change events

Labels: architecture, physics, registry, project:newton
Milestone: PROJECT: Newton

## Summary

Design and implement a PhysicsRegistry that discovers DOM nodes, stores typed descriptors (type, tag, attrs, origins), emits change events on layout/resize, and serves as the single source of truth for activation/reset/inspector.

## Acceptance Criteria

- [ ] Discovers `.cloth-enabled`, `.rigid-dynamic`, `.rigid-static` and nodes with `data-phys-*` or `data-cloth-*` attributes
- [ ] Descriptor includes: { id, tag, type, attrs (parsed), origin (rect/world), active state }
- [ ] Emits events: `registry:add`, `registry:update`, `registry:remove` with prior/next descriptors
- [ ] Diffing works: only changed fields emitted; stable ids across runs
- [ ] Inspector/activation can subscribe to the registry

## Tests (write first)
- [ ] physicsRegistry.spec: discovery from a test DOM, descriptor diffing, events on resize
- [ ] integration: inspector or controller subscribes and receives `registry:update`
