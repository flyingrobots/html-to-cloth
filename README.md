# Cloth Web Demo

A proof-of-concept portfolio that hides a WebGL cloth simulation beneath an accessible DOM layout. Clicking any `.cloth-enabled` element swaps it for a textured mesh, runs cloth physics with pointer-driven gusts, and lets the fabric tumble off screen before the DOM reappears.

## Current Highlights

- Canonical meter-based render space layered over the DOM via Three.js.
- DOM capture → tessellated mesh pipeline with lazy html2canvas snapshots.
- Custom cloth solver (Verlet integration, constraint satisfaction, sleep/wake).
- Simulation scheduler + SimWorld for active-body ticking and basic broad-phase sweeps.
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

## Cloth Data Attributes

Each `.cloth-enabled` element can opt into fine-grained layout or physics overrides via `data-` attributes. Missing attributes fall back to automatic inference.

| Attribute | Purpose | Accepted values (default) |
| --- | --- | --- |
| `data-cloth-anchor` | Anchor point used when reconstructing layout in canonical space. | `top`, `bottom`, `left`, `right`, `center`, or hyphenated combos like `top-right`. Auto-inferred from DOM offsets when omitted. |
| `data-cloth-scale` | Controls which axes stretch with the viewport. | `width`, `height`, `width height`/`both`, or `none`. Default: `width height`. |
| `data-cloth-padding` | Override canonical padding (px) from each edge before scaling. | Comma/space separated `top:24,right:80`. Defaults to measured DOM padding. |
| `data-cloth-segments` | Override tessellation density captured by the pool. | Integer ≥ 1. Defaults to adaptive lookup based on screen coverage. |
| `data-cloth-impulse-radius` / `data-cloth-impulse-strength` | Pointer interaction overrides. | Floats > 0. Defaults derived from mesh size. |
| `data-cloth-density` | Multiplier applied to gravity for a single cloth. | `light` (0.6), `medium` (1.0), `heavy` (1.4), or custom float 0.1–3. Default: 1.0. |
| `data-cloth-damping` | Per-cloth velocity damping. | Float 0–0.999. Default: 0.97. |
| `data-cloth-iterations` | Constraint iterations used during simulation. | Integer ≥ 1. Default: global debug value (4). |
| `data-cloth-substeps` | Fixed-step substeps per frame. | Integer ≥ 1. Default: global debug value (1). |
| `data-cloth-turbulence` | Initial random displacement applied on activation. | Float 0–5. Default: 0.06. |
| `data-cloth-pin` | Pin preset applied before release. | `top`, `bottom`, `corners`, `none`. Default: debug pin mode (`top`). |
| `data-cloth-release` | Delay before releasing pins (ms). | Float ≥ 0. Default: 900 ms. |
| `data-cloth-label` | Friendly label for the debug inspector. | Any string. Defaults to text content / `id`. |

## Roadmap

- Continuous collision for swept sphere-vs-cloth interactions.
- DOM/WebGL integration specs (alignment, lifecycle).
- Canonical UI renderer tests.
- Pointer impulse tuning per element/device.

Pull requests and experiments welcome—this is very much an evolving sandbox.
