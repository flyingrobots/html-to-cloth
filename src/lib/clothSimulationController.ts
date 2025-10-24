import * as THREE from 'three'

import { EngineWorld } from '../engine/world'
import { FixedStepLoop } from '../engine/fixedStepLoop'
import {
  SimulationSystem,
  type RegisterBodyOptions,
} from '../engine/systems/simulationSystem'
import { SimWorld } from './simWorld'

const DEFAULT_FIXED_DELTA = 1 / 60

export type ClothSimulationControllerOptions = {
  engine?: EngineWorld
  loop?: FixedStepLoop
  simulationSystem?: SimulationSystem
  simWorld?: SimWorld
  fixedDelta?: number
  maxSubSteps?: number
}

export class ClothSimulationController {
  private readonly engine: EngineWorld
  private readonly loop: FixedStepLoop
  private readonly simulationSystem: SimulationSystem
  private readonly simWorld: SimWorld
  private readonly fixedDelta: number
  private substeps = 1
  private realTime = true

  constructor(options: ClothSimulationControllerOptions = {}) {
    this.fixedDelta = options.fixedDelta ?? DEFAULT_FIXED_DELTA
    this.simWorld = options.simWorld ?? new SimWorld()
    this.simulationSystem =
      options.simulationSystem ?? new SimulationSystem({ simWorld: this.simWorld })

    this.engine = options.engine ?? new EngineWorld()
    this.engine.addSystem(this.simulationSystem, { id: 'simulation', priority: 100 })

    this.loop =
      options.loop ??
      new FixedStepLoop({
        fixedDelta: this.fixedDelta,
        maxSubSteps: options.maxSubSteps ?? 5,
        step: (dt) => this.stepSimulation(dt),
      })
  }

  update(delta: number) {
    if (!this.realTime) return
    this.loop.update(delta)
  }

  stepOnce() {
    this.stepSimulation(this.fixedDelta)
  }

  setRealTime(enabled: boolean) {
    this.realTime = enabled
    if (enabled) {
      this.loop.reset()
      this.loop.setPaused(false)
    } else {
      this.loop.setPaused(true)
    }
  }

  setSubsteps(substeps: number) {
    this.substeps = Math.max(1, Math.round(substeps))
  }

  notifyPointer(point: THREE.Vector2) {
    this.simulationSystem.notifyPointer(point)
  }

  addBody(body: any, options?: RegisterBodyOptions) {
    this.simulationSystem.addBody(body, options)
  }

  removeBody(id: string) {
    this.simulationSystem.removeBody(id)
  }

  queueWarmStart(id: string, config?: Parameters<SimulationSystem['queueWarmStart']>[1]) {
    this.simulationSystem.queueWarmStart(id, config)
  }

  queueSleepConfiguration(id: string, config: Parameters<SimulationSystem['queueSleepConfiguration']>[1]) {
    this.simulationSystem.queueSleepConfiguration(id, config)
  }

  clear() {
    this.simulationSystem.clear()
  }

  getSnapshot() {
    return this.simulationSystem.getSnapshot()
  }

  private stepSimulation(dt: number) {
    const iterations = Math.max(1, this.substeps)
    const stepSize = dt / iterations
    for (let i = 0; i < iterations; i++) {
      this.engine.step(stepSize)
    }
  }
}
