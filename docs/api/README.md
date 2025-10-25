# Cloth Engine API Overview

Welcome to the generated API reference for the cloth demo engine. This guide introduces the
core concepts that surface throughout the TypeDoc output and shows how the pieces fit together.

## Architecture at a Glance

The engine code is split into two broad layers:

- **Engine Core (`src/engine`)** – shared infrastructure such as the entity/component system,
  the fixed-step loop, and orchestrators like `SimulationRunner` and `SimulationSystem`.
- **Simulation Modules (`src/lib`)** – cloth-specific systems, world coordination logic, and
  the scene controller that bridges DOM meshes with the engine core.

Each layer is designed so that higher level modules depend on the layer beneath them, never the
other way around. That separation lets us reuse the engine primitives for future simulations.

## Key Concepts

### Entity / Component System

- `EntityManager`, `Entity`, and `Component` form a lightweight ECS used by higher level systems.
- Entities are simple component bags; systems declare the data they operate on and the manager
  keeps registration in sync.

### Engine World & Systems

- `EngineWorld` owns system lifecycles, priorities, and pause state. Systems implement
  `fixedUpdate`/`frameUpdate` hooks to participate in the loop.
- `SimulationRunner` drives a `FixedStepLoop`, wiring elapsed time into the world and supporting
  manual stepping for debug tooling.
- `SimulationSystem` bridges the engine world with the cloth `SimWorld`, queuing warm-start and
  sleep configuration for each body.

### Simulation Layer

- `SimWorld` tracks all simulated cloth bodies, manages wake/sleep checks, and produces immutable
  snapshots for render/debug consumers.
- `ClothPhysics` encapsulates the Verlet cloth solver with pinning, impulses, and warm-start
  support.
- `ClothSceneController` (public entry point) wires DOM capture, pointer input, and the simulation
  runner together.

## Quick Start

```ts
import { EngineWorld, SimulationRunner } from '@demo/engine'
import { SimulationSystem } from '@demo/engine/systems'
import { SimWorld } from '@demo/lib/simWorld'

const world = new EngineWorld()
const simWorld = new SimWorld()
const simulationSystem = new SimulationSystem({ simWorld })
const runner = new SimulationRunner({ engine: world })

world.addSystem(simulationSystem, { priority: 100 })

function gameLoop(deltaSeconds: number) {
  runner.update(deltaSeconds)
  requestAnimationFrame((next) => gameLoop(next / 1000))
}

requestAnimationFrame((initial) => gameLoop(initial / 1000))
```

From here you can add cloth bodies via `SimWorld.addBody`, wire the DOM controller, or extend the
system list with rendering/debug logic.

## Further Reading

- `docs/engine-refactor.md` – broader strategy for the engine modernization.
- `docs/data-flow.md` – diagrams of DOM, simulation, and render flows.
- Source code under `src/engine` and `src/lib` – each module includes JSDoc comments that TypeDoc
  surfaces for deeper reference.

Happy hacking!
