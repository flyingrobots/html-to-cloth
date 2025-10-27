import * as THREE from 'three'

import type { SimulationRunner } from '../simulationRunner'
import type { EngineWorld } from '../world'
import type { CameraSystem } from '../camera/CameraSystem'

export type EngineActionsOptions = {
  runner: SimulationRunner
  world: EngineWorld
  camera?: CameraSystem | null
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

  constructor(options: EngineActionsOptions) {
    this.runner = options.runner
    this.world = options.world
    this.camera = options.camera ?? null
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

  /** Exposes the attached world for advanced hooks (read-only usage suggested). */
  getWorld() {
    return this.world
  }
}

