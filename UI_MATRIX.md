# UI and Mantine Components: Feature Matrix and Merge Strategy

This report contrasts the current Mantine‑based UI on `main` with the older UI branch and outlines a pragmatic merge strategy.

## Matrix

| Capability | main (current) | feat/mantine-migration |
|---|---|---|
| Language/tooling | TypeScript (strict), Vite 7, Vitest 3 | JavaScript (JSX), Vite (JS config), Vitest (JS config); removes TS configs |
| UI library | Mantine v7 (`@mantine/core`, `@mantine/notifications`) | Mantine v7 as well, but app architecture differs (older controller: `PortfolioWebGL`) |
| Debug palette | Drawer with sliders, switches, select; persisted via localStorage; integrated with `EngineActions` | Drawer with similar controls; wired to `PortfolioWebGL` API; different state keys and wiring |
| Notifications | Mantine Notifications for CCD collision toasts (optional) | Not clearly wired; no CCD toast integration |
| Keyboard shortcuts | Cmd/Ctrl+J (debug), Space to step when paused; spectrum defined in tests | Cmd/Ctrl+J for debug; Space step (similar) |
| Overlay integration | `DebugOverlaySystem` reflects pointer/AABBs/pins; wireframe toggle | Similar overlay goals, different component structure |
| Event panel | Specs on `main` for non‑modal Events panel (Cmd/Ctrl+E) | Not present (older UI) |
| App/controller coupling | `App.tsx` talks to `ClothSceneController` and `EngineActions` | `App.jsx` talks to `PortfolioWebGL` (legacy) |
| Build surface | TS types, typed props, strict imports | Downshifts to JS; removes `tsconfig*`, `vite.config.ts`, renames tests to `.js` |
| Risk if merged wholesale | High: architecture and language downgrade; will clobber `App.tsx`, `main.tsx`, ts configs | — |

Notes
- The UI branch is more of an earlier Mantine port built around a legacy `PortfolioWebGL` controller and a JS toolchain—conflicts heavily with the current TS + EngineWorld/SimulationSystem architecture.

## Comparison vs current main
- main already has the Mantine stack we want (core + notifications), debug palette wired to engine actions, and tests that prove idempotent integration.
- The UI branch would revert to JS, remove TS configuration, and replace `App.tsx` with `App.jsx`, diverging from today’s engine/controller patterns.

## Merge Strategy
Goal: keep the modern TS + Mantine UI on `main`. Cherry‑pick selectively from the UI branch if any small improvements remain relevant.

1) Identify cherry‑picks
- Scan `feat/mantine-migration` for small, self‑contained improvements (e.g., any html2canvas/iframe interception, minor UX polish). If present, port them into TS files on `main` without changing public UI contracts.
- If a change only exists as JS, replicate the logic in TS rather than adding JS files.

2) Preserve current app shell
- Keep `src/App.tsx`, `src/main.tsx`, existing debug palette props, and `EngineActions` routing unchanged.
- Keep Mantine v7 and notifications exactly as on `main`.

3) Event panel (from specs on main)
- Implement the non‑modal Events panel (Cmd/Ctrl+E) against `EventBusSystem` using the Phase 0 mailboxes; do not import the UI branch for this.

4) Order of operations
- Step A: port any small, composable improvements from the UI branch into TS (if any are useful). Skip if not strictly helpful.
- Step B: build the Events panel directly on `main`.

5) Effort and risk
- Cherry‑picks: 0.5–1 day (only if a concrete, self‑contained improvement exists).
- Events panel: 1–2 days (new component, mailbox reader + virtualization).
- Risk is low if we avoid wholesale merging and keep the current TS app shell intact.

## What to keep vs leave out
- Keep: current `App.tsx`, Mantine v7 setup, notifications, EngineActions wiring, tests.
- Leave out: the UI branch’s JS toolchain and legacy controller (`PortfolioWebGL`), file renames that remove TS, and any changes that conflict with engine APIs.

