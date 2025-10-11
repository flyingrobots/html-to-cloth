# Cloth Web Demo

A proof-of-concept portfolio that hides a WebGL cloth simulation beneath an accessible DOM layout. Clicking any `.cloth-enabled` element swaps it for a textured mesh, runs cloth physics with pointer-driven gusts, and lets the fabric tumble off screen before the DOM reappears.

## Current Highlights

- Canonical meter-based render space layered over the DOM via Three.js.
- DOM capture → tessellated mesh pipeline with lazy html2canvas snapshots.
- Custom cloth solver (Verlet integration, constraint satisfaction, sleep/wake).
- Simulation scheduler + SimWorld for active-body ticking and basic broad-phase sweeps.
- Pointer impulses and collision clamps wired through a unified `applyImpulse` API.
- Tests-as-specs workflow: Vitest coverage for cloth, pooling, scheduler, impulses, SimWorld.

## Getting Started

```bash
pnpm install   # or npm install / yarn
pnpm dev       # start Vite dev server
pnpm build     # production build
pnpm test      # run Vitest suites
```

The project uses React + Vite for rendering and TypeScript (for now) for static tooling. WebGL lives in `src/lib/` alongside the simulation modules.

## Key Scripts

| Script | Description |
| ------ | ----------- |
| `pnpm dev` | Run the dev server with HMR. |
| `pnpm build` | Type-check and bundle for production. |
| `pnpm test` | Execute all Vitest specs (cloth, impulse, scheduler, SimWorld, pooling). |

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
