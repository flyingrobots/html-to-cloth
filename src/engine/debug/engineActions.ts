import * as THREE from 'three'

import type { SimulationRunner } from '../simulationRunner'
import type { EngineWorld } from '../world'
import type { CameraSystem } from '../camera/CameraSystem'
import type { SimulationSystem } from '../systems/simulationSystem'

export type EngineActionsOptions = {
  runner: SimulationRunner
  world: EngineWorld
  camera?: CameraSystem | null
  simulation?: SimulationSystem | null
}

/**
 * Small facade that routes debug UI interactions into the engine layer.
 *
 * Intentionally narrow: we start with engine-safe actions that do not require
 * per-body mutation (those will be added as dedicated SimulationSystem APIs later).
 */
export class EngineActions {
  private readonly runner: SimulationRunner
  private readonly world: EngineWorld
  private readonly camera: CameraSystem | null
  private readonly simulation: SimulationSystem | null

  constructor(options: EngineActionsOptions) {
    this.runner = options.runner
    this.world = options.world
    this.camera = options.camera ?? null
    this.simulation = options.simulation ?? null
  }

  /** Enables/disables real-time ticking. */
  setRealTime(enabled: boolean) {
    this.runner.setRealTime(enabled)
  }

  /** Performs exactly one fixed step on the runner. */
  stepOnce() {
    this.runner.stepOnce()
  }

  /** Adjusts the number of substeps per fixed tick. */
  setSubsteps(substeps: number) {
    this.runner.setSubsteps(substeps)
  }

  /**
   * Camera controls (no-ops when no camera system is provided).
   */
  setCameraTarget(position: THREE.Vector3) {
    this.camera?.setTarget(position)
  }

  setCameraTargetZoom(zoom: number) {
    this.camera?.setTargetZoom(zoom)
  }

  jumpCamera(position: THREE.Vector3, zoom?: number) {
    this.camera?.jumpTo(position, zoom)
  }

  configureCamera(options: Parameters<CameraSystem['configure']>[0]) {
    this.camera?.configure(options)
  }

  /** Broadcasts gravity to all simulation bodies (if supported). */
  setGravityScalar(gravity: number) {
    if (!this.simulation) return
    const g = new THREE.Vector3(0, -gravity, 0)
    this.simulation.broadcastGravity(g)
  }

  /** Broadcasts constraint iterations to all bodies (if supported). */
  setConstraintIterations(iterations: number) {
    this.simulation?.broadcastConstraintIterations(iterations)
  }

  /** Exposes the attached world for advanced hooks (read-only usage suggested). */
  getWorld() {
    return this.world
  }
}
