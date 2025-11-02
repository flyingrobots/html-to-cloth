# PROJECT: Newton — Roadmap

Goal: turn the Mantine-only demo into a debuggable physics lab with robust collisions, clear observability, ergonomic tools, and playful GSAP touches.

Milestone duration: ~2 weeks

## Tracks (stacked, small PRs)

1. PR A — Wireframe overlay + type glyph legend + Events panel v2 (non-modal)
2. PR B — GSAP draggable/resizable windows (Debug + Events)
3. PR C — Rigid OBB collider + SAT vs AABB (core)
4. PR D — Physics data attributes (rigid + cloth)
5. PR E — Eventing expansion + Drawer details/filters
6. Sandman reset system (event-driven sleeper reset)
7. Inspector gizmo (🔍)
8. Demo polish: Clothify All Visible + Panel Hide handoff
9. Performance budgets + perf meter overlay
10. Stretch: Stage curtain cloth demo

---

## Acceptance checklists (PR-level)

### PR A — Wireframe overlay + glyph legend + Events panel v2
- [ ] Wireframe overlay draws on top of solids (no reliance on material.wireframe)
- [ ] Type glyphs (cloth=circle, rigid=diamond, static=square) at centers
- [ ] Legend visible at top of Debug panel
- [ ] Events panel opens at ~45% height; non-modal; fullscreen toggle; Cmd/Ctrl+E
- [ ] Tests: overlay pass present; events panel non-modal toggle works

### PR B — GSAP draggable/resizable windows
- [ ] Debug + Events panels draggable/resizable; persisted positions
- [ ] Dock-to-bottom mode; ESC exits fullscreen
- [ ] Tests: mount/drag/resize state persists; hotkeys OK

### PR C — Rigid OBB SAT vs AABB
- [ ] SAT MTV resolution + restitution + tangential friction
- [ ] Overlay draw OBB + MTV (toggle)
- [ ] Tests: canonical hits (orthogonal/diagonal) pass deterministically

### PR D — Physics data attributes
- [ ] Rigid: data-phys-(shape|mass|restitution|friction) parsed/applied
- [ ] Cloth: data-cloth-damping (prep friction)
- [ ] Debug defaults for new activations; optional broadcast
- [ ] Tests: parser unit + activation integration

### PR E — Events expansion + Drawer details
- [ ] Emit: collision, sleep, wake, pointerImpulse, captured, modeChange (id, tag)
- [ ] Drawer: details JSON, filter by tag/type + search
- [ ] Tests: emits and panel rendering

### Sandman reset system
- [ ] On sleep: if active + far-from-origin, reset after N seconds; cancel on wake
- [ ] Cloth: restore static DOM (or GSAP FLIP)
- [ ] Rigid: fade/flip back; remove adapter
- [ ] Events: resetRequest/reset
- [ ] Tests: timers + MODE=test reliable path

### Inspector gizmo (🔍)
- [ ] Hotkey I toggles inspector; Popover shows physics info
- [ ] Works for cloth/rigid/static
- [ ] Tests: overlay highlight; popover content

### Perf budgets & meter
- [ ] Define budgets (overlays ≤0.8 ms, SAT ≤1.5 ms @ 20 bodies, events ≤0.2 ms @ 200/min)
- [ ] Perf meter overlay with rolling averages
- [ ] Tests: basic presence (skip exact timings in CI)

---

## Keyboard shortcuts (legend)
- Cmd/Ctrl+J: Debug panel
- Cmd/Ctrl+E: Events panel
- Space: Step once (when paused)
- R: Toggle real-time
- W: Wireframe overlay
- A: Debug AABBs
- S: Sleep State tint
- P: Pin markers
- I: Inspector

