# Inspector gizmo (🔍)

Labels: inspector, ui, devtools, project:newton
Milestone: PROJECT: Newton

## Summary
Hotkey I toggles an inspector cursor. Hovering a DOM element shows a Mantine Popover with: type, tag, collider (shape, extents), mass/restitution/friction, awake/sleep, world bounds. Click pins the popover; ESC dismisses.

## Acceptance Criteria
- [ ] Inspector toggle (I); popover content accurate for cloth/rigid/static
- [ ] No layout shift; non‑modal

## Tests (write first)
- [ ] inspector.test: overlay highlight and popover render; shows basic fields

