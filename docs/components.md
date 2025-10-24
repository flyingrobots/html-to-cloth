# Component Overview

```mermaid
flowchart LR
  subgraph UI[DOM & UI Layer]
    Drawer(Debug Drawer)
    DOM[DOMToWebGL]
  end

  subgraph Engine[Engine Core]
    Loop[FixedStepLoop]
    World[EngineWorld]
    SimSystem[SimulationSystem]
  end

  subgraph Simulation[Simulation Layer]
    SimWorld
    Collision[CollisionSystem]
    Scheduler[SimulationScheduler]
  end

  subgraph Cloth[Cloth Entities]
    Adapter[ClothBodyAdapter]
    ClothPhysics
    Gravity[GravityController]
  end

  subgraph Control[Controller Layer]
    Scene[ClothSceneController]
    SimController[ClothSimulationController]
  end

  User[[User Input]] -->|Pointer events| Scene
  Drawer -->|Actions| Scene
  Scene -->|Mesh Prep| DOM
  Scene -->|Static geometry| Collision
  Scene -->|Render| DOM
  Scene -->|Register bodies| SimController
  Scene -->|Pointer notify| SimController
  Scene -.->|UI metrics| Drawer

  SimController -->|Add system| World
  SimController -->|snapshots| Scene
  SimController --> SimSystem

  Loop -->|tick(dt)| World
  World -->|fixedUpdate(dt)| SimSystem
  SimSystem --> SimWorld
  SimWorld --> Scheduler
  SimWorld -->|collision bounds| Collision
  SimWorld -->|bodies| Adapter
  Adapter --> ClothPhysics
  ClothPhysics --> Gravity
  Gravity --> ClothPhysics
  Adapter -->|pointer impulses| ClothPhysics
```

## Key Responsibilities

- **ClothSceneController**: Manages DOM capture, element activation, pointer state, and bridges UI interactions into the simulation controller.
- **ClothSimulationController**: Wraps EngineWorld/FixedStepLoop/SimulationSystem, queuing warm-start & sleep config and exposing per-step snapshots.
- **FixedStepLoop**: Maintains fixed-timestep accumulation and drives `EngineWorld` updates.
- **EngineWorld**: Manages system registration/ordering and delegates fixed/frame updates.
- **SimulationSystem**: Owns cloth body registration, warm-start/sleep queues, and snapshots from `SimWorld`.
- **SimWorld**: Maintains simulation bodies, routing pointer notifications and broad-phase wake checks through `SimulationScheduler` and `CollisionSystem`.
- **ClothBodyAdapter**: Adapts DOM cloth elements into `SimBody`s, mediating pointer impulses, warm-starts, and offscreen handling.
- **ClothPhysics + GravityController**: Execute Verlet integration with dependency-injected gravity and relaxation routines.
- **DOMToWebGL + CollisionSystem**: Synchronize mesh transforms and static collision geometry with the DOM.
