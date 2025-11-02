# Sandman — Event-driven sleeper reset system

Labels: behavior, polish, project:newton
Milestone: PROJECT: Newton

## Summary
When a body has been activated and later falls asleep away from its origin, schedule a reset after N seconds (default 5s). Cancel on wake. Cloth returns to static DOM (or GSAP FLIP). Rigid returns to origin and removes adapter. Emit `resetRequest` and `reset` events.

## Acceptance Criteria
- [ ] Sleep events trigger reset scheduling; wake cancels
- [ ] Cloth → static DOM; rigid → origin; optional GSAP FLIP when available
- [ ] Events recorded in Events panel

## Tests (write first)
- [ ] sandmanTimers.test: sleep→reset; wake cancels
- [ ] modeTest.test: MODE=test path reliable without GSAP

