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
    Runner[SimulationRunner]
  end

  User[[User Input]] -->|Pointer events| Scene
  Drawer -->|Actions| Scene
  Scene -->|Mesh Prep| DOM
  Scene -->|Static geometry| Collision
  Scene -->|Render| DOM
  Scene -->|Pointer notify| SimSystem
  Scene -.->|UI metrics| Drawer
  Scene -->|Tick| Runner

  Runner -->|Drive loop| Loop
  Runner -->|Step world| World

  Scene -->|Register bodies| SimSystem
  SimSystem -->|Snapshots| Scene

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

- **ClothSceneController**: Manages DOM capture, element activation, pointer state, and bridges UI interactions into the simulation runner/system.
- **SimulationRunner**: Owns the fixed-step loop for an `EngineWorld`, handles real-time toggling and substep configuration.
- **SimulationSystem**: Owns cloth body registration, warm-start/sleep queues, and snapshots from `SimWorld`.
- **EntityManager / Entities**: Track cloth entities and their components (currently the cloth body adapters), enabling future expansion of game-style components.
- **FixedStepLoop**: Maintains fixed-timestep accumulation and drives `EngineWorld` updates.
- **EngineWorld**: Manages system registration/ordering and delegates fixed/frame updates.
- **SimWorld**: Maintains simulation bodies, routing pointer notifications and broad-phase wake checks through `SimulationScheduler` and `CollisionSystem`.
- **ClothBodyAdapter**: Adapts DOM cloth elements into `SimBody`s, mediating pointer impulses, warm-starts, and offscreen handling.
- **ClothPhysics + GravityController**: Execute Verlet integration with dependency-injected gravity and relaxation routines.
- **DOMToWebGL + CollisionSystem**: Synchronize mesh transforms and static collision geometry with the DOM.
