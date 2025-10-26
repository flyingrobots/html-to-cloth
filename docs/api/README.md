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
import * as THREE from 'three'
import { EngineWorld, SimulationRunner } from '@/engine'
import { SimulationSystem } from '@/engine/systems/simulationSystem'
import { SimWorld, type SimBody } from '@/lib/simWorld'
import { ClothPhysics } from '@/lib/clothPhysics'
import { ClothSceneController } from '@/lib/clothSceneController'

async function bootstrap() {
  // 1. Create the engine primitives.
  const world = new EngineWorld()
  const simWorld = new SimWorld()
  const simulationSystem = new SimulationSystem({ simWorld })
  const runner = new SimulationRunner({ engine: world })

  world.addSystem(simulationSystem, { priority: 100 })

  // 2. Register a cloth body programmatically (optional).
  const geometry = new THREE.PlaneGeometry(1, 1, 16, 16)
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff })
  const mesh = new THREE.Mesh(geometry, material)
  const cloth = new ClothPhysics(mesh)

  const clothBody: SimBody = {
    id: 'demo-cloth',
    update: (dt) => cloth.update(dt),
    isSleeping: () => cloth.isSleeping(),
    wake: () => cloth.wake(),
    wakeIfPointInside: (point) => cloth.wakeIfPointInside(point),
    getBoundingSphere: () => cloth.getBoundingSphere(),
    warmStart: (config) => cloth.warmStart(config),
    configureSleep: (config) => cloth.setSleepThresholds(config.velocityThreshold, config.frameThreshold),
  }

  simWorld.addBody(clothBody)

  // 3. Spin up the DOM/WebGL controller. Cloth elements with `.cloth-enabled` will be captured.
  const controller = new ClothSceneController({
    engine: world,
    simWorld,
    simulationSystem,
    simulationRunner: runner,
  })

  await controller.init()

  // 4. Start the render loop.
  let lastFrame = performance.now()
  function frame(now: number) {
    const deltaSeconds = (now - lastFrame) / 1000
    lastFrame = now

    runner.update(deltaSeconds)
    requestAnimationFrame(frame)
  }

  requestAnimationFrame(frame)

  // 5. Return a cleanup hook for route changes or hot reloads.
  return () => {
    controller.dispose()
    simWorld.clear()
  }
}

bootstrap().catch((error) => {
  console.error('Failed to bootstrap cloth demo', error)
})
```

Common gotchas:

- Ensure the DOM contains at least one element with `class="cloth-enabled"`; the controller swaps
  those nodes into WebGL meshes on first click.
- Dispose the controller before removing the canvas/DOM (e.g., during route changes) so listeners
  and simulation bodies are cleaned up.
- When authoring custom cloth bodies, create `ClothPhysics` instances backed by `THREE.Mesh`
  geometry and register them with `SimWorld.addBody` using adapters that implement `SimBody`.

## Additional Guides

- `docs/engine-refactor.md` – high-level roadmap for the ongoing engine overhaul.
- `docs/data-flow.md` – diagrams explaining DOM capture, simulation, and render pipelines.
- Source modules under `src/engine` and `src/lib` include rich JSDoc that TypeDoc surfaces.

Enjoy exploring the internals!
