# PR E — Eventing expansion + Drawer details/filters

Labels: observability, events, ui, project:newton
Milestone: PROJECT: Newton

## Summary
Emit structured events with {id, tag} and payloads: `collision`, `sleep`, `wake`, `pointerImpulse`, `captured`, `modeChange`. Expand Events panel with details (JSON) toggle and filters by type and tag.

## Acceptance Criteria
- [ ] Typed TS union for event types; payload validation
- [ ] Drawer shows details JSON on row expand; filter by tag/type + search

## Tests (write first)
- [ ] eventsEmit.test: emits on expected transitions with structured payloads
- [ ] eventsPanelFilter.test: filters by tag/type and search

