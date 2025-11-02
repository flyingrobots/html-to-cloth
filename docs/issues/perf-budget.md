# Performance budgets & perf meter overlay

Labels: performance, observability, project:newton
Milestone: PROJECT: Newton

## Summary
Define per-frame budgets (overlays ≤ 0.8 ms, SAT ≤ 1.5 ms @ 20 bodies, events ≤ 0.2 ms @ 200/min) and add a lightweight perf meter overlay with rolling averages.

## Acceptance Criteria
- [ ] Budgets documented in code and README
- [ ] Perf meter overlay shows current ms/frame per subsystem
- [ ] Soft warnings logged when budgets exceeded

## Tests (write first)
- [ ] perfOverlay.test: overlay presence; basic counters update

