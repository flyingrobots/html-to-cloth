# Engine Packaging Evaluation

Date: 2025-10-29

Goal: Evaluate extracting the reusable engine into a package (or packages) that can be consumed by other demos/apps without copying source files.

## Scope & Targets

Candidate modules:
- Core runtime: `EngineWorld`, `FixedStepLoop`, `SimulationRunner`, types.
- Systems: `SimulationSystem` (pure logic), `CameraSystem` (spring + snapshot), optional render-only systems (`WorldRendererSystem`, `DebugOverlaySystem`, `RenderSettingsSystem`).
- Entity layer: `Entity`, `EntityManager`, `Component`.

Non-goals for v0:
- App-specific controller (`ClothSceneController`), DOM adapters, and WebGL view (`DOMToWebGL`). These remain app-owned.

## Packaging Options

1) Single package: `@html-to-cloth/engine`
- Pros: simplest publishing and versioning.
- Cons: render systems introduce a `three` peer for consumers that only need core.

2) Split packages (recommended decision):
- `@html-to-cloth/engine-core`: world/loop/runner/types/entity. No `three` dependency.
- `@html-to-cloth/engine-sim`: `SimulationSystem` + sim-world interfaces (pure TS, no `three`).
- `@html-to-cloth/engine-render`: camera + render-only systems that depend on `three`.
- Pros: smaller installs, clean peer deps; consumers pull only what they need.
- Cons: more workspace setup.

## Build & Tooling

- Builder: `tsup` (fast, emits ESM + dts). Example:
  - `tsup src/index.ts --format esm --dts --sourcemap --minify --treeshake`
- Output: ESM-only for modern bundlers; include `types` and `exports` in `package.json`.
- Tree-shaking: ensure submodules are side-effect free; set `"sideEffects": false`.
- Target: `es2020` (matches current codebase + bundler expectations).
- Types: `declaration: true`, `stripInternal` for non-public helpers.

## Dependencies

- Core/sim packages: no runtime deps aside from TS helpers.
- Render package: list `three` as `peerDependencies` (allow host app to control version).
- Dev deps: `typescript`, `vitest`, `tsup`, `typedoc`.

## Public API Surface (draft)

- engine-core
  - `EngineWorld`, `FixedStepLoop`, `SimulationRunner` (decoupled substeps/catch-up), `types` (EngineSystem, EngineLogger, etc.), entity layer.
- engine-sim
  - `SimulationSystem` + `SimWorld` interfaces and snapshot types.
- engine-render
  - `CameraSystem` (+ `CameraSpring` types), `WorldRendererSystem` (view contract), `DebugOverlaySystem`/`State`, `RenderSettingsSystem`/`State`.

Example `exports` (engine-core):

```json
{
  "name": "@html-to-cloth/engine-core",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "sideEffects": false,
  "files": ["dist"],
  "peerDependencies": {},
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts --sourcemap",
    "test": "vitest --run"
  }
}
```

## CI & Docs

- Add `publish:dry-run` to CI for tags; gate real publish to manual workflow.
- Typedoc stays in monorepo; per-package README with quickstart.

## Migration Plan (1–2 weeks realistic)

1. Create `/packages/engine-core`, `/packages/engine-sim`, `/packages/engine-render` in a workspace.
2. Move files and update import paths (no API changes initially).
3. Wire `tsup` builds + `exports`.
4. Update app to consume workspace packages; ensure unit tests still pass.
5. Add CI matrix to build each package, run unit tests against both package builds and monorepo sources.
6. Publish `0.1.0` pre-release to npm with `next` tag (end of week 2), after consumers validate.

## Risks & Mitigations (and CI controls)

- Import path churn: mitigate with codemods and incremental moves.
- Version drift between packages: enforce lockstep versions via changesets/release script; CI check that `packages/*/package.json` versions match. Add a job that builds each package and runs the app against the built artifacts to ensure cross-package compatibility.
- Peer dep mismatch for `three`: document required major version; rely on semver peer.

## Recommendation

Proceed with split packages under an npm workspace. Rationale tied to our use cases:
- App-only consumers often need world/loop/entity without `three` → clean `engine-core` peer surface.
- Rendering consumers want camera/render-only systems with `three` as a peer → `engine-render` isolates that.
- Simulation consumers may embed their own physics world; keeping `engine-sim` separate avoids pulling render types.

Timeline: 1–2 weeks including workspace setup, code moves, type surface audit, CI matrix, and publish of a `0.1.0` preview. Hidden coupling and test gaps will stretch effort; CI jobs above are designed to catch these early.
