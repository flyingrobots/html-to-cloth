# PR D — Physics data attributes (rigid + cloth)

Labels: attrs, physics, config, project:newton
Milestone: PROJECT: Newton

## Summary
Parse and apply per-element attributes:
- Rigid: `data-phys-shape` (circle|obb), `data-phys-mass`, `data-phys-restitution`, `data-phys-friction`.
- Cloth: `data-cloth-damping` (prep `data-cloth-friction`).
Debug panel shows defaults for new activations; changing defaults affects new activations.

## Acceptance Criteria
- [ ] Attributes parsed (clamped) and applied on activation
- [ ] Inspector shows parsed values
- [ ] Defaults reflected in Debug panel and respected

## Tests (write first)
- [ ] parser.test: valid/invalid attrs → clamped values
- [ ] activationAttrs.test: activation uses attrs; defaults when missing

