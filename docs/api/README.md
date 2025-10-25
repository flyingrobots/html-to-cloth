# Cloth Engine API Overview

This API surface is generated from the engine and simulation modules that power the cloth demo.
Keep these reference points in mind while browsing the TypeDoc output.

## Architecture Overview

- **Engine Core (`src/engine`)** – Entities, components, systems, and the orchestration layer.
- **Simulation Layer (`src/lib`)** – Cloth-specific physics, the simulation world, and the DOM scene
  controller that bridges the engine with the WebGL pipeline.

The layer cake is intentional: engine primitives have no knowledge of cloth, while the simulation
layer can import and compose any engine pieces it needs.

## Key Concepts

### Entities & Components
- `EntityManager`, `Entity`, and `Component` provide a minimalist ECS.
- Entities store components; systems (e.g., `SimulationSystem`) operate on pre-filtered entities
  without fishing for component data manually.

### Engine World & Loops
- `EngineWorld` holds registered systems, handles priority ordering, and lets the loop pause/resume.
- `FixedStepLoop` consumes elapsed time in fixed quanta while avoiding spiral-of-death scenarios.
- `SimulationRunner` couples the loop with the world, supporting real-time ticking and manual steps.

### Simulation Systems
- `SimulationSystem` adapts the engine loop to `SimWorld`, queueing warm starts and sleep configs
  for each cloth body.
- `SimWorld` aggregates `SimBody` instances, advances them via the scheduler, and produces snapshots
  for rendering/debug tools.
- `ClothPhysics` is the Verlet cloth solver with pinning, impulses, and warm-start helpers.
- `ClothSceneController` captures DOM meshes, forwards pointer interaction, and wires everything
  into the simulation runner.

## Quick Start

```ts
import { EngineWorld, SimulationRunner } from '@demo/engine'
import { SimulationSystem } from '@demo/engine/systems'
import { SimWorld } from '@demo/lib/simWorld'

const world = new EngineWorld()
const simWorld = new SimWorld()
const simSystem = new SimulationSystem({ simWorld })
const runner = new SimulationRunner({ engine: world })

world.addSystem(simSystem, { priority: 100 })

function loop(delta: number) {
  runner.update(delta)
  requestAnimationFrame((next) => loop(next / 1000))
}

requestAnimationFrame((start) => loop(start / 1000))
```

Add cloth bodies through `SimWorld.addBody`, hook up the DOM controller, and extend the system list to
render or debug snapshots.

## Additional Guides

- `docs/engine-refactor.md` – high-level roadmap for the ongoing engine overhaul.
- `docs/data-flow.md` – diagrams explaining DOM capture, simulation, and render pipelines.
- Source modules under `src/engine` and `src/lib` include rich JSDoc that TypeDoc surfaces.

Enjoy exploring the internals!
