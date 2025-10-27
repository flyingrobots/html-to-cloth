# Cloth Web Demo

<img src="https://github.com/user-attachments/assets/976ff0de-e55b-46d6-990b-bba48cbe741e" width="480" align="right" />

A portfolio playground that hides a WebGL cloth simulation beneath an accessible DOM layout. Clicking any `.cloth-enabled` element swaps it for a textured mesh, lets the fabric react to pointer gusts, and eventually returns the DOM element when the cloth falls off screen. The codebase is deliberately modular so the experiment can be reused for future interactive sites.

## Architecture at a Glance

| Layer | Responsibilities | Source |
| ----- | ---------------- | ------ |
| UI / DOM | captures elements, handles pointer input, debug UI | `src/lib/clothSceneController.ts` + React components |
| Render | applies camera snapshot to DOMToWebGL and renders each frame | `src/engine/render/worldRendererSystem.ts`, `src/lib/domToWebGL.ts` |
| Camera | spring camera with read-only snapshots | `src/engine/camera/CameraSystem.ts`, `src/engine/camera/CameraSpring.ts` |
| Simulation | cloth physics, collision clamps, sleep/wake, scheduler | `src/lib/clothPhysics.ts`, `src/lib/simWorld.ts`, `src/lib/collisionSystem.ts` |
| Engine | fixed-step loop & system ordering | `src/engine/simulationRunner.ts`, `src/engine/world.ts` |
| Entity | lightweight ECS tracking cloth body adapters | `src/engine/entity/` |

Long-form docs live in:

- [`docs/architecture.md`](docs/architecture.md) – layer overview, DI strategy, extension tips.
- [`docs/components.md`](docs/components.md) – Mermaid component diagram.
- [`docs/data-flow.md`](docs/data-flow.md) – step-by-step activation/update/offscreen flows.
- Generated API docs (`npm run docs:api`) end up in `docs/api/`.

## Getting Started

```bash
npm install
npm run dev        # start the Vite dev server
npm run build      # type-check + production bundle
npm test           # run Vitest suites
npm run docs:api   # generate Markdown API reference via TypeDoc
```

Key entry points:

- `src/App.tsx` – React shell + debug drawer wiring.
- `src/lib/clothSceneController.ts` – DOM orchestration + simulation delegation (rendering handled by a system).
- `src/engine/render/worldRendererSystem.ts` – applies the camera snapshot and calls DOMToWebGL render.
- `src/engine/camera/CameraSystem.ts` – spring-based camera that exposes read-only snapshots.
- `src/engine/simulationRunner.ts` – deterministic fixed-step loop.
- `src/lib/clothPhysics.ts` – cloth solver plus impulse helpers.

## Testing

- Unit suites cover cloth physics, impulse helpers, simulation scheduler, SimWorld, entity lifecycle, and the simulation runner.
- Integration suite (`src/lib/__tests__/domIntegration.test.ts`) verifies DOM capture, activation lifecycle, pointer wakeups, offscreen recycling, and debug controls.
- App UI tests (`src/app/__tests__/debugActions.test.tsx`) assert that the debug palette routes actions into the engine (real-time, substeps, camera zoom, gravity, iterations).
- Render-while-paused integration (`src/engine/render/__tests__/pausedRenderIntegration.test.ts`) verifies the render system still runs during `engine.frame(dt)` when real-time is disabled.

## Debug Presets

For quick demos, the debug palette includes presets that apply multiple settings at once:

- Floaty – gravity 6.0, 3 iterations, looser sleep (0.0005, 80f), 1.2× zoom, warm-start 2 passes
- Crisp – gravity 9.81, 6 iterations, default sleep (0.001, 60f), 1.0× zoom, warm-start 3 passes
- Heavy – gravity 14.0, 8 iterations, tighter sleep (0.002, 40f), 0.9× zoom, warm-start 1 pass
- Manual QA scenarios are listed in [`TEST_PLAN.md`](TEST_PLAN.md); progress is tracked in [`PROGRESS_CHECKLIST.md`](PROGRESS_CHECKLIST.md).

## Workflow

We follow the cycle described in [`AGENTS.md`](AGENTS.md): branch-per-task, write failing specs first, implement, document, log the session, open a PR. Notes and experiments are appended to [`BLOG_NOTES.md`](BLOG_NOTES.md).

Debug actions entry point: create `EngineActions` with `runner`, `world`, `camera`, and `simulation` from the controller. The UI never reaches into simulation internals directly.

## Roadmap

- Camera/render systems that consume simulation snapshots instead of hand-rolling controller logic.
- Continuous collision for sweeping pointer helpers.
- Expanded component library (e.g., cloth analytics, audio emitters) via the entity layer.
- Portable presets for gravity, pinning, and impulse tuning.

Contributions, experiments, and wild ideas are welcome—this repository is a sandbox on purpose.
