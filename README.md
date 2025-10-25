# Cloth Web Demo

<img src="https://github.com/user-attachments/assets/976ff0de-e55b-46d6-990b-bba48cbe741e" width="480" align="right" />

A portfolio playground that hides a WebGL cloth simulation beneath an accessible DOM layout. Clicking any `.cloth-enabled` element swaps it for a textured mesh, lets the fabric react to pointer gusts, and eventually returns the DOM element when the cloth falls off screen. The codebase is deliberately modular so the experiment can be reused for future interactive sites.

## Architecture at a Glance

| Layer | Responsibilities | Source |
| ----- | ---------------- | ------ |
| UI / DOM | captures elements, handles pointer input, renders Three.js scene | `src/lib/clothSceneController.ts` + React components |
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
- `src/lib/clothSceneController.ts` – DOM orchestration + simulation delegation.
- `src/engine/simulationRunner.ts` – deterministic fixed-step loop.
- `src/lib/clothPhysics.ts` – cloth solver plus impulse helpers.

## Testing

- Unit suites cover cloth physics, impulse helpers, simulation scheduler, SimWorld, entity lifecycle, and the simulation runner.
- Integration suite (`src/lib/__tests__/domIntegration.test.ts`) verifies DOM capture, activation lifecycle, pointer wakeups, offscreen recycling, and debug controls.
- Manual QA scenarios are listed in [`TEST_PLAN.md`](TEST_PLAN.md); progress is tracked in [`PROGRESS_CHECKLIST.md`](PROGRESS_CHECKLIST.md).

## Workflow

We follow the cycle described in [`AGENTS.md`](AGENTS.md): branch-per-task, write failing specs first, implement, document, log the session, open a PR. Notes and experiments are appended to [`BLOG_NOTES.md`](BLOG_NOTES.md).

## Roadmap

- Camera/render systems that consume simulation snapshots instead of hand-rolling controller logic.
- Continuous collision for sweeping pointer helpers.
- Expanded component library (e.g., cloth analytics, audio emitters) via the entity layer.
- Portable presets for gravity, pinning, and impulse tuning.

Contributions, experiments, and wild ideas are welcome—this repository is a sandbox on purpose.
