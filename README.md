# Cloth Web Demo

<img src="https://github.com/user-attachments/assets/976ff0de-e55b-46d6-990b-bba48cbe741e" width="500" align="right" />

A proof-of-concept portfolio that hides a WebGL cloth simulation beneath an accessible DOM layout. Clicking any `.cloth-enabled` element swaps it for a textured mesh, runs cloth physics with pointer-driven gusts, and lets the fabric tumble off screen before the DOM reappears. The goal is to create an unexpected effect that delights and entertains all ages and experience levels.

### Current Highlights

- Canonical meter-based render space layered over the DOM via Three.js.
- DOM capture → tessellated mesh pipeline with lazy `html2canvas` snapshots.
- Custom cloth solver (Verlet integration, constraint satisfaction, sleep/wake).
- Spring-driven camera system with debug palette controls for stiffness/damping tuning.
- `Simulation` scheduler + `SimWorld` for active-body ticking and basic broad-phase sweeps.
- Pointer impulses and collision clamps wired through a unified `applyImpulse` API.
- Tests-as-specs workflow: Vitest coverage for cloth, impulses, scheduler, SimWorld, DOM integration.

## Getting Started

```bash
npm install
npm run dev    # start Vite dev server
npm run build  # production build
npm test       # run Vitest suites
```

The project uses React + Vite for rendering and currently relies on npm (see `package-lock.json`). WebGL lives in `src/lib/` alongside the simulation modules.

## Key Scripts

| Script | Description |
| ------ | ----------- |
| `npm run dev` | Run the dev server with HMR. |
| `npm run build` | Type-check and bundle for production. |
| `npm test` | Execute all Vitest specs (cloth, impulse, scheduler, SimWorld, DOM integration). |

## Repository Workflow

We follow the loop codified in [`AGENTS.md`](AGENTS.md):

1. Branch per task, write failing specs first.
2. Implement structure/behaviour, logging each step in an append-only notebook.
3. Update docs/checklists, push PR, address feedback.

## Testing & QA Plan

See [`TEST_PLAN.md`](TEST_PLAN.md) for automated and manual coverage targets. The live checklist lives in [`PROGRESS_CHECKLIST.md`](PROGRESS_CHECKLIST.md).

## Notes & Blog Stream

Until the notebook tooling is automated, we log context in [`BLOG_NOTES.md`](BLOG_NOTES.md) as an append-only stream. The long-term plan is to replace this with a `git-notebook` ref (see AGENTS.md) so notes become empty commits on `refs/notes/*`.

## Roadmap

- Continuous collision for swept sphere-vs-cloth interactions.
- DOM/WebGL integration specs (alignment, lifecycle).
- Canonical UI renderer tests.
- Pointer impulse tuning per element/device.

Pull requests and experiments welcome—this is very much an evolving sandbox.
