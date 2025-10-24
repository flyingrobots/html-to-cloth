import * as THREE from 'three'

import type { SimWorld } from '../../lib/simWorld'
import type { EngineWorld } from '../world'
import type { EngineSystem } from '../types'

export type SimulationSystemOptions = {
  simWorld: SimWorld
}

export class SimulationSystem implements EngineSystem {
  id = 'simulation'
  allowWhilePaused = false

  private readonly simWorld: SimWorld
  private world: EngineWorld | null = null

  constructor(options: SimulationSystemOptions) {
    this.simWorld = options.simWorld
  }

  onAttach(world: EngineWorld) {
    this.world = world
  }

  onDetach() {
    this.world = null
    this.simWorld.clear()
  }

  fixedUpdate(dt: number) {
    this.simWorld.step(dt)
  }

  notifyPointer(point: THREE.Vector2) {
    this.simWorld.notifyPointer(point)
  }
}
