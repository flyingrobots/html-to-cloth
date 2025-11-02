# PR B — GSAP draggable/resizable windows (Debug + Events)

Labels: enhancement, ui, gsap, project:newton
Milestone: PROJECT: Newton

## Summary
Convert Debug and Events panels to floating, draggable, resizable Mantine shells (GSAP Draggable). Persist positions/sizes in localStorage. Provide dock-to-bottom (45%) mode and ESC to exit fullscreen.

## Acceptance Criteria
- [ ] Drag/resize both panels; positions persist across reloads
- [ ] Dock-to-bottom mode; ESC exits fullscreen
- [ ] Hotkeys remain functional; panels are non‑modal

## Tests (write first)
- [ ] panelState.test: drag/resize persisted to localStorage
- [ ] hotkeys.test: Cmd/Ctrl+J and Cmd/Ctrl+E still work

## Notes
- Keep Mantine shells; use GSAP for motion only

