# PR A — Wireframe overlay + type glyph legend + Events panel v2

Labels: enhancement, ui, overlay, good-first-pr, project:newton
Milestone: PROJECT: Newton

## Summary
- Draw wireframe on top of solid meshes via a dedicated overlay pass (no reliance on material.wireframe alone).
- Add type glyphs at object centers (cloth=circle, rigid=diamond, static=square) and a mini legend in the Debug panel.
- Replace Drawer with a non‑modal Events panel (opens at ~45% height), Cmd/Ctrl+E hotkey, Fullscreen toggle; scene remains interactive.

## Acceptance Criteria
- [ ] Overlay wireframe visible above textured mesh when Wireframe is ON
- [ ] Glyphs rendered per type; legend visible in Debug panel
- [ ] Events panel opens at ~45%, non‑modal, fullscreen toggle works; hotkey Cmd/Ctrl+E
- [ ] Scene input remains interactive while Events panel is open

## Tests (write first)
- [ ] overlayWireframe.test: assert wireframe LineSegments exist for an active cloth
- [ ] eventsPanel.test: hotkey toggles, non‑modal click-through verified, fullscreen toggles height

## Notes
- Keep MODE=test semantics stable
- GSAP dragging/resizing is PR B (out of scope here)

